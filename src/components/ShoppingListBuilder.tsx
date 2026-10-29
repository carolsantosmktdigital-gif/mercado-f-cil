import { historyTemplateItems } from "@/lib/history";
import { analysisDate } from "@/lib/analysis";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo, type Compra } from "@/lib/demo-store";
import {
  generateShoppingList,
  MEALS,
  type Meal,
  type TemplateItem,
} from "@/lib/shopping-templates";

export function ShoppingListBuilder() {
  const { criarLista, cartoes, historico = [] } = useDemo();
  const lastPurchase = [...historico].sort((a, b) => b.data.localeCompare(a.data))[0];
  const [source, setSource] = useState<Compra | null>(null);
  const [declined, setDeclined] = useState(false);
  const [open, setOpen] = useState(false),
    [total, setTotal] = useState(2),
    [adultos, setAdultos] = useState(2),
    [criancas, setCriancas] = useState(0),
    [dias, setDias] = useState(30);
  const [refeicoes, setRefeicoes] = useState<Meal[]>([...MEALS]);
  const [items, setItems] = useState<TemplateItem[] | null>(null);
  const [nome, setNome] = useState(""),
    [cartao, setCartao] = useState(""),
    [budget, setBudget] = useState(""),
    [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState("");
  const submitting = useRef(false);
  const numeric = (label: string, value: number, change: (n: number) => void, min = 0) => (
    <label className="block text-sm font-medium">
      {label}
      <Input
        type="number"
        min={min}
        max={100}
        step="1"
        required
        value={value}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
  return (
    <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-bold">
        {source ? "Reutilizar última compra" : "Lista pronta para sua família"}
      </h2>
      {!open && !declined && !!lastPurchase?.produtos?.length && (
        <div className="mt-3 space-y-3 rounded-xl bg-accent p-3">
          <p className="font-semibold">Deseja usar a mesma lista da última compra?</p>
          <p className="text-sm">
            {lastPurchase.listaNome || "Última compra"} · {analysisDate(lastPurchase.data)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                setSource(lastPurchase);
                setItems(historyTemplateItems(lastPurchase.produtos!));
                setNome(lastPurchase.listaNome || "Minha lista de compras");
                setCartao(
                  cartoes.some((c) => c.id === lastPurchase.cartaoId) ? lastPurchase.cartaoId! : "",
                );
                setBudget("");
                setRequestId(crypto.randomUUID());
                setOpen(true);
              }}
            >
              Sim, usar última compra
            </Button>
            <Button variant="outline" onClick={() => setDeclined(true)}>
              Não, criar uma nova
            </Button>
          </div>
        </div>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {source
          ? "Confira os produtos da compra anterior antes de criar a nova lista."
          : "Informe as pessoas, o período e as refeições para montar sua lista."}
      </p>
      <Button
        className="mt-3 w-full"
        disabled={busy}
        onClick={() => {
          setOpen(true);
          setSource(null);
          setItems(null);
          setNome("Minha lista de compras");
        }}
      >
        Gerar lista automática
      </Button>
      {open && (
        <div className="mt-4 space-y-4">
          {!items ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  setItems(generateShoppingList({ total, adultos, criancas, dias, refeicoes }));
                  setRequestId(crypto.randomUUID());
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              {numeric("Para quantas pessoas será a compra?", total, setTotal, 1)}
              <fieldset className="grid grid-cols-2 gap-3">
                <legend className="mb-2 text-sm font-medium">
                  Dessas pessoas, quantas são adultas e quantas são crianças?
                </legend>
                {numeric("Adultos", adultos, setAdultos, 1)}
                {numeric("Crianças", criancas, setCriancas)}
              </fieldset>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {adultos + criancas} de {total} pessoas informadas.
              </p>
              <label className="block text-sm font-medium">
                Para quanto tempo será a compra?
                <select
                  className="mt-1 h-12 w-full rounded-xl border bg-background px-3"
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                >
                  <option value={7}>Uma semana</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>Um mês</option>
                </select>
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Quais refeições costumam fazer em casa?
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {MEALS.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={refeicoes.includes(m)}
                        onChange={(e) =>
                          setRefeicoes((prev) =>
                            e.target.checked ? [...prev, m] : prev.filter((x) => x !== m),
                          )
                        }
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" className="w-full">
                Montar lista sugerida
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitting.current) return;
                submitting.current = true;
                setBusy(true);
                try {
                  if (
                    items.some(
                      (item) =>
                        !Number.isFinite(item.qtd) ||
                        item.qtd <= 0 ||
                        (!source && !Number.isInteger(item.qtd)),
                    )
                  )
                    throw new Error("Informe quantidades inteiras, a partir de 1.");
                  const result = await criarLista(
                    nome,
                    cartao,
                    Number(budget.replace(",", ".")),
                    0,
                    items,
                    requestId,
                  );
                  toast.success(
                    result === "existing"
                      ? "Esta lista já existe e foi selecionada. Use Duplicar se quiser uma cópia."
                      : "Lista personalizada criada. Você pode adicionar outros produtos na lista.",
                  );
                  setOpen(false);
                  setItems(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível criar a lista. Tente novamente.",
                  );
                } finally {
                  submitting.current = false;
                  setBusy(false);
                }
              }}
            >
              <h3 className="font-bold">Revise sua lista · {items.length} produtos</h3>
              <p className="text-sm text-muted-foreground">
                {source
                  ? `Itens e quantidades da compra de ${analysisDate(source.data)}. Confira e ajuste se desejar. Os preços e as marcações do carrinho serão zerados para a nova compra.`
                  : `Quantidades aproximadas para ${total} pessoas por ${dias} dias. Ajuste ao seu consumo e ao que já tem em casa. Hortifrúti e pães podem ser comprados aos poucos. Preencha o preço por kg, pacote ou unidade indicada durante a compra.`}
              </p>
              <p className="text-sm text-muted-foreground">
                Itens de bebê podem ser adicionados depois em Crianças.
              </p>
              <fieldset disabled={busy} className="space-y-4">
                {Array.from(new Set(items.map((i) => i.setor))).map((setor) => (
                  <div key={setor}>
                    <h4 className="mb-2 font-semibold">{setor}</h4>
                    <div className="space-y-2">
                      {items.map(
                        (item, index) =>
                          item.setor === setor && (
                            <div
                              key={`${item.nome}-${index}`}
                              className="flex items-center gap-2 rounded-xl bg-muted p-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{item.nome}</p>
                                <p className="text-xs text-muted-foreground">{item.unidade}</p>
                              </div>
                              <Input
                                aria-label={`Quantidade de ${item.nome}`}
                                type="number"
                                min={source ? "0.001" : "1"}
                                max="999999"
                                step={source ? "0.001" : "1"}
                                required
                                className="w-20"
                                value={item.qtd}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev!.map((p, j) =>
                                      j === index ? { ...p, qtd: Number(e.target.value) } : p,
                                    ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="p-2 text-sm text-destructive"
                                aria-label={`Remover ${item.nome}`}
                                onClick={() =>
                                  setItems((prev) => prev!.filter((_, j) => j !== index))
                                }
                              >
                                Excluir
                              </button>
                            </div>
                          ),
                      )}
                    </div>
                  </div>
                ))}
                <label className="block text-sm font-medium">
                  Nome da lista
                  <Input
                    required
                    maxLength={100}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Cartão
                  <select
                    required
                    className="h-12 w-full rounded-xl border bg-background px-3"
                    value={cartao}
                    onChange={(e) => setCartao(e.target.value)}
                  >
                    <option value="">Selecione um cartão</option>
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Orçamento (R$)
                  <Input
                    required
                    inputMode="decimal"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>
                <Button disabled={!items.length || busy} className="w-full" type="submit">
                  {busy ? "Criando…" : "Criar minha lista"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setItems(null);
                    if (source) {
                      setSource(null);
                      setOpen(false);
                    }
                  }}
                >
                  {source ? "Voltar às opções" : "Alterar respostas"}
                </Button>
              </fieldset>
            </form>
          )}
          <Button disabled={busy} type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </section>
  );
}
