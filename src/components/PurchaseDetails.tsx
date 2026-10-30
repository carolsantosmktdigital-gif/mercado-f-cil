import { analysisDate } from "@/lib/analysis";
import { useEffect, useRef, useState } from "react";
import { X, Pencil, Trash2, Plus, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CategoryField } from "@/components/CategoryField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, type Compra } from "@/lib/demo-store";
import {
  historyItemTotal,
  historyTotal,
  validateHistoryItems,
  type HistoryItem,
} from "@/lib/history";
type Draft = { id: string; nome: string; setor: string; qtd: string; preco: string };
const parse = (value: string) => (value.trim() ? Number(value.trim().replace(",", ".")) : NaN);
export function PurchaseDetails({
  compra,
  onClose,
  onSave,
}: {
  compra: Compra;
  onClose: () => void;
  onSave: (compra: Compra, itens: HistoryItem[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapshot, setSnapshot] = useState(compra);
  const [saving, setSaving] = useState(false);
  const [localReceipt, setLocalReceipt] = useState<Compra | null>(null);
  const shown =
    localReceipt?.id === compra.id && (localReceipt.revisao || 0) > (compra.revisao || 0)
      ? localReceipt
      : compra;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  function startEditing(index: number) {
    const item = shown.produtos?.[index] || {
      id: crypto.randomUUID(),
      nome: "",
      setor: "Mercearia",
      qtd: 1,
      preco: 0,
    };
    setSnapshot(shown);
    setSelectedIndex(index);
    setDraft({
      ...item,
      qtd: String(item.qtd),
      preco: index === (shown.produtos?.length || 0) ? "" : String(item.preco),
    });
  }
  const editedItem = draft
    ? { ...draft, nome: draft.nome.trim(), qtd: parse(draft.qtd), preco: parse(draft.preco) }
    : null;
  // Only the selected position is replaced. Other products never become editable fields,
  // including legacy receipts with missing or repeated item IDs.
  const editedItems = editedItem
    ? selectedIndex === (snapshot.produtos?.length || 0)
      ? [...(snapshot.produtos || []), editedItem]
      : (snapshot.produtos || []).map((item, index) =>
          index === selectedIndex ? editedItem : item,
        )
    : [];
  let valid = false;
  try {
    if (draft) {
      validateHistoryItems(editedItems);
      valid = true;
    }
  } catch {}
  const newTotal = valid ? historyTotal(editedItems) : null;
  const difference = newTotal === null ? 0 : Math.round((newTotal - snapshot.total) * 100) / 100;
  async function persist(base: Compra, items: HistoryItem[], message: string) {
    setSaving(true);
    try {
      validateHistoryItems(items);
      await onSave(base, items);
      setLocalReceipt({
        ...base,
        produtos: items,
        total: historyTotal(items),
        itens: items.length,
        revisao: (base.revisao || 0) + 1,
        pendente: true,
      });
      setDraft(null);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a alteração.");
    } finally {
      setSaving(false);
    }
  }
  function remove(base: Compra, index: number) {
    return persist(
      base,
      (base.produtos || []).filter((_, position) => position !== index),
      "Produto excluído. Total da compra e saldo atualizados.",
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        className="min-h-full w-full max-w-lg bg-background px-3 py-5 sm:p-5"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            if (draft) setDraft(null);
            else onClose();
            return;
          }
          if (event.key === "Tab") {
            const controls = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
            );
            const first = controls?.[0],
              last = controls?.[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">
              {draft ? "Editar somente este produto" : "Itens da compra"}
            </p>
            <h2 id="purchase-title" className="mt-1 break-words text-xl font-bold">
              {shown.listaNome || "Compra do histórico"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compra realizada em <time dateTime={shown.data}>{analysisDate(shown.data)}</time> ·{" "}
              {shown.cartao}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="rounded-full border p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {shown.pendente && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Alteração salva neste celular · Aguardando sincronização
          </p>
        )}
        {!draft ? (
          <>
            {shown.produtos === undefined ? (
              <p role="status" className="mt-5 rounded-xl border p-4 text-sm">
                Conecte-se à internet para carregar os itens desta compra pela primeira vez.
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  Escolha o produto que deseja editar ou excluir.
                </p>
                {shown.produtos.length === 0 && (
                  <p className="mt-4 rounded-2xl border p-5 text-sm">Nenhum item nesta compra.</p>
                )}
                <ul className="mt-3 space-y-4" aria-label="Produtos comprados">
                  {Array.from(new Set(shown.produtos.map((i) => i.setor))).map((setor) => (
                    <li
                      key={setor}
                      className="overflow-hidden rounded-2xl border bg-card shadow-soft"
                    >
                      <h3 className="bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-950">
                        {setor}
                      </h3>
                      <div className="grid grid-cols-[minmax(0,1fr)_30px_62px_64px_64px] items-center gap-1 bg-muted/60 px-2 py-2 text-[10px] font-semibold text-muted-foreground">
                        <span>Produto</span>
                        <span>Qtd</span>
                        <span>Preço un.</span>
                        <span className="text-right">Total</span>
                        <span className="text-center">Ações</span>
                      </div>
                      {shown.produtos!.map((item, index) =>
                        item.setor === setor ? (
                          <div
                            key={`${item.id || "produto"}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_30px_62px_64px_64px] items-center gap-1 border-t px-2 py-3"
                          >
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => startEditing(index)}
                              aria-label={`Editar ${item.nome}`}
                              className="min-w-0 break-words text-left text-xs font-medium underline-offset-2 hover:underline"
                            >
                              {item.nome}
                            </button>
                            <span className="text-xs">{item.qtd.toLocaleString("pt-BR")}</span>
                            <span className="text-xs tabular-nums">{brl(item.preco)}</span>
                            <strong className="text-right text-[11px] tabular-nums">
                              {brl(historyItemTotal(item))}
                            </strong>
                            <span className="flex justify-end">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => startEditing(index)}
                                aria-label={`Editar valores de ${item.nome}`}
                                className="flex h-10 w-8 items-center justify-center rounded-lg text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void remove(shown, index)}
                                aria-label={`Excluir ${item.nome}`}
                                className="flex h-10 w-8 items-center justify-center rounded-lg text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          </div>
                        ) : null,
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div
              className="mt-5 flex justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-950"
              aria-live="polite"
            >
              <span>Total da compra</span>
              <strong>{brl(shown.total)}</strong>
            </div>
            <Button
              type="button"
              className="mt-4 min-h-12 w-full rounded-2xl"
              disabled={saving || shown.produtos === undefined}
              onClick={() => startEditing(shown.produtos?.length || 0)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar produto comprado
            </Button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void persist(
                snapshot,
                editedItems,
                "Produto atualizado. Total da compra e saldo recalculados.",
              );
            }}
          >
            <button
              type="button"
              disabled={saving}
              className="mt-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
              onClick={() => setDraft(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à lista
            </button>
            <fieldset className="mt-3 space-y-4 rounded-2xl border bg-card p-4" disabled={saving}>
              <legend className="px-1 text-sm font-bold">
                {snapshot.produtos?.[selectedIndex]?.nome || "Novo produto"}
              </legend>
              <label className="block text-sm">
                Nome
                <Input
                  aria-label={`Nome do produto ${selectedIndex + 1}`}
                  className="mt-1 min-h-11 text-base"
                  required
                  maxLength={200}
                  value={draft.nome}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Quantidade
                  <Input
                    aria-label={`Quantidade do produto ${selectedIndex + 1}`}
                    className="mt-1 min-h-11 text-base"
                    inputMode="decimal"
                    required
                    value={draft.qtd}
                    onChange={(e) => setDraft({ ...draft, qtd: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Preço unitário
                  <Input
                    aria-label={`Preço do produto ${selectedIndex + 1}`}
                    className="mt-1 min-h-11 text-base"
                    inputMode="decimal"
                    required
                    value={draft.preco}
                    onChange={(e) => setDraft({ ...draft, preco: e.target.value })}
                  />
                </label>
              </div>
              <CategoryField
                label="Categoria / setor"
                ariaLabel={`Setor do produto ${selectedIndex + 1}`}
                value={draft.setor}
                extra={(snapshot.produtos || []).map((i) => i.setor)}
                onChange={(setor) => setDraft({ ...draft, setor })}
              />
              <p className="text-xs text-muted-foreground">
                Use até 2 casas decimais no preço e 3 na quantidade.
              </p>
              {selectedIndex < (snapshot.produtos?.length || 0) && (
                <button
                  type="button"
                  disabled={saving}
                  className="flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-red-700"
                  aria-label={`Excluir ${snapshot.produtos![selectedIndex]!.nome}`}
                  onClick={() => void remove(snapshot, selectedIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir este produto
                </button>
              )}
            </fieldset>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-emerald-950" aria-live="polite">
              <div className="flex justify-between">
                <span>Novo total da compra</span>
                <strong>{newTotal === null ? "Confira os valores" : brl(newTotal)}</strong>
              </div>
              {newTotal !== null && (
                <p className="mt-2 text-sm">
                  {difference > 0
                    ? `${brl(difference)} a descontar do cartão.`
                    : difference < 0
                      ? `${brl(-difference)} a devolver ao cartão.`
                      : "O saldo do cartão permanece igual."}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={saving || !valid} className="min-h-12 flex-1">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
              <Button
                type="button"
                disabled={saving}
                variant="outline"
                className="min-h-12"
                onClick={() => setDraft(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
