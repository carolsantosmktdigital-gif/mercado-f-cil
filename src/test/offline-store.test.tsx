import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider, totalItem, useDemo } from "../lib/demo-store";
import { cached, readLocal, saveCache } from "../lib/offline";
import type { ReactNode } from "react";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => {
      throw Error("No network in this test");
    }),
  },
}));
const family = { id: "f1", nome: "Family", codigo: "123" };
let client: QueryClient;
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  onlineManager.setOnline(false);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  saveCache("f1", ["cartoes", "f1"], [{ id: "c1", nome: "Card", saldo: 100, cor: "verde" }]);
  saveCache(
    "f1",
    ["listas", "f1"],
    [
      {
        id: "l1",
        nome: "November",
        cartao_id: "c1",
        orcamento: 100,
        valor_reservado: 0,
        status: "em_andamento",
        tipo: "normal",
      },
    ],
  );
  saveCache(
    "f1",
    ["itens", "f1", "l1"],
    [
      { id: "rice", nome: "Arroz", setor: "Mercearia", qtd: 2, preco: 0, comprado: false },
      { id: "beans", nome: "Feijão", setor: "Mercearia", qtd: 1, preco: 0, comprado: false },
    ],
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <StoreProvider familia={family}>{children}</StoreProvider>
    </QueryClientProvider>
  );
}
it("edits, totals, subtracts, undoes and restores a shopping session without internet", async () => {
  const hook = renderHook(() => useDemo(), { wrapper });
  expect(hook.result.current.itens.map((i) => i.id)).toEqual(["rice", "beans"]);
  await act(async () => {
    await hook.result.current.updateItem("rice", { preco: 35 });
  });
  await waitFor(() => expect(hook.result.current.itens[0]?.preco).toBe(35));
  expect(hook.result.current.itens.map((i) => i.id)).toEqual(["rice", "beans"]);
  await act(async () => {
    await hook.result.current.toggleItem("rice");
  });
  await waitFor(() => expect(hook.result.current.itens[0]?.comprado).toBe(true));
  const spent = hook.result.current.itens
    .filter((i) => i.comprado)
    .reduce((sum, i) => sum + totalItem(i), 0);
  expect(hook.result.current.orcamento - spent).toBe(30);
  expect(readLocal("f1").pending).toHaveLength(2);
  hook.unmount();
  client.clear();
  const reopened = renderHook(() => useDemo(), { wrapper });
  expect(reopened.result.current.itens[0]).toMatchObject({ preco: 35, comprado: true });
  await act(async () => {
    await reopened.result.current.toggleItem("rice");
  });
  await waitFor(() => expect(reopened.result.current.itens[0]?.comprado).toBe(false));
  expect(cached<any[]>("f1", ["itens", "f1", "l1"])?.[0].comprado).toBe(false);
});

it("finalizes offline, deducts the card once, persists history and moves remaining products", async () => {
  saveCache(
    "f1",
    ["cartoes", "f1"],
    [
      { id: "c1", nome: "Card", saldo: 100, cor: "verde" },
      { id: "other", nome: "Other", saldo: 500, cor: "claro" },
    ],
  );
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.updateItem("rice", { preco: 35 });
    await hook.result.current.toggleItem("rice");
  });
  await act(async () => {
    await hook.result.current.finalizarCompra();
  });
  await waitFor(() =>
    expect(hook.result.current.cartoes.find((c) => c.id === "c1")?.saldo).toBe(30),
  );
  expect(hook.result.current.cartoes.find((c) => c.id === "other")?.saldo).toBe(500);
  expect(hook.result.current.historico).toEqual([
    expect.objectContaining({ total: 70, itens: 1, pendente: true }),
  ]);
  const pendingList = hook.result.current.listaId;
  expect(pendingList).not.toBe("l1");
  expect(hook.result.current.itens.map((i) => i.id)).toEqual(["beans"]);
  expect(readLocal("f1").pending.map((op) => op.kind)).toEqual(["update", "update", "finalize"]);
  await expect(hook.result.current.finalizarCompra()).rejects.toThrow("Marque pelo menos");
  expect(readLocal("f1").pending.filter((op) => op.kind === "finalize")).toHaveLength(1);
  hook.unmount();
  client.clear();
  const reopened = renderHook(() => useDemo(), { wrapper });
  expect(reopened.result.current.cartoes.find((c) => c.id === "c1")?.saldo).toBe(30);
  expect(reopened.result.current.historico[0]?.total).toBe(70);
  expect(reopened.result.current.listaId).toBe(pendingList);
  await act(async () => {
    await reopened.result.current.updateItem("beans", { preco: 5 });
  });
  expect(readLocal("f1").pending.at(-1)?.listaId).toBe(pendingList);
});

it("rejects offline finalization above the budget without changing balances or history", async () => {
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.updateItem("rice", { preco: 60 });
    await hook.result.current.toggleItem("rice");
  });
  await expect(hook.result.current.finalizarCompra()).rejects.toThrow("acima do orçamento");
  expect(hook.result.current.cartoes[0]?.saldo).toBe(100);
  expect(hook.result.current.historico).toEqual([]);
  expect(readLocal("f1").pending.some((op) => op.kind === "finalize")).toBe(false);
});

it("retries a lost finalization response without subtracting the local card twice", async () => {
  saveCache(
    "f1",
    ["itens", "f1", "l1"],
    [{ id: "rice", nome: "Arroz", setor: "Mercearia", qtd: 2, preco: 35, comprado: true }],
  );
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.finalizarCompra();
  });
  await waitFor(() => expect(hook.result.current.cartoes[0]?.saldo).toBe(30));
  const rpc = vi.mocked(supabase.rpc);
  rpc.mockResolvedValueOnce({ data: null, error: { message: "Network response lost" } } as any);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(hook.result.current.syncError).toContain("Network response lost"));
  expect(readLocal("f1").pending).toHaveLength(1);
  expect(hook.result.current.cartoes[0]?.saldo).toBe(30);
  rpc.mockResolvedValueOnce({ data: "server-purchase-id", error: null } as any);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(readLocal("f1").pending).toHaveLength(0));
  expect(hook.result.current.cartoes[0]?.saldo).toBe(30);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[0]?.[0]).toBe("finalizar_compra_compartilhada");
});

it("edits only the selected history receipt offline and restores its corrected card balance", async () => {
  const purchase = {
    id: "purchase-one",
    data: "2026-10-29",
    cartao: "Card",
    cartaoId: "c1",
    listaId: "old-list",
    listaNome: "Outubro",
    total: 20,
    itens: 1,
    revisao: 0,
    produtos: [{ id: "old-rice", nome: "Arroz", setor: "Mercearia", qtd: 2, preco: 10 }],
  };
  const other = {
    ...purchase,
    id: "purchase-two",
    listaId: "another-list",
    listaNome: "Outra compra",
  };
  saveCache("f1", ["compras", "f1"], [purchase, other]);
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.editarCompra(purchase, [{ ...purchase.produtos[0]!, preco: 12 }]);
  });
  await waitFor(() => expect(hook.result.current.historico[0]?.total).toBe(24));
  expect(hook.result.current.historico[1]).toEqual(other);
  expect(hook.result.current.cartoes[0]?.saldo).toBe(96);
  expect(hook.result.current.itens.map((i) => i.nome)).toEqual(["Arroz", "Feijão"]);
  expect(readLocal("f1").pending.at(-1)).toMatchObject({
    kind: "history",
    values: { compraId: "purchase-one", revisao: 0 },
  });
  await expect(hook.result.current.editarCompra(purchase, purchase.produtos)).rejects.toThrow(
    "atualizada",
  );
  hook.unmount();
  client.clear();
  const reopened = renderHook(() => useDemo(), { wrapper });
  expect(reopened.result.current.historico[0]?.produtos?.[0]?.preco).toBe(12);
  expect(reopened.result.current.cartoes[0]?.saldo).toBe(96);
  const updated = reopened.result.current.historico[0]!;
  await act(async () => {
    await reopened.result.current.editarCompra(updated, [{ ...purchase.produtos[0]!, preco: 8 }]);
  });
  await waitFor(() => expect(reopened.result.current.cartoes[0]?.saldo).toBe(104));
});

it("allows correcting an offline purchase before its first synchronization", async () => {
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.updateItem("rice", { preco: 35 });
    await hook.result.current.toggleItem("rice");
    await hook.result.current.finalizarCompra();
  });
  await waitFor(() => expect(hook.result.current.historico[0]?.produtos?.[0]?.preco).toBe(35));
  const purchase = hook.result.current.historico[0]!;
  await act(async () => {
    await hook.result.current.editarCompra(purchase, [{ ...purchase.produtos![0]!, preco: 30 }]);
  });
  await waitFor(() => expect(hook.result.current.cartoes[0]?.saldo).toBe(40));
  expect(readLocal("f1").pending.map((p) => p.kind)).toEqual([
    "update",
    "update",
    "finalize",
    "history",
  ]);
  expect(readLocal("f1").pending.at(-1)?.values["finalizacaoId"]).toBe(purchase.id);
});

it("does not enqueue an unaffordable receipt correction", async () => {
  const purchase = {
    id: "p",
    data: "2026-10-29",
    cartao: "Card",
    cartaoId: "c1",
    total: 20,
    itens: 1,
    produtos: [{ id: "i", nome: "Arroz", setor: "Mercearia", qtd: 1, preco: 20 }],
  };
  saveCache("f1", ["compras", "f1"], [purchase]);
  const hook = renderHook(() => useDemo(), { wrapper });
  await expect(
    hook.result.current.editarCompra(purchase, [{ ...purchase.produtos[0]!, preco: 200 }]),
  ).rejects.toThrow("Saldo do cartão insuficiente");
  expect(readLocal("f1").pending).toHaveLength(0);
  expect(hook.result.current.cartoes[0]?.saldo).toBe(100);
});

it("creates reusable categories offline without duplicates and restores them on reopening", async () => {
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    expect(await hook.result.current.criarCategoria("  Pets  ")).toBe("Pets");
    expect(await hook.result.current.criarCategoria("pets")).toBe("Pets");
  });
  await waitFor(() => expect(hook.result.current.categorias).toContain("Pets"));
  expect(hook.result.current.categorias).toContain("Crianças");
  expect(readLocal("f1").pending.filter((p) => p.kind === "category")).toHaveLength(1);
  expect(readLocal("other-family").pending).toHaveLength(0);
  hook.unmount();
  client.clear();
  const reopened = renderHook(() => useDemo(), { wrapper });
  expect(reopened.result.current.categorias).toContain("Pets");
  await expect(reopened.result.current.criarCategoria("Todos")).rejects.toThrow("filtro");
});

it("deleting the final historic item refunds its total offline and preserves the receipt", async () => {
  const purchase = {
    id: "empty-test",
    data: "2026-10-29",
    cartao: "Card",
    cartaoId: "c1",
    total: 20,
    itens: 1,
    revisao: 0,
    produtos: [{ id: "item", nome: "Arroz", setor: "Mercearia", qtd: 1, preco: 20 }],
  };
  saveCache("f1", ["compras", "f1"], [purchase]);
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.editarCompra(purchase, []);
  });
  await waitFor(() => expect(hook.result.current.historico[0]?.total).toBe(0));
  expect(hook.result.current.historico[0]?.produtos).toEqual([]);
  expect(hook.result.current.historico[0]?.itens).toBe(0);
  expect(hook.result.current.cartoes[0]?.saldo).toBe(120);
  expect(readLocal("f1").pending.at(-1)?.values["produtos"]).toEqual([]);
});
