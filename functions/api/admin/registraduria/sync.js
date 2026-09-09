/**
 * ENDPOINT PROTEGIDO DE SINCRONIZACIÓN REGISTRADURÍA (CLOUDFLARE PAGES FUNCTIONS)
 * Ruta: /api/admin/registraduria/sync
 */

import { createClient } from '@supabase/supabase-js';
import { executeScheduledElectoralSync } from '../../../../src/services/registraduria/schedulerEngine';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

function verifyAuthorization(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = (env.CRON_SECRET || env.SYNC_ADMIN_KEY || env.GLOBAL_ADMIN_SECRET || '').trim();

  if (!validSecret) {
    return { authorized: false, reason: 'CRON_SECRET / SYNC_ADMIN_KEY no configurado en el servidor.' };
  }

  if (!token || token !== validSecret) {
    return { authorized: false, reason: 'Acceso no autorizado. Token de scheduler inválido o ausente.' };
  }

  return { authorized: true };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = verifyAuthorization(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.reason }), {
      status: 401,
      headers: JSON_HEADERS
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      success: true,
      status: 'READY_NO_DB',
      message: 'Servicio de sincronización activo. Credenciales de base de datos no conectadas en este worker.'
    }), { status: 200, headers: JSON_HEADERS });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: latestHistory } = await supabase
      .from('divipole_sync_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({
      success: true,
      service: 'RegistraduriaOfficialSyncService',
      history: latestHistory || []
    }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = verifyAuthorization(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.reason }), {
      status: 401,
      headers: JSON_HEADERS
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {}

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseClient = null;

  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  try {
    const result = await executeScheduledElectoralSync({
      processConfig: body.processConfig,
      sourceUrl: body.sourceUrl,
      sourceType: body.sourceType || 'DIVIPOLE',
      dryRun: Boolean(body.dryRun),
      maxRetries: body.maxRetries ?? 2,
      supabaseClient
    });

    const statusCode = result.success ? 200 : (result.status === 'FALLIDA_FUENTE_CAIDA' ? 502 : 422);

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      status: 'FALLIDA_FUENTE_CAIDA',
      error: err?.message || 'Error inesperado en la ejecución del sincronizador.'
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
