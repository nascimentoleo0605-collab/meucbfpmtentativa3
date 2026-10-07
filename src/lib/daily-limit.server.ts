// Daily usage caps per user, counted from midnight in São Paulo (UTC-3).
export function startOfDaySP(): string {
  const now = new Date(Date.now() - 3 * 3600_000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() + 3 * 3600_000).toISOString();
}

export async function usedToday(userId: string, kind: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("ai_usage" as never).select("amount").eq("user_id", userId).eq("kind", kind).gte("created_at", startOfDaySP());
  return ((data ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0);
}

export async function ensureLimit(userId: string, kind: string, amount: number, max: number, message: string) {
  if ((await usedToday(userId, kind)) + amount > max) throw new Error(message);
}

export async function recordUsage(userId: string, kind: string, amount: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_usage" as never).insert({ user_id: userId, kind, amount } as never);
}
