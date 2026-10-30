CREATE TABLE mercado_internal.criacao_listas(
 operacao_id uuid PRIMARY KEY, familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
 lista_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mercado_internal.criacao_listas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mercado_internal.criacao_listas FROM PUBLIC,anon,authenticated;
-- Every write explicitly validates family membership; private receipts protect retries.
CREATE OR REPLACE FUNCTION public.criar_lista_personalizada(
 _id uuid, _familia uuid, _cartao uuid, _nome text, _orcamento numeric, _itens jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_saldo numeric; v_existing uuid; v_expected jsonb; v_target uuid; v_receipt record;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 SELECT * INTO v_receipt FROM mercado_internal.criacao_listas WHERE operacao_id=_id;
 IF FOUND THEN
  IF v_receipt.familia_id<>_familia THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.listas_compras WHERE id=v_receipt.lista_id AND familia_id=_familia) THEN RAISE EXCEPTION 'A lista desta operação foi excluída. Inicie um novo cadastro.'; END IF;
  RETURN v_receipt.lista_id;
 END IF;
 -- A stable client UUID makes retries after a lost response safe.
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO v_receipt FROM mercado_internal.criacao_listas WHERE operacao_id=_id;
 IF FOUND THEN
  IF v_receipt.familia_id<>_familia THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.listas_compras WHERE id=v_receipt.lista_id AND familia_id=_familia) THEN RAISE EXCEPTION 'Lista desta operação excluída'; END IF;
  RETURN v_receipt.lista_id;
 END IF;
 SELECT id INTO v_existing FROM public.listas_compras WHERE id=_id AND familia_id=_familia;
 IF v_existing IS NOT NULL THEN INSERT INTO mercado_internal.criacao_listas(operacao_id,familia_id,lista_id) VALUES(_id,_familia,v_existing) ON CONFLICT DO NOTHING; RETURN v_existing; END IF;
 IF _nome IS NULL OR length(btrim(_nome)) NOT BETWEEN 1 AND 100 OR _orcamento IS NULL OR _orcamento<=0 OR _orcamento::text IN ('NaN','Infinity','-Infinity') OR scale(_orcamento)>2 THEN RAISE EXCEPTION 'Nome ou orçamento inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_familia::text||_cartao::text,91));
 SELECT saldo INTO v_saldo FROM public.cartoes WHERE id=_cartao AND familia_id=_familia AND excluido_em IS NULL;
 IF v_saldo IS NULL OR _orcamento>v_saldo THEN RAISE EXCEPTION 'Saldo insuficiente ou cartão indisponível'; END IF;
 IF _itens IS NULL OR jsonb_typeof(_itens)<>'array' THEN RAISE EXCEPTION 'Itens inválidos'; END IF;
 IF jsonb_array_length(_itens) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Informe de 1 a 1000 produtos'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_itens) i WHERE
  COALESCE(length(btrim(i->>'nome')),0) NOT BETWEEN 1 AND 200 OR
  (i ? 'nomeCompleto' AND COALESCE(length(btrim(i->>'nomeCompleto')),0) NOT BETWEEN 1 AND 200) OR
  COALESCE(length(mercado_internal.categoria_canonica(btrim(i->>'setor'))),0) NOT BETWEEN 1 AND 60 OR
  COALESCE(length(btrim(i->>'unidade')),0) NOT BETWEEN 1 AND 60 OR
  COALESCE((i->>'qtd')::numeric,0)<=0 OR (i->>'qtd')::numeric>999999 OR
  (i->>'qtd')::numeric::text IN ('NaN','Infinity','-Infinity') OR scale((i->>'qtd')::numeric)>3
 ) THEN RAISE EXCEPTION 'Confira os produtos e quantidades'; END IF;
 -- Canonical content makes retrying the same form safe even after reopening the page.
 SELECT jsonb_agg(jsonb_build_object('nome',COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),'setor',mercado_internal.categoria_canonica(btrim(i->>'setor')),'qtd',(i->>'qtd')::numeric) ORDER BY COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),mercado_internal.categoria_canonica(btrim(i->>'setor')),(i->>'qtd')::numeric) INTO v_expected FROM jsonb_array_elements(_itens) i;
 PERFORM pg_advisory_xact_lock(hashtextextended(_familia::text||_cartao::text||btrim(_nome)||_orcamento::text||v_expected::text,0));
 SELECT l.id INTO v_existing FROM public.listas_compras l
 WHERE l.familia_id=_familia AND l.cartao_id=_cartao AND l.nome=btrim(_nome) AND l.orcamento=_orcamento AND l.status='em_andamento'
 AND (SELECT jsonb_agg(jsonb_build_object('nome',i.nome,'setor',i.setor,'qtd',i.qtd) ORDER BY i.nome,i.setor,i.qtd) FROM public.itens_lista i WHERE i.lista_id=l.id AND i.familia_id=_familia)=v_expected
 ORDER BY l.created_at LIMIT 1;
 IF v_existing IS NOT NULL THEN INSERT INTO mercado_internal.criacao_listas(operacao_id,familia_id,lista_id) VALUES(_id,_familia,v_existing) ON CONFLICT DO NOTHING; RETURN v_existing; END IF;
 -- Fill an already registered empty list instead of creating a second one.
 SELECT l.id INTO v_target FROM public.listas_compras l
 WHERE l.familia_id=_familia AND l.cartao_id=_cartao AND lower(btrim(l.nome))=lower(btrim(_nome)) AND l.orcamento=_orcamento AND l.valor_reservado=0 AND l.status='em_andamento' AND l.tipo='normal'
 AND NOT EXISTS(SELECT 1 FROM public.itens_lista i WHERE i.lista_id=l.id)
 AND NOT EXISTS(SELECT 1 FROM public.compras c WHERE c.lista_id=l.id)
 ORDER BY l.created_at LIMIT 1 FOR UPDATE OF l;
 IF v_target IS NULL THEN
  v_target:=_id;
  INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,valor_reservado,status,tipo)
  VALUES(v_target,_familia,_cartao,btrim(_nome),_orcamento,0,'em_andamento','normal');
 ELSIF EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=v_target) THEN
  RAISE EXCEPTION 'Esta lista recebeu itens em outro celular. Confira antes de gerar novamente.';
 END IF;
 INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado)
 SELECT _familia,v_target,COALESCE(NULLIF(btrim(i->>'nomeCompleto'),''),btrim(i->>'nome')||' ('||btrim(i->>'unidade')||')'),mercado_internal.categoria_canonica(btrim(i->>'setor')),(i->>'qtd')::numeric,0,false FROM jsonb_array_elements(_itens) i;
 INSERT INTO mercado_internal.criacao_listas(operacao_id,familia_id,lista_id) VALUES(_id,_familia,v_target);
 RETURN v_target;
END;
$fn$;
REVOKE ALL ON FUNCTION public.criar_lista_personalizada(uuid,uuid,uuid,text,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_lista_personalizada(uuid,uuid,uuid,text,numeric,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.criar_lista_vazia(_id uuid,_familia uuid,_cartao uuid,_nome text,_orcamento numeric,_reserva numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE existing mercado_internal.criacao_listas%ROWTYPE; target uuid; balance numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 IF _id IS NULL OR _nome IS NULL OR length(btrim(_nome)) NOT BETWEEN 1 AND 100 OR _orcamento IS NULL OR _reserva IS NULL OR _orcamento<=0 OR _reserva<0 OR _orcamento::text IN ('NaN','Infinity','-Infinity') OR _reserva::text IN ('NaN','Infinity','-Infinity') OR scale(_orcamento)>2 OR scale(_reserva)>2 THEN RAISE EXCEPTION 'Confira nome, orçamento e reserva'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT * INTO existing FROM mercado_internal.criacao_listas WHERE operacao_id=_id;
 IF FOUND THEN
  IF existing.familia_id<>_familia THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.listas_compras WHERE id=existing.lista_id AND familia_id=_familia) THEN RAISE EXCEPTION 'A lista foi excluída. Inicie um novo cadastro.'; END IF;
  RETURN existing.lista_id;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_familia::text||_cartao::text,91));
 SELECT saldo INTO balance FROM public.cartoes WHERE id=_cartao AND familia_id=_familia AND excluido_em IS NULL;
 IF balance IS NULL OR _orcamento+_reserva>balance THEN RAISE EXCEPTION 'Saldo insuficiente ou cartão indisponível'; END IF;
 SELECT id INTO target FROM public.listas_compras WHERE familia_id=_familia AND cartao_id=_cartao AND lower(btrim(nome))=lower(btrim(_nome)) AND orcamento=_orcamento AND valor_reservado=_reserva AND status='em_andamento' AND tipo='normal' ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF target IS NULL THEN
  target:=_id;
  INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,valor_reservado,status,tipo) VALUES(target,_familia,_cartao,btrim(_nome),_orcamento,_reserva,'em_andamento','normal');
 END IF;
 INSERT INTO mercado_internal.criacao_listas(operacao_id,familia_id,lista_id) VALUES(_id,_familia,target);
 RETURN target;
END;
$fn$;
REVOKE ALL ON FUNCTION public.criar_lista_vazia(uuid,uuid,uuid,text,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_lista_vazia(uuid,uuid,uuid,text,numeric,numeric) TO authenticated;
