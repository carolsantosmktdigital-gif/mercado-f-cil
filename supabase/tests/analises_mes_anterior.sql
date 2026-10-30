-- Isolated fixture rows. Existing family data is read for identity only; all writes roll back.
BEGIN;
DO $test$
DECLARE
 f uuid; u uuid; card uuid:=gen_random_uuid(); ids uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 receipts uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 dates date[]:=ARRAY['2020-10-15'::date,'2020-11-18'::date,'2020-12-18'::date,'2021-02-18'::date];
 i integer; n integer; row_data jsonb; snapshot uuid; snapshot_again uuid;
BEGIN
 SELECT familia_id,user_id INTO f,u FROM public.familia_membros LIMIT 1;
 IF f IS NULL THEN RAISE EXCEPTION 'Family fixture unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 INSERT INTO public.cartoes(id,familia_id,nome,saldo,cor) VALUES(card,f,'Análise teste temporário',1000,'claro');
 FOR i IN 1..4 LOOP
  INSERT INTO public.listas_compras(id,familia_id,cartao_id,nome,orcamento) VALUES(ids[i],f,card,'Análise teste '||i,200);
  INSERT INTO public.compras(id,familia_id,lista_id,cartao_id,cartao,data,total,itens) VALUES(receipts[i],f,ids[i],card,'Teste',dates[i],30,3);
 END LOOP;
 INSERT INTO public.compra_itens(compra_id,nome,setor,qtd,preco_unitario,total) VALUES
  (receipts[1],'Arroz','Mercearia',2,10,20),
  (receipts[1],'Café','Mercearia',1,20,20),
  (receipts[1],'Sal','Mercearia',1,2,2),
  (receipts[1],'Só outubro','Mercearia',1,3,3),
  (receipts[1],'Média','Mercearia',2,10,20),(receipts[1],'Média','Mercearia',1,16,16),
  (receipts[1],'Preço zero','Mercearia',1,0,0),
  (receipts[2],'  arroz  ','Mercearia',1,12,12),
  (receipts[2],'cafe','Mercearia',1,15,15),
  (receipts[2],'Sal','Mercearia',4,2,8),
  (receipts[2],'Só novembro','Mercearia',1,3,3),
  (receipts[2],'Média','Mercearia',1,12,12),(receipts[2],'Preço zero','Mercearia',1,2,2),
  (receipts[3],'Arroz','Mercearia',1,12,12),
  (receipts[4],'Arroz','Mercearia',1,20,20);
 FOR i IN 1..4 LOOP UPDATE public.listas_compras SET status='finalizada' WHERE id=ids[i]; END LOOP;
 SELECT count(*) INTO n FROM public.analises_compras WHERE compra_anterior_id=ANY(receipts) AND compra_atual_id=ANY(receipts);
 IF n<>2 THEN RAISE EXCEPTION 'Only Oct/Nov and Nov/Dec should compare: %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_anterior_id=receipts[1] AND compra_atual_id=receipts[3]) THEN RAISE EXCEPTION 'December compared with October'; END IF;
 IF EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_atual_id=receipts[4] AND compra_anterior_id=ANY(receipts)) THEN RAISE EXCEPTION 'Missing January must not fall back to December'; END IF;
 SELECT id,itens INTO snapshot,row_data FROM public.analises_compras WHERE compra_anterior_id=receipts[1] AND compra_atual_id=receipts[2];
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'situacao'='alta' AND (j->>'precoAnterior')::numeric=10 AND (j->>'precoAtual')::numeric=12 AND (j->>'percentual')::numeric=20) THEN RAISE EXCEPTION 'Unit price increase incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'situacao'='baixa' AND (j->>'percentual')::numeric=-25) THEN RAISE EXCEPTION 'Price decrease or accent matching incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'nome'='Sal' AND j->>'situacao'='igual') THEN RAISE EXCEPTION 'Quantity change incorrectly interpreted as price change'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'situacao'='novo') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'situacao'='ausente') THEN RAISE EXCEPTION 'Unmatched products missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'nome'='Média' AND (j->>'precoAnterior')::numeric=12 AND j->>'situacao'='igual') THEN RAISE EXCEPTION 'Weighted unit price incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row_data) j WHERE j->>'nome'='Preço zero' AND j->>'situacao'='sem_preco' AND j->>'percentual' IS NULL) THEN RAISE EXCEPTION 'Zero price must not divide by zero'; END IF;
 PERFORM mercado_internal.registrar_analises(f);
 SELECT id INTO snapshot_again FROM public.analises_compras WHERE compra_anterior_id=receipts[1] AND compra_atual_id=receipts[2];
 IF snapshot<>snapshot_again THEN RAISE EXCEPTION 'Analysis snapshot was duplicated'; END IF;
 -- Actual offline purchase date overrides the connection date. A gap removes invalid pairs.
 UPDATE public.compras SET data='2021-01-18' WHERE id=receipts[3];
 IF EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_anterior_id=receipts[2] AND compra_atual_id=receipts[3]) THEN RAISE EXCEPTION 'Offline date correction kept a skipped month'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_anterior_id=receipts[3] AND compra_atual_id=receipts[4]) THEN RAISE EXCEPTION 'January/February comparison not generated'; END IF;
 UPDATE public.compras SET data='2021-01-18' WHERE id=receipts[2];
 IF EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_anterior_id=receipts[2] AND compra_atual_id=receipts[3]) THEN RAISE EXCEPTION 'Same month comparison generated'; END IF;
 -- December to January must work across years.
 UPDATE public.compras SET data='2020-12-18' WHERE id=receipts[3];
 IF NOT EXISTS(SELECT 1 FROM public.analises_compras WHERE compra_anterior_id=receipts[3] AND compra_atual_id=receipts[2]) THEN RAISE EXCEPTION 'Year boundary comparison missing'; END IF;
 IF has_table_privilege('authenticated','public.analises_compras','INSERT') OR has_function_privilege('authenticated','mercado_internal.registrar_analises(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Clients can forge analysis snapshots'; END IF;
 PERFORM set_config('role','authenticated',true);
 SELECT count(*) INTO n FROM public.analises_compras WHERE compra_atual_id=ANY(receipts);
 IF n=0 THEN RAISE EXCEPTION 'Family member cannot read saved analyses'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 SELECT count(*) INTO n FROM public.analises_compras WHERE compra_atual_id=ANY(receipts);
 IF n<>0 THEN RAISE EXCEPTION 'Other user can read family analyses'; END IF;
 PERFORM set_config('role','none',true);
END $test$;
ROLLBACK;
SELECT 'PASS: previous calendar month only, no skipped or same months, year transition, unit prices, trends, unmatched products, automatic triggers, date corrections and durable snapshots; fixtures rolled back' AS result;
