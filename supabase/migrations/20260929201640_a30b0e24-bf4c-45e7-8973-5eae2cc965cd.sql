GRANT SELECT, INSERT, UPDATE ON public.provao_sessions TO authenticated;

CREATE POLICY "Students read own provao" ON public.provao_sessions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Students insert own provao" ON public.provao_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Students update own provao" ON public.provao_sessions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);