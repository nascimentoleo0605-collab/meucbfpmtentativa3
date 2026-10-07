CREATE TABLE public.assistant_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assistant_attempts TO authenticated;
GRANT ALL ON public.assistant_attempts TO service_role;
ALTER TABLE public.assistant_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own assistant attempts" ON public.assistant_attempts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Read own assistant attempts" ON public.assistant_attempts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX assistant_attempts_correct_idx ON public.assistant_attempts (user_id) WHERE is_correct;