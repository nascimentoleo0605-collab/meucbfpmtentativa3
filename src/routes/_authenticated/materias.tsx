import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { loadQuestionBank } from "@/lib/question-bank";

export const Route = createFileRoute("/_authenticated/materias")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Matérias | MEUCBFPM" },
    { name: "description", content: "Veja seu aproveitamento por matéria no MEUCBFPM." },
    { property: "og:title", content: "Matérias | MEUCBFPM" },
    { property: "og:description", content: "Veja seu aproveitamento por matéria no MEUCBFPM." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Materias,
});

function Materias() {
  const { user } = Route.useRouteContext();
  const { data: questions = [], error: questionsError } = useQuery({
    queryKey: ["questions", "subjects"],
    queryFn: async () => {
      return loadQuestionBank<{ id: string; subject: string; topic: string }>((from, to) => supabase
        .from("questions")
        .select("id, subject, topic")
        .order("created_at")
        .range(from, to));
    },
  });
  const { data: attempts = [], error: attemptsError } = useQuery({
    queryKey: ["subject-attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attempts").select("question_id, is_correct, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const latest = new Map<string, boolean>();
  attempts.forEach((attempt) => { if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt.is_correct); });
  const subjects = [...new Set(questions.map((question) => question.subject))].sort();
  return <div className="space-y-6">
    <div><h1 className="font-serif text-3xl font-semibold">Matérias</h1><p className="mt-2 text-sm text-muted-foreground">Escolha uma matéria inteira ou vá direto ao assunto que quer praticar.</p></div>
    {(questionsError || attemptsError) && <p role="alert" className="text-destructive">Não foi possível carregar as matérias.</p>}
    {!questionsError && subjects.length === 0 && <p className="text-muted-foreground">Nenhuma matéria cadastrada.</p>}
    <div className="grid gap-4 md:grid-cols-2">{subjects.map((subject) => {
      const own = questions.filter((question) => question.subject === subject);
      const answered = own.filter((question) => latest.has(question.id));
      const correct = answered.filter((question) => latest.get(question.id)).length;
      const percentage = answered.length ? Math.round(correct / answered.length * 100) : 0;
      const topicNames = [...new Set(own.map((question) => question.topic).filter(Boolean))];
      return <article key={subject} className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></span><h2 className="min-w-0 break-words font-serif text-lg font-semibold">{subject}</h2></div><strong className="text-xl tabular-nums text-chart-2">{answered.length ? `${percentage}%` : "—"}</strong></div>
        <p className="mt-1 text-sm text-muted-foreground">{correct} {correct === 1 ? "acerto" : "acertos"} · {answered.length} {answered.length === 1 ? "resolvida" : "resolvidas"} · {own.length} questões</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-chart-2 transition-[width] duration-500" style={{ width: `${percentage}%` }} /></div>
        {topicNames.length > 0 && <div className="mt-5 border-t pt-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Target className="h-3.5 w-3.5" /> Estudar por assunto</p><div className="flex flex-wrap gap-2">{topicNames.map((topic) => <Button key={topic} asChild variant="outline" size="sm" className="h-auto min-h-8 whitespace-normal text-left"><Link to="/estudar" search={{ subject, topic }}>{topic}<ArrowRight className="h-3.5 w-3.5" /></Link></Button>)}</div></div>}
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/estudar" search={{ subject, topic: undefined }}>Estudar matéria</Link>
        </Button>
      </article>;
    })}</div>
  </div>;
}