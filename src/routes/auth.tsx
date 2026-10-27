import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBasket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — MercadoFácil" },
      { name: "description", content: "Entre ou crie sua conta no MercadoFácil." },
      { property: "og:title", content: "Entrar — MercadoFácil" },
      { property: "og:description", content: "Entre ou crie sua conta no MercadoFácil." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/lista", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error("E-mail ou senha incorretos."); return; }
      navigate({ to: "/lista" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/lista" },
      });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta criada! Confira seu e-mail para confirmar.");
    }
  }

  async function forgot() {
    if (!email) { toast.error("Digite seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link para redefinir a senha.");
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error("Não foi possível entrar."); return; }
    if (result.redirected) return;
    navigate({ to: "/lista" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-soft">
        <div className="flex items-center gap-2 font-display text-xl font-extrabold text-primary">
          <ShoppingBasket className="h-6 w-6" /> MercadoFácil
        </div>
        <h1 className="mt-6 text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        {mode === "in" && (
          <button onClick={forgot} className="mt-3 text-sm text-muted-foreground underline">Esqueci a senha</button>
        )}
        <div className="my-6 h-px bg-border" />
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => social("google")}>Continuar com Google</Button>
          <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>
            Continue with Lovable
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "in" ? "Não tem conta? " : "Já tem conta? "}
          <button className="font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
