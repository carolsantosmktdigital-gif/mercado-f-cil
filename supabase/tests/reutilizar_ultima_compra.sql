BEGIN;
DO $test$
DECLARE f uuid; u uuid; card uuid:=gen_random_uuid(); list uuid:=gen_random_uuid(); items jsonb:='[{"nome":"Arroz (kg)","nomeCompleto":"Arroz (kg)","setor":"Mercearia","qtd":2.5,"unidade":"Quantidade da compra anterior"},{"nome":"Feijão","nomeCompleto":"Feijão","setor":"Mercearia","qtd":3,"unidade":"Quantidade da compra anterior"}]'; result uuid;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Teste reutilização',500,'claro');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);PERFORM set_config('role','authenticated',true);
 result:=public.criar_lista_personalizada(list,f,card,'Reutilizada teste',200,items);
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=list AND nome='Arroz (kg)' AND qtd=2.5 AND preco=0 AND NOT comprado) THEN RAISE EXCEPTION 'Original name or exact quantity was modified'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=list AND nome='Feijão' AND qtd=3) THEN RAISE EXCEPTION 'Unit was added to original name'; END IF;
 result:=public.criar_lista_personalizada(gen_random_uuid(),f,card,'Reutilizada teste',200,items);
 IF result<>list OR (SELECT count(*) FROM public.itens_lista WHERE lista_id=list)<>2 THEN RAISE EXCEPTION 'Reused list retry duplicated items'; END IF;
 IF (SELECT saldo FROM public.cartoes WHERE id=card)<>500 THEN RAISE EXCEPTION 'Reuse debited card'; END IF;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: original product names and exact quantities preserved, price and cart reset, no duplicate on retry, card balance unchanged' AS result;
