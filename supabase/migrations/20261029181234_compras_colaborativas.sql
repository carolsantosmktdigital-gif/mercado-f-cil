-- Every accepted item operation has an idempotency receipt. Conflicting writes remain on the device.
CREATE TABLE mercado_internal.escritas_itens(
 operacao_id uuid PRIMARY KEY, familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
 lista_id uuid NOT NULL, item_id uuid NOT NULL, resultado jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mercado_internal.escritas_itens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mercado_internal.escritas_itens FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.escrever_item_compartilhado(
 _operacao uuid,_familia uuid,_lista uuid,_item uuid,_tipo text,_valores jsonb,_base jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE l public.listas_compras%ROWTYPE; i public.itens_lista%ROWTYPE; previous mercado_internal.escritas_itens%ROWTYPE; proposed public.itens_lista%ROWTYPE; actual jsonb; result jsonb; k text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.e_membro(_familia) THEN RAISE EXCEPTION 'Família não autorizada'; END IF;
 IF _operacao IS NULL OR _item IS NULL OR _tipo NOT IN ('insert','update','delete') THEN RAISE EXCEPTION 'Operação inválida'; END IF;
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
  IF _valores IS NULL OR jsonb_typeof(_valores)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(_valores) k WHERE k NOT IN ('nome','setor','qtd','preco','comprado','inesperado')) THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
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
-- Compare the entire displayed basket under the same list lock used by item writers.
CREATE OR REPLACE FUNCTION public.finalizar_compra_compartilhada(
 _lista uuid,_operacao uuid,_pendencias uuid,_data date,_itens jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE l public.listas_compras%ROWTYPE; actual jsonb; expected jsonb; receipt uuid; total numeric; quantidade integer;
BEGIN
 SELECT * INTO l FROM public.listas_compras WHERE id=_lista FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.e_membro(l.familia_id) THEN RAISE EXCEPTION 'Lista não autorizada'; END IF;
 SELECT compra_id INTO receipt FROM mercado_internal.compras_offline WHERE operacao_id=_operacao AND lista_id=_lista AND familia_id=l.familia_id;
 IF receipt IS NOT NULL THEN RETURN receipt; END IF;
 IF l.status<>'em_andamento' THEN RAISE EXCEPTION 'Esta compra já foi finalizada em outro celular. Atualize a lista.'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor',setor,'qtd',qtd,'preco',preco,'comprado',comprado) ORDER BY id),'[]'::jsonb),COALESCE(sum(round(qtd*preco,2)) FILTER(WHERE comprado),0),count(*) FILTER(WHERE comprado)
 INTO actual,total,quantidade FROM public.itens_lista WHERE lista_id=_lista;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor',setor,'qtd',qtd,'preco',preco,'comprado',comprado) ORDER BY id),'[]'::jsonb) INTO expected FROM jsonb_to_recordset(_itens) x(id uuid,nome text,setor text,qtd numeric,preco numeric,comprado boolean);
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'A lista mudou em outro celular. Confira o total atualizado antes de finalizar novamente.'; END IF;
 RETURN public.finalizar_compra_offline(_lista,_operacao,_pendencias,total,quantidade,_data);
END;
$fn$;
REVOKE ALL ON FUNCTION public.finalizar_compra_compartilhada(uuid,uuid,uuid,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalizar_compra_compartilhada(uuid,uuid,uuid,date,jsonb) TO authenticated;
-- Postgres changes obey the tables' existing family SELECT policies.
DO $publish$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['itens_lista','listas_compras','cartoes','compras','analises_compras'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
 END LOOP;
END $publish$;
CREATE POLICY "family realtime read" ON realtime.messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.familia_membros m WHERE m.user_id=auth.uid() AND realtime.topic()='familia:'||m.familia_id::text));
CREATE POLICY "family realtime send" ON realtime.messages FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.familia_membros m WHERE m.user_id=auth.uid() AND realtime.topic()='familia:'||m.familia_id::text));
