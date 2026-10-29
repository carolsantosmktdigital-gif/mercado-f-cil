import { useEffect, useRef, useState } from "react";
import { X, Pencil, Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, SETORES, type Compra } from "@/lib/demo-store";
import {
  historyItemTotal,
  historyTotal,
  validateHistoryItems,
  type HistoryItem,
} from "@/lib/history";

type Draft = { id: string; nome: string; setor: string; qtd: string; preco: string };
const parse = (value: string) => Number(value.trim().replace(",", "."));
const asItems = (drafts: Draft[]): HistoryItem[] =>
  drafts.map((i) => ({ ...i, qtd: parse(i.qtd), preco: i.preco.trim() ? parse(i.preco) : NaN }));
export function PurchaseDetails({
  compra,
  onClose,
  onSave,
}: {
  compra: Compra;
  onClose: () => void;
  onSave: (compra: Compra, itens: HistoryItem[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [snapshot, setSnapshot] = useState(compra);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  const draftItems = asItems(drafts);
  const draftValid =
    draftItems.length > 0 &&
    draftItems.every(
      (i) =>
        i.nome.trim() &&
        Number.isFinite(i.qtd) &&
        i.qtd > 0 &&
        Number.isFinite(i.preco) &&
        i.preco >= 0,
    );
  const newTotal = draftValid ? historyTotal(draftItems) : null;
  const difference = newTotal === null ? 0 : Math.round((newTotal - snapshot.total) * 100) / 100;
  function startEditing(id: string | null) {
    setSelectedId(id);
    setSnapshot(compra);
    setDrafts(
      (compra.produtos || []).map((i) => ({ ...i, qtd: String(i.qtd), preco: String(i.preco) })),
    );
    setEditing(true);
  }
  function change(id: string, key: keyof Draft, value: string) {
    setDrafts((previous) => previous.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const itens = asItems(drafts);
      validateHistoryItems(itens);
      await onSave(snapshot, itens);
      setEditing(false);
      toast.success("Itens atualizados. Saldo ajustado e alteração salva para sincronizar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os itens.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        className="min-h-full w-full max-w-lg bg-background px-3 py-5 sm:p-5"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) {
            onClose();
            return;
          }
          if (e.key === "Tab") {
            const controls = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
            );
            const first = controls?.[0],
              last = controls?.[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">
              {editing ? "Editar compra" : "Detalhes da compra"}
            </p>
            <h2 id="purchase-title" className="mt-1 break-words text-xl font-bold">
              {compra.listaNome || "Compra do histórico"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(compra.data + "T12:00:00").toLocaleDateString("pt-BR")} · {compra.cartao}
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
        {compra.pendente && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Compra salva neste celular · Aguardando sincronização
          </p>
        )}
        {!editing ? (
          <>
            {compra.produtos === undefined ? (
              <p role="status" className="mt-5 rounded-xl border p-4 text-sm">
                Conecte-se à internet para carregar os itens desta compra pela primeira vez.
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  Toque no produto que deseja editar.
                </p>
                <ul className="mt-3 space-y-4" aria-label="Produtos comprados">
                  {Array.from(new Set(compra.produtos.map((i) => i.setor))).map((setor) => (
                    <li
                      key={setor}
                      className="overflow-hidden rounded-2xl border bg-card shadow-soft"
                    >
                      <h3 className="bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-950">
                        {setor}
                      </h3>
                      <div className="grid grid-cols-[minmax(0,1fr)_36px_70px_70px_28px] gap-1 bg-muted/60 px-2 py-2 text-[10px] font-semibold text-muted-foreground">
                        <span>Produto</span>
                        <span>Qtd</span>
                        <span>Preço un.</span>
                        <span className="text-right">Total</span>
                        <span />
                      </div>
                      {compra
                        .produtos!.filter((i) => i.setor === setor)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => startEditing(item.id)}
                            aria-label={`Editar ${item.nome}`}
                            className="grid w-full grid-cols-[minmax(0,1fr)_36px_70px_70px_28px] items-center gap-1 border-t px-2 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <span className="min-w-0 break-words text-xs font-medium">
                              {item.nome}
                            </span>
                            <span className="text-xs">{item.qtd.toLocaleString("pt-BR")}</span>
                            <span className="text-xs tabular-nums">{brl(item.preco)}</span>
                            <strong className="text-right text-[11px] tabular-nums">
                              {brl(historyItemTotal(item))}
                            </strong>
                            <Pencil
                              className="h-4 w-4 justify-self-center text-primary"
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-5 flex justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-950">
              <span>Total da compra</span>
              <strong>{brl(compra.total)}</strong>
            </div>
            <Button
              type="button"
              className="mt-4 min-h-12 w-full rounded-2xl"
              disabled={compra.produtos === undefined}
              onClick={() => {
                const id = crypto.randomUUID();
                startEditing(id);
                setDrafts((prev) => [
                  ...prev,
                  { id, nome: "", setor: "Mercearia", qtd: "1", preco: "" },
                ]);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar produto comprado
            </Button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mt-4 text-sm text-muted-foreground">
              Corrija o produto selecionado. A diferença no total será descontada ou devolvida ao
              cartão vinculado.
            </p>
            <div className="mt-4 space-y-4">
              {drafts.map((item, index) =>
                item.id === selectedId ? (
                  <fieldset key={item.id} className="rounded-2xl border bg-card p-4">
                    <legend className="px-1 text-xs font-semibold">Produto {index + 1}</legend>
                    <label className="block text-sm">
                      Nome
                      <Input
                        aria-label={`Nome do produto ${index + 1}`}
                        className="mt-1 min-h-11 text-base"
                        required
                        maxLength={200}
                        value={item.nome}
                        onChange={(e) => change(item.id, "nome", e.target.value)}
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-sm">
                        Quantidade
                        <Input
                          aria-label={`Quantidade do produto ${index + 1}`}
                          className="mt-1 min-h-11 text-base"
                          inputMode="decimal"
                          required
                          value={item.qtd}
                          onChange={(e) => change(item.id, "qtd", e.target.value)}
                        />
                      </label>
                      <label className="text-sm">
                        Preço unitário
                        <Input
                          aria-label={`Preço do produto ${index + 1}`}
                          className="mt-1 min-h-11 text-base"
                          inputMode="decimal"
                          required
                          value={item.preco}
                          onChange={(e) => change(item.id, "preco", e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-sm">
                      Setor
                      <select
                        aria-label={`Setor do produto ${index + 1}`}
                        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-base"
                        value={item.setor}
                        onChange={(e) => change(item.id, "setor", e.target.value)}
                      >
                        {Array.from(
                          new Set([...SETORES, ...drafts.map((i) => i.setor), "Outros"]),
                        ).map((setor) => (
                          <option key={setor}>{setor}</option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        Total:{" "}
                        {Number.isFinite(parse(item.qtd)) && Number.isFinite(parse(item.preco))
                          ? brl(
                              historyItemTotal({ qtd: parse(item.qtd), preco: parse(item.preco) }),
                            )
                          : "—"}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDrafts((prev) => prev.filter((i) => i.id !== item.id))}
                        aria-label={`Remover produto ${index + 1}`}
                        className="flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </button>
                    </div>
                  </fieldset>
                ) : null,
              )}
            </div>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-emerald-950">
              <div className="flex justify-between">
                <span>Novo total</span>
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
              <Button type="submit" disabled={saving || !draftValid} className="min-h-12 flex-1">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
              <Button
                type="button"
                disabled={saving}
                variant="outline"
                className="min-h-12"
                onClick={() => setEditing(false)}
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
