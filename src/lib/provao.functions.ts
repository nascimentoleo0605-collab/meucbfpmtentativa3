import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateProvaoBatch, type ExamQuestion, type ReferenceQuestion } from "./provao.server";
import { loadQuestionBank } from "./question-bank";

const uuid = z.string().uuid();
type SessionRow = { id: string; user_id: string; status: string; questions: unknown; answers: unknown; batch_count: number; score: number | null; created_at: string; completed_at: string | null };
type PublicQuestion = Omit<ExamQuestion, "correct_index" | "explanation">;

function visible(row: SessionRow) {
  const questions = (Array.isArray(row.questions) ? row.questions : []) as ExamQuestion[];
  const answers = row.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers as Record<string, number> : {};
  return {
    id: row.id, status: row.status, createdAt: row.created_at, completedAt: row.completed_at,
    questions: questions.map(({ correct_index, explanation, ...q }): PublicQuestion => q),
    answers, count: questions.length,
    result: row.status === "completed" ? {
      score: row.score ?? 0,
      review: questions.map((q, index) => ({ number: index + 1, subject: q.subject, topic: q.topic, correctIndex: q.correct_index, selectedIndex: answers[String(index)] ?? null, explanation: q.explanation })),
    } : null,
  };
}

async function current(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("provao_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Não foi possível consultar seu Provão.");
  return data as SessionRow | null;
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

function spread(rows: ReferenceQuestion[], count: number) {
  const byTopic = new Map<string, ReferenceQuestion[]>();
  for (const row of shuffled(rows)) {
    const key = `${row.subject}\u0000${row.topic}`;
    byTopic.set(key, [...(byTopic.get(key) ?? []), row]);
  }
  const buckets = shuffled([...byTopic.values()]);
  const picked: ReferenceQuestion[] = [];
  while (picked.length < count && buckets.length) {
    for (let i = buckets.length - 1; i >= 0; i--) {
      const item = buckets[i]?.pop();
      if (item) picked.push(item);
      if (!buckets[i]?.length) buckets.splice(i, 1);
      if (picked.length === count) break;
    }
  }
  return picked;
}

function clean(row: { id: string; subject: string; topic: string; statement: string; options: unknown; correct_index: number; explanation: string }): ReferenceQuestion | null {
  if (!Array.isArray(row.options) || row.options.length < 2 || row.options.some((o) => typeof o !== "string") || !row.options[row.correct_index] || !row.statement) return null;
  return { sourceId: row.id, subject: row.subject, topic: row.topic, statement: row.statement, options: row.options as string[], correct_index: row.correct_index, explanation: row.explanation ?? "" };
}

export const getProvao = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const row = await current(context.userId);
  return row ? visible(row) : null;
});

export const startProvao = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const existing = await current(context.userId);
  if (existing?.status === "draft") return visible(existing);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { startOfDaySP } = await import("./daily-limit.server");
  const { count } = await supabaseAdmin.from("provao_sessions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", startOfDaySP());
  if ((count ?? 0) >= 1) throw new Error("Você já criou o seu Provão de hoje. Volte amanhã para um novo simulado.");
  const { data, error } = await supabaseAdmin.from("provao_sessions").insert({ user_id: context.userId }).select().single();
  if (error || !data) throw new Error("Não foi possível começar o Provão.");
  return visible(data as SessionRow);
});

export const addProvaoBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("provao_sessions").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    if (error || !row || row.status !== "draft") throw new Error("Provão não encontrado ou já finalizado.");
    const session = row as SessionRow;
    const existing = (Array.isArray(session.questions) ? session.questions : []) as ExamQuestion[];
    if (existing.length >= 50) return visible(session);
    const key = process.env['APP_OPENAI_API_KEY'];
    if (!key) throw new Error("A geração por IA não está configurada.");
    const module3 = session.batch_count < 4 ? 10 : 5;
    const module1 = session.batch_count === 4 ? 2 : 0;
    const module2 = session.batch_count === 4 ? 3 : 0;
    let all;
    try {
      all = await loadQuestionBank((from, to) => context.supabase.from("questions")
        .select("id, subject, topic, statement, options, correct_index, explanation")
        .order("created_at", { ascending: false }).range(from, to));
    } catch { throw new Error("Não foi possível consultar as questões já cadastradas."); }
    const available = all.map(clean).filter((q): q is ReferenceQuestion => q !== null && !existing.some((e) => e.sourceId === q.sourceId));
    const refs = [
      ...spread(available.filter((q) => /^m[oó]dulo\s*3\b/i.test(q.subject)), module3),
      ...spread(available.filter((q) => /^m[oó]dulo\s*1\b/i.test(q.subject)), module1),
      ...spread(available.filter((q) => /^m[oó]dulo\s*2\b/i.test(q.subject)), module2),
    ];
    if (refs.length !== 10) throw new Error("Faltam questões cadastradas nos módulos 1, 2 ou 3 para montar o Provão.");
    // Generation is a separate call per block, so a slow request never discards completed blocks.
    const generated = await generateProvaoBatch(key, refs);
    const next = [...existing, ...shuffled(generated)];
    const { data: updated, error: saveError } = await supabaseAdmin.from("provao_sessions")
      .update({ questions: next, batch_count: session.batch_count + 1 })
      .eq("id", session.id).eq("user_id", context.userId).eq("status", "draft").eq("batch_count", session.batch_count).select().maybeSingle();
    if (saveError || !updated) throw new Error("Não foi possível salvar este bloco. Atualize a página antes de continuar.");
    return visible(updated as SessionRow);
  });

export const saveProvaoAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid, index: z.number().int().min(0).max(49), selected: z.number().int().min(0).max(3) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("provao_sessions").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    if (!row || row.status !== "draft" || !Array.isArray(row.questions) || row.questions.length !== 50 || !row.questions[data.index]) throw new Error("Provão indisponível para responder.");
    const answers = row.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers as Record<string, number> : {};
    const { data: updated, error } = await supabaseAdmin.from("provao_sessions")
      .update({ answers: { ...answers, [data.index]: data.selected } })
      .eq("id", row.id).eq("user_id", context.userId).eq("status", "draft").eq("updated_at", row.updated_at).select().maybeSingle();
    if (error || !updated) throw new Error("Não foi possível salvar sua resposta. Atualize a página e tente novamente.");
    return visible(updated as SessionRow);
  });

export const finishProvao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("provao_sessions").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    if (!row || row.status !== "draft") throw new Error("Provão não encontrado ou já finalizado.");
    const questions = (Array.isArray(row.questions) ? row.questions : []) as ExamQuestion[];
    const answers = row.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers as Record<string, number> : {};
    if (questions.length !== 50 || Object.keys(answers).length !== 50 || questions.some((q, index) => { const answer = answers[String(index)]; return answer === undefined || !Number.isInteger(answer) || answer < 0 || answer > 3 || !Number.isInteger(q.correct_index); })) throw new Error("Responda às 50 questões antes de finalizar.");
    const score = questions.filter((q, index) => q.correct_index === answers[String(index)]).length;
    const { data: updated, error } = await supabaseAdmin.from("provao_sessions").update({ status: "completed", score, completed_at: new Date().toISOString() })
      .eq("id", row.id).eq("user_id", context.userId).eq("status", "draft").select().maybeSingle();
    if (error || !updated) throw new Error("Não foi possível corrigir o Provão.");
    return visible(updated as SessionRow);
  });