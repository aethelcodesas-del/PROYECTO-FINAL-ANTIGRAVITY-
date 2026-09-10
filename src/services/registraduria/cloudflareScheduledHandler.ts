/**
 * HANDLER DE EVENTOS PROGRAMADOS DE CLOUDFLARE (FASE 6.1)
 * Archivo: src/services/registraduria/cloudflareScheduledHandler.ts
 * 
 * Cadena de Ejecución:
 * Cloudflare Scheduled Trigger (cron: "0 3 * * 0" UTC)
 *  → scheduled handler (handleScheduledEvent)
 *  → executeScheduledElectoralSync()
 *  → electoralSyncService
 *  → RPC Supabase (sync_official_divipole_batch / sync_official_census_batch)
 */

import { createClient } from '@supabase/supabase-js';
import { executeScheduledElectoralSync } from './schedulerEngine';
import { getAllOfficialProcessSources, OfficialProcessSourceDefinition } from './processRegistry';

export interface CloudflareScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface CloudflareWorkerEnv {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CRON_SECRET?: string;
  SYNC_ADMIN_KEY?: string;
  [key: string]: any;
}

export interface ScheduledExecutionSummary {
  cron: string;
  timestamp: string;
  timezoneConversion: string;
  results: Array<{
    processId: string;
    status: string;
    message: string;
    success: boolean;
  }>;
}

/**
 * Procesa el evento Scheduled de Cloudflare
 */
export async function handleScheduledEvent(
  event: CloudflareScheduledEvent,
  env: CloudflareWorkerEnv,
  ctx?: { waitUntil: (promise: Promise<any>) => void },
  options?: { dryRun?: boolean }
): Promise<ScheduledExecutionSummary> {
  const cronExpr = event?.cron || '0 3 * * 0';
  const now = new Date();

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseClient: any = null;
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  const registeredSources: OfficialProcessSourceDefinition[] = getAllOfficialProcessSources();
  const executionResults: ScheduledExecutionSummary['results'] = [];

  for (const sourceDef of registeredSources) {
    const sourceIdentifier = sourceDef.sourceId || sourceDef.processConfig.codigoProceso;

    // Si la fuente está en estado pendiente de configuración o deshabilitada, omitir de forma segura sin llamar a la RPC
    if (sourceDef.status === 'SOURCE_PENDING_CONFIGURATION' || !sourceDef.enabled) {
      executionResults.push({
        processId: sourceIdentifier,
        status: 'SOURCE_PENDING_CONFIGURATION',
        message: `Omitido: ${sourceDef.notes}`,
        success: true // Omitido controlado exitosamente
      });
      continue;
    }

    try {
      const syncResult = await executeScheduledElectoralSync({
        processId: sourceIdentifier,
        processConfig: sourceDef.processConfig,
        sourceUrl: sourceDef.sourceUrl || undefined,
        supabaseClient,
        dryRun: options?.dryRun ?? false,
        workerId: `cf-scheduled-${cronExpr.replace(/\s+/g, '_')}`
      });

      executionResults.push({
        processId: sourceIdentifier,
        status: syncResult.status,
        message: syncResult.message,
        success: syncResult.success
      });
    } catch (err: any) {
      executionResults.push({
        processId: sourceIdentifier,
        status: 'FALLIDA_FUENTE_CAIDA',
        message: err?.message || 'Error inesperado durante ejecución programada.',
        success: false
      });
    }
  }

  return {
    cron: cronExpr,
    timestamp: now.toISOString(),
    timezoneConversion: 'Cron "0 3 * * 0" UTC corresponde a Sábados 22:00 (10:00 PM) Hora Colombia (UTC-5)',
    results: executionResults
  };
}

/**
 * Exportación estándar de Cloudflare Worker con soporte de Scheduled Handler
 */
export default {
  async scheduled(event: CloudflareScheduledEvent, env: CloudflareWorkerEnv, ctx: any) {
    return handleScheduledEvent(event, env, ctx);
  },

  async fetch(request: Request, env: CloudflareWorkerEnv, ctx: any) {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const validSecret = (env.CRON_SECRET || env.SYNC_ADMIN_KEY || '').trim();

    if (!validSecret || token !== validSecret) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    const summary = await handleScheduledEvent(
      { cron: 'manual-trigger', scheduledTime: Date.now() },
      env,
      ctx
    );

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
};
