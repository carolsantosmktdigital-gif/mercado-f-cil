import { createContext, useContext, useState, type ReactNode } from "react";

// Dados fictícios só para demonstração — nada é salvo.
export const SETORES = ["Hortifrúti", "Mercearia", "Laticínios", "Carnes", "Padaria", "Limpeza", "Bebidas", "Higiene"] as const;
export type Setor = (typeof SETORES)[number];

export type Cartao = { id: string; nome: string; saldo: number; cor: "verde" | "escuro" | "claro" };
export type ItemLista = { id: string; nome: string; setor: Setor; qtd: number; preco: number; comprado: boolean; inesperado?: boolean };
export type ProdutoCatalogo = { id: string; nome: string; setor: Setor; precoRef: number };
export type Compra = { id: string; data: string; cartao: string; total: number; itens: number };

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const totalItem = (i: ItemLista) => i.qtd * i.preco;

const cartoesIniciais: Cartao[] = [
  { id: "c1", nome: "Alimentação Empresa", saldo: 842.5, cor: "verde" },
  { id: "c2", nome: "Vale-compras Família", saldo: 310.0, cor: "escuro" },
  { id: "c3", nome: "Cartão Refeição", saldo: 127.8, cor: "claro" },
];

const itensIniciais: ItemLista[] = [
  { id: "i1", nome: "Arroz tipo 1 5kg", setor: "Mercearia", qtd: 1, preco: 27.9, comprado: true },
  { id: "i2", nome: "Feijão carioca 1kg", setor: "Mercearia", qtd: 2, preco: 8.49, comprado: true },
  { id: "i3", nome: "Banana prata (kg)", setor: "Hortifrúti", qtd: 1.5, preco: 6.99, comprado: false },
  { id: "i4", nome: "Tomate (kg)", setor: "Hortifrúti", qtd: 1, preco: 7.5, comprado: false },
  { id: "i5", nome: "Leite integral 1L", setor: "Laticínios", qtd: 6, preco: 5.29, comprado: true },
  { id: "i6", nome: "Peito de frango (kg)", setor: "Carnes", qtd: 2, preco: 19.9, comprado: false },
  { id: "i7", nome: "Pão francês (kg)", setor: "Padaria", qtd: 0.5, preco: 16.9, comprado: false },
  { id: "i8", nome: "Detergente 500ml", setor: "Limpeza", qtd: 3, preco: 2.79, comprado: false },
];

const catalogoInicial: ProdutoCatalogo[] = [
  ...itensIniciais.map((i) => ({ id: "p" + i.id, nome: i.nome, setor: i.setor, precoRef: i.preco })),
  { id: "p9", nome: "Café torrado 500g", setor: "Mercearia", precoRef: 18.9 },
  { id: "p10", nome: "Queijo muçarela (kg)", setor: "Laticínios", precoRef: 44.9 },
  { id: "p11", nome: "Suco de laranja 1L", setor: "Bebidas", precoRef: 9.99 },
  { id: "p12", nome: "Sabonete 85g", setor: "Higiene", precoRef: 2.49 },
  { id: "p13", nome: "Alface crespa", setor: "Hortifrúti", precoRef: 3.5 },
  { id: "p14", nome: "Carne moída (kg)", setor: "Carnes", precoRef: 36.9 },
];

const historicoInicial: Compra[] = [
  { id: "h1", data: "2026-10-18", cartao: "Alimentação Empresa", total: 412.37, itens: 34 },
  { id: "h2", data: "2026-10-09", cartao: "Vale-compras Família", total: 186.2, itens: 15 },
  { id: "h3", data: "2026-09-28", cartao: "Alimentação Empresa", total: 538.9, itens: 41 },
  { id: "h4", data: "2026-09-14", cartao: "Cartão Refeição", total: 74.6, itens: 6 },
];

type Store = {
  cartoes: Cartao[];
  itens: ItemLista[];
  catalogo: ProdutoCatalogo[];
  historico: Compra[];
  orcamento: number;
  cartaoCompraId: string;
  addCartao: (nome: string, saldo: number) => void;
  toggleItem: (id: string) => void;
  addItem: (i: Omit<ItemLista, "id" | "comprado">) => void;
  removeItem: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);
let seq = 100;

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [itens, setItens] = useState(itensIniciais);
  const [catalogo, setCatalogo] = useState(catalogoInicial);

  const store: Store = {
    cartoes,
    itens,
    catalogo,
    historico: historicoInicial,
    orcamento: 300,
    cartaoCompraId: "c2",
    addCartao: (nome, saldo) =>
      setCartoes((c) => [...c, { id: "c" + seq++, nome, saldo, cor: "claro" }]),
    toggleItem: (id) => setItens((l) => l.map((i) => (i.id === id ? { ...i, comprado: !i.comprado } : i))),
    removeItem: (id) => setItens((l) => l.filter((i) => i.id !== id)),
    addItem: (novo) => {
      setItens((l) => [...l, { ...novo, id: "i" + seq++, comprado: false }]);
      // Produtos novos entram automaticamente no catálogo
      setCatalogo((c) =>
        c.some((p) => p.nome.toLowerCase() === novo.nome.toLowerCase())
          ? c
          : [...c, { id: "p" + seq++, nome: novo.nome, setor: novo.setor, precoRef: novo.preco }],
      );
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
