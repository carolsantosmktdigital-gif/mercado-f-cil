import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDemo } from "@/lib/demo-store";
export function DeleteListButton({ id, nome }: { id: string; nome: string }) {
  const { excluirLista } = useDemo();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const saving = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving.current) setOpen(value);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive"
        aria-label={`Excluir lista ${nome}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" /> Excluir
      </Button>
      <DialogContent className="rounded-2xl">
        <DialogTitle>Excluir esta lista?</DialogTitle>
        <DialogDescription>
          A lista “{nome}” e seus itens serão excluídos. O saldo dos cartões e as compras do
          Histórico serão preservados.
        </DialogDescription>
        <Button
          disabled={busy}
          variant="destructive"
          onClick={async () => {
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            try {
              await excluirLista(id);
              setOpen(false);
              toast.success("Lista excluída.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Não foi possível excluir a lista.",
              );
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? "Excluindo…" : "Sim, excluir lista"}
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
