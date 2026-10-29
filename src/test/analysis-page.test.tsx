import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const { state } = vi.hoisted(() => ({ state: { current: {} as any } }));
vi.mock("@/lib/demo-store", async (original) => ({
  ...(await original<any>()),
  useDemo: () => state.current,
}));
import { Route } from "../routes/_authenticated/analise";
beforeEach(() => {
  state.current = {
    online: true,
    pendingCount: 0,
    syncError: "",
    analises: [],
    analisesLoading: false,
    analisesError: false,
  };
});
afterEach(cleanup);
const renderPage = () => render(createElement(Route.options.component as any));
it("explains the previous-month rule without fabricating a comparison", () => {
  renderPage();
  expect(screen.getByText("Aguardando o próximo mês")).toBeInTheDocument();
  expect(screen.getByText(/Sem compra no mês anterior/)).toHaveTextContent(
    "não há comparação com meses mais antigos",
  );
  expect(screen.queryByLabelText("Análises registradas")).not.toBeInTheDocument();
});
it("renders saved unit prices and filters higher and lower prices", () => {
  state.current.analises = [
    {
      id: "a1",
      lista_atual_nome: "Novembro",
      lista_anterior_nome: "Outubro",
      data_atual: "2026-11-20",
      data_anterior: "2026-10-18",
      itens: [
        {
          nome: "Arroz",
          precoAnterior: 10,
          precoAtual: 12,
          diferenca: 2,
          percentual: 20,
          situacao: "alta",
        },
        {
          nome: "Café",
          precoAnterior: 20,
          precoAtual: 15,
          diferenca: -5,
          percentual: -25,
          situacao: "baixa",
        },
        {
          nome: "Sal",
          precoAnterior: 2,
          precoAtual: 2,
          diferenca: 0,
          percentual: 0,
          situacao: "igual",
        },
      ],
    },
  ];
  renderPage();
  expect(
    screen.getByRole("heading", { name: /novembro de 2026 × outubro de 2026/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/20%/)).toHaveClass("text-red-700");
  expect(screen.getByText(/25%/)).toHaveClass("text-emerald-800");
  fireEvent.click(screen.getByRole("button", { name: "Mais baixos" }));
  expect(screen.getByRole("heading", { name: "Café" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Arroz" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sem mudança" }));
  expect(screen.getByRole("heading", { name: "Sal" })).toBeInTheDocument();
});
it("gives a useful offline first-load state", () => {
  state.current.online = false;
  state.current.analisesLoading = true;
  renderPage();
  expect(
    screen.getByText("Conecte-se para carregar suas análises pela primeira vez."),
  ).toBeInTheDocument();
});
