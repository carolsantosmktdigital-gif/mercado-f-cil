CREATE TABLE public.categorias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK(length(btrim(nome)) BETWEEN 1 AND 60 AND lower(btrim(nome))<>'todos'),
 nome_chave text GENERATED ALWAYS AS (lower(btrim(nome))) STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(familia_id,nome_chave)
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categorias FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.categorias TO authenticated;
CREATE POLICY "familia consulta categorias" ON public.categorias FOR SELECT TO authenticated USING(public.e_membro(familia_id));
CREATE POLICY "familia cria categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK(public.e_membro(familia_id));
CREATE OR REPLACE FUNCTION mercado_internal.normalizar_categoria()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF lower(btrim(NEW.setor)) IN ('lavínia','lavinia') THEN NEW.setor:='Crianças'; END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION mercado_internal.normalizar_categoria() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER categoria_atual_itens BEFORE INSERT OR UPDATE OF setor ON public.itens_lista FOR EACH ROW EXECUTE FUNCTION mercado_internal.normalizar_categoria();
CREATE TRIGGER categoria_atual_produtos BEFORE INSERT OR UPDATE OF setor ON public.produtos FOR EACH ROW EXECUTE FUNCTION mercado_internal.normalizar_categoria();
CREATE TRIGGER categoria_atual_historico BEFORE INSERT OR UPDATE OF setor ON public.compra_itens FOR EACH ROW EXECUTE FUNCTION mercado_internal.normalizar_categoria();
UPDATE public.itens_lista SET setor='Crianças' WHERE lower(btrim(setor)) IN ('lavínia','lavinia');
UPDATE public.produtos SET setor='Crianças' WHERE lower(btrim(setor)) IN ('lavínia','lavinia');
UPDATE public.compra_itens SET setor='Crianças' WHERE lower(btrim(setor)) IN ('lavínia','lavinia');
INSERT INTO public.categorias(familia_id,nome)
 SELECT DISTINCT ON(familia_id,lower(btrim(setor))) familia_id,btrim(setor) FROM (
 SELECT familia_id,setor FROM public.itens_lista UNION ALL SELECT familia_id,setor FROM public.produtos
 UNION ALL SELECT c.familia_id,i.setor FROM public.compra_itens i JOIN public.compras c ON c.id=i.compra_id
 ) dados WHERE length(btrim(setor)) BETWEEN 1 AND 60 AND lower(btrim(setor))<>'todos'
 ON CONFLICT(familia_id,nome_chave) DO NOTHING;

