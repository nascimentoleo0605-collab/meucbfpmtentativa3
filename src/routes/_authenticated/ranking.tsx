import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Crown, Flame, Medal, Sparkles, Target, Trophy } from "lucide-react";
import { getRanking } from "@/lib/ranking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ranking")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Ranking | MEUCBFPM" },
    { name: "description", content: "Acompanhe o ranking de acertos do MEUCBFPM." },
    { property: "og:title", content: "Ranking | MEUCBFPM" },
    { property: "og:description", content: "Acompanhe o ranking de acertos do MEUCBFPM." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Ranking,
});

type Entry = { id: string; name: string; correct: number };
type RankingData = { entries: Entry[]; record: { name: string; streak: number } | null };

function Ranking() {
  const { user } = Route.useRouteContext();
  const fetchRanking = useServerFn(getRanking);
  const { data, isPending, error } = useQuery({ queryKey: ["ranking"], queryFn: () => fetchRanking(), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000 });
  const ranking = (data as RankingData | undefined)?.entries ?? [];
  const record = (data as RankingData | undefined)?.record ?? null;
  const myIndex = ranking.findIndex((entry) => entry.id === user.id);
  const leader = ranking[0]?.correct ?? 0;
  const podium = [ranking[1], ranking[0], ranking[2]];
  const ranks = [2, 1, 3];
  return <div className="space-y-7 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-chart-3"><Trophy size={16} /> Comunidade MEUCBFPM</div><h1 className="font-serif text-3xl font-semibold">Ranking</h1><p className="mt-2 text-sm text-muted-foreground">Cada resposta certa conta. Continue subindo!</p></div>
      {!isPending && !error && <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3"><Target className="shrink-0 text-primary" size={22} /><div><p className="text-xs text-muted-foreground">Sua colocação</p><strong className="font-serif text-xl text-primary">{myIndex >= 0 ? `${myIndex + 1}º lugar` : "—"}</strong></div></div>}
    </header>
    {isPending && <div className="space-y-3" aria-label="Carregando ranking">{[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>}
    {error && <p role="alert" className="text-destructive">Não foi possível carregar o ranking.</p>}
    {!isPending && !error && ranking.length === 0 && <p className="py-12 text-center text-muted-foreground">Ainda não há estudantes no ranking.</p>}
    {!isPending && !error && ranking.length > 0 && <>
      {record && <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Flame className="size-3.5 shrink-0 text-chart-5/70" aria-hidden="true" />
        Recorde de sequência flamejante: <strong className="font-semibold text-foreground/80">{record.streak} {record.streak === 1 ? "acerto seguido" : "acertos seguidos"}</strong>
        <span className="opacity-70">· {record.name}</span>
      </p>}
      <section aria-label="Pódio" className="grid grid-cols-3 items-end gap-2 border-b pb-8 sm:gap-4">
        {podium.map((entry, index) => {
          const rank = ranks[index];
          if (!entry) return <div key={rank} />;
          return <div key={entry.id} className={cn("animate-rise-in flex min-w-0 flex-col items-center text-center", rank === 1 && "-translate-y-2")}>
            {rank === 1 ? <Crown aria-hidden="true" className="mb-2 size-7 text-chart-3" /> : <Medal aria-hidden="true" className={cn("mb-2 size-6", rank === 2 ? "text-primary" : "text-chart-5")} />}
            <div className={cn("grid size-12 shrink-0 place-items-center rounded-full border-2 font-serif text-base font-bold sm:size-16 sm:text-lg", rank === 1 ? "border-chart-3 bg-chart-3/15 text-chart-3" : rank === 2 ? "border-primary bg-primary/10 text-primary" : "border-chart-5 bg-chart-5/10 text-chart-5")}>{initials(entry.name)}</div>
            <p className="mt-3 w-full truncate px-1 text-sm font-semibold" title={entry.name}>{entry.name}</p>
            {entry.id === user.id && <span className="text-xs font-semibold text-primary">Você</span>}
            <div className={cn("mt-3 flex w-full flex-col items-center justify-center rounded-t-md border-x border-t px-1 py-3", rank === 1 ? "min-h-28 border-chart-3/40 bg-chart-3/10" : rank === 2 ? "min-h-20 border-primary/30 bg-primary/5" : "min-h-16 border-chart-5/30 bg-chart-5/5")}>
              <span className={cn("font-serif text-2xl font-bold", rank === 1 ? "text-chart-3" : rank === 2 ? "text-primary" : "text-chart-5")}>{rank}º</span><span className="text-xs tabular-nums text-muted-foreground">{entry.correct} {entry.correct === 1 ? "acerto" : "acertos"}</span>
            </div>
          </div>;
        })}
      </section>
      <section aria-label="Classificação completa">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-serif text-lg font-semibold">Classificação completa</h2><span className="text-xs text-muted-foreground">{ranking.length} {ranking.length === 1 ? "estudante" : "estudantes"}</span></div>
        <div className="divide-y overflow-hidden rounded-md border">{ranking.map((entry, index) => <div key={entry.id} className={cn("flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50 sm:gap-4 sm:px-5", entry.id === user.id && "bg-primary/10 ring-1 ring-inset ring-primary/40")}>
          <span className={cn("w-8 shrink-0 text-center font-serif text-lg font-bold tabular-nums", index === 0 ? "text-chart-3" : index === 1 ? "text-primary" : index === 2 ? "text-chart-5" : "text-muted-foreground")}>{index + 1}</span><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground" aria-hidden="true">{initials(entry.name)}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}{entry.id === user.id && <span className="ml-2 text-xs font-semibold text-primary">Você</span>}</span>
          {index === 0 && <Sparkles className="hidden size-4 text-chart-3 sm:block" aria-label="Líder" />}<strong className="shrink-0 text-sm tabular-nums text-chart-2">{entry.correct} <span className="hidden font-normal text-muted-foreground sm:inline">{entry.correct === 1 ? "acerto" : "acertos"}</span></strong>
        </div>)}</div>
      </section>
      {myIndex > 0 && ranking[myIndex] && <p className="text-center text-sm text-muted-foreground">{leader - ranking[myIndex].correct} {leader - ranking[myIndex].correct === 1 ? "acerto" : "acertos"} até o topo. Cada questão é uma nova chance.</p>}
    </>}
  </div>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("") || "E";
}
