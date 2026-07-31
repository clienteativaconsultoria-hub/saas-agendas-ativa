-- ============================================================
-- PRESTAÇÃO DE CONTAS (expense_reports)
-- Pedido do Lucas na reunião de 16/06/2026:
--   "só queria que ele colocasse a data da prestação de contas e o valor"
--   "coloco um filtro de prestações pendentes, digito 745 e vejo quem é o
--    consultor e qual a data; aí eu pago ele e dou baixa"
-- Fase 1 = MV. Fase 2 = particulares da Ativa (mesmo modelo, campo kind).
-- Execute no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expense_reports (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,

  consultant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  -- Projeto é opcional: preenchido automaticamente pela agenda do dia quando existe.
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,

  reference_date date NOT NULL,          -- a data da prestação de contas
  amount numeric(12,2) NOT NULL CHECK (amount > 0),

  kind text NOT NULL DEFAULT 'MV' CHECK (kind IN ('MV', 'Particular')),
  notes text,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_consultant ON public.expense_reports(consultant_id);
CREATE INDEX IF NOT EXISTS idx_expense_status     ON public.expense_reports(status);
CREATE INDEX IF NOT EXISTS idx_expense_date       ON public.expense_reports(reference_date);
-- Busca por valor ("caiu 745 na conta"): índice ajuda o filtro de pendentes por valor.
CREATE INDEX IF NOT EXISTS idx_expense_amount     ON public.expense_reports(amount);


-- ============================================================
-- RLS
-- ADM (Lucas/Andrei): enxerga e mexe em tudo.
-- CONSULTOR: enxerga e lança as suas; só edita/apaga enquanto está pendente
--            (depois de paga, o registro vira histórico financeiro).
-- GERENTE: sem acesso — prestação de contas é assunto do administrativo.
-- ============================================================
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_reports_select" ON public.expense_reports;
CREATE POLICY "expense_reports_select" ON public.expense_reports
  FOR SELECT TO authenticated
  USING (consultant_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "expense_reports_insert" ON public.expense_reports;
CREATE POLICY "expense_reports_insert" ON public.expense_reports
  FOR INSERT TO authenticated
  WITH CHECK (consultant_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "expense_reports_update" ON public.expense_reports;
CREATE POLICY "expense_reports_update" ON public.expense_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (consultant_id = (SELECT auth.uid()) AND status = 'pending'))
  WITH CHECK (public.is_admin() OR (consultant_id = (SELECT auth.uid()) AND status = 'pending'));

DROP POLICY IF EXISTS "expense_reports_delete" ON public.expense_reports;
CREATE POLICY "expense_reports_delete" ON public.expense_reports
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (consultant_id = (SELECT auth.uid()) AND status = 'pending'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO authenticated;


-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'expense_reports' ORDER BY ordinal_position;
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'expense_reports';
