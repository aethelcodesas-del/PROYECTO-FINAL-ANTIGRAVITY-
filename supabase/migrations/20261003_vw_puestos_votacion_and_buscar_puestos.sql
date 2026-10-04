-- =============================================================================
-- MIGRACIÓN: VISTA VW_PUESTOS_VOTACION Y FUNCIÓN BUSCAR_PUESTOS_VOTACION
-- Archivo: supabase/migrations/20261003_vw_puestos_votacion_and_buscar_puestos.sql
-- Fecha: 2026-10-03
-- Descripción:
--   1. Crea la vista unificada `public.vw_puestos_votacion` integrando las tablas
--      oficiales DIVIPOLE (divipole_departments, divipole_municipalities,
--      divipole_zones, divipole_polling_places, divipole_polling_tables).
--   2. Implementa la función RPC `public.buscar_puestos_votacion(...)` para
--      búsquedas filtradas por departamento, municipio y palabras clave.
--   3. Expone vistas de compatibilidad `public.electoral_*` para interoperabilidad
--      sin redundancia ni duplicidad de datos.
--   4. Configura permisos y políticas RLS públicas y autenticadas.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. VISTA OFICIAL UNIFICADA: public.vw_puestos_votacion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_puestos_votacion AS
SELECT
    pp.id AS id,
    d.nombre_departamento AS departamento,
    pp.cod_dpto_divipole AS codigo_departamento,
    m.nombre_municipio AS municipio,
    m.cod_completo_divipole AS codigo_municipio,
    m.cod_mpio_divipole AS codigo_municipio_corto,
    COALESCE(z.nombre_zona, 'ZONA ' || pp.cod_zona_divipole) AS zona,
    pp.cod_zona_divipole AS codigo_zona,
    pp.nombre_puesto AS puesto_votacion,
    pp.cod_puesto_divipole AS codigo_puesto,
    pp.cod_unico_divipole AS codigo_unico_puesto,
    pp.direccion AS direccion,
    pp.comuna_o_corregimiento AS comuna_corregimiento,
    pp.es_rural AS es_rural,
    pp.latitud AS latitud,
    pp.longitud AS longitud,
    pp.estado_puesto AS estado_puesto,
    COALESCE(t.total_mesas, 0)::INTEGER AS total_mesas,
    COALESCE(t.censo_total, 0)::INTEGER AS censo_electoral
FROM public.divipole_polling_places pp
JOIN public.divipole_departments d ON d.cod_dpto_divipole = pp.cod_dpto_divipole
JOIN public.divipole_municipalities m ON m.id = pp.municipality_id
LEFT JOIN public.divipole_zones z ON z.id = pp.zone_id
LEFT JOIN (
    SELECT
        polling_place_id,
        COUNT(id) AS total_mesas,
        SUM(COALESCE(censo_oficial_mesa, 0)) AS censo_total
    FROM public.divipole_polling_tables
    WHERE activo = true
    GROUP BY polling_place_id
) t ON t.polling_place_id = pp.id;

-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN RPC DE BÚSQUEDA: public.buscar_puestos_votacion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_puestos_votacion(
    p_departamento TEXT DEFAULT NULL,
    p_municipio TEXT DEFAULT NULL,
    p_busqueda TEXT DEFAULT NULL
)
RETURNS SETOF public.vw_puestos_votacion
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.vw_puestos_votacion
    WHERE
        (
            p_departamento IS NULL
            OR lower(departamento) = lower(p_departamento)
            OR codigo_departamento = p_departamento
        )
        AND (
            p_municipio IS NULL
            OR lower(municipio) = lower(p_municipio)
            OR codigo_municipio = p_municipio
            OR codigo_municipio_corto = p_municipio
        )
        AND (
            p_busqueda IS NULL
            OR lower(puesto_votacion) LIKE '%' || lower(p_busqueda) || '%'
            OR lower(COALESCE(direccion, '')) LIKE '%' || lower(p_busqueda) || '%'
            OR lower(COALESCE(comuna_corregimiento, '')) LIKE '%' || lower(p_busqueda) || '%'
        )
    ORDER BY departamento, municipio, zona, puesto_votacion;
$$;

-- -----------------------------------------------------------------------------
-- 3. VISTAS DE COMPATIBILIDAD ELECTORAL_* (Garantiza interoperabilidad sin duplicar datos)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.electoral_departamentos AS
SELECT
    id,
    cod_dpto_divipole AS codigo,
    nombre_departamento AS nombre,
    region,
    activo
FROM public.divipole_departments;

CREATE OR REPLACE VIEW public.electoral_municipios AS
SELECT
    m.id,
    m.department_id AS departamento_id,
    m.cod_dpto_divipole AS codigo_departamento,
    m.cod_mpio_divipole AS codigo_municipio,
    m.cod_completo_divipole AS codigo_completo,
    m.nombre_municipio AS nombre,
    m.es_capital,
    m.categoria_municipal,
    m.activo
FROM public.divipole_municipalities m;

CREATE OR REPLACE VIEW public.electoral_zonas AS
SELECT
    z.id,
    z.municipality_id AS municipio_id,
    z.cod_zona_divipole AS codigo_zona,
    z.nombre_zona AS nombre,
    z.tipo_zona
FROM public.divipole_zones z;

CREATE OR REPLACE VIEW public.electoral_puestos_votacion AS
SELECT
    pp.id,
    pp.municipality_id AS municipio_id,
    pp.zone_id AS zona_id,
    pp.cod_dpto_divipole AS codigo_departamento,
    pp.cod_mpio_divipole AS codigo_municipio,
    pp.cod_zona_divipole AS codigo_zona,
    pp.cod_puesto_divipole AS codigo_puesto,
    pp.cod_unico_divipole AS codigo_unico,
    pp.nombre_puesto AS puesto_votacion,
    pp.direccion,
    pp.comuna_o_corregimiento AS comuna_corregimiento,
    pp.es_rural,
    pp.latitud,
    pp.longitud,
    pp.estado_puesto
FROM public.divipole_polling_places pp;

CREATE OR REPLACE VIEW public.electoral_mesas AS
SELECT
    t.id,
    t.polling_place_id AS puesto_votacion_id,
    t.process_id AS proceso_id,
    t.numero_mesa,
    t.codigo_mesa_completo,
    t.censo_oficial_mesa AS censo_electoral,
    t.rango_cedulas_inicio,
    t.rango_cedulas_fin,
    t.activo
FROM public.divipole_polling_tables t;

-- -----------------------------------------------------------------------------
-- 4. PERMISOS Y POLÍTICAS (Anon y Authenticated)
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.vw_puestos_votacion TO anon, authenticated;
GRANT SELECT ON public.electoral_departamentos TO anon, authenticated;
GRANT SELECT ON public.electoral_municipios TO anon, authenticated;
GRANT SELECT ON public.electoral_zonas TO anon, authenticated;
GRANT SELECT ON public.electoral_puestos_votacion TO anon, authenticated;
GRANT SELECT ON public.electoral_mesas TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_puestos_votacion(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Políticas de lectura en las tablas base de DIVIPOLE para anon (authenticated ya existe)
DO $$
BEGIN
    DROP POLICY IF EXISTS "divipole_dpto_read_public" ON public.divipole_departments;
    CREATE POLICY "divipole_dpto_read_public" ON public.divipole_departments FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "divipole_mpio_read_public" ON public.divipole_municipalities;
    CREATE POLICY "divipole_mpio_read_public" ON public.divipole_municipalities FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "divipole_zones_read_public" ON public.divipole_zones;
    CREATE POLICY "divipole_zones_read_public" ON public.divipole_zones FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "divipole_places_read_public" ON public.divipole_polling_places;
    CREATE POLICY "divipole_places_read_public" ON public.divipole_polling_places FOR SELECT TO anon USING (true);

    DROP POLICY IF EXISTS "divipole_tables_read_public" ON public.divipole_polling_tables;
    CREATE POLICY "divipole_tables_read_public" ON public.divipole_polling_tables FOR SELECT TO anon USING (true);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

COMMIT;
