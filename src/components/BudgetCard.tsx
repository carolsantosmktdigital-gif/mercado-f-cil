import { BudgetEditor } from "@/components/BudgetEditor";
import { budgetState } from "@/lib/budget";
import { BudgetAlert } from "@/components/BudgetAlert";
import { brl, totalItem, useDemo } from "@/lib/demo-store";

export function BudgetCard() {
  const { itens, orcamento, cartoes, cartaoCompraId } = useDemo();
  const gasto = itens.filter((i) => i.comprado).reduce((s, i) => s + totalItem(i), 0);
  const { remaining, percent, level } = budgetState(orcamento, gasto);
  const cartao = cartoes.find((c) => c.id === cartaoCompraId);
  const barClass =
    level === "danger" ? "bg-red-600" : level === "warning" ? "bg-orange-500" : "bg-emerald-800";

  return (
    <section
      className={
        "rounded-3xl bg-emerald-50 px-5 py-4 text-emerald-950 shadow-soft " +
        (level !== "normal" ? `budget-panel-${level}` : "")
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Orçamento: {orcamento > 0 ? brl(orcamento) : "A definir"}
        </p>
        <BudgetEditor />
      </div>
      <p className="mt-2 text-xs">
        Saldo disponível do cartão:{" "}
        <strong>{cartao ? brl(cartao.saldo) : "Cartão não vinculado"}</strong>
      </p>
      {orcamento > 0 ? (
        <>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-100">
            <div
              className={"h-full rounded-full transition-colors " + barClass}
              style={{ width: `${100 - percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              Gasto: <strong>{brl(gasto)}</strong>
            </span>
            <span>
              Restante: <strong>{brl(remaining)}</strong>
            </span>
          </div>
          {level !== "normal" && (
            <div className="mt-4">
              <BudgetAlert level={level} remaining={remaining} budget={orcamento} />
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm">
          Esta lista ainda não tem orçamento definido. O saldo do cartão continua disponível.
        </p>
      )}
      <p className="mt-3 border-t border-current/20 pt-3 text-xs leading-relaxed">
        O valor do item só entra no cálculo do orçamento quando você toca no ícone do carrinho.
      </p>
    </section>
  );
}
