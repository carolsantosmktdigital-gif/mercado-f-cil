import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cached,
  saveCache,
  readLocal,
  enqueue,
  enqueueFinalization,
  overlayItems,
  flushWrites,
  type PendingWrite,
} from "./offline";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const SETORES = [
  "Hortifrúti",
  "Mercearia",
  "Laticínios",
  "Carnes",
  "Padaria",
  "Limpeza",
  "Bebidas",
  "Higiene",
] as const;
export type Setor = (typeof SETORES)[number];
export type Cartao = { id: string; nome: string; saldo: number; cor: "verde" | "escuro" | "claro" };
export type ItemLista = {
  id: string;
  nome: string;
  setor: Setor;
  qtd: number;
  preco: number;
  comprado: boolean;
  inesperado?: boolean;
};
export type ProdutoCatalogo = { id: string; nome: string; setor: Setor; precoRef: number };
export type Compra = {
  id: string;
  data: string;
  cartao: string;
  total: number;
  itens: number;
  pendente?: boolean;
};
export type Familia = { id: string; nome: string; codigo: string };
export type ListaCompras = {
  id: string;
  nome: string;
  cartao_id: string;
  orcamento: number;
  valor_reservado: number;
  status: string;
  tipo: string;
};
export const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const totalItem = (i: ItemLista) =>
  Math.round((i.qtd * i.preco + Number.EPSILON) * 100) / 100;
const db = supabase as any;

type Store = {
  pendingCount: number;
  syncError: string;
  online: boolean;
  familia: Familia;
  cartoes: Cartao[];
  listas: ListaCompras[];
  listaId: string;
  selecionarLista: (id: string) => void;
  criarLista: (nome: string, cartaoId: string, orcamento: number, reserva: number) => Promise<void>;
  atualizarOrcamento: (valor: number) => Promise<void>;
  renomearLista: (id: string, nome: string) => Promise<void>;
  itens: ItemLista[];
  catalogo: ProdutoCatalogo[];
  historico: Compra[];
  orcamento: number;
  cartaoCompraId: string;
  addCartao: (nome: string, saldo: number, destinado?: number) => Promise<void>;
  salvarCartao: (id: string, nome: string, saldo: number, destinado: number) => Promise<void>;
  excluirCartao: (id: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  addItem: (i: Omit<ItemLista, "id" | "comprado">) => Promise<void>;
  updateItem: (
    id: string,
    patch: Partial<Pick<ItemLista, "nome" | "setor" | "qtd" | "preco">>,
  ) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  importarListaPadrao: () => Promise<number>;
  finalizarCompra: () => Promise<void>;
};
const Ctx = createContext<Store | null>(null);
function check(error: any) {
  if (error) {
    toast.error(error.message || "Erro ao salvar");
    throw error;
  }
}
function useLocalQuery<T>(
  fid: string,
  options: { queryKey: string[]; queryFn: () => Promise<T>; enabled?: boolean },
) {
  return useQuery({
    ...options,
    initialData: () => cached<T>(fid, options.queryKey),
    queryFn: async () => {
      const pending = readLocal(fid).pending;
      // Keep the already discounted local snapshot until finalizations are acknowledged.
      if (pending.some((p) => p.kind === "finalize")) {
        const snapshot = cached<T>(fid, options.queryKey);
        if (snapshot !== undefined) return snapshot;
      }
      const before = JSON.stringify(pending);
      const result = await options.queryFn();
      // A response started before a local edit or acknowledgement must not erase it.
      if (before !== JSON.stringify(readLocal(fid).pending)) {
        return cached<T>(fid, options.queryKey) ?? result;
      }
      return saveCache(fid, options.queryKey, result);
    },
  });
}

export function StoreProvider({ familia, children }: { familia: Familia; children: ReactNode }) {
  const fid = familia.id,
    qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(() => cached<string>(fid, ["selected"]) || "");
  const [pendingCount, setPendingCount] = useState(() => readLocal(fid).pending.length);
  const [syncError, setSyncError] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  async function syncPending() {
    try {
      const hadFinalization = readLocal(fid).pending.some((op) => op.kind === "finalize");
      await flushWrites(fid, async (op: PendingWrite) => {
        if (op.kind === "finalize") {
          const { error } = await db.rpc("finalizar_compra_offline", {
            _lista_id: op.listaId,
            _operacao_id: op.id,
            _pendencias_id: op.values["pendenciasId"],
            _total_previsto: op.values["total"],
            _qtd_prevista: op.values["quantidade"],
            _data_compra: op.values["data"],
          });
          if (error) throw error;
          return;
        }
        let request;
        if (op.kind === "insert")
          request = db
            .from("itens_lista")
            .upsert(
              { ...op.values, id: op.itemId, familia_id: fid, lista_id: op.listaId },
              { onConflict: "id" },
            );
        else if (op.kind === "delete")
          request = db
            .from("itens_lista")
            .delete()
            .eq("id", op.itemId)
            .eq("lista_id", op.listaId)
            .eq("familia_id", fid);
        else
          request = db
            .from("itens_lista")
            .update(op.values)
            .eq("id", op.itemId)
            .eq("lista_id", op.listaId)
            .eq("familia_id", fid)
            .select("id")
            .single();
        const { error } = await request;
        if (error) throw error;
        if (op.kind === "insert") {
          const known = qc.getQueryData<ProdutoCatalogo[]>(["produtos", fid]) || [];
          if (
            !known.some(
              (p) =>
                p.nome.toLocaleLowerCase("pt-BR") ===
                String(op.values["nome"]).toLocaleLowerCase("pt-BR"),
            )
          ) {
            const { data: existing, error: lookupError } = await db
              .from("produtos")
              .select("id")
              .eq("familia_id", fid)
              .eq("nome", op.values["nome"])
              .limit(1);
            if (lookupError) throw lookupError;
            if (!existing?.length) {
              const { error: catalogError } = await db.from("produtos").insert({
                familia_id: fid,
                nome: op.values["nome"],
                setor: op.values["setor"],
                preco_ref: op.values["preco"],
              });
              if (catalogError && catalogError.code !== "23505") throw catalogError;
            }
          }
        }
      });
      setSyncError("");
      if (hadFinalization && !readLocal(fid).pending.length) {
        await Promise.all(
          ["cartoes", "listas", "itens", "compras", "produtos"].map((key) =>
            qc.invalidateQueries({ queryKey: [key, fid] }),
          ),
        );
      }
    } catch (error) {
      const message = (error as { message?: string })?.message || "Aguardando conexão.";
      setSyncError("Alterações salvas neste celular. Sincronização pendente: " + message);
    }
  }
  useEffect(() => {
    const changed = () => setPendingCount(readLocal(fid).pending.length);
    const connection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncPending();
    };
    window.addEventListener("mercado-offline-change", changed);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    void syncPending();
    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncPending();
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("mercado-offline-change", changed);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [fid]);
  const cardsQ = useLocalQuery<Cartao[]>(fid, {
    queryKey: ["cartoes", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("cartoes")
        .select("*")
        .eq("familia_id", fid)
        .is("excluido_em", null)
        .order("created_at");
      check(error);
      return (data || []).map((r: any): Cartao => ({
        id: r.id,
        nome: r.nome,
        saldo: Number(r.saldo),
        cor: r.cor === "verde" || r.cor === "escuro" ? r.cor : "claro",
      }));
    },
  });
  const listasQ = useLocalQuery<ListaCompras[]>(fid, {
    queryKey: ["listas", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("listas_compras")
        .select("*")
        .eq("familia_id", fid)
        .eq("status", "em_andamento")
        .order("created_at", { ascending: false });
      check(error);
      return (data || []).map((r: any): ListaCompras => ({
        id: r.id,
        nome: r.nome,
        cartao_id: r.cartao_id,
        orcamento: Number(r.orcamento),
        valor_reservado: Number(r.valor_reservado),
        status: r.status,
        tipo: r.tipo,
      }));
    },
  });
  const cartoes = cardsQ.data || [],
    listas = listasQ.data || [];
  const listaId = listas.some((l) => l.id === selectedId)
    ? selectedId
    : listas.find((l) => l.tipo === "normal")?.id || listas[0]?.id || "";
  const lista = listas.find((l) => l.id === listaId);
  const itensQ = useLocalQuery<ItemLista[]>(fid, {
    queryKey: ["itens", fid, listaId],
    enabled: !!listaId,
    queryFn: async () => {
      const { data, error } = await db
        .from("itens_lista")
        .select("*")
        .eq("familia_id", fid)
        .eq("lista_id", listaId)
        .order("created_at")
        .order("id");
      check(error);
      return overlayItems<ItemLista>(
        (data || []).map((r: any): ItemLista => ({
          id: r.id,
          nome: r.nome,
          setor: r.setor as Setor,
          qtd: Number(r.qtd),
          preco: Number(r.preco || 0),
          comprado: r.comprado,
          inesperado: r.inesperado,
        })),
        readLocal(fid).pending,
        listaId,
      );
    },
  });
  const catQ = useLocalQuery<ProdutoCatalogo[]>(fid, {
    queryKey: ["produtos", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("produtos")
        .select("*")
        .eq("familia_id", fid)
        .order("nome");
      check(error);
      return (data || []).map((r: any): ProdutoCatalogo => ({
        id: r.id,
        nome: r.nome,
        setor: r.setor as Setor,
        precoRef: Number(r.preco_ref || 0),
      }));
    },
  });
  const histQ = useLocalQuery<Compra[]>(fid, {
    queryKey: ["compras", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("compras")
        .select("*")
        .eq("familia_id", fid)
        .order("created_at", { ascending: false });
      check(error);
      return (data || []).map((r: any): Compra => ({
        id: r.id,
        data: r.data,
        cartao: r.cartao,
        total: Number(r.total),
        itens: r.itens,
      }));
    },
  });
  const itens = itensQ.data || [];
  const refresh = async (...keys: string[]) => {
    await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k, fid] })));
  };
  function writeItem(id: string, kind: PendingWrite["kind"], values: Record<string, unknown>) {
    const key = ["itens", fid, listaId];
    void qc.cancelQueries({ queryKey: key });
    const current = qc.getQueryData<ItemLista[]>(key) || [];
    const op = { id: crypto.randomUUID(), listaId, itemId: id, kind, values };
    const next = overlayItems(current, [op], listaId);
    enqueue(fid, op, key, next);
    qc.setQueryData(key, next);
    void syncPending();
  }
  const store: Store = {
    pendingCount,
    syncError,
    online,
    familia,
    cartoes,
    listas,
    listaId,
    selecionarLista: (id) => {
      saveCache(fid, ["selected"], id);
      setSelectedId(id);
    },
    itens,
    catalogo: catQ.data || [],
    historico: histQ.data || [],
    orcamento: lista?.orcamento || 0,
    cartaoCompraId: lista?.cartao_id || "",
    addCartao: async (nome, saldo, destinado = 0) => {
      if (
        !nome.trim() ||
        saldo < 0 ||
        !Number.isFinite(saldo) ||
        destinado < 0 ||
        !Number.isFinite(destinado) ||
        destinado > saldo
      )
        throw new Error("Confira o saldo e o valor destinado.");
      const { data, error } = await db
        .from("cartoes")
        .insert({ familia_id: fid, nome, saldo, cor: "claro" })
        .select("id")
        .single();
      check(error);
      if (destinado > 0) {
        const { error: listaError } = await db.from("listas_compras").insert({
          familia_id: fid,
          cartao_id: data.id,
          nome: "Compra do mês",
          orcamento: destinado,
          valor_reservado: 0,
          status: "em_andamento",
          tipo: "normal",
        });
        check(listaError);
      }
      await refresh("cartoes", "listas");
    },
    salvarCartao: async (id, nome, saldo, destinado) => {
      if (
        !nome.trim() ||
        !Number.isFinite(saldo) ||
        saldo < 0 ||
        !Number.isFinite(destinado) ||
        destinado < 0 ||
        destinado > saldo
      )
        throw new Error("O valor destinado deve ser menor ou igual ao saldo.");
      const relacionadas = listas.filter((l) => l.cartao_id === id && l.tipo === "normal");
      if (relacionadas.length > 1)
        throw new Error(
          "Há mais de uma lista mensal neste cartão. Ajuste o orçamento diretamente na lista.",
        );
      const listaCartao = relacionadas[0];
      if (listaCartao && destinado + listaCartao.valor_reservado > saldo)
        throw new Error("O orçamento e a reserva ultrapassam o saldo do cartão.");
      const { error } = await db
        .from("cartoes")
        .update({ nome: nome.trim(), saldo })
        .eq("id", id)
        .eq("familia_id", fid);
      check(error);
      if (listaCartao) {
        const { error: err } = await db
          .from("listas_compras")
          .update({ orcamento: destinado })
          .eq("id", listaCartao.id)
          .eq("familia_id", fid);
        check(err);
      } else if (destinado > 0) {
        const { error: err } = await db.from("listas_compras").insert({
          familia_id: fid,
          cartao_id: id,
          nome: "Compra do mês",
          orcamento: destinado,
          valor_reservado: 0,
          status: "em_andamento",
          tipo: "normal",
        });
        check(err);
      }
      await refresh("cartoes", "listas");
    },
    excluirCartao: async (id) => {
      const card = cartoes.find((c) => c.id === id);
      if (!card) throw new Error("Cartão não encontrado.");
      const { error } = await db.rpc("excluir_cartao_familia", { _cartao_id: id });
      check(error);
      await refresh("cartoes", "listas");
    },
    criarLista: async (nome, cartaoId, orcamento, reserva) => {
      const card = cartoes.find((c) => c.id === cartaoId);
      if (
        !card ||
        !nome.trim() ||
        orcamento <= 0 ||
        reserva < 0 ||
        orcamento + reserva > card.saldo
      ) {
        toast.error("Confira o cartão, o orçamento e a reserva.");
        return;
      }
      const { data, error } = await db
        .from("listas_compras")
        .insert({
          familia_id: fid,
          cartao_id: cartaoId,
          nome,
          orcamento,
          valor_reservado: reserva,
          status: "em_andamento",
          tipo: "normal",
        })
        .select("id")
        .single();
      check(error);
      await refresh("listas");
      if (data?.id) setSelectedId(data.id);
    },
    renomearLista: async (id, nome) => {
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) throw new Error("Informe o nome da lista.");
      if (nomeLimpo.length > 100) throw new Error("O nome deve ter até 100 caracteres.");
      const { data, error } = await db
        .from("listas_compras")
        .update({ nome: nomeLimpo })
        .eq("id", id)
        .eq("familia_id", fid)
        .eq("status", "em_andamento")
        .select("id")
        .maybeSingle();
      check(error);
      if (!data) throw new Error("Lista não encontrada.");
      await refresh("listas");
    },
    atualizarOrcamento: async (valor) => {
      if (!lista || !Number.isFinite(valor) || valor <= 0) throw new Error("Orçamento inválido");
      const card = cartoes.find((c) => c.id === lista.cartao_id);
      if (!card || valor + lista.valor_reservado > card.saldo) {
        toast.error(
          "O orçamento não pode ultrapassar o saldo disponível do cartão, descontada a reserva.",
        );
        throw new Error("Saldo insuficiente");
      }
      const { error } = await db
        .from("listas_compras")
        .update({ orcamento: valor })
        .eq("id", lista.id)
        .eq("familia_id", fid);
      check(error);
      await refresh("listas");
    },
    toggleItem: async (id) => {
      const item = (qc.getQueryData<ItemLista[]>(["itens", fid, listaId]) || []).find(
        (i) => i.id === id,
      );
      if (!item) return;
      if (!item.comprado && !(item.preco > 0)) {
        toast.error("Informe o preço antes de enviar ao Carrinho.");
        return;
      }
      writeItem(id, "update", { comprado: !item.comprado });
    },
    updateItem: async (id, patch) => {
      const item = (qc.getQueryData<ItemLista[]>(["itens", fid, listaId]) || []).find(
        (i) => i.id === id,
      );
      if (!item) return;
      const updated = { ...item, ...patch };
      if (
        !updated.nome.trim() ||
        !Number.isFinite(updated.qtd) ||
        updated.qtd <= 0 ||
        !Number.isFinite(updated.preco) ||
        updated.preco < 0
      )
        throw new Error("Confira os dados do produto.");
      writeItem(id, "update", patch);
    },
    removeItem: async (id) => {
      writeItem(id, "delete", {});
    },
    addItem: async (novo) => {
      if (!listaId) throw new Error("Crie uma lista antes de adicionar produtos.");
      if (
        !novo.nome.trim() ||
        !Number.isFinite(novo.qtd) ||
        novo.qtd <= 0 ||
        !Number.isFinite(novo.preco) ||
        novo.preco < 0
      )
        throw new Error("Confira os dados do produto.");
      writeItem(crypto.randomUUID(), "insert", {
        ...novo,
        comprado: false,
        inesperado: !!novo.inesperado,
        created_at: new Date().toISOString(),
      });
    },
    importarListaPadrao: async () => {
      if (!listaId) throw new Error("Selecione uma lista.");
      const padrao = [
        { nome: "Sabonetes", setor: "Higiene", qtd: 6 },
        { nome: "Lenço umedecido", setor: "Higiene", qtd: 2 },
        { nome: "desodorante Carol", setor: "Higiene", qtd: 1 },
        { nome: "Desodorante Lohran", setor: "Higiene", qtd: 1 },
        { nome: "Pasta de dente", setor: "Higiene", qtd: 1 },
        { nome: "Gel", setor: "Higiene", qtd: 1 },
        { nome: "Gillete", setor: "Higiene", qtd: 1 },
        { nome: "Shampoo", setor: "Higiene", qtd: 1 },
        { nome: "Condicionador", setor: "Higiene", qtd: 1 },
        { nome: "pasta de dente Lavinia", setor: "Higiene", qtd: 1 },
        { nome: "Espuma de Barbear", setor: "Higiene", qtd: 1 },
        { nome: "Sabonete Intimo", setor: "Higiene", qtd: 1 },
        { nome: "Sabonete líquido", setor: "Higiene", qtd: 1 },
        { nome: "Leite Semi Desnatado", setor: "Lacticinios", qtd: 6 },
        { nome: "Mussarela", setor: "Lacticinios", qtd: 1 },
        { nome: "molho de tomate", setor: "Lacticinios", qtd: 3 },
        { nome: "Margarina 500g", setor: "Lacticinios", qtd: 1 },
        { nome: "Tapioca", setor: "Lacticinios", qtd: 1 },
        { nome: "Danone", setor: "Lacticinios", qtd: 2 },
        { nome: "Banana", setor: "Lacticinios", qtd: 1 },
        { nome: "pão de queijo", setor: "Lacticinios", qtd: 1 },
        { nome: "Leite em pó", setor: "Lavínia", qtd: 6 },
        { nome: "Sucos lanche", setor: "Lavínia", qtd: 16 },
        { nome: "Biscoitos Lavínia", setor: "Lavínia", qtd: 4 },
        { nome: "Detergente", setor: "Limpeza", qtd: 2 },
        { nome: "Barla", setor: "Limpeza", qtd: 1 },
        { nome: "Sabão (Lavar roupas)", setor: "Limpeza", qtd: 1 },
        { nome: "saco de lixo", setor: "Limpeza", qtd: 1 },
        { nome: "oleo", setor: "Limpeza", qtd: 1 },
        { nome: "Adoçante", setor: "Limpeza", qtd: 1 },
        { nome: "Papel higiênico", setor: "Limpeza", qtd: 1 },
        { nome: "Bombril", setor: "Limpeza", qtd: 1 },
        { nome: "Pedra sanitária", setor: "Limpeza", qtd: 2 },
        { nome: "pano de chão", setor: "Limpeza", qtd: 1 },
        { nome: "Hamburguer", setor: "Limpeza", qtd: 1 },
        { nome: "cloro", setor: "Limpeza", qtd: 1 },
        { nome: "Amaciante", setor: "Limpeza", qtd: 1 },
        { nome: "Açúcar", setor: "Mercearia", qtd: 4 },
        { nome: "Arroz", setor: "Mercearia", qtd: 2 },
        { nome: "Feijão", setor: "Mercearia", qtd: 2 },
        { nome: "Suco", setor: "Mercearia", qtd: 2 },
        { nome: "Miojo", setor: "Mercearia", qtd: 1 },
        { nome: "café soluvel", setor: "Outros", qtd: 1 },
        { nome: "Café", setor: "Padaria", qtd: 1 },
        { nome: "Filtro de cafe 103", setor: "Padaria", qtd: 1 },
        { nome: "Pao Integral", setor: "Padaria", qtd: 4 },
        { nome: "Empanitos", setor: "Proteína", qtd: 2 },
        { nome: "requeijão zero", setor: "Proteína", qtd: 2 },
        { nome: "Carnes", setor: "Proteína", qtd: 1 },
        { nome: "Macarrão", setor: "Temperos", qtd: 1 },
      ];
      const existentes = new Set(itens.map((i) => i.nome.trim().toLocaleLowerCase("pt-BR")));
      const novos = padrao.filter((p) => !existentes.has(p.nome.trim().toLocaleLowerCase("pt-BR")));
      if (!novos.length) return 0;
      const { error } = await db.from("itens_lista").insert(
        novos.map((p) => ({
          familia_id: fid,
          lista_id: listaId,
          nome: p.nome,
          setor: p.setor,
          qtd: p.qtd,
          preco: null,
          comprado: false,
          inesperado: false,
        })),
      );
      check(error);
      await refresh("itens");
      return novos.length;
    },
    finalizarCompra: async () => {
      const currentLists = qc.getQueryData<ListaCompras[]>(["listas", fid]) || [];
      const currentList = currentLists.find((l) => l.id === listaId);
      if (!currentList) throw new Error("Esta lista já foi finalizada ou não está disponível.");
      const currentItems = qc.getQueryData<ItemLista[]>(["itens", fid, listaId]) || [];
      const purchased = currentItems.filter((i) => i.comprado),
        remaining = currentItems.filter((i) => !i.comprado);
      if (!purchased.length) throw new Error("Marque pelo menos um produto comprado.");
      if (
        purchased.some(
          (i) => !Number.isFinite(i.preco) || i.preco <= 0 || !Number.isFinite(i.qtd) || i.qtd <= 0,
        )
      )
        throw new Error("Confira os preços e quantidades dos produtos comprados.");
      const total = Math.round(purchased.reduce((sum, i) => sum + totalItem(i), 0) * 100) / 100;
      const cards = qc.getQueryData<Cartao[]>(["cartoes", fid]) || [];
      const card = cards.find((c) => c.id === currentList.cartao_id);
      if (!card) throw new Error("Cartão não encontrado.");
      if (total > currentList.orcamento) throw new Error("Compra acima do orçamento definido.");
      if (
        total > card.saldo - currentList.valor_reservado ||
        currentList.orcamento > card.saldo - currentList.valor_reservado
      )
        throw new Error("A compra comprometeria o saldo disponível ou a reserva.");
      const id = crypto.randomUUID(),
        pendenciasId = crypto.randomUUID();
      const now = new Date();
      const data = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const op: PendingWrite = {
        id,
        listaId,
        itemId: listaId,
        kind: "finalize",
        values: {
          total,
          quantidade: purchased.length,
          pendenciasId,
          data,
          produtos: purchased,
          lista: currentList,
          cartao: card.nome,
        },
      };
      const nextLists = currentLists.filter((l) => l.id !== listaId);
      if (remaining.length)
        nextLists.unshift({
          ...currentList,
          id: pendenciasId,
          nome: "Pendências - " + currentList.nome,
          orcamento: 0,
          valor_reservado: 0,
          tipo: "pendencias",
        });
      const history = qc.getQueryData<Compra[]>(["compras", fid]) || [];
      const entries = [
        {
          key: ["cartoes", fid],
          value: cards.map((c) =>
            c.id === card.id ? { ...c, saldo: Math.round((c.saldo - total) * 100) / 100 } : c,
          ),
        },
        { key: ["listas", fid], value: nextLists },
        { key: ["itens", fid, listaId], value: [] },
        { key: ["itens", fid, pendenciasId], value: remaining },
        {
          key: ["compras", fid],
          value: [
            { id, data, cartao: card.nome, total, itens: purchased.length, pendente: true },
            ...history,
          ],
        },
        { key: ["selected"], value: remaining.length ? pendenciasId : "" },
      ];
      // Cancel stale reads before applying one atomic, durable local transaction.
      for (const entry of entries) void qc.cancelQueries({ queryKey: entry.key });
      enqueueFinalization(fid, op, entries);
      for (const entry of entries)
        if (entry.key[0] !== "selected") qc.setQueryData(entry.key, entry.value);
      setSelectedId(remaining.length ? pendenciasId : "");
      toast.success("Compra finalizada! Saldo descontado neste celular. Aguardando sincronização.");
      void syncPending();
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useDemo() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useDemo fora do provider");
  return store;
}
export function orcamentoEmAlerta(orcamento: number, gasto: number) {
  return orcamento > 0 && orcamento - gasto <= orcamento * 0.2;
}
