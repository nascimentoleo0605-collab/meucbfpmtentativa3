import { createAiModel } from "./ai-model.server";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const schema = z.object({ questions: z.array(z.object({ topic: z.string(), statement: z.string(), options: z.array(z.string()), correct_index: z.number(), explanation: z.string() })) });

export async function generateFromMaterial(apiKey: string, material: string, count = 10) {

  try {
    const result = streamText({
      model: createAiModel(apiKey),
      output: Output.object({ schema }),
      system: "Você é um professor que cria questões inéditas de múltipla escolha em português brasileiro, usando SOMENTE o conteúdo do material fornecido. Cada questão tem exatamente quatro alternativas distintas e uma única correta, e uma explicação curta do gabarito. Entregue sempre o resultado estruturado completo.",
      prompt: `Crie exatamente ${count} questões sobre o material abaixo, cobrindo pontos diferentes. Em "topic" coloque o tema curto da questão. Distribua o gabarito entre A, B, C e D.\n\nMATERIAL:\n${material}`,
    });
    const out = await result.output;
    const qs = (out?.questions ?? []).filter((q) => q.statement.trim() && q.options.length === 4 && q.options.every((o) => o.trim()) && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < 4).slice(0, count);
    if (qs.length < Math.ceil(count / 2)) throw new Error("A IA não conseguiu criar questões com este material. Tente outro PDF.");
    return qs.map((q) => ({ ...q, subject: "Material enviado", sourceId: "" }));
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) throw new Error("A IA não completou as questões. Tente novamente.");
    const { isTerminalAiError, gatewayError } = await import("./provao.server");
    if (error instanceof Error && !isTerminalAiError(error) && !(error as { statusCode?: number }).statusCode && /questões/.test(error.message)) throw error;
    throw gatewayError(error);
  }
}
