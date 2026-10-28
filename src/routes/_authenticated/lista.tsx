import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Page } from "@/components/AppShell";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { brl, totalItem, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/lista")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Mercado Fácil" },
      { name: "description", content: "Produtos, quantidades, preços e total da compra." },
      { property: "og:title", content: "Lista de compras — Mercado Fácil" },
      { property: "og:description", content: "Marque produtos como comprados e acompanhe o orçamento." },
    ],
  }),
  component: Lista,
});

function Lista() {
  const { itens, toggleItem, removeItem, finalizarCompra, listas, listaId, selecionarLista, criarLista, cartoes } = useDemo();
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [reserva, setReserva] = useState("0");
  const [salvando, setSalvando] = useState(false);
  async function salvarLista(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await criarLista(nome.trim(), cartaoId, Number(orcamento.replace(",",".")), Number(reserva.replace(",",".")));
      setNovo(false); setNome(""); setOrcamento(""); setReserva("0");
    } catch (e) { toast.error("Não foi possível criar a lista."); }
    finally { setSalvando(false); }
  }
  const total = itens.reduce((s, i) => s + totalItem(i), 0);
  const ordenados = [...itens].sort((a, b) => Number(a.comprado) - Number(b.comprado));

  return (
    <Page title="Lista de compras" subtitle={`${itens.filter((i) => i.comprado).length} de ${itens.length} no carrinho`}>
      <div className="mb-4 rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <strong>Suas listas</strong>
          <Button size="sm" onClick={() => setNovo(v=>!v)}><Plus className="h-4 w-4"/> Nova lista</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {listas.map(l => <button key={l.id} onClick={()=>selecionarLista(l.id)}
            className={`rounded-xl border px-3 py-2 text-sm ${listaId===l.id?"bg-primary text-primary-foreground":"bg-muted"}`}>
            {l.nome}{l.tipo==="pendencias"?" (pendências)":""}
          </button>)}
        </div>
        {listas.length===0 && <p className="mt-3 text-sm text-muted-foreground">Crie sua primeira lista para começar.</p>}
        {novo && <form onSubmit={salvarLista} className="mt-4 space-y-3">
          <Input placeholder="Nome da lista" value={nome} onChange={e=>setNome(e.target.value)} required />
          <select className="h-12 w-full rounded-xl border bg-background px-3" value={cartaoId} onChange={e=>setCartaoId(e.target.value)} required>
            <option value="">Escolha um cartão</option>
            {cartoes.map(c=><option key={c.id} value={c.id}>{c.nome} · {brl(c.saldo)}</option>)}
          </select>
          <Input placeholder="Orçamento (R$)" inputMode="decimal" value={orcamento} onChange={e=>setOrcamento(e.target.value)} required />
          <Input placeholder="Reserva (R$)" inputMode="decimal" value={reserva} onChange={e=>setReserva(e.target.value)} required />
          <Button type="submit" disabled={salvando||!cartaoId} className="w-full">Criar lista</Button>
        </form>}
      </div>
      {listaId && <BudgetCard />}
      {listaId && <div className="mt-4 grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-14 rounded-2xl"><Link to="/adicionar"><Plus className="h-5 w-5" /> Adicionar</Link></Button>
        <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl"><Link to="/adicionar" search={{ inesperado: true }}><Zap className="h-5 w-5" /> Item inesperado</Link></Button>
      </div>}

      {listaId && <ul className="mt-6 space-y-3">
        {ordenados.map((i) => (
          <li key={i.id} className={`flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ${i.comprado ? "opacity-60" : ""}`}>
            <button
              onClick={() => toggleItem(i.id)}
              aria-label={i.comprado ? "Desmarcar" : "Marcar como comprado"}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 ${i.comprado ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {i.comprado && <Check className="h-6 w-6" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${i.comprado ? "line-through" : ""}`}>{i.nome}</p>
              <p className="text-xs text-muted-foreground">
                {i.setor}{i.inesperado && " · inesperado"}
              </p>
              <p className="text-sm text-muted-foreground">{i.qtd.toLocaleString("pt-BR")} × {brl(i.preco)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{brl(totalItem(i))}</p>
              <button onClick={() => removeItem(i.id)} aria-label="Remover" className="mt-1 text-muted-foreground"><Trash2 className="ml-auto h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>}

      {listaId && <div className="mt-6 flex items-center justify-between rounded-3xl bg-foreground p-5 text-background">
        <span className="font-medium">Total da compra</span>
        <span className="font-display text-2xl font-extrabold">{brl(total)}</span>
      </div>}
      {listaId && <Button size="lg" className="mt-4 h-14 w-full rounded-2xl text-base" disabled={!itens.some(i => i.comprado)} onClick={() => finalizarCompra().catch(() => {})}>
        Finalizar compra (itens marcados)
      </Button>}
    </Page>
  );
}
