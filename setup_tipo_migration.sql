-- ============================================================
-- MIGRAÇÃO: Coluna TIPO em Projetos + Normalização de Clientes
-- Data: 2026-02-19 (v4 - corrige name + client)
-- ============================================================

-- 1. Adicionar coluna tipo na tabela de projetos (se ainda não existir)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'MV'
CHECK (tipo IN ('MV', 'Particular'));

-- ============================================================
-- 2. Renomear projetos: "UNIMED ARARAS / ESSELENSE" → "ESSELENSE"
--    e corrigir o client junto
-- ============================================================
UPDATE public.projects
SET 
  name   = 'ESSELENSE',
  client = 'ESSELENSE'
WHERE UPPER(name) LIKE '%ESSELENSE%';

-- ============================================================
-- 3. Renomear projetos: "UNIMED ARARAS / SC RIBEIRAO PRETO" → "SC RIBEIRAO PRETO"
-- ============================================================
UPDATE public.projects
SET 
  name   = 'SC RIBEIRAO PRETO',
  client = 'SC RIBEIRAO PRETO'
WHERE UPPER(name) LIKE '%SC RIBEIRAO PRETO%'
  AND UPPER(name) LIKE '%UNIMED ARARAS%';

-- ============================================================
-- 4. Normalizar projetos com name/client = "ARARAS" → "UNIMED ARARAS"
-- ============================================================
UPDATE public.projects
SET 
  name   = CASE WHEN UPPER(TRIM(name))   = 'ARARAS' THEN 'UNIMED ARARAS' ELSE name   END,
  client = CASE WHEN UPPER(TRIM(client)) = 'ARARAS' THEN 'UNIMED ARARAS' ELSE client END
WHERE UPPER(TRIM(name)) = 'ARARAS' OR UPPER(TRIM(client)) = 'ARARAS';

-- ============================================================
-- 5. Definir o campo TIPO com base no cliente
-- ============================================================
UPDATE public.projects
SET tipo = CASE
  WHEN UPPER(TRIM(client)) IN ('UNIMED ARARAS', 'ESSELENSE', 'SC RIBEIRAO PRETO')
    THEN 'Particular'
  ELSE 'MV'
END;

-- ============================================================
-- 6. Verificação final
-- ============================================================
SELECT tipo, client, name
FROM public.projects
ORDER BY tipo, client, name;


