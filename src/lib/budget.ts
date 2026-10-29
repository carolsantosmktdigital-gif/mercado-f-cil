export function budgetState(budget: number, spent: number) {
  const remaining = Math.round((budget - spent) * 100) / 100;
  const level: "normal" | "warning" | "danger" =
    budget > 0 && remaining <= budget * 0.2
      ? "danger"
      : budget > 0 && remaining <= budget * 0.3
        ? "warning"
        : "normal";
  return {
    remaining,
    percent: budget > 0 ? Math.max(0, Math.min(100, (remaining / budget) * 100)) : 0,
    level,
  };
}
