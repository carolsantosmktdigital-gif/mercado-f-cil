CREATE TABLE public.familias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.familia_membros (
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (familia_id, user_id)
);
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  setor text NOT NULL,
  preco_ref numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX produtos_familia_nome ON public.produtos (familia_id, lower(nome));
CREATE TABLE public.itens_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  setor text NOT NULL,
  qtd numeric(10,3) NOT NULL DEFAULT 1,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  comprado boolean NOT NULL DEFAULT false,
  inesperado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  cartao text NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0,
  itens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.familias TO authenticated;
GRANT SELECT ON public.familia_membros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos, public.itens_lista, public.compras TO authenticated;
GRANT ALL ON public.familias, public.familia_membros, public.produtos, public.itens_lista, public.compras TO service_role;

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familia_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_lista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.e_membro(_familia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.familia_membros WHERE familia_id = _familia AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.criar_familia(_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM familia_membros WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Você já participa de uma família'; END IF;
  INSERT INTO familias (nome) VALUES (coalesce(nullif(trim(_nome), ''), 'Minha família')) RETURNING id INTO fid;
  INSERT INTO familia_membros (familia_id, user_id) VALUES (fid, auth.uid());
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.entrar_familia(_codigo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM familia_membros WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'Você já participa de uma família'; END IF;
  SELECT id INTO fid FROM familias WHERE codigo = upper(trim(_codigo));
  IF fid IS NULL THEN RAISE EXCEPTION 'Código não encontrado'; END IF;
  INSERT INTO familia_membros (familia_id, user_id) VALUES (fid, auth.uid());
  RETURN fid;
END $$;

REVOKE EXECUTE ON FUNCTION public.criar_familia(text), public.entrar_familia(text), public.e_membro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_familia(text), public.entrar_familia(text), public.e_membro(uuid) TO authenticated;

CREATE POLICY "membros veem familia" ON public.familias FOR SELECT TO authenticated USING (public.e_membro(id));
CREATE POLICY "membros veem membros" ON public.familia_membros FOR SELECT TO authenticated USING (public.e_membro(familia_id));
CREATE POLICY "familia produtos" ON public.produtos FOR ALL TO authenticated USING (public.e_membro(familia_id)) WITH CHECK (public.e_membro(familia_id));
CREATE POLICY "familia itens" ON public.itens_lista FOR ALL TO authenticated USING (public.e_membro(familia_id)) WITH CHECK (public.e_membro(familia_id));
CREATE POLICY "familia compras" ON public.compras FOR ALL TO authenticated USING (public.e_membro(familia_id)) WITH CHECK (public.e_membro(familia_id));