import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookMarked, Download, LoaderCircle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateStudySummary } from "@/lib/study-summary.functions";
import { loadQuestionBank } from "@/lib/question-bank";

export const Route = createFileRoute("/_authenticated/resumos")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Resumos | MEUCBFPM" },
    { name: "description", content: "Gere resumos de estudo por matéria e assunto no MEUCBFPM." },
    { property: "og:title", content: "Resumos | MEUCBFPM" },
    { property: "og:description", content: "Gere resumos de estudo por matéria e assunto no MEUCBFPM." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Resumos,
});

type SummaryDraft = { subject: string; topic: string; summary: string };
const DRAFT_KEY = ["study-summary", "current"] as const;

function Resumos() {
  const queryClient = useQueryClient();
  const saved = queryClient.getQueryData<SummaryDraft>(DRAFT_KEY);
  const generateSummary = useServerFn(generateStudySummary);
  const [subject, setSubject] = useState(saved?.subject ?? "");
  const [topic, setTopic] = useState(saved?.topic ?? "");
  const [summary, setSummary] = useState(saved?.summary ?? "");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { data: classifications = [], isLoading, error } = useQuery({
    queryKey: ["questions", "summary-classifications"],
    queryFn: async () => {
      return loadQuestionBank<{ subject: string; topic: string }>((from, to) => supabase
        .from("questions")
        .select("subject, topic")
        .order("created_at")
        .range(from, to));
    },
  });
  const subjects = useMemo(
    () => [...new Set(classifications.map((item) => item.subject.trim()).filter(Boolean))].sort(),
    [classifications],
  );
  const topics = useMemo(
    () => [...new Set(classifications
      .filter((item) => item.subject === subject)
      .map((item) => item.topic.trim())
      .filter(Boolean))].sort(),
    [classifications, subject],
  );

  const generate = async () => {
    if (!subject || !topic) return;
    setGenerating(true);
    try {
      const result = await generateSummary({ data: { subject, topic } });
      const draft = { subject, topic, summary: result.summary };
      queryClient.setQueryData(DRAFT_KEY, draft);
      setSummary(result.summary);
    } catch (generationError) {
      toast.error(generationError instanceof Error ? generationError.message : "Não foi possível gerar o resumo agora.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    if (!summary || exporting) return;
    setExporting(true);
    try {
      const { exportSummaryPdf } = await import("@/lib/export-summary-pdf");
      await exportSummaryPdf(subject, topic, summary);
    } catch {
      toast.error("Não foi possível baixar o PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Resumos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Escolha um assunto já cadastrado para criar um material de revisão.</p>
      </div>

      <section className="grid gap-4 border-y py-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="summary-subject">Matéria</Label>
          <Select value={subject} onValueChange={(value) => { setSubject(value); setTopic(""); setSummary(""); }} disabled={isLoading}>
            <SelectTrigger id="summary-subject"><SelectValue placeholder="Selecione a matéria" /></SelectTrigger>
            <SelectContent>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary-topic">Assunto</Label>
          <Select value={topic} onValueChange={(value) => { setTopic(value); setSummary(""); }} disabled={!subject}>
            <SelectTrigger id="summary-topic"><SelectValue placeholder={subject ? "Selecione o assunto" : "Escolha a matéria primeiro"} /></SelectTrigger>
            <SelectContent>{topics.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={generate} disabled={!subject || !topic || generating} className="w-full lg:w-auto">
          {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {generating ? "Criando resumo…" : "Gerar resumo"}
        </Button>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar matérias e assuntos.</p>}
      {!isLoading && !error && subjects.length === 0 && <p className="text-muted-foreground">Nenhuma matéria com assunto cadastrado.</p>}

      {summary ? (
        <article className="rounded-lg border bg-card p-5 md:p-8">
          <div className="mb-6 flex flex-wrap items-start gap-3 border-b pb-5">
            <BookMarked className="mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{subject}</p>
              <h2 className="mt-1 break-words font-serif text-2xl font-semibold">{topic}</h2>
            </div>
            <Button type="button" variant="outline" onClick={downloadPdf} disabled={exporting} aria-label="Baixar resumo em PDF">
              {exporting ? <LoaderCircle className="animate-spin" /> : <Download />} {exporting ? "Preparando PDF…" : "Baixar PDF"}
            </Button>
          </div>
          <ReactMarkdown
            components={{
              h2: ({ children }) => <h3 className="mb-3 mt-7 font-serif text-lg font-semibold first:mt-0">{children}</h3>,
              h3: ({ children }) => <h4 className="mb-2 mt-5 font-semibold">{children}</h4>,
              p: ({ children }) => <p className="mb-4 text-[15px] leading-7 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-5 space-y-2 pl-5 text-[15px] leading-7">{children}</ul>,
              li: ({ children }) => <li className="list-disc pl-1 marker:text-primary">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            }}
          >
            {summary}
          </ReactMarkdown>
        </article>
      ) : !generating && subject && topic ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Clique em “Gerar resumo” para preparar sua revisão.</div>
      ) : null}
    </div>
  );
}