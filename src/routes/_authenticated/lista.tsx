import { BudgetAlert } from "@/components/BudgetAlert";
import { BudgetEditor } from "@/components/BudgetEditor";
import { ManualListForm } from "@/components/ManualListForm";
import { ShoppingListBuilder } from "@/components/ShoppingListBuilder";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CategoryField } from "@/components/CategoryField";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Plus,
  Trash2,
  Zap,
  Pencil,
  Search,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Info,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Page } from "@/components/AppShell";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { budgetState } from "@/lib/budget";
import { brl, totalItem, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/lista")({
  head: () => ({
    meta: [
      { title: "Lista de compras — Mercado Fácil" },
      { name: "description", content: "Produtos, quantidades, preços e total da compra." },
      { property: "og:title", content: "Lista de compras — Mercado Fácil" },
      {
        property: "og:description",
        content: "Marque produtos como comprados e acompanhe o orçamento.",
      },
    ],
  }),
  component: Lista,
});

function Lista() {
  const {
    itens,
    cartoes = [],
    cartaoCompraId,
    toggleItem,
    updateItem,
    removeItem,
    finalizarCompra,
    listas,
    listaId,
    selecionarLista,
    renomearLista,
    pendingCount,
    syncError,
    online,
  } = useDemo();
  const [cadastroAberto, setCadastroAberto] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#nova-lista") setCadastroAberto(true);
  }, []);
  const [editarNomeLista, setEditarNomeLista] = useState(false);
  const [novoNomeLista, setNovoNomeLista] = useState("");
  const [salvandoNomeLista, setSalvandoNomeLista] = useState(false);
  const [aba, setAba] = useState<"lista" | "carrinho">("lista");
  const [busca, setBusca] = useState("");
  const [recolhidos, setRecolhidos] = useState<string[]>([]);
  const [setorEditando, setSetorEditando] = useState<string | null>(null);
  const [nomeEditando, setNomeEditando] = useState("");
  const [categoriaEditando, setCategoriaEditando] = useState("");
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [setorFiltro, setSetorFiltro] = useState("Todos");
  const [editando, setEditando] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ nome: "", setor: "Mercearia" });
  const draftStatus = (dirty: boolean) =>
    window.dispatchEvent(
      new CustomEvent("mercado-shopping-draft", { detail: { lista: listaId, dirty } }),
    );
  useEffect(
    () => () => {
      draftStatus(false);
    },
    [listaId],
  );
  const foco = useRef<{ id: string; campo: "qtd" | "preco"; base: number } | null>(null);
  const produtoBase = useRef<Record<string, unknown>>({});
  const [finalizando, setFinalizando] = useState(false);
  const [conclusao, setConclusao] = useState<{ pendentes: number; offline: boolean } | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, { qtd: string; preco: string }>>({});
  useEffect(() => {
    if (foco.current && !itens.some((i) => i.id === foco.current!.id)) {
      toast.info(
        "O produto em edição foi retirado da lista em outro celular. Confira a lista atualizada.",
      );
      foco.current = null;
      draftStatus(false);
    }
    setRascunhos((previous) =>
      Object.fromEntries(
        itens.map((i) => {
          const draft = { qtd: String(i.qtd), preco: i.preco ? String(i.preco) : "" };
          const active = foco.current;
          if (active?.id === i.id && previous[i.id])
            draft[active.campo] = previous[i.id]![active.campo];
          return [i.id, draft];
        }),
      ),
    );
  }, [itens]);
  useEffect(() => {
    foco.current = null;
    setRascunhos({});
  }, [listaId]);
  const total = itens.reduce((s, i) => s + totalItem(i), 0);
  const pendentes = itens.filter((i) => !i.comprado);
  const carrinho = itens.filter((i) => i.comprado);
  const totalCarrinho = carrinho.reduce((s, i) => s + totalItem(i), 0);
  const budget = Number(listas.find((l) => l.id === listaId)?.orcamento || 0);
  const { remaining, percent, level } = budgetState(budget, totalCarrinho);
  const barClass =
    level === "danger" ? "bg-red-600" : level === "warning" ? "bg-orange-500" : "bg-emerald-800";
  async function salvarCampo(id: string, campo: "qtd" | "preco") {
    const valor = Number((rascunhos[id]?.[campo] || "").replace(",", "."));
    const base =
      foco.current?.id === id && foco.current.campo === campo
        ? { [campo]: foco.current.base }
        : undefined;
    foco.current = null;
    draftStatus(false);
    if (!Number.isFinite(valor) || (campo === "qtd" ? valor < 0 : valor < 0)) {
      toast.error("Valor inválido.");
      return;
    }
    try {
      if (campo === "qtd" && valor === 0) {
        await removeItem(id);
        toast.success("Produto retirado da lista desta família.");
        return;
      }
      if (itens.find((i) => i.id === id)?.[campo] === valor) return;
      if (base) await updateItem(id, { [campo]: valor }, base);
      else await updateItem(id, { [campo]: valor });
    } catch {
      toast.error("Não foi possível salvar a alteração.");
    }
  }
  function campo(i: (typeof itens)[number], tipo: "qtd" | "preco") {
    const atual = tipo === "qtd" ? String(i.qtd) : i.preco ? String(i.preco) : "";
    return (
      <Input
        aria-label={(tipo === "qtd" ? "Quantidade de " : "Preço de ") + i.nome}
        className="h-10 w-full min-w-0 rounded-xl px-2 text-base tabular-nums shadow-sm"
        type="text"
        inputMode="decimal"
        placeholder={tipo === "preco" ? "R$ 0,00" : "Quantidade"}
        value={rascunhos[i.id]?.[tipo] ?? atual}
        onFocus={(e) => {
          foco.current = { id: i.id, campo: tipo, base: i[tipo] };
          draftStatus(true);
          e.currentTarget.select();
        }}
        onClick={(e) => e.currentTarget.select()}
        onChange={(e) =>
          setRascunhos((p) => ({
            ...p,
            [i.id]: {
              qtd: p[i.id]?.qtd ?? String(i.qtd),
              preco: p[i.id]?.preco ?? String(i.preco),
              [tipo]: e.target.value,
            },
          }))
        }
        onBlur={() => salvarCampo(i.id, tipo)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  }
  const setores = ["Todos", ...Array.from(new Set(itens.map((i) => i.setor)))];
  const [ordem, setOrdem] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setOrdem((previous) => {
      const ids = previous[listaId] || [];
      const novos = itens.filter((i) => !ids.includes(i.id)).map((i) => i.id);
      return novos.length ? { ...previous, [listaId]: [...ids, ...novos] } : previous;
    });
  }, [itens, listaId]);
  const posicoes = ordem[listaId] || itens.map((i) => i.id);
  const visiveis = (aba === "lista" ? pendentes : carrinho)
    .filter(
      (i) =>
        (setorFiltro === "Todos" || i.setor === setorFiltro) &&
        i.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => posicoes.indexOf(a.id) - posicoes.indexOf(b.id));
  function tabela(lista: typeof itens) {
    const grupos =
      aba === "carrinho"
        ? [["Carrinho", lista] as const]
        : Array.from(new Set(lista.map((i) => i.setor))).map(
            (setor) => [setor, lista.filter((i) => i.setor === setor)] as const,
          );
    return (
      <section
        className="mt-3 space-y-3"
        aria-label={aba === "lista" ? "Produtos pendentes" : "Produtos no carrinho"}
      >
        {lista.length === 0 && (
          <div className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado nesta aba.
          </div>
        )}
        {grupos.map(([setor, produtos]) => (
          <div key={setor} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            {aba === "lista" && (
              <button
                className="flex w-full items-center justify-between bg-emerald-50 px-4 py-4 text-left text-base font-bold text-emerald-950"
                onClick={() =>
                  setRecolhidos((p) =>
                    p.includes(setor) ? p.filter((x) => x !== setor) : [...p, setor],
                  )
                }
              >
                <span>{setor}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-normal">
                    {produtos.length} itens
                  </span>
                  {recolhidos.includes(setor) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </span>
              </button>
            )}
            {!recolhidos.includes(setor) && (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_42px_76px_66px_36px] items-center gap-1 border-b bg-muted/60 px-2 py-2 text-[10px] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,1fr)_52px_90px_86px_40px] sm:text-xs">
                  <span>Produto</span>
                  <span>Qtd</span>
                  <span>Preço un.</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {produtos.map((i) => (
                  <div
                    key={i.id}
                    className="grid grid-cols-[minmax(0,1fr)_42px_76px_66px_36px] items-center gap-1 border-b px-2 py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_52px_90px_86px_40px]"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        title={"Editar setor de " + i.nome}
                        aria-label={"Editar setor de " + i.nome}
                        className="w-full break-words text-left text-xs font-medium leading-tight sm:text-sm"
                        onClick={() => {
                          draftStatus(true);
                          produtoBase.current = { nome: i.nome, setor: i.setor };
                          setSetorEditando(i.id);
                          setNomeEditando(i.nome);
                          setCategoriaEditando(i.setor);
                        }}
                      >
                        {i.nome}
                      </button>
                    </div>
                    <div className="min-w-0">{campo(i, "qtd")}</div>
                    <div className="min-w-0">{campo(i, "preco")}</div>
                    <strong className="min-w-0 text-right text-[11px] tabular-nums sm:text-sm">
                      {brl(totalItem(i))}
                    </strong>
                    <button
                      type="button"
                      aria-label={
                        i.comprado
                          ? "Devolver " + i.nome + " à lista"
                          : "Colocar " + i.nome + " no carrinho"
                      }
                      title={i.comprado ? "Devolver à lista" : "Colocar no carrinho"}
                      className={
                        "flex h-9 w-9 items-center justify-center rounded-full " +
                        (i.comprado
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-emerald-800 text-white")
                      }
                      onClick={() => toggleItem(i.id).catch(() => {})}
                    >
                      {i.comprado ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </section>
    );
  }

  return (
    <Page
      title="Lista de compras"
      subtitle={`${itens.filter((i) => i.comprado).length} de ${itens.length} no carrinho`}
    >
      {listas.length > 1 && (
        <section
          aria-label="Alternar lista de compras"
          className="mb-4 rounded-3xl bg-card p-4 shadow-soft"
        >
          <h2 className="mb-3 font-bold">Suas listas em andamento</h2>
          <div className="flex flex-wrap gap-2">
            {listas.map((lista) => (
              <button
                key={lista.id}
                type="button"
                aria-pressed={listaId === lista.id}
                onClick={() => {
                  selecionarLista(lista.id);
                  setAba("lista");
                  setBusca("");
                  setSetorFiltro("Todos");
                  setRecolhidos([]);
                  setEditarNomeLista(false);
                  setEditando(null);
                }}
                className={
                  "rounded-xl border px-3 py-2 text-sm " +
                  (listaId === lista.id ? "bg-primary text-primary-foreground" : "bg-muted")
                }
              >
                {lista.nome}
              </button>
            ))}
          </div>
        </section>
      )}
      {conclusao && (
        <section
          role="status"
          className="mb-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
        >
          <h2 className="font-bold">Compra finalizada!</h2>
          <p className="text-sm">
            A compra foi movida para a aba Histórico, onde você pode consultar ou editar os itens
            comprados.
          </p>
          <p className="text-sm">
            {conclusao.pendentes > 0
              ? "Os itens que não foram comprados geraram uma nova lista de pendências. Eles permanecerão nela até serem efetivamente comprados."
              : "Todos os itens desta lista foram comprados. Não foi necessário criar uma lista de pendências."}
          </p>
          {conclusao.offline && (
            <p className="text-sm">
              Os dados estão salvos neste celular e serão sincronizados quando houver conexão.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/historico">Ver Histórico</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConclusao(null)}>
              Continuar
            </Button>
          </div>
        </section>
      )}
      {!listaId && <ShoppingListBuilder />}
      {!listaId && (
        <section className="mb-4 space-y-3 rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-lg font-bold">Crie sua lista de compras</h2>
          <p className="text-sm text-muted-foreground">
            Você ainda não tem listas cadastradas. Crie uma lista do seu jeito ou gere uma lista
            automática para sua família.
          </p>
          <Button type="button" className="w-full" onClick={() => setCadastroAberto(true)}>
            Cadastrar lista de compras
          </Button>
        </section>
      )}
      {listaId && (
        <div className="mb-4 rounded-2xl bg-accent p-4 text-sm">
          Sua compra está em andamento. Ao terminar, abra o{" "}
          <button type="button" className="font-bold underline" onClick={() => setAba("carrinho")}>
            Carrinho
          </button>
          , confira os itens e toque em <strong>Finalizar compra</strong>.
        </div>
      )}
      {listaId && (
        <div className="mb-4 rounded-3xl bg-card px-5 py-5 shadow-soft">
          <p className="text-xs text-muted-foreground">Lista em uso</p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="min-w-0 break-words text-left text-2xl font-bold underline-offset-4 hover:underline focus-visible:underline"
              aria-label="Toque para alterar o nome da lista"
              title="Toque para alterar o nome da lista"
              onClick={() => {
                if (!listaId) return;
                setNovoNomeLista(listas.find((l) => l.id === listaId)?.nome || "");
                setEditarNomeLista(true);
              }}
            >
              {listas.find((l) => l.id === listaId)?.nome || "Nenhuma lista selecionada"}
            </button>
            {listaId && (
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-primary"
                aria-label="Alterar nome da lista"
                title="Alterar nome da lista"
                onClick={() => {
                  setNovoNomeLista(listas.find((l) => l.id === listaId)?.nome || "");
                  setEditarNomeLista(true);
                }}
              >
                <Pencil className="h-5 w-5" />
              </button>
            )}
          </div>
          <Button asChild className="mt-4 w-full">
            <Link to="/adicionar">
              <Plus className="h-4 w-4" /> Cadastrar item na lista
            </Link>
          </Button>
        </div>
      )}
      {editarNomeLista && listaId && (
        <div className="mb-4 rounded-2xl border bg-card p-4 shadow-soft">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSalvandoNomeLista(true);
              try {
                await renomearLista(listaId, novoNomeLista);
                toast.success("Nome da lista atualizado.");
                setEditarNomeLista(false);
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Não foi possível alterar o nome.",
                );
              } finally {
                setSalvandoNomeLista(false);
              }
            }}
          >
            <label htmlFor="novo-nome-lista" className="text-sm font-semibold">
              Nome da lista
            </label>
            <Input
              id="novo-nome-lista"
              className="mt-2 h-12 text-base"
              value={novoNomeLista}
              onChange={(e) => setNovoNomeLista(e.target.value)}
              maxLength={100}
              autoFocus
              required
            />
            <div className="mt-3 flex gap-2">
              <Button type="submit" disabled={salvandoNomeLista} className="flex-1">
                {salvandoNomeLista ? "Salvando..." : "Salvar nome"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditarNomeLista(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}
      {listaId && (
        <div className="mb-4">
          {itens.length === 0 && <ShoppingListBuilder />}
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setCadastroAberto(true)}
          >
            Cadastrar outra lista de compras
          </Button>
        </div>
      )}
      {listaId && (
        <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 py-2 backdrop-blur">
          <div
            className={
              "rounded-3xl bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm " +
              (level !== "normal" ? `budget-panel-${level}` : "")
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                Orçamento: {budget > 0 ? brl(budget) : "A definir"}
              </div>
              <BudgetEditor />
            </div>
            <p className="mt-2 text-xs">
              Saldo disponível do cartão:{" "}
              <strong>
                {cartoes.find((c) => c.id === cartaoCompraId)
                  ? brl(cartoes.find((c) => c.id === cartaoCompraId)!.saldo)
                  : "Cartão não vinculado"}
              </strong>
            </p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-100">
              <div
                className={"h-full rounded-full transition-colors " + barClass}
                style={{ width: `${100 - percent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                Gasto: <strong>{brl(totalCarrinho)}</strong>
              </span>
              <span>
                Restante: <strong>{budget > 0 ? brl(remaining) : "A definir"}</strong>
              </span>
            </div>
            {level !== "normal" && (
              <div className="mt-4">
                <BudgetAlert level={level} remaining={remaining} budget={budget} />
              </div>
            )}
            <p className="mt-3 border-t border-current/20 pt-3 text-xs leading-relaxed">
              O valor do item só entra no cálculo do orçamento quando você toca no ícone do
              carrinho.
            </p>
          </div>
        </div>
      )}

      {listaId && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-1 rounded-full border bg-muted/60 p-1 shadow-sm">
            <button
              className={
                "flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold " +
                (aba === "lista" ? "bg-primary text-primary-foreground shadow-sm" : "")
              }
              onClick={() => setAba("lista")}
            >
              <ListChecks className="h-4 w-4" /> Lista ({pendentes.length})
            </button>
            <button
              className={
                "flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold " +
                (aba === "carrinho" ? "bg-primary text-primary-foreground shadow-sm" : "")
              }
              onClick={() => setAba("carrinho")}
            >
              <ShoppingCart className="h-4 w-4" /> Carrinho ({carrinho.length})
            </button>
          </div>
          <div className="sticky top-[118px] z-10 mt-2 bg-background/95 py-2 backdrop-blur">
            <label className="flex h-12 items-center gap-2 rounded-full border bg-card px-4 shadow-sm">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                className="w-full min-w-0 bg-transparent text-base outline-none"
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {setores.map((setor) => (
                <button
                  key={setor}
                  onClick={() => setSetorFiltro(setor)}
                  className={
                    "shrink-0 rounded-full border px-4 py-2 text-xs font-medium shadow-sm " +
                    (setorFiltro === setor ? "bg-primary text-primary-foreground" : "bg-card")
                  }
                >
                  {setor}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <Button
                asChild
                size="icon"
                className="h-12 w-12 rounded-full shadow-md"
                aria-label="Adicionar produto à lista"
              >
                <Link to="/adicionar">
                  <Plus className="h-6 w-6" />
                </Link>
              </Button>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
          {aba === "lista" && (
            <p role="note" className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-2.5 text-sm text-foreground">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Para excluir um item da lista, altere a quantidade para <strong>0</strong>.</span>
            </p>
          )}
          {tabela(visiveis)}
        </div>
      )}
      {listaId && (
        <p className="mt-4 text-sm">
          No carrinho: {brl(totalCarrinho)} · Produtos pendentes: {pendentes.length} · Total com
          preços informados: {brl(total)}
        </p>
      )}
      {setorEditando &&
        (() => {
          const item = itens.find((i) => i.id === setorEditando);
          if (!item) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const nome = nomeEditando.trim();
                  if (!nome) {
                    toast.error("Informe o nome do produto.");
                    return;
                  }
                  setSalvandoProduto(true);
                  try {
                    await updateItem(
                      item.id,
                      {
                        nome,
                        setor: categoriaEditando as typeof item.setor,
                      },
                      produtoBase.current,
                    );
                    toast.success("Produto atualizado.");
                    draftStatus(false);
                    setSetorEditando(null);
                  } catch {
                    toast.error("Não foi possível atualizar o produto.");
                  } finally {
                    setSalvandoProduto(false);
                  }
                }}
                className="w-full max-w-md space-y-4 rounded-2xl bg-card p-5 shadow-xl"
              >
                <h3 className="text-lg font-bold">Editar produto</h3>
                <label className="block text-sm font-medium">
                  Nome do produto
                  <Input
                    className="mt-2 h-12 text-base"
                    autoFocus
                    value={nomeEditando}
                    onChange={(e) => setNomeEditando(e.target.value)}
                    required
                  />
                </label>
                <CategoryField
                  label="Categoria / setor"
                  value={categoriaEditando}
                  onChange={setCategoriaEditando}
                />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={salvandoProduto}>
                    {salvandoProduto ? "Salvando..." : "Salvar alterações"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      draftStatus(false);
                      setSetorEditando(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          );
        })()}
      {editando && (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <h3 className="font-semibold">Editar produto e setor</h3>
          <Input
            className="mt-2"
            value={edicao.nome}
            onChange={(e) => setEdicao((p) => ({ ...p, nome: e.target.value }))}
          />
          <CategoryField
            value={edicao.setor}
            onChange={(nome) => setEdicao((p) => ({ ...p, setor: nome }))}
          />
          <div className="mt-3 flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await updateItem(editando, {
                    nome: edicao.nome,
                    setor: edicao.setor as (typeof itens)[number]["setor"],
                  });
                  setEditando(null);
                } catch {
                  toast.error("Não foi possível editar.");
                }
              }}
            >
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {listaId && aba === "carrinho" && (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-950">
          <span className="font-medium">Total da compra</span>
          <span className="font-display text-xl font-extrabold">{brl(totalCarrinho)}</span>
        </div>
      )}
      {listaId && aba === "carrinho" && (
        <p className="mt-4 text-xs text-muted-foreground">
          Comprando juntos? Mantenham os dois celulares conectados e o app aberto antes de
          finalizar. Alterações de um celular sem internet só chegam após a sincronização.
        </p>
      )}
      {listaId && aba === "carrinho" && (
        <Button
          size="lg"
          className="mt-4 h-14 w-full rounded-2xl text-base"
          disabled={finalizando || !itens.some((i) => i.comprado)}
          onClick={async () => {
            if (finalizando) return;
            setFinalizando(true);
            try {
              const pendingItems = itens.filter((i) => !i.comprado).length;
              await finalizarCompra();
              setConclusao({ pendentes: pendingItems, offline: !online });
              setAba("lista");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Não foi possível finalizar a compra.",
              );
            } finally {
              setFinalizando(false);
            }
          }}
        >
          {finalizando ? "Conferindo e finalizando…" : "Finalizar compra (itens marcados)"}
        </Button>
      )}
      <Dialog open={cadastroAberto} onOpenChange={setCadastroAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogTitle>Cadastrar lista de compras</DialogTitle>
          <DialogDescription>
            Informe o nome, o cartão e o orçamento. Depois de criar, adicione os produtos na própria
            aba Lista.
          </DialogDescription>
          <ManualListForm onCreated={() => setCadastroAberto(false)} />
        </DialogContent>
      </Dialog>
    </Page>
  );
}
