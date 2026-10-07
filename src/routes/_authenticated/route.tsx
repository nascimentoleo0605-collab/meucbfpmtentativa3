import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { checkSession } from "@/lib/session-lock.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, BookOpen, BookMarked, ClipboardCheck, Sparkles, FileQuestion, GraduationCap, LogOut, Users, Trophy, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    return { user: data.user, isAdmin };
  },
  component: Layout,
});

function Layout() {
  const { isAdmin, user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    navigate({ to: "/painel", replace: true });
  };
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const check = useServerFn(checkSession);
  useEffect(() => {
    let stopped = false;
    const verify = async () => {
      try {
        const { active } = await check();
        if (!active && !stopped) {
          stopped = true;
          toast.error("Sua conta está em uso em mais de 2 dispositivos. Esta sessão foi encerrada.");
          await signOut();
        }
      } catch { /* network hiccup: try again later */ }
    };
    void verify();
    const timer = setInterval(verify, 20_000);
    const onFocus = () => void verify();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [pathname]);
  const link = "flex h-10 min-w-10 items-center justify-center gap-3 rounded-md px-2 text-sm font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:justify-start md:px-3";
  const active = { className: "flex h-10 min-w-10 items-center justify-center gap-3 rounded-md bg-sidebar-accent px-2 text-sm font-medium text-sidebar-accent-foreground md:justify-start md:px-3" };
  return (
    <div className="min-h-screen bg-background p-0 md:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1440px] overflow-hidden border-border bg-card/20 md:min-h-[calc(100vh-2rem)] md:rounded-lg md:border">
        <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-sidebar-border bg-sidebar md:static md:h-auto md:w-56 md:flex-col md:border-r md:border-t-0">
          <Link to="/painel" className="hidden h-20 items-center gap-3 border-b border-sidebar-border px-5 font-serif text-lg font-semibold md:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><BookOpen className="h-5 w-5" /></span>
             MEUCBFPM
          </Link>
           <nav className="flex flex-1 items-center justify-around gap-1 overflow-x-auto p-2 md:block md:space-y-1 md:p-3">
             <Link to="/painel" aria-label="Desempenho" title="Desempenho" className={link} activeProps={active}><BarChart3 /> <span className="hidden md:inline">Desempenho</span></Link>
              <Link to="/estudar" search={{ subject: undefined, topic: undefined }} aria-label="Estudar" title="Estudar" className={link} activeProps={active}><GraduationCap /> <span className="hidden md:inline">Estudar</span></Link>
             <Link to="/materias" aria-label="Matérias" title="Matérias" className={link} activeProps={active}><LayoutGrid /> <span className="hidden md:inline">Matérias</span></Link>
              <Link to="/resumos" aria-label="Resumos" title="Resumos" className={link} activeProps={active}><BookMarked /> <span className="hidden md:inline">Resumos</span></Link>
             <Link to="/ranking" aria-label="Ranking" title="Ranking" className={link} activeProps={active}><Trophy /> <span className="hidden md:inline">Ranking</span></Link>
              <Link to="/provao" aria-label="Provão" title="Provão" className={link} activeProps={active}><ClipboardCheck /> <span className="hidden md:inline">Provão</span></Link>
              <Link to="/ia" aria-label="Meu Assistente" title="Meu Assistente" className={link} activeProps={active}><Sparkles /> <span className="hidden md:inline">Meu Assistente</span></Link>
            {isAdmin && (
              <>
                 <Link to="/admin/questoes" aria-label="Questões" title="Questões" className={link} activeProps={active}><FileQuestion /> <span className="hidden md:inline">Questões</span></Link>
                 <Link to="/admin/usuarios" aria-label="Usuários" title="Usuários" className={link} activeProps={active}><Users /> <span className="hidden md:inline">Usuários</span></Link>
              </>
            )}
          </nav>
          <div className="hidden border-t border-sidebar-border p-3 md:block">
            <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
            <Button className="mt-2 w-full justify-start" variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between gap-3 border-b bg-background/40 px-4 backdrop-blur md:h-20 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={goBack} aria-label="Voltar à página anterior" title="Voltar">
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <p className="font-serif text-base font-semibold">Área de estudos</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Acompanhe seu progresso e continue praticando.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={signOut} aria-label="Sair"><LogOut /></Button>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            <div key={pathname} className="animate-page-in"><Outlet /></div>
          </main>
        </section>
      </div>
    </div>
  );
}
