import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { categoryName, migrateCategoryCache, validateCategory } from "../lib/categories";
const { state } = vi.hoisted(() => ({
  state: {
    categorias: ["Mercearia", "Crianças"],
    criarCategoria: vi.fn(async (nome: string) => nome.trim()),
  },
}));
vi.mock("@/lib/demo-store", async (original) => ({
  ...(await original<any>()),
  useDemo: () => state,
}));
import { CategoryField } from "../components/CategoryField";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("renames only category fields in saved data and pending writes", () => {
  const data = {
    cache: [{ nome: "Biscoitos Lavínia", setor: "Lavínia" }],
    pending: [{ values: { setor: "Lavinia" } }],
  };
  expect(migrateCategoryCache(data)).toEqual({
    cache: [{ nome: "Biscoitos Lavínia", setor: "Crianças" }],
    pending: [{ values: { setor: "Crianças" } }],
  });
  expect(categoryName("  Pets  ")).toBe("Pets");
  expect(() => validateCategory(" ")).toThrow();
});
it("creates and selects a new category without submitting the product form", async () => {
  const change = vi.fn(),
    submit = vi.fn((e) => e.preventDefault());
  render(
    <form onSubmit={submit}>
      <CategoryField value="Mercearia" onChange={change} />
    </form>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
  fireEvent.change(screen.getByLabelText("Nome da nova categoria"), { target: { value: "Pets" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar categoria" }));
  await waitFor(() => expect(change).toHaveBeenCalledWith("Pets"));
  expect(state.criarCategoria).toHaveBeenCalledWith("Pets");
  expect(submit).not.toHaveBeenCalled();
});
