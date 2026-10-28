import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const SETORES = ["Hortifrúti", "Mercearia", "Laticínios", "Carnes", "Padaria", "Limpeza", "Bebidas", "Higiene"] as const;
export type Setor = (typeof SETORES)[number];
export type Cartao = { id: string; nome: string; saldo: number; cor: "verde" | "escuro" | "claro" };
export type ItemLista = { id: string; nome: string; setor: Setor; qtd: number; preco: number; comprado: boolean; inesperado?: boolean };
export type ProdutoCatalogo = { id: string; nome: string; setor: Setor; precoRef: number };
export type Compra = { id: string; data: string; cartao: string; total: number; itens: number };
export type Familia = { id: string; nome: string; codigo: string };
export type ListaCompras = { id: string; nome: string; cartao_id: string; orcamento: number; valor_reservado: number; status: string; tipo: string };
export const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const totalItem = (i: ItemLista) => i.qtd * i.preco;
const db = supabase as any;

type Store = {
 familia: Familia; cartoes: Cartao[]; listas: ListaCompras[]; listaId: string; selecionarLista: (id: string) => void;
 criarLista: (nome: string, cartaoId: string, orcamento: number, reserva: number) => Promise<void>;
 itens: ItemLista[]; catalogo: ProdutoCatalogo[]; historico: Compra[]; orcamento: number; cartaoCompraId: string;
 addCartao: (nome: string, saldo: number) => Promise<void>; toggleItem: (id: string) => Promise<void>;
 addItem: (i: Omit<ItemLista, "id" | "comprado">) => Promise<void>; updateItem: (id: string, patch: Partial<Pick<ItemLista, "nome" | "setor" | "qtd" | "preco">>) => Promise<void>; removeItem: (id: string) => Promise<void>;
 finalizarCompra: () => Promise<void>;
};
const Ctx = createContext<Store | null>(null);
function check(error: any) { if (error) { toast.error(error.message || "Erro ao salvar"); throw error; } }
export function StoreProvider({ familia, children }: { familia: Familia; children: ReactNode }) {
 const fid = familia.id, qc = useQueryClient();
 const [selectedId, setSelectedId] = useState("");
 const cardsQ = useQuery({ queryKey: ["cartoes", fid], queryFn: async () => {
  const { data, error } = await db.from("cartoes").select("*").eq("familia_id", fid).order("created_at"); check(error);
  return (data || []).map((r: any): Cartao => ({ id:r.id, nome:r.nome, saldo:Number(r.saldo), cor:r.cor === "verde" || r.cor === "escuro" ? r.cor : "claro" }));
 }});
 const listasQ = useQuery({ queryKey: ["listas", fid], queryFn: async () => {
  const { data, error } = await db.from("listas_compras").select("*").eq("familia_id", fid).eq("status","em_andamento").order("created_at",{ascending:false}); check(error);
  return (data || []).map((r:any): ListaCompras => ({id:r.id,nome:r.nome,cartao_id:r.cartao_id,orcamento:Number(r.orcamento),valor_reservado:Number(r.valor_reservado),status:r.status,tipo:r.tipo}));
 }});
 const cartoes = cardsQ.data || [], listas = listasQ.data || [];
 const listaId = listas.some(l=>l.id === selectedId) ? selectedId : (listas.find(l=>l.tipo==="normal")?.id || listas[0]?.id || "");
 const lista = listas.find(l=>l.id === listaId);
 const itensQ = useQuery({queryKey:["itens",fid,listaId],enabled:!!listaId,queryFn:async()=>{
  const {data,error}=await db.from("itens_lista").select("*").eq("familia_id",fid).eq("lista_id",listaId).order("created_at");check(error);
  return (data || []).map((r:any):ItemLista=>({id:r.id,nome:r.nome,setor:r.setor as Setor,qtd:Number(r.qtd),preco:Number(r.preco||0),comprado:r.comprado,inesperado:r.inesperado}));
 }});
 const catQ=useQuery({queryKey:["produtos",fid],queryFn:async()=>{const {data,error}=await db.from("produtos").select("*").eq("familia_id",fid).order("nome");check(error);return (data||[]).map((r:any):ProdutoCatalogo=>({id:r.id,nome:r.nome,setor:r.setor as Setor,precoRef:Number(r.preco_ref||0)}));}});
 const histQ=useQuery({queryKey:["compras",fid],queryFn:async()=>{const {data,error}=await db.from("compras").select("*").eq("familia_id",fid).order("created_at",{ascending:false});check(error);return (data||[]).map((r:any):Compra=>({id:r.id,data:r.data,cartao:r.cartao,total:Number(r.total),itens:r.itens}));}});
 const itens=itensQ.data || [];
 const refresh=async(...keys:string[])=>{await Promise.all(keys.map(k=>qc.invalidateQueries({queryKey:[k,fid]})));};
 const store:Store={familia,cartoes,listas,listaId,selecionarLista:setSelectedId,itens,catalogo:catQ.data||[],historico:histQ.data||[],orcamento:lista?.orcamento||0,cartaoCompraId:lista?.cartao_id||"",
 addCartao:async(nome,saldo)=>{if(!nome.trim()||saldo<0||!Number.isFinite(saldo))throw new Error("Dados inválidos");const {error}=await db.from("cartoes").insert({familia_id:fid,nome,saldo,cor:"claro"});check(error);await refresh("cartoes");},
 criarLista:async(nome,cartaoId,orcamento,reserva)=>{const card=cartoes.find(c=>c.id===cartaoId);if(!card||!nome.trim()||orcamento<=0||reserva<0||orcamento+reserva>card.saldo){toast.error("Confira o cartão, o orçamento e a reserva.");return;}const {data,error}=await db.from("listas_compras").insert({familia_id:fid,cartao_id:cartaoId,nome,orcamento,valor_reservado:reserva,status:"em_andamento",tipo:"normal"}).select("id").single();check(error);await refresh("listas");if(data?.id)setSelectedId(data.id);},
 toggleItem:async(id)=>{const item=itens.find(i=>i.id===id);if(!item)return;if(!item.comprado && !(item.preco>0)){toast.error("Informe o preço antes de enviar ao Carrinho.");return;}const {error}=await db.from("itens_lista").update({comprado:!item.comprado}).eq("id",id).eq("lista_id",listaId);check(error);await refresh("itens");},
 updateItem:async(id,patch)=>{const item=itens.find(i=>i.id===id);if(!item)return;const updated={...item,...patch};if(!updated.nome.trim()||!Number.isFinite(updated.qtd)||updated.qtd<=0||!Number.isFinite(updated.preco)||updated.preco<0){toast.error("Confira os dados do produto.");return;}const {error}=await db.from("itens_lista").update(patch).eq("id",id).eq("lista_id",listaId).eq("familia_id",fid);check(error);await refresh("itens");},
 removeItem:async(id)=>{const {error}=await db.from("itens_lista").delete().eq("id",id).eq("lista_id",listaId);check(error);await refresh("itens");},
 addItem:async(novo)=>{if(!listaId){toast.error("Crie uma lista antes de adicionar produtos.");return;}const {error}=await db.from("itens_lista").insert({familia_id:fid,lista_id:listaId,nome:novo.nome,setor:novo.setor,qtd:novo.qtd,preco:novo.preco,inesperado:!!novo.inesperado});check(error);
 if(!(catQ.data||[]).some(p=>p.nome.toLowerCase()===novo.nome.toLowerCase())){const {error:catalogError}=await db.from("produtos").insert({familia_id:fid,nome:novo.nome,setor:novo.setor,preco_ref:novo.preco});if(catalogError && catalogError.code!=="23505")toast.error("Produto salvo, mas catálogo não atualizado.");}await refresh("itens","produtos");},
 finalizarCompra:async()=>{if(!listaId){toast.error("Selecione uma lista.");return;}if(!itens.some(i=>i.comprado)){toast.error("Marque pelo menos um produto comprado.");return;}const {error}=await db.rpc("finalizar_compra",{_lista_id:listaId});check(error);setSelectedId("");await refresh("cartoes","listas","itens","compras");toast.success("Compra finalizada! Saldo e histórico atualizados.");}
 };
 return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useDemo(){const store=useContext(Ctx);if(!store)throw new Error("useDemo fora do provider");return store;}
export function orcamentoEmAlerta(orcamento:number,gasto:number){return orcamento>0&&orcamento-gasto<=orcamento*.2;}
