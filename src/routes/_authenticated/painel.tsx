import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPerformance } from "@/lib/performance.functions";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, CheckCircle2, CircleX, ClipboardList, Target, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Desempenho | MEUCBFPM" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Consulte seus resultados e tendências." },
    { property: "og:title", content: "Desempenho | MEUCBFPM" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Consulte seus resultados e tendências." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/painel" }] }),
  component: Painel,
});

const PERIODS: Record<string, { label: string; days: number | null }> = {
  "7": { label: "Últimos 7 dias", days: 7 },
  "30": { label: "Últimos 30 dias", days: 30 },
  "90": { label: "Últimos 90 dias", days: 90 },
  all: { label: "Todo o período", days: null },
};
const ALL = "__all";

type A = { is_correct: boolean; created_at: string; questions: { subject: string; topic: string } | null };

function group(rows: A[], key: (a: A) => string) {
  const m = new Map<string, { acertos: number; erros: number }>();
  rows.forEach((a) => {
    const k = key(a);
    const c = m.get(k) ?? { acertos: 0, erros: 0 };
    a.is_correct ? c.acertos++ : c.erros++;
    m.set(k, c);
  });
  return [...m.entries()].map(([nome, v]) => ({
    nome, ...v, total: v.acertos + v.erros,
    percentual: Math.round((v.acertos / (v.acertos + v.erros)) * 100),
  }));
}

function Painel() {
  const { user } = Route.useRouteContext();
  const [period, setPeriod] = useState("30");
  const [subject, setSubject] = useState(ALL);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data?.full_name ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const displayName =
    profile?.trim() ||
    (typeof user.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"].trim() : "") ||
    user.email?.split("@")[0] ||
    "Estudante";

  const fetchPerf = useServerFn(getMyPerformance);
  const { data = [], isLoading } = useQuery({
    queryKey: ["attempts", user.id, period],
    queryFn: async () => (await fetchPerf({ data: { days: PERIODS[period]?.days ?? null } })) as A[],
  });

  const subjects = useMemo(() => [...new Set(data.map((a) => a.questions?.subject ?? "—"))].sort(), [data]);
  const rows = subject === ALL ? data : data.filter((a) => a.questions?.subject === subject);
  const bySubject = group(data, (a) => a.questions?.subject ?? "—");
  const byTopic = group(rows, (a) => (subject === ALL ? `${a.questions?.subject} · ` : "") + (a.questions?.topic || "Sem assunto"))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const timeline = group(rows, (a) => a.created_at.slice(0, 10))
    .sort((x, y) => x.nome.localeCompare(y.nome))
    .map((d) => ({ ...d, dia: d.nome.slice(8, 10) + "/" + d.nome.slice(5, 7) }));

  const total = rows.length;
  const acertos = rows.filter((a) => a.is_correct).length;
  const percentage = total ? Math.round((acertos / total) * 100) : 0;
  const strongest = [...byTopic].sort((a, b) => b.percentual - a.percentual)[0];
  const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };

  const firstName = displayName.trim().split(/\s+/)[0] || "Estudante";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const contextLine = isLoading
    ? "Preparando seus números…"
    : total === 0
      ? "Nenhuma resposta ainda neste período. Escolha um assunto e comece agora — seus gráficos aparecem aqui."
      : `Você respondeu ${total} ${total === 1 ? "questão" : "questões"} e acertou ${acertos}. ${percentage === 100 ? "Aproveitamento perfeito — siga firme." : percentage >= 70 ? "Você está no caminho certo para o Provão." : "Bora subir esse número: revise os erros abaixo."}`;

  return (
    <div className="space-y-6">
      <section className="animate-greet-in relative overflow-hidden rounded-lg border bg-card/70 p-5 md:p-6">
        <div className="greet-sweep pointer-events-none absolute -top-28 -left-16 h-56 w-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              {timeGreeting} <span className="text-muted-foreground/70">·</span> <span className="normal-case tracking-normal text-muted-foreground">{today}</span>
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight md:text-4xl">
              Olá,{" "}
              <span className="greet-name inline-block rounded-md px-1">
                <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent">{firstName}</span>
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{contextLine}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-background/60 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Target className="h-4 w-4" /></span>
            <div>
              <p className="font-serif text-2xl font-semibold leading-none tabular-nums text-primary">{total ? `${percentage}%` : "—"}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">aproveitamento</p>
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

        <div className="mr-auto">
          <p className="mb-2 text-xs font-semibold uppercase text-primary">Visão de desempenho</p>
          <h1 className="font-serif text-3xl font-semibold">Seu progresso em números</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acompanhe tendências, compare matérias e escolha onde praticar.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PERIODS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as matérias</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button asChild><Link to="/estudar" search={{ subject: subject === ALL ? undefined : subject, topic: undefined }}>Estudar agora</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Respondidas" value={total} detail="no período" icon={ClipboardList} />
        <Stat label="Acertos" value={acertos} detail={`${percentage}% do total`} icon={CheckCircle2} tone="success" />
        <Stat label="Erros" value={total - acertos} detail="pontos para revisar" icon={CircleX} tone="danger" />
        <Stat label="Aproveitamento" value={total ? `${percentage}%` : "—"} detail={strongest ? `Destaque: ${strongest.nome}` : "comece a praticar"} icon={Award} tone="primary" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-muted-foreground">Nenhuma resposta neste período. Resolva algumas questões para ver seus gráficos.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Evolução ao longo do tempo" subtitle="Passe o cursor ou toque nos pontos para ver os resultados do dia." className="lg:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" {...axis} />
                <YAxis yAxisId="l" allowDecimals={false} {...axis} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" {...axis} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Area yAxisId="l" type="monotone" dataKey="acertos" name="Acertos" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.16} strokeWidth={2} activeDot={{ r: 5 }} />
                <Area yAxisId="l" type="monotone" dataKey="erros" name="Erros" stroke="var(--destructive)" fill="var(--destructive)" fillOpacity={0.08} strokeWidth={2} activeDot={{ r: 5 }} />
                <Area yAxisId="r" type="monotone" dataKey="percentual" name="% acerto" stroke="var(--chart-1)" fill="transparent" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Por matéria" subtitle="Compare seu volume de acertos e erros.">
            <Bars data={bySubject} axis={axis} />
          </Card>
           <Card title={subject === ALL ? "Por assunto" : `Assuntos de ${subject}`} subtitle="Use este gráfico para decidir o próximo treino." autoHeight>
             <TopicBreakdown data={byTopic} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Bars({ data, axis }: { data: any[]; axis: any }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="nome" width={120} {...axis} />
        <Tooltip formatter={(v: any, n: any) => [v, n]} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--muted)" }} />
        <Legend />
        <Bar dataKey="acertos" name="Acertos" stackId="a" fill="var(--chart-2)" />
        <Bar dataKey="erros" name="Erros" stackId="a" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopicBreakdown({ data }: { data: ReturnType<typeof group> }) {
  if (data.length === 0) return <p className="py-8 text-sm text-muted-foreground">Nenhuma resposta por assunto neste filtro.</p>;
  return <div className="space-y-4" role="list" aria-label="Resultados por assunto">
    {data.map((item) => <div key={item.nome} role="listitem" className="space-y-2">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-medium leading-5">{item.nome}</span>
        <span className="shrink-0 font-semibold tabular-nums text-chart-2">{item.percentual}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-muted" aria-label={`${item.acertos} acertos e ${item.erros} erros`}>
        <div className="h-full bg-chart-2 transition-[width] duration-500" style={{ width: `${item.acertos / item.total * 100}%` }} />
        <div className="h-full bg-destructive transition-[width] duration-500" style={{ width: `${item.erros / item.total * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{item.acertos} {item.acertos === 1 ? "acerto" : "acertos"} · {item.erros} {item.erros === 1 ? "erro" : "erros"}</p>
    </div>)}
  </div>;
}

function Card({ title, subtitle, children, className = "", autoHeight = false }: { title: string; subtitle: string; children: React.ReactNode; className?: string; autoHeight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${className}`}>
      <div className="mb-5"><h2 className="font-serif text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
       <div className={autoHeight ? "" : "h-72 md:h-80"}>{children}</div>
    </div>
  );
}

function Stat({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: string | number; detail: string; icon: typeof TrendingUp; tone?: "default" | "success" | "danger" | "primary" }) {
  const toneClass = tone === "success" ? "text-chart-2 bg-chart-2/10" : tone === "danger" ? "text-destructive bg-destructive/10" : tone === "primary" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted";
  return (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3"><p className="text-sm text-muted-foreground">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}><Icon className="h-4 w-4" /></span></div>
      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 truncate text-xs text-muted-foreground" title={detail}>{detail}</p>
    </div>
  );
}
