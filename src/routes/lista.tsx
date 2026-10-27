import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Trash2, Zap } from "lucide-react";
import { Page } from "@/components/AppShell";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { brl, totalItem, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Mercado Fácil" },
      { name: "description", content: "Produtos, quantidades, preços e total da compra." },
      { property: "og:title", content: "Lista de compras — Mercado Fácil" },
      { property: "og:description", content: "Marque produtos como comprados e acompanhe o orçamento." },
    ],
  }),
  component: Lista,
});

function Lista() {
  const { itens, toggleItem, removeItem } = useDemo();
  const total = itens.reduce((s, i) => s + totalItem(i), 0);
  const ordenados = [...itens].sort((a, b) => Number(a.comprado) - Number(b.comprado));

  return (
    <Page title="Lista de compras" subtitle={`${itens.filter((i) => i.comprado).length} de ${itens.length} no carrinho`}>
      <BudgetCard />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-14 rounded-2xl"><Link to="/adicionar"><Plus className="h-5 w-5" /> Adicionar</Link></Button>
        <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl"><Link to="/adicionar" search={{ inesperado: true }}><Zap className="h-5 w-5" /> Item inesperado</Link></Button>
      </div>

      <ul className="mt-6 space-y-3">
        {ordenados.map((i) => (
          <li key={i.id} className={`flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ${i.comprado ? "opacity-60" : ""}`}>
            <button
              onClick={() => toggleItem(i.id)}
              aria-label={i.comprado ? "Desmarcar" : "Marcar como comprado"}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 ${i.comprado ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {i.comprado && <Check className="h-6 w-6" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${i.comprado ? "line-through" : ""}`}>{i.nome}</p>
              <p className="text-xs text-muted-foreground">
                {i.setor}{i.inesperado && " · inesperado"}
              </p>
              <p className="text-sm text-muted-foreground">{i.qtd.toLocaleString("pt-BR")} × {brl(i.preco)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{brl(totalItem(i))}</p>
              <button onClick={() => removeItem(i.id)} aria-label="Remover" className="mt-1 text-muted-foreground"><Trash2 className="ml-auto h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between rounded-3xl bg-foreground p-5 text-background">
        <span className="font-medium">Total da compra</span>
        <span className="font-display text-2xl font-extrabold">{brl(total)}</span>
      </div>
    </Page>
  );
}
