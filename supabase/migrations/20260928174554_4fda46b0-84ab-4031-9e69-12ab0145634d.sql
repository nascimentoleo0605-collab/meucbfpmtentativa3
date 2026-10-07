DROP POLICY IF EXISTS "Signed-in read questions" ON public.questions;
CREATE POLICY "Role members read questions"
ON public.questions
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'user'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);