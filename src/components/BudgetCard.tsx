import { AlertTriangle } from "lucide-react";
import { brl, orcamentoEmAlerta, totalItem, useDemo } from "@/lib/demo-store";

export function BudgetCard() {
  const { itens, orcamento, cartoes, cartaoCompraId } = useDemo();
  const gasto = itens.filter((i) => i.comprado).reduce((s, i) => s + totalItem(i), 0);
  const restante = orcamento - gasto;
  const pct = Math.max(0, Math.min(100, (restante / orcamento) * 100));
  const alerta = orcamentoEmAlerta(orcamento, gasto);
  const cartao = cartoes.find((c) => c.id === cartaoCompraId);

  return (
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft">
      <p className="text-sm opacity-80">Saldo do orçamento · {cartao?.nome}</p>
      <p className="mt-1 font-display text-4xl font-extrabold">{brl(restante)}</p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-primary-foreground/20">
        <div className="h-full rounded-full bg-primary-foreground" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm opacity-90">
        <span>Gasto {brl(gasto)}</span>
        <span>Orçamento {brl(orcamento)}</span>
      </div>
      {/* Espaço reservado para o alerta de 20% */}
      <div className="mt-4 min-h-12">
        {alerta ? (
          <div className="flex items-center gap-2 rounded-2xl bg-warning px-3 py-3 text-sm font-semibold text-warning-foreground">
            <AlertTriangle className="h-5 w-5" /> Atenção: resta 20% ou menos do orçamento.
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary-foreground/30 px-3 py-3 text-sm opacity-70">
            Avisaremos aqui quando restar 20% do orçamento.
          </div>
        )}
      </div>
    </section>
  );
}
