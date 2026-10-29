import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDemo } from "@/lib/demo-store";
export function BudgetEditor() {
  const { orcamento, atualizarOrcamento } = useDemo();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false);
  const saving = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving.current) setOpen(next);
      }}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="budget-edit-button"
        onClick={() => {
          setValue(orcamento > 0 ? String(orcamento) : "");
          setOpen(true);
        }}
      >
        {orcamento > 0 ? "Editar orçamento" : "Definir orçamento"}
      </Button>
      <DialogContent className="rounded-2xl">
        <DialogTitle>Orçamento desta lista</DialogTitle>
        <DialogDescription>
          Defina quanto pretende gastar nesta compra. O saldo do cartão será descontado somente ao
          finalizar a compra no carrinho.
        </DialogDescription>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            try {
              await atualizarOrcamento(Number(value.replace(",", ".")));
              setOpen(false);
              toast.success("Orçamento desta lista atualizado.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Não foi possível atualizar o orçamento.",
              );
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm font-medium">
            Valor do orçamento (R$)
            <Input
              required
              disabled={busy}
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Salvando…" : "Salvar orçamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
