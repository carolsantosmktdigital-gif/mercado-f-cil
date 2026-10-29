import { AlertTriangle } from "lucide-react";

export function BudgetAlert({
  level,
  remaining,
  budget,
}: {
  level: "warning" | "danger";
  remaining: number;
  budget: number;
}) {
  const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    budget > 0 ? Math.max(0, (remaining / budget) * 100) : 0,
  );
  const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    remaining,
  );
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`budget-alert budget-alert-${level}`}
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-7 w-7 shrink-0" strokeWidth={2.5} />
      <div>
        <p className="text-base font-extrabold">
          {level === "danger" ? "Orçamento no limite!" : "Atenção ao orçamento!"}
        </p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">{amount}</p>
        <p className="mt-1 text-base font-bold">Você tem {percentage}% do orçamento disponível.</p>
        <p className="mt-2 text-sm font-semibold">
          Atenção: resta {level === "danger" ? "20%" : "30%"} ou menos do orçamento.
        </p>
      </div>
    </div>
  );
}
