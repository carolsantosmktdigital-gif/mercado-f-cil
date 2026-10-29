import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { it, expect, afterEach, vi, beforeEach } from "vitest";
import { InstallApp } from "@/components/InstallApp";
beforeEach(() => {
  Object.defineProperty(navigator, "standalone", { configurable: true, value: false });
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
  fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
  expect(screen.getByText(/Android \(Chrome\)/)).toBeInTheDocument();
  expect(screen.getByText(/iPhone \(Safari\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
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

it.each(["standalone", "minimal-ui", "fullscreen"])(
  "shows only sharing when opened in %s app mode",
  async (mode) => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query) => ({
        matches: query === `(display-mode: ${mode})`,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    render(<InstallApp />);
    expect(screen.getByRole("button", { name: "Compartilhar app" })).toBeInTheDocument();
    expect(screen.queryByText("Mercado Fácil no seu celular")).not.toBeInTheDocument();
    expect(screen.queryByText(/Adicione o app/)).not.toBeInTheDocument();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    const { act } = await import("@testing-library/react");
    act(() => window.dispatchEvent(event));
    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
  },
);
it("recognizes the installed iPhone launch context", () => {
  Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  render(<InstallApp />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Compartilhar app" })).toBeInTheDocument();
  expect(screen.queryByText(/Adicione o app/)).not.toBeInTheDocument();
});
it("keeps the installation notice in a browser after installing elsewhere", async () => {
  render(<InstallApp />);
  const { act } = await import("@testing-library/react");
  act(() => window.dispatchEvent(new Event("appinstalled")));
  expect(screen.getByText(/Adicione o app/)).toBeInTheDocument();
});
