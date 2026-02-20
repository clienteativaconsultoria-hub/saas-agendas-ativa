-- ============================================================
-- MIGRAÇÃO: Alocações → Datas Individuais (1 linha por dia)
-- Execute no SQL Editor do Supabase
-- Data: 2026-02-19
-- ============================================================
-- ANTES:  allocations(start_date date, days integer)
-- DEPOIS: allocations(date date)  ← 1 linha por dia
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- PASSO 1: Adicionar coluna `date` (data individual do dia)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS date date;

-- ─────────────────────────────────────────────────────────
-- PASSO 2: Preencher `date` = start_date nas linhas atuais
--          (cada linha existente vira o 1º dia do bloco)
-- ─────────────────────────────────────────────────────────
UPDATE public.allocations
SET date = start_date
WHERE date IS NULL;

-- ─────────────────────────────────────────────────────────
-- PASSO 2b: Remover NOT NULL de start_date para que o INSERT
--           de expansão não precise fornecer esse campo
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.allocations
  ALTER COLUMN start_date DROP NOT NULL;

-- ─────────────────────────────────────────────────────────
-- PASSO 3: Expandir alocações multi-dia
--          Para cada linha com days > 1, inserir dias 2..n
--          as novas linhas com UUIDs próprios
-- ─────────────────────────────────────────────────────────
INSERT INTO public.allocations (consultant_id, project_id, date, os, manager, created_at)
SELECT
  a.consultant_id,
  a.project_id,
  (a.start_date + gs.n)::date AS date,
  a.os,
  a.manager,
  a.created_at
FROM public.allocations a
CROSS JOIN generate_series(1, GREATEST(a.days - 1, 0)) AS gs(n)
WHERE a.days > 1
ON CONFLICT DO NOTHING;  -- ignora se já existir algum dia duplicado

-- ─────────────────────────────────────────────────────────
-- PASSO 4: Redirecionar project_daily_logs para o registro
--          individual correto (por consultant_id + date)
-- ─────────────────────────────────────────────────────────
UPDATE public.project_daily_logs pl
SET allocation_id = new_a.id
FROM public.project_daily_logs pl2
JOIN public.allocations old_a ON old_a.id = pl2.allocation_id
JOIN public.allocations new_a ON (
  new_a.consultant_id = old_a.consultant_id
  AND new_a.project_id = old_a.project_id
  AND new_a.date = pl2.date
)
WHERE pl.id = pl2.id
  AND new_a.id <> pl2.allocation_id;

-- ─────────────────────────────────────────────────────────
-- PASSO 5: Tornar `date` NOT NULL após preenchimento
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.allocations
  ALTER COLUMN date SET NOT NULL;

-- ─────────────────────────────────────────────────────────
-- PASSO 6: Remover colunas antigas
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.allocations DROP COLUMN IF EXISTS start_date;
ALTER TABLE public.allocations DROP COLUMN IF EXISTS days;

-- ─────────────────────────────────────────────────────────
-- PASSO 7: Adicionar constraint UNIQUE (1 projeto/consultor/dia)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_consultant_date_unique
  UNIQUE (consultant_id, date);

-- ─────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL
-- ─────────────────────────────────────────────────────────
SELECT
  pr.full_name AS consultor,
  p.name       AS projeto,
  a.date,
  a.os,
  a.manager
FROM public.allocations a
JOIN public.profiles pr ON pr.id = a.consultant_id
JOIN public.projects  p  ON p.id  = a.project_id
ORDER BY pr.full_name, a.date;

COMMIT;
