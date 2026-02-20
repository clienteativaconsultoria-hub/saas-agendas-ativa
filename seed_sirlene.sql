-- ============================================================
-- SEED: Agendas da consultora SIRLENE APARECIDA SANTIAGO DE OLIVEIRA
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
  ('SC MOGI DAS CRUZES',  'SC MOGI DAS CRUZES',  'bg-pink-100 text-pink-700 border-pink-200',      'Em Andamento', 'NATALIA'),
  ('SC SÃO CARLOS',       'SC SÃO CARLOS',       'bg-indigo-100 text-indigo-700 border-indigo-200', 'Em Andamento', 'CAROL'),
  ('BARRETOS',             'BARRETOS',             'bg-red-100 text-red-700 border-red-200',          'Em Andamento', 'CAROL'),
  ('JJM - GUARULHOS',     'JJM - GUARULHOS',     'bg-teal-100 text-teal-700 border-teal-200',       'Em Andamento', 'JESUS'),
  ('BAURU',                'BAURU',                'bg-orange-100 text-orange-700 border-orange-200', 'Em Andamento', 'CAROL')
ON CONFLICT (name) DO UPDATE SET
  manager = EXCLUDED.manager,
  client = EXCLUDED.client;

-- ============================================================
-- 3. CRIAR ALOCAÇÕES DA SIRLENE
-- ============================================================
DO $$
DECLARE
  v_id uuid;
  v_proj_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = 'sirlene@ativaconsultoria.net.br';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Consultora Sirlene não encontrada! Execute o setup_completo.sql primeiro.';
  END IF;

  FOR rec IN (
    VALUES
      -- start_date       dias  projeto                  gerente    os
      ('2026-01-05'::date, 5,   'SC MOGI DAS CRUZES',    'NATALIA', NULL),
      ('2026-01-19'::date, 5,   'SC SÃO CARLOS',         'CAROL',   NULL),
      ('2026-02-09'::date, 5,   'BARRETOS',              'CAROL',   NULL),
      ('2026-02-16'::date, 5,   'BARRETOS',              'CAROL',   '*era Natalia'),
      ('2026-02-23'::date, 5,   'BARRETOS',              'CAROL',   NULL),
      ('2026-03-02'::date, 5,   'BARRETOS',              'CAROL',   NULL),
      ('2026-03-09'::date, 5,   'BARRETOS',              'CAROL',   NULL),
      ('2026-03-16'::date, 5,   'JJM - GUARULHOS',       'JESUS',   '*Aguardando retorno'),
      ('2026-03-23'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-04-06'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-04-13'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-04-20'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-04-27'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-05-04'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-05-11'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-05-18'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-05-25'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-06-01'::date, 5,   'JJM - GUARULHOS',       'JESUS',   NULL),
      ('2026-06-08'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-06-15'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-06-22'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-07-06'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-07-13'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-07-20'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-07-27'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-08-10'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-08-17'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-09-21'::date, 5,   'BAURU',                 'CAROL',   NULL),
      ('2026-09-28'::date, 5,   'BAURU',                 'CAROL',   NULL)
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

    RAISE NOTICE 'Alocação: Sirlene | % | % | % dias inseridos', rec.column3, rec.column1, rec.column2;
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
WHERE pr.email = 'sirlene@ativaconsultoria.net.br'
ORDER BY a.date;
