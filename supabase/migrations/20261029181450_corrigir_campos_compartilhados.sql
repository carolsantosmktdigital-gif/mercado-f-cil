CREATE OR REPLACE FUNCTION public.escrever_item_compartilhado(
 _operacao uuid,_familia uuid,_lista uuid,_item uuid,_tipo text,_valores jsonb,_base jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE l public.listas_compras%ROWTYPE; i public.itens_lista%ROWTYPE; previous mercado_internal.escritas_itens%ROWTYPE; proposed public.itens_lista%ROWTYPE; actual jsonb; result jsonb; k text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 IF _operacao IS NULL OR _item IS NULL OR (_tipo IS NULL OR _tipo NOT IN ('insert','update','delete')) THEN RAISE EXCEPTION 'Operação inválida'; END IF;
 SELECT * INTO l FROM public.listas_compras WHERE id=_lista AND familia_id=_familia FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('conflito',true,'bloqueado',true,'motivo','A lista não está mais disponível.'); END IF;
 SELECT * INTO previous FROM mercado_internal.escritas_itens WHERE operacao_id=_operacao;
 IF FOUND THEN
  IF previous.familia_id<>_familia OR previous.lista_id<>_lista OR previous.item_id<>_item THEN RAISE EXCEPTION 'Operação já utilizada'; END IF;
  RETURN previous.resultado;
 END IF;
 SELECT * INTO i FROM public.itens_lista WHERE id=_item AND lista_id=_lista AND familia_id=_familia FOR UPDATE;
 actual:=CASE WHEN FOUND THEN to_jsonb(i) ELSE NULL END;
 IF l.status<>'em_andamento' THEN RETURN jsonb_build_object('conflito',true,'bloqueado',true,'atual',actual,'motivo','A compra já foi finalizada em outro celular.'); END IF;
 IF _tipo='insert' AND actual IS NOT NULL THEN
  RETURN jsonb_build_object('conflito',true,'bloqueado',true,'atual',actual,'motivo','Este produto já existe. Atualize a lista.');
 ELSIF _tipo IN ('update','delete') THEN
  IF actual IS NULL AND _tipo='delete' THEN
   result:=jsonb_build_object('ok',true);
   INSERT INTO mercado_internal.escritas_itens VALUES(_operacao,_familia,_lista,_item,result,now()); RETURN result;
  END IF;
  IF actual IS NULL THEN RETURN jsonb_build_object('conflito',true,'bloqueado',true,'motivo','O produto foi excluído em outro celular.'); END IF;
  IF _base IS NULL OR jsonb_typeof(_base)<>'object' OR _base='{}'::jsonb THEN RETURN jsonb_build_object('conflito',true,'atual',actual,'motivo','Confira esta alteração salva em uma versão anterior do app.'); END IF;
  FOR k IN SELECT jsonb_object_keys(CASE WHEN _tipo='delete' THEN _base ELSE _valores END) LOOP
   IF k NOT IN ('nome','setor','qtd','preco','comprado','inesperado') OR NOT (_base ? k) THEN RAISE EXCEPTION 'Campo inválido'; END IF;
   IF actual->k IS DISTINCT FROM _base->k AND (_tipo='delete' OR actual->k IS DISTINCT FROM _valores->k) THEN
    RETURN jsonb_build_object('conflito',true,'atual',actual,'motivo','Este produto foi alterado em outro celular. Escolha qual informação manter.');
   END IF;
  END LOOP;
 END IF;
 IF _tipo='delete' THEN DELETE FROM public.itens_lista WHERE id=_item;
 ELSE
  IF _valores IS NULL OR jsonb_typeof(_valores)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(_valores) AS fields(key_name) WHERE fields.key_name NOT IN ('nome','setor','qtd','preco','comprado','inesperado')) THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
  IF _tipo='insert' THEN i.nome:='';i.setor:='Outros';i.qtd:=1;i.preco:=0;i.comprado:=false;i.inesperado:=false; END IF;
  proposed:=jsonb_populate_record(i,_valores);
  IF proposed.nome IS NULL OR length(btrim(proposed.nome)) NOT BETWEEN 1 AND 200 OR proposed.setor IS NULL OR length(btrim(proposed.setor)) NOT BETWEEN 1 AND 60 OR proposed.qtd IS NULL OR proposed.qtd<=0 OR proposed.qtd>999999 OR proposed.preco IS NULL OR proposed.preco<0 OR proposed.preco>999999 OR proposed.qtd::text='NaN' OR proposed.preco::text='NaN' OR proposed.comprado IS NULL OR (proposed.comprado AND proposed.preco<=0) THEN RAISE EXCEPTION 'Confira os dados do produto'; END IF;
  IF _tipo='insert' THEN INSERT INTO public.itens_lista(id,familia_id,lista_id,nome,setor,qtd,preco,comprado,inesperado) VALUES(_item,_familia,_lista,proposed.nome,proposed.setor,proposed.qtd,proposed.preco,proposed.comprado,COALESCE(proposed.inesperado,false));
  ELSE UPDATE public.itens_lista SET nome=proposed.nome,setor=proposed.setor,qtd=proposed.qtd,preco=proposed.preco,comprado=proposed.comprado,inesperado=proposed.inesperado WHERE id=_item; END IF;
 END IF;
 result:=jsonb_build_object('ok',true);
 INSERT INTO mercado_internal.escritas_itens VALUES(_operacao,_familia,_lista,_item,result,now());
 RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.escrever_item_compartilhado(uuid,uuid,uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.escrever_item_compartilhado(uuid,uuid,uuid,uuid,text,jsonb,jsonb) TO authenticated;
