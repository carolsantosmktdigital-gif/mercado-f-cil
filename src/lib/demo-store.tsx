import { shoppingSnapshot, useSharedShopping } from "./shared-shopping";
import type { TemplateItem } from "./shopping-templates";
import { categoryName, validateCategory } from "./categories";
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
  ItemConflictError,
  resolveWrite,
  reopenFinalization,
} from "./offline";
import { historyTotal, validateHistoryItems, type HistoryItem } from "./history";
import type { PurchaseAnalysis } from "./analysis";
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
  "Crianças",
  "Outros",
] as const;
export type Setor = string;
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
  produtos?: HistoryItem[];
  listaId?: string;
  listaNome?: string;
  cartaoId?: string;
  revisao?: number;
  finalizacaoId?: string;
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
  conflitos: PendingWrite[];
  resolverConflito: (id: string, manterLocal: boolean) => Promise<void>;
  compartilhamento: {
    connected: boolean;
    peers: number;
    peerPending: number;
    peerNames?: string[];
  };
  categorias: string[];
  criarCategoria: (nome: string) => Promise<string>;
  analises: PurchaseAnalysis[];
  analisesLoading: boolean;
  analisesError: boolean;
  pendingCount: number;
  syncError: string;
  online: boolean;
  familia: Familia;
  cartoes: Cartao[];
  listas: ListaCompras[];
  listaId: string;
  selecionarLista: (id: string) => void;
  criarLista: (
    nome: string,
    cartaoId: string,
    orcamento: number,
    reserva: number,
    produtos?: TemplateItem[],
    requestId?: string,
  ) => Promise<void | "created" | "existing">;
  excluirLista: (id: string) => Promise<void>;
  atualizarOrcamento: (valor: number) => Promise<void>;
  duplicarLista: (
    origem: string,
    nome: string,
    cartaoId: string,
    orcamento: number,
    requestId: string,
    historico?: boolean,
  ) => Promise<void>;
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
    base?: Record<string, unknown>,
  ) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  editarCompra: (compra: Compra, produtos: HistoryItem[]) => Promise<void>;
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
      if (
        pending.some(
          (p) =>
            p.kind === "finalize" ||
            p.kind === "history" ||
            (p.kind === "category" && options.queryKey[0] === "categorias"),
        )
      ) {
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
  const [conflitos, setConflitos] = useState(() =>
    readLocal(fid).pending.filter((p) => p.conflict),
  );
  async function syncPending() {
    try {
      const hadFinalization = readLocal(fid).pending.length > 0;
      await flushWrites(fid, async (op: PendingWrite) => {
        if (op.kind === "finalize") {
          const { error } = op.values["snapshot"]
            ? await db.rpc("finalizar_compra_compartilhada", {
                _lista: op.listaId,
                _operacao: op.id,
                _pendencias: op.values["pendenciasId"],
                _data: op.values["data"],
                _itens: op.values["snapshot"],
              })
            : await db.rpc("finalizar_compra_offline", {
                _lista_id: op.listaId,
                _operacao_id: op.id,
                _pendencias_id: op.values["pendenciasId"],
                _total_previsto: op.values["total"],
                _qtd_prevista: op.values["quantidade"],
                _data_compra: op.values["data"],
              });
          if (error) {
            if (error.code !== "P0001") throw error;
            const { data: existing, error: lookupError } = await db
              .from("compras")
              .select("id")
              .eq("lista_id", op.listaId)
              .eq("familia_id", fid)
              .maybeSingle();
            if (!lookupError && existing) {
              toast.info(
                "Esta compra já foi finalizada. O saldo e o histórico serão atualizados pela nuvem.",
              );
              return;
            }
            if (error.code === "P0001")
              throw new ItemConflictError({ motivo: error.message, bloqueado: true });
            throw error;
          }
          return;
        }
        if (op.kind === "history") {
          const { error } = await db.rpc("editar_itens_compra", {
            _compra_id: op.values["compraId"],
            _operacao_id: op.id,
            _revisao_esperada: op.values["revisao"],
            _itens: op.values["produtos"],
            _finalizacao_id: op.values["finalizacaoId"] || null,
          });
          if (error) throw error;
          return;
        }
        if (op.kind === "category") {
          const { error } = await db
            .from("categorias")
            .upsert(
              { id: op.itemId, familia_id: fid, nome: categoryName(String(op.values["nome"])) },
              { onConflict: "familia_id,nome_chave", ignoreDuplicates: true },
            );
          if (error) throw error;
          return;
        }
        const { data: outcome, error } = await db.rpc("escrever_item_compartilhado", {
          _operacao: op.id,
          _familia: fid,
          _lista: op.listaId,
          _item: op.itemId,
          _tipo: op.kind,
          _valores: Object.fromEntries(
            Object.entries(op.values).filter(([key]) =>
              ["nome", "setor", "qtd", "preco", "comprado", "inesperado"].includes(key),
            ),
          ),
          _base: op.base || null,
        });
        if (error) throw error;
        if (outcome?.conflito) throw new ItemConflictError(outcome);
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
          ["cartoes", "listas", "itens", "compras", "produtos", "analises", "categorias"].map(
            (key) => qc.invalidateQueries({ queryKey: [key, fid] }),
          ),
        );
      }
    } catch (error) {
      const message = (error as { message?: string })?.message || "Aguardando conexão.";
      setSyncError("Alterações salvas neste celular. Sincronização pendente: " + message);
    }
  }
  useEffect(() => {
    const changed = () => {
      const pending = readLocal(fid).pending;
      setPendingCount(pending.length);
      setConflitos(pending.filter((p) => p.conflict));
    };
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
  const shared = useSharedShopping(fid, listaId, pendingCount, syncPending);
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
          setor: categoryName(r.setor),
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
        setor: categoryName(r.setor),
        precoRef: Number(r.preco_ref || 0),
      }));
    },
  });
  const histQ = useLocalQuery<Compra[]>(fid, {
    queryKey: ["compras", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("compras")
        .select("*, listas_compras(nome), compra_itens(id,nome,setor,qtd,preco_unitario)")
        .eq("familia_id", fid)
        .order("created_at", { ascending: false });
      check(error);
      return (data || []).map((r: any): Compra => ({
        id: r.id,
        data: r.data,
        cartao: r.cartao,
        total: Number(r.total),
        itens: r.itens,
        listaId: r.lista_id,
        listaNome: r.listas_compras?.nome || "Compra",
        cartaoId: r.cartao_id,
        revisao: Number(r.revisao_itens || 0),
        produtos: (r.compra_itens || []).map((i: any) => ({
          id: i.id,
          nome: i.nome,
          setor: categoryName(i.setor),
          qtd: Number(i.qtd),
          preco: Number(i.preco_unitario),
        })),
      }));
    },
  });
  const analisesQ = useLocalQuery<PurchaseAnalysis[]>(fid, {
    queryKey: ["analises", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("analises_compras")
        .select("id,lista_anterior_nome,lista_atual_nome,data_anterior,data_atual,itens")
        .eq("familia_id", fid)
        .order("data_atual", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseAnalysis[];
    },
  });
  const categoriasQ = useLocalQuery<string[]>(fid, {
    queryKey: ["categorias", fid],
    queryFn: async () => {
      const { data, error } = await db
        .from("categorias")
        .select("nome")
        .eq("familia_id", fid)
        .order("nome");
      if (error) throw error;
      return (data || []).map((r: any) => categoryName(r.nome));
    },
  });
  const categorias = Array.from(
    new Map(
      [
        ...SETORES,
        ...(categoriasQ.data || []),
        ...(itensQ.data || []).map((i) => i.setor),
        ...(catQ.data || []).map((i) => i.setor),
        ...(histQ.data || []).flatMap((h) => (h.produtos || []).map((i) => i.setor)),
      ].map((name) => [categoryName(name).toLocaleLowerCase("pt-BR"), categoryName(name)]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const itens = itensQ.data || [];
  const refresh = async (...keys: string[]) => {
    await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k, fid] })));
  };
  function writeItem(
    id: string,
    kind: PendingWrite["kind"],
    values: Record<string, unknown>,
    expected?: Record<string, unknown>,
  ) {
    const key = ["itens", fid, listaId];
    void qc.cancelQueries({ queryKey: key });
    const current = qc.getQueryData<ItemLista[]>(key) || [];
    const previous = current.find((i) => i.id === id);
    const fields =
      kind === "delete"
        ? ["nome", "setor", "qtd", "preco", "comprado", "inesperado"]
        : Object.keys(values);
    const base =
      expected ||
      Object.fromEntries(
        fields.map((k) => [k, (previous as any)?.[k] ?? (k === "inesperado" ? false : null)]),
      );
    const op: PendingWrite = { id: crypto.randomUUID(), listaId, itemId: id, kind, values, base };
    const next = overlayItems(current, [op], listaId);
    enqueue(fid, op, key, next);
    qc.setQueryData(key, next);
    void syncPending();
  }
  const store: Store = {
    conflitos,
    compartilhamento: shared,
    resolverConflito: async (id, manterLocal) => {
      if (!navigator.onLine) throw new Error("Conecte-se para resolver esta alteração.");
      const op = readLocal(fid).pending.find((p) => p.id === id);
      if (op?.kind === "finalize") {
        reopenFinalization(fid, id);
        for (const key of ["listas", "cartoes", "compras"])
          qc.setQueryData([key, fid], cached(fid, [key, fid]));
        qc.setQueryData(["itens", fid, op.listaId], cached(fid, ["itens", fid, op.listaId]));
        setSelectedId(op.listaId);
      } else resolveWrite(fid, id, manterLocal);
      await syncPending();
      await refresh("itens", "listas", "cartoes", "compras");
    },
    categorias,
    criarCategoria: async (valor) => {
      const nome = validateCategory(valor);
      const existing = [
        ...categorias,
        ...(qc.getQueryData<string[]>(["categorias", fid]) || []),
      ].find((c) => c.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
      if (existing) return existing;
      const id = crypto.randomUUID(),
        key = ["categorias", fid];
      const next = [...(qc.getQueryData<string[]>(key) || []), nome];
      void qc.cancelQueries({ queryKey: key });
      enqueue(
        fid,
        { id: crypto.randomUUID(), listaId: "", itemId: id, kind: "category", values: { nome } },
        key,
        next,
      );
      qc.setQueryData(key, next);
      void syncPending();
      return nome;
    },
    analises: analisesQ.data || [],
    analisesLoading: analisesQ.isPending,
    analisesError: analisesQ.isError,
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
    historico: (histQ.data || []).map((h) => {
      if (h.produtos) return h;
      const pending = readLocal(fid).pending.find((op) => op.kind === "finalize" && op.id === h.id);
      if (!pending) return h;
      const savedList = pending.values["lista"] as ListaCompras | undefined;
      return {
        ...h,
        produtos: pending.values["produtos"] as HistoryItem[],
        listaId: pending.listaId,
        listaNome: savedList?.nome || "Compra",
        cartaoId: savedList?.cartao_id || "",
        revisao: 0,
        finalizacaoId: pending.id,
      };
    }),
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
    criarLista: async (nome, cartaoId, orcamento, reserva, produtos, requestId) => {
      const card = cartoes.find((c) => c.id === cartaoId);
      if (
        !card ||
        !nome.trim() ||
        !Number.isFinite(orcamento) ||
        !Number.isFinite(reserva) ||
        orcamento <= 0 ||
        reserva < 0 ||
        orcamento + reserva > card.saldo
      ) {
        throw new Error("Confira o cartão, o orçamento e a reserva.");
      }
      if (produtos) {
        const id = requestId || crypto.randomUUID();
        const { data: createdId, error } = await db.rpc("criar_lista_personalizada", {
          _id: id,
          _familia: fid,
          _cartao: cartaoId,
          _nome: nome.trim(),
          _orcamento: orcamento,
          _itens: produtos,
        });
        check(error);
        await refresh("listas", "itens");
        setSelectedId(createdId || id);
        saveCache(fid, ["selected"], createdId || id);
        return createdId && createdId !== id ? "existing" : "created";
      }
      const id = requestId || crypto.randomUUID();
      const { data, error } = await db.rpc("criar_lista_vazia", {
        _id: id,
        _familia: fid,
        _cartao: cartaoId,
        _nome: nome.trim(),
        _orcamento: orcamento,
        _reserva: reserva,
      });
      check(error);
      await refresh("listas", "itens");
      if (data) {
        setSelectedId(data);
        saveCache(fid, ["selected"], data);
      }
      return data !== id ? "existing" : "created";
    },
    excluirLista: async (id) => {
      if (!navigator.onLine) throw new Error("Conecte-se à internet para excluir a lista.");
      await syncPending();
      if (readLocal(fid).pending.some((op) => op.listaId === id))
        throw new Error("Resolva as alterações pendentes desta lista antes de excluir.");
      const { error } = await db.rpc("excluir_lista_compras", { _lista: id });
      check(error);
      const remaining = (qc.getQueryData<ListaCompras[]>(["listas", fid]) || []).filter(
        (l) => l.id !== id,
      );
      saveCache(fid, ["listas", fid], remaining);
      qc.setQueryData(["listas", fid], remaining);
      saveCache(fid, ["itens", fid, id], []);
      qc.setQueryData(["itens", fid, id], []);
      if (listaId === id) {
        setSelectedId("");
        saveCache(fid, ["selected"], "");
      }
      await refresh("listas", "itens");
    },
    duplicarLista: async (origem, nome, cartaoId, orcamento, requestId, historico = false) => {
      if (!navigator.onLine) throw new Error("Conecte-se à internet para duplicar a lista.");
      const card = cartoes.find((c) => c.id === cartaoId);
      if (
        !nome.trim() ||
        nome.trim().length > 100 ||
        !card ||
        !Number.isFinite(orcamento) ||
        orcamento <= 0 ||
        orcamento > card.saldo
      )
        throw new Error("Confira o nome, o cartão e o orçamento da nova lista.");
      await syncPending();
      if (readLocal(fid).pending.length)
        throw new Error(
          "Ainda há alterações aguardando sincronização. Sincronize antes de duplicar a lista.",
        );
      const { error } = await db.rpc("duplicar_lista_compras", {
        _id: requestId,
        _familia: fid,
        _origem: origem,
        _historico: historico,
        _nome: nome.trim(),
        _cartao: cartaoId,
        _orcamento: orcamento,
      });
      check(error);
      await refresh("listas", "itens");
      setSelectedId(requestId);
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
    updateItem: async (id, patch, base) => {
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
      writeItem(id, "update", patch, base);
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
    editarCompra: async (compra, produtos) => {
      validateHistoryItems(produtos);
      const history = qc.getQueryData<Compra[]>(["compras", fid]) || [];
      const current = history.find(
        (h) => h.id === compra.id || (compra.listaId && h.listaId === compra.listaId),
      );
      if (!current) throw new Error("Compra não encontrada. Abra o histórico novamente.");
      if ((current.revisao || 0) !== (compra.revisao || 0))
        throw new Error("Esta compra foi atualizada. Reabra os detalhes antes de editar.");
      const total = historyTotal(produtos),
        delta = Math.round((total - current.total) * 100) / 100;
      const cards = qc.getQueryData<Cartao[]>(["cartoes", fid]) || [];
      const cartaoId = current.cartaoId || compra.cartaoId;
      const card = cards.find((c) => c.id === cartaoId);
      if (card && card.saldo - delta < 0)
        throw new Error("Saldo do cartão insuficiente para aumentar o valor desta compra.");
      const updated = {
        ...compra,
        ...current,
        produtos: produtos.map((p) => ({ ...p, nome: p.nome.trim() })),
        total,
        itens: produtos.length,
        revisao: (current.revisao || 0) + 1,
        pendente: true,
      };
      const op: PendingWrite = {
        id: crypto.randomUUID(),
        listaId: current.listaId || compra.listaId || current.id,
        itemId: current.id,
        kind: "history",
        values: {
          compraId: current.id,
          finalizacaoId: current.finalizacaoId || compra.finalizacaoId,
          revisao: current.revisao || 0,
          produtos: updated.produtos,
        },
      };
      const entries = [
        { key: ["compras", fid], value: history.map((h) => (h.id === current.id ? updated : h)) },
        {
          key: ["cartoes", fid],
          value: cards.map((c) =>
            c.id === cartaoId ? { ...c, saldo: Math.round((c.saldo - delta) * 100) / 100 } : c,
          ),
        },
      ];
      for (const entry of entries) void qc.cancelQueries({ queryKey: entry.key });
      enqueueFinalization(fid, op, entries);
      for (const entry of entries) qc.setQueryData(entry.key, entry.value);
      void syncPending();
    },
    finalizarCompra: async () => {
      if (navigator.onLine) {
        const viewed = shoppingSnapshot(
          qc.getQueryData<ItemLista[]>(["itens", fid, listaId]) || [],
        );
        await syncPending();
        if (readLocal(fid).pending.length)
          throw new Error("Resolva as alterações pendentes antes de finalizar a compra.");
        await shared.checkPeers();
        const shown = qc.getQueryData<ItemLista[]>(["itens", fid, listaId]) || [];
        const { data: remote, error: fetchError } = await db
          .from("itens_lista")
          .select("*")
          .eq("familia_id", fid)
          .eq("lista_id", listaId)
          .order("created_at")
          .order("id");
        check(fetchError);
        if (viewed !== shoppingSnapshot(remote || [])) {
          saveCache(fid, ["itens", fid, listaId], remote || []);
          qc.setQueryData(["itens", fid, listaId], remote || []);
          await refresh("listas", "cartoes");
          throw new Error(
            "A lista foi atualizada com as alterações do outro celular. Confira o total e finalize novamente.",
          );
        }
        const now = new Date();
        const { error } = await db.rpc("finalizar_compra_compartilhada", {
          _lista: listaId,
          _operacao: crypto.randomUUID(),
          _pendencias: crypto.randomUUID(),
          _data: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
          _itens: shown,
        });
        await refresh("listas", "itens", "cartoes", "compras", "analises");
        check(error);
        toast.success("Compra finalizada e saldo sincronizado na nuvem.");
        return;
      }
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
          snapshot: currentItems,
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
            {
              id,
              data,
              cartao: card.nome,
              total,
              itens: purchased.length,
              pendente: true,
              produtos: purchased,
              listaId,
              listaNome: currentList.nome,
              cartaoId: card.id,
              revisao: 0,
              finalizacaoId: id,
            },
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
