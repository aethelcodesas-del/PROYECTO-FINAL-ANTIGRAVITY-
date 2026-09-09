/**
 * MOTOR DE AUTOMATIZACIÓN Y SCHEDULER SEGURO DE REGISTRADURÍA (FASE 6 & 6.1)
 * 
 * Gestiona:
 * 1. Control de Concurrencia y Lock Distribuido en PostgreSQL / Supabase con Auto-Recuperación por TTL.
 * 2. Validación de Estado de Fuentes por Proceso (SOURCE_PENDING_CONFIGURATION).
 * 3. Detección de Anomalías / Variaciones Extremas de Datos (> 40% reducción o 0 puestos).
 * 4. Reintentos Controlados (Exponential Backoff) para Errores Transitorios.
 * 5. Ejecución Programada y Monitoreo de Auditoría sin Exposición de Secretos.
 */

import { ElectoralProcessConfig, OfficialAdapterResult } from './types';
import { fetchAndParseOfficialSource } from './registraduriaOfficialAdapter';
import { syncOfficialElectoralDataToSupabase, SyncExecutionResult } from './electoralSyncService';
import {
  getOfficialProcessSource,
  isSourceReadyForSync,
  OfficialProcessSourceDefinition
} from './processRegistry';

export interface SchedulerExecutionOptions {
  processConfig?: ElectoralProcessConfig;
  processId?: string;
  sourceUrl?: string;
  sourceType?: 'DIVIPOLE' | 'CENSO';
  dryRun?: boolean;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxAllowedReductionPct?: number; // Umbral máximo permitido de reducción de puestos antes de marcar anomalía (ej. 40%)
  supabaseClient?: any;
  workerId?: string;
  ttlMinutes?: number;
}

export interface SchedulerLockResult {
  acquired: boolean;
  reason?: string;
  recoveredExpired?: boolean;
  expiresAt?: string;
}

// Memoria de bloqueo en tiempo de ejecución (Fallback local)
let localExecutionTimestamp: number | null = null;
let localLockedBy: string | null = null;
const LOCAL_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Adquiere el Lock de sincronización.
 * Si se dispone de supabaseClient, utiliza la RPC distribuida PostgreSQL `acquire_official_sync_lock`.
 * En entornos locales o aislados, utiliza el control de memoria con expiración por TTL.
 */
export async function acquireDistributedSyncLock(
  supabaseClient?: any,
  lockKey: string = 'OFFICIAL_DIVIPOLE_SYNC_LOCK',
  lockedBy: string = `worker-${Math.random().toString(36).substring(2, 9)}`,
  ttlMinutes: number = 15
): Promise<SchedulerLockResult> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.rpc('acquire_official_sync_lock', {
        p_lock_key: lockKey,
        p_locked_by: lockedBy,
        p_ttl_minutes: ttlMinutes,
        p_metadata: { source: 'CloudflareWorker', timestamp: new Date().toISOString() }
      });

      if (error) {
        // Fallback a lock local si la tabla aún no existe en la instancia
        return acquireLocalSyncLock(lockedBy, ttlMinutes);
      }

      if (data && typeof data === 'object') {
        return {
          acquired: Boolean(data.acquired),
          reason: data.reason,
          recoveredExpired: Boolean(data.recovered_expired),
          expiresAt: data.expires_at
        };
      }
    } catch (e) {
      // Fallback seguro a lock local
      return acquireLocalSyncLock(lockedBy, ttlMinutes);
    }
  }

  return acquireLocalSyncLock(lockedBy, ttlMinutes);
}

/**
 * Libera el Lock de sincronización (en Supabase y/o memoria local).
 */
export async function releaseDistributedSyncLock(
  supabaseClient?: any,
  lockKey: string = 'OFFICIAL_DIVIPOLE_SYNC_LOCK',
  lockedBy: string = localLockedBy || 'local-worker'
): Promise<void> {
  if (supabaseClient) {
    try {
      await supabaseClient.rpc('release_official_sync_lock', {
        p_lock_key: lockKey,
        p_locked_by: lockedBy
      });
    } catch (e) {}
  }
  releaseLocalSyncLock();
}

/**
 * Lock local en memoria con TTL
 */
export function acquireLocalSyncLock(
  lockedBy: string = 'local-worker',
  ttlMinutes: number = 15
): SchedulerLockResult {
  const now = Date.now();
  const timeoutMs = ttlMinutes * 60 * 1000;

  if (localExecutionTimestamp !== null && (now - localExecutionTimestamp) < timeoutMs) {
    const elapsedMinutes = Math.round((now - localExecutionTimestamp) / 60000);
    return {
      acquired: false,
      reason: `Existe una sincronización oficial activa ejecutada por ${localLockedBy || 'otro worker'} iniciada hace ${elapsedMinutes} min. Solicitud concurrente bloqueada.`
    };
  }

  const wasExpired = localExecutionTimestamp !== null && (now - localExecutionTimestamp) >= timeoutMs;
  localExecutionTimestamp = now;
  localLockedBy = lockedBy;

  return {
    acquired: true,
    recoveredExpired: wasExpired,
    expiresAt: new Date(now + timeoutMs).toISOString()
  };
}

export function releaseLocalSyncLock(): void {
  localExecutionTimestamp = null;
  localLockedBy = null;
}

// Alias de compatibilidad
export const acquireSyncLock = () => acquireLocalSyncLock();
export const releaseSyncLock = () => releaseLocalSyncLock();

/**
 * Detecta variaciones anormalmente extremas entre el nuevo lote y el catálogo anterior
 */
export function detectAnomalousVariation(
  newPlacesCount: number,
  previousPlacesCount: number,
  maxReductionPct: number = 40
): { isAnomalous: boolean; reason?: string } {
  if (previousPlacesCount <= 0) return { isAnomalous: false };

  // 1. Reducción masiva no explicada (> umbral)
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
 * Orquestador Principal de la Sincronización Programada con Lock Distribuido, Control de Fuentes y Fail-Safe
 */
export async function executeScheduledElectoralSync(
  options: SchedulerExecutionOptions = {}
): Promise<SyncExecutionResult & { attempts: number; anomalyDetected: boolean }> {
  const processId = options.processId || options.processConfig?.codigoProceso || 'COL-2026-CONGRESO';
  const processSourceDef: OfficialProcessSourceDefinition = getOfficialProcessSource(processId);
  const processConfig = options.processConfig || processSourceDef.processConfig || DEFAULT_PROCESO_CONGRESO_2026;
  
  const workerId = options.workerId || `worker-${Math.random().toString(36).substring(2, 9)}`;
  const lockKey = `SYNC_LOCK_${processConfig.codigoProceso}`;
  const ttlMinutes = options.ttlMinutes ?? 15;

  // 1. Verificar si la fuente para este proceso está lista o pendiente de configuración
  const sourceUrl = options.sourceUrl || processSourceDef.sourceUrl;
  
  // Si no se proporcionó una URL manual válida y el proceso registrado no está listo para sincronizar
  const isCustomUrlProvided = Boolean(options.sourceUrl && options.sourceUrl.trim() !== '');
  if (!isCustomUrlProvided && !isSourceReadyForSync(processSourceDef)) {
    return {
      success: false,
      status: 'RECHAZADA_INCOMPLETA',
      sha256: 'SOURCE_PENDING_CONFIGURATION',
      registrosRecibidos: 0,
      registrosValidos: 0,
      cantidadNuevos: 0,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs: 0,
      attempts: 0,
      anomalyDetected: false,
      error: 'SOURCE_PENDING_CONFIGURATION',
      message: `Proceso ${processConfig.codigoProceso} en estado SOURCE_PENDING_CONFIGURATION. ${processSourceDef.notes} Se omite descarga y ejecución de RPC.`
    };
  }

  // Validar URL antes de proceder
  if (!sourceUrl || sourceUrl.trim() === '' || sourceUrl.includes('tu-dominio.com') || sourceUrl.includes('fuente-oficial.gov.co')) {
    return {
      success: false,
      status: 'RECHAZADA_INCOMPLETA',
      sha256: 'INVALID_SOURCE_URL',
      registrosRecibidos: 0,
      registrosValidos: 0,
      cantidadNuevos: 0,
      cantidadModificados: 0,
      cantidadDesactivados: 0,
      duracionMs: 0,
      attempts: 0,
      anomalyDetected: false,
      error: 'URL de fuente no configurada o es un placeholder de ejemplo.',
      message: 'Sincronización rechazada: URL de fuente oficial no configurada.'
    };
  }

  const maxRetries = options.maxRetries ?? 2;
  const backoffMs = options.initialBackoffMs ?? 1000;
  const maxReductionPct = options.maxAllowedReductionPct ?? 40;

  // 2. Adquirir Lock Distribuido
  const lock = await acquireDistributedSyncLock(options.supabaseClient, lockKey, workerId, ttlMinutes);
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
      message: lock.reason || 'Sincronización bloqueada por concurrencia distribuida.'
    };
  }

  let attempt = 0;
  let lastAdapterResult: OfficialAdapterResult | null = null;

  try {
    // 3. Bucle de Descarga con Reintentos Controlados para Errores Transitorios
    while (attempt <= maxRetries) {
      attempt++;
      lastAdapterResult = await fetchAndParseOfficialSource(sourceUrl, processConfig, {
        expectedType: options.sourceType || 'DIVIPOLE',
        timeoutMs: 15000
      });

      if (lastAdapterResult.success) {
        break; // Éxito en la descarga y parseo
      }

      // Si es un error no transitorio (403, 404, Captcha, bloqueo HTML), no reintentar agresivamente
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

    // 4. Verificación de Variación Anómala respecto al catálogo previo
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

    // 5. Ejecutar Sincronizador Seguro de Fase 5
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
    // 6. Liberar Lock Distribuido SIEMPRE en bloque finally
    await releaseDistributedSyncLock(options.supabaseClient, lockKey, workerId);
  }
}
