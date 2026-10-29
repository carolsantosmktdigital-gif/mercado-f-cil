import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
const { save, navigate } = vi.hoisted(() => ({ save: vi.fn(async () => {}), navigate: vi.fn() }));
vi.mock("@/lib/demo-store", () => ({
  useDemo: () => ({ duplicarLista: save, cartoes: [{ id: "c", nome: "Meu cartão", saldo: 500 }] }),
  brl: (v: number) => String(v),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
import { DuplicateListButton } from "@/components/DuplicateListButton";
afterEach(() => {
  cleanup();
  save.mockReset();
  navigate.mockReset();
});
it("abre com nome, cartão e orçamento e cria cópia independente", async () => {
  render(<DuplicateListButton origem="l" nome="Minha lista" cartaoId="c" orcamento={200} />);
  fireEvent.click(screen.getByRole("button", { name: "Duplicar Minha lista" }));
  expect(screen.getByLabelText("Nome da nova lista")).toHaveValue("Minha lista (cópia)");
  expect(screen.getByLabelText("Cartão da nova compra")).toHaveValue("c");
  fireEvent.change(screen.getByLabelText("Nome da nova lista"), { target: { value: "Dezembro" } });
  fireEvent.click(screen.getByRole("button", { name: "Criar cópia" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "l",
      "Dezembro",
      "c",
      200,
      expect.stringMatching(/^[a-f0-9-]{36}$/),
      false,
    ),
  );
  expect(navigate).toHaveBeenCalledWith({ to: "/lista" });
});
it("mantém o formulário e o mesmo identificador ao repetir após erro", async () => {
  save.mockRejectedValueOnce(new Error("Sem conexão"));
  render(<DuplicateListButton origem="p" nome="Compra" historico />);
  fireEvent.click(screen.getByRole("button", { name: "Duplicar Compra" }));
  fireEvent.change(screen.getByLabelText("Cartão da nova compra"), { target: { value: "c" } });
  fireEvent.change(screen.getByLabelText("Orçamento da nova compra (R$)"), {
    target: { value: "150,50" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Criar cópia" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Criar cópia" })).toBeEnabled());
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Criar cópia" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(save.mock.calls[1]).toEqual(["p", "Compra (cópia)", "c", 150.5, expect.any(String), true]);
});
