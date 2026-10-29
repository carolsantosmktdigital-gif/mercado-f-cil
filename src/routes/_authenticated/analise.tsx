import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  ChartNoAxesCombined,
  CalendarDays,
} from "lucide-react";
import { Page } from "@/components/AppShell";
import { brl, useDemo } from "@/lib/demo-store";
import {
  analysisMonth,
  analysisSummary,
  filterAnalysis,
  type AnalysisFilter,
  type PriceComparison,
} from "@/lib/analysis";

export const Route = createFileRoute("/_authenticated/analise")({
  head: () => ({
    meta: [
      { title: "Análise de preços — Mercado Fácil" },
      {
        name: "description",
        content: "Compare os preços da sua lista com o mês imediatamente anterior.",
      },
    ],
  }),
  component: Analise,
});
const filters: { value: AnalysisFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "alta", label: "Em alta" },
  { value: "baixa", label: "Mais baixos" },
  { value: "igual", label: "Sem mudança" },
  { value: "sem_comparacao", label: "Sem comparação" },
];
function Analise() {
  const { analises = [], analisesLoading, analisesError, pendingCount, online } = useDemo();
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<AnalysisFilter>("todos");
  const [search, setSearch] = useState("");
  const selected = analises.find((a) => a.id === selectedId) || analises[0];
  const summary = analysisSummary(selected?.itens || []);
  const items = filterAnalysis(selected?.itens || [], filter, search);
  return (
    <Page title="Análise de preços" subtitle="Sua lista × mês anterior">
      <div className="mb-5 rounded-3xl bg-emerald-50 p-5 text-emerald-950">
        <div className="flex items-center gap-2 font-bold">
          <ChartNoAxesCombined className="h-5 w-5" />O que mudou no mercado?
        </div>
        <p className="mt-2 text-sm">
          Comparamos automaticamente os preços unitários de listas finalizadas em meses
          consecutivos. Novembro compara somente com outubro; dezembro, somente com novembro.
        </p>
        <p className="mt-2 text-xs">
          Sem compra no mês anterior, não há comparação com meses mais antigos.
        </p>
      </div>
      {pendingCount > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          Novas análises serão registradas após a sincronização das compras. As análises já
          carregadas continuam disponíveis neste celular.
        </p>
      )}
      {analisesLoading ? (
        <p role="status" className="py-8 text-center text-muted-foreground">
          {online
            ? "Carregando análises…"
            : "Conecte-se para carregar suas análises pela primeira vez."}
        </p>
      ) : analisesError && !selected ? (
        <p role="alert" className="rounded-2xl border p-5 text-sm">
          Não foi possível carregar as análises. Conecte-se à internet e abra esta aba novamente.
        </p>
      ) : !selected ? (
        <section className="rounded-3xl border bg-card px-5 py-10 text-center shadow-soft">
          <CalendarDays className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-lg font-bold">Aguardando o próximo mês</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Quando houver duas listas finalizadas em meses consecutivos, a comparação será
            registrada aqui automaticamente.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Compras no mesmo mês ou com intervalo maior que um mês não geram comparação.
          </p>
        </section>
      ) : (
        <>
          <label htmlFor="comparison" className="text-sm font-semibold">
            Análises registradas
          </label>
          <select
            id="comparison"
            className="mt-2 min-h-12 w-full rounded-2xl border bg-card px-3 text-sm"
            value={selected.id}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setFilter("todos");
              setSearch("");
            }}
          >
            {analises.map((a) => (
              <option key={a.id} value={a.id}>
                {analysisMonth(a.data_atual)} × {analysisMonth(a.data_anterior)} ·{" "}
                {a.lista_atual_nome} / {a.lista_anterior_nome}
              </option>
            ))}
          </select>
          <section className="mt-4 rounded-3xl border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-bold capitalize">
              {analysisMonth(selected.data_atual)} × {analysisMonth(selected.data_anterior)}
            </h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {selected.lista_atual_nome} comparada com {selected.lista_anterior_nome}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Summary label="Subiram" value={summary.alta} color="text-red-700 bg-red-50" />
              <Summary
                label="Caíram"
                value={summary.baixa}
                color="text-emerald-800 bg-emerald-50"
              />
              <Summary label="Iguais" value={summary.igual} color="text-slate-700 bg-slate-100" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {summary.semComparacao} produto(s) sem comparação. Usamos o preço por unidade para que
              mudanças na quantidade não pareçam aumentos de preço.
            </p>
          </section>
          <label className="mt-5 flex min-h-12 items-center gap-2 rounded-full border bg-card px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              aria-label="Buscar produto na análise"
              className="w-full min-w-0 bg-transparent text-base outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
            />
          </label>
          <div aria-label="Filtrar análise" className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {filters.map((f) => (
              <button
                key={f.value}
                aria-pressed={filter === f.value}
                className={
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium " +
                  (filter === f.value ? "bg-primary text-primary-foreground" : "bg-card")
                }
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A comparação usa o nome do produto. Mantenha a mesma unidade e embalagem nas duas
            listas. Se ele aparece mais de uma vez na lista, usamos o preço médio ponderado pela
            quantidade.
          </p>
          <ul className="mt-4 space-y-3" aria-label="Comparação item a item">
            {items.map((item) => (
              <PriceRow
                key={item.nome}
                item={item}
                previousMonth={analysisMonth(selected.data_anterior)}
                currentMonth={analysisMonth(selected.data_atual)}
              />
            ))}
          </ul>
          {!items.length && (
            <p className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado neste filtro.
            </p>
          )}
        </>
      )}
    </Page>
  );
}
function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={"rounded-2xl p-3 text-center " + color}>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}
function PriceRow({
  item,
  previousMonth,
  currentMonth,
}: {
  item: PriceComparison;
  previousMonth: string;
  currentMonth: string;
}) {
  const high = item.situacao === "alta",
    low = item.situacao === "baixa",
    equal = item.situacao === "igual";
  const Icon = high ? ArrowUpRight : low ? ArrowDownRight : Minus;
  const label = high
    ? "Em alta"
    : low
      ? "Mais baixo"
      : equal
        ? "Sem mudança"
        : item.situacao === "novo"
          ? "Só na lista atual"
          : item.situacao === "ausente"
            ? "Só na lista anterior"
            : "Preço indisponível";
  const color = high
    ? "bg-red-50 text-red-700"
    : low
      ? "bg-emerald-50 text-emerald-800"
      : "bg-slate-100 text-slate-700";
  return (
    <li className="rounded-3xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-bold">{item.nome}</h3>
        <span
          className={
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold " +
            color
          }
        >
          <Icon className="h-3 w-3" />
          {label}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs capitalize text-muted-foreground">{previousMonth}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {item.precoAnterior === null ? "—" : brl(item.precoAnterior)}
          </p>
        </div>
        <div>
          <p className="text-xs capitalize text-muted-foreground">{currentMonth}</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {item.precoAtual === null ? "—" : brl(item.precoAtual)}
          </p>
        </div>
      </div>
      {item.diferenca !== null && item.percentual !== null ? (
        <p className={"mt-3 rounded-xl px-3 py-2 text-sm font-bold " + color}>
          {high ? "+" : low ? "−" : ""}
          {brl(Math.abs(item.diferenca))} por unidade · {high ? "+" : low ? "−" : ""}
          {Math.abs(item.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Sem dois preços válidos para comparar este produto.
        </p>
      )}
    </li>
  );
}
