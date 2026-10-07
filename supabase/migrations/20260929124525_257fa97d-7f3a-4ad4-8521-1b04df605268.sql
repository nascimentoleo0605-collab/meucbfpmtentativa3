CREATE TABLE public.provao_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
 questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
 answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
 batch_count integer NOT NULL DEFAULT 0 CHECK (batch_count BETWEEN 0 AND 5),
 score integer CHECK (score BETWEEN 0 AND 50),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
GRANT SELECT ON public.provao_sessions TO authenticated;
GRANT ALL ON public.provao_sessions TO service_role;
ALTER TABLE public.provao_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own provao" ON public.provao_sessions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE UNIQUE INDEX provao_one_draft_per_user ON public.provao_sessions(user_id) WHERE status = 'draft';
CREATE INDEX provao_user_created ON public.provao_sessions(user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.touch_provao_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER provao_updated_at BEFORE UPDATE ON public.provao_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_provao_updated_at();