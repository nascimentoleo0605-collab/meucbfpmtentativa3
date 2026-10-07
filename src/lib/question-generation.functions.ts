import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AI_MODEL } from "./ai-model.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  sourceText: z.string().trim().min(200).max(120_000),
  count: z.union([z.literal(20), z.literal(30)]),
  subject: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(120),
});

const generatedSchema = z.object({
  questions: z.array(z.object({
    statement: z.string().trim().min(5),
    options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    correct_index: z.number().int().min(0).max(3),
    explanation: z.string().trim(),
  })),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Acesso negado");
}

export const generateQuestionsFromMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const apiKey = process.env['APP_OPENAI_API_KEY']!;
    if (!apiKey) throw new Error("A geração automática não está disponível neste momento.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: `Você cria questões didáticas em português brasileiro usando somente o material fornecido. Retorne apenas JSON válido no formato {"questions":[{"statement":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"..."}]}. Cada questão deve ter exatamente quatro alternativas distintas, plausíveis e autocontidas. correct_index é 0 para A, 1 para B, 2 para C ou 3 para D. Distribua as respostas corretas entre A-D. Não invente fatos ausentes no material.`,
          },
          {
            role: "user",
            content: `Crie exatamente ${data.count} questões sobre ${data.subject}${data.topic ? `, assunto ${data.topic}` : ""}.\n\nMATERIAL:\n${data.sourceText}`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error("Não foi possível gerar as questões. Tente novamente.");
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = result.choices?.[0]?.message?.content?.replace(/^```json\s*|\s*```$/g, "").trim();
    if (!content) throw new Error("A geração não retornou questões.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("A geração retornou um formato inválido. Tente novamente.");
    }
    const validated = generatedSchema.parse(parsed);
    if (validated.questions.length !== data.count) throw new Error("A quantidade gerada ficou incompleta. Tente novamente.");
    return validated;
  });