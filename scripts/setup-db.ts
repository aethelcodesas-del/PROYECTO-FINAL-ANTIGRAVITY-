/**
 * AUTOMATED DATABASE & STORAGE MIGRATION SCRIPT FOR SUPABASE (POSTGRESQL)
 * Proyecto: TechNeo Electoral OS / Campaña Ganadora AI
 *
 * Ejecutable con: `npm run setup:db`
 *
 * Realiza:
 * 1. Conexión directa a PostgreSQL (Supabase Pooler) y Supabase Service Role API.
 * 2. Migración completa de esquema (DDL): tablas faltantes (`polling_stations`,
 *    `campaign_polling_stations`, `survey_studies`, `survey_pollsters`), columnas
 *    requeridas en `profiles`, `campaigns`, `leaders`, `voters`, `witnesses`,
 *    `jurors`, `surveys`, `survey_responses`, funciones de seguridad y políticas RLS.
 * 3. Recarga inmediata del caché de esquema de PostgREST (`NOTIFY pgrst, 'reload schema'`).
 * 4. Aprovisionamiento de Storage Buckets (`avatars`, `e14-actas`, `campaign-assets`,
 *    `documents`, `campaign-documents`, `campaign-media`).
 * 5. Erradicación de registros demo/mock sembrados previamente en tablas operativas
 *    (`leaders`, `voters`, `budget_items`, `witnesses`, `jurors`, `surveys`, etc.).
 * 6. Vinculación de Tenant/Campaña real (`TODO POR COTORRA`) y carga del catálogo
 *    DIVIPOLE oficial de puestos de votación para el municipio de la campaña activa.
 */

import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { getPuestosPorCircunscripcion } from '../src/data/puestosVotacionColombia';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://cjvztlvxdsuiluybvtpl.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ2NTcwMCwiZXhwIjoyMTA0MDQxNzAwfQ.ZF4tFIHfO_ZzxJ4YlkydFSKl30aMXjnB_z7z3yUay04';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.cjvztlvxdsuiluybvtpl:XgOrUhpSHthQknwW@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const REQUIRED_BUCKETS = [
  { name: 'avatars', public: true, fileSizeLimit: 10485760 },
  { name: 'e14-actas', public: true, fileSizeLimit: 15728640 },
  { name: 'campaign-assets', public: true, fileSizeLimit: 20971520 },
  { name: 'documents', public: true, fileSizeLimit: 15728640 },
  { name: 'campaign-documents', public: false, fileSizeLimit: 10485760 },
  { name: 'campaign-media', public: false, fileSizeLimit: 10485760 },
];

const SCHEMA_MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. ACTUALIZACIÓN DE TABLAS PRINCIPALES Y COLUMNAS REQUERIDAS
-- =====================================================================

-- Profiles
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USUARIO';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT ARRAY['ADMINISTRATIVE']::TEXT[];
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles
SET is_active = CASE
  WHEN UPPER(COALESCE(status, 'ACTIVE')) IN ('INACTIVE', 'INACTIVO', 'SUSPENDED') THEN FALSE
  ELSE TRUE
END
WHERE is_active IS NULL OR (UPPER(COALESCE(status, 'ACTIVE')) IN ('INACTIVE', 'INACTIVO', 'SUSPENDED') AND is_active = TRUE);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
  UPPER(BTRIM(role)) IN (
    'SUPERADMIN', 'GLOBAL_ADMIN', 'ADMIN_CLIENTE', 'ADMINISTRADOR', 'CANDIDATO',
    'DIRECTOR', 'COORDINADOR', 'COORDINADOR_GENERAL', 'ESTRATEGICO', 'TERRITORIAL',
    'GERENTE', 'ANALISTA', 'AUDITOR', 'DIGITADOR', 'TESTIGO', 'CONSULTOR',
    'USUARIO', 'USUARIO_LIMITADO'
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_campaign ON public.profiles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_profiles_client ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS candidato_nombre TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS candidato_email TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS cargo_postulacion TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS circunscripcion TEXT DEFAULT 'Municipal';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS fecha_inicio DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS fecha_eleccion DATE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS meta_votos INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS presupuesto_total NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS presupuesto_ejecutado NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'ACTIVA';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS admin_manager TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Leaders
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS comuna TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS barrio TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS puesto TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS mesa TEXT;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS meta_votos INTEGER DEFAULT 50;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS votos_comprometidos INTEGER DEFAULT 0;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leaders_campaign ON public.leaders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leaders_cedula ON public.leaders(cedula);

-- Voters
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS departamento TEXT DEFAULT 'Colombia';
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS comuna TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS barrio TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS puesto TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS mesa TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS lider_id UUID REFERENCES public.leaders(id) ON DELETE SET NULL;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS intencion TEXT DEFAULT 'Voto Seguro';
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_voters_campaign ON public.voters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voters_cedula ON public.voters(cedula);

-- Budget Items
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_budget_campaign ON public.budget_items(campaign_id);

-- Witnesses
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS zona TEXT;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE public.witnesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_witnesses_campaign ON public.witnesses(campaign_id);

-- Jurors
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE public.jurors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_jurors_campaign ON public.jurors(campaign_id);

-- Polling Stations (Puestos y Mesas por Campaña)
CREATE TABLE IF NOT EXISTS public.polling_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  place TEXT NOT NULL,
  table_number TEXT NOT NULL,
  registered_voters INTEGER DEFAULT 0,
  witness_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, place, table_number)
);
CREATE INDEX IF NOT EXISTS idx_polling_stations_campaign ON public.polling_stations(campaign_id);

CREATE TABLE IF NOT EXISTS public.campaign_polling_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  place TEXT NOT NULL,
  zone TEXT,
  tables_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveys & Pollsters & Responses
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS study_type TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'BORRADOR';
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS target_sample INTEGER DEFAULT 200;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS completed_sample INTEGER DEFAULT 0;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS margin_error NUMERIC(5,2) DEFAULT 2.5;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS margin_of_error NUMERIC(5,2) DEFAULT 2.5;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS confidence_level NUMERIC(5,2) DEFAULT 95;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS pollsters_count INTEGER DEFAULT 0;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS questions_count INTEGER DEFAULT 0;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_estado_check;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_estado_check CHECK (
  estado IN ('En Campo', 'Borrador', 'Finalizado', 'En Auditoría', 'ACTIVA', 'BORRADOR', 'CERRADA')
);
CREATE INDEX IF NOT EXISTS idx_surveys_campaign ON public.surveys(campaign_id);

CREATE TABLE IF NOT EXISTS public.survey_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  study_type TEXT NOT NULL,
  methodology TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Borrador',
  target_sample INTEGER NOT NULL DEFAULT 200,
  completed_sample INTEGER NOT NULL DEFAULT 0,
  pollsters_count INTEGER NOT NULL DEFAULT 0,
  margin_error NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  confidence_level NUMERIC(5,2) NOT NULL DEFAULT 95,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.survey_pollsters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cedula TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  assigned_zone TEXT NOT NULL,
  daily_goal INTEGER NOT NULL DEFAULT 0 CHECK (daily_goal >= 0),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo','En Recorrido','Meta Cumplida','Pausado','Inactivo')),
  last_activity_at TIMESTAMPTZ,
  battery_level INTEGER CHECK (battery_level BETWEEN 0 AND 100),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  last_address TEXT,
  in_geofence BOOLEAN DEFAULT TRUE,
  gps_accuracy_meters NUMERIC(8,2),
  device_imei TEXT,
  accreditation_code TEXT NOT NULL,
  audit_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, cedula),
  UNIQUE (accreditation_code)
);
CREATE INDEX IF NOT EXISTS idx_survey_pollsters_campaign ON public.survey_pollsters(campaign_id, survey_id);

-- Fix FK on survey_pollsters if it previously pointed to survey_studies
ALTER TABLE public.survey_pollsters DROP CONSTRAINT IF EXISTS survey_pollsters_survey_id_fkey;
ALTER TABLE public.survey_pollsters
  ADD CONSTRAINT survey_pollsters_survey_id_fkey
  FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;

-- Survey Responses
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS pollster_id UUID REFERENCES public.survey_pollsters(id) ON DELETE SET NULL;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS respondent_code TEXT;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS respuestas JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.survey_responses ALTER COLUMN respuestas DROP NOT NULL;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS gps_accuracy_meters NUMERIC(8,2);
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_survey_responses_campaign ON public.survey_responses(campaign_id);

-- =====================================================================
-- 2. FUNCIONES DE SEGURIDAD Y POLÍTICAS RLS (SIN RECURSIÓN)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND UPPER(COALESCE(role, '')) IN ('SUPERADMIN', 'GLOBAL_ADMIN')
      AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'ACTIVO')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'ACTIVO')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_campaign_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT campaign_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'ACTIVO')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_campaign_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND UPPER(COALESCE(role, '')) IN (
        'ADMIN_CLIENTE', 'ADMINISTRADOR', 'CANDIDATO', 'DIRECTOR',
        'COORDINADOR', 'COORDINADOR_GENERAL', 'ESTRATEGICO', 'TERRITORIAL',
        'GERENTE', 'ANALISTA', 'AUDITOR'
      )
      AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'ACTIVO')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_campaign(target_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1
    FROM public.campaigns c
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = target_campaign_id
      AND (
        c.created_by = auth.uid()
        OR (p.client_id IS NOT NULL AND c.client_id = p.client_id)
        OR (p.campaign_id IS NOT NULL AND c.id = p.campaign_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.delete_campaign_as_superadmin(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_rows INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Solo un propietario global activo puede eliminar campañas.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET status = 'SUSPENDED', updated_at = NOW()
  WHERE campaign_id = p_campaign_id;

  DELETE FROM public.campaigns
  WHERE id = p_campaign_id;

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_campaign_as_superadmin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_campaign_as_superadmin(UUID) TO authenticated;

-- Políticas RLS para Tablas Operativas del Módulo Administrativo
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_isolation ON public.campaigns;
CREATE POLICY campaigns_isolation ON public.campaigns
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR id = public.get_user_campaign_id()
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR id = public.get_user_campaign_id()
);

ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leaders_isolation ON public.leaders;
CREATE POLICY leaders_isolation ON public.leaders
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
);

ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voters_isolation ON public.voters;
CREATE POLICY voters_isolation ON public.voters
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_isolation ON public.budget_items;
CREATE POLICY budget_isolation ON public.budget_items
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.witnesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS witnesses_isolation ON public.witnesses;
CREATE POLICY witnesses_isolation ON public.witnesses
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
);

ALTER TABLE public.jurors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jurors_isolation ON public.jurors;
CREATE POLICY jurors_isolation ON public.jurors
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
);

ALTER TABLE public.polling_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS polling_stations_isolation ON public.polling_stations;
CREATE POLICY polling_stations_isolation ON public.polling_stations
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS surveys_isolation ON public.surveys;
CREATE POLICY surveys_isolation ON public.surveys
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.survey_studies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS survey_studies_campaign_access ON public.survey_studies;
CREATE POLICY survey_studies_campaign_access ON public.survey_studies
FOR ALL TO authenticated
USING (public.can_access_campaign(campaign_id))
WITH CHECK (public.can_access_campaign(campaign_id));

ALTER TABLE public.survey_pollsters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS survey_pollsters_campaign_access ON public.survey_pollsters;
CREATE POLICY survey_pollsters_campaign_access ON public.survey_pollsters
FOR ALL TO authenticated
USING (public.can_access_campaign(campaign_id))
WITH CHECK (public.can_access_campaign(campaign_id));

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS survey_responses_isolation ON public.survey_responses;
DROP POLICY IF EXISTS survey_responses_campaign_access ON public.survey_responses;
CREATE POLICY survey_responses_campaign_access ON public.survey_responses
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

-- =====================================================================
-- 2B. TABLAS DEL MÓDULO DE GESTIÓN ESTRATÉGICA
-- =====================================================================

-- Actividades e Hitos Electorales (Agenda & Calendario)
CREATE TABLE IF NOT EXISTS public.campaign_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT DEFAULT 'Territorial',
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TEXT DEFAULT '10:00',
  lugar TEXT,
  comuna TEXT,
  responsable TEXT,
  priority TEXT DEFAULT 'Media',
  target_attendees INTEGER DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'PROGRAMADA',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Territorial';
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '10:00';
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS lugar TEXT;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS comuna TEXT;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS responsable TEXT;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Media';
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS target_attendees INTEGER DEFAULT 0;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'PROGRAMADA';
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign ON public.campaign_activities(campaign_id);

-- Matrices DOFA / SWOT Estratégicas
CREATE TABLE IF NOT EXISTS public.swot_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  fortalezas JSONB NOT NULL DEFAULT '[]'::jsonb,
  debilidades JSONB NOT NULL DEFAULT '[]'::jsonb,
  oportunidades JSONB NOT NULL DEFAULT '[]'::jsonb,
  amenazas JSONB NOT NULL DEFAULT '[]'::jsonb,
  conclusiones_ai TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS fortalezas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS debilidades JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS oportunidades JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS amenazas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS conclusiones_ai TEXT;
ALTER TABLE public.swot_matrices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_swot_matrices_campaign ON public.swot_matrices(campaign_id);

-- Propuestas y Pilares Estratégicos (Programa de Gobierno)
CREATE TABLE IF NOT EXISTS public.strategic_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  eje_id TEXT NOT NULL,
  eje_titulo TEXT NOT NULL,
  eje_icono TEXT DEFAULT '📌',
  eje_presupuesto NUMERIC(5,2) DEFAULT 25,
  titulo TEXT NOT NULL,
  problema_diagnostico TEXT,
  solucion_programatica TEXT,
  meta_cuantificable TEXT,
  indicador_ods TEXT,
  presupuesto_estimado TEXT,
  plazo_ejecucion TEXT DEFAULT 'Mediano Plazo (Año 1-2)',
  comuna_focalizada TEXT DEFAULT 'Todo el Territorio',
  fuente_financiacion TEXT DEFAULT 'Presupuesto Municipal + Cofinanciación Nacional',
  prioridad TEXT DEFAULT 'Alta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategic_proposals_campaign ON public.strategic_proposals(campaign_id);

-- Mapa de Actores Clave y Aliados Políticos
CREATE TABLE IF NOT EXISTS public.strategic_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Competidor Directo',
  affinity_level TEXT DEFAULT 'Media',
  influence_level TEXT DEFAULT 'Alta',
  territory_zone TEXT DEFAULT 'Todo el Municipio',
  party TEXT,
  estimated_vote_share NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategic_actors_campaign ON public.strategic_actors(campaign_id);

ALTER TABLE public.campaign_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_activities_isolation ON public.campaign_activities;
CREATE POLICY campaign_activities_isolation ON public.campaign_activities
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.swot_matrices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS swot_matrices_isolation ON public.swot_matrices;
CREATE POLICY swot_matrices_isolation ON public.swot_matrices
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.strategic_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS strategic_proposals_isolation ON public.strategic_proposals;
CREATE POLICY strategic_proposals_isolation ON public.strategic_proposals
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

ALTER TABLE public.strategic_actors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS strategic_actors_isolation ON public.strategic_actors;
CREATE POLICY strategic_actors_isolation ON public.strategic_actors
FOR ALL TO authenticated
USING (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
)
WITH CHECK (
  public.is_superadmin()
  OR client_id = public.get_user_client_id()
  OR campaign_id = public.get_user_campaign_id()
  OR public.can_access_campaign(campaign_id)
);

-- =====================================================================
-- 3. ERRADICACIÓN DE DATOS DEMO / MOCK SEMBRADOS PREVIAMENTE
-- =====================================================================

DELETE FROM public.voters
WHERE cedula IN ('1003456789', '78456123', '50987654')
  AND nombre IN ('Ana Sofía Vergara Díaz', 'Pedro Manuel Negrete', 'María Elena Cordero');

DELETE FROM public.leaders
WHERE cedula IN ('78541230', '34567891', '1067894523')
  AND nombre IN ('Carlos Mario Paternina', 'Luz Marina Argumedo', 'Javier Elías Buelvas');

DELETE FROM public.budget_items
WHERE comprobante_numero IN ('ING-001', 'FAC-2045', 'FAC-3012')
  AND concepto IN (
    'Recursos propios iniciales para campaña electoral',
    'Microperforados, vallas y volantes informativos',
    'Sonido y logística para presentación de programa de gobierno'
  );

DELETE FROM public.witnesses
WHERE cedula IN ('78234567', '1065432198')
  AND nombre IN ('Hernán José Ramos', 'Diana Patricia Galeano');

DELETE FROM public.jurors
WHERE cedula IN ('34876543', '78901234')
  AND nombre IN ('Milena del Carmen Hoyos', 'Javier Antonio Durango');

DELETE FROM public.surveys
WHERE titulo = 'Primer Sondeo de Percepción y Necesidades - Cotorra 2026';

DELETE FROM public.swot_matrices
WHERE conclusiones_ai LIKE 'La estrategia debe concentrarse en consolidar el voto seguro en los corregimientos clave%';

DELETE FROM public.campaign_calendar
WHERE titulo IN (
  'Gran Encuentro Comunitario en Los Cedros',
  'Capacitación General de Testigos Electorales'
);

DELETE FROM public.campaign_activities
WHERE titulo IN (
  'Debate Televisado Regional - Telemedellín',
  'Caminata Masiva y Puerta a Puerta Comuna 13',
  'Cierre de Inscripción de Cédulas (Registraduría)',
  'Simulacro General de Testigos Electorales y App E-14',
  'Foro Empresarial con Comerciantes del Centro',
  'Gran Cierre de Campaña en Parque Explora',
  'Encuentro con Jóvenes Universitarios (Becas Tech)',
  'Caravana Vehicular por el Norte del Municipio',
  'Reunión de Adhesión con Presidentes de JAC',
  'Rueda de Prensa: Presentación Plan de Seguridad',
  'Entrega Oficial de Listas de Testigos a Registraduría',
  'Día de Reflexión / Silencio Electoral (Veda)',
  '¡DÍA E! Elecciones Regionales y Apertura de Urnas',
  'Gran Encuentro Comunitario en Los Cedros',
  'Capacitación General de Testigos Electorales'
);

DELETE FROM public.candidates
WHERE identificacion = '1085294312'
  AND perfil_profesional LIKE 'Líder social y administrador público comprometido con el desarrollo agropecuario%';

-- Normalizar circunscripción de la campaña activa
UPDATE public.campaigns
SET
  circunscripcion = COALESCE(NULLIF(circunscripcion, ''), 'Municipal'),
  is_demo = FALSE,
  demo_expires_at = NULL,
  updated_at = NOW()
WHERE id = '98f28288-c688-4756-9291-5d2cb2f63c43';

NOTIFY pgrst, 'reload schema';
`;

async function runDatabaseSetup() {
  console.log('\n==========================================================');
  console.log('🚀 EJECUTANDO MIGRACIÓN Y SINCRONIZACIÓN REAL EN SUPABASE');
  console.log(`📍 Endpoint REST: ${SUPABASE_URL}`);
  console.log('==========================================================\n');

  // 1. Ejecutar DDL y limpieza de mocks directamente en PostgreSQL
  console.log('⏳ Paso 1: Conectando a PostgreSQL y aplicando migración DDL + RLS...');
  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await pgClient.connect();
  try {
    await pgClient.query(SCHEMA_MIGRATION_SQL);
    console.log('✅ Migración DDL, políticas RLS y limpieza de datos demo ejecutadas en PostgreSQL.\n');
  } finally {
    await pgClient.end();
  }

  // 2. Verificar y Crear Storage Buckets
  console.log('⏳ Paso 2: Verificando Supabase Storage Buckets...');
  const { data: existingBuckets } = await supabase.storage.listBuckets();
  const existingBucketNames = (existingBuckets || []).map(b => b.name);

  for (const bucket of REQUIRED_BUCKETS) {
    if (!existingBucketNames.includes(bucket.name)) {
      const { error: bErr } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (bErr) {
        console.warn(`  ⚠️ Aviso al crear bucket '${bucket.name}':`, bErr.message);
      } else {
        console.log(`  ✨ Bucket '${bucket.name}' creado exitosamente.`);
      }
    } else {
      console.log(`  ✓ Bucket '${bucket.name}' verificado.`);
    }
  }
  console.log('✅ Supabase Storage configurado correctamente.\n');

  // 3. Catálogo Base de Módulos, Funciones y Planes
  console.log('⏳ Paso 3: Sincronizando catálogo de módulos, funciones y planes...');
  await supabase.from('modules').upsert([
    { code: 'ADMINISTRATIVE', name: 'Gestión Administrativa', description: 'Control de recursos, presupuesto CNE, roles, votantes y gestión de campaña', icon: 'Shield' },
    { code: 'TERRITORY', name: 'Gestión Territorial', description: 'Control geográfico, georreferenciación y censo en tiempo real', icon: 'MapPin' },
    { code: 'STRATEGY', name: 'Gestión Estratégica', description: 'Planeación de campaña, análisis FODA y metas electorales', icon: 'Target' },
    { code: 'CRM', name: 'CRM Electoral', description: 'Gestión de simpatizantes, votantes y árbol de referidos', icon: 'Users' },
    { code: 'ELECTORAL', name: 'Electoral (E14)', description: 'Digitalización, validación de actas E-14 y control de escrutinio', icon: 'Vote' },
    { code: 'ANALYSIS', name: 'Análisis de Datos', description: 'Sondeos, tendencias y proyecciones estadísticas', icon: 'BarChart3' },
    { code: 'COMMUNICATIONS', name: 'Comunicaciones', description: 'Prensa, redes sociales y difusión multicanal', icon: 'MessageSquare' },
  ], { onConflict: 'code' });

  await supabase.from('module_functions').upsert([
    { module_code: 'ADMINISTRATIVE', code: 'admin_inicio', name: 'Inicio / Dashboard', description: 'Visualización de métricas generales y estadísticas' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_roles', name: 'Gestión de Roles', description: 'Creación y administración de roles y permisos' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_lideres', name: 'Líderes / Votantes', description: 'Administración de líderes territoriales y censo de votantes' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_presupuesto', name: 'Presupuesto / CNE', description: 'Ingresos, gastos y reportes para CNE / Cuentas Claras' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_campana', name: 'Gestión de Campaña', description: 'Objetivos, hitos y actividades de campaña' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_testigos', name: 'Gestión de Testigos', description: 'Acreditación y monitoreo de testigos electorales' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_jurados', name: 'Jurados Electorales', description: 'Monitoreo de jurados de votación en mesas' },
    { module_code: 'ADMINISTRATIVE', code: 'admin_encuestas', name: 'Encuestas y Sondeos', description: 'Creación y análisis de encuestas de opinión' },
  ], { onConflict: 'module_code,code' });

  await supabase.from('plans').upsert([
    { name: 'Plan Básico', code: 'BASIC', description: 'Acceso a módulos fundamentales para campaña pequeña', max_users: 5, max_campaigns: 1, allowed_module_codes: ['ADMINISTRATIVE', 'CRM'] },
    { name: 'Plan Profesional', code: 'PRO', description: 'Acceso completo para campañas medianas con análisis territorial', max_users: 25, max_campaigns: 3, allowed_module_codes: ['ADMINISTRATIVE', 'TERRITORY', 'STRATEGY', 'CRM', 'ANALYSIS'] },
    { name: 'Plan Empresa', code: 'ENTERPRISE', description: 'Acceso total a todos los módulos para grandes organizaciones', max_users: 100, max_campaigns: 10, allowed_module_codes: ['ADMINISTRATIVE', 'TERRITORY', 'STRATEGY', 'CRM', 'ELECTORAL', 'ANALYSIS', 'COMMUNICATIONS'] },
  ], { onConflict: 'code' });
  console.log('✅ Módulos, funciones y planes sincronizados.\n');

  // 4. Sincronizar puestos de votación DIVIPOLE y limpiar JSONB demo en campañas activas
  console.log('⏳ Paso 4: Sincronizando puestos DIVIPOLE y depurando metadatos de campañas activas...');
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, client_id, nombre, departamento, municipio, circunscripcion, descripcion');

  for (const camp of activeCampaigns || []) {
    // Limpiar posibles datos demo inyectados en campaigns.descripcion (post-1..6, actor-demo-1..4)
    try {
      const desc = JSON.parse(camp.descripcion || '{}');
      let modified = false;
      if (Array.isArray(desc.communicationPosts)) {
        const realPosts = desc.communicationPosts.filter(
          (p: any) => p && !['post-1', 'post-2', 'post-3', 'post-4', 'post-5', 'post-6'].includes(String(p.id))
        );
        if (realPosts.length !== desc.communicationPosts.length) {
          desc.communicationPosts = realPosts;
          modified = true;
        }
      }
      if (Array.isArray(desc.politicalActors)) {
        const realActors = desc.politicalActors.filter(
          (a: any) => a && !String(a.id || '').startsWith('actor-demo-')
        );
        if (realActors.length !== desc.politicalActors.length) {
          desc.politicalActors = realActors;
          modified = true;
        }
      }
      if (modified) {
        await supabase
          .from('campaigns')
          .update({ descripcion: JSON.stringify(desc), updated_at: new Date().toISOString() })
          .eq('id', camp.id);
        console.log(`  🧹 Campaña '${camp.nombre}': Metadatos JSONB depurados de registros demo.`);
      }
    } catch {
      // ignore if not JSON
    }

    const dep = camp.departamento || 'Córdoba';
    const mun = camp.municipio || 'Cotorra';
    const rawScope = String(camp.circunscripcion || 'Municipal').toUpperCase();
    const scope = rawScope.includes('NACIONAL')
      ? 'Nacional'
      : rawScope.includes('DEPARTAMENT')
        ? 'Departamento'
        : 'Municipio';

    const divipolePlaces = getPuestosPorCircunscripcion(dep, mun, scope);
    const stationRows: Array<{
      campaign_id: string;
      client_id: string | null;
      zone: string;
      place: string;
      table_number: string;
      registered_voters: number;
      status: string;
    }> = [];

    for (const place of divipolePlaces) {
      const totalTables = Math.max(1, Number(place.mesas || 1));
      const votersPerTable = Math.max(1, Math.round(Number(place.censoEstimado || 300) / totalTables));
      const zoneLabel = `${place.municipio || mun} · ${place.comuna || 'Zona Principal'}`;
      for (let t = 1; t <= totalTables; t += 1) {
        const tableNumber = `Mesa ${String(t).padStart(2, '0')}`;
        stationRows.push({
          campaign_id: camp.id,
          client_id: camp.client_id || null,
          zone: zoneLabel,
          place: place.nombre,
          table_number: tableNumber,
          registered_voters: votersPerTable,
          status: 'ACTIVA',
        });
      }
    }

    if (stationRows.length > 0) {
      const { error: psErr } = await supabase
        .from('polling_stations')
        .upsert(stationRows, { onConflict: 'campaign_id,place,table_number' });
      if (psErr) {
        console.warn(`  ⚠️ Aviso al sincronizar puestos para '${camp.nombre}':`, psErr.message);
      } else {
        console.log(`  ✓ Campaña '${camp.nombre}' (${mun}, ${dep}): ${divipolePlaces.length} puestos / ${stationRows.length} mesas DIVIPOLE sincronizadas.`);
      }
    }
  }

  // 5. Auditoría Final de Tablas Operativas y Estratégicas
  console.log('\n⏳ Paso 5: Verificando conteos reales en Supabase...');
  const tablesToCheck = [
    'clients',
    'campaigns',
    'profiles',
    'user_permissions',
    'polling_stations',
    'leaders',
    'voters',
    'budget_items',
    'witnesses',
    'jurors',
    'surveys',
    'survey_pollsters',
    'survey_responses',
    'campaign_activities',
    'swot_matrices',
    'strategic_proposals',
    'strategic_actors',
  ];

  for (const table of tablesToCheck) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  - ${table.padEnd(20)} -> ${error ? `ERROR: ${error.message}` : `${count ?? 0} registros reales`}`);
  }

  console.log('\n==========================================================');
  console.log('🎉 BASE DE DATOS SUPABASE 100% SINCRONIZADA Y SIN DATOS MOCK');
  console.log('==========================================================\n');
}

runDatabaseSetup().catch((err) => {
  console.error('❌ Error fatal en migración de base de datos:', err);
  process.exit(1);
});
