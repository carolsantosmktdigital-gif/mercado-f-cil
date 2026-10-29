import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
const { save } = vi.hoisted(() => ({ save: vi.fn(async () => {}) }));
vi.mock("@/lib/demo-store", () => ({
  useDemo: () => ({ criarLista: save, cartoes: [{ id: "c", nome: "Cartão" }] }),
}));
import { ShoppingListBuilder } from "@/components/ShoppingListBuilder";
afterEach(() => {
  cleanup();
  save.mockClear();
});
it("revisa, ajusta e exclui produtos antes de criar somente a nova lista", async () => {
  render(<ShoppingListBuilder />);
  fireEvent.click(screen.getByRole("button", { name: "Gerar lista automática" }));
  fireEvent.change(screen.getByLabelText("Para quantas pessoas será a compra?"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Crianças"), { target: { value: "1" } });
  expect(screen.getByLabelText("Crianças")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Montar lista sugerida" }));
  expect(screen.getByText("Crianças")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Quantidade de Arroz"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Remover Café" }));
  fireEvent.change(screen.getByLabelText("Cartão"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Orçamento (R$)"), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar minha lista" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const args = save.mock.calls[0] as unknown as any[];
  expect(args[4].find((i: any) => i.nome === "Arroz").qtd).toBe(3);
  expect(args[4].some((i: any) => i.nome === "Café")).toBe(false);
  expect(args[4].find((i: any) => i.nome === "Cereal").setor).toBe("Crianças");
  expect(args[5]).toMatch(/^[a-f0-9-]{36}$/);
});
it("ignores repeated submissions while the first creation is pending", async () => {
  let finish!: () => void;
  save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<ShoppingListBuilder />);
  fireEvent.click(screen.getByRole("button", { name: "Gerar lista automática" }));
  fireEvent.click(screen.getByRole("button", { name: "Montar lista sugerida" }));
  fireEvent.change(screen.getByLabelText("Cartão"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Orçamento (R$)"), { target: { value: "500" } });
  const form = screen.getByRole("button", { name: "Criar minha lista" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(save).toHaveBeenCalledOnce();
  finish();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Criando…" })).not.toBeInTheDocument(),
  );
});
