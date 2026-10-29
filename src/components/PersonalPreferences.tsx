import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyTheme, savePersonName, saveTheme, usePersonName, useTheme } from "@/lib/preferences";
export function ThemeInitializer() {
  const theme = useTheme();
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return null;
}
export function ThemeChoice() {
  const theme = useTheme();
  return (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="sr-only">Tema do app</span>
      <select
        aria-label="Tema do app"
        className="h-10 rounded-xl border bg-card px-2 text-foreground"
        value={theme}
        onChange={(event) => {
          try {
            saveTheme(event.target.value === "dark" ? "dark" : "light");
          } catch {
            toast.error("Não foi possível salvar sua preferência neste aparelho.");
          }
        }}
      >
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  );
}
export function PersonNameForm() {
  const name = usePersonName();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (name && !editing)
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          Você está usando como <strong>{name}</strong>
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          Alterar nome
        </Button>
      </div>
    );
  return (
    <section className="mb-4 rounded-3xl bg-card p-5 shadow-soft">
      <h2 className="font-bold">{name ? "Alterar seu nome" : "Como podemos chamar você?"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Seu nome aparecerá para quem estiver acessando a mesma lista.
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            savePersonName(value);
            setEditing(false);
            toast.success("Nome salvo.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Não foi possível salvar seu nome.",
            );
          }
        }}
      >
        <label className="block text-sm font-medium">
          Seu nome
          <Input
            autoComplete="given-name"
            maxLength={60}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit">Salvar nome</Button>
          {name && (
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
