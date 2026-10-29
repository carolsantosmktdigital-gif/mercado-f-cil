import { DuplicateListButton } from "@/components/DuplicateListButton";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PurchaseDetails } from "@/components/PurchaseDetails";
import { CalendarDays, CreditCard, ChevronRight } from "lucide-react";
import { Page } from "@/components/AppShell";
import { brl, useDemo, type Compra } from "@/lib/demo-store";

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
  const { historico, editarCompra } = useDemo();
  const [selected, setSelected] = useState<Compra | null>(null);
  const current = selected
    ? historico.find(
        (h) => h.id === selected.id || (selected.listaId && h.listaId === selected.listaId),
      ) || selected
    : null;
  const total = historico.reduce((s, h) => s + h.total, 0);
  return (
    <Page title="Histórico" subtitle="Compras anteriores">
      <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft">
        <p className="text-sm opacity-80">Total gasto nas últimas {historico.length} compras</p>
        <p className="font-display text-3xl font-extrabold">{brl(total)}</p>
      </div>
      {historico.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">Nenhuma compra finalizada ainda.</p>
      )}
      <ul className="mt-6 space-y-3">
        {historico.map((h) => (
          <li key={h.id} className="rounded-3xl bg-card shadow-soft">
            <button
              type="button"
              aria-label={
                "Ver itens de " +
                (h.listaNome ||
                  "compra de " + new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR"))
              }
              className="w-full rounded-3xl p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => setSelected(h)}
            >
              {h.listaNome && <p className="mb-2 break-words text-base font-bold">{h.listaNome}</p>}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {new Date(h.data + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="font-display text-xl font-extrabold">{brl(h.total)}</span>
              </div>
              {h.pendente && (
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  Saldo atualizado · Aguardando sincronização
                </p>
              )}
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" /> {h.cartao} · {h.itens} itens
              </p>
              <span className="mt-3 flex items-center justify-between text-sm font-semibold text-primary">
                Ver ou editar itens
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
            <div className="px-5 pb-5">
              <DuplicateListButton
                origem={h.listaId || h.id}
                nome={h.listaNome || "Compra anterior"}
                cartaoId={h.cartaoId}
                historico
              />
            </div>
          </li>
        ))}
      </ul>
      {current && (
        <PurchaseDetails compra={current} onClose={() => setSelected(null)} onSave={editarCompra} />
      )}
    </Page>
  );
}
