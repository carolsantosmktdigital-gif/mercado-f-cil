import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Mercado Fácil" },
      { name: "description", content: "Entre para compartilhar a lista de compras com sua família." },
      { property: "og:title", content: "Entrar — Mercado Fácil" },
      { property: "og:description", content: "Lista, catálogo e histórico compartilhados com a família." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setBusy(false);
      if (error) return toast.error("E-mail ou senha incorretos.");
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    }
  }

  async function esqueci() {
    if (!email) return toast.error("Digite seu e-mail primeiro.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link para redefinir a senha.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com Google.");
    else if (!r.redirected) navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-4xl font-extrabold">Mercado Fácil</h1>
      <p className="mt-2 text-muted-foreground">{modo === "entrar" ? "Entre na sua conta" : "Crie sua conta"}</p>
      <Button variant="outline" size="lg" className="mt-8 h-14 w-full rounded-2xl text-base" onClick={google}>Continuar com Google</Button>
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <div className="space-y-1"><Label>E-mail</Label><Input className="h-14 text-base" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Senha</Label><Input className="h-14 text-base" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <Button type="submit" size="lg" disabled={busy} className="h-14 w-full rounded-2xl text-base">{modo === "entrar" ? "Entrar" : "Criar conta"}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button className="font-semibold text-primary" onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}>
          {modo === "entrar" ? "Criar conta" : "Já tenho conta"}
        </button>
        {modo === "entrar" && <button className="text-muted-foreground" onClick={esqueci}>Esqueci a senha</button>}
      </div>
    </div>
  );
}
