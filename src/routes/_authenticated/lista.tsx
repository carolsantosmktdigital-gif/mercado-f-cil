import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: async () => {
    const { data, error } = await supabase.from("shopping_items").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/lista")({
  head: () => ({
    meta: [
      { title: "Minha lista — MercadoFácil" },
      { name: "description", content: "Sua lista de compras." },
      { property: "og:title", content: "Minha lista — MercadoFácil" },
      { property: "og:description", content: "Sua lista de compras." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsQuery),
  component: ListaPage,
});

function ListaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items } = useSuspenseQuery(itemsQuery);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["items"] });
  const onErr = () => toast.error("Não foi possível salvar.");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").insert({ name: name.trim(), quantity: qty.trim() || "1" });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setQty(""); refresh(); },
    onError: onErr,
  });
  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from("shopping_items").update({ checked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });
  const clearDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").delete().eq("checked", true);
      if (error) throw error;
    },
    onSuccess: refresh, onError: onErr,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const done = items.filter((i) => i.checked).length;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-xl font-extrabold text-primary">
          <ShoppingBasket className="h-6 w-6" /> MercadoFácil
        </span>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1 h-4 w-4" /> Sair</Button>
      </header>
      <h1 className="mt-8 text-4xl font-extrabold">Minha lista</h1>
      <p className="text-muted-foreground">{done} de {items.length} no carrinho</p>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}
        className="mt-6 flex gap-2"
      >
        <Input placeholder="Ex.: Arroz" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Input placeholder="Qtd." value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" />
        <Button type="submit" disabled={add.isPending} aria-label="Adicionar"><Plus className="h-4 w-4" /></Button>
      </form>

      <ul className="mt-6 space-y-2">
        {items.length === 0 && (
          <li className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-soft">
            Sua lista está vazia. Adicione o primeiro item!
          </li>
        )}
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft">
            <Checkbox checked={i.checked} onCheckedChange={(v) => toggle.mutate({ id: i.id, checked: !!v })} aria-label={i.name} />
            <span className={`flex-1 ${i.checked ? "text-muted-foreground line-through" : ""}`}>{i.name}</span>
            <span className="rounded-full bg-secondary px-3 py-0.5 text-sm text-secondary-foreground">{i.quantity}</span>
            <button onClick={() => remove.mutate(i.id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {done > 0 && (
        <Button variant="outline" className="mt-6 w-full" onClick={() => clearDone.mutate()}>
          Remover itens marcados
        </Button>
      )}
    </main>
  );
}
