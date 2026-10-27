import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ListChecks, Plus, ShoppingCart } from "lucide-react";
import { Page, DemoBadge } from "@/components/AppShell";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { brl, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Mercado Fácil" },
      { name: "description", content: "Resumo dos seus cartões, saldos e da compra em andamento." },
      { property: "og:title", content: "Mercado Fácil" },
      { property: "og:description", content: "Organize compras de supermercado com cartões de alimentação." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { cartoes, itens } = useDemo();
  const total = cartoes.reduce((s, c) => s + c.saldo, 0);
  const pendentes = itens.filter((i) => !i.comprado).length;
  return (
    <Page title="Mercado Fácil" subtitle="Olá! Boas compras 🛒">
      <DemoBadge />
      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Saldo total nos cartões</p>
          <Link to="/cartoes" className="text-sm font-semibold text-primary">Ver todos</Link>
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

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-xl font-bold"><ShoppingCart className="h-5 w-5" /> Compra em andamento</h2>
      <BudgetCard />

      <h2 className="mb-3 mt-8 text-xl font-bold">Acesso rápido</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/lista" className="rounded-3xl bg-card p-5 shadow-soft">
          <ListChecks className="h-7 w-7 text-primary" />
          <p className="mt-3 font-bold">Lista da semana</p>
          <p className="text-sm text-muted-foreground">{pendentes} itens a pegar</p>
        </Link>
        <Link to="/adicionar" className="rounded-3xl bg-accent p-5 text-accent-foreground">
          <Plus className="h-7 w-7" />
          <p className="mt-3 font-bold">Adicionar produto</p>
          <p className="text-sm opacity-80">Na lista e no catálogo</p>
        </Link>
      </div>
      <Button asChild size="lg" className="mt-6 h-14 w-full rounded-2xl text-base">
        <Link to="/lista">Continuar compra <ChevronRight className="h-5 w-5" /></Link>
      </Button>
    </Page>
  );
}
