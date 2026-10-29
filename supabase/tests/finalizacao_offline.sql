-- Run against an environment with at least one family member. All fixtures roll back.
BEGIN;
DO $test$
DECLARE
  u uuid; f uuid; c uuid:=gen_random_uuid(); l uuid:=gen_random_uuid();
  p uuid:=gen_random_uuid(); op uuid:=gen_random_uuid();
  receipt uuid; again uuid; conflict_list uuid:=gen_random_uuid(); n integer; balance numeric;
BEGIN
  SELECT user_id,familia_id INTO u,f FROM public.familia_membros LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'No auth fixture available'; END IF;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(c,f,'Cartão temporário teste offline',200,'claro');
  INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento) VALUES(l,f,c,'Lista temporária teste',100);
  INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado) VALUES
    (f,l,'Arroz teste','Mercearia',2,35,true),(f,l,'Feijão teste','Mercearia',1,5,false);
  receipt:=public.finalizar_compra_offline(l,op,p,70,1,'2026-10-28');
  again:=public.finalizar_compra_offline(l,op,p,70,1,'2026-10-28');
  IF receipt<>again THEN RAISE EXCEPTION 'Duplicate receipt'; END IF;
  SELECT saldo INTO balance FROM public.cartoes WHERE id=c;
  IF balance<>130 THEN RAISE EXCEPTION 'Incorrect or duplicate debit: %',balance; END IF;
  SELECT count(*) INTO n FROM public.compras WHERE lista_id=l;
  IF n<>1 THEN RAISE EXCEPTION 'Duplicate history'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.compras WHERE id=receipt AND data='2026-10-28') THEN RAISE EXCEPTION 'Wrong purchase date'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=p AND nome='Feijão teste') THEN RAISE EXCEPTION 'Remaining items not moved to stable ID'; END IF;
  INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento) VALUES(conflict_list,f,c,'Conflito temporário teste',100);
  INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado) VALUES(f,conflict_list,'Arroz teste','Mercearia',1,20,true);
  BEGIN
    PERFORM public.finalizar_compra_offline(conflict_list,gen_random_uuid(),gen_random_uuid(),25,1,CURRENT_DATE);
    RAISE EXCEPTION 'Expected conflict was accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'A lista mudou%' THEN RAISE; END IF; END;
  SELECT saldo INTO balance FROM public.cartoes WHERE id=c;
  IF balance<>130 THEN RAISE EXCEPTION 'Conflict changed card balance'; END IF;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  BEGIN
    PERFORM public.finalizar_compra_offline(l,op,p,70,1,CURRENT_DATE);
    RAISE EXCEPTION 'Unauthorized request was accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Acesso não autorizado' THEN RAISE; END IF; END;
  IF has_schema_privilege('authenticated','mercado_internal','USAGE')
     OR has_function_privilege('anon','public.finalizar_compra_offline(uuid,uuid,uuid,numeric,integer,date)','EXECUTE')
  THEN RAISE EXCEPTION 'Incorrect privileges'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: one debit, one receipt, retry safe, stable pending list, date retained, conflict and unauthorized access rejected; test data rolled back' AS result;
