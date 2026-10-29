import { ShoppingListBuilder } from "@/components/ShoppingListBuilder";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ListChecks, Plus, ShoppingCart } from "lucide-react";
import { Page } from "@/components/AppShell";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Mercado Fácil" },
      { name: "description", content: "Resumo dos seus cartões, saldos e da compra em andamento." },
      { property: "og:title", content: "Mercado Fácil" },
      {
        property: "og:description",
        content: "Organize compras de supermercado com cartões de alimentação.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { cartoes, itens, familia, listas, listaId, selecionarLista, criarLista } = useDemo();
  const [abrirNovaLista, setAbrirNovaLista] = useState(false);
  const [nomeLista, setNomeLista] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [valorLista, setValorLista] = useState("");
  const [criando, setCriando] = useState(false);
  const total = cartoes.reduce((s, c) => s + c.saldo, 0);
  const pendentes = itens.filter((i) => !i.comprado).length;
  return (
    <Page title="Mercado Fácil" subtitle="Olá! Boas compras 🛒">
      <section className="mb-4 flex items-center justify-between rounded-3xl bg-accent p-4 text-accent-foreground">
        <div>
          <p className="font-bold">{familia.nome}</p>
          <p className="text-sm opacity-80">
            Código para convidar: <span className="font-mono font-bold">{familia.codigo}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </section>
      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Saldo total nos cartões</p>
          <Link to="/cartoes" className="text-sm font-semibold text-primary">
            Ver todos
          </Link>
        </div>
        <p className="mt-1 font-display text-3xl font-extrabold">{brl(total)}</p>
        <ul className="mt-4 space-y-2">
          {cartoes.map((c) => (
            <li key={c.id} className="flex justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="font-medium">{c.nome}</span>
              <span className="font-semibold text-primary">{brl(c.saldo)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Suas listas</h2>
          <Button size="sm" onClick={() => setAbrirNovaLista((v) => !v)}>
            <Plus className="h-4 w-4" /> Nova lista
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {listas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => selecionarLista(l.id)}
              className={
                "rounded-xl border px-3 py-2 text-sm " +
                (listaId === l.id ? "bg-primary text-primary-foreground" : "bg-muted")
              }
            >
              {l.nome}
            </button>
          ))}
        </div>
        {abrirNovaLista && (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setCriando(true);
              try {
                await criarLista(
                  nomeLista.trim(),
                  cartaoId,
                  Number(valorLista.replace(",", ".")),
                  0,
                );
                setAbrirNovaLista(false);
                setNomeLista("");
                setValorLista("");
                toast.success("Lista criada.");
              } catch {
                toast.error("Não foi possível criar a lista.");
              } finally {
                setCriando(false);
              }
            }}
          >
            <Input
              required
              placeholder="Nome da lista"
              value={nomeLista}
              onChange={(e) => setNomeLista(e.target.value)}
            />
            <select
              required
              className="h-12 w-full rounded-xl border bg-background px-3"
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value)}
            >
              <option value="">Selecione um cartão</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {brl(c.saldo)}
                </option>
              ))}
            </select>
            <Input
              required
              inputMode="decimal"
              placeholder="Valor destinado às compras (R$)"
              value={valorLista}
              onChange={(e) => setValorLista(e.target.value)}
            />
            <Button disabled={criando} type="submit" className="w-full">
              Criar lista
            </Button>
          </form>
        )}
      </section>

      <ShoppingListBuilder />

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-xl font-bold">
        <ShoppingCart className="h-5 w-5" /> Compra em andamento
      </h2>
      <BudgetCard />

      <h2 className="mb-3 mt-8 text-xl font-bold">Acesso rápido</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/lista" className="rounded-3xl bg-card p-5 shadow-soft">
          <ListChecks className="h-7 w-7 text-primary" />
          <p className="mt-3 font-bold">Lista de compras</p>
          <p className="text-sm text-muted-foreground">{pendentes} itens a pegar</p>
        </Link>
        <Link to="/adicionar" className="rounded-3xl bg-accent p-5 text-accent-foreground">
          <Plus className="h-7 w-7" />
          <p className="mt-3 font-bold">Adicionar produto</p>
          <p className="text-sm opacity-80">Na lista e no catálogo</p>
        </Link>
      </div>
      <Button asChild size="lg" className="mt-6 h-14 w-full rounded-2xl text-base">
        <Link to="/lista">
          Continuar compra <ChevronRight className="h-5 w-5" />
        </Link>
      </Button>
    </Page>
  );
}
