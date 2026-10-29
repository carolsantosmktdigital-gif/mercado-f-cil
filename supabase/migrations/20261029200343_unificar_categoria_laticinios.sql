CREATE OR REPLACE FUNCTION mercado_internal.categoria_canonica(_nome text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $fn$
 SELECT CASE
 WHEN translate(lower(btrim(_nome)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')='lavinia' THEN 'Crianças'
 WHEN translate(lower(btrim(_nome)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') IN ('lacticinios','laticinios') THEN 'Laticínios'
 ELSE _nome END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.categoria_canonica(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mercado_internal.normalizar_categoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN NEW.setor:=mercado_internal.categoria_canonica(NEW.setor); RETURN NEW; END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.normalizar_categoria() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mercado_internal.normalizar_nome_categoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN NEW.nome:=mercado_internal.categoria_canonica(NEW.nome); RETURN NEW; END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.normalizar_nome_categoria() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER nome_categoria_canonico BEFORE INSERT OR UPDATE OF nome ON public.categorias FOR EACH ROW EXECUTE FUNCTION mercado_internal.normalizar_nome_categoria();
-- Merge category labels only. Item identities, names, quantities and prices stay intact.
INSERT INTO public.categorias(familia_id,nome)
 SELECT DISTINCT familia_id,'Laticínios' FROM (
 SELECT familia_id,nome categoria FROM public.categorias
 UNION ALL SELECT familia_id,setor FROM public.itens_lista
 UNION ALL SELECT familia_id,setor FROM public.produtos
 UNION ALL SELECT c.familia_id,i.setor FROM public.compra_itens i JOIN public.compras c ON c.id=i.compra_id
 ) rows WHERE mercado_internal.categoria_canonica(categoria)='Laticínios'
 ON CONFLICT(familia_id,nome_chave) DO NOTHING;
DELETE FROM public.categorias WHERE mercado_internal.categoria_canonica(nome)='Laticínios' AND nome_chave<>lower('Laticínios');
UPDATE public.categorias SET nome='Laticínios' WHERE nome_chave=lower('Laticínios') AND nome IS DISTINCT FROM 'Laticínios';
UPDATE public.itens_lista SET setor='Laticínios' WHERE mercado_internal.categoria_canonica(setor)='Laticínios' AND setor IS DISTINCT FROM 'Laticínios';
UPDATE public.produtos SET setor='Laticínios' WHERE mercado_internal.categoria_canonica(setor)='Laticínios' AND setor IS DISTINCT FROM 'Laticínios';
UPDATE public.compra_itens SET setor='Laticínios' WHERE mercado_internal.categoria_canonica(setor)='Laticínios' AND setor IS DISTINCT FROM 'Laticínios';
