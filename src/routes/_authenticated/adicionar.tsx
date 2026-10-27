import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, SETORES, useDemo, type Setor } from "@/lib/demo-store";

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

  const q = parseFloat(qtd.replace(",", ".")) || 0;
  const p = parseFloat(preco.replace(",", ".")) || 0;
  const sugestoes = nome.length > 1 ? catalogo.filter((c) => c.nome.toLowerCase().includes(nome.toLowerCase())).slice(0, 3) : [];

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || q <= 0) { toast.error("Informe nome e quantidade."); return; }
    addItem({ nome: nome.trim(), setor, qtd: q, preco: p, inesperado: !!inesperado });
    toast.success("Produto adicionado à lista (demonstração).");
    navigate({ to: "/lista" });
  }

  return (
    <Page
      title={inesperado ? "Item inesperado" : "Adicionar produto"}
      action={<Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => router.history.back()} aria-label="Voltar"><ArrowLeft className="h-6 w-6" /></Button>}
    >
      <form onSubmit={salvar} className="space-y-5">
        <div className="space-y-1">
          <Label>Nome do produto</Label>
          <Input className="h-14 text-base" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Café torrado 500g" />
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {sugestoes.map((s) => (
                <button type="button" key={s.id} onClick={() => { setNome(s.nome); setSetor(s.setor); setPreco(String(s.precoRef).replace(".", ",")); }}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm text-accent-foreground">
                  {s.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Setor</Label>
          <div className="flex flex-wrap gap-2">
            {SETORES.map((s) => (
              <button type="button" key={s} onClick={() => setSetor(s)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${setor === s ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Quantidade</Label><Input className="h-14 text-base" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          <div className="space-y-1"><Label>Preço unitário (R$)</Label><Input className="h-14 text-base" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" /></div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
          <span className="text-muted-foreground">Total do item</span>
          <span className="font-display text-2xl font-extrabold">{brl(q * p)}</span>
        </div>
        <p className="text-sm text-muted-foreground">Produtos novos serão incluídos automaticamente no catálogo.</p>
        <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-base">Adicionar à lista</Button>
      </form>
    </Page>
  );
}
