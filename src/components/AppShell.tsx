import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useDemo } from "@/lib/demo-store";
import type { ReactNode } from "react";
import { Home, CreditCard, ListChecks, History, ChartNoAxesCombined } from "lucide-react";

const tabs = [
  { to: "/", label: "Início", icon: Home },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/lista", label: "Lista", icon: ListChecks },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/analise", label: "Análise", icon: ChartNoAxesCombined },
] as const;

export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-28">
      <header className="flex items-end justify-between px-5 pb-4 pt-8">
        <div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <h1 className="text-3xl font-extrabold">{title}</h1>
        </div>
        {action}
      </header>
      <div className="px-5">
        <SyncStatus />
        {children}
      </div>
    </div>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground data-[status=active]:text-primary"
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DemoBadge({
  texto = "Demonstração com dados fictícios — nada é salvo.",
}: {
  texto?: string;
}) {
  return (
    <p className="mb-4 rounded-xl bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
      {texto}
    </p>
  );
}

function SyncStatus() {
  const {
    online,
    pendingCount,
    syncError,
    conflitos = [],
    resolverConflito,
    compartilhamento,
  } = useDemo();
  return (
    <div className="mb-4 space-y-2">
      {online && compartilhamento && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-950">
          {compartilhamento.connected
            ? "Lista conectada · atualizações automáticas"
            : "Reconectando · conferindo alterações a cada 3 segundos"}
          {compartilhamento.peers > 0 &&
            ` · ${compartilhamento.peers} outro(s) celular(es) nesta lista`}
          {compartilhamento.peerPending > 0 && " · aguardando alterações do outro celular"}
        </p>
      )}
      {(!online || pendingCount > 0 || syncError) && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          {syncError ||
            (!online
              ? "Sem internet. Alterações e saldos ficam salvos neste celular. O outro celular só verá suas mudanças após sincronizar."
              : "Sincronizando alterações…")}{" "}
          {pendingCount > 0 && `${pendingCount} operação(ões) aguardando sincronização.`}
        </p>
      )}
      {conflitos.map((op) => (
        <div
          key={op.id}
          role="alert"
          className="space-y-2 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950"
        >
          <p className="font-bold">
            {op.kind === "finalize"
              ? "Confira a finalização"
              : `Alteração em conflito: ${String(op.conflict?.atual?.["nome"] || op.values["nome"] || "produto")}`}
          </p>
          <p>{op.conflict?.motivo}</p>
          {op.kind !== "finalize" && (
            <>
              <p className="break-words">
                Neste celular: {op.kind === "delete" ? "Excluir produto" : formatChange(op.values)}
              </p>
              {op.conflict?.atual && (
                <p className="break-words">
                  Na nuvem:{" "}
                  {formatChange(
                    Object.fromEntries(
                      Object.keys(op.values).map((k) => [k, op.conflict!.atual![k]]),
                    ),
                  )}
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {!op.conflict?.bloqueado && (
              <Button
                disabled={!online}
                size="sm"
                onClick={() =>
                  void resolverConflito(op.id, true).catch((e) => toast.error(e.message))
                }
              >
                Usar minha alteração
              </Button>
            )}
            <Button
              disabled={!online}
              size="sm"
              variant="outline"
              onClick={() =>
                void resolverConflito(op.id, false).catch((e) => toast.error(e.message))
              }
            >
              {op.kind === "finalize" ? "Reabrir e conferir" : "Manter informação da nuvem"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
function formatChange(values: Record<string, unknown>) {
  const labels: Record<string, string> = {
    nome: "Nome",
    setor: "Categoria",
    qtd: "Quantidade",
    preco: "Preço",
    comprado: "No carrinho",
    inesperado: "Extra",
  };
  return Object.entries(values)
    .filter(([k]) => labels[k])
    .map(
      ([k, v]) =>
        `${labels[k]}: ${k === "preco" ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v ?? "—")}`,
    )
    .join(" · ");
}
