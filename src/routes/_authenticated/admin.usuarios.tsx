import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createStudent, deleteStudent, resetStudentPassword } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  staticData: { sitemap: false },
  beforeLoad: ({ context }) => { if (!context.isAdmin) throw redirect({ to: "/painel" }); },
  head: () => ({ meta: [
    { title: "Usuários | MEUCBFPM" }, { name: "description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Administre as contas dos estudantes." },
    { property: "og:title", content: "Usuários | MEUCBFPM" }, { property: "og:description", content: "Estude com questões por matéria e assunto, receba correção imediata e acompanhe sua evolução com gráficos de desempenho. Administre as contas dos estudantes." },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://stonehawk.com.br/admin/usuarios" }] }),
  component: Usuarios,
});

function Usuarios() {
  const qc = useQueryClient();
  const create = useServerFn(createStudent);
  const del = useServerFn(deleteStudent);
  const resetPw = useServerFn(resetStudentPassword);
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((u) => ({ ...u, isAdmin: !!r?.some((x) => x.user_id === u.id && x.role === "admin") }));
    },
  });
  const [f, setF] = useState({ fullName: "", email: "", password: "", isAdmin: false });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: f });
      toast.success("Conta criada");
      setF({ fullName: "", email: "", password: "", isAdmin: false });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6">
        <h1 className="font-serif text-2xl">Nova conta</h1>
        <div className="space-y-1.5"><Label>Nome</Label><Input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Senha</Label><Input minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.isAdmin} onCheckedChange={(v) => setF({ ...f, isAdmin: !!v })} /> Também é administrador</label>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
      </form>
      <div className="space-y-3">
        <h2 className="font-serif text-2xl">Contas ({users.length})</h2>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <div className="flex-1">
              <p className="font-medium">{u.full_name || "—"} {u.isAdmin && <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs">admin</span>}</p>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
            <Button variant="ghost" size="icon" title="Nova senha" onClick={async () => {
              const pw = prompt("Nova senha (mín. 6 caracteres):");
              if (!pw) return;
              try { await resetPw({ data: { id: u.id, password: pw } }); toast.success("Senha alterada"); } catch (e) { toast.error((e as Error).message); }
            }}><KeyRound className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Excluir" onClick={async () => {
              if (!confirm(`Excluir ${u.email}?`)) return;
              try { await del({ data: { id: u.id } }); qc.invalidateQueries({ queryKey: ["users"] }); } catch (e) { toast.error((e as Error).message); }
            }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
