import { useSyncExternalStore } from "react";
const NAME = "mercado-facil-person-name";
const THEME = "mercado-facil-theme";
const EVENT = "mercado-preferences-change";
function read(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function personName(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60)
    : "";
}
export function getPersonName() {
  return personName(read(NAME));
}
export function savePersonName(value: string) {
  const name = personName(value);
  if (!name) throw new Error("Informe seu nome.");
  localStorage.setItem(NAME, name);
  window.dispatchEvent(new Event(EVENT));
}
export type Theme = "light" | "dark";
export function getTheme(): Theme {
  return read(THEME) === "dark" ? "dark" : "light";
}
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}
export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}
export function subscribePreferences(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function usePersonName() {
  return useSyncExternalStore(subscribePreferences, getPersonName, () => "");
}
export function useTheme() {
  return useSyncExternalStore(subscribePreferences, getTheme, () => "light" as Theme);
}
