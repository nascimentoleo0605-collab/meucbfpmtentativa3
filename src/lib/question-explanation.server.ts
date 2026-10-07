import { createAiModel } from "./ai-model.server";
import { streamText } from "ai";


function explanationError(error: unknown) {
  if (!error || typeof error !== "object") return "Não foi possível gerar a explicação agora.";
  const candidate = error as { statusCode?: number; message?: string };
  if (candidate.statusCode === 402) return "Estamos em atualizações no momento. Tente novamente em breve — seu progresso fica salvo.";
  if (candidate.statusCode === 429) return "Há muitas explicações sendo geradas. Aguarde um pouco e tente novamente.";
  if (candidate.statusCode && candidate.statusCode >= 500) return "A explicação está temporariamente indisponível.";
  return "Não foi possível gerar a explicação agora.";
}

export async function createQuestionExplanation(input: {
  apiKey: string;
  statement: string;
  options: string[];
  correctIndex: number;
}) {
  const correct = input.options[input.correctIndex];
  if (!correct) throw new Error("Esta questão não possui um gabarito válido.");



  try {
    const result = streamText({
      model: createAiModel(input.apiKey),
      system: "Você é um instrutor didático. Responda em português brasileiro, com precisão, sem saudações, sem mencionar IA e sem inventar fatos. Seja breve.",
      prompt: `Explique em no máximo 3 frases por que o gabarito desta questão é correto. Apresente somente o conteúdo necessário para o aluno entender o ponto principal.\n\nQuestão: ${input.statement}\n\nAlternativas:\n${input.options.map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`).join("\n")}\n\nGabarito: ${String.fromCharCode(65 + input.correctIndex)}) ${correct}`,
    });
    const explanation = (await result.text).trim();
    if (!explanation) throw new Error("A explicação voltou vazia.");
    return explanation;
  } catch (error) {
    throw new Error(explanationError(error));
  }
}
