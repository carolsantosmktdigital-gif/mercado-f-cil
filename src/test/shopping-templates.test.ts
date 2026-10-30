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
it("sugere somente quantidades inteiras para todos os períodos e famílias", () => {
  for (const dias of [7, 15, 30])
    for (const criancas of [0, 1, 3]) {
      const list = generateShoppingList({ ...base, dias, criancas, total: 2 + criancas });
      expect(list.every((item) => Number.isInteger(item.qtd) && item.qtd >= 1)).toBe(true);
    }
});

it("ajusta a lista de alimentos pela quantidade de refeições por dia, sem inflar limpeza", () => {
  const fourMeals = generateShoppingList({ ...base, refeicoesPorDia: 4 });
  const twoMeals = generateShoppingList({ ...base, refeicoesPorDia: 2 });
  expect(fourMeals.find((i) => i.nome === "Arroz")?.qtd).toBe(5);
  expect(twoMeals.find((i) => i.nome === "Arroz")?.qtd).toBe(3);
  expect(twoMeals.find((i) => i.nome === "Detergente")?.qtd).toBe(2);
});

it("usa a seleção de refeições como padrão, respeita repetições e valida limites", () => {
  const breakfastOnly = { ...base, refeicoes: ["Café da manhã"] as (typeof MEALS)[number][] };
  expect(generateShoppingList(breakfastOnly).find((i) => i.nome === "Café")?.qtd).toBe(2);
  expect(
    generateShoppingList({ ...breakfastOnly, refeicoesPorDia: 2 }).find((i) => i.nome === "Café")
      ?.qtd,
  ).toBe(4);
  expect(() => generateShoppingList({ ...base, refeicoesPorDia: 0 })).toThrow();
  expect(() => generateShoppingList({ ...base, refeicoesPorDia: 7 })).toThrow();
});
