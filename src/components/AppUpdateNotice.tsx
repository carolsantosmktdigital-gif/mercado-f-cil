import { APP_VERSION } from "@/lib/app-version";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let active = true;
    const check = async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch("/app-version.json", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && typeof data.version === "string" && data.version !== APP_VERSION)
          setAvailable(true);
      } catch {}
    };
    void check();
    const timer = setInterval(() => void check(), 60000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, []);
  if (!available) return null;
  return (
    <aside
      role="status"
      className="mx-auto max-w-md border-b bg-amber-50 p-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Uma nova versão do Mercado Fácil está disponível.</p>
      <p className="mt-1">
        Salve o que está preenchendo antes de atualizar. Suas compras salvas neste celular serão
        mantidas.
      </p>
      <Button
        className="mt-2"
        size="sm"
        onClick={async () => {
          if ("serviceWorker" in navigator) {
            try {
              const registration = await navigator.serviceWorker.getRegistration();
              await registration?.update();
            } catch {}
          }
          window.location.reload();
        }}
      >
        Atualizar app
      </Button>
    </aside>
  );
}
