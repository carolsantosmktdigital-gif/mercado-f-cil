BEGIN;
DO $test$
DECLARE
 f uuid; u uuid; card uuid:=gen_random_uuid(); previous_list uuid:=gen_random_uuid(); current_list uuid:=gen_random_uuid();
 previous_purchase uuid:=gen_random_uuid(); purchase uuid; final_op uuid:=gen_random_uuid(); edit_op uuid:=gen_random_uuid(); result_id uuid;
 balance numeric; revision integer; old_items jsonb; updated_items jsonb;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 IF f IS NULL THEN RAISE EXCEPTION 'Family fixture unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Teste temporário edição',200,'claro');
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento) VALUES(previous_list,f,card,'Outubro teste',100),(current_list,f,card,'Novembro teste',100);
 INSERT INTO public.compras(id,familia_id,lista_id,cartao_id,cartao,data,total,itens) VALUES(previous_purchase,f,previous_list,card,'Teste','2020-10-15',60,1);
 INSERT INTO public.compra_itens(compra_id,nome,setor,qtd,preco_unitario,total) VALUES(previous_purchase,'Arroz','Mercearia',2,30,60);
 UPDATE public.listas_compras SET status='finalizada' WHERE id=previous_list;
 INSERT INTO public.itens_lista(familia_id,lista_id,nome,setor,qtd,preco,comprado) VALUES(f,current_list,'Arroz','Mercearia',2,35,true);
 purchase:=public.finalizar_compra_offline(current_list,final_op,gen_random_uuid(),70,1,'2020-11-15');
 old_items:='[{"nome":"Arroz","setor":"Mercearia","qtd":2,"preco":30}]'::jsonb;
 result_id:=public.editar_itens_compra(final_op,edit_op,0,old_items,final_op);
 IF result_id<>purchase THEN RAISE EXCEPTION 'Pending receipt did not resolve to its real purchase'; END IF;
 PERFORM public.editar_itens_compra(purchase,edit_op,0,old_items);
 SELECT saldo INTO balance FROM public.cartoes WHERE id=card;
 IF balance<>140 THEN RAISE EXCEPTION 'Refund must happen exactly once: %',balance; END IF;
 SELECT revisao_itens INTO revision FROM public.compras WHERE id=purchase;
 IF revision<>1 THEN RAISE EXCEPTION 'Duplicate revision'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.analises_compras a, jsonb_array_elements(a.itens) i WHERE a.compra_anterior_id=previous_purchase AND a.compra_atual_id=purchase AND i->>'situacao'='igual') THEN RAISE EXCEPTION 'Monthly analysis not refreshed after correction'; END IF;
 updated_items:='[{"nome":"Arroz corrigido","setor":"Mercearia","qtd":2,"preco":40},{"nome":"Item gratuito","setor":"Outros","qtd":1,"preco":0}]'::jsonb;
 PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),1,updated_items);
 SELECT saldo INTO balance FROM public.cartoes WHERE id=card;
 IF balance<>120 THEN RAISE EXCEPTION 'Additional debit incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.compras WHERE id=purchase AND total=80 AND itens=2 AND revisao_itens=2) THEN RAISE EXCEPTION 'Purchase total or item count incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.compra_itens WHERE compra_id=previous_purchase AND nome='Arroz' AND total=60) THEN RAISE EXCEPTION 'Another purchase changed'; END IF;
 BEGIN
  PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),0,old_items);
  RAISE EXCEPTION 'Stale revision accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Esta compra foi editada%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),2,'[]'::jsonb);
  RAISE EXCEPTION 'Empty receipt accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'A compra deve ter%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),2,'[{"nome":"Item","qtd":1,"preco":1000}]'::jsonb);
  RAISE EXCEPTION 'Insufficient balance accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Saldo do cartão insuficiente%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),2,'[{"nome":"Item","qtd":1.0001,"preco":2.999}]'::jsonb);
  RAISE EXCEPTION 'Excess decimal places accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Confira nomes%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.editar_itens_compra(purchase,gen_random_uuid(),2,old_items);
  RAISE EXCEPTION 'Unauthorized purchase edit accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Acesso não autorizado' THEN RAISE; END IF; END;
 SELECT saldo INTO balance FROM public.cartoes WHERE id=card;
 IF balance<>120 THEN RAISE EXCEPTION 'Rejected edit changed balance'; END IF;
 IF has_schema_privilege('authenticated','mercado_internal','USAGE') OR has_function_privilege('anon','public.editar_itens_compra(uuid,uuid,integer,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Invalid receipt privileges'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: receipt-scoped editing, refund and extra debit, retry-safe operations, offline receipt mapping, revision conflicts, item validation, family authorization and monthly analysis refresh; fixtures rolled back' AS result;
