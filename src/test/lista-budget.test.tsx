import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
const { state } = vi.hoisted(() => ({ state: { current: {} as any } }));
vi.mock("@/lib/demo-store", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useDemo: () => state.current,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
import { Route } from "../routes/_authenticated/lista";
afterEach(cleanup);
function setup(spent: number) {
  state.current = {
    itens: [
      { id: "one", nome: "Arroz", qtd: 1, preco: spent, comprado: true, setor: "Mercearia" },
      { id: "two", nome: "Feijão", qtd: 1, preco: 0, comprado: false, setor: "Mercearia" },
      { id: "three", nome: "Macarrão", qtd: 1, preco: 0, comprado: false, setor: "Mercearia" },
    ],
    listas: [{ id: "list", nome: "November", orcamento: 100 }],
    listaId: "list",
    pendingCount: 0,
    online: true,
    updateItem: vi.fn(async () => {}),
    toggleItem: vi.fn(async () => {}),
  };
  return render(createElement(Route.options.component as any));
}
it.each([
  [70, "text-orange-700", "bg-orange-500", "30%"],
  [80, "text-red-700", "bg-red-600", "20%"],
  [110, "text-red-700", "bg-red-600", "20%"],
])("shows matching balance/bar alert at spending %s", (spent, textColor, barColor, label) => {
  const ui = setup(Number(spent));
  expect(screen.getByText(/Restante:/)).toHaveClass(String(textColor));
  expect(ui.container.querySelector("." + barColor)).toBeTruthy();
  expect(screen.getByRole("status")).toHaveTextContent(String(label));
});
it("retains the same product DOM position when edited data arrives in a different order", async () => {
  const ui = setup(0);
  const field = screen.getByLabelText("Preço de Feijão");
  fireEvent.change(field, { target: { value: "8,50" } });
  fireEvent.blur(field);
  expect(state.current.updateItem).toHaveBeenCalledWith("two", { preco: 8.5 });
  state.current = {
    ...state.current,
    itens: [
      state.current.itens[2],
      { ...state.current.itens[1], preco: 8.5 },
      state.current.itens[0],
    ],
  };
  ui.rerender(createElement(Route.options.component as any));
  await waitFor(() =>
    expect(screen.getAllByTitle(/Editar setor de/).map((node) => node.textContent)).toEqual([
      "Feijão",
      "Macarrão",
    ]),
  );
  expect(screen.getByLabelText("Preço de Feijão")).toBe(field);
});
