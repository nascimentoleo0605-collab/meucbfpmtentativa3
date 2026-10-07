import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, LoaderCircle, Sparkles, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addProvaoBatch, finishProvao, getProvao, saveProvaoAnswer, startProvao } from "@/lib/provao.functions";

export const Route = createFileRoute("/_authenticated/provao")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Provão | MEUCBFPM" },
    { name: "description", content: "Simulado individual com 50 questões e diagnóstico por matéria no MEUCBFPM." },
    { property: "og:title", content: "Provão | MEUCBFPM" },
    { property: "og:description", content: "Simulado individual com 50 questões e diagnóstico por matéria no MEUCBFPM." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Provao,
});

function Provao() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const get = useServerFn(getProvao);
  const start = useServerFn(startProvao);
  const generate = useServerFn(addProvaoBatch);
  const save = useServerFn(saveProvaoAnswer);
  const finish = useServerFn(finishProvao);
  const { data: session, isPending, error } = useQuery({ queryKey: ["provao", user.id], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);
  const update = (value: NonNullable<typeof session>) => qc.setQueryData(["provao", user.id], value);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir esta ação."); }
    finally { setBusy(false); }
  };
  const generateRemaining = async (id: string, count: number) => {
    for (let n = count; n < 50; n += 10) update(await generate({ data: { id } }));
  };
  const begin = () => run(async () => {
    const created = await start();
    update(created); setPosition(0); setReviewing(false); setGenerationStarted(true);
    await generateRemaining(created.id, created.count);
  });
  const nextBatch = () => run(async () => { if (session) await generateRemaining(session.id, session.count); });
  const choose = (choice: number) => run(async () => {
    if (!session) return;
    update(await save({ data: { id: session.id, index: position, selected: choice } }));
  });
  const complete = () => run(async () => { if (!session) return; update(await finish({ data: { id: session.id } })); setReviewing(false); });

  const questions = session?.questions ?? [];
  const answers = session?.answers ?? {};
  const answered = Object.keys(answers).length;
  const done = session?.status === "completed";
  const ready = questions.length === 50;
  const question = questions[position];
  const report = session?.result;
  const performance = report ? [...new Set(report.review.map((r) => `${r.subject} · ${r.topic}`))].map((name) => {
    const group = report.review.filter((r) => `${r.subject} · ${r.topic}` === name);
    const correct = group.filter((r) => r.selectedIndex === r.correctIndex).length;
    return { name, correct, total: group.length, percentage: Math.round(correct / group.length * 100) };
  }).sort((a, b) => a.percentage - b.percentage || b.total - a.total) : [];
  const advice = performance.filter((r) => r.percentage < 70 && r.total >= 3).sort((a, b) => (b.total * (100 - b.percentage)) - (a.total * (100 - a.percentage))).slice(0, 3);

  return <div className="mx-auto max-w-4xl space-y-6 pb-8">
    <header className="border-b pb-6">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-chart-3"><Trophy size={16} /> Simulado individual</p>
      <h1 className="font-serif text-3xl font-bold">Provão</h1>
      <p className="mt-2 text-sm text-muted-foreground">50 questões inéditas · 45 do MÓDULO 3 · 5 dos MÓDULOS 1 e 2</p>
    </header>

    {isPending && <p className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Carregando seu Provão…</p>}
    {error && <div role="alert" className="text-destructive">Não foi possível carregar seu Provão. Atualize a página para tentar novamente.</div>}

    {!isPending && !error && (!session || (done && reviewing)) && <section className="space-y-4 py-8">
      <div className="flex size-14 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><ClipboardCheck size={30} /></div>
      <h2 className="font-serif text-2xl font-semibold">{session ? "Pronto para outro desafio?" : "Seu simulado começa aqui"}</h2>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">As questões são criadas a partir das matérias já cadastradas e variam de um aluno para outro. O gabarito e as recomendações aparecem somente depois de finalizar.</p>
      <Button onClick={begin} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy ? "Preparando…" : "Criar meu Provão"}</Button>
      {session && <Button variant="ghost" onClick={() => setReviewing(false)}>Ver resultado anterior</Button>}
    </section>}

    {session && !done && !ready && <section className="space-y-6 py-4">
      <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Sparkles /></span><div><h2 className="font-serif text-xl font-semibold">Montando seu Provão</h2><p className="mt-1 text-sm text-muted-foreground">As questões são criadas em cinco etapas. Você pode voltar depois sem perder o que já foi criado.</p></div></div>
      <div className="h-2 overflow-hidden rounded-sm bg-muted"><div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${questions.length * 2}%` }} /></div>
      <p className="text-sm font-semibold tabular-nums">{questions.length} de 50 questões prontas</p>
      <Button onClick={nextBatch} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{busy ? "Criando questões… Pode levar alguns minutos" : questions.length ? "Continuar criação" : "Criar questões"}</Button>
      {generationStarted && questions.length === 0 && <p className="text-xs text-muted-foreground">Se sair agora, poderá retomar aqui mesmo.</p>}
    </section>}

    {session && !done && ready && question && <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="font-semibold text-primary">Questão {position + 1} / 50</span><span className="text-muted-foreground">{answered} respondidas · {50 - answered} restantes</span></div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted"><div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${answered * 2}%` }} /></div>
      <div key={position} className="animate-rise-in rounded-lg border bg-card p-5 sm:p-7">
        <p className="text-xs font-bold uppercase text-primary">{question.subject} · {question.topic}</p>
        <h2 className="mt-4 whitespace-pre-wrap font-serif text-lg font-semibold leading-relaxed sm:text-xl">{question.statement}</h2>
        <div className="mt-6 space-y-2" role="group" aria-label="Alternativas">
          {question.options.map((option, i) => <Button key={i} type="button" variant="outline" disabled={busy} onClick={() => choose(i)} className={cn("!h-auto min-h-12 w-full !justify-start whitespace-normal p-3 text-left leading-6", answers[String(position)] === i && "border-primary bg-primary/10 text-primary")}><span className="shrink-0 font-bold">{String.fromCharCode(65 + i)})</span><span>{option}</span>{answers[String(position)] === i && <CheckCircle2 className="ml-auto shrink-0" size={18} />}</Button>)}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={position === 0 || busy} onClick={() => setPosition((n) => n - 1)}><ArrowLeft /> Anterior</Button><Button variant="outline" disabled={position === 49 || busy} onClick={() => setPosition((n) => n + 1)}>Próxima <ArrowRight /></Button></div>
      <div className="grid grid-cols-10 gap-1.5" aria-label="Ir para questão">{questions.map((_, i) => <Button type="button" key={i} variant={i === position ? "default" : answers[String(i)] !== undefined ? "secondary" : "outline"} size="icon" className="h-9 w-full text-xs tabular-nums" onClick={() => setPosition(i)} aria-label={`Questão ${i + 1}${answers[String(i)] !== undefined ? " respondida" : " pendente"}`}>{i + 1}</Button>)}</div>
      <div className="border-t pt-5"><Button disabled={busy || answered !== 50} onClick={complete}>{busy ? <LoaderCircle className="animate-spin" /> : <ClipboardCheck />} {busy ? "Corrigindo…" : "Finalizar e ver resultado"}</Button>{answered !== 50 && <p className="mt-2 text-xs text-muted-foreground">Responda às {50 - answered} questões restantes para finalizar.</p>}</div>
    </section>}

    {session && done && !reviewing && report && <div className="space-y-8 animate-page-in">
      <section className="grid gap-5 border-b pb-7 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="grid size-32 place-content-center rounded-lg border border-primary/30 bg-primary/10 text-center"><span className="font-serif text-4xl font-bold tabular-nums text-primary">{(report.score / 5).toFixed(1).replace(".", ",")}</span><span className="text-xs text-muted-foreground">nota de 0 a 10</span></div>
        <div><p className="mb-2 text-xs font-bold uppercase text-primary">Seu desempenho</p><h2 className="font-serif text-2xl font-semibold">{report.score >= 40 ? "Ótimo preparo!" : report.score >= 30 ? "Você está no caminho" : "Hora de reforçar a revisão"}</h2><p className="mt-2 text-sm text-muted-foreground">{report.score} acertos em 50 questões · {Math.round(report.score * 2)}% de aproveitamento. Este resultado é uma estimativa de estudo, não uma previsão da prova oficial.</p></div>
      </section>
       <section className="space-y-3"><h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Target className="text-primary" /> Onde focar agora</h2>{advice.length ? <p className="text-sm leading-6 text-muted-foreground">Priorize {advice.map((item) => item.name).join("; ")}. Refaça questões dessas matérias e revise os comentários antes do próximo Provão.</p> : <p className="text-sm text-muted-foreground">Bom equilíbrio entre as matérias com mais questões! Mantenha a revisão e pratique mais questões do MÓDULO 3.</p>}</section>
      <section className="space-y-4"><h2 className="font-serif text-xl font-semibold">Resultado por matéria</h2>{performance.map((item) => <div key={item.name} className="space-y-1.5 border-b pb-3"><div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.name}</span><strong className="shrink-0 tabular-nums text-primary">{item.percentage}%</strong></div><div className="h-2 overflow-hidden rounded-sm bg-muted"><div className={cn("h-full transition-[width] duration-500", item.percentage < 70 ? "bg-chart-3" : "bg-chart-2")} style={{ width: `${item.percentage}%` }} /></div><p className="text-xs text-muted-foreground">{item.correct} de {item.total} acertos</p></div>)}</section>
      <section className="space-y-4"><h2 className="font-serif text-xl font-semibold">Correção das 50 questões</h2><div className="space-y-3">{report.review.map((item) => <details key={item.number} className="rounded-md border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">{item.number}. {item.topic} — <span className={item.selectedIndex === item.correctIndex ? "text-chart-2" : "text-destructive"}>{item.selectedIndex === item.correctIndex ? "Acertou" : "Errou"}</span></summary><div className="mt-3 space-y-2 text-sm"><p>{questions[item.number - 1]?.statement}</p><p>Gabarito: <strong>{String.fromCharCode(65 + item.correctIndex)}) {questions[item.number - 1]?.options[item.correctIndex]}</strong></p><p className="text-muted-foreground">{item.explanation}</p></div></details>)}</div></section>
      <Button onClick={() => setReviewing(true)}><Sparkles /> Criar novo Provão</Button>
    </div>}
  </div>;
}