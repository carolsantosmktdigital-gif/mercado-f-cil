import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SETORES, useDemo } from "@/lib/demo-store";
import { categoryName } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function CategoryField({
  value,
  onChange,
  label = "Categoria",
  ariaLabel,
  extra = [],
}: {
  value: string;
  onChange: (nome: string) => void;
  label?: string;
  ariaLabel?: string;
  extra?: string[];
}) {
  const { categorias = SETORES, criarCategoria } = useDemo();
  const [open, setOpen] = useState(false),
    [nome, setNome] = useState(""),
    [busy, setBusy] = useState(false);
  const id = useId();
  const options = Array.from(
    new Map(
      [...categorias, ...extra, value]
        .filter(Boolean)
        .map((c) => [categoryName(c).toLocaleLowerCase("pt-BR"), categoryName(c)]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  async function save() {
    setBusy(true);
    try {
      const chosen = await criarCategoria(nome);
      onChange(chosen);
      setNome("");
      setOpen(false);
      toast.success("Categoria salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a categoria.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-label={ariaLabel || label}
        value={categoryName(value)}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-xl border bg-background px-3 text-base"
      >
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="flex min-h-10 items-center gap-1 text-sm font-semibold text-primary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" />
        Nova categoria
      </button>
      {open && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <label htmlFor={id + "-new"} className="text-sm font-medium">
            Nome da nova categoria
          </label>
          <Input
            id={id + "-new"}
            aria-label="Nome da nova categoria"
            className="mt-2 min-h-12 text-base"
            placeholder="Ex.: Pets, Festa, Congelados"
            maxLength={60}
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={busy || !nome.trim()} onClick={() => void save()}>
              {busy ? "Salvando…" : "Criar categoria"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setNome("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
