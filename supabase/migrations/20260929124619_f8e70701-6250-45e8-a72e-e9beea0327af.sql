DROP POLICY "Students read own provao" ON public.provao_sessions;
REVOKE SELECT ON public.provao_sessions FROM authenticated;