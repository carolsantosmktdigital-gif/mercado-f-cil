BEGIN;
DO $test$
DECLARE f uuid; u uuid; c uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); n integer;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(c,f,'Teste modelo',500,'claro');
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 PERFORM public.criar_lista_personalizada(l,f,c,'Teste personalizada',200,'[{"nome":"Arroz","setor":"Mercearia","qtd":2.5,"unidade":"kg"},{"nome":"Cereal","setor":"Crianças","qtd":1,"unidade":"caixa"}]');
 PERFORM public.criar_lista_personalizada(l,f,c,'Teste personalizada',200,'[{"nome":"Arroz","setor":"Mercearia","qtd":2.5,"unidade":"kg"}]');
 SELECT count(*) INTO n FROM public.itens_lista WHERE lista_id=l AND familia_id=f;
 IF n<>2 THEN RAISE EXCEPTION 'Retry duplicated or replaced items'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=l AND nome='Arroz (kg)' AND qtd=2.5 AND preco=0 AND NOT comprado) THEN RAISE EXCEPTION 'Invalid item data'; END IF;
 IF (SELECT saldo FROM public.cartoes WHERE id=c)<>500 THEN RAISE EXCEPTION 'Creating a list debited the card'; END IF;
 BEGIN
  PERFORM public.criar_lista_personalizada(bad,f,c,'Invalid',200,'[{"nome":"Arroz","setor":"Mercearia","qtd":-1,"unidade":"kg"}]');
  RAISE EXCEPTION 'Invalid quantity accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid quantity accepted' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.listas_compras WHERE id=bad) THEN RAISE EXCEPTION 'Partial list persisted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.criar_lista_personalizada(l,f,c,'Unauthorized',200,'[]');
  RAISE EXCEPTION 'Unauthorized retry accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unauthorized retry accepted' THEN RAISE; END IF; END;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: atomic creation, quantities, zero prices, retry idempotency, unchanged card balance and family authorization' AS result;
