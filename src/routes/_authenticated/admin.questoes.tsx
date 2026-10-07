import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, ImagePlus } from "lucide-react";
import { CsvImport } from "@/components/CsvImport";
import { PdfImport } from "@/components/PdfImport";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageQuestionImport } from "@/components/ImageQuestionImport";
import { PastedQuestionImport } from "@/components/PastedQuestionImport";
import { loadQuestionBank, QUESTION_BANK_LIMIT } from "@/lib/question-bank";

export const Route = createFileRoute("/_authenticated/admin/questoes")({
  staticData: { sitemap: false },
  beforeLoad: ({ context }) => { if (!context.isAdmin) throw redirect({ to: "/painel" }); },
  head: () => ({ meta: [
    { title: "Questões | MEUCBFPM" },
    { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Gerencie o banco de questões." },
    { property: "og:title", content: "Questões | MEUCBFPM" },
    { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Gerencie o banco de questões." },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/admin/questoes" }] }),
  component: Questoes,
});

type Q = { id: string; subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string; image_path: string | null };
const empty = { subject: "", topic: "", statement: "", options: ["", "", "", ""], correct_index: 0, explanation: "" };
const letters = "ABCDEFGHIJ";

function Questoes() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      return loadQuestionBank<Q>((from, to) => supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: Q[] | null; error: { message: string } | null }>);
    },
  });
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) { toast.error("Escolha uma imagem de até 20 MB."); return; }
    setUploading(true);
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "png"}`;
    const { error } = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) toast.error(error.message);
    else setImagePath(path);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = form.options.map((o) => o.trim());
    if (options.some((o) => !o)) { toast.error("Preencha todas as alternativas."); return; }
    const payload = { ...form, options, subject: form.subject.trim(), topic: form.topic.trim(), image_path: imagePath };
    const { error } = editing
      ? await supabase.from("questions").update(payload).eq("id", editing)
      : await supabase.from("questions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Questão atualizada" : "Questão cadastrada");
    setForm({ ...empty, subject: form.subject, topic: form.topic });
    setEditing(null);
    setImagePath(null);
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta questão?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  const setOpt = (i: number, v: string) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));
  const shown = list.filter((q) => `${q.subject} ${q.topic} ${q.statement}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div>
        <p className="font-serif text-xl">Banco de questões</p>
        <p className="text-sm text-muted-foreground">Cadastre uma a uma ou importe várias de uma vez · capacidade de {QUESTION_BANK_LIMIT.toLocaleString("pt-BR")} questões.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <PastedQuestionImport onDone={() => qc.invalidateQueries({ queryKey: ["questions"] })} />
        <ImageQuestionImport onDone={() => qc.invalidateQueries({ queryKey: ["questions"] })} />
        <CsvImport onDone={() => qc.invalidateQueries({ queryKey: ["questions"] })} />
        <PdfImport onDone={() => qc.invalidateQueries({ queryKey: ["questions"] })} />
      </div>
    </div>
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl">{editing ? "Editar questão" : "Nova questão"}</h1>
          {editing && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(null); setForm(empty); setImagePath(null); }}><X className="h-4 w-4" /></Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Matéria</Label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} list="subs" /></div>
          <div className="space-y-1.5"><Label>Assunto</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
          <datalist id="subs">{[...new Set(list.map((q) => q.subject))].map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="space-y-1.5"><Label>Enunciado</Label><Textarea required rows={4} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Imagem da questão (opcional)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm"><label className="cursor-pointer"><ImagePlus /> {uploading ? "Enviando…" : "Adicionar imagem"}<input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void uploadImage(e.target.files?.[0]); }} /></label></Button>
            {imagePath && <Button type="button" size="sm" variant="ghost" onClick={() => setImagePath(null)}><X /> Remover imagem</Button>}
          </div>
          <QuestionImage path={imagePath} />
        </div>
        <div className="space-y-2">
          <Label>Alternativas (marque a correta)</Label>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={form.correct_index === i} onChange={() => setForm({ ...form, correct_index: i })} className="accent-[var(--primary)]" />
              <span className="w-5 font-semibold">{letters[i]}</span>
              <Input value={o} onChange={(e) => setOpt(i, e.target.value)} />
              {form.options.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i), correct_index: f.correct_index >= i && f.correct_index > 0 ? f.correct_index - (f.correct_index === i ? 0 : 1) : f.correct_index }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {form.options.length < 6 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ""] }))}><Plus className="mr-1 h-4 w-4" /> Alternativa</Button>
          )}
        </div>
        <div className="space-y-1.5"><Label>Comentário / explicação (opcional)</Label><Textarea rows={3} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
        <Button type="submit" className="w-full">{editing ? "Salvar alterações" : "Cadastrar questão"}</Button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-2xl">Banco ({list.length})</h2>
          <Input placeholder="Buscar…" className="ml-auto max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {shown.map((q) => (
          <div key={q.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{q.subject}{q.topic && ` · ${q.topic}`}</p>
                 <p className="mt-1 line-clamp-2">{q.statement}</p>
                 {q.image_path && <span className="text-xs text-muted-foreground">Com imagem</span>}
              </div>
               <Button variant="ghost" size="icon" onClick={() => { setEditing(q.id); setImagePath(q.image_path); setForm({ subject: q.subject, topic: q.topic, statement: q.statement, options: q.options, correct_index: q.correct_index, explanation: q.explanation }); window.scrollTo({ top: 0 }); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-muted-foreground">Nenhuma questão.</p>}
      </div>
    </div>
    </div>
  );
}
