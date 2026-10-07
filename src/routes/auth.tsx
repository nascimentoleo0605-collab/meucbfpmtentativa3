import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { needsSetup, setupFirstAdmin } from "@/lib/admin.functions";
import { claimSession } from "@/lib/session-lock.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, BookOpen, LockKeyhole, Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Entrar | MEUCBFPM" },
      { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Entre com sua conta para continuar." },
      { property: "og:title", content: "Entrar | MEUCBFPM" },
      { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Entre com sua conta para continuar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://meucbfpm.sbs/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkSetup = useServerFn(needsSetup);
  const setup = useServerFn(setupFirstAdmin);
  const claim = useServerFn(claimSession);
  const [mode, setMode] = useState<"login" | "setup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
    checkSetup().then((r) => setMode(r.needsSetup ? "setup" : "login")).catch(() => setMode("login"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "setup") {
        await setup({ data: { email, password, fullName } });
        toast.success("Administrador criado!");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou senha incorretos.");
      await claim();
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md animate-rise-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BookOpen className="h-7 w-7" /></span>
          <p className="font-serif text-2xl font-semibold">MEU<span className="text-primary">CBFPM</span></p>
          <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">Portal do aluno</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card/80 p-7">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
        {mode === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold">{mode === "setup" ? "Configurar administrador" : "Acessar plataforma"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "setup"
                  ? "Primeiro acesso: crie a conta do administrador."
                  : "Use o acesso fornecido pelo administrador."}
              </p>
            </div>
            {mode === "setup" && (
              <div className="space-y-1.5">
                <Label htmlFor="n">Nome</Label>
                <Input id="n" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="e">E-mail</Label>
                <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 pl-10" id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Senha</Label>
                <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-12 pl-10" id="p" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde…" : mode === "setup" ? "Criar e entrar" : <span className="flex items-center justify-center gap-2">Entrar <ArrowRight className="h-4 w-4" /></span>}
            </Button>
          </form>
        )}
        </div>
        <a href="https://wa.me/55984679565" target="_blank" rel="noreferrer" className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
          <MessageCircle className="h-4 w-4" /> Precisa de ajuda? Fale pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
