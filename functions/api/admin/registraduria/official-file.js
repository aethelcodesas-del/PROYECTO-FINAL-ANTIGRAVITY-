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

function verifyAuthorization(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = (env.SYNC_ADMIN_KEY || env.CRON_SECRET || '').trim();

  if (!validSecret) {
    return { authorized: false, reason: 'SYNC_ADMIN_KEY / CRON_SECRET no configurado en el servidor.' };
  }

  if (!token || token !== validSecret) {
    return { authorized: false, reason: 'Acceso no autorizado. Token administrativo inválido o ausente.' };
  }

  return { authorized: true };
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
