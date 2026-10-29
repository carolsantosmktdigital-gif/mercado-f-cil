import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { createElement } from "react";
const { save, navigate } = vi.hoisted(() => ({ save: vi.fn(async () => {}), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<any>()),
  createFileRoute: () => (options: any) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock("@/lib/demo-store", () => ({
  useDemo: () => ({
    addItem: save,
    catalogo: [],
    categorias: ["Mercearia"],
    criarCategoria: vi.fn(),
    online: true,
    pendingCount: 0,
    syncError: "",
  }),
  brl: (value: number) => String(value),
}));
import { Route } from "@/routes/_authenticated/adicionar";
afterEach(() => {
  cleanup();
  save.mockReset();
  navigate.mockReset();
});
function open() {
  render(createElement(Route.options.component as any));
  fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Arroz" } });
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Preço unitário (R$)"), { target: { value: "8,50" } });
}
it("saves and resets the form to register another item without leaving the page", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Salvar e cadastrar outro" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      nome: "Arroz",
      setor: "Mercearia",
      qtd: 2,
      preco: 8.5,
      inesperado: false,
    }),
  );
  await waitFor(() => expect(screen.getByLabelText("Nome do produto")).toHaveValue(""));
  expect(screen.getByLabelText("Quantidade")).toHaveValue("1");
  expect(screen.getByLabelText("Preço unitário (R$)")).toHaveValue("");
  expect(screen.getByLabelText("Nome do produto")).toHaveFocus();
  expect(navigate).not.toHaveBeenCalled();
});
it("saves and returns to the current list using the right-hand action", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Salvar item na lista" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/lista" }));
  expect(save).toHaveBeenCalledOnce();
});
it("preserves the product information if saving fails", async () => {
  save.mockRejectedValueOnce(new Error("Storage unavailable"));
  open();
  fireEvent.click(screen.getByRole("button", { name: "Salvar e cadastrar outro" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("Nome do produto")).toHaveValue("Arroz");
  expect(navigate).not.toHaveBeenCalled();
});
