import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createQuestionExplanation } from "./question-explanation.server";

export const generateQuestionExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ questionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: question, error } = await context.supabase
      .from("questions")
      .select("statement, options, correct_index, explanation")
      .eq("id", data.questionId)
      .maybeSingle();
    if (error || !question) throw new Error("Esta questão não está disponível para sua conta.");

    const saved = typeof question.explanation === "string" ? question.explanation.trim() : "";
    if (saved) return { explanation: saved };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cached } = await supabaseAdmin.from("ai_cache").select("content").eq("kind", "explanation").eq("cache_key", data.questionId).maybeSingle();
    if (cached?.content) return { explanation: cached.content };
    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [];
    const apiKey = process.env['APP_OPENAI_API_KEY']!;
    if (!apiKey) throw new Error("A explicação automática não está configurada neste momento.");
    const explanation = await createQuestionExplanation({
      apiKey,
      statement: question.statement,
      options,
      correctIndex: question.correct_index,
    });
    if (explanation) await supabaseAdmin.from("ai_cache").upsert({ kind: "explanation", cache_key: data.questionId, content: explanation });
    return { explanation };
  });