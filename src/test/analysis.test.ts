import { describe, it, expect } from "vitest";
import {
  analysisSummary,
  filterAnalysis,
  analysisMonth,
  type PriceComparison,
} from "../lib/analysis";
const items: PriceComparison[] = [
  {
    nome: "Café",
    precoAnterior: 20,
    precoAtual: 15,
    diferenca: -5,
    percentual: -25,
    situacao: "baixa",
  },
  {
    nome: "Arroz",
    precoAnterior: 10,
    precoAtual: 12,
    diferenca: 2,
    percentual: 20,
    situacao: "alta",
  },
  { nome: "Sal", precoAnterior: 2, precoAtual: 2, diferenca: 0, percentual: 0, situacao: "igual" },
  {
    nome: "Novo produto",
    precoAnterior: null,
    precoAtual: 5,
    diferenca: null,
    percentual: null,
    situacao: "novo",
  },
];
describe("analysis display", () => {
  it("counts high, low, unchanged and unmatched products separately", () =>
    expect(analysisSummary(items)).toEqual({ alta: 1, baixa: 1, igual: 1, semComparacao: 1 }));
  it("filters lower prices and searches without accent sensitivity", () =>
    expect(filterAnalysis(items, "baixa", "cafe").map((i) => i.nome)).toEqual(["Café"]));
  it("keeps missing prices out of percentage trends", () =>
    expect(filterAnalysis(items, "sem_comparacao", "")[0]?.percentual).toBeNull());
  it("orders largest changes first without changing the saved snapshot", () => {
    const copy = JSON.stringify(items);
    expect(filterAnalysis(items, "todos", "")[0]?.nome).toBe("Café");
    expect(JSON.stringify(items)).toBe(copy);
  });
  it("labels calendar months and years", () =>
    expect(analysisMonth("2026-11-01")).toContain("novembro"));
});
