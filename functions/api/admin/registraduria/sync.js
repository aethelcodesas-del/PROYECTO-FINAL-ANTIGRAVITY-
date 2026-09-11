/**
 * ENDPOINT PROTEGIDO DE SINCRONIZACIÓN REGISTRADURÍA (CLOUDFLARE PAGES FUNCTIONS)
 * Ruta: /api/admin/registraduria/sync
 */

import { createClient } from '@supabase/supabase-js';
import { executeScheduledElectoralSync } from '../../../../src/services/registraduria/schedulerEngine';
import { getAllOfficialProcessSources } from '../../../../src/services/registraduria/processRegistry';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

async function verifyAuthorization(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { authorized: false, status: 401, reason: 'Acceso no autorizado. Token de autorización ausente.' };
  }

  const validSecrets = [
    (env.CRON_SECRET || '').trim(),
    (env.SYNC_ADMIN_KEY || '').trim(),
    (env.GLOBAL_ADMIN_SECRET || '').trim()
  ].filter(Boolean);

  if (validSecrets.length > 0 && validSecrets.includes(token)) {
    return { authorized: true, role: 'GLOBAL_ADMIN_SERVICE' };
  }

  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://cjvztlvxdsuiluybvtpl.supabase.co').replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      }
    });

    if (!userRes.ok) {
      return { authorized: false, status: 401, reason: 'La sesión administrativa ha expirado o es inválida.' };
    }

    const userData = await userRes.json();
    if (!userData || !userData.id) {
      return { authorized: false, status: 401, reason: 'Usuario no identificado.' };
    }

    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=id,role,status&limit=1`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      }
    });

    if (!profileRes.ok) {
      return { authorized: false, status: 403, reason: 'No fue posible validar los privilegios del perfil.' };
    }

    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile) {
      return { authorized: false, status: 403, reason: 'Perfil de usuario no encontrado.' };
    }

    const role = String(profile.role || '').trim().toUpperCase();
    const status = String(profile.status || '').trim().toUpperCase();

    const isGlobalAdmin = ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(role);
    const isActive = ['ACTIVE', 'ACTIVO'].includes(status);

    if (!isGlobalAdmin || !isActive) {
      return {
        authorized: false,
        status: 403,
        reason: 'Acceso denegado. Este servicio de sincronización es exclusivo para el Administrador Global.'
      };
    }

    return { authorized: true, role, userId: profile.id };
  } catch (err) {
    return { authorized: false, status: 401, reason: 'Error durante la verificación de autorización.' };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAuthorization(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.reason }), {
      status: auth.status || 401,
      headers: JSON_HEADERS
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const registeredProcesses = getAllOfficialProcessSources();

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      success: true,
      status: 'READY_NO_DB',
      message: 'Servicio de sincronización activo. Credenciales de base de datos no conectadas en este worker.',
      processes: registeredProcesses
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
      processes: registeredProcesses,
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
  const auth = await verifyAuthorization(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.reason }), {
      status: auth.status || 401,
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
      processId: body.processId,
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
