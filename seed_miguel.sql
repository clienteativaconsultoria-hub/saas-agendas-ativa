-- ============================================================
-- SEED: Agendas do consultor MIGUEL STEFANNY TAVARES DELFIM
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
-- 2. GARANTIR PROJETO (JJM - GUARULHOS já existe dos seeds anteriores)
-- ============================================================
INSERT INTO public.projects (name, client, color, status, manager)
VALUES
  ('JJM - GUARULHOS', 'JJM - GUARULHOS', 'bg-teal-100 text-teal-700 border-teal-200', 'Em Andamento', 'JESUS')
ON CONFLICT (name) DO UPDATE SET
  manager = EXCLUDED.manager,
  client = EXCLUDED.client;

-- ============================================================
-- 3. CRIAR ALOCAÇÕES DO MIGUEL
-- ============================================================
DO $$
DECLARE
  v_id uuid;
  v_proj_id uuid;
  rec record;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = 'miguel.delfim@ativaconsultoria.net.br';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Consultor Miguel não encontrado! Execute o setup_completo.sql primeiro.';
  END IF;

  FOR rec IN (
    VALUES
      -- start_date       dias  projeto              gerente  os
      ('2026-01-05'::date, 5,   'JJM - GUARULHOS',   'JESUS', 'NR OS'),
      ('2026-01-12'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-01-19'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-01-26'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-03-30'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-04-06'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-04-13'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-04-20'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-04-27'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-05-04'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-05-11'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-05-18'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL),
      ('2026-05-25'::date, 5,   'JJM - GUARULHOS',   'JESUS', NULL)
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

    RAISE NOTICE 'Alocação: Miguel | % | % | % dias inseridos', rec.column3, rec.column1, rec.column2;
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
WHERE pr.email = 'miguel.delfim@ativaconsultoria.net.br'
ORDER BY a.date;
