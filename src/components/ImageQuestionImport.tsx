import { useState } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseImageQuestion } from "@/lib/image-question-parser";

type Draft = { statement: string; options: string[]; correct_index: number | null; subject: string; topic: string; explanation: string };

export function ImageQuestionImport({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); setDraft(null); }
  };
  const select = async (image?: File) => {
    if (!image) return;
    if (!image.type.startsWith("image/") || image.size > 20 * 1024 * 1024) { toast.error("Escolha uma imagem de até 20 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(image);
    setPreview(URL.createObjectURL(image));
    setReading(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("por+eng");
      let text = "";
      try { text = (await worker.recognize(image)).data.text; }
      finally { await worker.terminate(); }
      const parsed = parseImageQuestion(text);
      setDraft({ statement: parsed?.statement ?? text.trim(), options: parsed?.options ?? ["", "", "", ""], correct_index: parsed?.correct_index ?? null, subject: "", topic: "", explanation: "" });
      toast.success(parsed ? "Questão reconhecida. Confira tudo antes de salvar." : "Texto reconhecido. Complete as alternativas e o gabarito antes de salvar.");
    } catch { toast.error("Não foi possível ler a imagem."); setDraft(null); }
    finally { setReading(false); }
  };
  const update = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const save = async () => {
    if (!file || !draft || !draft.subject.trim() || !draft.statement.trim() || draft.options.length < 2 || draft.options.some((option) => !option.trim()) || draft.correct_index === null || draft.correct_index >= draft.options.length) {
      toast.error("Informe matéria, enunciado, alternativas e resposta correta."); return;
    }
    setSaving(true);
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "png"}`;
    const upload = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type });
    if (upload.error) { toast.error(upload.error.message); setSaving(false); return; }
    const { error } = await supabase.from("questions").insert({ subject: draft.subject.trim(), topic: draft.topic.trim(), statement: draft.statement.trim(), options: draft.options.map((option) => option.trim()), correct_index: draft.correct_index, explanation: draft.explanation.trim(), image_path: path });
    if (error) { await supabase.storage.from("question-images").remove([path]); toast.error(error.message); setSaving(false); return; }
    setSaving(false);
    toast.success("Questão cadastrada com imagem");
    close(false);
    onDone();
  };
  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button variant="outline"><ImagePlus /> Importar imagem</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Questão por imagem</DialogTitle><DialogDescription>Confira o texto e marque a resposta correta antes de salvar.</DialogDescription></DialogHeader>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 text-sm">
        <ImagePlus className="text-primary" /> {reading ? "Lendo imagem…" : file?.name ?? "Escolher foto ou imagem da questão"}
        <input type="file" accept="image/*" className="sr-only" disabled={reading || saving} onChange={(event) => void select(event.target.files?.[0])} />
      </label>
      {preview && <img src={preview} alt="Imagem selecionada para revisão" className="max-h-72 max-w-full rounded-md object-contain" />}
      {reading && <LoaderCircle className="animate-spin text-primary" />}
      {draft && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div><Label>Matéria</Label><Input value={draft.subject} onChange={(event) => update({ subject: event.target.value })} /></div><div><Label>Assunto</Label><Input value={draft.topic} onChange={(event) => update({ topic: event.target.value })} /></div></div>
        <div><Label>Enunciado</Label><Textarea value={draft.statement} onChange={(event) => update({ statement: event.target.value })} rows={4} /></div>
        <div className="space-y-2"><Label>Alternativas — marque a correta</Label>{draft.options.map((option, index) => <div key={index} className="flex items-center gap-2"><input type="radio" name="image-answer" checked={draft.correct_index === index} onChange={() => update({ correct_index: index })} /><span className="w-5">{"ABCDEF"[index]}</span><Input aria-label={`Alternativa ${"ABCDEF"[index]}`} value={option} onChange={(event) => update({ options: draft.options.map((old, i) => i === index ? event.target.value : old) })} /></div>)}<Button type="button" variant="ghost" size="sm" disabled={draft.options.length >= 6} onClick={() => update({ options: [...draft.options, ""] })}>Adicionar alternativa</Button></div>
        <div><Label>Comentário (opcional)</Label><Textarea value={draft.explanation} onChange={(event) => update({ explanation: event.target.value })} /></div>
        <Button disabled={saving} onClick={save} className="w-full">{saving ? "Salvando…" : "Salvar questão com imagem"}</Button>
      </div>}
    </DialogContent>
  </Dialog>;
}