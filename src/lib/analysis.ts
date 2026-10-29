export type PriceTrend = "alta" | "baixa" | "igual" | "novo" | "ausente" | "sem_preco";
export type PriceComparison = {
  nome: string;
  precoAnterior: number | null;
  precoAtual: number | null;
  diferenca: number | null;
  percentual: number | null;
  situacao: PriceTrend;
};
export type PurchaseAnalysis = {
  id: string;
  lista_anterior_nome: string;
  lista_atual_nome: string;
  data_anterior: string;
  data_atual: string;
  itens: PriceComparison[];
};
export type AnalysisFilter = "todos" | "alta" | "baixa" | "igual" | "sem_comparacao";
export function analysisSummary(items: PriceComparison[]) {
  return {
    alta: items.filter((i) => i.situacao === "alta").length,
    baixa: items.filter((i) => i.situacao === "baixa").length,
    igual: items.filter((i) => i.situacao === "igual").length,
    semComparacao: items.filter((i) => !["alta", "baixa", "igual"].includes(i.situacao)).length,
  };
}
export function filterAnalysis(items: PriceComparison[], filter: AnalysisFilter, search: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  const query = normalize(search);
  return items
    .filter(
      (item) =>
        (filter === "todos" ||
          (filter === "sem_comparacao"
            ? !["alta", "baixa", "igual"].includes(item.situacao)
            : item.situacao === filter)) &&
        normalize(item.nome).includes(query),
    )
    .sort(
      (a, b) =>
        Math.abs(b.percentual ?? 0) - Math.abs(a.percentual ?? 0) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}
export function analysisMonth(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function analysisDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}
// UTC arithmetic avoids daylight-saving changes when counting calendar days.
export function canComparePurchases(previous: string, current: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10) === value ? { year, month, day, date } : null;
  };
  const p = parse(previous),
    c = parse(current);
  if (!p || !c || c.year * 12 + c.month !== p.year * 12 + p.month + 1) return false;
  const lastDay = new Date(Date.UTC(c.year, c.month, 0)).getUTCDate();
  const anniversary = Date.UTC(c.year, c.month - 1, Math.min(p.day, lastDay));
  return Math.abs(c.date.getTime() - anniversary) <= 5 * 24 * 60 * 60 * 1000;
}
