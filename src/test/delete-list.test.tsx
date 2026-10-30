import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
const { remove } = vi.hoisted(() => ({ remove: vi.fn(async () => {}) }));
vi.mock("@/lib/demo-store", () => ({ useDemo: () => ({ excluirLista: remove }) }));
import { DeleteListButton } from "@/components/DeleteListButton";
afterEach(() => {
  cleanup();
  remove.mockReset();
});
it("requires confirmation and deletes only the selected list", async () => {
  render(<DeleteListButton id="selected-list" nome="Novembro" />);
  fireEvent.click(screen.getByRole("button", { name: "Excluir lista Novembro" }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("Novembro");
  fireEvent.click(screen.getByRole("button", { name: "Sim, excluir lista" }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("selected-list"));
  expect(remove).toHaveBeenCalledOnce();
});
it("cancel leaves the list intact", () => {
  render(<DeleteListButton id="keep" nome="Dezembro" />);
  fireEvent.click(screen.getByRole("button", { name: "Excluir lista Dezembro" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
