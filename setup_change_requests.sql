-- ============================================================
-- TABELA: change_requests (Solicitações de Alteração de Agenda)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.change_requests (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_type text NOT NULL DEFAULT 'change',
  -- request_type: 'change' (alterar), 'cancel' (cancelar), 'reschedule' (reagendar)
  
  reason text NOT NULL,
  
  -- Campos opcionais com a sugestão de mudança
  suggested_start_date date,
  suggested_days integer,
  suggested_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  
  status text NOT NULL DEFAULT 'pending',
  -- status: 'pending', 'approved', 'rejected'
  
  admin_response text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_change_requests_allocation ON public.change_requests(allocation_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON public.change_requests(requester_id);

-- RLS
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Admins podem ver tudo
CREATE POLICY "Admins full access change_requests"
  ON public.change_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Consultores podem ver e criar as próprias solicitações
CREATE POLICY "Users can view own change_requests"
  ON public.change_requests FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "Users can insert own change_requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());
