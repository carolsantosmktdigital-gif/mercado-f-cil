import { it, expect } from "vitest";
import { historyTotal, validateHistoryItems } from "../lib/history";
const item = { id: "i", nome: "Arroz", setor: "Mercearia", qtd: 1.005, preco: 5.99 };
it("keeps the same precision used by the saved receipt", () => {
  expect(() => validateHistoryItems([item])).not.toThrow();
  expect(historyTotal([item])).toBe(6.02);
});
it("rejects excess decimal places instead of silently changing the card debit", () => {
  expect(() => validateHistoryItems([{ ...item, preco: 1.999 }])).toThrow("2 casas");
  expect(() => validateHistoryItems([{ ...item, qtd: 1.0001 }])).toThrow("3 na quantidade");
});
