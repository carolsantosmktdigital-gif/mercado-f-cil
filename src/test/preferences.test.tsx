import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PersonNameForm, ThemeChoice, ThemeInitializer } from "@/components/PersonalPreferences";
import { getPersonName, getTheme, savePersonName } from "@/lib/preferences";
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
it("saves and edits the personal name and restores it after reopening", () => {
  const view = render(<PersonNameForm />);
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "  Carol   Santos  " } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
  expect(getPersonName()).toBe("Carol Santos");
  expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument();
  view.unmount();
  render(<PersonNameForm />);
  expect(screen.getByText("Carol Santos")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Alterar nome" }));
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Carlos" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
  expect(getPersonName()).toBe("Carlos");
});
it("changes themes immediately, remembers the choice and restores it on mount", () => {
  const view = render(
    <>
      <ThemeInitializer />
      <ThemeChoice />
    </>,
  );
  fireEvent.change(screen.getByLabelText("Tema do app"), { target: { value: "dark" } });
  expect(document.documentElement).toHaveClass("dark");
  expect(getTheme()).toBe("dark");
  view.unmount();
  document.documentElement.classList.remove("dark");
  render(
    <>
      <ThemeInitializer />
      <ThemeChoice />
    </>,
  );
  expect(document.documentElement).toHaveClass("dark");
  fireEvent.change(screen.getByLabelText("Tema do app"), { target: { value: "light" } });
  expect(document.documentElement).not.toHaveClass("dark");
  expect(getTheme()).toBe("light");
});
it("updates the name form when another tab changes the saved name", () => {
  render(<PersonNameForm />);
  act(() => savePersonName("Marcos"));
  expect(screen.getByText("Marcos")).toBeInTheDocument();
});
