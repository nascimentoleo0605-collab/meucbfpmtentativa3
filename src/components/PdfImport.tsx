import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parsePdfQuestions, type PdfQuestion } from "@/lib/pdf-question-parser";
import { generateQuestionsFromMaterial } from "@/lib/question-generation.functions";

type ReviewQuestion = PdfQuestion & { subject: string; topic: string };
type PdfTextItem = { str?: string; transform?: number[]; hasEOL?: boolean };
const letters = "ABCDEF";

export async function extractPdfText(file: File, forceOcr = false) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  const pages: string[] = [];
  let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;

  try { for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = "";
    for (const item of content.items as PdfTextItem[]) {
      const text = item.str?.trim();
      if (!text) continue;
      const y = item.transform?.[5] ?? null;
      const changedLine = lastY !== null && y !== null && Math.abs(y - lastY) > 2;
      pageText += changedLine ? `\n${text}` : `${pageText && !pageText.endsWith("\n") ? " " : ""}${text}`;
      if (item.hasEOL) pageText += "\n";
      lastY = y;
    }
    if (forceOcr || pageText.trim().length < 20) {
      ocrWorker ??= await (await import("tesseract.js")).createWorker("por+eng");
      const viewport = page.getViewport({ scale: 2 });
      const canvas = window.document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (context) {
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        pageText = (await ocrWorker.recognize(canvas)).data.text;
      }
      canvas.width = 0;
      canvas.height = 0;
    }
    pages.push(pageText);
    page.cleanup();
  }} finally { await ocrWorker?.terminate(); await task.destroy(); }
  return pages.join("\n");
}

export function PdfImport({ onDone }: { onDone: () => void }) {
  const generateQuestions = useServerFn(generateQuestionsFromMaterial);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"extract" | "generate">("extract");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [count, setCount] = useState<20 | 30>(20);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);

  const reset = () => {
    setFileName("");
    setSubject("");
    setTopic("");
    setSourceText("");
    setQuestions([]);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("O PDF deve ter no máximo 100 MB.");
      return;
    }
    setReading(true);
    setFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.trim().length < 20) {
        setQuestions([]);
        toast.error("Não foi possível ler questões neste PDF, mesmo após reconhecer as imagens.");
        return;
      }
      setSourceText(text);
      if (mode === "extract") {
        let parsed = parsePdfQuestions(text);
        if (!parsed.length) {
          const recognizedText = await extractPdfText(file, true);
          if (recognizedText.trim()) {
            setSourceText(recognizedText);
            parsed = parsePdfQuestions(recognizedText);
          }
        }
        const reviewQuestions = parsed.map((question) => ({ ...question, subject, topic }));
        setQuestions(reviewQuestions);
        if (!reviewQuestions.length) toast.error("Não reconhecemos o formato das questões. Tente um PDF mais nítido ou use Importar imagem.");
        else toast.success(`${reviewQuestions.length} questões encontradas. Confira o gabarito antes de importar.`);
      } else {
        setQuestions([]);
        toast.success("Material lido. Agora gere as questões.");
      }
    } catch {
      setQuestions([]);
      toast.error("Não foi possível abrir este PDF. Verifique se o arquivo não está protegido.");
    } finally {
      setReading(false);
    }
  };

  const generate = async () => {
    if (!subject.trim()) {
      toast.error("Informe a matéria antes de gerar.");
      return;
    }
    if (!sourceText) return;
    setGenerating(true);
    try {
      const result = await generateQuestions({ data: { sourceText, count, subject, topic } });
      setQuestions(result.questions.map((question, index) => ({
        ...question,
        sourceNumber: String(index + 1),
        subject: subject.trim(),
        topic: topic.trim(),
      })));
      toast.success(`${result.questions.length} questões geradas. Revise antes de importar.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar as questões.");
    } finally {
      setGenerating(false);
    }
  };

  const update = (index: number, patch: Partial<ReviewQuestion>) => {
    setQuestions((current) => current.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
  };

  const applyClassification = () => {
    setQuestions((current) => current.map((question) => ({ ...question, subject: subject.trim(), topic: topic.trim() })));
  };

  const ready = questions.filter((question) => question.subject.trim() && question.correct_index !== null && question.correct_index < question.options.length);

  const importReady = async () => {
    if (!ready.length) return;
    setBusy(true);
    const payload = ready.map(({ sourceNumber: _sourceNumber, ...question }) => ({
      ...question,
      subject: question.subject.trim(),
      topic: question.topic.trim(),
      correct_index: question.correct_index ?? 0,
    }));
    let error: { message: string } | null = null;
    for (let i = 0; i < payload.length; i += 100) {
      const result = await supabase.from("questions").insert(payload.slice(i, i + 100));
      if (result.error) { error = result.error; break; }
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${payload.length} questões importadas`);
    reset();
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileText className="mr-1 h-4 w-4" /> Importar PDF</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Importar questões por PDF</DialogTitle>
          <DialogDescription>
            Extraia uma prova pronta ou crie novas questões a partir de um PDF de conteúdo. Tudo passa por sua revisão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          <Button type="button" variant={mode === "extract" ? "default" : "ghost"} onClick={() => { setMode("extract"); setQuestions([]); setSourceText(""); setFileName(""); }}>
            Extrair prova pronta
          </Button>
          <Button type="button" variant={mode === "generate" ? "default" : "ghost"} onClick={() => { setMode("generate"); setQuestions([]); setSourceText(""); setFileName(""); }}>
            Gerar do material
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-subject">Matéria</Label>
            <Input id="pdf-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Matemática" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-topic">Assunto</Label>
            <Input id="pdf-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: Frações" />
          </div>
          <Button type="button" variant="secondary" onClick={applyClassification} disabled={!questions.length || !subject.trim()}>
            Aplicar a todas
          </Button>
        </div>

        {mode === "generate" && (
          <div className="flex items-center gap-3">
            <Label>Quantidade</Label>
            <div className="flex rounded-md border p-1">
              {[20, 30].map((value) => (
                <Button key={value} type="button" size="sm" variant={count === value ? "default" : "ghost"} onClick={() => setCount(value as 20 | 30)}>{value}</Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">alternativas A, B, C e D</span>
          </div>
        )}

        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center hover:bg-muted/60">
          {reading ? <LoaderCircle className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
          <span className="text-sm font-medium">{reading ? "Lendo o PDF…" : fileName || "Selecionar arquivo PDF"}</span>
           <span className="text-xs text-muted-foreground">Até 100 MB, inclusive PDFs digitalizados. O arquivo não será armazenado.</span>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={reading} onChange={(event) => onFile(event.target.files?.[0])} />
        </label>

        {mode === "generate" && sourceText && !questions.length && (
          <Button className="w-full" disabled={generating || !subject.trim()} onClick={generate}>
            {generating ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Criando questões…</> : `Gerar ${count} questões`}
          </Button>
        )}

        {questions.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p><strong>{questions.length}</strong> encontradas · <strong>{ready.length}</strong> prontas para importar</p>
              {ready.length < questions.length && <p className="text-destructive">Confirme a matéria e o gabarito das pendentes.</p>}
            </div>

            {questions.map((question, index) => (
              <div key={`${question.sourceNumber}-${index}`} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded bg-muted text-xs font-semibold">{question.sourceNumber}</span>
                  <Textarea className="min-h-20 flex-1" value={question.statement} onChange={(event) => update(index, { statement: event.target.value })} aria-label={`Enunciado da questão ${question.sourceNumber}`} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover questão ${question.sourceNumber}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={question.subject} onChange={(event) => update(index, { subject: event.target.value })} placeholder="Matéria obrigatória" aria-label={`Matéria da questão ${question.sourceNumber}`} />
                  <Input value={question.topic} onChange={(event) => update(index, { topic: event.target.value })} placeholder="Assunto" aria-label={`Assunto da questão ${question.sourceNumber}`} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input type="radio" name={`pdf-correct-${index}`} checked={question.correct_index === optionIndex} onChange={() => update(index, { correct_index: optionIndex })} className="mt-1 accent-[var(--primary)]" />
                      <strong>{letters[optionIndex]}</strong><span>{option}</span>
                    </label>
                  ))}
                </div>
                {question.correct_index === null && <p className="text-xs text-destructive">Resposta não reconhecida. Marque a alternativa correta.</p>}
              </div>
            ))}

            <Button className="w-full" disabled={busy || !ready.length} onClick={importReady}>
              {busy ? "Importando…" : `Importar ${ready.length} questões confirmadas`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}