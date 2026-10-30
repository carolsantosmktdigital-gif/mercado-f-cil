import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { cached, saveCache } from "@/lib/offline";
const auth = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: string) => void),
  unsubscribe: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (fn: (event: string) => void) => {
        auth.callback = fn;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signInAnonymously: auth.signIn,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));
vi.mock("@/lib/demo-store", () => ({
  StoreProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="family-store">{children}</div>
  ),
}));
vi.mock("@/components/AppShell", () => ({ BottomNav: () => null }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <div>Família anterior</div>,
}));
import { Layout } from "@/routes/_authenticated/route";
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
it("opens family setup immediately on sign out and forgets the old selection across reloads", async () => {
  saveCache("identity", ["user"], { id: "old-user" });
  saveCache("old-user", ["familia"], { id: "old-family", nome: "Anterior", codigo: "123" });
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  auth.signIn.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
  const view = render(
    <QueryClientProvider client={qc}>
      <Layout />
    </QueryClientProvider>,
  );
  expect(screen.getByText("Família anterior")).toBeInTheDocument();
  await act(async () => {
    auth.callback?.("SIGNED_OUT");
  });
  expect(screen.queryByTestId("family-store")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Criar uma família")).toBeInTheDocument());
  expect(screen.getByText("Entrar na família")).toBeInTheDocument();
  expect(cached("old-user", ["familia"])).toBeNull();
  expect(cached("identity", ["user"])).toEqual({ id: "new-user" });
  expect(qc.getQueryData(["familia", "old-user"])).toBeUndefined();
  view.unmount();
  expect(auth.unsubscribe).toHaveBeenCalledOnce();
});
