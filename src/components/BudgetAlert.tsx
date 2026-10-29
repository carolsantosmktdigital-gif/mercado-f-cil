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
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {level === "danger" ? "Orçamento no limite!" : "Atenção ao orçamento!"}
        </p>
        <p className="mt-1 font-bold tabular-nums">{amount}</p>
        <p className="mt-1 font-medium">Você tem {percentage}% do orçamento disponível.</p>
        <p className="mt-2 font-normal">
          Atenção: resta {level === "danger" ? "20%" : "30%"} ou menos do orçamento.
        </p>
      </div>
    </div>
  );
}
