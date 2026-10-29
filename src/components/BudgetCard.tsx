import { BudgetEditor } from "@/components/BudgetEditor";
import { budgetState } from "@/lib/budget";
import { BudgetAlert } from "@/components/BudgetAlert";
import { brl, totalItem, useDemo } from "@/lib/demo-store";

export function BudgetCard() {
  const { itens, orcamento, cartoes, cartaoCompraId } = useDemo();
  const gasto = itens.filter((i) => i.comprado).reduce((s, i) => s + totalItem(i), 0);
  const restante = orcamento - gasto;
  const { percent: pct, level } = budgetState(orcamento, gasto);

  const cartao = cartoes.find((c) => c.id === cartaoCompraId);

  return (
    <section
      className={
        "rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft " +
        (level !== "normal" ? `budget-panel-${level}` : "")
      }
    >
      <div className="mb-4 border-b border-primary-foreground/20 pb-4">
        <p className="text-sm opacity-80">
          Saldo disponível do cartão · {cartao?.nome || "Não vinculado"}
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold">
          {cartao ? brl(cartao.saldo) : "—"}
        </p>
      </div>
      <p className="text-sm opacity-80">Restante do orçamento desta lista</p>
      <p className="mt-1 rounded-xl p-1 font-display text-4xl font-extrabold">
        {orcamento > 0 ? brl(restante) : "A definir"}
      </p>
      {orcamento > 0 ? (
        <>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-primary-foreground/20">
            <div
              className={
                "h-full rounded-full " +
                (level === "danger"
                  ? "bg-red-500"
                  : level === "warning"
                    ? "bg-orange-400"
                    : "bg-primary-foreground")
              }
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm opacity-90">
            <span>Gasto {brl(gasto)}</span>
            <span>Orçamento {brl(orcamento)}</span>
          </div>
          <div className="mt-4 min-h-12">
            {level !== "normal" ? (
              <BudgetAlert level={level} remaining={restante} budget={orcamento} />
            ) : (
              <div className="rounded-2xl border border-dashed border-primary-foreground/30 px-3 py-3 text-sm opacity-70">
                Avisaremos aqui quando restar 30% do orçamento.
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm">
          Esta lista ainda não tem orçamento definido. O saldo do cartão continua disponível.
        </p>
      )}
      <div className="mt-4 text-foreground">
        <BudgetEditor />
      </div>
    </section>
  );
}
