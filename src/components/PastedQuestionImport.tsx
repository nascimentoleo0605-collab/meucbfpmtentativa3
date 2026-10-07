import { useState } from "react";
import { ClipboardPaste, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parsePastedQuestions, type PastedQuestion } from "@/lib/pasted-question-parser";
import { loadQuestionBank } from "@/lib/question-bank";

const letters = "ABCDEF";

export function PastedQuestionImport({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<PastedQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setText(""); setSubject(""); setTopic(""); setQuestions([]); };
  const review = () => {
    const parsed = parsePastedQuestions(text);
    setQuestions(parsed);
    if (!parsed.length) toast.error("Nenhuma questão reconhecida. Confira a numeração e as alternativas A a F.");
    else toast.success(`${parsed.length} questões reconhecidas. Confira as respostas antes de cadastrar.`);
  };
  const update = (index: number, patch: Partial<PastedQuestion>) => {
    setQuestions((previous) => previous.map((question, i) => i === index ? { ...question, ...patch } : question));
  };
  const ready = questions.filter((question) => question.statement.trim() && question.options.every((option) => option.trim()) && question.correct_index !== null && question.correct_index < question.options.length);
  const pendingAnswers = questions.length - ready.length;
  const missingClassification = !subject.trim() || !topic.trim();

  const save = async () => {
    if (!subject.trim()) {
      toast.error("Informe a matéria antes de cadastrar.");
      document.getElementById("paste-subject")?.focus();
      return;
    }
    if (!topic.trim()) {
      toast.error("Informe o assunto antes de cadastrar.");
      document.getElementById("paste-topic")?.focus();
      return;
    }
    if (!ready.length || ready.length !== questions.length) {
      toast.error(`Confirme o gabarito das ${pendingAnswers || questions.length} questões pendentes.`);
      return;
    }
    setSaving(true);
    try {
      const existing = await loadQuestionBank<{ statement: string }>((from, to) => supabase
        .from("questions")
        .select("statement")
        .eq("subject", subject.trim())
        .eq("topic", topic.trim())
        .order("created_at")
        .range(from, to));
      const known = new Set(existing.map((row) => row.statement));
      const payload = ready.filter((question) => !known.has(question.statement.trim())).map((question) => ({
        subject: subject.trim(), topic: topic.trim(), statement: question.statement.trim(),
        options: question.options.map((option) => option.trim()), correct_index: question.correct_index ?? 0,
        explanation: "",
      }));
      for (let i = 0; i < payload.length; i += 100) {
        const { error } = await supabase.from("questions").insert(payload.slice(i, i + 100));
        if (error) throw error;
      }
      toast.success(`${payload.length} questões cadastradas${ready.length > payload.length ? ` · ${ready.length - payload.length} já existentes` : ""}`);
      reset(); setOpen(false); onDone();
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Não foi possível cadastrar as questões.";
      toast.error(message);
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => { if (saving) return; setOpen(next); if (!next) reset(); }}>
    <DialogTrigger asChild><Button variant="outline"><ClipboardPaste className="h-4 w-4" /> Colar questões</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Colar questões</DialogTitle>
        <DialogDescription>Cole questões numeradas com alternativas A a F. Marque a correta com ✅ ou informe “Resposta: B”. Confira o gabarito antes de cadastrar.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="paste-subject">Matéria</Label><Input id="paste-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: MÓDULO 1" /></div>
        <div className="space-y-1.5"><Label htmlFor="paste-topic">Assunto</Label><Input id="paste-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: ABORDAGEM A PESSOA A PÉ" /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="paste-text">Texto das questões</Label><Textarea id="paste-text" rows={8} value={text} onChange={(event) => { setText(event.target.value); setQuestions([]); }} placeholder={"Questão 1\nEnunciado da questão\na) Alternativa\nb) Alternativa correta ✅"} /></div>
      <Button variant="secondary" onClick={review} disabled={!text.trim() || saving}>Reconhecer questões</Button>
      {questions.length > 0 && <div className="space-y-3">
        <p className="text-sm"><strong>{questions.length}</strong> reconhecidas · <strong>{ready.length}</strong> com gabarito confirmado</p>
        {questions.map((question, index) => <div key={`${question.sourceNumber}-${index}`} className="space-y-3 rounded-md border p-4">
          <div className="flex items-start gap-2">
            <span className="min-w-7 text-sm font-semibold text-muted-foreground">{question.sourceNumber}.</span>
            <Textarea aria-label={`Enunciado da questão ${question.sourceNumber}`} value={question.statement} onChange={(event) => update(index, { statement: event.target.value })} className="min-h-16 flex-1" />
            <Button variant="ghost" size="icon" aria-label={`Remover questão ${question.sourceNumber}`} onClick={() => setQuestions((all) => all.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="flex items-center gap-2 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name={`pasted-answer-${index}`} checked={question.correct_index === optionIndex} onChange={() => update(index, { correct_index: optionIndex })} className="accent-[var(--primary)]" aria-label={`Questão ${question.sourceNumber}: alternativa ${letters[optionIndex]} correta`} />
            <strong>{letters[optionIndex]}</strong><span className="min-w-0 break-words">{option}</span>
          </label>)}</div>
          {question.correct_index === null && <p className="text-sm text-destructive">Resposta correta não identificada. Selecione uma alternativa.</p>}
        </div>)}
        <div className="sticky bottom-0 space-y-2 border-t bg-background pt-3">
          {(missingClassification || pendingAnswers > 0) && <p role="status" className="text-sm text-destructive">
            {missingClassification ? "Preencha matéria e assunto. " : ""}{pendingAnswers > 0 ? `${pendingAnswers} questões ainda precisam de gabarito.` : ""}
          </p>}
          <Button type="button" className="w-full" disabled={saving} onClick={() => { void save(); }}>{saving ? "Cadastrando…" : `Cadastrar ${questions.length} questões`}</Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}