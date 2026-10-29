import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { it, expect, afterEach, vi, beforeEach } from "vitest";
import { InstallApp } from "@/components/InstallApp";
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("mostra instruções de Android e iPhone e compartilha somente o link público", async () => {
  const share = vi.fn(async () => {});
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  render(<InstallApp />);
  expect(screen.getByText(/Android \(Chrome\)/)).toBeInTheDocument();
  expect(screen.getByText(/iPhone \(Safari\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Compartilhar app" }));
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: window.location.origin + "/" }),
    ),
  );
});
it("oferece instalação quando o navegador disponibiliza o convite", async () => {
  const prompt = vi.fn(async () => {});
  render(<InstallApp />);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  const { act } = await import("@testing-library/react");
  act(() => {
    window.dispatchEvent(event);
  });
  fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
  await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  expect(event.defaultPrevented).toBe(true);
});
