import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Mercado Fácil" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Nova senha — Mercado Fácil" },
      { property: "og:description", content: "Redefina sua senha do Mercado Fácil." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return toast.error(error.message);
    toast.success("Senha alterada.");
    navigate({ to: "/" });
  }
  return (
    <form onSubmit={salvar} className="mx-auto max-w-md space-y-4 px-5 py-12">
      <h1 className="text-3xl font-extrabold">Nova senha</h1>
      <Label>Senha nova</Label>
      <Input className="h-14" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
      <Button type="submit" size="lg" className="h-14 w-full rounded-2xl">Salvar</Button>
    </form>
  );
}
