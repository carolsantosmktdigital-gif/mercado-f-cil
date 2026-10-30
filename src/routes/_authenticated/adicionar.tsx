import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryField } from "@/components/CategoryField";
import { brl, useDemo, type Setor } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/adicionar")({
  validateSearch: (s: Record<string, unknown>): { inesperado?: boolean } =>
    s["inesperado"] === true || s["inesperado"] === "true" ? { inesperado: true } : {},
  head: () => ({
    meta: [
      { title: "Adicionar produto — Mercado Fácil" },
      { name: "description", content: "Adicione um produto com setor, quantidade e preço." },
      { property: "og:title", content: "Adicionar produto — Mercado Fácil" },
      { property: "og:description", content: "Novos produtos entram no catálogo automaticamente." },
    ],
  }),
  component: Adicionar,
});

function Adicionar() {
  const { inesperado } = Route.useSearch();
  const { addItem, catalogo } = useDemo();
  const navigate = useNavigate();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState<Setor>("Mercearia");
  const [qtd, setQtd] = useState("1");
  const [preco, setPreco] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const nomeInput = useRef<HTMLInputElement>(null);

  const q = parseFloat(qtd.replace(",", ".")) || 0;
  const p = parseFloat(preco.replace(",", ".")) || 0;
  const sugestoes =
    nome.length > 1
      ? catalogo.filter((c) => c.nome.toLowerCase().includes(nome.toLowerCase())).slice(0, 3)
      : [];

  async function salvar(e: React.SyntheticEvent, continuar = false) {
    e.preventDefault();
    if (saving.current) return;
    if (!nome.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) {
      toast.error("Informe nome, quantidade e preço válidos.");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await addItem({ nome: nome.trim(), setor, qtd: q, preco: p, inesperado: !!inesperado });
      if (continuar) {
        setNome("");
        setQtd("1");
        setPreco("");
        toast.success("Item salvo. Cadastre o próximo produto.");
        nomeInput.current?.focus();
      } else {
        toast.success("Produto adicionado à lista.");
        void navigate({ to: "/lista" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o item.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Page
      title={inesperado ? "Item inesperado" : "Adicionar produto"}
      action={
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          onClick={() => router.history.back()}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
      }
    >
      <form onSubmit={(event) => void salvar(event, false)} className="space-y-5">
        <div className="space-y-1">
          <Label htmlFor="produto-nome">Nome do produto</Label>
          <Input
            id="produto-nome"
            ref={nomeInput}
            required
            className="h-14 text-base"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Café torrado 500g"
          />
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {sugestoes.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setNome(s.nome);
                    setSetor(s.setor);
                    setPreco(String(s.precoRef).replace(".", ","));
                  }}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm text-accent-foreground"
                >
                  {s.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        <CategoryField label="Categoria / setor" value={setor} onChange={setSetor} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="produto-quantidade">Quantidade</Label>
            <Input
              className="h-14 text-base"
              inputMode="decimal"
              id="produto-quantidade"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="produto-preco">Preço unitário (R$)</Label>
            <Input
              className="h-14 text-base"
              inputMode="decimal"
              id="produto-preco"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
          <span className="text-muted-foreground">Total do item</span>
          <span className="font-display text-2xl font-extrabold">{brl(q * p)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Produtos novos serão incluídos automaticamente no catálogo.
        </p>
        <div className="sticky bottom-24 z-30 grid grid-cols-2 gap-3 bg-background/95 py-3">
          <Button
            type="button"
            disabled={busy}
            variant="outline"
            className="h-auto min-h-14 whitespace-normal rounded-2xl px-3 py-3 text-sm"
            onClick={(event) => void salvar(event, true)}
          >
            Salvar e cadastrar outro
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="h-auto min-h-14 whitespace-normal rounded-2xl px-3 py-3 text-sm"
          >
            {busy ? "Salvando…" : "Salvar item na lista"}
          </Button>
        </div>
      </form>
    </Page>
  );
}
