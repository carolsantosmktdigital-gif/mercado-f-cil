import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mock = vi.hoisted(() => ({
  entries: {} as Record<string, unknown[]>,
  sync: () => {},
  track: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (type: string, filter: { event: string }, fn: () => void) => {
          if (type === "presence") mock.sync = fn;
          return channel;
        },
        subscribe: (fn: (status: string) => void) => {
          setTimeout(() => fn("SUBSCRIBED"), 0);
          return channel;
        },
        track: mock.track,
        presenceState: () => mock.entries,
      };
      return channel;
    },
    removeChannel: mock.remove,
  },
}));
import { useSharedShopping } from "@/lib/shared-shopping";
import { savePersonName } from "@/lib/preferences";
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("publishes the saved name, shows only peers in the selected list and updates renamed presence", async () => {
  vi.useFakeTimers();
  savePersonName("Carol");
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const view = renderHook(({ list }) => useSharedShopping("f", list, 0, async () => {}), {
    wrapper,
    initialProps: { list: "l1" },
  });
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(mock.track).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: "Carol", lista: "l1" }),
  );
  mock.entries = {
    other: [{ device: "other", name: "João", lista: "l1", pending: 0 }],
    elsewhere: [{ device: "elsewhere", name: "Ana", lista: "l2" }],
  };
  act(() => mock.sync());
  expect(view.result.current.peerNames).toEqual(["João"]);
  expect(view.result.current.peers).toBe(1);
  act(() => savePersonName("Carolina"));
  expect(mock.track).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Carolina" }));
  view.rerender({ list: "l2" });
  expect(view.result.current.peerNames).toEqual(["Ana"]);
  view.unmount();
  expect(mock.remove).toHaveBeenCalledOnce();
  qc.clear();
});
