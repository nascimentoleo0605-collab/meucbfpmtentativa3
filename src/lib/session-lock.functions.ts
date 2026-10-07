import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_DEVICES = 2;

function sessionIdOf(claims: unknown): string {
  const id = (claims as { session_id?: unknown } | null)?.session_id;
  if (typeof id !== "string" || !id) throw new Error("Sessão inválida.");
  return id;
}

async function register(userId: string, sessionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("active_sessions").upsert({ user_id: userId, session_id: sessionId, created_at: new Date().toISOString() });
  const { data } = await supabaseAdmin.from("active_sessions").select("session_id").eq("user_id", userId).order("created_at", { ascending: false });
  const old = (data ?? []).slice(MAX_DEVICES).map((r) => r.session_id);
  if (old.length) await supabaseAdmin.from("active_sessions").delete().eq("user_id", userId).in("session_id", old);
}

// Called right after sign-in: keeps only the 2 most recent devices.
export const claimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await register(context.userId, sessionIdOf(context.claims));
    return { ok: true };
  });

// Returns false when this device was pushed out by newer sign-ins.
export const checkSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = sessionIdOf(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("active_sessions").select("session_id").eq("user_id", context.userId);
    if (!data || data.length === 0) {
      await register(context.userId, sessionId);
      return { active: true };
    }
    if (data.some((r) => r.session_id === sessionId)) return { active: true };
    if (data.length < MAX_DEVICES) {
      await register(context.userId, sessionId);
      return { active: true };
    }
    return { active: false };
  });
