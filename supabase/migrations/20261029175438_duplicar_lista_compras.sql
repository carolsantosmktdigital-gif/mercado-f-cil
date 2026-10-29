CREATE OR REPLACE FUNCTION public.duplicar_lista_compras(
 _id uuid, _familia uuid, _origem uuid, _historico boolean,
 _nome text, _cartao uuid, _orcamento numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_existing uuid; v_saldo numeric; v_source uuid; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 IF _id IS NULL OR _origem IS NULL OR _id=_origem OR _historico IS NULL THEN RAISE EXCEPTION 'Origem inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text,0));
 SELECT id INTO v_existing FROM public.listas_compras WHERE id=_id AND familia_id=_familia;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 IF _nome IS NULL OR length(btrim(_nome)) NOT BETWEEN 1 AND 100 OR _orcamento IS NULL OR _orcamento<=0 OR _orcamento::text IN ('NaN','Infinity','-Infinity') OR scale(_orcamento)>2 THEN RAISE EXCEPTION 'Nome ou orçamento inválido'; END IF;
 IF _historico THEN
  SELECT id INTO v_source FROM public.compras WHERE familia_id=_familia AND (id=_origem OR lista_id=_origem) ORDER BY created_at DESC LIMIT 1;
 ELSE
  SELECT id INTO v_source FROM public.listas_compras WHERE id=_origem AND familia_id=_familia AND status='em_andamento' FOR SHARE;
 END IF;
 IF v_source IS NULL THEN RAISE EXCEPTION 'Lista de origem não encontrada'; END IF;
 SELECT saldo INTO v_saldo FROM public.cartoes WHERE id=_cartao AND familia_id=_familia AND excluido_em IS NULL FOR UPDATE;
 IF v_saldo IS NULL OR _orcamento>v_saldo THEN RAISE EXCEPTION 'Saldo insuficiente ou cartão indisponível'; END IF;
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,valor_reservado,status,tipo)
 VALUES(_id,_familia,_cartao,btrim(_nome),_orcamento,0,'em_andamento','normal');
 IF _historico THEN
  INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado,inesperado)
  SELECT _familia,_id,nome,setor,qtd,0,false,false FROM public.compra_itens WHERE compra_id=v_source ORDER BY created_at,id;
 ELSE
  INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado,inesperado)
  SELECT _familia,_id,nome,setor,qtd,0,false,false FROM public.itens_lista WHERE lista_id=v_source AND familia_id=_familia ORDER BY created_at,id;
 END IF;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'Esta lista não tem produtos para duplicar'; END IF;
 RETURN _id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.duplicar_lista_compras(uuid,uuid,uuid,boolean,text,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.duplicar_lista_compras(uuid,uuid,uuid,boolean,text,uuid,numeric) TO authenticated;
