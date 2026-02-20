-- ============================================================
-- SEED: Agendas da consultora MAYARA OHANA GUEDES DA SILVA
-- Projetos + Alocações semanais
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. GARANTIR ESTRUTURA
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='manager') THEN
        ALTER TABLE public.projects ADD COLUMN manager text;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_name_key') THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_name_key UNIQUE (name);
    END IF;
END $$;

-- ============================================================
-- 2. CRIAR PROJETOS/CLIENTES
-- ============================================================
INSERT INTO public.projects (name, client, color, status, manager)
VALUES
  ('UNIPASA - RJ',           'UNIPASA - RJ',           'bg-violet-100 text-violet-700 border-violet-200', 'Em Andamento', 'JULIANA'),
  ('SANTA MARCELINA',        'SANTA MARCELINA',        'bg-rose-100 text-rose-700 border-rose-200',       'Em Andamento', 'NATALIA'),
  ('SC BRAGANÇA PAULISTA',   'SC BRAGANÇA PAULISTA',   'bg-cyan-100 text-cyan-700 border-cyan-200',       'Em Andamento', 'ANDREIA')
ON CONFLICT (name) DO UPDATE SET
  manager = EXCLUDED.manager,
  client = EXCLUDED.client;

-- SC MOGI DAS CRUZES já existe do seed_sirlene

-- ============================================================
-- 3. CRIAR ALOCAÇÕES DA MAYARA
-- ============================================================
DO $$
DECLARE
  v_id uuid;
  v_proj_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = 'mayara@ativaconsultoria.net.br';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Consultora Mayara não encontrada! Execute o setup_completo.sql primeiro.';
  END IF;

  FOR rec IN (
    VALUES
      -- start_date       dias  projeto                   gerente    os
      ('2026-01-05'::date, 5,   'UNIPASA - RJ',           'JULIANA', 'NR OS'),
      ('2026-01-12'::date, 5,   'SC MOGI DAS CRUZES',     'NATALIA', NULL),
      ('2026-01-19'::date, 5,   'SC MOGI DAS CRUZES',     'NATALIA', NULL),
      ('2026-01-26'::date, 5,   'UNIPASA - RJ',           'JULIANA', NULL),
      ('2026-02-09'::date, 5,   'SANTA MARCELINA',        'NATALIA', NULL),
      ('2026-02-16'::date, 5,   'SANTA MARCELINA',        'NATALIA', NULL),
      ('2026-02-23'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-03-02'::date, 5,   'SANTA MARCELINA',        'NATALIA', NULL),
      ('2026-03-30'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-06-29'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-08-03'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-08-24'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-08-31'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-09-07'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL),
      ('2026-09-14'::date, 5,   'SC BRAGANÇA PAULISTA',   'ANDREIA', NULL)
  )
  LOOP
    SELECT id INTO v_proj_id FROM public.projects WHERE name = rec.column3;
    IF v_proj_id IS NULL THEN
      RAISE WARNING 'Projeto "%" não encontrado, pulando...', rec.column3;
      CONTINUE;
    END IF;

    INSERT INTO public.allocations (consultant_id, project_id, date, manager, os)
    SELECT v_id, v_proj_id, (rec.column1 + gs.n)::date, rec.column4, rec.column5
    FROM generate_series(0, rec.column2 - 1) AS gs(n)
    ON CONFLICT (consultant_id, date) DO NOTHING;

    RAISE NOTICE 'Alocação: Mayara | % | % | % dias inseridos', rec.column3, rec.column1, rec.column2;
  END LOOP;
END $$;

-- ============================================================
-- 4. VERIFICAÇÃO
-- ============================================================
SELECT
  a.date   AS dia,
  p.name   AS projeto,
  a.manager AS gerente,
  a.os
FROM public.allocations a
JOIN public.projects p ON p.id = a.project_id
JOIN public.profiles pr ON pr.id = a.consultant_id
WHERE pr.email = 'mayara@ativaconsultoria.net.br'
ORDER BY a.date;
