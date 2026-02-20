-- ============================================================
-- SETUP COMPLETO DO ZERO: Schema + RLS + Funções + Usuários
-- Execute no SQL Editor do Supabase APÓS o nuclear_reset.sql
-- Senha padrão: ativa2026
-- Data: 2026-02-19
-- ============================================================


-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

ALTER DATABASE postgres SET search_path TO public, extensions;
ALTER ROLE authenticated SET search_path TO public, extensions;
ALTER ROLE service_role SET search_path TO public, extensions;
ALTER ROLE anon SET search_path TO public, extensions;
ALTER ROLE postgres SET search_path TO public, extensions;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;


-- ============================================================
-- 2. TABELAS
-- ============================================================

-- 2.1 PROFILES
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE,
  full_name text,
  role text DEFAULT 'CONSULTOR',
  avatar_url text,
  phone text,
  location text,
  status text DEFAULT 'Ativo',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2.2 PROJECTS
CREATE TABLE public.projects (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text DEFAULT 'bg-blue-100 text-blue-700 border-blue-200',
  client text,
  manager text,
  status text DEFAULT 'Em Andamento',
  deadline date,
  progress integer DEFAULT 0,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2.3 ALLOCATIONS  (1 registro = 1 dia individual)
CREATE TABLE public.allocations (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  consultant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  os text,
  manager text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (consultant_id, date)
);

-- 2.4 PROJECT DAILY LOGS
CREATE TABLE public.project_daily_logs (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_allocation ON public.project_daily_logs(allocation_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON public.project_daily_logs(date);


-- ============================================================
-- 3. FUNÇÃO AUXILIAR is_admin() (SECURITY DEFINER = sem recursão)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADM'
  );
$$;


-- ============================================================
-- 4. RLS + POLICIES
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- PROJECTS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (is_private = false OR public.is_admin());

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (public.is_admin());

-- ALLOCATIONS
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_select" ON public.allocations
  FOR SELECT USING (true);

CREATE POLICY "allocations_insert" ON public.allocations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "allocations_update" ON public.allocations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "allocations_delete" ON public.allocations
  FOR DELETE USING (auth.role() = 'authenticated');

-- DAILY LOGS
ALTER TABLE public.project_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select" ON public.project_daily_logs
  FOR SELECT USING (true);

CREATE POLICY "logs_all" ON public.project_daily_logs
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================
-- 5. PERMISSÕES NAS TABELAS
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;


-- ============================================================
-- 6. TRIGGER: Criar perfil automaticamente ao cadastrar novo usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'CONSULTOR',
    'Ativo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao criar perfil automático: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 7. FUNÇÕES RPC PARA GESTÃO DE CONSULTORES
-- ============================================================

-- 7.1 Criar consultor
CREATE OR REPLACE FUNCTION public.create_consultant(
  p_email text,
  p_full_name text,
  p_role text DEFAULT 'CONSULTOR',
  p_phone text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_password text DEFAULT 'ativa2026'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um usuário com o email: %', p_email;
  END IF;

  v_user_id := extensions.uuid_generate_v4();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, last_sign_in_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id,
    'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_full_name),
    false, now(), now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', v_user_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, full_name, role, phone, location, status, avatar_url, created_at)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_phone, p_location, 'Ativo', upper(substring(p_full_name from 1 for 2)), now());

  RETURN jsonb_build_object('id', v_user_id, 'email', p_email, 'full_name', p_full_name, 'role', p_role, 'phone', p_phone, 'location', p_location, 'status', 'Ativo');
END;
$$;

-- 7.2 Atualizar consultor
CREATE OR REPLACE FUNCTION public.update_consultant(
  p_id uuid,
  p_full_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  UPDATE public.profiles SET
    full_name  = COALESCE(p_full_name, full_name),
    role       = COALESCE(p_role, role),
    phone      = COALESCE(p_phone, phone),
    location   = COALESCE(p_location, location),
    status     = COALESCE(p_status, status),
    avatar_url = CASE WHEN p_full_name IS NOT NULL THEN upper(substring(p_full_name from 1 for 2)) ELSE avatar_url END
  WHERE id = p_id;

  SELECT jsonb_build_object('id', id, 'email', email, 'full_name', full_name, 'role', role, 'phone', phone, 'location', location, 'status', status)
  INTO v_result FROM public.profiles WHERE id = p_id;

  RETURN v_result;
END;
$$;

-- 7.3 Excluir consultor
CREATE OR REPLACE FUNCTION public.delete_consultant(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = p_id;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao deletar: %', SQLERRM;
  RETURN false;
END;
$$;

-- 7.4 Resetar senha
CREATE OR REPLACE FUNCTION public.reset_consultant_password(
  p_id uuid,
  p_new_password text DEFAULT 'ativa2026'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
  WHERE id = p_id;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Permissões nas funções
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_consultant TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_consultant TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_consultant TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_consultant_password TO authenticated;


-- ============================================================
-- 8. CRIAR TODOS OS USUÁRIOS (senha: ativa2026)
-- ============================================================

-- Desabilitar trigger temporariamente para evitar conflito
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DO $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_name text;
  v_role text;
  v_password text := 'ativa2026';
  rec record;
BEGIN
  FOR rec IN (
    VALUES
      ('andreimagagna@gmail.com',               'ANDREI MAGAGNA',                                'ADM'),
      ('andrei@futuree.org',                     'ANDREI MAGAGNA',                                'ADM'),
      ('lucas@ativaconsultoria.net.br',          'LUCAS HENRIQUE SILVA',                          'ADM'),
      ('sirlene@ativaconsultoria.net.br',        'SIRLENE APARECIDA SANTIAGO DE OLIVEIRA',        'CONSULTOR'),
      ('miguel.delfim@ativaconsultoria.net.br',  'MIGUEL STEFANNY TAVARES DELFIM',                'CONSULTOR'),
      ('mayara@ativaconsultoria.net.br',         'MAYARA OHANA GUEDES DA SILVA',                  'CONSULTOR'),
      ('andre@ativaconsultoria.net.br',          'ANDRE JOSE DA SILVA',                           'CONSULTOR')
  )
  LOOP
    v_email := rec.column1;
    v_name  := rec.column2;
    v_role  := rec.column3;
    v_user_id := extensions.uuid_generate_v4();

    -- auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, last_sign_in_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(), '', '', '', '',
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', v_name),
      false, now(), now(), now()
    );

    -- auth.identities
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', v_user_id::text, now(), now(), now()
    );

    -- profiles
    INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url, created_at)
    VALUES (v_user_id, v_email, v_name, v_role, 'Ativo', upper(substring(v_name from 1 for 2)), now());

    RAISE NOTICE 'Criado: % (%)', v_name, v_email;
  END LOOP;
END $$;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 9. VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  p.email,
  p.full_name,
  p.role,
  p.status,
  u.email_confirmed_at IS NOT NULL AS email_ok,
  (SELECT count(*) FROM auth.identities i WHERE i.user_id = u.id) AS identities
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role, p.full_name;
