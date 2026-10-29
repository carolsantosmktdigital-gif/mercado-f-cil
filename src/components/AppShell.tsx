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
  const { online, pendingCount, syncError } = useDemo();
  if (online && !pendingCount && !syncError) return null;
  return (
    <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      {syncError ||
        (!online
          ? "Sem internet. Alterações e saldos ficam salvos neste celular."
          : "Sincronizando alterações…")}{" "}
      {pendingCount > 0 ? `${pendingCount} operação(ões) aguardando sincronização.` : ""}
    </p>
  );
}
