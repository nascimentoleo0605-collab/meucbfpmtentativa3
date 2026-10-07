import { createAiModel } from "./ai-model.server";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

export type ExamQuestion = {
  sourceId: string;
  subject: string;
  topic: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string;
};
export type ReferenceQuestion = ExamQuestion;

const outputSchema = z.object({ questions: z.array(z.object({
  sourceId: z.string(),
  statement: z.string(),
  options: z.array(z.string()),
  correct_index: z.number(),
  explanation: z.string(),
})) });

type ApiErr = { statusCode?: number; responseBody?: string; message?: string; lastError?: unknown; cause?: unknown; errors?: unknown[] } | null;
function unwrap(error: unknown): ApiErr {
  let e = error as ApiErr;
  for (let i = 0; i < 5 && e && !e.statusCode; i++) e = (e.lastError ?? e.cause ?? e.errors?.[e.errors.length - 1] ?? null) as ApiErr;
  if (!e?.statusCode && /payment required/i.test((error as ApiErr)?.message ?? "")) return { statusCode: 402 };
  return e?.statusCode ? e : (error as ApiErr);
}
export function isTerminalAiError(error: unknown) {
  const s = unwrap(error)?.statusCode;
  return s === 400 || s === 401 || s === 402 || s === 403;
}
export function gatewayError(error: unknown): Error {
  const out = gatewayMessage(error);
  const status = unwrap(error)?.statusCode;
  if (status) Object.assign(out, { statusCode: status });
  return out;
}
function gatewayMessage(error: unknown): Error {
  const e = unwrap(error);
  let safe = "";
  try {
    const body = JSON.parse(e?.responseBody ?? "{}") as { message?: string; error?: { message?: string } };
    safe = body.message ?? body.error?.message ?? "";
  } catch { /* Invalid upstream error body. */ }
  if (e?.statusCode === 402) return new Error("Estamos em atualizações no momento. Tente novamente em breve — seu progresso fica salvo.");
  if (e?.statusCode === 403) return new Error("Estamos em atualizações no momento. Tente novamente em breve — seu progresso fica salvo.");
  if (e?.statusCode === 429) return new Error("Muitas gerações em andamento. Aguarde um pouco e continue o Provão.");
  if (e?.statusCode && e.statusCode >= 500) return new Error("A IA está temporariamente indisponível. Continue o Provão mais tarde.");
  if (e?.statusCode === 401) return new Error("A geração por IA não está configurada.");
  if (e?.statusCode === 400) return new Error(safe.slice(0, 300) || "A IA não conseguiu processar estas questões.");
  return new Error("A IA não conseguiu gerar este bloco de questões. Continue mais tarde sem perder o progresso.");
}

export async function generateProvaoBatch(apiKey: string, references: ReferenceQuestion[]): Promise<ExamQuestion[]> {

  try {
    const result = streamText({
      model: createAiModel(apiKey),
      output: Output.object({ schema: outputSchema }),
      system: "Você é um professor que elabora simulados inéditos para formação policial em português brasileiro. Use SOMENTE os conceitos das questões de referência. Preserve a resposta factualmente correta, mas crie enunciados e alternativas novos e autocontidos; não copie o texto original. Não invente leis, números ou fatos não presentes. Produza uma questão para CADA referência, com exatamente quatro alternativas distintas e uma única correta. Dê uma explicação curta e objetiva para o gabarito. Entregue sempre o resultado estruturado completo.",
      prompt: `Reescreva as ${references.length} referências abaixo como ${references.length} questões inéditas, na mesma ordem. Preserve exatamente cada sourceId. Use os conceitos dos gabaritos e comentários. Distribua a posição da resposta correta entre A, B, C e D. Evite ambiguidade.\n\n${references.map((q, i) => `${i + 1}. sourceId: ${q.sourceId}\nMatéria: ${q.subject}; Assunto: ${q.topic}\nEnunciado: ${q.statement}\nAlternativas: ${q.options.map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`).join(" | ")}\nResposta correta: ${q.options[q.correct_index]}\nComentário: ${q.explanation || "Sem comentário."}`).join("\n\n")}`,
    });
    const parsed = await result.output;
    if (!parsed || !parsed.questions.length) throw new Error("incomplete");
    // Be tolerant: match by sourceId (fallback to order), trim to 4 options keeping the correct one.
    const out: ExamQuestion[] = [];
    references.forEach((reference, index) => {
      const question = parsed.questions.find((q) => q.sourceId === reference.sourceId) ?? parsed.questions[index];
      if (!question || question.statement.trim().length < 10) return;
      const options = question.options.map((o) => o.trim().replace(/^[A-Ea-e][).:-]\s*/, "")).filter(Boolean);
      const ci = Math.round(question.correct_index);
      if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) return;
      const correct = options[ci]!;
      const others = [...new Set(options.filter((o, i) => i !== ci && o.toLowerCase() !== correct.toLowerCase()))].slice(0, 3);
      if (others.length < 3) return;
      const pos = Math.min(ci, 3);
      const finalOptions = [...others]; finalOptions.splice(pos, 0, correct);
      out.push({ sourceId: reference.sourceId, subject: reference.subject, topic: reference.topic, statement: question.statement.trim(), options: finalOptions, correct_index: pos, explanation: question.explanation.trim() || `Resposta correta: ${correct}.` });
    });
    if (out.length < references.length) throw new Error("incomplete");
    return out;
  } catch (error) {
    if (unwrap(error)?.statusCode) throw gatewayError(error);
    if (NoObjectGeneratedError.isInstance(error)) throw new Error("A IA não completou este bloco. Continue o Provão mais tarde.");
    if (error instanceof Error && ["incomplete", "invalid"].includes(error.message)) throw new Error("A IA não completou este bloco. Continue o Provão mais tarde.");
    throw gatewayError(error);
  }
}
