import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mock = vi.hoisted(() => ({
  writes: [] as { table: string; kind: string; values: unknown }[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        eq: () => query,
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({ error: null, data: [] }).then(resolve),
      };
      return {
        insert: (values: unknown) => {
          mock.writes.push({ table, kind: "insert", values });
          return query;
        },
        update: (values: unknown) => {
          mock.writes.push({ table, kind: "update", values });
          return query;
        },
      };
    },
  },
}));
vi.mock("@/lib/shared-shopping", () => ({
  useSharedShopping: () => ({ connected: false, peers: 0, peerPending: 0 }),
}));
import { StoreProvider, useDemo } from "@/lib/demo-store";
import { saveCache } from "@/lib/offline";
afterEach(() => {
  cleanup();
  localStorage.clear();
  mock.writes = [];
  vi.restoreAllMocks();
});
it("registers and edits a card without creating a list, including the previous budget argument", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  vi.spyOn(qc, "invalidateQueries").mockResolvedValue();
  for (const key of ["cartoes", "listas", "produtos", "compras", "categorias"])
    saveCache("f", [key, "f"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <StoreProvider familia={{ id: "f", nome: "Family", codigo: "123" }}>{children}</StoreProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useDemo(), { wrapper });
  await act(async () => {
    await hook.result.current.addCartao("Vale", 500);
  });
  await act(async () => {
    await hook.result.current.salvarCartao("c", "Vale", 500, 200);
  });
  expect(mock.writes).toEqual([
    {
      table: "cartoes",
      kind: "insert",
      values: { familia_id: "f", nome: "Vale", saldo: 500, cor: "claro" },
    },
    { table: "cartoes", kind: "update", values: { nome: "Vale", saldo: 500 } },
  ]);
  expect(hook.result.current.listas).toEqual([]);
  hook.unmount();
  qc.clear();
});
