import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, useDemo } from "@/lib/demo-store";
export function ManualListForm({ onCreated }: { onCreated: () => void }) {
  const { cartoes, criarLista } = useDemo();
  const [nome, setNome] = useState(""),
    [cartao, setCartao] = useState(""),
    [valor, setValor] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  if (!cartoes.length)
    return (
      <div className="space-y-3">
        <p className="text-sm">Primeiro, cadastre um cartão e o orçamento da compra.</p>
        <Button asChild>
          <Link to="/cartoes">Cadastrar cartão e orçamento</Link>
        </Button>
      </div>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        try {
          await criarLista(nome.trim(), cartao, Number(valor.replace(",", ".")), 0);
          toast.success("Lista criada. Você já pode adicionar os produtos.");
          onCreated();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível criar a lista.");
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm font-medium">
          Nome da lista
          <Input
            required
            maxLength={100}
            placeholder="Nome da lista"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Cartão
          <select
            required
            className="h-12 w-full rounded-xl border bg-background px-3"
            value={cartao}
            onChange={(event) => setCartao(event.target.value)}
          >
            <option value="">Selecione um cartão</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {brl(c.saldo)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Orçamento da compra (R$)
          <Input
            required
            inputMode="decimal"
            placeholder="Valor destinado às compras (R$)"
            value={valor}
            onChange={(event) => setValor(event.target.value)}
          />
        </label>
        <Button type="submit" className="w-full">
          {busy ? "Criando…" : "Criar lista"}
        </Button>
      </fieldset>
    </form>
  );
}
