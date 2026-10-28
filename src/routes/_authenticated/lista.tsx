import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Trash2, Zap, Pencil, Search, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
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
  const [aba, setAba] = useState<"lista"|"carrinho">("lista");
  const [busca, setBusca] = useState("");
  const [recolhidos, setRecolhidos] = useState<string[]>([]);
  const [setorEditando, setSetorEditando] = useState<string | null>(null);
  const [setorFiltro, setSetorFiltro] = useState("Todos");
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
  const [modeloCarregado, setModeloCarregado] = useState<Record<string, boolean>>({});
  useEffect(()=>{if(!listaId)return;try{setModeloCarregado(p=>({...p,[listaId]:localStorage.getItem("mercado-facil-modelo-"+listaId)==="sim"}));}catch{}},[listaId]);
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
      className="h-10 w-full min-w-0 rounded-lg px-2 text-base tabular-nums" type="text" inputMode="decimal"
      placeholder={tipo==="preco"?"R$ 0,00":"Quantidade"}
      value={rascunhos[i.id]?.[tipo]??atual}
      onFocus={e=>e.currentTarget.select()}
      onClick={e=>e.currentTarget.select()}
      onChange={e=>setRascunhos(p=>({...p,[i.id]:{qtd:p[i.id]?.qtd??String(i.qtd),preco:p[i.id]?.preco??String(i.preco),[tipo]:e.target.value}}))}
      onBlur={()=>salvarCampo(i.id,tipo)}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>;
  }
  const setores = ["Todos",...Array.from(new Set(itens.map(i=>i.setor)))];
  const visiveis = (aba==="lista"?pendentes:carrinho).filter(i=>(setorFiltro==="Todos"||i.setor===setorFiltro)&&i.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")));
  function tabela(lista:typeof itens){
    const grupos=aba==="carrinho"?[["Carrinho",lista] as const]:Array.from(new Set(lista.map(i=>i.setor))).map(setor=>[setor,lista.filter(i=>i.setor===setor)] as const);
    return <section className="mt-3 space-y-3" aria-label={aba==="lista"?"Produtos pendentes":"Produtos no carrinho"}>
      {lista.length===0&&<div className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado nesta aba.</div>}
      {grupos.map(([setor,produtos])=><div key={setor} className="overflow-hidden rounded-2xl border bg-card">
        {aba==="lista"&&<button className="flex w-full items-center justify-between bg-emerald-50 px-3 py-3 text-left text-sm font-bold text-emerald-950" onClick={()=>setRecolhidos(p=>p.includes(setor)?p.filter(x=>x!==setor):[...p,setor])}><span>{setor}</span><span className="flex items-center gap-2"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-normal">{produtos.length} itens</span>{recolhidos.includes(setor)?<ChevronDown className="h-4 w-4"/>:<ChevronUp className="h-4 w-4"/>}</span></button>}
        {!recolhidos.includes(setor)&&<><div className="grid grid-cols-[minmax(0,1fr)_42px_76px_66px_36px] items-center gap-1 border-b bg-muted/60 px-2 py-2 text-[10px] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,1fr)_52px_90px_86px_40px] sm:text-xs"><span>Produto</span><span>Qtd</span><span>Preço un.</span><span className="text-right">Total</span><span/></div>
        {produtos.map(i=><div key={i.id} className="grid grid-cols-[minmax(0,1fr)_42px_76px_66px_36px] items-center gap-1 border-b px-2 py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_52px_90px_86px_40px]"><div className="min-w-0"><button type="button" title={"Editar setor de "+i.nome} aria-label={"Editar setor de "+i.nome} className="w-full break-words text-left text-xs font-medium leading-tight underline decoration-dotted underline-offset-2 sm:text-sm" onClick={()=>setSetorEditando(i.id)}>{i.nome}</button></div><div className="min-w-0">{campo(i,"qtd")}</div><div className="min-w-0">{campo(i,"preco")}</div><strong className="min-w-0 text-right text-[11px] tabular-nums sm:text-sm">{brl(totalItem(i))}</strong><button type="button" aria-label={i.comprado?"Devolver "+i.nome+" à lista":"Colocar "+i.nome+" no carrinho"} title={i.comprado?"Devolver à lista":"Colocar no carrinho"} className={"flex h-9 w-9 items-center justify-center rounded-lg "+(i.comprado?"bg-emerald-100 text-emerald-900":"bg-emerald-800 text-white")} onClick={()=>toggleItem(i.id).catch(()=>{})}>{i.comprado?<Check className="h-4 w-4"/>:<ShoppingCart className="h-4 w-4"/>}</button></div>)}</>}
      </div>)}
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
      {listaId && !modeloCarregado[listaId] && itens.length < 50 && <div className="mb-4 rounded-2xl border bg-card p-4"><p className="mb-2 text-sm text-muted-foreground">Lista mensal baseada na planilha de setembro. Mantém os itens já cadastrados e não duplica nomes. Os preços ficam em branco para preencher durante a compra.</p><Button type="button" variant="outline" className="w-full min-h-12" disabled={importando} onClick={async()=>{if(!window.confirm("Adicionar os produtos da lista padrão a esta lista, sem apagar os itens existentes?"))return;setImportando(true);try{const n=await importarListaPadrao();setModeloCarregado(p=>({...p,[listaId]:true}));try{localStorage.setItem("mercado-facil-modelo-"+listaId,"sim");}catch{}toast.success(n?`${n} produtos adicionados à lista.`:"Todos os produtos da lista padrão já estão presentes.");}catch{toast.error("Não foi possível carregar a lista padrão.");}finally{setImportando(false);}}}>{importando?"Carregando produtos...":"Carregar lista padrão do mês"}</Button></div>}
      {listaId && <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 py-2 backdrop-blur"><div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-950"><div className="text-sm font-semibold">Orçamento: {brl(listas.find(l=>l.id===listaId)?.orcamento||0)}</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-800" style={{width:`${Math.min(100,(totalCarrinho/Math.max(1,Number(listas.find(l=>l.id===listaId)?.orcamento||0)))*100)}%`}}/></div><div className="mt-2 flex justify-between gap-2 text-xs"><span>Gasto: <strong>{brl(totalCarrinho)}</strong></span><span>Restante: <strong>{brl(Math.max(0,Number(listas.find(l=>l.id===listaId)?.orcamento||0)-totalCarrinho))}</strong></span></div></div></div>}
      {listaId && <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild size="lg" className="h-11 rounded-xl"><Link to="/adicionar"><Plus className="h-5 w-5" /> Adicionar</Link></Button>
        <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl"><Link to="/adicionar" search={{ inesperado: true }}><Zap className="h-5 w-5" /> Item inesperado</Link></Button>
      </div>}

      {listaId && <div className="mt-3"><div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1"><button className={"min-h-12 rounded-xl text-sm font-semibold "+(aba==="lista"?"bg-primary text-primary-foreground shadow-sm":"")} onClick={()=>setAba("lista")}>Lista ({pendentes.length})</button><button className={"min-h-12 rounded-xl text-sm font-semibold "+(aba==="carrinho"?"bg-primary text-primary-foreground shadow-sm":"")} onClick={()=>setAba("carrinho")}>Carrinho ({carrinho.length})</button></div><div className="sticky top-[118px] z-10 mt-2 bg-background/95 py-2 backdrop-blur"><label className="flex h-12 items-center gap-2 rounded-xl border bg-card px-3"><Search className="h-5 w-5 text-muted-foreground"/><input className="w-full min-w-0 bg-transparent text-base outline-none" placeholder="Buscar produto..." value={busca} onChange={e=>setBusca(e.target.value)}/></label><div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{setores.map(setor=><button key={setor} onClick={()=>setSetorFiltro(setor)} className={"shrink-0 rounded-full border px-3 py-2 text-xs font-medium "+(setorFiltro===setor?"bg-primary text-primary-foreground":"bg-card")}>{setor}</button>)}</div></div>{tabela(visiveis)}</div>}
      {listaId && <p className="mt-4 text-sm">No carrinho: {brl(totalCarrinho)} · Produtos pendentes: {pendentes.length} · Total com preços informados: {brl(total)}</p>}
      {setorEditando && (()=>{const item=itens.find(i=>i.id===setorEditando);if(!item)return null;return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"><div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl"><h3 className="mb-1 text-lg font-bold">Editar setor</h3><p className="mb-3 text-sm text-muted-foreground">{item.nome}</p><label className="text-sm font-medium">Categoria / setor<select autoFocus className="mt-2 h-12 w-full rounded-xl border bg-background px-3 text-base" value={item.setor} onChange={async e=>{try{await updateItem(item.id,{setor:e.target.value as typeof item.setor});toast.success("Setor atualizado.");setSetorEditando(null);}catch{toast.error("Não foi possível atualizar o setor.");}}}>{Array.from(new Set([...itens.map(p=>p.setor),"Mercearia","Higiene","Limpeza","Laticínios","Hortifrúti","Carnes","Padaria","Bebidas","Outros","Lavínia","Proteína","Temperos"])).sort((a,b)=>a.localeCompare(b,"pt-BR")).map(setor=><option key={setor} value={setor}>{setor}</option>)}</select></label><Button variant="outline" className="mt-4 w-full" onClick={()=>setSetorEditando(null)}>Cancelar</Button></div></div>})()}
      {editando && <div className="mt-4 rounded-2xl border bg-card p-4"><h3 className="font-semibold">Editar produto e setor</h3><Input className="mt-2" value={edicao.nome} onChange={e=>setEdicao(p=>({...p,nome:e.target.value}))}/><select className="mt-2 w-full rounded-xl border bg-background p-3" value={edicao.setor} onChange={e=>setEdicao(p=>({...p,setor:e.target.value}))}>{["Hortifrúti","Mercearia","Laticínios","Carnes","Padaria","Limpeza","Bebidas","Higiene"].map(s=><option key={s}>{s}</option>)}</select><div className="mt-3 flex gap-2"><Button onClick={async()=>{try{await updateItem(editando,{nome:edicao.nome,setor:edicao.setor as (typeof itens)[number]["setor"]});setEditando(null);}catch{toast.error("Não foi possível editar.");}}}>Salvar</Button><Button variant="outline" onClick={()=>setEditando(null)}>Cancelar</Button></div></div>}
      {listaId && aba==="carrinho" && <div className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-950">
        <span className="font-medium">Total da compra</span>
        <span className="font-display text-xl font-extrabold">{brl(totalCarrinho)}</span>
      </div>}
      {listaId && aba==="carrinho" && <Button size="lg" className="mt-4 h-14 w-full rounded-2xl text-base" disabled={!itens.some(i => i.comprado)} onClick={() => finalizarCompra().catch(() => {})}>
        Finalizar compra (itens marcados)
      </Button>}
    </Page>
  );
}
