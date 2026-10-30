CREATE OR REPLACE FUNCTION public.editar_itens_compra(
 _compra_id uuid,_operacao_id uuid,_revisao_esperada integer,_itens jsonb,_finalizacao_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_id uuid:=_compra_id; v_compra public.compras%ROWTYPE; v_recibo mercado_internal.edicoes_compra%ROWTYPE;
 v_saldo numeric(12,2); v_total numeric(12,2); v_delta numeric(12,2); v_qtd integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
 IF _operacao_id IS NULL OR _revisao_esperada IS NULL THEN RAISE EXCEPTION 'Dados da edição incompletos'; END IF;
 IF _finalizacao_id IS NOT NULL THEN
  SELECT compra_id INTO v_id FROM mercado_internal.compras_offline WHERE operacao_id=_finalizacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A compra ainda aguarda sincronização'; END IF;
 END IF;
 SELECT * INTO v_compra FROM public.compras WHERE id=v_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
 IF NOT public.e_membro(v_compra.familia_id) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT * INTO v_recibo FROM mercado_internal.edicoes_compra WHERE operacao_id=_operacao_id;
 IF FOUND THEN
  IF v_recibo.compra_id<>v_id THEN RAISE EXCEPTION 'Identificador de edição já utilizado'; END IF;
  RETURN v_id;
 END IF;
 IF v_compra.revisao_itens<>_revisao_esperada THEN RAISE EXCEPTION 'Esta compra foi editada em outro dispositivo. Reabra os detalhes antes de alterar'; END IF;
 IF _itens IS NULL OR jsonb_typeof(_itens)<>'array' THEN RAISE EXCEPTION 'Informe os produtos da compra'; END IF;
 v_qtd:=jsonb_array_length(_itens);
 IF v_qtd>1000 THEN RAISE EXCEPTION 'A compra pode ter até 1000 produtos'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(_itens) AS i(nome text,setor text,qtd numeric,preco numeric)
   WHERE nullif(btrim(nome),'') IS NULL OR length(nome)>200 OR qtd IS NULL OR qtd<=0 OR qtd>999999
     OR preco IS NULL OR preco<0 OR preco>999999 OR qtd<>round(qtd,3) OR preco<>round(preco,2) OR qtd::text IN ('NaN','Infinity','-Infinity') OR preco::text IN ('NaN','Infinity','-Infinity'))
 THEN RAISE EXCEPTION 'Confira nomes, quantidades e preços dos produtos'; END IF;
 SELECT coalesce(sum(round(i.qtd*i.preco,2)),0) INTO v_total FROM jsonb_to_recordset(_itens) AS i(qtd numeric,preco numeric);
 v_delta:=v_total-v_compra.total;
 SELECT saldo INTO v_saldo FROM public.cartoes WHERE id=v_compra.cartao_id AND familia_id=v_compra.familia_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cartão vinculado não encontrado'; END IF;
 IF v_saldo-v_delta<0 THEN RAISE EXCEPTION 'Saldo do cartão insuficiente para aumentar o valor desta compra'; END IF;
 DELETE FROM public.compra_itens WHERE compra_id=v_id;
 INSERT INTO public.compra_itens(compra_id,nome,setor,qtd,preco_unitario,total)
  SELECT v_id,btrim(i.nome),coalesce(nullif(btrim(i.setor),''),'Mercearia'),i.qtd,i.preco,round(i.qtd*i.preco,2)
  FROM jsonb_to_recordset(_itens) AS i(nome text,setor text,qtd numeric,preco numeric);
 UPDATE public.compras SET total=v_total,itens=v_qtd,revisao_itens=revisao_itens+1 WHERE id=v_id;
 UPDATE public.cartoes SET saldo=saldo-v_delta WHERE id=v_compra.cartao_id;
 INSERT INTO mercado_internal.edicoes_compra(operacao_id,compra_id,familia_id,revisao,total)
  VALUES(_operacao_id,v_id,v_compra.familia_id,v_compra.revisao_itens+1,v_total);
 PERFORM mercado_internal.registrar_analises(v_compra.familia_id);
 RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.editar_itens_compra(uuid,uuid,integer,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_itens_compra(uuid,uuid,integer,jsonb,uuid) TO authenticated;


