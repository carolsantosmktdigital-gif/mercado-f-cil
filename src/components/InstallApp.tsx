import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [installed, setInstalled] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setInstalled(
        media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    check();
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", check);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener("change", check);
    };
  }, []);
  return (
    <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-bold">Mercado Fácil no seu celular</h2>
      {!installed && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Adicione o app à tela inicial para abrir pelo ícone.
          </p>
          {prompt ? (
            <Button
              className="mt-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await prompt.prompt();
                  const choice = await prompt.userChoice;
                  setPrompt(null);
                  if (choice.outcome === "accepted")
                    toast.success("Confirme a instalação no celular.");
                } catch {
                  toast.error("Use o menu do navegador para adicionar à tela inicial.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download className="h-4 w-4" /> Instalar app
            </Button>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <strong>Android (Chrome):</strong> abra o menu ⋮ e escolha “Adicionar à tela
                inicial” ou “Instalar app”.
              </p>
              <p>
                <strong>iPhone (Safari):</strong> toque em Compartilhar e depois em “Adicionar à
                Tela de Início”. Se aparecer, ative “Abrir como App da Web”.
              </p>
            </div>
          )}
        </>
      )}
      <Button
        variant="outline"
        className="mt-3"
        onClick={async () => {
          const url = window.location.origin + "/";
          try {
            if (navigator.share) {
              await navigator.share({
                title: "Mercado Fácil",
                text: "Organize suas compras com o Mercado Fácil.",
                url,
              });
            } else {
              await navigator.clipboard.writeText(url);
              toast.success("Link copiado para compartilhar.");
            }
          } catch (error) {
            if ((error as DOMException).name !== "AbortError")
              toast.error("Não foi possível compartilhar. Copie o endereço do navegador.");
          }
        }}
      >
        <Share2 className="h-4 w-4" /> Compartilhar app
      </Button>
    </section>
  );
}
