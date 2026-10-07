import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ path: z.string().min(1).max(500) });

export const getQuestionImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => input.parse(value))
  .handler(async ({ data, context }) => {
    // Query with the authenticated user's access before minting a short-lived link.
    const { data: question, error } = await context.supabase
      .from("questions")
      .select("id")
      .eq("image_path", data.path)
      .limit(1)
      .maybeSingle();
    if (error || !question) throw new Error("Imagem não disponível para esta conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("question-images")
      .createSignedUrl(data.path, 900);
    if (signError || !signed) throw new Error("Não foi possível abrir a imagem desta questão.");
    return signed.signedUrl;
  });