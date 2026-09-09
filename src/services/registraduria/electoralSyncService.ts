/**
 * SERVICIO DE SINCRONIZACIÓN OFICIAL REGISTRADURÍA → SUPABASE (FASE 5)
 * 
 * Orquesta la persistencia atómica, segura y no destructiva del catálogo electoral oficial.
 * Consume el resultado estructurado de la FASE 4 (OfficialAdapterResult).
 */

import { OfficialAdapterResult } from './types';

export interface SyncExecutionResult {
  success: boolean;
  status: 'EXITOSA' | 'NO_CHANGES' | 'RECHAZADA_INCOMPLETA' | 'FALLIDA_FUENTE_CAIDA';
  sha256: string;
  registrosRecibidos: number;
  registrosValidos: number;
  cantidadNuevos: number;
  cantidadModificados: number;
  cantidadDesactivados: number;
  duracionMs: number;
  syncId?: string;
  processId?: string;
  error?: string;
  message: string;
}

export interface SyncOptions {
  supabaseClient?: any;
  dryRun?: boolean; // Permite simular la sincronización sin escribir en la base de datos
  minThresholdPollingPlaces?: number;
}

/**
 * Valida los umbrales de integridad del lote antes de autorizar la sincronización
 */
export function validateCompletenessThresholds(
  adapterResult: OfficialAdapterResult,
  minThreshold: number = 1
): { isValid: boolean; reason?: string } {
  if (!adapterResult.success) {
    return { isValid: false, reason: adapterResult.rawErrorMessage || 'El adaptador reportó un fallo en la fuente.' };
  }

  if (adapterResult.sourceType === 'CENSO_OFFICIAL') {
    if (adapterResult.census.length === 0) {
      return { isValid: false, reason: 'El archivo de censo no contiene registros válidos.' };
    }
    return { isValid: true };
  }

  if (adapterResult.pollingPlaces.length < minThreshold) {
    return {
      isValid: false,
      reason: `El lote contiene una cantidad anormalmente baja de puestos (${adapterResult.pollingPlaces.length} < ${minThreshold}). Se rechaza para evitar descarte accidental del catálogo.`
    };
  }

  if (adapterResult.departments.length === 0 || adapterResult.municipalities.length === 0) {
    return { isValid: false, reason: 'El lote no contiene departamentos o municipios válidos identificables.' };
  }

  return { isValid: true };
}

/**
 * Orquestador principal de sincronización con Supabase (Fail-Safe)
 */
export async function syncOfficialElectoralDataToSupabase(
  adapterResult: OfficialAdapterResult,
  options: SyncOptions = {}
): Promise<SyncExecutionResult> {
  const startTime = Date.now();
  const sha256 = adapterResult.sha256;
  const totalRecibidos = adapterResult.statistics.registrosRecibidos;

  // 1. Verificación Fail-Safe de integridad del lote
  const thresholdCheck = validateCompletenessThresholds(adapterResult, options.minThresholdPollingPlaces || 1);
  if (!thresholdCheck.isValid) {
    const duracionMs = Date.now() - startTime;
    const status = adapterResult.rawErrorMessage?.includes('403') || adapterResult.rawErrorMessage?.includes('404') || adapterResult.rawErrorMessage?.includes('Tiempo de espera')
      ? 'FALLIDA_FUENTE_CAIDA'
      : 'RECHAZADA_INCOMPLETA';

    // Si hay cliente Supabase, registrar intento fallido en divipole_sync_history
    if (options.supabaseClient && !options.dryRun) {
      try {
        await options.supabaseClient.from('divipole_sync_history').insert([{
          fecha_sincronizacion: new Date().toISOString().split('T')[0],
          hora_sincronizacion: new Date().toISOString(),
          fuente: adapterResult.sourceUrl,
          tipo_fuente: adapterResult.sourceType,
          sha256_fuente: sha256,
          estado_sincronizacion: status,
          registros_recibidos: totalRecibidos,
          registros_validos: 0,
          registros_rechazados: totalRecibidos,
          duracion_ms: duracionMs,
          error_detalle: thresholdCheck.reason,
          metadata: { adapterValidation: adapterResult.validation }
        }]);
      } catch (logErr) {
        console.error('Error registrando historial de fallo:', logErr);
      }
    }

    return {
      success: false,
      status,
      sha256,
      registrosRecibidos: totalRecibidos,
      registrosValidos: 0,
      cantidadNuevos: 0,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs,
      error: thresholdCheck.reason,
      message: `Sincronización rechazada por seguridad: ${thresholdCheck.reason}. El catálogo oficial anterior se conserva intacto.`
    };
  }

  // 2. Modo Dry-Run (Simulación de Desarrollo / Tests)
  if (options.dryRun || !options.supabaseClient) {
    const duracionMs = Date.now() - startTime;
    return {
      success: true,
      status: 'EXITOSA',
      sha256,
      registrosRecibidos: totalRecibidos,
      registrosValidos: adapterResult.statistics.registrosValidos,
      cantidadNuevos: adapterResult.pollingPlaces.length,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs,
      syncId: `sim-sync-${Date.now()}`,
      processId: `proc-${adapterResult.process.codigoProceso}`,
      message: `[Simulación Exitosa] Lote validado. ${adapterResult.pollingPlaces.length} puestos listos para persistencia atómica.`
    };
  }

  // 3. Persistencia Atómica vía Supabase RPC
  try {
    const client = options.supabaseClient;

    if (adapterResult.sourceType === 'CENSO_OFFICIAL') {
      const { data, error } = await client.rpc('sync_official_census_batch', {
        p_payload: {
          process: adapterResult.process,
          source: {
            url: adapterResult.sourceUrl,
            tipo: adapterResult.sourceType,
            sha256: adapterResult.sha256
          },
          census: adapterResult.census
        }
      });

      if (error) throw error;

      const duracionMs = Date.now() - startTime;
      return {
        success: true,
        status: 'EXITOSA',
        sha256,
        registrosRecibidos: totalRecibidos,
        registrosValidos: data?.registrosCensoImportados || adapterResult.census.length,
        cantidadNuevos: data?.registrosCensoImportados || adapterResult.census.length,
        cantidadModificados: 0,
        cantidadDesactivados: 0,
        duracionMs,
        processId: data?.processId,
        message: 'Censo electoral oficial sincronizado con éxito en la base de datos.'
      };
    } else {
      const { data, error } = await client.rpc('sync_official_divipole_batch', {
        p_payload: {
          process: adapterResult.process,
          source: {
            url: adapterResult.sourceUrl,
            tipo: adapterResult.sourceType,
            sha256: adapterResult.sha256
          },
          sha256: adapterResult.sha256,
          statistics: adapterResult.statistics,
          departments: adapterResult.departments,
          municipalities: adapterResult.municipalities,
          zones: adapterResult.zones,
          pollingPlaces: adapterResult.pollingPlaces,
          pollingTables: adapterResult.pollingTables
        }
      });

      if (error) throw error;

      const duracionMs = Date.now() - startTime;
      const status = data?.status === 'NO_CHANGES' ? 'NO_CHANGES' : 'EXITOSA';

      return {
        success: true,
        status,
        sha256,
        registrosRecibidos: totalRecibidos,
        registrosValidos: data?.registrosValidos || adapterResult.statistics.registrosValidos,
        cantidadNuevos: data?.cantidadNuevos || 0,
        cantidadModificados: data?.cantidadModificados || 0,
        cantidadDesactivados: 0,
        duracionMs,
        syncId: data?.syncId,
        processId: data?.processId,
        message: data?.message || 'Sincronización DIVIPOLE completada exitosamente.'
      };
    }
  } catch (err: any) {
    const duracionMs = Date.now() - startTime;
    return {
      success: false,
      status: 'FALLIDA_FUENTE_CAIDA',
      sha256,
      registrosRecibidos: totalRecibidos,
      registrosValidos: 0,
      cantidadNuevos: 0,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs,
      error: err?.message || 'Error en la transacción RPC de Supabase',
      message: `Fallo durante la sincronización: ${err?.message || 'Desconocido'}. Rollback automático ejecutado.`
    };
  }
}
