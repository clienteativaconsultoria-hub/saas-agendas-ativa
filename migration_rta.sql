-- ============================================================
-- RTA — RELATÓRIO TÉCNICO DE ATENDIMENTO (FR.IC.SP.01)
-- O relatório que o consultor entrega e o cliente assina no fim
-- da alocação. As atividades (seção VI) saem do diário de bordo;
-- o resto do formulário fica guardado aqui.
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rta_reports (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,

  consultant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,

  -- I - IDENTIFICAÇÃO DO CLIENTE
  client_name      text NOT NULL,
  allocation_number text,
  city             text,
  state            text,

  -- II - PERÍODO PLANEJADO
  start_date date NOT NULL,
  end_date   date NOT NULL,

  -- III - TIPO DE ATENDIMENTO (marcados; o texto é a própria opção)
  service_types text[] NOT NULL DEFAULT '{}',

  -- IV / V
  expectation text,
  workload    text,

  -- VI - atividades por data: [{"date":"2026-06-29","description":"..."}]
  -- Copiadas do diário de bordo no momento em que o RTA é gerado, e
  -- editáveis depois: o relatório assinado não pode mudar sozinho quando
  -- alguém corrige o diário meses depois.
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- VII - [{"task":"...","owner":"...","deadline":"..."}]
  pendencies jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- VIII - [{"description":"...","consultant":"...","client":"..."}]
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- IX - VALIDAÇÃO (quem assina além do consultor)
  manager_area     text,
  manager_it       text,
  manager_projects text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT rta_period_ok CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rta_consultant ON public.rta_reports(consultant_id);
CREATE INDEX IF NOT EXISTS idx_rta_project    ON public.rta_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_rta_period     ON public.rta_reports(start_date, end_date);


-- ============================================================
-- RLS
-- ADM: tudo. CONSULTOR: só os RTAs dele. GERENTE: sem acesso —
-- o RTA é entregue ao cliente, não é documento de gestão interna.
-- ============================================================
ALTER TABLE public.rta_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rta_select" ON public.rta_reports;
CREATE POLICY "rta_select" ON public.rta_reports
  FOR SELECT TO authenticated
  USING (consultant_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "rta_insert" ON public.rta_reports;
CREATE POLICY "rta_insert" ON public.rta_reports
  FOR INSERT TO authenticated
  WITH CHECK (consultant_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "rta_update" ON public.rta_reports;
CREATE POLICY "rta_update" ON public.rta_reports
  FOR UPDATE TO authenticated
  USING (consultant_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (consultant_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "rta_delete" ON public.rta_reports;
CREATE POLICY "rta_delete" ON public.rta_reports
  FOR DELETE TO authenticated
  USING (consultant_id = (SELECT auth.uid()) OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rta_reports TO authenticated;


-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'rta_reports' ORDER BY ordinal_position;
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'rta_reports';
