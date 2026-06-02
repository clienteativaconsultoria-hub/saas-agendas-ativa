-- Migração: privacidade dos projetos Particular + escopo do GERENTE
-- Aplicada em produção em 2026-06-02 (via Supabase). Mantida aqui para versionamento.

-- 1) Fecha o vazamento: projetos tipo='Particular' (além de is_private=true) ficam
--    ocultos para não-ADM. O front remapeia as agendas desses projetos para "Particular".
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
  FOR SELECT
  USING (
    is_admin()
    OR (is_private = false AND COALESCE(tipo, '') <> 'Particular')
  );

-- 2) Vincula um GERENTE ao nome dele no campo allocations.manager.
--    Para role=GERENTE: preencher com o nome canônico (match normalizado no front:
--    sem acento + maiúsculas + trim). Null para ADM/CONSULTOR.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_key text;
COMMENT ON COLUMN public.profiles.manager_key IS
  'Para role=GERENTE: nome canônico no campo allocations.manager (match normalizado). Null para ADM/CONSULTOR.';

-- Como ativar um gerente (exemplo):
--   UPDATE public.profiles SET role='GERENTE', manager_key='CAROL' WHERE email='carol@exemplo.com';
