BEGIN;
DO $test$
DECLARE f uuid; u uuid; card uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); result uuid; original_items jsonb:='[{"nome":"Arroz","setor":"Mercearia","qtd":2,"unidade":"kg"},{"nome":"Cereal","setor":"Crianças","qtd":1,"unidade":"caixa"}]'; n integer;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Teste exclusão e criação',500,'claro');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);PERFORM set_config('role','authenticated',true);
 result:=public.criar_lista_personalizada(a,f,card,'Minha lista teste',200,original_items);
 IF result<>a THEN RAISE EXCEPTION 'Initial list not created'; END IF;
 UPDATE public.itens_lista SET preco=5 WHERE lista_id=a AND nome='Arroz (kg)';
 result:=public.criar_lista_personalizada(b,f,card,'Minha lista teste',200,original_items);
 IF result<>a THEN RAISE EXCEPTION 'Reopened form created a duplicate'; END IF;
 SELECT count(*) INTO n FROM public.listas_compras WHERE familia_id=f AND cartao_id=card;
 IF n<>1 OR (SELECT preco FROM public.itens_lista WHERE lista_id=a AND nome='Arroz (kg)')<>5 THEN RAISE EXCEPTION 'Retry duplicated or overwrote current items'; END IF;
 result:=public.criar_lista_personalizada(c,f,card,'Outra lista teste',100,original_items);
 IF result<>c THEN RAISE EXCEPTION 'Distinct shopping list incorrectly merged'; END IF;
 PERFORM public.excluir_lista_compras(a);PERFORM public.excluir_lista_compras(a);
 IF EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=a) OR EXISTS(SELECT 1 FROM public.listas_compras WHERE id=a) THEN RAISE EXCEPTION 'Selected list not deleted'; END IF;
 IF (SELECT count(*) FROM public.itens_lista WHERE lista_id=c)<>2 OR (SELECT saldo FROM public.cartoes WHERE id=card)<>500 THEN RAISE EXCEPTION 'Deletion affected another list or card'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 PERFORM public.excluir_lista_compras(c);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.listas_compras WHERE id=c) THEN RAISE EXCEPTION 'Unauthorized deletion accepted'; END IF;
 PERFORM set_config('role','none',true);
 UPDATE public.listas_compras SET status='finalizada' WHERE id=c;
 PERFORM set_config('role','authenticated',true);
 BEGIN
  PERFORM public.excluir_lista_compras(c);
  RAISE EXCEPTION 'Finalized list deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Finalized list deleted' THEN RAISE; END IF; END;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: duplicate form requests reuse the existing list, preserve current prices, distinct lists remain independent, confirmed deletion affects only its items, family and finalized-list protection, card unchanged' AS result;
