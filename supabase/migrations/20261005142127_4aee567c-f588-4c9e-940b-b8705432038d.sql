CREATE TABLE public.active_sessions (
  user_id uuid PRIMARY KEY,
  session_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.active_sessions TO service_role;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;