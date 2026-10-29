-- Only the immediately previous calendar month, within five days of its monthly anniversary.
CREATE OR REPLACE FUNCTION mercado_internal.compras_comparaveis(_anterior date,_atual date)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT date_trunc('month',_atual::timestamp)=date_trunc('month',_anterior::timestamp)+interval '1 month'
 AND _atual BETWEEN (_anterior+interval '1 month')::date-5 AND (_anterior+interval '1 month')::date+5;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.compras_comparaveis(date,date) FROM PUBLIC,anon,authenticated;
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
     AND mercado_internal.compras_comparaveis(p.data,c.data)
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
     ON mercado_internal.compras_comparaveis(p.data,c.data)
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

-- Refresh derived snapshots using the actual purchase dates already recorded in history.
DO $backfill$ DECLARE f uuid; BEGIN
 FOR f IN SELECT DISTINCT familia_id FROM public.compras LOOP
  PERFORM mercado_internal.registrar_analises(f);
 END LOOP;
END $backfill$;
