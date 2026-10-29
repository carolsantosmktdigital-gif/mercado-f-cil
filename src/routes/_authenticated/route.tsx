import { ThemeChoice } from "@/components/PersonalPreferences";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/AppShell";
import { cached, saveCache } from "@/lib/offline";
import { StoreProvider, type Familia } from "@/lib/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    return {};
  },
  component: Layout,
});

export function Layout() {
  const qc = useQueryClient();
  const [user, setUser] = useState<{ id: string } | null>(
    () => cached<{ id: string }>("identity", ["user"]) || null,
  );
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function iniciar() {
      const attempt = generation;
      if (!navigator.onLine) {
        const local = cached<{ id: string }>("identity", ["user"]);
        if (local) {
          setUser(local);
          return;
        }
        setAuthError("Conecte-se uma primeira vez para preparar este celular.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active || attempt !== generation) return;
      if (sessionData.session?.user) {
        const local = { id: sessionData.session.user.id };
        saveCache("identity", ["user"], local);
        if (active) setUser(local);
        return;
      }
      if (cached("identity", ["user"]) && !sessionData.session) return;
      const { data: existing } = await supabase.auth.getUser();
      if (!active || attempt !== generation) return;
      if (existing.user) {
        saveCache("identity", ["user"], { id: existing.user.id });
        setUser(existing.user);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!active || attempt !== generation) return;
      if (error || !data.user) {
        setAuthError(error?.message || "Não foi possível iniciar.");
        return;
      }
      saveCache("identity", ["user"], { id: data.user.id });
      setUser(data.user);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" || !active) return;
      generation += 1;
      const previous = cached<{ id: string }>("identity", ["user"]);
      saveCache("identity", ["user"], null);
      if (previous) {
        saveCache(previous.id, ["familia"], null);
        void qc.cancelQueries({ queryKey: ["familia", previous.id] });
        qc.removeQueries({ queryKey: ["familia", previous.id] });
      }
      setUser(null);
      setAuthError("");
      // Start the new anonymous session outside Supabase's auth callback lock.
      window.setTimeout(() => {
        if (active) void iniciar();
      }, 0);
    });
    void iniciar();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [qc]);
  if (authError)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold">Mercado Fácil</h1>
        <p className="mt-4 text-muted-foreground">
          Não foi possível iniciar automaticamente: {authError}
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!user)
    return <p className="p-10 text-center text-muted-foreground">Preparando seu Mercado Fácil…</p>;
  return <AuthenticatedLayout user={user} />;
}

function AuthenticatedLayout({ user }: { user: { id: string } }) {
  const famQ = useQuery({
    queryKey: ["familia", user.id],
    initialData: () => cached<Familia | null>(user.id, ["familia"]),
    queryFn: async (): Promise<Familia | null> => {
      const { data, error } = await supabase
        .from("familia_membros")
        .select("familias(id, nome, codigo)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return saveCache(user.id, ["familia"], (data?.familias as Familia | null) ?? null);
    },
  });

  if (famQ.isPending) return <p className="p-10 text-center text-muted-foreground">Carregando…</p>;
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
    const { error } =
      fn === "criar_familia"
        ? await supabase.rpc("criar_familia", { _nome: nome })
        : await supabase.rpc("entrar_familia", { _codigo: codigo });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["familia", userId] });
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-5 py-10">
      <div className="flex justify-end">
        <ThemeChoice />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold">Sua família</h1>
        <p className="mt-1 text-muted-foreground">
          Digite o nome da sua família uma única vez neste celular. Todos da família compartilham a
          lista, os cartões e o histórico.
        </p>
      </div>
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Criar uma família</h2>
        <Label>Nome</Label>
        <Input
          className="h-12"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Família Silva"
        />
        <Button
          size="lg"
          className="h-12 w-full rounded-2xl"
          disabled={busy}
          onClick={() => rodar("criar_familia")}
        >
          Criar família
        </Button>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Entrar na família</h2>
        <Label>Nome da família</Label>
        <Input
          className="h-12"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Ex.: Família Teste"
        />
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-full rounded-2xl"
          disabled={busy || !codigo.trim()}
          onClick={() => rodar("entrar_familia")}
        >
          Continuar
        </Button>
      </section>
    </div>
  );
}
