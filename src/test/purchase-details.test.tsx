import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, it, expect, vi } from "vitest";
const { historyState } = vi.hoisted(() => ({ historyState: { current: {} as any } }));
vi.mock("@/lib/demo-store", async (original) => ({
  ...(await original<any>()),
  useDemo: () => historyState.current,
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<any>()),
  useNavigate: () => vi.fn(),
}));
import { Route as HistoryRoute } from "../routes/_authenticated/historico";
import { PurchaseDetails } from "../components/PurchaseDetails";
import type { Compra } from "../lib/demo-store";
const purchase: Compra = {
  id: "p",
  data: "2026-10-29",
  cartao: "Card",
  listaNome: "Compra Outubro",
  cartaoId: "c",
  total: 70,
  itens: 1,
  revisao: 0,
  produtos: [{ id: "i", nome: "Arroz", setor: "Mercearia", qtd: 2, preco: 35 }],
};
afterEach(cleanup);
it("shows purchased items, opens editing and submits decimal prices for that receipt", async () => {
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={purchase} onClose={() => {}} onSave={save} />);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Editar Arroz" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar Arroz" }));
  fireEvent.change(screen.getByLabelText("Preço do produto 1"), { target: { value: "30,50" } });
  expect(screen.getByText(/a devolver ao cartão/)).toHaveTextContent("9,00");
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(purchase, [
      expect.objectContaining({ nome: "Arroz", qtd: 2, preco: 30.5 }),
    ]),
  );
});
it("cancel leaves saved receipt and balance untouched", () => {
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={purchase} onClose={() => {}} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Arroz" }));
  fireEvent.change(screen.getByLabelText("Preço do produto 1"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText(/35,00/)).toBeInTheDocument();
});
it("does not save invalid prices and immediately recalculates after deleting the last item", async () => {
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={purchase} onClose={() => {}} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar Arroz" }));
  fireEvent.change(screen.getByLabelText("Preço do produto 1"), { target: { value: "-1" } });
  expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Excluir Arroz" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(purchase, []));
  expect(screen.getByText("Nenhum item nesta compra.")).toBeInTheDocument();
  expect(screen.getByText(/0,00/)).toBeInTheDocument();
});

it("can add a missing purchased item without editing another receipt", async () => {
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={purchase} onClose={() => {}} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar produto comprado" }));
  fireEvent.change(screen.getByLabelText("Nome do produto 2"), { target: { value: "Feijão" } });
  fireEvent.change(screen.getByLabelText("Preço do produto 2"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      purchase,
      expect.arrayContaining([expect.objectContaining({ nome: "Feijão", preco: 5 })]),
    ),
  );
});

it("opens the items of the exact purchase selected in history", () => {
  historyState.current = {
    cartoes: [],
    duplicarLista: vi.fn(),
    online: true,
    pendingCount: 0,
    syncError: "",
    editarCompra: vi.fn(async () => {}),
    historico: [
      purchase,
      {
        ...purchase,
        id: "other",
        listaId: "other-list",
        listaNome: "Outra compra",
        produtos: [{ id: "beans", nome: "Feijão", setor: "Mercearia", qtd: 1, preco: 5 }],
      },
    ],
  };
  render(createElement(HistoryRoute.options.component as any));
  fireEvent.click(screen.getByRole("button", { name: "Ver itens de Compra Outubro" }));
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Compra Outubro");
  expect(screen.getByRole("button", { name: "Editar Arroz" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar Feijão" })).not.toBeInTheDocument();
});

it("edits only the chosen row and preserves other products", async () => {
  const other = { id: "beans", nome: "Feijão", setor: "Mercearia", qtd: 1, preco: 5 };
  const compra = { ...purchase, total: 75, itens: 2, produtos: [...purchase.produtos!, other] };
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={compra} onClose={() => {}} onSave={save} />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar Feijão" }));
  expect(screen.queryByLabelText("Nome do produto 1")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Preço do produto 2"), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(compra, [purchase.produtos![0], { ...other, preco: 6 }]),
  );
  expect(screen.getByRole("button", { name: "Editar Arroz" })).toBeInTheDocument();
});

it.each(["same-id", undefined])(
  "opens exactly one editor even if stored item IDs are repeated or missing (%s)",
  async (id) => {
    const a = { ...purchase.produtos![0]!, id } as any;
    const b = { ...a, nome: "Feijão", preco: 5, qtd: 1 };
    const receipt = { ...purchase, produtos: [a, b], total: 75, itens: 2 };
    const save = vi.fn(async () => {});
    render(<PurchaseDetails compra={receipt} onClose={() => {}} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Feijão" }));
    expect(screen.queryByLabelText("Nome do produto 1")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Preço do produto 2"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(receipt, [a, { ...b, preco: 7 }]));
    expect(screen.getByText(/77,00/)).toBeInTheDocument();
  },
);
it("deletes only the chosen product directly from the list and changes the purchase total", async () => {
  const other = { id: "b", nome: "Feijão", setor: "Mercearia", qtd: 1, preco: 5 };
  const receipt = { ...purchase, produtos: [...purchase.produtos!, other], total: 75, itens: 2 };
  const save = vi.fn(async () => {});
  render(<PurchaseDetails compra={receipt} onClose={() => {}} onSave={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Excluir Feijão" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(receipt, purchase.produtos));
  expect(screen.getByRole("button", { name: "Editar Arroz" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar Feijão" })).not.toBeInTheDocument();
  expect(screen.getByText("Total da compra").parentElement).toHaveTextContent("70,00");
});
