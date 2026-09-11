/**
 * ENDPOINT PROTEGIDO DE RECEPCIÓN Y CERTIFICACIÓN DE ARCHIVOS OFICIALES DE REGISTRADURÍA
 * Ruta: /api/admin/registraduria/official-file (POST)
 */

import { createClient } from '@supabase/supabase-js';
import { certifyNationalOfficialFile } from '../../../../src/services/registraduria/nationalOfficialCertificationService';
import { isAuthorizedRegistraduriaDomain } from '../../../../src/services/registraduria/officialSourceMonitor';

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

  // 1. Validar si coincide con secretos de servidor / worker autorizados
  const validSecrets = [
    (env.SYNC_ADMIN_KEY || '').trim(),
    (env.CRON_SECRET || '').trim(),
    (env.GLOBAL_ADMIN_SECRET || '').trim()
  ].filter(Boolean);

  if (validSecrets.length > 0 && validSecrets.includes(token)) {
    return { authorized: true, role: 'GLOBAL_ADMIN_SERVICE' };
  }

  // 2. Validar JWT de usuario contra Supabase Auth y perfiles con rol SUPERADMIN / GLOBAL_ADMIN
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
        reason: 'Acceso denegado. La actualización manual de Registraduría es exclusiva para el Administrador Global / Superadmin.'
      };
    }

    return { authorized: true, role, userId: profile.id };
  } catch (err) {
    return { authorized: false, status: 401, reason: 'Error durante la verificación de autorización administrativa.' };
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
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'JSON payload inválido.' }), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const processId = body.processId || 'COL-2026-CONGRESO';
  const sourceOriginUrl = body.sourceOriginUrl || '';
  const fileName = body.fileName || 'divipole_oficial.pdf';
  const fileContent = body.fileBufferOrContent || body.content || '';
  const dryRun = body.dryRun !== undefined ? Boolean(body.dryRun) : true;
  const requireFullNationalCoverage = body.requireFullNationalCoverage !== undefined
    ? Boolean(body.requireFullNationalCoverage)
    : true;

  if (!sourceOriginUrl || !isAuthorizedRegistraduriaDomain(sourceOriginUrl)) {
    return new Response(JSON.stringify({
      success: false,
      status: 'SOURCE_INVALID',
      error: 'La URL de origen debe pertenecer estrictamente al dominio oficial www.registraduria.gov.co.'
    }), { status: 422, headers: JSON_HEADERS });
  }

  if (!fileContent) {
    return new Response(JSON.stringify({
      success: false,
      status: 'SOURCE_INVALID',
      error: 'Contenido del archivo oficial no proporcionado.'
    }), { status: 400, headers: JSON_HEADERS });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseClient = null;
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  try {
    const result = await certifyNationalOfficialFile({
      processId,
      sourceOriginUrl,
      obtainedAt: body.obtainedAt || new Date().toISOString(),
      fileName,
      fileBufferOrContent: fileContent,
      requireFullNationalCoverage,
      dryRun,
      supabaseClient,
      censusData: body.censusData,
      extractedDataset: body.extractedDataset
    });

    const isSuccess = result.status === 'CERTIFIED';
    const statusCode = isSuccess ? 200 : (result.status === 'OFFICIAL_FULL_FILE_REQUIRED' ? 422 : 400);

    return new Response(JSON.stringify({
      success: isSuccess,
      certification: result
    }), {
      status: statusCode,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      status: 'REJECTED',
      error: err?.message || 'Error durante la certificación del archivo oficial.'
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
