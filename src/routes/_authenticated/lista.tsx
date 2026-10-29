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
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect } from "react";
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
    toggleItem,
    updateItem,
    removeItem,
    finalizarCompra,
    listas,
    listaId,
    importarListaPadrao,
    renomearLista,
    pendingCount,
    syncError,
    online,
  } = useDemo();
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
  const [rascunhos, setRascunhos] = useState<Record<string, { qtd: string; preco: string }>>({});
  useEffect(() => {
    setRascunhos(
      Object.fromEntries(
        itens.map((i) => [i.id, { qtd: String(i.qtd), preco: i.preco ? String(i.preco) : "" }]),
      ),
    );
  }, [itens]);
  /* A criação de listas fica exclusivamente na página inicial. */
  const [importando, setImportando] = useState(false);
  const [modeloCarregado, setModeloCarregado] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!listaId) return;
    try {
      setModeloCarregado((p) => ({
        ...p,
        [listaId]: localStorage.getItem("mercado-facil-modelo-" + listaId) === "sim",
      }));
    } catch {}
  }, [listaId]);
  const total = itens.reduce((s, i) => s + totalItem(i), 0);
  const pendentes = itens.filter((i) => !i.comprado);
  const carrinho = itens.filter((i) => i.comprado);
  const totalCarrinho = carrinho.reduce((s, i) => s + totalItem(i), 0);
  const budget = Number(listas.find((l) => l.id === listaId)?.orcamento || 0);
  const { remaining, percent, level } = budgetState(budget, totalCarrinho);
  const balanceClass =
    level === "danger"
      ? "text-red-700 font-bold"
      : level === "warning"
        ? "text-orange-700 font-bold"
        : "";
  const barClass =
    level === "danger" ? "bg-red-600" : level === "warning" ? "bg-orange-500" : "bg-emerald-800";
  async function salvarCampo(id: string, campo: "qtd" | "preco") {
    const valor = Number((rascunhos[id]?.[campo] || "").replace(",", "."));
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
      await updateItem(id, { [campo]: valor });
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
        onFocus={(e) => e.currentTarget.select()}
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
      </div>
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
      {listaId && !modeloCarregado[listaId] && itens.length < 50 && (
        <div className="mb-4 rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Lista mensal baseada na planilha de setembro. Mantém os itens já cadastrados e não
            duplica nomes. Os preços ficam em branco para preencher durante a compra.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-12"
            disabled={importando}
            onClick={async () => {
              if (
                !window.confirm(
                  "Adicionar os produtos da lista padrão a esta lista, sem apagar os itens existentes?",
                )
              )
                return;
              setImportando(true);
              try {
                const n = await importarListaPadrao();
                setModeloCarregado((p) => ({ ...p, [listaId]: true }));
                try {
                  localStorage.setItem("mercado-facil-modelo-" + listaId, "sim");
                } catch {}
                toast.success(
                  n
                    ? `${n} produtos adicionados à lista.`
                    : "Todos os produtos da lista padrão já estão presentes.",
                );
              } catch {
                toast.error("Não foi possível carregar a lista padrão.");
              } finally {
                setImportando(false);
              }
            }}
          >
            {importando ? "Carregando produtos..." : "Carregar lista padrão do mês"}
          </Button>
        </div>
      )}
      {listaId && (
        <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 py-2 backdrop-blur">
          <div className="rounded-3xl bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm">
            <div className="text-sm font-semibold">
              Orçamento: {brl(listas.find((l) => l.id === listaId)?.orcamento || 0)}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div
                className={"h-full rounded-full transition-colors " + barClass}
                style={{ width: `${100 - percent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between gap-2 text-xs">
              <span>
                Gasto: <strong>{brl(totalCarrinho)}</strong>
              </span>
              <span className={balanceClass}>
                Restante: <strong>{brl(remaining)}</strong>
              </span>
            </div>
            {level !== "normal" && (
              <p role="status" className={"mt-2 text-sm " + balanceClass}>
                {level === "danger"
                  ? "Atenção: resta 20% ou menos do orçamento."
                  : "Atenção: resta 30% ou menos do orçamento."}
              </p>
            )}
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
                "min-h-12 rounded-xl text-sm font-semibold " +
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
                    await updateItem(item.id, {
                      nome,
                      setor: categoriaEditando as typeof item.setor,
                    });
                    toast.success("Produto atualizado.");
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
                <label className="block text-sm font-medium">
                  Categoria / setor
                  <select
                    className="mt-2 h-12 w-full rounded-xl border bg-background px-3 text-base"
                    value={categoriaEditando}
                    onChange={(e) => setCategoriaEditando(e.target.value)}
                  >
                    {Array.from(
                      new Set([
                        ...itens.map((p) => p.setor),
                        "Mercearia",
                        "Higiene",
                        "Limpeza",
                        "Laticínios",
                        "Hortifrúti",
                        "Carnes",
                        "Padaria",
                        "Bebidas",
                        "Outros",
                        "Lavínia",
                        "Proteína",
                        "Temperos",
                      ]),
                    )
                      .sort((a, b) => a.localeCompare(b, "pt-BR"))
                      .map((setor) => (
                        <option key={setor} value={setor}>
                          {setor}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={salvandoProduto}>
                    {salvandoProduto ? "Salvando..." : "Salvar alterações"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSetorEditando(null)}>
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
          <select
            className="mt-2 w-full rounded-xl border bg-background p-3"
            value={edicao.setor}
            onChange={(e) => setEdicao((p) => ({ ...p, setor: e.target.value }))}
          >
            {[
              "Hortifrúti",
              "Mercearia",
              "Laticínios",
              "Carnes",
              "Padaria",
              "Limpeza",
              "Bebidas",
              "Higiene",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
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
        <Button
          size="lg"
          className="mt-4 h-14 w-full rounded-2xl text-base"
          disabled={!itens.some((i) => i.comprado)}
          onClick={() =>
            finalizarCompra().catch((error) =>
              toast.error(
                error instanceof Error ? error.message : "Não foi possível finalizar a compra.",
              ),
            )
          }
        >
          Finalizar compra (itens marcados)
        </Button>
      )}
    </Page>
  );
}
