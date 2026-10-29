-- Invoker privileges preserve the existing family RLS policies on every write.
CREATE OR REPLACE FUNCTION public.criar_lista_personalizada(
 _id uuid, _familia uuid, _cartao uuid, _nome text, _orcamento numeric, _itens jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_saldo numeric; v_existing uuid; v_expected jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 -- A stable client UUID makes retries after a lost response safe.
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT id INTO v_existing FROM public.listas_compras WHERE id=_id AND familia_id=_familia;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 IF _nome IS NULL OR length(btrim(_nome)) NOT BETWEEN 1 AND 100 OR _orcamento IS NULL OR _orcamento<=0 OR _orcamento::text IN ('NaN','Infinity','-Infinity') OR scale(_orcamento)>2 THEN RAISE EXCEPTION 'Nome ou orçamento inválido'; END IF;
 SELECT saldo INTO v_saldo FROM public.cartoes WHERE id=_cartao AND familia_id=_familia AND excluido_em IS NULL FOR UPDATE;
 IF v_saldo IS NULL OR _orcamento>v_saldo THEN RAISE EXCEPTION 'Saldo insuficiente ou cartão indisponível'; END IF;
 IF _itens IS NULL OR jsonb_typeof(_itens)<>'array' THEN RAISE EXCEPTION 'Itens inválidos'; END IF;
 IF jsonb_array_length(_itens) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Informe de 1 a 1000 produtos'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_itens) i WHERE
  COALESCE(length(btrim(i->>'nome')),0) NOT BETWEEN 1 AND 200 OR
  (i ? 'nomeCompleto' AND COALESCE(length(btrim(i->>'nomeCompleto')),0) NOT BETWEEN 1 AND 200) OR
  COALESCE(length(btrim(i->>'setor')),0) NOT BETWEEN 1 AND 60 OR
  COALESCE(length(btrim(i->>'unidade')),0) NOT BETWEEN 1 AND 60 OR
  COALESCE((i->>'qtd')::numeric,0)<=0 OR (i->>'qtd')::numeric>999999 OR
  (i->>'qtd')::numeric::text IN ('NaN','Infinity','-Infinity') OR scale((i->>'qtd')::numeric)>3
 ) THEN RAISE EXCEPTION 'Confira os produtos e quantidades'; END IF;
 -- Canonical content makes retrying the same form safe even after reopening the page.
 SELECT jsonb_agg(jsonb_build_object('nome',COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),'setor',btrim(i->>'setor'),'qtd',(i->>'qtd')::numeric) ORDER BY COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),btrim(i->>'setor'),(i->>'qtd')::numeric) INTO v_expected FROM jsonb_array_elements(_itens) i;
 PERFORM pg_advisory_xact_lock(hashtextextended(_familia::text||_cartao::text||btrim(_nome)||_orcamento::text||v_expected::text,0));
 SELECT l.id INTO v_existing FROM public.listas_compras l
 WHERE l.familia_id=_familia AND l.cartao_id=_cartao AND l.nome=btrim(_nome) AND l.orcamento=_orcamento AND l.status='em_andamento'
 AND (SELECT jsonb_agg(jsonb_build_object('nome',i.nome,'setor',i.setor,'qtd',i.qtd) ORDER BY i.nome,i.setor,i.qtd) FROM public.itens_lista i WHERE i.lista_id=l.id AND i.familia_id=_familia)=v_expected
 ORDER BY l.created_at LIMIT 1;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,valor_reservado,status,tipo)
 VALUES(_id,_familia,_cartao,btrim(_nome),_orcamento,0,'em_andamento','normal');
 INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado)
 SELECT _familia,_id,COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),btrim(i->>'setor'),(i->>'qtd')::numeric,0,false FROM jsonb_array_elements(_itens) i;
 RETURN _id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.criar_lista_personalizada(uuid,uuid,uuid,text,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_lista_personalizada(uuid,uuid,uuid,text,numeric,jsonb) TO authenticated;

