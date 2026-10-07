import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";

const letters = "ABCDEF";
const TEMPLATE =
  "materia;assunto;enunciado;A;B;C;D;E;F;correta;comentario\n" +
  'Matemática;Frações;"Quanto é 1/2 + 1/4?";1/4;3/4;2/6;1;;;B;"Some com denominador comum: 2/4 + 1/4 = 3/4"\n';

// RFC-4180-ish parser supporting ; or , separators and quoted fields
function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

type Parsed = { subject: string; topic: string; statement: string; options: string[]; correct_index: number; explanation: string };

function toQuestions(rows: string[][]) {
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (n: string) => header.indexOf(n);
  const errors: string[] = [];
  const out: Parsed[] = [];
  if (col("materia") < 0 || col("enunciado") < 0 || col("correta") < 0) {
    return { out, errors: ["Cabeçalho inválido. Use o modelo (materia;assunto;enunciado;A..F;correta;comentario)."] };
  }
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    const options = [...letters].map((l) => get(l.toLowerCase())).filter(Boolean);
    const corr = get("correta").toUpperCase();
    const correct_index = /^\d+$/.test(corr) ? Number(corr) - 1 : letters.indexOf(corr);
    const subject = get("materia"), statement = get("enunciado");
    if (!subject || !statement) { errors.push(`Linha ${line}: matéria e enunciado são obrigatórios.`); return; }
    if (options.length < 2) { errors.push(`Linha ${line}: mínimo de 2 alternativas.`); return; }
    if (correct_index < 0 || correct_index >= options.length) { errors.push(`Linha ${line}: resposta correta "${corr}" inválida.`); return; }
    out.push({ subject, topic: get("assunto"), statement, options, correct_index, explanation: get("comentario") });
    return;
  });
  return { out, errors };
}

export function CsvImport({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<{ out: Parsed[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setParsed(toQuestions(parseCsv(await f.text())));
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-questoes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const importAll = async () => {
    if (!parsed?.out.length) return;
    setBusy(true);
    for (let i = 0; i < parsed.out.length; i += 200) {
      const { error } = await supabase.from("questions").insert(parsed.out.slice(i, i + 200));
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    toast.success(`${parsed.out.length} questões importadas`);
    setBusy(false); setParsed(null); setOpen(false); onDone();
  };

  const subjects = parsed ? new Set(parsed.out.map((q) => q.subject)).size : 0;
  const topics = parsed ? new Set(parsed.out.map((q) => q.subject + "|" + q.topic)).size : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setParsed(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-1 h-4 w-4" /> Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Importar questões por CSV</DialogTitle>
          <DialogDescription>
            Colunas: materia, assunto, enunciado, A a F (alternativas), correta (letra) e comentario. Separador ; ou ,.
            Matérias e assuntos novos são criados automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={download}><Download className="mr-1 h-4 w-4" /> Baixar modelo</Button>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        </div>
        {parsed && (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{parsed.out.length}</strong> questões válidas em {subjects} matéria(s) e {topics} assunto(s).
              {parsed.errors.length > 0 && <span className="text-destructive"> {parsed.errors.length} linha(s) com erro serão ignoradas.</span>}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="max-h-32 overflow-auto rounded bg-muted p-3 text-xs text-destructive">
                {parsed.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            <div className="max-h-56 space-y-1 overflow-auto">
              {parsed.out.slice(0, 20).map((q, i) => (
                <div key={i} className="rounded border p-2 text-sm">
                  <span className="text-xs text-muted-foreground">{q.subject}{q.topic && ` · ${q.topic}`} — correta {letters[q.correct_index]}</span>
                  <p className="line-clamp-1">{q.statement}</p>
                </div>
              ))}
              {parsed.out.length > 20 && <p className="text-xs text-muted-foreground">… e mais {parsed.out.length - 20}</p>}
            </div>
            <Button className="w-full" disabled={busy || !parsed.out.length} onClick={importAll}>
              {busy ? "Importando…" : `Importar ${parsed.out.length} questões`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
