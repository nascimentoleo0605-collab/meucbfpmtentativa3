import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleX, FileDown, FileUp, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateAiQuiz, generateAiQuizFromMaterial } from "@/lib/ai-quiz.functions";
import { loadQuestionBank } from "@/lib/question-bank";

export const Route = createFileRoute("/_authenticated/ia")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Meu Assistente | Questões inéditas" },
    { name: "description", content: "Gere 10 questões inéditas por IA sobre o assunto que você escolher ou envie um PDF." },
    { property: "og:title", content: "Meu Assistente | Questões inéditas" },
    { property: "og:description", content: "Gere 10 questões inéditas por IA sobre o assunto que você escolher ou envie um PDF." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: IaPage,
});

type Q = Awaited<ReturnType<typeof generateAiQuiz>>[number];
const ALL = "__all__";

function IaPage() {
  const generate = useServerFn(generateAiQuiz);
  const generatePdf = useServerFn(generateAiQuizFromMaterial);
  const [mode, setMode] = useState<"bank" | "pdf">("bank");
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState(ALL);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const { data: cls = [] } = useQuery({
    queryKey: ["questions", "summary-classifications"],
    queryFn: () => loadQuestionBank<{ subject: string; topic: string }>((f, t) => supabase.from("questions").select("subject, topic").order("created_at").range(f, t)),
  });
  const subjects = useMemo(() => [...new Set(cls.map((c) => c.subject?.trim()).filter(Boolean))].sort(), [cls]);
  const topics = useMemo(() => [...new Set(cls.filter((c) => c.subject === subject).map((c) => c.topic?.trim()).filter(Boolean))].sort(), [cls, subject]);
  const done = Object.keys(answers).length;
  const right = questions.filter((q, i) => answers[i] === q.correct_index).length;

  async function run() {
    if (mode === "bank" && !subject) { toast.error("Escolha uma matéria."); return; }
    if (mode === "pdf" && !file) { toast.error("Anexe um arquivo PDF."); return; }
    if (file && file.size > 50 * 1024 * 1024 && mode === "pdf") { toast.error("O PDF deve ter até 50 MB."); return; }
    setLoading(true); setQuestions([]); setAnswers({});
    try {
      if (mode === "pdf" && file) {
        const { extractPdfText } = await import("@/components/PdfImport");
        const material = (await extractPdfText(file)).trim();
        if (material.length < 200) throw new Error("Não consegui ler texto suficiente neste PDF.");
        setQuestions(await generatePdf({ data: { material, count: 10 } }));
      } else setQuestions(await generate({ data: { subject, topic: topic === ALL ? null : topic, count: 10 } }));
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gerar as questões."); }
    finally { setLoading(false); }
  }

  async function exportPdf() {
    const L = (i: number) => String.fromCharCode(65 + i);
    const text = questions.map((q, i) => [`## Questão ${i + 1}${q.topic ? ` · ${q.topic}` : ""}`, q.statement, ...q.options.map((o, oi) => `${L(oi)}) ${o}`), "", `**Sua resposta:** ${answers[i] !== undefined ? L(answers[i]!) : "—"} · **Gabarito:** ${L(q.correct_index)}`, `Resolução: ${q.explanation}`, ""].join("\n")).join("\n");
    try {
      const { exportSummaryPdf } = await import("@/lib/export-summary-pdf");
      await exportSummaryPdf(mode === "bank" && subject ? subject : "Material enviado", `${questions.length} questões · ${right} acertos`, text, "questoes");
    } catch { toast.error("Não foi possível exportar o PDF."); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Questões inéditas</p>
        <h1 className="font-serif text-2xl font-semibold">Meu Assistente</h1>
        <p className="text-sm text-muted-foreground">Escolha matéria e assunto ou envie um PDF: a IA cria 10 questões novas com base no banco.</p>
      </header>
      <div className="flex gap-2">
        <Button variant={mode === "bank" ? "default" : "outline"} size="sm" onClick={() => setMode("bank")}><Sparkles /> Matéria e assunto</Button>
        <Button variant={mode === "pdf" ? "default" : "outline"} size="sm" onClick={() => setMode("pdf")}><FileUp /> Enviar PDF</Button>
      </div>
      {mode === "pdf" ? (
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5"><Label htmlFor="ia-pdf">Material em PDF</Label>
            <input id="ia-pdf" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-3 file:py-1 file:text-primary" /></div>
          <Button onClick={run} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {loading ? "Gerando..." : "Gerar 10 questões"}</Button>
        </div>
      ) : (
      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5"><Label>Matéria</Label>
          <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(ALL); }}>
            <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label>Assunto</Label>
          <Select value={topic} onValueChange={setTopic} disabled={!subject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos os assuntos</SelectItem>{topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></div>
        <Button onClick={run} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {loading ? "Gerando..." : "Gerar 10 questões"}</Button>
      </div>
      )}
      {loading && <p className="animate-pulse text-center text-sm text-muted-foreground">A IA está criando suas questões. Isso pode levar até um minuto...</p>}
      {questions.length > 0 && (
        <p className="text-sm text-muted-foreground">Respondidas {done}/{questions.length} · Acertos <span className="font-semibold text-chart-2">{right}</span></p>
      )}
      {questions.map((q, i) => {
        const sel = answers[i];
        const answered = sel !== undefined;
        const ok = sel === q.correct_index;
        return (
          <article key={q.id} className={`animate-rise-in space-y-3 rounded-lg border bg-card p-4 ${answered ? (ok ? "study-correct" : "study-wrong") : ""}`}>
            <p className="text-xs text-muted-foreground">Questão {i + 1} · {q.topic}</p>
            <p className="font-medium">{q.statement}</p>
            <div className="space-y-2">
              {q.options.map((o, oi) => {
                const cls = !answered ? "hover:border-primary" : oi === q.correct_index ? "study-option-correct border-chart-2 bg-chart-2/10" : oi === sel ? "study-option-wrong border-destructive bg-destructive/10" : "opacity-60";
                return <button key={oi} disabled={answered} onClick={() => { setAnswers((a) => ({ ...a, [i]: oi })); void supabase.from("assistant_attempts").insert({ is_correct: oi === q.correct_index, subject: mode === "bank" && subject ? subject : "Meu Assistente (PDF)", topic: q.topic || "" }); }} className={`flex w-full gap-2 rounded-md border p-3 text-left text-sm transition-all ${cls}`}><span className="font-semibold">{String.fromCharCode(65 + oi)})</span>{o}</button>;
              })}
            </div>
            {answered && (
              <div className="animate-answer-in space-y-1 text-sm">
                <p className={`flex items-center gap-2 font-semibold ${ok ? "text-chart-2" : "text-destructive"}`}>
                  {ok ? <CheckCircle2 className="study-result-icon size-4" /> : <CircleX className="study-result-icon size-4" />}
                  {ok ? "Mandou bem! Você acertou." : `Quase lá! A correta é a ${String.fromCharCode(65 + q.correct_index)}.`}
                </p>
                {!ok && <p className="text-muted-foreground">{q.explanation}</p>}
              </div>
            )}
          </article>
        );
      })}
      {questions.length > 0 && done === questions.length && (
        <div className="animate-answer-in rounded-lg border bg-card p-4 text-center">
          <p className="font-serif text-xl font-semibold">Você acertou {right} de {questions.length}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={exportPdf}><FileDown /> Exportar questões e resoluções</Button><Button onClick={run}><RotateCcw /> Gerar novas questões</Button></div>
        </div>
      )}
    </div>
  );
}
