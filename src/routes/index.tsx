import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBasket, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MercadoFácil — sua lista de compras" },
      { name: "description", content: "Monte sua lista de compras, marque o que já pegou e não esqueça nada no mercado." },
      { property: "og:title", content: "MercadoFácil — sua lista de compras" },
      { property: "og:description", content: "Monte sua lista de compras e não esqueça nada no mercado." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen px-6 py-10">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <span className="flex items-center gap-2 font-display text-xl font-extrabold text-primary">
          <ShoppingBasket className="h-6 w-6" /> MercadoFácil
        </span>
        <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto mt-20 max-w-3xl text-center">
        <h1 className="text-5xl font-extrabold leading-tight md:text-7xl">
          Compras sem <span className="text-accent">esquecer</span> nada.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Anote o que precisa, marque o que já está no carrinho e chegue em casa com tudo.
        </p>
        <Button asChild size="lg" className="mt-10 rounded-full px-8 shadow-soft">
          <Link to="/lista">Começar minha lista</Link>
        </Button>
      </section>
      <section className="mx-auto mt-20 grid max-w-3xl gap-4 md:grid-cols-3">
        {[
          { icon: ShoppingBasket, t: "Adicione itens", d: "Nome e quantidade em segundos." },
          { icon: Check, t: "Marque no mercado", d: "Risque o que já pegou." },
          { icon: Smartphone, t: "Em qualquer lugar", d: "Sua lista salva na sua conta." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl bg-card p-6 shadow-soft">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-bold">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
