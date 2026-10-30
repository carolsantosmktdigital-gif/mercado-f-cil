CREATE OR REPLACE FUNCTION public.finalizar_compra_offline(
  _lista_id uuid, _operacao_id uuid, _pendencias_id uuid,
  _total_previsto numeric, _qtd_prevista integer, _data_compra date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_lista public.listas_compras%ROWTYPE;
  v_compra public.compras%ROWTYPE;
  v_recibo mercado_internal.compras_offline%ROWTYPE;
  v_total numeric;
  v_qtd integer;
  v_id uuid;
  v_pendente uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF _operacao_id IS NULL OR _pendencias_id IS NULL OR _total_previsto IS NULL OR _qtd_prevista IS NULL THEN
    RAISE EXCEPTION 'Dados da compra incompletos';
  END IF;
  SELECT * INTO v_lista FROM public.listas_compras WHERE id = _lista_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lista não encontrada'; END IF;
  IF NOT public.e_membro(v_lista.familia_id) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT * INTO v_recibo FROM mercado_internal.compras_offline WHERE operacao_id = _operacao_id;
  IF FOUND THEN
    IF v_recibo.familia_id <> v_lista.familia_id OR v_recibo.lista_id <> _lista_id THEN
      RAISE EXCEPTION 'Identificador de compra já utilizado';
    END IF;
    RETURN v_recibo.compra_id;
  END IF;
  IF v_lista.status <> 'em_andamento' THEN RAISE EXCEPTION 'Esta lista já foi finalizada em outro dispositivo'; END IF;
  PERFORM id FROM public.itens_lista WHERE lista_id = _lista_id FOR UPDATE;
  SELECT COALESCE(SUM(ROUND(qtd * preco, 2)),0), COUNT(*) INTO v_total,v_qtd
    FROM public.itens_lista WHERE lista_id = _lista_id AND comprado = true;
  IF v_total <> _total_previsto OR v_qtd <> _qtd_prevista THEN
    RAISE EXCEPTION 'A lista mudou em outro dispositivo. Confira a compra antes de sincronizar';
  END IF;
  -- Reuse the existing authenticated, transactional budget/reserve checks.
  v_id := public.finalizar_compra(_lista_id);
  SELECT * INTO v_compra FROM public.compras WHERE id = v_id;
  IF v_compra.total <> _total_previsto OR v_compra.itens <> _qtd_prevista THEN
    RAISE EXCEPTION 'A lista mudou em outro dispositivo. Confira a compra antes de sincronizar';
  END IF;
  UPDATE public.compras SET data = COALESCE(_data_compra,CURRENT_DATE) WHERE id = v_id;
  INSERT INTO mercado_internal.compras_offline(operacao_id,familia_id,lista_id,compra_id) VALUES(_operacao_id,v_lista.familia_id,_lista_id,v_id);
  -- Use the same pending-list UUID on the device and server, so queued edits
  -- to remaining products still reference the correct list after reconnecting.
  SELECT id INTO v_pendente FROM public.listas_compras WHERE lista_origem_id = _lista_id AND tipo = 'pendencias' AND status = 'em_andamento';
  IF v_pendente IS NOT NULL AND v_pendente <> _pendencias_id THEN
    UPDATE public.listas_compras SET lista_origem_id = NULL WHERE id = v_pendente;
    INSERT INTO public.listas_compras (id,familia_id,cartao_id,nome,valor_reservado,orcamento,status,tipo,lista_origem_id)
      SELECT _pendencias_id,familia_id,cartao_id,nome,valor_reservado,orcamento,status,tipo,_lista_id
      FROM public.listas_compras WHERE id = v_pendente;
    UPDATE public.itens_lista SET lista_id = _pendencias_id WHERE lista_id = v_pendente;
    DELETE FROM public.listas_compras WHERE id = v_pendente;
  END IF;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.finalizar_compra_offline(uuid,uuid,uuid,numeric,integer,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_compra_offline(uuid,uuid,uuid,numeric,integer,date) TO authenticated;

