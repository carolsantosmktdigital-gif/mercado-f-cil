import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Plus, Pencil } from "lucide-react";
import { Page } from "@/components/AppShell";
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
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [novoSaldo, setNovoSaldo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [nome, setNome] = useState("");
  const [saldo, setSaldo] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(saldo.replace(",", "."));
    if (!nome.trim() || isNaN(v)) { toast.error("Preencha nome e saldo."); return; }
    try { await addCartao(nome.trim(), v); } catch { return; }
    setNome(""); setSaldo(""); setAberto(false);
    toast.success("Cartão salvo.");
  }

  async function salvarEdicao(e: React.FormEvent) {e.preventDefault();if(!editando)return;const valor=Number(novoSaldo.trim().replace(",","."));if(!novoNome.trim()||!Number.isFinite(valor)||valor<0){toast.error("Informe nome e saldo válidos.");return;}setSalvandoEdicao(true);try{const {supabase}=await import("@/integrations/supabase/client");const {error}=await (supabase as any).from("cartoes").update({nome:novoNome.trim(),saldo:valor}).eq("id",editando.id);if(error)throw error;toast.success("Cartão atualizado.");setEditando(null);window.location.reload();}catch{toast.error("Não foi possível atualizar o cartão.");}finally{setSalvandoEdicao(false);}}

  return (
    <Page
      title="Cartões"
      subtitle={`${cartoes.length} cadastrados`}
      action={<Button size="icon" className="h-12 w-12 rounded-full" onClick={() => setAberto(!aberto)} aria-label="Novo cartão"><Plus className="h-6 w-6" /></Button>}
    >

      {aberto && (
        <form onSubmit={salvar} className="mb-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-lg font-bold">Novo cartão</h2>
          <div className="space-y-1"><Label>Nome do cartão</Label><Input className="h-12" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vale-alimentação" /></div>
          <div className="space-y-1"><Label>Saldo disponível (R$)</Label><Input className="h-12" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" /></div>
          <Button type="submit" size="lg" className="h-12 w-full rounded-2xl">Salvar cartão</Button>
        </form>
      )}
      {editando && <form onSubmit={salvarEdicao} className="mb-5 space-y-3 rounded-3xl border bg-card p-5 shadow-soft"><h2 className="font-bold">Editar cartão</h2><Label>Nome do cartão</Label><Input className="h-12" value={novoNome} onChange={e=>setNovoNome(e.target.value)} required/><Label>Saldo disponível (R$)</Label><Input className="h-12" inputMode="decimal" value={novoSaldo} onFocus={e=>e.currentTarget.select()} onChange={e=>setNovoSaldo(e.target.value)} required/><div className="flex gap-2"><Button type="submit" disabled={salvandoEdicao} className="flex-1">Salvar alterações</Button><Button type="button" variant="outline" onClick={()=>setEditando(null)}>Cancelar</Button></div></form>}
      <ul className="space-y-4">
        {cartoes.map((c) => (
          <li key={c.id} className={`rounded-3xl p-5 shadow-soft ${estilo[c.cor]}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.nome}</span>
              <div className="flex items-center gap-2"><button type="button" className="rounded-lg p-2" aria-label={"Editar saldo de "+c.nome} onClick={()=>{setEditando(c);setNovoNome(c.nome);setNovoSaldo(String(c.saldo));}}><Pencil className="h-5 w-5"/></button><CreditCard className="h-6 w-6 opacity-80" /></div>
            </div>
            <p className="mt-6 text-sm opacity-75">Saldo disponível</p>
            <p className="font-display text-3xl font-extrabold">{brl(c.saldo)}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
