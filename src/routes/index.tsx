import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, BarChart3, Layers } from "lucide-react";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "MEUCBFPM — pratique, revise e evolua" },
      { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho." },
      { property: "og:title", content: "MEUCBFPM — pratique, revise e evolua" },
      { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho." },
    ],
    links: [{ rel: "canonical", href: "https://stonehawk.com.br/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif text-xl font-semibold">
             <BookOpen className="h-5 w-5 text-primary" /> MEUCBFPM
          </div>
          <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
        </div>
        <section className="py-24">
          <p className="text-sm uppercase tracking-widest text-primary">Banco de questões</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight md:text-6xl">
             Painel de Questões - CBFPM 2026
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
             Questões organizadas por módulo e matéria, com correção imediata e um painel pessoal de acertos.
          </p>
          <Button asChild size="lg" className="mt-8"><Link to="/auth">Acessar minha conta</Link></Button>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {[
             [Layers, "Organizado", "Filtre por módulo e matéria."],
             [BookOpen, "Correção na hora", "Veja o gabarito automaticamente."],
            [BarChart3, "Seu desempenho", "Gráfico de acertos por matéria."],
          ].map(([Icon, t, d]: any) => (
            <div key={t} className="rounded-lg border bg-card p-6">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-serif text-lg">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
