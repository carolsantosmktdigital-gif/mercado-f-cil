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

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const totalItem = (i: ItemLista) => i.qtd * i.preco;

// Cartões e orçamento ainda são fictícios (não salvos).
const cartoesIniciais: Cartao[] = [
  { id: "c1", nome: "Alimentação Empresa", saldo: 842.5, cor: "verde" },
  { id: "c2", nome: "Vale-compras Família", saldo: 310.0, cor: "escuro" },
  { id: "c3", nome: "Cartão Refeição", saldo: 127.8, cor: "claro" },
];

type Store = {
  familia: Familia;
  cartoes: Cartao[];
  itens: ItemLista[];
  catalogo: ProdutoCatalogo[];
  historico: Compra[];
  orcamento: number;
  cartaoCompraId: string;
  addCartao: (nome: string, saldo: number) => void;
  toggleItem: (id: string) => void;
  addItem: (i: Omit<ItemLista, "id" | "comprado">) => Promise<void>;
  removeItem: (id: string) => void;
  finalizarCompra: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
let seq = 100;

const falha = (e: { message: string } | null) => {
  if (e) { toast.error("Não foi possível salvar: " + e.message); throw e; }
};

export function StoreProvider({ familia, children }: { familia: Familia; children: ReactNode }) {
  const qc = useQueryClient();
  const fid = familia.id;
  const [cartoes, setCartoes] = useState(cartoesIniciais);

  const itensQ = useQuery({
    queryKey: ["itens", fid],
    queryFn: async () => {
      const { data, error } = await supabase.from("itens_lista").select("*").eq("familia_id", fid).order("created_at");
      if (error) throw error;
      return data.map((r) => ({ id: r.id, nome: r.nome, setor: r.setor as Setor, qtd: Number(r.qtd), preco: Number(r.preco), comprado: r.comprado, inesperado: r.inesperado }));
    },
  });
  const catQ = useQuery({
    queryKey: ["produtos", fid],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").eq("familia_id", fid).order("nome");
      if (error) throw error;
      return data.map((r) => ({ id: r.id, nome: r.nome, setor: r.setor as Setor, precoRef: Number(r.preco_ref) }));
    },
  });
  const histQ = useQuery({
    queryKey: ["compras", fid],
    queryFn: async () => {
      const { data, error } = await supabase.from("compras").select("*").eq("familia_id", fid).order("data", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((r) => ({ id: r.id, data: r.data, cartao: r.cartao, total: Number(r.total), itens: r.itens }));
    },
  });

  const itens = itensQ.data ?? [];
  const recarregar = (k: string) => qc.invalidateQueries({ queryKey: [k, fid] });
  const cartaoCompraId = "c2";

  const store: Store = {
    familia,
    cartoes,
    itens,
    catalogo: catQ.data ?? [],
    historico: histQ.data ?? [],
    orcamento: 300,
    cartaoCompraId,
    addCartao: (nome, saldo) => setCartoes((c) => [...c, { id: "c" + seq++, nome, saldo, cor: "claro" }]),
    toggleItem: async (id) => {
      const it = itens.find((i) => i.id === id);
      if (!it) return;
      qc.setQueryData<ItemLista[]>(["itens", fid], (l) => l?.map((i) => (i.id === id ? { ...i, comprado: !i.comprado } : i)));
      const { error } = await supabase.from("itens_lista").update({ comprado: !it.comprado }).eq("id", id);
      if (error) toast.error("Não foi possível salvar.");
      recarregar("itens");
    },
    removeItem: async (id) => {
      qc.setQueryData<ItemLista[]>(["itens", fid], (l) => l?.filter((i) => i.id !== id));
      const { error } = await supabase.from("itens_lista").delete().eq("id", id);
      if (error) toast.error("Não foi possível remover.");
      recarregar("itens");
    },
    addItem: async (novo) => {
      const { error } = await supabase.from("itens_lista").insert({
        familia_id: fid, nome: novo.nome, setor: novo.setor, qtd: novo.qtd, preco: novo.preco, inesperado: !!novo.inesperado,
      });
      falha(error);
      // Produtos novos entram automaticamente no catálogo
      if (!(catQ.data ?? []).some((p) => p.nome.toLowerCase() === novo.nome.toLowerCase())) {
        await supabase.from("produtos").insert({ familia_id: fid, nome: novo.nome, setor: novo.setor, preco_ref: novo.preco });
      }
      recarregar("itens"); recarregar("produtos");
    },
    finalizarCompra: async () => {
      const comprados = itens.filter((i) => i.comprado);
      if (!comprados.length) { toast.error("Marque ao menos um produto como comprado."); return; }
      const cartao = cartoes.find((c) => c.id === cartaoCompraId)?.nome ?? "Cartão";
      const { error } = await supabase.from("compras").insert({
        familia_id: fid, cartao, total: comprados.reduce((s, i) => s + totalItem(i), 0), itens: comprados.length,
      });
      falha(error);
      await supabase.from("itens_lista").delete().in("id", comprados.map((i) => i.id));
      recarregar("itens"); recarregar("compras");
      toast.success("Compra salva no histórico.");
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useDemo fora do provider");
  return s;
}

/** Retorna true quando o saldo restante é 20% ou menos do orçamento inicial. */
export function orcamentoEmAlerta(orcamento: number, gasto: number) {
  if (orcamento <= 0) return false;
  return orcamento - gasto <= orcamento * 0.2;
}
