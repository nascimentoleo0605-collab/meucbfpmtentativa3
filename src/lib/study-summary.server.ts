import { createAiModel } from "./ai-model.server";
import { streamText } from "ai";


function gatewayMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Não foi possível gerar o resumo agora.";
  const candidate = error as { statusCode?: number; responseBody?: string; message?: string };
  let upstreamMessage = "";
  if (candidate.responseBody) {
    try {
      const parsed = JSON.parse(candidate.responseBody) as { message?: string; error?: { message?: string } };
      upstreamMessage = parsed.message ?? parsed.error?.message ?? "";
    } catch {
      upstreamMessage = "";
    }
  }
  if (upstreamMessage && upstreamMessage.length <= 300) return upstreamMessage;
  if (candidate.statusCode === 401) return "A geração por IA não está configurada neste momento.";
  if (candidate.statusCode === 402) return "Estamos em atualizações no momento. Tente novamente em breve — seu progresso fica salvo.";
  if (candidate.statusCode === 403) return "Estamos em atualizações no momento. Tente novamente em breve.";
  if (candidate.statusCode === 429) return "Há muitas gerações em andamento. Aguarde um pouco e tente novamente.";
  if (candidate.statusCode && candidate.statusCode >= 500) return "O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.";
  if (candidate.message?.includes("No output generated")) return "A IA concluiu a análise sem produzir o resumo. Tente gerar novamente.";
  return candidate.message && candidate.message.length <= 200
    ? candidate.message
    : "Não foi possível gerar o resumo agora.";
}

export async function createStudySummary(input: {
  apiKey: string;
  subject: string;
  topic: string;
  references: Array<{ statement: string; explanation: string }>;
}) {

  const referenceText = input.references
    .map((item, index) => `${index + 1}. ${item.statement}${item.explanation ? `\nComentário: ${item.explanation}` : ""}`)
    .join("\n\n")
    .slice(0, 18_000);

  try {
    const result = streamText({
      model: createAiModel(input.apiKey),
      system: "Você é um professor didático. Escreva em português brasileiro, com precisão e linguagem clara. Sempre entregue um resumo final em texto, sem saudações, sem mencionar IA e sem inventar referências bibliográficas.",
      prompt: `Crie um resumo de estudo objetivo sobre a matéria “${input.subject}”, assunto “${input.topic}”. O texto final deve ter entre 350 e 650 palavras.\n\nOrganize o texto exatamente nesta ordem, usando títulos Markdown:\n## VISÃO GERAL\n## CONCEITOS PRINCIPAIS\n## PONTOS DE ATENÇÃO\n## REVISÃO RÁPIDA\n\nUse parágrafos curtos e listas quando ajudarem. Explique termos importantes e destaque relações que costumam ser cobradas em questões. Não inclua perguntas de múltipla escolha. É obrigatório produzir a resposta final após analisar as referências.\n\nQuestões e comentários cadastrados como referência de escopo:\n${referenceText || "Nenhuma referência adicional cadastrada."}`,
    });
    const text = (await result.text).trim();
    if (!text) throw new Error("A IA não retornou conteúdo para este assunto.");
    return text;
  } catch (error) {
    throw new Error(gatewayMessage(error));
  }
}
