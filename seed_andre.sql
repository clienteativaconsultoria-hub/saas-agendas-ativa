-- ============================================================
-- SEED: Agendas do consultor ANDRÉ JOSE DA SILVA
-- Projetos + Alocações semanais
-- Execute no SQL Editor do Supabase APÓS o setup_completo.sql
-- ============================================================

-- ============================================================
-- 1. GARANTIR COLUNA MANAGER NA TABELA PROJECTS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='manager') THEN
        ALTER TABLE public.projects ADD COLUMN manager text;
    END IF;
END $$;

-- Garantir constraint UNIQUE no nome (para ON CONFLICT funcionar)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_name_key') THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_name_key UNIQUE (name);
    END IF;
END $$;

-- ============================================================
-- 2. CRIAR PROJETOS/CLIENTES (se não existirem)
-- ============================================================

-- Cores distintas para cada projeto
INSERT INTO public.projects (name, client, color, status, manager)
VALUES
  ('THE ONE - BRASILIA',         'THE ONE - BRASILIA',         'bg-purple-100 text-purple-700 border-purple-200',  'Em Andamento', 'ROSE'),
  ('ARARAS',                     'ARARAS',                     'bg-amber-100 text-amber-700 border-amber-200',     'Em Andamento', 'PARTICULAR'),
  ('SANTA SAUDE',                'SANTA SAUDE',                'bg-emerald-100 text-emerald-700 border-emerald-200','Em Andamento', 'NATALIA'),
  ('CENTRO DE CEREBRO E COLUNA', 'CENTRO DE CEREBRO E COLUNA', 'bg-blue-100 text-blue-700 border-blue-200',        'Em Andamento', 'ROSE')
ON CONFLICT (name) DO UPDATE SET
  manager = EXCLUDED.manager,
  client = EXCLUDED.client;

-- ============================================================
-- 3. CRIAR ALOCAÇÕES DO ANDRÉ
-- ============================================================

DO $$
DECLARE
  v_andre_id uuid;
  v_project_id uuid;
  rec record;
BEGIN
  -- Buscar ID do André
  SELECT id INTO v_andre_id FROM public.profiles WHERE email = 'andre@ativaconsultoria.net.br';

  IF v_andre_id IS NULL THEN
    RAISE EXCEPTION 'Consultor André não encontrado! Execute o setup_completo.sql primeiro.';
  END IF;

  -- Loop de alocações (apenas semanas com projetos reais)
  FOR rec IN (
    VALUES
      -- PERÍODO                  PROJETO                          GERENTE       OS         DIAS
      ('2026-01-05'::date, 5,    'THE ONE - BRASILIA',            'ROSE',       'NR OS'),
      ('2026-01-12'::date, 5,    'THE ONE - BRASILIA',            'ROSE',       NULL),
      ('2026-01-19'::date, 3,    'ARARAS',                        'PARTICULAR', '3 DIAS'),
      ('2026-01-26'::date, 5,    'ARARAS',                        'PARTICULAR', '5 DIAS'),
      ('2026-02-02'::date, 5,    'SANTA SAUDE',                   'NATALIA',    NULL),
      ('2026-02-09'::date, 5,    'CENTRO DE CEREBRO E COLUNA',    'ROSE',       NULL),
      ('2026-02-16'::date, 5,    'ARARAS',                        'PARTICULAR', NULL),
      ('2026-02-23'::date, 5,    'CENTRO DE CEREBRO E COLUNA',    'ROSE',       NULL),
      ('2026-03-02'::date, 5,    'CENTRO DE CEREBRO E COLUNA',    'ROSE',       NULL)
  )
  LOOP
    -- Buscar o projeto pelo nome
    SELECT id INTO v_project_id FROM public.projects WHERE name = rec.column3;

    IF v_project_id IS NULL THEN
      RAISE WARNING 'Projeto "%" não encontrado, pulando...', rec.column3;
      CONTINUE;
    END IF;

    -- Inserir 1 linha por dia (new schema: date individual)
    INSERT INTO public.allocations (consultant_id, project_id, date, manager, os)
    SELECT v_andre_id, v_project_id, (rec.column1 + gs.n)::date, rec.column4, rec.column5
    FROM generate_series(0, rec.column2 - 1) AS gs(n)
    ON CONFLICT (consultant_id, date) DO NOTHING;

    RAISE NOTICE 'Alocação: André | % | % | % dias inseridos', rec.column3, rec.column1, rec.column2;
  END LOOP;
END $$;

-- ============================================================
-- 4. VERIFICAÇÃO
-- ============================================================

-- Projetos criados
SELECT name, client, status, manager, color FROM public.projects ORDER BY name;

-- Alocações do André (datas individuais)
SELECT
  a.date   AS dia,
  p.name   AS projeto,
  a.manager AS gerente,
  a.os
FROM public.allocations a
JOIN public.projects p ON p.id = a.project_id
JOIN public.profiles pr ON pr.id = a.consultant_id
WHERE pr.email = 'andre@ativaconsultoria.net.br'
ORDER BY a.date;
