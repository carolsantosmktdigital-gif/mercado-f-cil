import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDemo, brl } from "@/lib/demo-store";

type Props = {
  origem: string;
  nome: string;
  cartaoId?: string | undefined;
  orcamento?: number;
  historico?: boolean;
};
export function DuplicateListButton({
  origem,
  nome,
  cartaoId,
  orcamento,
  historico = false,
}: Props) {
  const { cartoes, duplicarLista } = useDemo();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(""),
    [card, setCard] = useState(""),
    [budget, setBudget] = useState(""),
    [requestId, setRequestId] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Duplicar ${nome}`}
        onClick={() => {
          setNewName(`${nome.slice(0, 92)} (cópia)`);
          setCard(cartoes.some((c) => c.id === cartaoId) ? cartaoId! : "");
          setBudget(orcamento && orcamento > 0 ? String(orcamento) : "");
          setRequestId(crypto.randomUUID());
          setOpen(true);
        }}
      >
        <Copy className="h-4 w-4" /> Duplicar
      </Button>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogTitle>Duplicar lista</DialogTitle>
        <DialogDescription>
          Crie uma nova compra a partir de “{nome}”. Os produtos, categorias e quantidades serão
          copiados. Preços e marcações do carrinho começarão zerados.
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              await duplicarLista(
                origem,
                newName,
                card,
                Number(budget.replace(",", ".")),
                requestId,
                historico,
              );
              setOpen(false);
              toast.success("Cópia criada. Sua nova lista está pronta para usar.");
              void navigate({ to: "/lista" });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Não foi possível duplicar a lista. Tente novamente.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-medium">
              Nome da nova lista
              <Input
                required
                maxLength={100}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Cartão da nova compra
              <select
                required
                className="h-12 w-full rounded-xl border bg-background px-3"
                value={card}
                onChange={(e) => setCard(e.target.value)}
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
              Orçamento da nova compra (R$)
              <Input
                required
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Duplicar não desconta valores do cartão. Conecte-se à internet para criar a cópia com
              todas as alterações sincronizadas.
            </p>
            <Button type="submit" className="w-full">
              {busy ? "Duplicando…" : "Criar cópia"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
