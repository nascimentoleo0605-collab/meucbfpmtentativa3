CREATE OR REPLACE FUNCTION public.question_ranking()
RETURNS TABLE(user_id uuid, display_name text, correct_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, COALESCE(NULLIF(p.full_name, ''), 'Estudante') AS display_name, count(a.id) FILTER (WHERE a.is_correct) AS correct_count
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id
  LEFT JOIN public.attempts a ON a.user_id = p.id
  WHERE r.role IN ('admin', 'user')
  GROUP BY p.id, p.full_name
  ORDER BY correct_count DESC, display_name ASC;
$$;
REVOKE ALL ON FUNCTION public.question_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.question_ranking() TO authenticated;