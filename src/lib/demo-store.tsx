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
 atualizarOrcamento: (valor: number) => Promise<void>;
 itens: ItemLista[]; catalogo: ProdutoCatalogo[]; historico: Compra[]; orcamento: number; cartaoCompraId: string;
 addCartao: (nome: string, saldo: number, destinado?: number) => Promise<void>;
 salvarCartao: (id: string, nome: string, saldo: number, destinado: number) => Promise<void>; excluirCartao: (id: string) => Promise<void>; toggleItem: (id: string) => Promise<void>;
 addItem: (i: Omit<ItemLista, "id" | "comprado">) => Promise<void>; updateItem: (id: string, patch: Partial<Pick<ItemLista, "nome" | "setor" | "qtd" | "preco">>) => Promise<void>; removeItem: (id: string) => Promise<void>;
 importarListaPadrao: () => Promise<number>; finalizarCompra: () => Promise<void>;
};
const Ctx = createContext<Store | null>(null);
function check(error: any) { if (error) { toast.error(error.message || "Erro ao salvar"); throw error; } }
export function StoreProvider({ familia, children }: { familia: Familia; children: ReactNode }) {
 const fid = familia.id, qc = useQueryClient();
 const [selectedId, setSelectedId] = useState("");
 const cardsQ = useQuery({ queryKey: ["cartoes", fid], queryFn: async () => {
  const { data, error } = await db.from("cartoes").select("*").eq("familia_id", fid).is("excluido_em",null).order("created_at"); check(error);
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
 addCartao:async(nome,saldo,destinado=0)=>{if(!nome.trim()||saldo<0||!Number.isFinite(saldo)||destinado<0||!Number.isFinite(destinado)||destinado>saldo)throw new Error("Confira o saldo e o valor destinado.");const {data,error}=await db.from("cartoes").insert({familia_id:fid,nome,saldo,cor:"claro"}).select("id").single();check(error);if(destinado>0){const {error:listaError}=await db.from("listas_compras").insert({familia_id:fid,cartao_id:data.id,nome:"Compra do mês",orcamento:destinado,valor_reservado:0,status:"em_andamento",tipo:"normal"});check(listaError);}await refresh("cartoes","listas");},
 salvarCartao:async(id,nome,saldo,destinado)=>{if(!nome.trim()||!Number.isFinite(saldo)||saldo<0||!Number.isFinite(destinado)||destinado<0||destinado>saldo)throw new Error("O valor destinado deve ser menor ou igual ao saldo.");const relacionadas=listas.filter(l=>l.cartao_id===id&&l.tipo==="normal");if(relacionadas.length>1)throw new Error("Há mais de uma lista mensal neste cartão. Ajuste o orçamento diretamente na lista.");const listaCartao=relacionadas[0];if(listaCartao&&destinado+listaCartao.valor_reservado>saldo)throw new Error("O orçamento e a reserva ultrapassam o saldo do cartão.");const {error}=await db.from("cartoes").update({nome:nome.trim(),saldo}).eq("id",id).eq("familia_id",fid);check(error);if(listaCartao){const {error:err}=await db.from("listas_compras").update({orcamento:destinado}).eq("id",listaCartao.id).eq("familia_id",fid);check(err);}else if(destinado>0){const {error:err}=await db.from("listas_compras").insert({familia_id:fid,cartao_id:id,nome:"Compra do mês",orcamento:destinado,valor_reservado:0,status:"em_andamento",tipo:"normal"});check(err);}await refresh("cartoes","listas");},
 excluirCartao:async(id)=>{const card=cartoes.find(c=>c.id===id);if(!card)throw new Error("Cartão não encontrado.");const {error}=await db.from("cartoes").update({excluido_em:new Date().toISOString()}).eq("id",id).eq("familia_id",fid);check(error);await refresh("cartoes","listas");},
 criarLista:async(nome,cartaoId,orcamento,reserva)=>{const card=cartoes.find(c=>c.id===cartaoId);if(!card||!nome.trim()||orcamento<=0||reserva<0||orcamento+reserva>card.saldo){toast.error("Confira o cartão, o orçamento e a reserva.");return;}const {data,error}=await db.from("listas_compras").insert({familia_id:fid,cartao_id:cartaoId,nome,orcamento,valor_reservado:reserva,status:"em_andamento",tipo:"normal"}).select("id").single();check(error);await refresh("listas");if(data?.id)setSelectedId(data.id);},
 atualizarOrcamento:async(valor)=>{if(!lista||!Number.isFinite(valor)||valor<=0)throw new Error("Orçamento inválido");const card=cartoes.find(c=>c.id===lista.cartao_id);if(!card||valor+lista.valor_reservado>card.saldo){toast.error("O orçamento não pode ultrapassar o saldo disponível do cartão, descontada a reserva.");throw new Error("Saldo insuficiente");}const {error}=await db.from("listas_compras").update({orcamento:valor}).eq("id",lista.id).eq("familia_id",fid);check(error);await refresh("listas");},
 toggleItem:async(id)=>{const item=itens.find(i=>i.id===id);if(!item)return;if(!item.comprado && !(item.preco>0)){toast.error("Informe o preço antes de enviar ao Carrinho.");return;}const {error}=await db.from("itens_lista").update({comprado:!item.comprado}).eq("id",id).eq("lista_id",listaId);check(error);await refresh("itens");},
 updateItem:async(id,patch)=>{const item=itens.find(i=>i.id===id);if(!item)return;const updated={...item,...patch};if(!updated.nome.trim()||!Number.isFinite(updated.qtd)||updated.qtd<=0||!Number.isFinite(updated.preco)||updated.preco<0){toast.error("Confira os dados do produto.");return;}const {error}=await db.from("itens_lista").update(patch).eq("id",id).eq("lista_id",listaId).eq("familia_id",fid);check(error);await refresh("itens");},
 removeItem:async(id)=>{const {error}=await db.from("itens_lista").delete().eq("id",id).eq("lista_id",listaId);check(error);await refresh("itens");},
 addItem:async(novo)=>{if(!listaId){toast.error("Crie uma lista antes de adicionar produtos.");return;}const {error}=await db.from("itens_lista").insert({familia_id:fid,lista_id:listaId,nome:novo.nome,setor:novo.setor,qtd:novo.qtd,preco:novo.preco,inesperado:!!novo.inesperado});check(error);
 if(!(catQ.data||[]).some(p=>p.nome.toLowerCase()===novo.nome.toLowerCase())){const {error:catalogError}=await db.from("produtos").insert({familia_id:fid,nome:novo.nome,setor:novo.setor,preco_ref:novo.preco});if(catalogError && catalogError.code!=="23505")toast.error("Produto salvo, mas catálogo não atualizado.");}await refresh("itens","produtos");},
 importarListaPadrao:async()=>{if(!listaId)throw new Error("Selecione uma lista.");const padrao=[{"nome":"Sabonetes","setor":"Higiene","qtd":6},{"nome":"Lenço umedecido","setor":"Higiene","qtd":2},{"nome":"desodorante Carol","setor":"Higiene","qtd":1},{"nome":"Desodorante Lohran","setor":"Higiene","qtd":1},{"nome":"Pasta de dente","setor":"Higiene","qtd":1},{"nome":"Gel","setor":"Higiene","qtd":1},{"nome":"Gillete","setor":"Higiene","qtd":1},{"nome":"Shampoo","setor":"Higiene","qtd":1},{"nome":"Condicionador","setor":"Higiene","qtd":1},{"nome":"pasta de dente Lavinia","setor":"Higiene","qtd":1},{"nome":"Espuma de Barbear","setor":"Higiene","qtd":1},{"nome":"Sabonete Intimo","setor":"Higiene","qtd":1},{"nome":"Sabonete líquido","setor":"Higiene","qtd":1},{"nome":"Leite Semi Desnatado","setor":"Lacticinios","qtd":6},{"nome":"Mussarela","setor":"Lacticinios","qtd":1},{"nome":"molho de tomate","setor":"Lacticinios","qtd":3},{"nome":"Margarina 500g","setor":"Lacticinios","qtd":1},{"nome":"Tapioca","setor":"Lacticinios","qtd":1},{"nome":"Danone","setor":"Lacticinios","qtd":2},{"nome":"Banana","setor":"Lacticinios","qtd":1},{"nome":"pão de queijo","setor":"Lacticinios","qtd":1},{"nome":"Leite em pó","setor":"Lavínia","qtd":6},{"nome":"Sucos lanche","setor":"Lavínia","qtd":16},{"nome":"Biscoitos Lavínia","setor":"Lavínia","qtd":4},{"nome":"Detergente","setor":"Limpeza","qtd":2},{"nome":"Barla","setor":"Limpeza","qtd":1},{"nome":"Sabão (Lavar roupas)","setor":"Limpeza","qtd":1},{"nome":"saco de lixo","setor":"Limpeza","qtd":1},{"nome":"oleo","setor":"Limpeza","qtd":1},{"nome":"Adoçante","setor":"Limpeza","qtd":1},{"nome":"Papel higiênico","setor":"Limpeza","qtd":1},{"nome":"Bombril","setor":"Limpeza","qtd":1},{"nome":"Pedra sanitária","setor":"Limpeza","qtd":2},{"nome":"pano de chão","setor":"Limpeza","qtd":1},{"nome":"Hamburguer","setor":"Limpeza","qtd":1},{"nome":"cloro","setor":"Limpeza","qtd":1},{"nome":"Amaciante","setor":"Limpeza","qtd":1},{"nome":"Açúcar","setor":"Mercearia","qtd":4},{"nome":"Arroz","setor":"Mercearia","qtd":2},{"nome":"Feijão","setor":"Mercearia","qtd":2},{"nome":"Suco","setor":"Mercearia","qtd":2},{"nome":"Miojo","setor":"Mercearia","qtd":1},{"nome":"café soluvel","setor":"Outros","qtd":1},{"nome":"Café","setor":"Padaria","qtd":1},{"nome":"Filtro de cafe 103","setor":"Padaria","qtd":1},{"nome":"Pao Integral","setor":"Padaria","qtd":4},{"nome":"Empanitos","setor":"Proteína","qtd":2},{"nome":"requeijão zero","setor":"Proteína","qtd":2},{"nome":"Carnes","setor":"Proteína","qtd":1},{"nome":"Macarrão","setor":"Temperos","qtd":1}];const existentes=new Set(itens.map(i=>i.nome.trim().toLocaleLowerCase("pt-BR")));const novos=padrao.filter(p=>!existentes.has(p.nome.trim().toLocaleLowerCase("pt-BR")));if(!novos.length)return 0;const {error}=await db.from("itens_lista").insert(novos.map(p=>({familia_id:fid,lista_id:listaId,nome:p.nome,setor:p.setor,qtd:p.qtd,preco:null,comprado:false,inesperado:false})));check(error);await refresh("itens");return novos.length;},
 finalizarCompra:async()=>{if(!listaId){toast.error("Selecione uma lista.");return;}if(!itens.some(i=>i.comprado)){toast.error("Marque pelo menos um produto comprado.");return;}const {error}=await db.rpc("finalizar_compra",{_lista_id:listaId});check(error);setSelectedId("");await refresh("cartoes","listas","itens","compras");toast.success("Compra finalizada! Saldo e histórico atualizados.");}
 };
 return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useDemo(){const store=useContext(Ctx);if(!store)throw new Error("useDemo fora do provider");return store;}
export function orcamentoEmAlerta(orcamento:number,gasto:number){return orcamento>0&&orcamento-gasto<=orcamento*.2;}
