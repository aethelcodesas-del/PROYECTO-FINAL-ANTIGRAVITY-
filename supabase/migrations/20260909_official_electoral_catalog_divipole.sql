-- =============================================================================
-- MIGRACIÓN: CATÁLOGO ELECTORAL OFICIAL Y ESTRUCTURA DIVIPOLE (REGISTRADURÍA)
-- Archivo: supabase/migrations/20260909_official_electoral_catalog_divipole.sql
-- Fecha: 2026-09-09
-- Descripción:
--   Crea el Catálogo Electoral Oficial independiente de las campañas para gestionar
--   la División Político-Administrativa Electoral (DIVIPOLE), Puestos y Mesas de Votación,
--   Censo Electoral Oficial e Historial/Auditoría de Sincronizaciones.
--   Garantiza 100% compatibilidad no destructiva con las tablas operativas de campaña.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. FUNCIÓN AUXILIAR PARA ACTUALIZACIÓN DE TIMESTAMP
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. PROCESOS ELECTORALES (Extensible para cualquier elección nacional o local)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.electoral_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_proceso TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    tipo_proceso TEXT NOT NULL CHECK (tipo_proceso IN ('NACIONAL', 'TERRITORIAL', 'ATIPICA', 'CONSULTA')),
    corporaciones_habilitadas TEXT[] NOT NULL DEFAULT '{}',
    fecha_eleccion DATE NOT NULL,
    anio INTEGER NOT NULL,
    estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('PROGRAMADO', 'ACTIVO', 'CERRADO', 'HISTORICO')),
    es_vigente BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at para electoral_processes
DROP TRIGGER IF EXISTS trg_electoral_processes_updated_at ON public.electoral_processes;
CREATE TRIGGER trg_electoral_processes_updated_at
BEFORE UPDATE ON public.electoral_processes
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 2. DIVIPOLE: DEPARTAMENTOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_dpto_divipole VARCHAR(2) UNIQUE NOT NULL,
    nombre_departamento TEXT NOT NULL,
    region TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. DIVIPOLE: MUNICIPIOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_municipalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.divipole_departments(id) ON DELETE RESTRICT,
    cod_dpto_divipole VARCHAR(2) NOT NULL,
    cod_mpio_divipole VARCHAR(3) NOT NULL,
    cod_completo_divipole VARCHAR(5) UNIQUE NOT NULL,
    nombre_municipio TEXT NOT NULL,
    es_capital BOOLEAN DEFAULT false,
    categoria_municipal TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_divipole_mpio_dpto UNIQUE(cod_dpto_divipole, cod_mpio_divipole)
);

-- -----------------------------------------------------------------------------
-- 4. DIVIPOLE: ZONAS ELECTORALES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES public.divipole_municipalities(id) ON DELETE RESTRICT,
    cod_zona_divipole VARCHAR(2) NOT NULL,
    nombre_zona TEXT NOT NULL,
    tipo_zona TEXT DEFAULT 'URBANA' CHECK (tipo_zona IN ('URBANA', 'RURAL', 'CARCEL', 'EXTERIOR')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_divipole_zone_mpio UNIQUE(municipality_id, cod_zona_divipole)
);

-- -----------------------------------------------------------------------------
-- 5. DIVIPOLE: PUESTOS DE VOTACIÓN OFICIALES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_polling_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID NOT NULL REFERENCES public.divipole_municipalities(id) ON DELETE RESTRICT,
    zone_id UUID NOT NULL REFERENCES public.divipole_zones(id) ON DELETE RESTRICT,
    cod_dpto_divipole VARCHAR(2) NOT NULL,
    cod_mpio_divipole VARCHAR(3) NOT NULL,
    cod_zona_divipole VARCHAR(2) NOT NULL,
    cod_puesto_divipole VARCHAR(2) NOT NULL,
    cod_unico_divipole VARCHAR(9) UNIQUE NOT NULL,
    nombre_puesto TEXT NOT NULL,
    direccion TEXT,
    comuna_o_corregimiento TEXT,
    es_rural BOOLEAN DEFAULT false,
    latitud NUMERIC(10, 7),
    longitud NUMERIC(10, 7),
    estado_puesto TEXT DEFAULT 'ACTIVO' CHECK (estado_puesto IN ('ACTIVO', 'REUBICADO', 'CLAUSURADO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at para divipole_polling_places
DROP TRIGGER IF EXISTS trg_divipole_polling_places_updated_at ON public.divipole_polling_places;
CREATE TRIGGER trg_divipole_polling_places_updated_at
BEFORE UPDATE ON public.divipole_polling_places
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 6. DIVIPOLE: MESAS OFICIALES POR PUESTO Y PROCESO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_polling_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polling_place_id UUID NOT NULL REFERENCES public.divipole_polling_places(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES public.electoral_processes(id) ON DELETE RESTRICT,
    numero_mesa INTEGER NOT NULL,
    codigo_mesa_completo TEXT UNIQUE NOT NULL,
    censo_oficial_mesa INTEGER DEFAULT 0,
    rango_cedulas_inicio TEXT,
    rango_cedulas_fin TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_divipole_table_puesto_proc_num UNIQUE(polling_place_id, process_id, numero_mesa)
);

-- -----------------------------------------------------------------------------
-- 7. CENSO ELECTORAL OFICIAL INMUTABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.official_electoral_census (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES public.electoral_processes(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES public.divipole_departments(id) ON DELETE RESTRICT,
    municipality_id UUID REFERENCES public.divipole_municipalities(id) ON DELETE RESTRICT,
    polling_place_id UUID REFERENCES public.divipole_polling_places(id) ON DELETE SET NULL,
    fecha_corte DATE NOT NULL,
    hombres INTEGER DEFAULT 0,
    mujeres INTEGER DEFAULT 0,
    total_electores INTEGER NOT NULL,
    total_puestos INTEGER,
    total_mesas INTEGER,
    fuente TEXT NOT NULL,
    url_fuente TEXT,
    fecha_publicacion DATE,
    fecha_importacion TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. HISTORIAL DE SINCRONIZACIONES DE LA REGISTRADURÍA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID REFERENCES public.electoral_processes(id) ON DELETE SET NULL,
    fecha_sincronizacion DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_sincronizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fuente TEXT NOT NULL,
    tipo_fuente TEXT DEFAULT 'PDF_DIVIPOLE' CHECK (tipo_fuente IN ('PDF_DIVIPOLE', 'API_REGISTRADURIA', 'CSV_DATOS_ABIERTOS', 'MANUAL_OFFICIAL')),
    sha256_fuente TEXT,
    estado_sincronizacion TEXT DEFAULT 'EXITOSA' CHECK (estado_sincronizacion IN ('EN_PROCESO', 'EXITOSA', 'RECHAZADA_INCOMPLETA', 'FALLIDA_FUENTE_CAIDA')),
    registros_recibidos INTEGER DEFAULT 0,
    registros_validos INTEGER DEFAULT 0,
    registros_rechazados INTEGER DEFAULT 0,
    cantidad_nuevos INTEGER DEFAULT 0,
    cantidad_modificados INTEGER DEFAULT 0,
    cantidad_desactivados INTEGER DEFAULT 0,
    duracion_ms INTEGER,
    error_detalle TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. TRAZABILIDAD Y LOG DE CAMBIOS DE PUESTOS Y MESAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divipole_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID REFERENCES public.divipole_sync_history(id) ON DELETE SET NULL,
    polling_place_id UUID REFERENCES public.divipole_polling_places(id) ON DELETE SET NULL,
    cod_unico_divipole VARCHAR(9) NOT NULL,
    tipo_cambio TEXT NOT NULL CHECK (tipo_cambio IN ('CREACION', 'MODIFICACION', 'REUBICACION', 'DESACTIVACION', 'REACTIVACION')),
    campo_modificado TEXT NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    descripcion_motivo TEXT,
    fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10. ÍNDICES DE ALTO RENDIMIENTO
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_divipole_mpio_dpto ON public.divipole_municipalities(department_id, cod_completo_divipole);
CREATE INDEX IF NOT EXISTS idx_divipole_puestos_mpio ON public.divipole_polling_places(municipality_id, estado_puesto);
CREATE INDEX IF NOT EXISTS idx_divipole_puestos_cod_unico ON public.divipole_polling_places(cod_unico_divipole);
CREATE INDEX IF NOT EXISTS idx_divipole_mesas_puesto_proc ON public.divipole_polling_tables(polling_place_id, process_id, numero_mesa);
CREATE INDEX IF NOT EXISTS idx_censo_proc_mpio ON public.official_electoral_census(process_id, municipality_id, fecha_corte);
CREATE INDEX IF NOT EXISTS idx_sync_history_fecha ON public.divipole_sync_history(fecha_sincronizacion DESC, estado_sincronizacion);
CREATE INDEX IF NOT EXISTS idx_change_log_puesto ON public.divipole_change_log(cod_unico_divipole, fecha_registro DESC);

-- -----------------------------------------------------------------------------
-- 11. ENLACE NO DESTRUCTIVO CON LA TABLA OPERACIONAL POLLING_STATIONS
-- -----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'polling_stations') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'polling_stations' AND column_name = 'divipole_place_id') THEN
            ALTER TABLE public.polling_stations ADD COLUMN divipole_place_id UUID REFERENCES public.divipole_polling_places(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'polling_stations' AND column_name = 'cod_unico_divipole') THEN
            ALTER TABLE public.polling_stations ADD COLUMN cod_unico_divipole VARCHAR(9);
        END IF;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 12. SEGURIDAD RLS (Row Level Security)
-- -----------------------------------------------------------------------------
ALTER TABLE public.electoral_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_polling_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_polling_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_electoral_census ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divipole_change_log ENABLE ROW LEVEL SECURITY;

-- 12.1 Políticas de Lectura Global para Usuarios Autenticados
DROP POLICY IF EXISTS "divipole_proc_read" ON public.electoral_processes;
CREATE POLICY "divipole_proc_read" ON public.electoral_processes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_dpto_read" ON public.divipole_departments;
CREATE POLICY "divipole_dpto_read" ON public.divipole_departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_mpio_read" ON public.divipole_municipalities;
CREATE POLICY "divipole_mpio_read" ON public.divipole_municipalities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_zones_read" ON public.divipole_zones;
CREATE POLICY "divipole_zones_read" ON public.divipole_zones FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_places_read" ON public.divipole_polling_places;
CREATE POLICY "divipole_places_read" ON public.divipole_polling_places FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_tables_read" ON public.divipole_polling_tables;
CREATE POLICY "divipole_tables_read" ON public.divipole_polling_tables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_census_read" ON public.official_electoral_census;
CREATE POLICY "divipole_census_read" ON public.official_electoral_census FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_history_read" ON public.divipole_sync_history;
CREATE POLICY "divipole_history_read" ON public.divipole_sync_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "divipole_changes_read" ON public.divipole_change_log;
CREATE POLICY "divipole_changes_read" ON public.divipole_change_log FOR SELECT TO authenticated USING (true);

-- 12.2 Políticas de Escritura Exclusiva (SuperAdmin / Service Role)
DROP POLICY IF EXISTS "divipole_admin_write_proc" ON public.electoral_processes;
CREATE POLICY "divipole_admin_write_proc" ON public.electoral_processes FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_dpto" ON public.divipole_departments;
CREATE POLICY "divipole_admin_write_dpto" ON public.divipole_departments FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_mpio" ON public.divipole_municipalities;
CREATE POLICY "divipole_admin_write_mpio" ON public.divipole_municipalities FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_zones" ON public.divipole_zones;
CREATE POLICY "divipole_admin_write_zones" ON public.divipole_zones FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_places" ON public.divipole_polling_places;
CREATE POLICY "divipole_admin_write_places" ON public.divipole_polling_places FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_tables" ON public.divipole_polling_tables;
CREATE POLICY "divipole_admin_write_tables" ON public.divipole_polling_tables FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_census" ON public.official_electoral_census;
CREATE POLICY "divipole_admin_write_census" ON public.official_electoral_census FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_history" ON public.divipole_sync_history;
CREATE POLICY "divipole_admin_write_history" ON public.divipole_sync_history FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "divipole_admin_write_changes" ON public.divipole_change_log;
CREATE POLICY "divipole_admin_write_changes" ON public.divipole_change_log FOR ALL TO authenticated
USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

COMMIT;
