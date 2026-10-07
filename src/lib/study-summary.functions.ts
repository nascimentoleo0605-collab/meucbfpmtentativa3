import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStudySummary } from "./study-summary.server";

const summaryInput = z.object({
  subject: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(120),
});

export const generateStudySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => summaryInput.parse(data))
  .handler(async ({ data, context }) => {
    const lim = await import("./daily-limit.server");
    await lim.ensureLimit(context.userId, "summary", 1, 3, "Você atingiu o limite de 3 resumos por dia. Volte amanhã!");
    const apiKey = process.env['APP_OPENAI_API_KEY']!;
    if (!apiKey) throw new Error("A geração por IA não está configurada neste momento.");

    const { data: references, error } = await context.supabase
      .from("questions")
      .select("statement, explanation")
      .eq("subject", data.subject)
      .eq("topic", data.topic)
      .limit(40);
    if (error) throw new Error("Não foi possível consultar o conteúdo deste assunto.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `${data.subject.toLowerCase()}\u0000${data.topic.toLowerCase()}`;
    const { data: cached } = await supabaseAdmin.from("ai_cache").select("content").eq("kind", "summary").eq("cache_key", key).maybeSingle();
    if (cached?.content) { await lim.recordUsage(context.userId, "summary", 1); return { summary: cached.content }; }
    const summary = await createStudySummary({
      apiKey,
      subject: data.subject,
      topic: data.topic,
      references: references ?? [],
    });
    if (summary) await supabaseAdmin.from("ai_cache").upsert({ kind: "summary", cache_key: key, content: summary });
    await lim.recordUsage(context.userId, "summary", 1);
    return { summary };
  });