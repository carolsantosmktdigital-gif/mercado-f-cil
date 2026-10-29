BEGIN;
DO $test$
DECLARE f uuid; u uuid; card uuid:=gen_random_uuid(); list uuid:=gen_random_uuid(); rice uuid:=gen_random_uuid(); beans uuid:=gen_random_uuid(); op uuid:=gen_random_uuid(); finish uuid:=gen_random_uuid(); pend uuid:=gen_random_uuid(); result jsonb; snapshot jsonb; receipt uuid; n integer;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Teste colaboração',500,'claro');
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,status,tipo) VALUES(list,f,card,'Compra em dupla',200,'em_andamento','normal');
 INSERT INTO public.itens_lista(id,familia_id,lista_id,nome,setor,qtd,preco,comprado,inesperado) VALUES(rice,f,list,'Arroz','Mercearia',1,10,false,false),(beans,f,list,'Feijão','Mercearia',1,5,false,false);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 -- Device A sets price; B edits a different field from an older snapshot: both survive.
 result:=public.escrever_item_compartilhado(op,f,list,rice,'update','{"preco":12}','{"preco":10}');
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'First device write failed'; END IF;
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"qtd":2}','{"qtd":1}');
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Disjoint field edit rejected'; END IF;
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,beans,'update','{"comprado":true}','{"comprado":false}');
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Other aisle product rejected'; END IF;
 -- Two prices from the same old value: the second must ask for a decision.
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"preco":13}','{"preco":10}');
 IF result->>'conflito'<>'true' OR result->'atual'->>'preco'<>'12.00' THEN RAISE EXCEPTION 'Conflicting price silently overwritten: %',result; END IF;
 IF (SELECT preco FROM public.itens_lista WHERE id=rice)<>12 THEN RAISE EXCEPTION 'Conflict changed stored price'; END IF;
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'delete','{}','{"nome":"Arroz","setor":"Mercearia","qtd":1,"preco":10,"comprado":false,"inesperado":false}');
 IF result->>'conflito'<>'true' THEN RAISE EXCEPTION 'Stale deletion accepted'; END IF;
 -- Retrying a successful request after another device's newer edit cannot revert it.
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"preco":14}','{"preco":12}');
 PERFORM public.escrever_item_compartilhado(op,f,list,rice,'update','{"preco":12}','{"preco":10}');
 IF (SELECT preco FROM public.itens_lista WHERE id=rice)<>14 OR (SELECT qtd FROM public.itens_lista WHERE id=rice)<>2 THEN RAISE EXCEPTION 'Retry reverted peer data'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor',setor,'qtd',qtd,'preco',preco,'comprado',comprado)) INTO snapshot FROM public.itens_lista WHERE lista_id=list;
 -- Same grand total, different product content still requires a new review.
 PERFORM public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"nome":"Arroz integral"}','{"nome":"Arroz"}');
 BEGIN
  PERFORM public.finalizar_compra_compartilhada(list,finish,pend,current_date,snapshot);
  RAISE EXCEPTION 'Stale snapshot finalized';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stale snapshot finalized' THEN RAISE; END IF; END;
 IF (SELECT saldo FROM public.cartoes WHERE id=card)<>500 THEN RAISE EXCEPTION 'Stale checkout debited card'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'setor',setor,'qtd',qtd,'preco',preco,'comprado',comprado)) INTO snapshot FROM public.itens_lista WHERE lista_id=list;
 receipt:=public.finalizar_compra_compartilhada(list,finish,pend,current_date,snapshot);
 IF receipt IS NULL OR (SELECT saldo FROM public.cartoes WHERE id=card)<>495 THEN RAISE EXCEPTION 'Shared checkout failed'; END IF;
 IF public.finalizar_compra_compartilhada(list,finish,pend,current_date,snapshot)<>receipt THEN RAISE EXCEPTION 'Checkout retry returned another receipt'; END IF;
 IF (SELECT saldo FROM public.cartoes WHERE id=card)<>495 THEN RAISE EXCEPTION 'Checkout double debit'; END IF;
 BEGIN
  PERFORM public.finalizar_compra_compartilhada(list,gen_random_uuid(),gen_random_uuid(),current_date,snapshot);
  RAISE EXCEPTION 'Second phone finalized twice';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Second phone finalized twice' THEN RAISE; END IF; END;
 result:=public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"preco":16}','{"preco":14}');
 IF result->>'bloqueado'<>'true' THEN RAISE EXCEPTION 'Finalized list edited'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.escrever_item_compartilhado(gen_random_uuid(),f,list,rice,'update','{"preco":16}','{"preco":14}');
  RAISE EXCEPTION 'Non-member accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Non-member accepted' THEN RAISE; END IF; END;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: disjoint edits merge, same-field and deletion conflicts preserve data, retries cannot revert peers, snapshot checkout catches equal-total changes, exactly one debit, closed-list and family protection' AS result;
