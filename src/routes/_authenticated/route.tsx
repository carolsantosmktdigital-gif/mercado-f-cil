import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/AppShell";
import { StoreProvider, type Familia } from "@/lib/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  const famQ = useQuery({
    queryKey: ["familia", user.id],
    queryFn: async (): Promise<Familia | null> => {
      const { data, error } = await supabase
        .from("familia_membros")
        .select("familias(id, nome, codigo)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.familias as Familia | null) ?? null;
    },
  });

  if (famQ.isLoading) return <p className="p-10 text-center text-muted-foreground">Carregando…</p>;
  if (!famQ.data) return <FamiliaSetup userId={user.id} />;
  return (
    <StoreProvider familia={famQ.data}>
      <Outlet />
      <BottomNav />
    </StoreProvider>
  );
}

function FamiliaSetup({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);

  async function rodar(fn: "criar_familia" | "entrar_familia") {
    setBusy(true);
    const { error } = fn === "criar_familia"
      ? await supabase.rpc("criar_familia", { _nome: nome })
      : await supabase.rpc("entrar_familia", { _codigo: codigo });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["familia", userId] });
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-5 py-10">
      <div>
        <h1 className="text-3xl font-extrabold">Sua família</h1>
        <p className="mt-1 text-muted-foreground">Todos da família compartilham a mesma lista, catálogo e histórico.</p>
      </div>
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Criar uma família</h2>
        <Label>Nome</Label>
        <Input className="h-12" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Família Silva" />
        <Button size="lg" className="h-12 w-full rounded-2xl" disabled={busy} onClick={() => rodar("criar_familia")}>Criar família</Button>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Entrar com código</h2>
        <Label>Código recebido</Label>
        <Input className="h-12 uppercase" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: A1B2C3" />
        <Button size="lg" variant="outline" className="h-12 w-full rounded-2xl" disabled={busy || !codigo.trim()} onClick={() => rodar("entrar_familia")}>Entrar na família</Button>
      </section>
      <Button variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>Sair</Button>
    </div>
  );
}
