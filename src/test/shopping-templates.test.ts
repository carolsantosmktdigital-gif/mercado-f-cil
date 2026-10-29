import { describe, it, expect } from "vitest";
import { generateShoppingList, MEALS } from "@/lib/shopping-templates";
const base = { total: 2, adultos: 2, criancas: 0, dias: 30, refeicoes: [...MEALS] };
describe("listas personalizadas", () => {
  it("inclui a base completa do casal, sem crianças ou bebê", () => {
    const list = generateShoppingList(base);
    expect(new Set(list.map((i) => i.setor)).size).toBe(7);
    expect(list.some((i) => i.setor === "Crianças")).toBe(false);
    expect(list.find((i) => i.nome === "Arroz")?.qtd).toBe(5);
  });
  it("adiciona cereal, biscoitos e higiene infantil somente em Crianças", () => {
    const list = generateShoppingList({ ...base, total: 3, criancas: 1 });
    for (const nome of ["Cereal", "Biscoitos", "Shampoo infantil"])
      expect(list.find((i) => i.nome === nome)?.setor).toBe("Crianças");
    expect(list.some((i) => i.nome === "Fraldas")).toBe(false);
  });
  it("ajusta alimentos por refeições e mantém higiene e limpeza", () => {
    const list = generateShoppingList({ ...base, refeicoes: ["Café da manhã"] });
    expect(list.some((i) => i.nome === "Arroz")).toBe(false);
    expect(list.some((i) => i.nome === "Café")).toBe(true);
    expect(list.find((i) => i.nome === "Detergente")?.qtd).toBe(2);
  });
  it("ajusta período e tamanho da família", () => {
    expect(
      generateShoppingList({ ...base, dias: 7 }).find((i) => i.nome === "Arroz")!.qtd,
    ).toBeLessThan(5);
    expect(
      generateShoppingList({ ...base, total: 4, adultos: 4 }).find((i) => i.nome === "Arroz")!.qtd,
    ).toBe(10);
  });
  it("rejeita pessoas inconsistentes e refeições vazias", () => {
    expect(() => generateShoppingList({ ...base, total: 3 })).toThrow();
    expect(() => generateShoppingList({ ...base, refeicoes: [] })).toThrow();
  });
});
