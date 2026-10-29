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
