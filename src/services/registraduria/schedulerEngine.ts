/**
 * MOTOR DE AUTOMATIZACIÓN Y SCHEDULER SEGURO DE REGISTRADURÍA (FASE 6)
 * 
 * Gestiona:
 * 1. Control de Concurrencia y Lock Anti-Colisiones.
 * 2. Detección de Anomalías / Variaciones Extremas de Datos.
 * 3. Reintentos Controlados (Exponential Backoff) para Errores Transitorios.
 * 4. Ejecución Programada y Monitoreo de Auditoría sin Exposición de Secretos.
 */

import { ElectoralProcessConfig, OfficialAdapterResult } from './types';
import { fetchAndParseOfficialSource } from './registraduriaOfficialAdapter';
import { syncOfficialElectoralDataToSupabase, SyncExecutionResult } from './electoralSyncService';

export interface SchedulerExecutionOptions {
  processConfig?: ElectoralProcessConfig;
  sourceUrl?: string;
  sourceType?: 'DIVIPOLE' | 'CENSO';
  dryRun?: boolean;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxAllowedReductionPct?: number; // Umbral máximo permitido de reducción de puestos antes de marcar anomalía (ej. 40%)
  supabaseClient?: any;
}

export interface SchedulerLockResult {
  acquired: boolean;
  reason?: string;
}

// Memoria de bloqueo en tiempo de ejecución (Anti-Concurrencia)
let activeExecutionTimestamp: number | null = null;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos de expiración de lock

export function acquireSyncLock(): SchedulerLockResult {
  const now = Date.now();
  if (activeExecutionTimestamp !== null && (now - activeExecutionTimestamp) < LOCK_TIMEOUT_MS) {
    const elapsedMinutes = Math.round((now - activeExecutionTimestamp) / 60000);
    return {
      acquired: false,
      reason: `Existe una sincronización oficial en ejecución activa iniciada hace ${elapsedMinutes} min. Solicitud concurrente bloqueada.`
    };
  }
  activeExecutionTimestamp = now;
  return { acquired: true };
}

export function releaseSyncLock(): void {
  activeExecutionTimestamp = null;
}

/**
 * Detecta variaciones anormalmente extremas entre el nuevo lote y el catálogo anterior
 */
export function detectAnomalousVariation(
  newPlacesCount: number,
  previousPlacesCount: number,
  maxReductionPct: number = 40
): { isAnomalous: boolean; reason?: string } {
  if (previousPlacesCount <= 0) return { isAnomalous: false };

  // 1. Reducción masiva no explicada
  if (newPlacesCount < previousPlacesCount) {
    const reductionPct = ((previousPlacesCount - newPlacesCount) / previousPlacesCount) * 100;
    if (reductionPct > maxReductionPct) {
      return {
        isAnomalous: true,
        reason: `Variación anómala detectada: Reducción del ${reductionPct.toFixed(1)}% de puestos de votación (${previousPlacesCount} -> ${newPlacesCount}). Supera el umbral de seguridad del ${maxReductionPct}%. Lote rechazado para proteger el catálogo histórico.`
      };
    }
  }

  // 2. Cero registros en un catálogo previamente poblado
  if (newPlacesCount === 0 && previousPlacesCount > 0) {
    return {
      isAnomalous: true,
      reason: 'El nuevo lote contiene 0 puestos de votación cuando el catálogo oficial previo ya tenía registros.'
    };
  }

  return { isAnomalous: false };
}

/**
 * Proceso electoral por defecto para 2026
 */
export const DEFAULT_PROCESO_CONGRESO_2026: ElectoralProcessConfig = {
  codigoProceso: 'COL-2026-CONGRESO',
  nombre: 'Elecciones de Congreso de la República 2026',
  tipoProceso: 'NACIONAL',
  anio: 2026,
  fechaEleccion: '2026-03-08',
  corporacionesHabilitadas: ['SENADO', 'CAMARA']
};

/**
 * Orquestador de la Sincronización Programada con Reintentos y Fail-Safe
 */
export async function executeScheduledElectoralSync(
  options: SchedulerExecutionOptions = {}
): Promise<SyncExecutionResult & { attempts: number; anomalyDetected: boolean }> {
  const processConfig = options.processConfig || DEFAULT_PROCESO_CONGRESO_2026;
  const sourceUrl = options.sourceUrl || 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf';
  const maxRetries = options.maxRetries ?? 2;
  const backoffMs = options.initialBackoffMs ?? 1000;
  const maxReductionPct = options.maxAllowedReductionPct ?? 40;

  // 1. Adquirir Lock Anti-Concurrencia
  const lock = acquireSyncLock();
  if (!lock.acquired) {
    return {
      success: false,
      status: 'FALLIDA_FUENTE_CAIDA',
      sha256: 'LOCKED',
      registrosRecibidos: 0,
      registrosValidos: 0,
      cantidadNuevos: 0,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs: 0,
      attempts: 0,
      anomalyDetected: false,
      error: lock.reason,
      message: lock.reason || 'Sincronización bloqueada por concurrencia.'
    };
  }

  let attempt = 0;
  let lastAdapterResult: OfficialAdapterResult | null = null;

  try {
    // 2. Bucle de Descarga con Reintentos Controlados para Errores Transitorios
    while (attempt <= maxRetries) {
      attempt++;
      lastAdapterResult = await fetchAndParseOfficialSource(sourceUrl, processConfig, {
        expectedType: options.sourceType || 'DIVIPOLE',
        timeoutMs: 15000
      });

      if (lastAdapterResult.success) {
        break; // Éxito en la descarga y parseo
      }

      // Si es un error no transitorio (403, 404, Captcha, bloqueo HTML), no tiene sentido reintentar agresivamente
      const errMsg = lastAdapterResult.rawErrorMessage || '';
      const isNonTransient = errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('Captcha') || errMsg.includes('protección');
      if (isNonTransient || attempt > maxRetries) {
        break;
      }

      // Esperar tiempo de backoff antes del siguiente intento
      await new Promise(res => setTimeout(res, backoffMs * attempt));
    }

    if (!lastAdapterResult || !lastAdapterResult.success) {
      const failStatus = (lastAdapterResult?.rawErrorMessage?.includes('403') || lastAdapterResult?.rawErrorMessage?.includes('404') || lastAdapterResult?.rawErrorMessage?.includes('Tiempo de espera'))
        ? 'FALLIDA_FUENTE_CAIDA'
        : 'RECHAZADA_INCOMPLETA';

      return {
        success: false,
        status: failStatus,
        sha256: lastAdapterResult?.sha256 || 'ERROR',
        registrosRecibidos: 0,
        registrosValidos: 0,
        cantidadNuevos: 0,
        cantidadModificados: 0,
        cantidadDesactivados: 0,
        duracionMs: 0,
        attempts: attempt,
        anomalyDetected: false,
        error: lastAdapterResult?.rawErrorMessage || 'No fue posible obtener un lote oficial válido.',
        message: `Sincronización rechazada tras ${attempt} intento(s): ${lastAdapterResult?.rawErrorMessage || 'Fallo de fuente oficial'}.`
      };
    }

    // 3. Verificación de Variación Anómala respecto al catálogo previo
    // (En modo Supabase real se puede consultar la cantidad previa de puestos)
    let previousCount = 0;
    if (options.supabaseClient) {
      try {
        const { count } = await options.supabaseClient
          .from('divipole_polling_places')
          .select('id', { count: 'exact', head: true });
        previousCount = count || 0;
      } catch (e) {}
    }

    const anomalyCheck = detectAnomalousVariation(
      lastAdapterResult.pollingPlaces.length,
      previousCount,
      maxReductionPct
    );

    if (anomalyCheck.isAnomalous) {
      return {
        success: false,
        status: 'RECHAZADA_INCOMPLETA',
        sha256: lastAdapterResult.sha256,
        registrosRecibidos: lastAdapterResult.statistics.registrosRecibidos,
        registrosValidos: 0,
        cantidadNuevos: 0,
        cantidadModificados: 0,
        cantidadDesactivados: 0,
        duracionMs: 0,
        attempts: attempt,
        anomalyDetected: true,
        error: anomalyCheck.reason,
        message: `Sincronización abortada por protección de anomalías: ${anomalyCheck.reason}`
      };
    }

    // 4. Ejecutar Sincronizador Seguro de Fase 5
    const syncRes = await syncOfficialElectoralDataToSupabase(lastAdapterResult, {
      supabaseClient: options.supabaseClient,
      dryRun: options.dryRun ?? false,
      minThresholdPollingPlaces: 1
    });

    return {
      ...syncRes,
      attempts: attempt,
      anomalyDetected: false
    };
  } finally {
    // 5. Liberar Lock siempre
    releaseSyncLock();
  }
}
