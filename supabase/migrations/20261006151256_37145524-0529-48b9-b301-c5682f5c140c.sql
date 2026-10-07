CREATE TABLE public.ai_usage (id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null, amount integer not null default 1, created_at timestamptz not null default now());
CREATE INDEX ai_usage_user_kind_idx ON public.ai_usage (user_id, kind, created_at);
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages ai usage" ON public.ai_usage FOR ALL TO service_role USING (true) WITH CHECK (true);