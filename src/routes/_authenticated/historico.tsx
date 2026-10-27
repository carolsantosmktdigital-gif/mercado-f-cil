import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CreditCard } from "lucide-react";
import { Page, DemoBadge } from "@/components/AppShell";
import { brl, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Mercado Fácil" },
      { name: "description", content: "Compras anteriores com data, cartão e total gasto." },
      { property: "og:title", content: "Histórico — Mercado Fácil" },
      { property: "og:description", content: "Acompanhe suas compras anteriores." },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { historico } = useDemo();
  const total = historico.reduce((s, h) => s + h.total, 0);
  return (
    <Page title="Histórico" subtitle="Compras anteriores">
      <DemoBadge />
      <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft">
        <p className="text-sm opacity-80">Total gasto nas últimas {historico.length} compras</p>
        <p className="font-display text-3xl font-extrabold">{brl(total)}</p>
      </div>
      <ul className="mt-6 space-y-3">
        {historico.map((h) => (
          <li key={h.id} className="rounded-3xl bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <CalendarDays className="h-5 w-5 text-primary" />
                {new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              <span className="font-display text-xl font-extrabold">{brl(h.total)}</span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" /> {h.cartao} · {h.itens} itens
            </p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
