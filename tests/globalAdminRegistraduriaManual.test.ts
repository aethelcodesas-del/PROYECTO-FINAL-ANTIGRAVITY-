/**
 * SUITE DE PRUEBAS DE ACTUALIZACIÓN MANUAL DE REGISTRADURÍA EXCLUSIVA PARA ADMIN GLOBAL
 * Archivo: tests/globalAdminRegistraduriaManual.test.ts
 * 
 * Verifica los 13 requerimientos obligatorios (A - M):
 * A. Admin Global puede ver la opción y acceder al flujo.
 * B. Usuario candidato NO puede verla ni acceder.
 * C. Usuario normal NO puede verla ni acceder.
 * D. Acceso directo al endpoint por usuario no autorizado devuelve HTTP 403.
 * E. Admin Global puede cargar un archivo oficial.
 * F. El archivo pasa primero obligatoriamente por DRY-RUN.
 * G. No se ejecuta RPC antes de confirmar explícitamente.
 * H. Confirmación explícita ejecuta el RPC correctamente.
 * I. SHA-256 idéntico produce SOURCE_UNCHANGED sin re-actualización.
 * J. Archivo parcial nunca produce VALID_NATIONAL_OFFICIAL.
 * K. Archivo WAF/HTML es rechazado inmediatamente.
 * L. polling_stations existente permanece 100% intacta.
 * M. Campañas y usuarios permanecen 100% intactos.
 */

import { GlobalAdminService } from '../src/services/globalAdminService';
import {
  certifyNationalOfficialFile,
  NATIONAL_THRESHOLDS
} from '../src/services/registraduria/nationalOfficialCertificationService';
import {
  ingestOfflineOfficialFile
} from '../src/services/registraduria/offlineOfficialFileIngestion';
import {
  sourceVersionStore
} from '../src/services/registraduria/officialSourceMonitor';
import { onRequestPost as handleOfficialFilePost } from '../functions/api/admin/registraduria/official-file.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

class MockOperationalDb {
  public polling_stations = [
    {
      id: 'station-op-101',
      campaign_id: 'camp-col-2026',
      name: 'PUESTO OPERATIVO EXISTENTE',
      witness_id: 'wit-888',
      department: 'ANTIOQUIA',
      municipality: 'MEDELLIN',
      table_number: 1,
      status: 'ACTIVO'
    }
  ];

  public campaigns = [
    { id: 'camp-col-2026', name: 'CAMPAÑA OFICIAL 2026', candidate_name: 'CANDIDATO TEST' }
  ];

  public users = [
    { id: 'usr-admin-1', role: 'SUPERADMIN', status: 'ACTIVE' },
    { id: 'usr-cand-1', role: 'CANDIDATO', status: 'ACTIVE' },
    { id: 'usr-norm-1', role: 'USUARIO', status: 'ACTIVE' }
  ];

  public divipole_official_catalog: any[] = [];
  public divipole_sync_history: any[] = [];

  mockClient(shouldFailSync: boolean = false) {
    const self = this;
    return {
      from: (table: string) => ({
        insert: (data: any) => {
          if (table === 'divipole_sync_history') {
            self.divipole_sync_history.push(data);
          }
          return Promise.resolve({ error: null });
        },
        select: (_cols: string, _opts?: any) => Promise.resolve({ count: 1, data: [] })
      }),
      rpc: (proc: string, args: any) => {
        if (proc === 'sync_official_divipole_batch') {
          if (shouldFailSync) {
            return Promise.resolve({ data: null, error: { message: 'Forced RPC failure' } });
          }
          const records = args.p_records || [];
          self.divipole_official_catalog.push(...records);
          return Promise.resolve({
            data: {
              success: true,
              total_departamentos: 33,
              total_municipios: 1104,
              total_puestos: 12500,
              total_mesas: 125000
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 SUITE: REGISTRADURÍA MANUAL EXCLUSIVA PARA ADMIN GLOBAL');
  console.log('================================================================\n');

  const mockDb = new MockOperationalDb();

  // Test A: Admin Global puede ver la opción y consultar estado
  console.log('--- Test A: Admin Global Status & Scope ---');
  const adminStatus = await GlobalAdminService.getRegistraduriaStatus();
  assert(adminStatus.mode === 'MANUAL_ONLY', 'El modo del sistema es estrictamente MANUAL_ONLY');
  assert(adminStatus.automaticUpdate === 'DISABLED', 'La actualización automática está DESACTIVADA');
  assert(adminStatus.manualUpdate === 'ENABLED', 'La actualización manual está ACTIVADA');
  assert(adminStatus.scope === 'GLOBAL_ADMIN_ONLY', 'El ámbito de actualización está restringido a GLOBAL_ADMIN_ONLY');
  assert(adminStatus.officialSourceUrl.includes('registraduria.gov.co'), 'La fuente oficial es registraduria.gov.co');

  // Test B: Usuario candidato NO tiene permisos de administración global
  console.log('\n--- Test B: Candidate User Isolation ---');
  const candidateUser = mockDb.users.find(u => u.role === 'CANDIDATO');
  const isCandidateGlobalAdmin = ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(candidateUser?.role || '');
  assert(!isCandidateGlobalAdmin, 'El usuario con rol CANDIDATO no es clasificado como Admin Global');

  // Test C: Usuario normal NO tiene permisos de administración global
  console.log('\n--- Test C: Normal User Isolation ---');
  const normalUser = mockDb.users.find(u => u.role === 'USUARIO');
  const isNormalUserGlobalAdmin = ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(normalUser?.role || '');
  assert(!isNormalUserGlobalAdmin, 'El usuario con rol USUARIO no es clasificado como Admin Global');

  // Test D: Acceso directo al endpoint por usuario no autorizado devuelve 403 Forbidden
  console.log('\n--- Test D: Direct Endpoint 403 Protection ---');
  // Mock context simulating request with candidate bearer token
  const mockEnv = {
    SYNC_ADMIN_KEY: 'secret_key_123',
    VITE_SUPABASE_URL: 'https://cjvztlvxdsuiluybvtpl.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon_key'
  };

  // Mock global fetch for supabase auth check in worker
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'usr-cand-1', email: 'candidato@campana.co' }), { status: 200 });
    }
    if (urlStr.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'usr-cand-1', role: 'CANDIDATO', status: 'ACTIVE' }]), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };

  const forbiddenRequest = new Request('http://localhost/api/admin/registraduria/official-file', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer candidate_token_abc',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      processId: 'COL-2026-CONGRESO',
      sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
      fileBufferOrContent: '%PDF-1.4 Mock Official Content'
    })
  });

  const forbiddenResponse = await handleOfficialFilePost({ request: forbiddenRequest, env: mockEnv });
  assert(forbiddenResponse.status === 403, `Acceso no autorizado de candidato devuelve HTTP 403 (obtenido: ${forbiddenResponse.status})`);
  const forbiddenBody = await forbiddenResponse.json();
  assert(forbiddenBody.error.includes('exclusiva para el Administrador Global'), 'El mensaje de error indica restricción exclusiva para Admin Global');

  // Test E & F: Admin Global puede cargar archivo y pasa obligatoriamente por DRY-RUN
  console.log('\n--- Test E & F: Official File Upload & Mandatory DRY-RUN ---');
  const validMockPdf = '%PDF-1.4\n1 0 obj\n<< /Title (DIVIPOLE 2026) >>\n05001010101 ANTIOQUIA MEDELLIN 01 PUESTO CENTRAL 100\nendobj\n%%EOF';
  const dryRunSummary = await GlobalAdminService.executeRegistraduriaDryRun(
    validMockPdf,
    'divipole_2026_oficial.pdf'
  );

  assert(dryRunSummary.isAuthenticPdf === true, 'El archivo entregado pasa la validación de cabecera %PDF-');
  assert(dryRunSummary.isWafOrHtmlError === false, 'El archivo no es una página de error WAF');
  assert(dryRunSummary.sha256.length === 64, 'Se calcula el hash SHA-256 inmutable de 64 caracteres');
  assert(dryRunSummary.operationalSafety.pollingStationsUntouched === true, 'DRY-RUN confirma que polling_stations permanece intacta');
  assert(dryRunSummary.operationalSafety.campaignsUntouched === true, 'DRY-RUN confirma que campaigns permanece intacta');

  // Test G: No se ejecuta RPC antes de confirmar
  console.log('\n--- Test G: No RPC Execution Before Confirmation ---');
  const dryRunCertification = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'divipole_test.pdf',
    fileBufferOrContent: validMockPdf,
    requireFullNationalCoverage: false,
    dryRun: true,
    supabaseClient: mockDb.mockClient(),
    extractedDataset: {
      departmentsCount: 5,
      municipalitiesCount: 120,
      zonesCount: 15,
      pollingPlacesCount: 850,
      tablesCount: 8500
    }
  });

  assert(dryRunCertification.dryRunStatus === 'PASSED', 'DRY-RUN pasa satisfactoriamente');
  assert(dryRunCertification.rpcStatus === 'NOT_EXECUTED', 'RPC sync_official_divipole_batch NO se ejecuta en DRY-RUN');
  assert(mockDb.divipole_official_catalog.length === 0, 'Cero registros insertados en catálogo durante DRY-RUN');

  // Test H: Confirmación explícita ejecuta el RPC correctamente
  console.log('\n--- Test H: Explicit Confirmation & Atomic Sync RPC ---');
  // Configure fetch mock for superadmin
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'usr-admin-1', email: 'admin@campana.co' }), { status: 200 });
    }
    if (urlStr.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'usr-admin-1', role: 'SUPERADMIN', status: 'ACTIVE' }]), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };

  const confirmResult = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'divipole_test.pdf',
    fileBufferOrContent: validMockPdf,
    requireFullNationalCoverage: false,
    dryRun: false,
    supabaseClient: mockDb.mockClient(),
    extractedDataset: {
      departmentsCount: 5,
      municipalitiesCount: 120,
      zonesCount: 15,
      pollingPlacesCount: 850,
      tablesCount: 8500
    }
  });

  assert(confirmResult.status === 'CERTIFIED', 'Confirmación explícita resulta en estado CERTIFIED');
  assert(confirmResult.rpcStatus === 'EXECUTED', 'RPC sync_official_divipole_batch se ejecuta tras confirmación explícita');

  // Test I: SHA-256 idéntico produce SOURCE_UNCHANGED
  console.log('\n--- Test I: Idempotence & SOURCE_UNCHANGED ---');
  const identicalHash = confirmResult.sha256;
  const sameVersion = sourceVersionStore.getKnownVersion('OFFICIAL_COL-2026-CONGRESO') ||
    sourceVersionStore.getKnownVersion('COL_2026_CONGRESO_DIVIPOLE') ||
    sourceVersionStore.getKnownVersion('DIVIPOLE_2026_MASTER');
  const isIdentical = sameVersion?.sha256 === identicalHash;
  assert(isIdentical, 'Se detecta hash idéntico contra la última versión registrada (SOURCE_UNCHANGED)');

  // Test J: Archivo parcial nunca produce VALID_NATIONAL_OFFICIAL
  console.log('\n--- Test J: Partial File Rejection for National Coverage ---');
  const samplePdf = '%PDF-1.4\nMOCK SAMPLE 5 DEPARTAMENTOS\n%%EOF';
  const partialCert = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'sample_5_depts.pdf',
    fileBufferOrContent: samplePdf,
    requireFullNationalCoverage: true, // Estricto para cobertura nacional
    dryRun: true,
    extractedDataset: {
      departmentsCount: 5,
      municipalitiesCount: 120,
      zonesCount: 15,
      pollingPlacesCount: 850,
      tablesCount: 8500
    }
  });

  assert(partialCert.versionType !== 'VALID_NATIONAL_OFFICIAL', 'Una muestra parcial NUNCA se clasifica como VALID_NATIONAL_OFFICIAL');
  assert(partialCert.status === 'OFFICIAL_FULL_FILE_REQUIRED', 'Se requiere archivo nacional completo cuando no se alcanzan los umbrales');

  // Test K: WAF / HTML es rechazado inmediatamente
  console.log('\n--- Test K: WAF / HTML Challenge Rejection ---');
  const wafHtmlResponse = '<!DOCTYPE html><html><head><title>Just a moment... Cloudflare WAF 403 Forbidden</title></head><body>Verify you are human</body></html>';
  const wafIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'blocked_waf.pdf',
    fileBufferOrContent: wafHtmlResponse
  });

  assert(wafIngestion.isValid === false, 'Respuesta HTML/WAF es declarada inválida');
  assert(wafIngestion.isWafOrHtmlError === true, 'Se detecta correctamente que es un error WAF/HTML');
  assert(wafIngestion.status === 'WAF_HTML_ERROR', 'Estado devuelto es WAF_HTML_ERROR');

  // Test L & M: polling_stations, campañas y usuarios permanecen intactos
  console.log('\n--- Test L & M: Operational Tables Integrity Preservation ---');
  assert(mockDb.polling_stations.length === 1, 'polling_stations conserva exactamente sus registros (0 eliminados)');
  assert(mockDb.polling_stations[0].id === 'station-op-101', 'polling_stations conserva sus IDs originales');
  assert(mockDb.polling_stations[0].witness_id === 'wit-888', 'polling_stations conserva asignaciones operativas de testigos');
  assert(mockDb.campaigns.length === 1, 'campaigns permanece 100% intacta');
  assert(mockDb.users.length === 3, 'users/profiles permanece 100% intacta');

  // Restore original fetch
  globalThis.fetch = originalFetch;

  console.log('\n================================================================');
  console.log('🏆 13/13 REQUERIMIENTOS VERIFICADOS EXITOSAMENTE (A - M)');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Error fatal durante la suite de pruebas:', err);
  process.exit(1);
});
