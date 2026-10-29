import { ManualListForm } from "@/components/ManualListForm";
import { DeleteListButton } from "@/components/DeleteListButton";
import { InstallApp } from "@/components/InstallApp";
import { DuplicateListButton } from "@/components/DuplicateListButton";
import { ShoppingListBuilder } from "@/components/ShoppingListBuilder";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ListChecks, Plus, ShoppingCart } from "lucide-react";
import { Page } from "@/components/AppShell";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BudgetCard } from "@/components/BudgetCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Mercado Fácil" },
      { name: "description", content: "Resumo dos seus cartões, saldos e da compra em andamento." },
      { property: "og:title", content: "Mercado Fácil" },
      {
        property: "og:description",
        content: "Organize compras de supermercado com cartões de alimentação.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { cartoes, itens, familia, listas, listaId, selecionarLista } = useDemo();
  const [abrirNovaLista, setAbrirNovaLista] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#nova-lista") setAbrirNovaLista(true);
  }, []);
  const [saindo, setSaindo] = useState(false);
  const saindoRef = useRef(false);
  async function sair() {
    if (saindoRef.current) return;
    saindoRef.current = true;
    setSaindo(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      toast.error("Não foi possível sair da família. Tente novamente.");
      saindoRef.current = false;
      setSaindo(false);
    }
  }
  const total = cartoes.reduce((s, c) => s + c.saldo, 0);
  const pendentes = itens.filter((i) => !i.comprado).length;
  return (
    <Page title="Mercado Fácil" subtitle="Olá! Boas compras 🛒">
      <InstallApp />
      <section className="mb-4 mt-5 flex items-center justify-between rounded-3xl bg-accent p-4 text-accent-foreground">
        <div>
          <p className="font-bold">{familia.nome}</p>
          <p className="text-sm opacity-80">
            Código para convidar: <span className="font-mono font-bold">{familia.codigo}</span>
          </p>
        </div>
        <Button variant="ghost" disabled={saindo} onClick={sair}>
          {saindo ? "Saindo…" : "Sair"}
        </Button>
      </section>
      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Saldo total nos cartões</p>
          <Link to="/cartoes" className="text-sm font-semibold text-primary">
            {cartoes.length ? "Editar cartões" : "Cadastrar"}
          </Link>
        </div>
        <p className="mt-1 font-display text-3xl font-extrabold">{brl(total)}</p>
        {(cartoes.length === 0 || total <= 0) && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {cartoes.length
                ? "Atualize o saldo do cartão e defina o orçamento para sua compra."
                : "Cadastre um cartão, informe o saldo disponível e defina o orçamento da compra."}
            </p>
            <Button asChild className="w-full">
              <Link to="/cartoes">
                {cartoes.length ? "Editar saldo e orçamento" : "Cadastrar cartão e orçamento"}
              </Link>
            </Button>
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {cartoes.map((c) => (
            <li key={c.id} className="flex justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="font-medium">{c.nome}</span>
              <span className="font-semibold text-primary">{brl(c.saldo)}</span>
            </li>
          ))}
        </ul>
      </section>

      {(!listas.length || itens.length === 0) && <ShoppingListBuilder />}

      {(listas.length > 0 || abrirNovaLista) && (
        <section id="nova-lista" className="mt-5 scroll-mt-4 rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              {listas.length > 0 ? (
                <>
                  <ShoppingCart className="h-5 w-5" /> Compras em andamento
                </>
              ) : (
                "Cadastrar lista"
              )}
            </h2>
            {listas.length > 0 ? (
              <Button size="sm" onClick={() => setAbrirNovaLista((v) => !v)}>
                <Plus className="h-4 w-4" /> Nova lista
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAbrirNovaLista(false)}>
                Cancelar
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {listas.map((l) => (
              <div
                key={l.id}
                className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border p-1"
              >
                <button
                  type="button"
                  onClick={() => selecionarLista(l.id)}
                  className={
                    "rounded-xl border px-3 py-2 text-sm " +
                    (listaId === l.id ? "bg-primary text-primary-foreground" : "bg-muted")
                  }
                >
                  {l.nome}
                </button>
                <DuplicateListButton
                  origem={l.id}
                  nome={l.nome}
                  cartaoId={l.cartao_id}
                  orcamento={l.orcamento}
                />
                <DeleteListButton id={l.id} nome={l.nome} />
              </div>
            ))}
          </div>
          {abrirNovaLista && (
            <div className="mt-4">
              <ManualListForm onCreated={() => setAbrirNovaLista(false)} />
            </div>
          )}
          {listaId && (
            <div className="mt-4">
              <BudgetCard />
              <Button asChild className="mt-4 w-full">
                <Link to="/lista">
                  Continuar compra <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          )}
        </section>
      )}

      <h2 className="mb-3 mt-8 text-xl font-bold">Acesso rápido</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/lista" className="rounded-3xl bg-card p-5 shadow-soft">
          <ListChecks className="h-7 w-7 text-primary" />
          <p className="mt-3 font-bold">Lista de compras</p>
          <p className="text-sm text-muted-foreground">
            {listas.length ? `${pendentes} itens a pegar` : "Crie sua primeira lista"}
          </p>
        </Link>
        <Link
          to={listaId ? "/adicionar" : "/"}
          hash={listaId ? "" : "nova-lista"}
          onClick={() => {
            if (!listaId) setAbrirNovaLista(true);
          }}
          className="rounded-3xl bg-accent p-5 text-accent-foreground"
        >
          <Plus className="h-7 w-7" />
          <p className="mt-3 font-bold">{listaId ? "Adicionar produto" : "Cadastrar lista"}</p>
          <p className="text-sm opacity-80">
            {listaId ? "Na lista e no catálogo" : "Comece sua compra"}
          </p>
        </Link>
      </div>
    </Page>
  );
}
