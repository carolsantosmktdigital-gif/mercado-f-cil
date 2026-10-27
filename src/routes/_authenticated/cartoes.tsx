import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Plus } from "lucide-react";
import { Page, DemoBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, useDemo, type Cartao } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Mercado Fácil" },
      { name: "description", content: "Veja e cadastre seus cartões de alimentação e vale-compras." },
      { property: "og:title", content: "Cartões — Mercado Fácil" },
      { property: "og:description", content: "Cartões de alimentação com saldos independentes." },
    ],
  }),
  component: Cartoes,
});

const estilo: Record<Cartao["cor"], string> = {
  verde: "bg-primary text-primary-foreground",
  escuro: "bg-foreground text-background",
  claro: "bg-accent text-accent-foreground",
};

function Cartoes() {
  const { cartoes, addCartao } = useDemo();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [saldo, setSaldo] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(saldo.replace(",", "."));
    if (!nome.trim() || isNaN(v)) { toast.error("Preencha nome e saldo."); return; }
    addCartao(nome.trim(), v);
    setNome(""); setSaldo(""); setAberto(false);
    toast.success("Cartão adicionado (demonstração).");
  }

  return (
    <Page
      title="Cartões"
      subtitle={`${cartoes.length} cadastrados`}
      action={<Button size="icon" className="h-12 w-12 rounded-full" onClick={() => setAberto(!aberto)} aria-label="Novo cartão"><Plus className="h-6 w-6" /></Button>}
    >
      <DemoBadge texto="Cartões ainda são fictícios — não são salvos." />
      {aberto && (
        <form onSubmit={salvar} className="mb-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-lg font-bold">Novo cartão</h2>
          <div className="space-y-1"><Label>Nome do cartão</Label><Input className="h-12" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vale-alimentação" /></div>
          <div className="space-y-1"><Label>Saldo disponível (R$)</Label><Input className="h-12" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" /></div>
          <Button type="submit" size="lg" className="h-12 w-full rounded-2xl">Salvar cartão</Button>
        </form>
      )}
      <ul className="space-y-4">
        {cartoes.map((c) => (
          <li key={c.id} className={`rounded-3xl p-5 shadow-soft ${estilo[c.cor]}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.nome}</span>
              <CreditCard className="h-6 w-6 opacity-80" />
            </div>
            <p className="mt-6 text-sm opacity-75">Saldo disponível</p>
            <p className="font-display text-3xl font-extrabold">{brl(c.saldo)}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
