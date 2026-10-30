BEGIN;
DO $test$
DECLARE f uuid; u uuid; other_family uuid:=gen_random_uuid(); card uuid:=gen_random_uuid(); list uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); label text:='Categoria teste '||gen_random_uuid(); n integer;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 INSERT INTO public.familias(id,nome) VALUES(other_family,'Família temporária teste');
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Cartão temporário teste',100,'claro');
 INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento) VALUES(list,f,card,'Lista temporária teste',100);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('role','authenticated',true);
 INSERT INTO public.categorias(familia_id,nome) VALUES(f,label) ON CONFLICT(familia_id,nome_chave) DO NOTHING;
 INSERT INTO public.categorias(familia_id,nome) VALUES(f,lower(label)) ON CONFLICT(familia_id,nome_chave) DO NOTHING;
 SELECT count(*) INTO n FROM public.categorias WHERE familia_id=f AND nome_chave=lower(label);
 IF n<>1 THEN RAISE EXCEPTION 'Category retry produced a duplicate'; END IF;
 BEGIN
  INSERT INTO public.categorias(familia_id,nome) VALUES(other_family,label);
  RAISE EXCEPTION 'Cross-family category insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.itens_lista(id,familia_id,lista_id,nome,setor,qtd,preco) VALUES(item,f,list,'Produto teste','Lavínia',1,2);
 IF NOT EXISTS(SELECT 1 FROM public.itens_lista WHERE id=item AND setor='Crianças') THEN RAISE EXCEPTION 'Legacy category was not normalized'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 SELECT count(*) INTO n FROM public.categorias WHERE nome_chave=lower(label);
 IF n<>0 THEN RAISE EXCEPTION 'Category leaked outside family'; END IF;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: custom category creation, retry-safe duplicates, family access and legacy category normalization; fixtures rolled back' AS result;
