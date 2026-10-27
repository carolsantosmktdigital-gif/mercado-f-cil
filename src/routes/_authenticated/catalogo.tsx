import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Page } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { brl, SETORES, useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Mercado Fácil" },
      { name: "description", content: "Pesquise produtos organizados por setor." },
      { property: "og:title", content: "Catálogo — Mercado Fácil" },
      { property: "og:description", content: "Seus produtos organizados por setor do mercado." },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const { catalogo } = useDemo();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("Todos");
  const lista = catalogo.filter(
    (p) => p.nome.toLowerCase().includes(busca.toLowerCase()) && (filtro === "Todos" || p.setor === filtro),
  );
  const grupos = SETORES.map((s) => ({ setor: s, itens: lista.filter((p) => p.setor === s) })).filter((g) => g.itens.length);

  return (
    <Page title="Catálogo" subtitle={`${catalogo.length} produtos`}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-14 rounded-2xl pl-12 text-base" placeholder="Pesquisar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-2">
        {["Todos", ...SETORES].map((s) => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${filtro === s ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            {s}
          </button>
        ))}
      </div>
      {grupos.length === 0 && <p className="mt-10 text-center text-muted-foreground">Nenhum produto encontrado.</p>}
      {grupos.map((g) => (
        <section key={g.setor} className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.setor}</h2>
          <ul className="divide-y overflow-hidden rounded-3xl bg-card shadow-soft">
            {g.itens.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-4">
                <span className="font-medium">{p.nome}</span>
                <span className="text-muted-foreground">{brl(p.precoRef)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}
