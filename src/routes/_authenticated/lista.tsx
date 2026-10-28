import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Trash2, Zap, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
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
  const { itens, toggleItem, updateItem, removeItem, finalizarCompra, listas, listaId, selecionarLista, criarLista, cartoes, importarListaPadrao } = useDemo();
  const [editando, setEditando] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({nome:"",setor:"Mercearia"});
  const [rascunhos, setRascunhos] = useState<Record<string,{qtd:string,preco:string}>>({});
  useEffect(()=>{setRascunhos(Object.fromEntries(itens.map(i=>[i.id,{qtd:String(i.qtd),preco:i.preco?String(i.preco):""}])));},[itens]);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [reserva, setReserva] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
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
  const pendentes = itens.filter(i=>!i.comprado);
  const carrinho = itens.filter(i=>i.comprado);
  const totalCarrinho = carrinho.reduce((s,i)=>s+totalItem(i),0);
  async function salvarCampo(id:string,campo:"qtd"|"preco") {const valor=Number((rascunhos[id]?.[campo]||"").replace(",","."));if(!Number.isFinite(valor)||(campo==="qtd"?valor<=0:valor<0)){toast.error("Valor inválido.");return;}try{await updateItem(id,{[campo]:valor});}catch{toast.error("Não foi possível salvar.");}}
  function campo(i:(typeof itens)[number], tipo:"qtd"|"preco") {
    const atual = tipo==="qtd" ? String(i.qtd) : (i.preco ? String(i.preco) : "");
    return <Input aria-label={(tipo==="qtd"?"Quantidade de ":"Preço de ")+i.nome}
      className="h-12 w-full min-w-0 rounded-xl text-base" type="text" inputMode="decimal"
      placeholder={tipo==="preco"?"R$ 0,00":"Quantidade"}
      value={rascunhos[i.id]?.[tipo]??atual}
      onFocus={e=>e.currentTarget.select()}
      onClick={e=>e.currentTarget.select()}
      onChange={e=>setRascunhos(p=>({...p,[i.id]:{qtd:p[i.id]?.qtd??String(i.qtd),preco:p[i.id]?.preco??String(i.preco),[tipo]:e.target.value}}))}
      onBlur={()=>salvarCampo(i.id,tipo)}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>;
  }
  function tabela(lista:typeof itens,titulo:string){return <section className="mt-6">
    <h2 className="mb-3 text-lg font-bold">{titulo} ({lista.length})</h2>
    <div className="space-y-3">{lista.map(i=><article key={i.id} className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-base break-words">{i.nome}</p><p className="text-sm text-muted-foreground">{i.setor}</p></div>
      <div className="flex shrink-0 gap-2"><button className="rounded-xl border p-3" aria-label={"Editar "+i.nome} onClick={()=>{setEditando(i.id);setEdicao({nome:i.nome,setor:i.setor});}}><Pencil className="h-5 w-5"/></button><button className="rounded-xl border p-3" aria-label={"Excluir "+i.nome} onClick={()=>removeItem(i.id).catch(()=>{})}><Trash2 className="h-5 w-5"/></button></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="min-w-0 text-sm font-medium">Quantidade{campo(i,"qtd")}</label><label className="min-w-0 text-sm font-medium">Preço unitário{campo(i,"preco")}</label></div>
      <div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Valor total</p><strong className="text-lg">{brl(totalItem(i))}</strong></div><Button type="button" variant={i.comprado?"outline":"default"} className="min-h-12" onClick={()=>toggleItem(i.id).catch(()=>{})}>{i.comprado?"Voltar à lista":"Colocar no carrinho"}</Button></div>
    </article>)}</div>
    <div className="hidden overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted"><tr>{["","Produto","Setor","Quantidade","Valor unitário","Valor total","Ações"].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{lista.map(i=><tr key={i.id} className="border-t"><td className="p-2"><button aria-label={i.comprado?"Voltar para lista":"Enviar ao carrinho"} onClick={()=>toggleItem(i.id).catch(()=>{})} className="rounded border p-2">{i.comprado?<Check className="h-4 w-4"/>:<span className="block h-4 w-4"/>}</button></td><td className="p-2 font-medium">{i.nome}</td><td className="p-2">{i.setor}</td><td className="w-28 p-2">{campo(i,"qtd")}</td><td className="w-36 p-2">{campo(i,"preco")}</td><td className="p-2 font-semibold">{brl(totalItem(i))}</td><td className="p-2"><div className="flex gap-2"><button aria-label={"Editar "+i.nome} onClick={()=>{setEditando(i.id);setEdicao({nome:i.nome,setor:i.setor});}}><Pencil className="h-4 w-4"/></button><button aria-label={"Excluir "+i.nome} onClick={()=>removeItem(i.id).catch(()=>{})}><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>
  </section>}

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
      {listaId && <div className="mb-4 rounded-2xl border bg-card p-4"><p className="mb-2 text-sm text-muted-foreground">Lista mensal baseada na planilha de setembro. Mantém os itens já cadastrados e não duplica nomes. Os preços ficam em branco para preencher durante a compra.</p><Button type="button" variant="outline" className="w-full min-h-12" disabled={importando} onClick={async()=>{if(!window.confirm("Adicionar os produtos da lista padrão a esta lista, sem apagar os itens existentes?"))return;setImportando(true);try{const n=await importarListaPadrao();toast.success(n?`${n} produtos adicionados à lista.`:"Todos os produtos da lista padrão já estão presentes.");}catch{toast.error("Não foi possível carregar a lista padrão.");}finally{setImportando(false);}}}>{importando?"Carregando produtos...":"Carregar lista padrão do mês"}</Button></div>}
      {listaId && <BudgetCard />}
      {listaId && <div className="mt-4 grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-14 rounded-2xl"><Link to="/adicionar"><Plus className="h-5 w-5" /> Adicionar</Link></Button>
        <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl"><Link to="/adicionar" search={{ inesperado: true }}><Zap className="h-5 w-5" /> Item inesperado</Link></Button>
      </div>}

      {listaId && tabela(pendentes,"Lista de Compras")}
      {listaId && tabela(carrinho,"Carrinho")}
      {listaId && <p className="mt-4 text-sm">No carrinho: {brl(totalCarrinho)} · Produtos pendentes: {pendentes.length} · Total com preços informados: {brl(total)}</p>}
      {editando && <div className="mt-4 rounded-2xl border bg-card p-4"><h3 className="font-semibold">Editar produto e setor</h3><Input className="mt-2" value={edicao.nome} onChange={e=>setEdicao(p=>({...p,nome:e.target.value}))}/><select className="mt-2 w-full rounded-xl border bg-background p-3" value={edicao.setor} onChange={e=>setEdicao(p=>({...p,setor:e.target.value}))}>{["Hortifrúti","Mercearia","Laticínios","Carnes","Padaria","Limpeza","Bebidas","Higiene"].map(s=><option key={s}>{s}</option>)}</select><div className="mt-3 flex gap-2"><Button onClick={async()=>{try{await updateItem(editando,{nome:edicao.nome,setor:edicao.setor as (typeof itens)[number]["setor"]});setEditando(null);}catch{toast.error("Não foi possível editar.");}}}>Salvar</Button><Button variant="outline" onClick={()=>setEditando(null)}>Cancelar</Button></div></div>}
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
