import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Flame, LoaderCircle, RotateCcw, SlidersHorizontal, Sparkles, Target, X } from "lucide-react";
import { QuestionImage } from "@/components/QuestionImage";
import { loadQuestionBank } from "@/lib/question-bank";
import { generateQuestionExplanation } from "@/lib/question-explanation.functions";

export const Route = createFileRoute("/_authenticated/estudar")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { subject: string | undefined; topic: string | undefined } => ({
    subject: typeof search["subject"] === "string" ? search["subject"] : undefined,
    topic: typeof search["topic"] === "string" ? search["topic"] : undefined,
  }),
  head: () => ({ meta: [
    { title: "Estudar | MEUCBFPM" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { property: "og:title", content: "Estudar | MEUCBFPM" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Resolva sua próxima questão." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/estudar" }] }),
  component: Estudar,
});

type Q = { id: string; subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string; image_path: string | null };
type Attempt = { id: string; question_id: string; is_correct: boolean; created_at: string };
const ALL = "__all";
const letters = "ABCDEFGHIJ";

function shuffleQuestions<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    const picked = shuffled[j];
    if (current === undefined || picked === undefined) continue;
    shuffled[i] = picked;
    shuffled[j] = current;
  }
  return shuffled;
}

function Estudar() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const requestExplanation = useServerFn(generateQuestionExplanation);
  const { data: questionData, isLoading } = useQuery({
    queryKey: ["questions", "study", "complete"],
    queryFn: async () => {
      const data = await loadQuestionBank<Q>((from, to) => supabase
        .from("questions")
        .select("id, subject, topic, statement, options, correct_index, explanation, image_path")
        .order("created_at")
        .range(from, to) as unknown as PromiseLike<{ data: Q[] | null; error: { message: string } | null }>);
      return data.map((question) => ({
        ...question,
        subject: question.subject ?? "Sem matéria",
        topic: question.topic ?? "",
        statement: question.statement ?? "",
        options: Array.isArray(question.options)
          ? question.options.filter((option): option is string => typeof option === "string")
          : [],
        explanation: question.explanation ?? "",
        image_path: question.image_path ?? null,
      })) as Q[];
    },
  });
  const [subject, setSubject] = useState(search.subject ?? ALL);
  const [topic, setTopic] = useState(search.topic ?? ALL);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [reviewingQuestionId, setReviewingQuestionId] = useState<string | null>(null);
  const [generatedExplanation, setGeneratedExplanation] = useState("");
  const [explanationLoading, setExplanationLoading] = useState(false);
  // Changing filters starts a new run; answering keeps its order stable.
  const questions = useMemo(
    () => shuffleQuestions(Array.isArray(questionData) ? questionData : []),
    [questionData, subject, topic, onlyWrong, onlyNew],
  );
  const { data: attempts = [] } = useQuery({
    queryKey: ["study-attempts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attempts").select("id, question_id, is_correct, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attempt[];
    },
  });
  const latest = new Map<string, Attempt>();
  attempts.forEach((attempt) => { if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt); });
  let streak = 0;
  for (const attempt of attempts) { if (!attempt.is_correct) break; streak++; }

  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))].sort(), [questions]);
  const topics = useMemo(
    () => [...new Set(questions.filter((q) => subject === ALL || q.subject === subject).map((q) => q.topic).filter(Boolean))].sort(),
    [questions, subject],
  );
  const filtered = questions.filter((q) => (subject === ALL || q.subject === subject) && (topic === ALL || q.topic === topic) && (
    q.id in sessionAnswers || (answered && q.id === reviewingQuestionId) ||
    (onlyWrong ? latest.get(q.id)?.is_correct === false : onlyNew ? !latest.has(q.id) : true)
  ));
  const q = filtered[idx % Math.max(filtered.length, 1)];
  const last = q ? latest.get(q.id) : undefined;
  const displayedLastCorrect = answered && q?.id === reviewingQuestionId && selected !== null
    ? selected === q.correct_index
    : last?.is_correct;

  const reset = () => { setSelected(null); setAnswered(false); setReviewingQuestionId(null); setGeneratedExplanation(""); setExplanationLoading(false); };
  const newRun = () => { setIdx(0); setSessionAnswers({}); reset(); };
  const goTo = (target: number) => {
    reset();
    setIdx(target);
    const next = filtered[target % Math.max(filtered.length, 1)];
    const previous = next ? sessionAnswers[next.id] : undefined;
    if (next && previous !== undefined) { setSelected(previous); setAnswered(true); setReviewingQuestionId(next.id); }
  };
  const explain = async () => {
    if (!q || selected === q.correct_index || q.explanation || generatedExplanation) return;
    setExplanationLoading(true);
    try {
      const result = await requestExplanation({ data: { questionId: q.id } });
      setGeneratedExplanation(result.explanation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a explicação agora.");
    } finally {
      setExplanationLoading(false);
    }
  };
  const answer = async () => {
    if (selected === null || !q) return;
    setSaving(true);
    const { error } = await supabase.from("attempts").insert({ question_id: q.id, selected_index: selected, is_correct: false });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar sua resposta."); return; }
    setReviewingQuestionId(q.id);
    setAnswered(true);
    setSessionAnswers((prev) => ({ ...prev, [q.id]: selected }));
    qc.invalidateQueries({ queryKey: ["attempts"] });
    qc.invalidateQueries({ queryKey: ["study-attempts", user.id] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
    qc.invalidateQueries({ queryKey: ["subject-attempts", user.id] });
  };

  return (
    <div className="space-y-6">
      <div><h1 className="font-serif text-3xl font-semibold">Estudar</h1><p className="mt-2 text-sm text-muted-foreground">Monte seu treino e acompanhe cada resposta.</p></div>
      <section className="rounded-lg border bg-card p-4">
       <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" /> Filtros do treino</div>
       <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(ALL); newRun(); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as matérias</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={(v) => { setTopic(v); newRun(); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Assunto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os assuntos</SelectItem>
            {topics.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant={onlyWrong ? "default" : "outline"} onClick={() => { setOnlyWrong(!onlyWrong); setOnlyNew(false); newRun(); }}><RotateCcw /> Refazer erros</Button>
        <Button type="button" variant={onlyNew ? "default" : "outline"} onClick={() => { setOnlyNew(!onlyNew); setOnlyWrong(false); newRun(); }}><Sparkles /> Não resolvidas</Button>
       </div>
       <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {filtered.length} {filtered.length === 1 ? "questão neste treino" : "questões neste treino"}</span>
         <span className={cn("flex items-center gap-2", streak >= 5 ? "streak-active rounded-md border border-chart-3/40 bg-chart-3/10 px-3 py-2 font-bold text-chart-3" : "")} aria-label={`Sequência de ${streak} acertos`}>
           <span className={cn("relative grid h-7 w-7 shrink-0 place-items-center", streak >= 5 && "streak-fire")} aria-hidden="true">
             {streak >= 5 && <><Flame className="streak-flame-back absolute size-6 text-chart-5" fill="currentColor" /><Flame className="streak-flame-front absolute size-5 text-chart-3" fill="currentColor" /></>}
             {streak < 5 && <Flame className="size-5" />}
           </span>
           {streak >= 5 ? <span className="leading-tight">Sequência flamejante <strong className="ml-1 font-serif text-lg tabular-nums">{streak}</strong><span className="block text-xs font-medium opacity-80">acertos seguidos</span></span> : `${streak} ${streak === 1 ? "acerto seguido" : "acertos seguidos"}`}
         </span>
      </div>
      </section>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : !q ? (
        <div className="rounded-lg border bg-card p-8 text-muted-foreground">{onlyWrong ? "Nenhuma questão errada para refazer." : onlyNew ? "Você já resolveu todas as questões deste filtro." : "Nenhuma questão encontrada."}</div>
      ) : (
         <div key={q.id} className={cn("animate-rise-in rounded-xl border bg-card p-6 md:p-8", answered && (selected === q.correct_index ? "study-correct" : "study-wrong"))}>
          <div className="mb-4 flex justify-between text-sm text-muted-foreground">
            <span>{q.subject}{q.topic && ` · ${q.topic}`}</span>
            <span>{(idx % filtered.length) + 1} / {filtered.length}</span>
          </div>
           {(last || answered) && <div className={`mb-4 inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${displayedLastCorrect ? "border-chart-2/50 bg-chart-2/10 text-chart-2" : "border-destructive/50 bg-destructive/10 text-destructive"}`}>
             {displayedLastCorrect ? <Check size={16} /> : <X size={16} />}
             Última tentativa: {displayedLastCorrect ? "acertou" : "errou"}
          </div>}
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{q.statement}</p>
          <QuestionImage path={q.image_path} />
           <div className="relative mt-6 space-y-2">
            {q.options.length < 2 ? (
              <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                Esta questão está sem alternativas válidas. Peça ao administrador para revisá-la.
              </p>
            ) : q.options.map((opt, i) => {
              const isCorrect = i === q.correct_index;
              return (
                <Button
                  type="button"
                  variant="outline"
                  key={i}
                  disabled={answered}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "!h-auto min-h-12 w-full !justify-start whitespace-normal p-3 text-left",
                    !answered && selected === i && "border-primary bg-muted",
                    !answered && "hover:bg-muted",
                     answered && isCorrect && "study-option-correct border-chart-2 bg-chart-2/10 text-chart-2",
                     answered && selected === i && !isCorrect && "study-option-wrong border-destructive bg-destructive/10 text-destructive",
                  )}
                >
                  <span className="font-semibold">{letters[i]})</span>
                  <span>{opt}</span>
                </Button>
              );
            })}
          </div>
           {answered && (
              <div role="status" className={cn("animate-answer-in mt-6 overflow-hidden rounded-lg border p-4", selected === q.correct_index ? "border-chart-2/50 bg-chart-2/10" : "border-destructive/50 bg-destructive/10")}>
                <div className="flex items-start gap-3">
                  <span className={cn("study-result-icon grid size-10 shrink-0 place-items-center rounded-full", selected === q.correct_index ? "bg-chart-2/20 text-chart-2" : "bg-destructive/20 text-destructive")} aria-hidden="true">{selected === q.correct_index ? <Check size={24} strokeWidth={3} /> : <X size={22} strokeWidth={3} />}</span>
                  <div className="min-w-0"><p className={cn("font-serif text-lg font-semibold", selected === q.correct_index ? "text-chart-2" : "text-destructive")}>{selected === q.correct_index ? "Mandou bem! Você acertou." : "Quase lá! Você errou."}</p>
                  {selected !== q.correct_index && <p className="mt-1 text-sm leading-relaxed">Resposta correta: <strong>{letters[q.correct_index]}) {q.options[q.correct_index]}</strong></p>}</div>
                </div>
              {(q.explanation || generatedExplanation) && <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm leading-6">{q.explanation || generatedExplanation}</p>}
              {selected !== q.correct_index && !q.explanation && !generatedExplanation && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={explain} disabled={explanationLoading}>{explanationLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{explanationLoading ? "Preparando explicação…" : "Entender a resposta"}</Button>}
            </div>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="outline" onClick={() => goTo(idx - 1)} disabled={idx === 0 || saving}><ChevronLeft /> Voltar</Button>
            {!answered ? (
               <Button onClick={answer} disabled={q.options.length < 2 || selected === null || saving}>{saving ? "Salvando…" : "Responder"}</Button>
            ) : (
               <Button onClick={() => goTo(idx + 1)}>Próxima <ChevronRight /></Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
