import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Plus, Pencil, Trash2 } from "lucide-react";
import { Page } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
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
  const { familia, cartoes, listas, addCartao, salvarCartao, excluirCartao } = useDemo();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [listasVinculadas, setListasVinculadas] = useState<string[]>([]);
  const [consultandoVinculos, setConsultandoVinculos] = useState(false);
  const [salvandoExclusao, setSalvandoExclusao] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [novoSaldo, setNovoSaldo] = useState("");
  const [novoDestinado, setNovoDestinado] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [nome, setNome] = useState("");
  const [saldo, setSaldo] = useState("");
  const [destinado, setDestinado] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(saldo.replace(",", "."));
    if (!nome.trim() || isNaN(v)) { toast.error("Preencha nome e saldo."); return; }
    const d = Number(destinado.replace(",", "."));
    if (!Number.isFinite(d) || d < 0 || d > v) {toast.error("O valor destinado deve estar entre zero e o saldo do cartão.");return;}
    try { await addCartao(nome.trim(), v, d); } catch (error) {toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar.");return; }
    setNome(""); setSaldo(""); setDestinado(""); setAberto(false);
    toast.success("Cartão salvo.");
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();if(!editando)return;
    const valor=Number(novoSaldo.trim().replace(",","."));
    const d=Number(novoDestinado.trim().replace(",","."));
    if(!novoNome.trim()||!Number.isFinite(valor)||valor<0||!Number.isFinite(d)||d<0||d>valor){toast.error("O valor destinado às compras não pode ultrapassar o saldo.");return;}
    setSalvandoEdicao(true);
    try{await salvarCartao(editando.id,novoNome,valor,d);toast.success("Cartão e orçamento atualizados.");setEditando(null);}
    catch(error){toast.error(error instanceof Error?error.message:"Não foi possível atualizar o cartão.");}
    finally{setSalvandoEdicao(false);}
  }

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
          <div className="space-y-1"><Label>Saldo disponível (R$)</Label><Input className="h-12" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" /></div><div className="space-y-1"><Label>Valor destinado às compras (R$)</Label><Input className="h-12" inputMode="decimal" value={destinado} onChange={e=>setDestinado(e.target.value)} placeholder="Ex.: 500,00" /><p className="text-xs text-muted-foreground">Este valor será o orçamento da compra mensal.</p></div>
          <Button type="submit" size="lg" className="h-12 w-full rounded-2xl">Salvar cartão</Button>
        </form>
      )}
      {editando && <form onSubmit={salvarEdicao} className="mb-5 space-y-3 rounded-3xl border bg-card p-5 shadow-soft"><h2 className="font-bold">Editar cartão</h2><Label>Nome do cartão</Label><Input className="h-12" value={novoNome} onChange={e=>setNovoNome(e.target.value)} required/><Label>Saldo disponível (R$)</Label><Input className="h-12" inputMode="decimal" value={novoSaldo} onFocus={e=>e.currentTarget.select()} onChange={e=>setNovoSaldo(e.target.value)} required/><Label>Valor destinado às compras (R$)</Label><Input className="h-12" inputMode="decimal" value={novoDestinado} onFocus={e=>e.currentTarget.select()} onChange={e=>setNovoDestinado(e.target.value)} required/><p className="text-xs text-muted-foreground">Este valor aparece no card Saldo do orçamento.</p><div className="flex gap-2"><Button type="submit" disabled={salvandoEdicao} className="flex-1">Salvar alterações</Button><Button type="button" variant="outline" onClick={()=>setEditando(null)}>Cancelar</Button></div></form>}
      {excluindo && (()=>{const cartao=cartoes.find(c=>c.id===excluindo);if(!cartao)return null;return <div className="mb-5 rounded-3xl border border-red-200 bg-card p-5 shadow-soft"><h2 className="text-lg font-bold">Excluir cartão?</h2>{consultandoVinculos?<p className="mt-2 text-sm">Consultando listas vinculadas...</p>:<p className="mt-2 text-sm text-muted-foreground">{listasVinculadas.length>0?<>Este cartão está vinculado {listasVinculadas.length===1?"à lista":"às listas"} <strong>{listasVinculadas.join(", ")}</strong> da família <strong>{familia.nome}</strong>. Você deseja ainda assim excluir este cartão?</>:<>Deseja excluir <strong>{cartao.nome}</strong> ({brl(cartao.saldo)}) da família <strong>{familia.nome}</strong>?</>}<span className="mt-2 block">O cartão deixará de aparecer, mas as listas e o histórico de compras serão preservados.</span></p>}<div className="mt-4 flex gap-2"><Button type="button" variant="destructive" className="flex-1" disabled={consultandoVinculos||salvandoExclusao} onClick={async()=>{setSalvandoExclusao(true);try{await excluirCartao(cartao.id);toast.success("Cartão excluído da visualização. Listas preservadas.");setExcluindo(null);if(editando?.id===cartao.id)setEditando(null);}catch(error){toast.error(error instanceof Error?error.message:"Não foi possível excluir o cartão.");}finally{setSalvandoExclusao(false);}}}>{salvandoExclusao?"Excluindo...":"Sim, excluir cartão"}</Button><Button type="button" variant="outline" onClick={()=>setExcluindo(null)}>Cancelar</Button></div></div>})()}
      <ul className="space-y-4">
        {cartoes.map((c) => (
          <li key={c.id} className={`rounded-3xl p-5 shadow-soft ${estilo[c.cor]}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.nome}</span>
              <div className="flex items-center gap-2"><button type="button" className="rounded-lg p-2" aria-label={"Editar saldo de "+c.nome} onClick={()=>{setEditando(c);setNovoNome(c.nome);setNovoSaldo(String(c.saldo));setNovoDestinado(String(listas.find(l=>l.cartao_id===c.id&&l.tipo==="normal")?.orcamento||0));}}><Pencil className="h-5 w-5"/></button><button type="button" className="rounded-lg p-2" aria-label={"Excluir cartão "+c.nome} onClick={async()=>{setExcluindo(c.id);setListasVinculadas([]);setConsultandoVinculos(true);const {data,error}=await supabase.from("listas_compras").select("nome").eq("familia_id",familia.id).eq("cartao_id",c.id);setConsultandoVinculos(false);if(error){toast.error("Não foi possível consultar as listas vinculadas.");setExcluindo(null);return;}setListasVinculadas((data||[]).map(l=>l.nome));}}><Trash2 className="h-5 w-5"/></button><CreditCard className="h-6 w-6 opacity-80" /></div>
            </div>
            <p className="mt-6 text-sm opacity-75">Saldo disponível</p>
            <p className="font-display text-3xl font-extrabold">{brl(c.saldo)}</p>
          </li>
        ))}
      </ul>
    </Page>
  );
}
