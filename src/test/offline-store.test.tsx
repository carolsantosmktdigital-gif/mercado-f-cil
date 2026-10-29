import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoreProvider, totalItem, useDemo } from "../lib/demo-store";
import { cached, readLocal, saveCache } from "../lib/offline";
import type { ReactNode } from "react";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
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
