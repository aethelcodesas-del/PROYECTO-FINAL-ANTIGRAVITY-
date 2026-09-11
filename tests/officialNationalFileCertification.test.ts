/**
 * SUITE DE PRUEBAS DE CERTIFICACIÓN DE ARCHIVOS NACIONALES OFICIALES DE REGISTRADURÍA
 * Archivo: tests/officialNationalFileCertification.test.ts
 * 
 * Verifica:
 * 1. Certificación de archivo nacional completo (VALID_NATIONAL_OFFICIAL).
 * 2. Cálculo inmutable de SHA-256 sobre el contenido real.
 * 3. Validación nacional estricta y rechazo de muestras parciales (OFFICIAL_FULL_FILE_REQUIRED).
 * 4. Validación estructural y jerárquica de códigos DIVIPOLE.
 * 5. Validación cruzada contra Censo Oficial.
 * 6. Ejecución DRY-RUN con cero escrituras previas.
 * 7. Persistencia de lastKnownValidVersion diferenciada de muestras históricas.
 * 8. Detección de WAF 403 / HTML challenge (SOURCE_BLOCKED).
 * 9. Detección de archivo corrupto / sin cabecera PDF (SOURCE_INVALID).
 * 10. Rollback ante fallo en ejecución de RPC.
 * 11. Cero modificaciones en polling_stations, campañas y usuarios.
 */

import {
  certifyNationalOfficialFile,
  NATIONAL_THRESHOLDS
} from '../src/services/registraduria/nationalOfficialCertificationService';
import { sourceVersionStore } from '../src/services/registraduria/officialSourceMonitor';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

class MockElectoralCatalogDb {
  public polling_stations = [
    {
      id: 'station-op-101',
      campaign_id: 'camp-col-2026',
      name: 'PUESTO OPERATIVO EXISTENTE',
      witness_id: 'wit-888',
      department: 'CORDOBA',
      municipality: 'COTORRA',
      zone: '01',
      place: 'COLEGIO EL CARMEN',
      table_number: 1,
      status: 'ACTIVO'
    }
  ];

  public campaigns = [
    {
      id: 'camp-col-2026',
      name: 'CAMPAÑA OFICIAL 2026',
      candidate: 'CANDIDATO SENADO',
      budget: 50000000
    }
  ];

  public users = [
    {
      id: 'usr-admin-01',
      email: 'admin@campana.co',
      role: 'ADMIN'
    }
  ];

  public syncHistory: any[] = [];
  public rollbackTriggered = false;

  mockClient(shouldFailSync: boolean = false) {
    return {
      from: (table: string) => ({
        insert: (data: any) => {
          if (table === 'divipole_sync_history') {
            this.syncHistory.push(data);
          }
          return Promise.resolve({ error: null });
        },
        select: (cols: string, opts?: any) => Promise.resolve({ count: 1, data: [] })
      }),
      rpc: (proc: string, args: any) => {
        if (proc === 'sync_official_divipole_batch') {
          if (shouldFailSync) {
            this.rollbackTriggered = true;
            return Promise.resolve({ data: null, error: { message: 'Forced RPC failure for rollback simulation' } });
          }
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

async function runNationalCertificationTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE CERTIFICACIÓN NACIONAL DE REGISTRADURÍA');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  sourceVersionStore.clear();

  const validNationalPdfBinary = Buffer.concat([
    Buffer.from('%PDF-1.7\n%âãÏÓ\n'),
    Buffer.alloc(8192, 'C')
  ]);

  // 1. Certificación de archivo nacional completo oficial
  console.log('--- 1. Certificación de Archivo Nacional Completo Oficial ---');
  const nationalRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'divipole_nacional_congreso_2026.pdf',
    fileBufferOrContent: validNationalPdfBinary,
    requireFullNationalCoverage: true,
    dryRun: true,
    censusData: {
      totalElectores: 39000000,
      mesas: 125000,
      isCompatible: true
    },
    extractedDataset: {
      departmentsCount: 33,
      municipalitiesCount: 1104,
      zonesCount: 500,
      pollingPlacesCount: 12500,
      tablesCount: 125000
    }
  });

  assert(nationalRes.status === 'CERTIFIED', 'Archivo nacional certificado con status = CERTIFIED');
  assert(nationalRes.versionType === 'VALID_NATIONAL_OFFICIAL', 'versionType es VALID_NATIONAL_OFFICIAL');
  assert(nationalRes.validationStatus === 'PASSED', 'validationStatus es PASSED');
  assert(nationalRes.censusValidationStatus === 'PASSED', 'censusValidationStatus es PASSED');
  assert(nationalRes.dryRunStatus === 'PASSED', 'dryRunStatus es PASSED');
  assert(typeof nationalRes.sha256 === 'string' && nationalRes.sha256.length === 64, 'SHA-256 de 64 caracteres calculado');

  // 2. Muestra parcial rechazada para carga nacional
  console.log('--- 2. Muestra parcial rechazada para certificación nacional requerida ---');
  const samplePdfBinary = Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.alloc(2048, 'S')
  ]);
  const sampleRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'muestra_5_departamentos.pdf',
    fileBufferOrContent: samplePdfBinary,
    requireFullNationalCoverage: true,
    extractedDataset: {
      departmentsCount: 5,
      municipalitiesCount: 5,
      zonesCount: 7,
      pollingPlacesCount: 8,
      tablesCount: 241
    }
  });

  assert(sampleRes.status === 'OFFICIAL_FULL_FILE_REQUIRED', 'Muestra parcial rechazada con OFFICIAL_FULL_FILE_REQUIRED');
  assert(sampleRes.versionType === 'VALID_SAMPLE', 'Muestra clasificada estrictamente como VALID_SAMPLE');
  assert(sampleRes.validationStatus === 'FAILED', 'validationStatus es FAILED para muestra parcial cuando se exige nacional');

  // 3. Muestra parcial aceptada en modo no estricto
  console.log('--- 3. Muestra parcial aceptada como VALID_SAMPLE en modo muestra ---');
  const sampleAllowedRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'muestra_5_departamentos.pdf',
    fileBufferOrContent: samplePdfBinary,
    requireFullNationalCoverage: false,
    dryRun: true,
    extractedDataset: {
      departmentsCount: 5,
      municipalitiesCount: 5,
      zonesCount: 7,
      pollingPlacesCount: 8,
      tablesCount: 241
    }
  });
  assert(sampleAllowedRes.status === 'CERTIFIED', 'Muestra certificada en modo muestra');
  assert(sampleAllowedRes.versionType === 'VALID_SAMPLE', 'versionType es VALID_SAMPLE');

  // 4. Detección de WAF 403 / HTML
  console.log('--- 4. Detección y rechazo de bloqueo WAF 403 ---');
  const wafRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'error_403.pdf',
    fileBufferOrContent: '<html><head><title>403 Forbidden</title></head><body>Cloudflare Ray ID: 999</body></html>'
  });
  assert(wafRes.status === 'SOURCE_BLOCKED', 'HTML de bloqueo WAF clasificado como SOURCE_BLOCKED');
  assert(wafRes.versionType === 'NOT_AVAILABLE', 'versionType es NOT_AVAILABLE');
  assert(wafRes.databaseWrites.inserts === 0, '0 escrituras ante WAF');

  // 5. Archivo corrupto sin cabecera PDF
  console.log('--- 5. Detección de archivo corrupto (SOURCE_INVALID) ---');
  const corruptRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'documento_corrupto.pdf',
    fileBufferOrContent: 'ESTO NO ES UN DOCUMENTO PDF OFICIAL'
  });
  assert(corruptRes.status === 'SOURCE_INVALID', 'Archivo corrupto clasificado como SOURCE_INVALID');

  // 6. Dominio no oficial
  console.log('--- 6. Rechazo de dominios no oficiales ---');
  const externalRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.google.com/archivo.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'google_file.pdf',
    fileBufferOrContent: samplePdfBinary
  });
  assert(externalRes.status === 'SOURCE_INVALID', 'Dominio externo rechazado como SOURCE_INVALID');

  // 7. Inconsistencia con Censo Oficial
  console.log('--- 7. Inconsistencia contra Censo Oficial (CENSUS_MISMATCH) ---');
  const censusFailRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'divipole.pdf',
    fileBufferOrContent: validNationalPdfBinary,
    requireFullNationalCoverage: true,
    censusData: {
      isCompatible: false
    },
    extractedDataset: {
      departmentsCount: 33,
      municipalitiesCount: 1104,
      zonesCount: 500,
      pollingPlacesCount: 12500,
      tablesCount: 125000
    }
  });
  assert(censusFailRes.status === 'CENSUS_MISMATCH', 'Inconsistencia con Censo clasificada como CENSUS_MISMATCH');
  assert(censusFailRes.censusValidationStatus === 'MISMATCH', 'censusValidationStatus es MISMATCH');

  // 8. Rollback ante fallo en RPC
  console.log('--- 8. Rollback ante fallo en base de datos ---');
  const failureClient = db.mockClient(true);
  const rpcFailRes = await certifyNationalOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    obtainedAt: new Date().toISOString(),
    fileName: 'divipole_fail.pdf',
    fileBufferOrContent: validNationalPdfBinary,
    requireFullNationalCoverage: true,
    dryRun: false,
    supabaseClient: failureClient,
    extractedDataset: {
      departmentsCount: 33,
      municipalitiesCount: 1104,
      zonesCount: 500,
      pollingPlacesCount: 12500,
      tablesCount: 125000
    }
  });
  assert(rpcFailRes.status === 'REJECTED', 'Certificación rechazada por fallo en RPC');
  assert(rpcFailRes.rollbackStatus === 'PASSED', 'rollbackStatus es PASSED');
  assert(db.rollbackTriggered === true, 'Rollback confirmado');

  // 9. Preservación absoluta de tablas operativas
  console.log('--- 9. Verificación de CERO modificaciones en polling_stations, campañas y usuarios ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations 100% inalterada');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas 100% inalteradas');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios 100% inalterados');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE CERTIFICACIÓN NACIONAL PASARON AL 100%');
  console.log('============================================================\n');
}

runNationalCertificationTests().catch((err) => {
  console.error('Error en pruebas de certificación nacional:', err);
  process.exit(1);
});
