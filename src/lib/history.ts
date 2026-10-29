export type HistoryItem = { id: string; nome: string; setor: string; qtd: number; preco: number };
export function historyItemTotal(item: Pick<HistoryItem, "qtd" | "preco">) {
  return Math.round((item.qtd * item.preco + Number.EPSILON) * 100) / 100;
}
export function historyTotal(items: HistoryItem[]) {
  return Math.round(items.reduce((sum, item) => sum + historyItemTotal(item), 0) * 100) / 100;
}
export function validateHistoryItems(items: HistoryItem[]) {
  validateHistoryPrecision(items);
  if (!items.length || items.length > 1000)
    throw new Error("A compra deve ter entre 1 e 1000 produtos.");
  if (
    items.some(
      (i) =>
        !i.nome.trim() ||
        i.nome.length > 200 ||
        !Number.isFinite(i.qtd) ||
        i.qtd <= 0 ||
        i.qtd > 999999 ||
        !Number.isFinite(i.preco) ||
        i.preco < 0 ||
        i.preco > 999999,
    )
  )
    throw new Error("Confira nomes, quantidades e preços dos produtos.");
}

export function validateHistoryPrecision(items: HistoryItem[]) {
  if (
    items.some(
      (i) =>
        Math.abs(i.preco * 100 - Math.round(i.preco * 100)) > 0.000001 ||
        Math.abs(i.qtd * 1000 - Math.round(i.qtd * 1000)) > 0.000001,
    )
  )
    throw new Error("Use até 2 casas decimais no preço e 3 na quantidade.");
}
