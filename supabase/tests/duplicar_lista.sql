BEGIN;
DO $test$
DECLARE f uuid; u uuid; c uuid:=gen_random_uuid(); src uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); target2 uuid:=gen_random_uuid(); empty_list uuid:=gen_random_uuid(); failed uuid:=gen_random_uuid(); receipt uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); n integer;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(c,f,'Teste duplicação',500,'claro');
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento,status,tipo) VALUES(src,f,c,'Lista original',200,'em_andamento','normal'),(empty_list,f,c,'Vazia',100,'em_andamento','normal');
 INSERT INTO public.itens_lista(id,familia_id,lista_id,nome,setor,qtd,preco,comprado,inesperado) VALUES(item,f,src,'Arroz (kg)','Mercearia',2.5,20,true,true),(gen_random_uuid(),f,src,'Cereal','Crianças',2,10,false,false);
 INSERT INTO public.compras(id,familia_id,lista_id,cartao_id,cartao,total,itens,data) VALUES(receipt,f,src,c,'Teste duplicação',50,1,current_date);
 INSERT INTO public.compra_itens(compra_id,nome,setor,qtd,preco_unitario,total) VALUES(receipt,'Arroz (kg)','Mercearia',2.5,20,50);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 PERFORM public.duplicar_lista_compras(target,f,src,false,'Minha cópia',c,150);
 PERFORM public.duplicar_lista_compras(target,f,src,false,'Minha cópia',c,150);
 SELECT count(*) INTO n FROM public.itens_lista WHERE lista_id=target;
 IF n<>2 THEN RAISE EXCEPTION 'Retry duplicated products'; END IF;
 IF EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=target AND (preco<>0 OR comprado OR inesperado OR id=item)) THEN RAISE EXCEPTION 'New item flags, prices or identity invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE lista_id=target AND nome='Arroz (kg)' AND qtd=2.5 AND setor='Mercearia') THEN RAISE EXCEPTION 'Product data not preserved'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE id=item AND preco=20 AND comprado AND inesperado) THEN RAISE EXCEPTION 'Source modified'; END IF;
 UPDATE public.itens_lista SET qtd=3 WHERE lista_id=target AND nome='Arroz (kg)';
 IF (SELECT qtd FROM public.itens_lista WHERE id=item)<>2.5 THEN RAISE EXCEPTION 'Editing copy modified source'; END IF;
 PERFORM public.duplicar_lista_compras(target2,f,src,true,'Cópia histórico',c,100);
 SELECT count(*) INTO n FROM public.itens_lista WHERE lista_id=target2;
 IF n<>1 THEN RAISE EXCEPTION 'History copied wrong items'; END IF;
 IF (SELECT saldo FROM public.cartoes WHERE id=c)<>500 THEN RAISE EXCEPTION 'Card debited during duplication'; END IF;
 BEGIN
  PERFORM public.duplicar_lista_compras(failed,f,empty_list,false,'Vazia',c,100);
  RAISE EXCEPTION 'Empty list accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Empty list accepted' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.listas_compras WHERE id=failed) THEN RAISE EXCEPTION 'Partial empty copy persisted'; END IF;
 BEGIN
  PERFORM public.duplicar_lista_compras(failed,f,src,false,'Sem saldo',c,501);
  RAISE EXCEPTION 'Insufficient budget accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Insufficient budget accepted' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.duplicar_lista_compras(target,f,src,false,'Unauthorized',c,100);
  RAISE EXCEPTION 'Unauthorized retry accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unauthorized retry accepted' THEN RAISE; END IF; END;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: independent active and historical copies, preserved quantities and categories, reset prices and cart, retry idempotency, empty list rollback, budget and family validation, unchanged source and card' AS result;
