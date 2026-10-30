CREATE TABLE public.analises_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  compra_anterior_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  compra_atual_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  lista_anterior_nome text NOT NULL,
  lista_atual_nome text NOT NULL,
  data_anterior date NOT NULL,
  data_atual date NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(compra_anterior_id,compra_atual_id)
);
CREATE INDEX analises_compras_familia_data_idx ON public.analises_compras(familia_id,data_atual DESC);
CREATE INDEX IF NOT EXISTS compras_familia_data_analise_idx ON public.compras(familia_id,data);
CREATE INDEX IF NOT EXISTS compra_itens_compra_analise_idx ON public.compra_itens(compra_id);
ALTER TABLE public.analises_compras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analises_compras FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.analises_compras TO authenticated;
CREATE POLICY "familia consulta analises" ON public.analises_compras FOR SELECT TO authenticated
  USING (public.e_membro(familia_id));

CREATE OR REPLACE FUNCTION mercado_internal.nome_produto_analise(_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
 SELECT translate(lower(regexp_replace(btrim(_nome),'\s+',' ','g')),
   'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc');
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.nome_produto_analise(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION mercado_internal.registrar_analises(_familia uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_familia::text,73));
 -- Remove a comparison if an offline purchase's actual date moves to another month.
 DELETE FROM public.analises_compras a WHERE a.familia_id=_familia AND NOT EXISTS (
   SELECT 1 FROM public.compras p JOIN public.compras c ON c.id=a.compra_atual_id
   JOIN public.listas_compras lp ON lp.id=p.lista_id JOIN public.listas_compras lc ON lc.id=c.lista_id
   WHERE p.id=a.compra_anterior_id AND p.familia_id=_familia AND c.familia_id=_familia
     AND lp.status='finalizada' AND lc.status='finalizada'
     AND date_trunc('month',c.data::timestamp)=date_trunc('month',p.data::timestamp)+interval '1 month'
 );
 WITH finalizadas AS (
   SELECT c.id,c.data,c.lista_id,l.nome FROM public.compras c JOIN public.listas_compras l ON l.id=c.lista_id
   WHERE c.familia_id=_familia AND l.status='finalizada'
 ), produtos AS (
   SELECT i.compra_id,mercado_internal.nome_produto_analise(i.nome) chave,min(i.nome) nome,
     CASE WHEN sum(i.qtd)>0 THEN round(sum(i.preco_unitario*i.qtd)/sum(i.qtd),2) END preco
   FROM public.compra_itens i JOIN finalizadas f ON f.id=i.compra_id
   GROUP BY i.compra_id,mercado_internal.nome_produto_analise(i.nome)
 ), pares AS (
   SELECT p.id anterior,c.id atual,p.nome nome_anterior,c.nome nome_atual,p.data data_anterior,c.data data_atual
   FROM finalizadas p JOIN finalizadas c
     ON date_trunc('month',c.data::timestamp)=date_trunc('month',p.data::timestamp)+interval '1 month'
 ), conteudo AS (
   SELECT par.*,coalesce(detail.itens,'[]'::jsonb) itens
   FROM pares par CROSS JOIN LATERAL (
     SELECT jsonb_agg(jsonb_build_object(
       'nome',coalesce(c.nome,p.nome),
       'precoAnterior',p.preco,'precoAtual',c.preco,
       'diferenca',CASE WHEN p.preco>0 AND c.preco>0 THEN round(c.preco-p.preco,2) END,
       'percentual',CASE WHEN p.preco>0 AND c.preco>0 THEN round((c.preco-p.preco)/p.preco*100,2) END,
       'situacao',CASE WHEN p.chave IS NULL THEN 'novo' WHEN c.chave IS NULL THEN 'ausente'
         WHEN p.preco IS NULL OR c.preco IS NULL OR p.preco<=0 OR c.preco<=0 THEN 'sem_preco'
         WHEN c.preco>p.preco THEN 'alta' WHEN c.preco<p.preco THEN 'baixa' ELSE 'igual' END
     ) ORDER BY coalesce(c.nome,p.nome)) itens
     FROM (SELECT * FROM produtos WHERE compra_id=par.anterior) p
     FULL JOIN (SELECT * FROM produtos WHERE compra_id=par.atual) c ON c.chave=p.chave
   ) detail
 )
 INSERT INTO public.analises_compras(familia_id,compra_anterior_id,compra_atual_id,lista_anterior_nome,lista_atual_nome,data_anterior,data_atual,itens)
 SELECT _familia,anterior,atual,nome_anterior,nome_atual,data_anterior,data_atual,itens FROM conteudo
 ON CONFLICT(compra_anterior_id,compra_atual_id) DO UPDATE SET
   lista_anterior_nome=excluded.lista_anterior_nome,lista_atual_nome=excluded.lista_atual_nome,
   data_anterior=excluded.data_anterior,data_atual=excluded.data_atual,itens=excluded.itens,updated_at=now()
 WHERE (analises_compras.lista_anterior_nome,analises_compras.lista_atual_nome,analises_compras.data_anterior,analises_compras.data_atual,analises_compras.itens)
   IS DISTINCT FROM (excluded.lista_anterior_nome,excluded.lista_atual_nome,excluded.data_anterior,excluded.data_atual,excluded.itens);
END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.registrar_analises(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION mercado_internal.atualizar_analises_lista()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN PERFORM mercado_internal.registrar_analises(NEW.familia_id); RETURN NEW; END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.atualizar_analises_lista() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER registrar_analises_ao_finalizar AFTER UPDATE OF status ON public.listas_compras
 FOR EACH ROW WHEN (NEW.status='finalizada' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION mercado_internal.atualizar_analises_lista();
CREATE TRIGGER registrar_analises_data_offline AFTER UPDATE OF data ON public.compras
 FOR EACH ROW WHEN (OLD.data IS DISTINCT FROM NEW.data)
 EXECUTE FUNCTION mercado_internal.atualizar_analises_lista();
-- Include existing history; do not require users to finalize another purchase.
DO $backfill$ DECLARE f uuid; BEGIN
 FOR f IN SELECT DISTINCT familia_id FROM public.compras LOOP
   PERFORM mercado_internal.registrar_analises(f);
 END LOOP;
END $backfill$;

