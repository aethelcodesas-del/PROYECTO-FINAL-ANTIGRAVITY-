-- =============================================================================
-- MIGRACIÓN: FUNCIONES RPC ATÓMICAS PARA SINCRONIZACIÓN OFICIAL DIVIPOLE Y CENSO
-- Archivo: supabase/migrations/20260909_official_electoral_sync_rpc.sql
-- Fecha: 2026-09-09
-- Descripción:
--   Implementa procedimientos RPC transaccionales y atómicos en PostgreSQL para
--   la sincronización del catálogo DIVIPOLE y Censo Oficial sin riesgo de
--   estados parciales ni disrupción operacional.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. RPC: SINCRONIZACIÓN ATÓMICA DE DIVIPOLE (PUESTOS, MESAS, ZONAS, MUNICIPIOS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_official_divipole_batch(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_process_id UUID;
    v_sync_id UUID;
    v_proc_rec JSONB;
    v_source_rec JSONB;
    v_sha256 TEXT;
    v_last_sync_sha TEXT;
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_nuevos INTEGER := 0;
    v_modificados INTEGER := 0;
    v_desactivados INTEGER := 0;
    v_validos INTEGER := 0;
    v_total_recibidos INTEGER := 0;
    
    -- Variables para iteración
    v_item JSONB;
    v_dept_id UUID;
    v_mpio_id UUID;
    v_zone_id UUID;
    v_place_id UUID;
    v_existing_place RECORD;
    v_cod_unico TEXT;
    v_mesas_total INTEGER;
    v_tbl_item JSONB;
    v_cod_mesa TEXT;
    v_num_mesa INTEGER;
BEGIN
    v_proc_rec := p_payload->'process';
    v_source_rec := p_payload->'source';
    v_sha256 := p_payload->>'sha256';
    v_total_recibidos := COALESCE((p_payload->'statistics'->>'registrosRecibidos')::INTEGER, 0);

    -- 1. Verificar si el SHA-256 es idéntico al último sincronizado con éxito para este proceso
    SELECT id, sha256_fuente INTO v_sync_id, v_last_sync_sha
    FROM public.divipole_sync_history
    WHERE fuente = (v_source_rec->>'url')
      AND estado_sincronizacion = 'EXITOSA'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_sync_sha IS NOT NULL AND v_last_sync_sha = v_sha256 THEN
        -- Registrar intento exitoso sin cambios
        INSERT INTO public.divipole_sync_history (
            fecha_sincronizacion,
            hora_sincronizacion,
            fuente,
            tipo_fuente,
            sha256_fuente,
            estado_sincronizacion,
            registros_recibidos,
            registros_validos,
            cantidad_nuevos,
            cantidad_modificados,
            duracion_ms,
            metadata
        ) VALUES (
            CURRENT_DATE,
            NOW(),
            COALESCE(v_source_rec->>'url', 'MANUAL'),
            COALESCE(v_source_rec->>'tipo', 'CSV_DIVIPOLE'),
            v_sha256,
            'EXITOSA',
            v_total_recibidos,
            v_total_recibidos,
            0,
            0,
            ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER,
            jsonb_build_object('nota', 'Catálogo al día, SHA-256 idéntico sin cambios detectados.')
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'NO_CHANGES',
            'sha256', v_sha256,
            'message', 'Catálogo oficial al día. El hash SHA-256 es idéntico a la última versión registrada.'
        );
    END IF;

    -- 2. Registrar historial inicial en estado EN_PROCESO
    INSERT INTO public.divipole_sync_history (
        fecha_sincronizacion,
        hora_sincronizacion,
        fuente,
        tipo_fuente,
        sha256_fuente,
        estado_sincronizacion,
        registros_recibidos,
        metadata
    ) VALUES (
        CURRENT_DATE,
        NOW(),
        COALESCE(v_source_rec->>'url', 'MANUAL'),
        COALESCE(v_source_rec->>'tipo', 'CSV_DIVIPOLE'),
        v_sha256,
        'EN_PROCESO',
        v_total_recibidos,
        jsonb_build_object('iniciado_por', 'RegistraduriaSyncWorker')
    ) RETURNING id INTO v_sync_id;

    -- 3. UPSERT Proceso Electoral
    INSERT INTO public.electoral_processes (
        codigo_proceso,
        nombre,
        tipo_proceso,
        anio,
        fecha_eleccion,
        corporaciones_habilitadas,
        estado,
        es_vigente
    ) VALUES (
        v_proc_rec->>'codigoProceso',
        v_proc_rec->>'nombre',
        COALESCE(v_proc_rec->>'tipoProceso', 'NACIONAL'),
        (v_proc_rec->>'anio')::INTEGER,
        (v_proc_rec->>'fechaEleccion')::DATE,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_proc_rec->'corporacionesHabilitadas')), '{}'),
        'ACTIVO',
        true
    )
    ON CONFLICT (codigo_proceso) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        tipo_proceso = EXCLUDED.tipo_proceso,
        fecha_eleccion = EXCLUDED.fecha_eleccion,
        corporaciones_habilitadas = EXCLUDED.corporaciones_habilitadas,
        updated_at = NOW()
    RETURNING id INTO v_process_id;

    -- Asociar process_id al historial
    UPDATE public.divipole_sync_history SET process_id = v_process_id WHERE id = v_sync_id;

    -- 4. UPSERT Departamentos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'departments')
    LOOP
        INSERT INTO public.divipole_departments (
            cod_dpto_divipole,
            nombre_departamento,
            region,
            activo
        ) VALUES (
            v_item->>'codDptoDivipole',
            v_item->>'nombreDepartamento',
            v_item->>'region',
            true
        )
        ON CONFLICT (cod_dpto_divipole) DO UPDATE SET
            nombre_departamento = EXCLUDED.nombre_departamento,
            region = COALESCE(EXCLUDED.region, divipole_departments.region);
    END LOOP;

    -- 5. UPSERT Municipios
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'municipalities')
    LOOP
        SELECT id INTO v_dept_id FROM public.divipole_departments WHERE cod_dpto_divipole = (v_item->>'codDptoDivipole');
        
        IF v_dept_id IS NOT NULL THEN
            INSERT INTO public.divipole_municipalities (
                department_id,
                cod_dpto_divipole,
                cod_mpio_divipole,
                cod_completo_divipole,
                nombre_municipio,
                es_capital,
                activo
            ) VALUES (
                v_dept_id,
                v_item->>'codDptoDivipole',
                v_item->>'codMpioDivipole',
                v_item->>'codCompletoDivipole',
                v_item->>'nombreMunicipio',
                COALESCE((v_item->>'esCapital')::BOOLEAN, false),
                true
            )
            ON CONFLICT (cod_completo_divipole) DO UPDATE SET
                nombre_municipio = EXCLUDED.nombre_municipio,
                es_capital = EXCLUDED.es_capital,
                department_id = EXCLUDED.department_id;
        END IF;
    END LOOP;

    -- 6. UPSERT Zonas
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'zones')
    LOOP
        SELECT id INTO v_mpio_id FROM public.divipole_municipalities WHERE cod_completo_divipole = (v_item->>'codCompletoMunicipio');
        
        IF v_mpio_id IS NOT NULL THEN
            INSERT INTO public.divipole_zones (
                municipality_id,
                cod_zona_divipole,
                nombre_zona,
                tipo_zona
            ) VALUES (
                v_mpio_id,
                v_item->>'codZonaDivipole',
                v_item->>'nombreZona',
                COALESCE(v_item->>'tipoZona', 'URBANA')
            )
            ON CONFLICT (municipality_id, cod_zona_divipole) DO UPDATE SET
                nombre_zona = EXCLUDED.nombre_zona,
                tipo_zona = EXCLUDED.tipo_zona;
        END IF;
    END LOOP;

    -- 7. UPSERT Puestos de Votación + Delta Engine Change Log
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'pollingPlaces')
    LOOP
        v_cod_unico := v_item->>'codUnicoDivipole';
        SELECT id INTO v_mpio_id FROM public.divipole_municipalities WHERE cod_completo_divipole = ((v_item->>'codDptoDivipole') || (v_item->>'codMpioDivipole'));
        SELECT id INTO v_zone_id FROM public.divipole_zones WHERE municipality_id = v_mpio_id AND cod_zona_divipole = (v_item->>'codZonaDivipole');

        IF v_mpio_id IS NOT NULL AND v_zone_id IS NOT NULL THEN
            SELECT * INTO v_existing_place FROM public.divipole_polling_places WHERE cod_unico_divipole = v_cod_unico;

            IF v_existing_place.id IS NULL THEN
                -- CREACIÓN
                INSERT INTO public.divipole_polling_places (
                    municipality_id,
                    zone_id,
                    cod_dpto_divipole,
                    cod_mpio_divipole,
                    cod_zona_divipole,
                    cod_puesto_divipole,
                    cod_unico_divipole,
                    nombre_puesto,
                    direccion,
                    comuna_o_corregimiento,
                    es_rural,
                    latitud,
                    longitud,
                    estado_puesto
                ) VALUES (
                    v_mpio_id,
                    v_zone_id,
                    v_item->>'codDptoDivipole',
                    v_item->>'codMpioDivipole',
                    v_item->>'codZonaDivipole',
                    v_item->>'codPuestoDivipole',
                    v_cod_unico,
                    v_item->>'nombrePuesto',
                    v_item->>'direccion',
                    v_item->>'comunaOCorregimiento',
                    COALESCE((v_item->>'esRural')::BOOLEAN, false),
                    (v_item->>'latitud')::NUMERIC,
                    (v_item->>'longitud')::NUMERIC,
                    'ACTIVO'
                ) RETURNING id INTO v_place_id;

                INSERT INTO public.divipole_change_log (
                    sync_id, polling_place_id, cod_unico_divipole, tipo_cambio, campo_modificado, valor_anterior, valor_nuevo, descripcion_motivo
                ) VALUES (
                    v_sync_id, v_place_id, v_cod_unico, 'CREACION', 'puesto_completo', NULL, (v_item->>'nombrePuesto'), 'Puesto nuevo registrado oficialmente por la Registraduría'
                );

                v_nuevos := v_nuevos + 1;
            ELSE
                -- MODIFICACIÓN / ACTUALIZACIÓN
                v_place_id := v_existing_place.id;

                IF v_existing_place.nombre_puesto IS DISTINCT FROM (v_item->>'nombrePuesto') OR
                   v_existing_place.direccion IS DISTINCT FROM (v_item->>'direccion') OR
                   v_existing_place.zone_id IS DISTINCT FROM v_zone_id THEN
                    
                    INSERT INTO public.divipole_change_log (
                        sync_id, polling_place_id, cod_unico_divipole, tipo_cambio, campo_modificado, valor_anterior, valor_nuevo, descripcion_motivo
                    ) VALUES (
                        v_sync_id, v_place_id, v_cod_unico, 'MODIFICACION', 'nombre_o_direccion', v_existing_place.nombre_puesto || ' | ' || COALESCE(v_existing_place.direccion, ''), (v_item->>'nombrePuesto') || ' | ' || COALESCE(v_item->>'direccion', ''), 'Actualización oficial de datos del puesto'
                    );

                    v_modificados := v_modificados + 1;
                END IF;

                UPDATE public.divipole_polling_places SET
                    nombre_puesto = (v_item->>'nombrePuesto'),
                    direccion = (v_item->>'direccion'),
                    comuna_o_corregimiento = (v_item->>'comunaOCorregimiento'),
                    zone_id = v_zone_id,
                    es_rural = COALESCE((v_item->>'esRural')::BOOLEAN, false),
                    latitud = COALESCE((v_item->>'latitud')::NUMERIC, divipole_polling_places.latitud),
                    longitud = COALESCE((v_item->>'longitud')::NUMERIC, divipole_polling_places.longitud),
                    estado_puesto = 'ACTIVO',
                    updated_at = NOW()
                WHERE id = v_place_id;
            END IF;

            v_validos := v_validos + 1;
        END IF;
    END LOOP;

    -- 8. UPSERT Mesas Oficiales
    FOR v_tbl_item IN SELECT * FROM jsonb_array_elements(p_payload->'pollingTables')
    LOOP
        SELECT id INTO v_place_id FROM public.divipole_polling_places WHERE cod_unico_divipole = (v_tbl_item->>'codUnicoDivipole');
        v_num_mesa := (v_tbl_item->>'numeroMesa')::INTEGER;
        v_cod_mesa := (v_tbl_item->>'codigoMesaCompleto');

        IF v_place_id IS NOT NULL AND v_num_mesa > 0 THEN
            INSERT INTO public.divipole_polling_tables (
                polling_place_id,
                process_id,
                numero_mesa,
                codigo_mesa_completo,
                censo_oficial_mesa,
                activo
            ) VALUES (
                v_place_id,
                v_process_id,
                v_num_mesa,
                v_cod_mesa,
                COALESCE((v_tbl_item->>'censoOficialMesa')::INTEGER, 0),
                true
            )
            ON CONFLICT (polling_place_id, process_id, numero_mesa) DO UPDATE SET
                censo_oficial_mesa = EXCLUDED.censo_oficial_mesa,
                codigo_mesa_completo = EXCLUDED.codigo_mesa_completo,
                activo = true;
        END IF;
    END LOOP;

    -- 9. Finalizar Historial como EXITOSA
    UPDATE public.divipole_sync_history SET
        estado_sincronizacion = 'EXITOSA',
        registros_validos = v_validos,
        cantidad_nuevos = v_nuevos,
        cantidad_modificados = v_modificados,
        cantidad_desactivados = v_desactivados,
        duracion_ms = ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER,
        metadata = jsonb_build_object(
            'puestos_procesados', v_validos,
            'puestos_nuevos', v_nuevos,
            'puestos_modificados', v_modificados
        )
    WHERE id = v_sync_id;

    RETURN jsonb_build_object(
        'success', true,
        'syncId', v_sync_id,
        'processId', v_process_id,
        'sha256', v_sha256,
        'registrosValidos', v_validos,
        'cantidadNuevos', v_nuevos,
        'cantidadModificados', v_modificados,
        'duracionMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER
    );
EXCEPTION WHEN OTHERS THEN
    -- En caso de error, el bloque de transacción revierte los cambios
    IF v_sync_id IS NOT NULL THEN
        UPDATE public.divipole_sync_history SET
            estado_sincronizacion = 'FALLIDA_FUENTE_CAIDA',
            error_detalle = SQLERRM,
            duracion_ms = ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER
        WHERE id = v_sync_id;
    END IF;
    RAISE EXCEPTION 'Error en sincronización oficial DIVIPOLE: %', SQLERRM;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC: SINCRONIZACIÓN ATÓMICA DE CENSO ELECTORAL OFICIAL
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_official_census_batch(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_process_id UUID;
    v_proc_rec JSONB;
    v_item JSONB;
    v_dept_id UUID;
    v_mpio_id UUID;
    v_place_id UUID;
    v_count INTEGER := 0;
BEGIN
    v_proc_rec := p_payload->'process';

    -- Obtener process_id
    SELECT id INTO v_process_id FROM public.electoral_processes WHERE codigo_proceso = (v_proc_rec->>'codigoProceso');
    IF v_process_id IS NULL THEN
        INSERT INTO public.electoral_processes (
            codigo_proceso, nombre, tipo_proceso, anio, fecha_eleccion, estado, es_vigente
        ) VALUES (
            v_proc_rec->>'codigoProceso',
            v_proc_rec->>'nombre',
            COALESCE(v_proc_rec->>'tipoProceso', 'NACIONAL'),
            (v_proc_rec->>'anio')::INTEGER,
            (v_proc_rec->>'fechaEleccion')::DATE,
            'ACTIVO',
            true
        ) RETURNING id INTO v_process_id;
    END IF;

    -- Iterar registros de censo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'census')
    LOOP
        SELECT id INTO v_dept_id FROM public.divipole_departments WHERE cod_dpto_divipole = (v_item->>'codDptoDivipole');
        
        IF (v_item->>'codMpioDivipole') IS NOT NULL THEN
            SELECT id INTO v_mpio_id FROM public.divipole_municipalities 
            WHERE cod_completo_divipole = ((v_item->>'codDptoDivipole') || (v_item->>'codMpioDivipole'));
        ELSE
            v_mpio_id := NULL;
        END IF;

        IF (v_item->>'codUnicoDivipole') IS NOT NULL THEN
            SELECT id INTO v_place_id FROM public.divipole_polling_places WHERE cod_unico_divipole = (v_item->>'codUnicoDivipole');
        ELSE
            v_place_id := NULL;
        END IF;

        IF v_dept_id IS NOT NULL THEN
            INSERT INTO public.official_electoral_census (
                process_id,
                department_id,
                municipality_id,
                polling_place_id,
                fecha_corte,
                hombres,
                mujeres,
                total_electores,
                total_puestos,
                total_mesas,
                fuente,
                url_fuente,
                fecha_publicacion,
                fecha_importacion
            ) VALUES (
                v_process_id,
                v_dept_id,
                v_mpio_id,
                v_place_id,
                (v_item->>'fechaCorte')::DATE,
                COALESCE((v_item->>'hombres')::INTEGER, 0),
                COALESCE((v_item->>'mujeres')::INTEGER, 0),
                (v_item->>'totalElectores')::INTEGER,
                (v_item->>'totalPuestos')::INTEGER,
                (v_item->>'totalMesas')::INTEGER,
                COALESCE(v_item->>'fuente', 'Registraduría Nacional del Estado Civil'),
                v_item->>'urlFuente',
                COALESCE((v_item->>'fechaPublicacion')::DATE, (v_item->>'fechaCorte')::DATE),
                NOW()
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processId', v_process_id,
        'registrosCensoImportados', v_count
    );
END;
$$;

COMMIT;
