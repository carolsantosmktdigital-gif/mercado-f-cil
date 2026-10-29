import { describe, it, expect } from "vitest";
import {
  analysisSummary,
  filterAnalysis,
  analysisMonth,
  analysisDate,
  canComparePurchases,
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

describe("purchase date comparison window", () => {
  it.each([
    ["2026-10-10", "2026-11-05", true],
    ["2026-10-10", "2026-11-15", true],
    ["2026-10-10", "2026-11-04", false],
    ["2026-10-10", "2026-11-16", false],
    ["2026-10-10", "2026-10-15", false],
    ["2026-10-10", "2026-12-10", false],
    ["2026-01-31", "2026-02-23", true],
    ["2026-01-31", "2026-02-22", false],
    ["2024-01-31", "2024-02-24", true],
    ["2024-01-31", "2024-02-23", false],
    ["2026-12-31", "2027-01-26", true],
    ["2026-12-31", "2027-01-25", false],
    ["2026-02-28", "2026-03-31", true],
    ["2026-10-10", "invalid", false],
  ])("compares %s with %s: %s", (previous, current, allowed) =>
    expect(canComparePurchases(previous, current)).toBe(allowed),
  );
  it("shows the actual recorded day without shifting to the previous day", () =>
    expect(analysisDate("2026-10-29")).toBe("29/10/2026"));
});
