import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PerfAttempt = { is_correct: boolean; created_at: string; questions: { subject: string; topic: string } | null; source: "bank" | "assistant" | "provao" };

// Combines bank, Meu Assistente and finished Provão answers for the signed-in user only.
export const getMyPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().positive().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const since = data.days ? new Date(Date.now() - data.days * 864e5).toISOString() : null;
    const out: PerfAttempt[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from("attempts").select("is_correct, created_at, questions(subject, topic)").eq("user_id", userId).order("created_at").range(from, from + PAGE - 1);
      if (since) q = q.gte("created_at", since);
      const { data: rows, error } = await q;
      if (error) throw new Error("Não foi possível carregar o desempenho.");
      for (const r of rows ?? []) out.push({ ...(r as any), source: "bank" });
      if (!rows || rows.length < PAGE) break;
    }
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from("assistant_attempts").select("is_correct, created_at, subject, topic").eq("user_id", userId).order("created_at").range(from, from + PAGE - 1);
      if (since) q = q.gte("created_at", since);
      const { data: rows, error } = await q;
      if (error) throw new Error("Não foi possível carregar o desempenho.");
      for (const r of rows ?? []) out.push({ is_correct: r.is_correct, created_at: r.created_at, questions: { subject: r.subject, topic: r.topic }, source: "assistant" });
      if (!rows || rows.length < PAGE) break;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let pq = supabaseAdmin.from("provao_sessions").select("questions, answers, completed_at").eq("user_id", userId).eq("status", "completed");
    if (since) pq = pq.gte("completed_at", since);
    const { data: sessions, error } = await pq;
    if (error) throw new Error("Não foi possível carregar o desempenho.");
    for (const s of sessions ?? []) {
      const qs = Array.isArray(s.questions) ? (s.questions as any[]) : [];
      const ans = (s.answers ?? {}) as Record<string, number>;
      qs.forEach((q, i) => {
        if (ans[String(i)] === undefined) return;
        out.push({ is_correct: q.correct_index === ans[String(i)], created_at: s.completed_at ?? new Date().toISOString(), questions: { subject: q.subject ?? "Provão", topic: q.topic ?? "" }, source: "provao" });
      });
    }
    return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
  });
