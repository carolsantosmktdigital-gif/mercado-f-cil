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
it("preserves an active draft during peer updates and sends the original field baseline", () => {
  const ui = setup(0);
  const field = screen.getByLabelText("Preço de Feijão");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: "8,50" } });
  state.current = {
    ...state.current,
    itens: state.current.itens.map((i: any) => (i.id === "two" ? { ...i, preco: 9 } : i)),
  };
  ui.rerender(createElement(Route.options.component as any));
  expect(screen.getByLabelText("Preço de Feijão")).toHaveValue("8,50");
  fireEvent.blur(field);
  expect(state.current.updateItem).toHaveBeenCalledWith("two", { preco: 8.5 }, { preco: 0 });
});
it("offers automatic generation and opens manual creation inside the List tab", async () => {
  const ui = setup(0);
  state.current = {
    ...state.current,
    itens: [],
    listas: [],
    listaId: "",
    cartoes: [{ id: "c", nome: "Cartão", saldo: 400 }],
    criarLista: vi.fn(async () => {}),
  };
  ui.rerender(createElement(Route.options.component as any));
  expect(screen.getByRole("button", { name: "Gerar lista automática" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar lista de compras" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Cadastrar lista de compras");
  fireEvent.change(screen.getByLabelText("Nome da lista"), {
    target: { value: "Compra da semana" },
  });
  fireEvent.change(screen.getByLabelText("Cartão"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Orçamento da compra (R$)"), {
    target: { value: "200,50" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Criar lista" }));
  await waitFor(() =>
    expect(state.current.criarLista).toHaveBeenCalledWith(
      "Compra da semana",
      "c",
      200.5,
      0,
      undefined,
      expect.any(String),
    ),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Lista de compras" })).toBeInTheDocument();
});
it("shows the top list selector only with multiple active lists and switches selection", () => {
  const ui = setup(0);
  expect(
    screen.queryByRole("region", { name: "Alternar lista de compras" }),
  ).not.toBeInTheDocument();
  const selecionarLista = vi.fn();
  state.current = {
    ...state.current,
    selecionarLista,
    listas: [
      { id: "list", nome: "November", orcamento: 100 },
      { id: "second", nome: "Semana", orcamento: 60 },
    ],
  };
  ui.rerender(createElement(Route.options.component as any));
  const selector = screen.getByRole("region", { name: "Alternar lista de compras" });
  expect(selector).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "November" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Semana" }));
  expect(selecionarLista).toHaveBeenCalledWith("second");
  state.current = { ...state.current, listaId: "second" };
  ui.rerender(createElement(Route.options.component as any));
  expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "November" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
