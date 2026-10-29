BEGIN;
DO $test$
DECLARE sample record; actual boolean;
BEGIN
 FOR sample IN SELECT * FROM (VALUES
  ('2026-10-10'::date,'2026-11-05'::date,true),('2026-10-10','2026-11-15',true),
  ('2026-10-10','2026-11-04',false),('2026-10-10','2026-11-16',false),
  ('2026-10-10','2026-10-15',false),('2026-10-10','2026-12-10',false),
  ('2026-01-31','2026-02-23',true),('2026-01-31','2026-02-22',false),
  ('2024-01-31','2024-02-24',true),('2024-01-31','2024-02-23',false),
  ('2026-12-31','2027-01-26',true),('2026-12-31','2027-01-25',false),
  ('2026-02-28','2026-03-31',true)
 ) t(previous,current,allowed) LOOP
  actual:=mercado_internal.compras_comparaveis(sample.previous,sample.current);
  IF actual IS DISTINCT FROM sample.allowed THEN RAISE EXCEPTION 'Unexpected window: % -> %: %',sample.previous,sample.current,actual; END IF;
 END LOOP;
END $test$;
ROLLBACK;
SELECT 'PASS: five-day inclusive bounds, six-day exclusion, previous calendar month only, leap years, end-of-month clamping and year boundaries' AS result;
