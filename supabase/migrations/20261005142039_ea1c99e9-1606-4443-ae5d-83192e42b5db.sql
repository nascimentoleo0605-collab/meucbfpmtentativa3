DROP POLICY IF EXISTS "Students read own provao" ON public.provao_sessions;
DROP POLICY IF EXISTS "Students insert own provao" ON public.provao_sessions;
DROP POLICY IF EXISTS "Students update own provao" ON public.provao_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.provao_sessions FROM authenticated, anon;
REVOKE SELECT ON public.provao_sessions FROM anon;