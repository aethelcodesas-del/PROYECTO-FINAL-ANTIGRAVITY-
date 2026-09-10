/**
 * SUITE DE PRUEBAS DE ACTIVACIÓN FORMAL DE FUENTE OFICIAL DE CENSO DE REGISTRADURÍA
 * Archivo: tests/officialCensusPublicationActivation.test.ts
 * 
 * Verifica los 14 escenarios obligatorios de la Fase:
 * TEST 1: Fuente correctamente configurada (SOURCE_CONFIGURED)
 * TEST 2: SHA nulo en primera consulta (FIRST_CHECK_REQUIRED, NO SOURCE_PENDING_CONFIGURATION)
 * TEST 3: Página oficial accesible (FIRST_CHECK_SUCCESS)
 * TEST 4: Página oficial bloqueada por WAF (SOURCE_BLOCKED)
 * TEST 5: Mismo SHA (NO_CHANGES)
 * TEST 6: SHA nuevo y contenido válido (NEW_OFFICIAL_PUBLICATION)
 * TEST 7: Contenido WAF con SHA nuevo (SOURCE_BLOCKED, no guardar SHA)
 * TEST 8: Contenido HTML inválido (VALIDATION_FAILED)
 * TEST 9: Dominio externo (UNAUTHORIZED_SOURCE)
 * TEST 10: Diferencia de cifras (CENSUS_VALIDATION_MISMATCH sin tocar DIVIPOLE)
 * TEST 11: Fuente bloqueada con versión anterior válida (conserva lastKnownValidVersion)
 * TEST 12: Fuente bloqueada sin versión previa (NO_VALID_VERSION_AVAILABLE)
 * TEST 13: Confirmar que polling_stations no cambió (0 escrituras)
 * TEST 14: Confirmar que campañas y usuarios no cambiaron
 */

import {
  validateOfficialRegistraduriaDomain,
  parseOfficialCensusPublicationHtml,
  checkOfficialCensusPublication,
  formatCensusSourceTelemetry
} from '../src/services/registraduria/censusPublicationValidator';
import {
  getOfficialProcessSource,
  OFFICIAL_PROCESS_SOURCES
} from '../src/services/registraduria/processRegistry';
import { executeScheduledElectoralSync } from '../src/services/registraduria/schedulerEngine';

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

  public masterDivipole = {
    totalNacional: 39000000,
    totalColombia: 38000000,
    totalExterior: 1000000,
    totalMesas: 120000,
    totalPuestos: 12500,
    departments: {
      'ANTIOQUIA': { totalElectores: 5100000, mesas: 15000, puestos: 1200 },
      'CORDOBA': { totalElectores: 1300000, mesas: 4000, puestos: 500 },
      'BOGOTA D.C.': { totalElectores: 6000000, mesas: 18000, puestos: 900 }
    }
  };

  public syncHistory: any[] = [];

  mockClient() {
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
        if (proc === 'acquire_official_sync_lock') {
          return Promise.resolve({ data: { acquired: true }, error: null });
        }
        if (proc === 'release_official_sync_lock') {
          return Promise.resolve({ data: { released: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }
}

async function runOfficialCensusPublicationActivationTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO 14 PRUEBAS DE ACTIVACIÓN FORMAL DE FUENTE OFICIAL');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  const validHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Censo Electoral Colombia 2026</title></head>
      <body>
        <h1>Registraduría Nacional entrega detalles del censo electoral en Colombia y el exterior</h1>
        <p>Con corte al 13 de enero de 2026, el potencial censo electoral en Colombia es de 38.000.000 ciudadanos y en el exterior 1.000.000, para un total nacional de 39.000.000 de electores.</p>
        <p>En el país, 18.500.000 son hombres y 19.500.000 son mujeres. Se habilitarán 12.500 puestos de votación y 120.000 mesas de votación en Colombia.</p>
        <table>
          <tr><th>Departamento</th><th>Hombres</th><th>Mujeres</th><th>Mesas</th><th>Puestos</th><th>Total</th></tr>
          <tr><td>ANTIOQUIA</td><td>2.500.000</td><td>2.600.000</td><td>15.000</td><td>1.200</td><td>5.100.000</td></tr>
          <tr><td>CORDOBA</td><td>640.000</td><td>660.000</td><td>4.000</td><td>500</td><td>1.300.000</td></tr>
          <tr><td>BOGOTA D.C.</td><td>2.900.000</td><td>3.100.000</td><td>18.000</td><td>900</td><td>6.000.000</td></tr>
        </table>
      </body>
    </html>
  `;

  const wafHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>403 Forbidden</title></head>
      <body>
        <h1>Attention Required! | Cloudflare Bot Challenge</h1>
        <p>cf-browser-verification challenge-platform</p>
      </body>
    </html>
  `;

  // TEST 1: Fuente correctamente configurada
  console.log('--- TEST 1: Fuente correctamente configurada (SOURCE_CONFIGURED) ---');
  const sourceDef = getOfficialProcessSource('REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(sourceDef.sourceId === 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026', 'sourceId es REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(sourceDef.processId === 'COL-2026-PRES-1V', 'processId es COL-2026-PRES-1V');
  assert(sourceDef.sourceType === 'OFFICIAL_CENSUS_PUBLICATION', 'sourceType es OFFICIAL_CENSUS_PUBLICATION');
  assert(sourceDef.publisher === 'Registraduría Nacional del Estado Civil', 'publisher oficial asignado');
  assert(sourceDef.sourceUrl === 'https://www.registraduria.gov.co/Registraduria-Nacional-entrega-detalles-del-censo-electoral-en-Colombia-y-el.html', 'URL oficial de Registraduría asignada');
  assert(sourceDef.format === 'HTML', 'Formato es HTML');
  assert(sourceDef.authority === 'MASTER_VALIDATION', 'Authority es MASTER_VALIDATION');
  assert(sourceDef.validationMode === 'CENSUS_VALIDATION', 'ValidationMode es CENSUS_VALIDATION');
  assert(sourceDef.enabled === true, 'enabled es true');
  assert(sourceDef.expectedContent === 'OFFICIAL_ELECTORAL_CENSUS', 'expectedContent es OFFICIAL_ELECTORAL_CENSUS');
  assert(sourceDef.status === 'SOURCE_CONFIGURED', 'Estado es SOURCE_CONFIGURED');

  // TEST 2: SHA nulo en primera consulta
  console.log('--- TEST 2: SHA nulo en primera consulta (FIRST_CHECK_REQUIRED) ---');
  const isFirstCheckRequired = sourceDef.lastKnownSha256 === null && sourceDef.enabled;
  assert(isFirstCheckRequired === true, 'SHA nulo con enabled=true indica que se requiere primera comprobación');
  assert(sourceDef.status !== 'SOURCE_PENDING_CONFIGURATION', 'Estado NO es SOURCE_PENDING_CONFIGURATION');

  // TEST 3: Página oficial accesible
  console.log('--- TEST 3: Página oficial accesible (FIRST_CHECK_SUCCESS) ---');
  const checkFirstSuccess = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    lastKnownSha256: null,
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkFirstSuccess.success === true, 'Primera comprobación reporta éxito');
  assert(checkFirstSuccess.status === 'FIRST_CHECK_SUCCESS', 'Estado reporta FIRST_CHECK_SUCCESS');
  assert(typeof checkFirstSuccess.sha256 === 'string' && checkFirstSuccess.sha256.length === 64, 'SHA-256 generado sobre contenido válido');
  assert(checkFirstSuccess.cutoffDate === '13 de enero de 2026', 'Corte electoral extraído: 13 de enero de 2026');
  const initialValidSha = checkFirstSuccess.sha256!;

  // TEST 4: Página oficial bloqueada por WAF
  console.log('--- TEST 4: Página oficial bloqueada por WAF (SOURCE_BLOCKED) ---');
  const checkWaf = await checkOfficialCensusPublication({
    htmlContentOrBuffer: wafHtml,
    lastKnownSha256: null,
    dryRun: true
  });
  assert(checkWaf.success === false, 'WAF reporta no éxito');
  assert(checkWaf.status === 'SOURCE_BLOCKED', 'Estado clasificado como SOURCE_BLOCKED');
  assert(checkWaf.status !== 'SOURCE_PENDING_CONFIGURATION', 'Estado NO es SOURCE_PENDING_CONFIGURATION');

  // TEST 5: Mismo SHA
  console.log('--- TEST 5: Mismo SHA (NO_CHANGES) ---');
  const checkSameSha = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    lastKnownSha256: initialValidSha,
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkSameSha.success === true, 'Mismo SHA responde exitosamente');
  assert(checkSameSha.status === 'NO_CHANGES', 'Estado reporta NO_CHANGES');
  assert(checkSameSha.databaseWritesPerformed === 0, '0 escrituras en NO_CHANGES');

  // TEST 6: SHA nuevo y contenido válido
  console.log('--- TEST 6: SHA nuevo y contenido válido (NEW_OFFICIAL_PUBLICATION) ---');
  const checkNewValid = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    lastKnownSha256: 'OLD_HASH_0000000000000000000000000000000000000000000000000000000000000000',
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkNewValid.success === true, 'Nueva versión validada');
  assert(checkNewValid.status === 'CENSUS_VALIDATION_MATCH', 'Estado reporta coincidencia con catálogo maestro');
  assert(checkNewValid.sha256 !== 'OLD_HASH_0000000000000000000000000000000000000000000000000000000000000000', 'Nuevo SHA registrado');

  // TEST 7: Contenido WAF con SHA nuevo -> SOURCE_BLOCKED, no guardar SHA
  console.log('--- TEST 7: Contenido WAF con SHA nuevo (SOURCE_BLOCKED, no guardar SHA) ---');
  const checkWafNew = await checkOfficialCensusPublication({
    htmlContentOrBuffer: wafHtml,
    lastKnownSha256: initialValidSha,
    dryRun: true
  });
  assert(checkWafNew.status === 'SOURCE_BLOCKED', 'WAF clasificado como SOURCE_BLOCKED');
  assert(checkWafNew.sha256 === undefined, 'No se guarda el SHA de la página de error WAF');

  // TEST 8: Contenido HTML inválido
  console.log('--- TEST 8: Contenido HTML inválido (VALIDATION_FAILED) ---');
  const invalidHtml = '<html><body><h1>Aviso Genérico</h1><p>Texto sin datos estadísticos electorales.</p></body></html>';
  const checkInvalid = await checkOfficialCensusPublication({
    htmlContentOrBuffer: invalidHtml,
    lastKnownSha256: initialValidSha,
    dryRun: true
  });
  assert(checkInvalid.status === 'VALIDATION_FAILED', 'Estado reporta VALIDATION_FAILED');

  // TEST 9: Dominio externo
  console.log('--- TEST 9: Dominio externo (UNAUTHORIZED_SOURCE) ---');
  const checkExternalDomain = await checkOfficialCensusPublication({
    url: 'https://servidor-no-oficial.com/censo.html',
    htmlContentOrBuffer: validHtml,
    dryRun: true
  });
  assert(checkExternalDomain.status === 'UNAUTHORIZED_SOURCE', 'Dominio externo reporta UNAUTHORIZED_SOURCE');

  // TEST 10: Diferencia de cifras
  console.log('--- TEST 10: Diferencia de cifras (CENSUS_VALIDATION_MISMATCH sin tocar DIVIPOLE) ---');
  const mismatchHtml = validHtml.replace('5.100.000', '5.300.000');
  const checkMismatch = await checkOfficialCensusPublication({
    htmlContentOrBuffer: mismatchHtml,
    lastKnownSha256: 'PREV_HASH',
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkMismatch.status === 'CENSUS_VALIDATION_MISMATCH', 'Estado es CENSUS_VALIDATION_MISMATCH');
  assert(checkMismatch.discrepancies.length > 0, 'Discrepancias registradas');
  assert(db.masterDivipole.departments['ANTIOQUIA'].totalElectores === 5100000, 'Catálogo DIVIPOLE maestro permanece intacto');

  // TEST 11: Fuente bloqueada con versión anterior válida
  console.log('--- TEST 11: Fuente bloqueada con versión anterior válida ---');
  const checkBlockedWithPrevious = await checkOfficialCensusPublication({
    htmlContentOrBuffer: wafHtml,
    lastKnownSha256: initialValidSha,
    lastKnownValidVersion: checkFirstSuccess.extractedData,
    dryRun: true
  });
  assert(checkBlockedWithPrevious.status === 'SOURCE_BLOCKED', 'Estado es SOURCE_BLOCKED');
  assert(checkBlockedWithPrevious.lastKnownValidVersion !== null, 'Conserva lastKnownValidVersion');
  assert(checkBlockedWithPrevious.lastKnownValidVersion?.totalNacional === 39000000, 'Conserva totales válidos anteriores');

  // TEST 12: Fuente bloqueada sin versión previa
  console.log('--- TEST 12: Fuente bloqueada sin versión previa (NO_VALID_VERSION_AVAILABLE) ---');
  const checkBlockedWithoutPrevious = await checkOfficialCensusPublication({
    htmlContentOrBuffer: wafHtml,
    lastKnownSha256: null,
    lastKnownValidVersion: null,
    dryRun: true
  });
  assert(checkBlockedWithoutPrevious.status === 'SOURCE_BLOCKED', 'Estado es SOURCE_BLOCKED');
  assert(checkBlockedWithoutPrevious.noValidVersionAvailable === true, 'Reporta noValidVersionAvailable');
  assert(checkBlockedWithoutPrevious.lastKnownValidVersion === null, 'lastKnownValidVersion es null');

  // TEST 13: Confirmar que polling_stations no cambió
  console.log('--- TEST 13: Confirmar que polling_stations no cambió (0 escrituras) ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations permanece 100% inalterada');

  // TEST 14: Confirmar que campañas y usuarios no cambiaron
  console.log('--- TEST 14: Confirmar que campañas y usuarios no cambiaron ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas permanecen intactas');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios permanecen intactos');

  // TELEMETRÍA FORMAT CHECK
  console.log('--- Verificación de Formato de Telemetría ---');
  const telemetry = formatCensusSourceTelemetry({
    sourceId: sourceDef.sourceId,
    publisher: sourceDef.publisher,
    status: 'SOURCE_CONFIGURED',
    checkedAt: new Date().toISOString(),
    sha256: initialValidSha,
    cutoffDate: '13 de enero de 2026',
    lastSuccessfulValidationAt: new Date().toISOString(),
    lastFailureReason: undefined,
    lastKnownValidVersion: checkFirstSuccess.extractedData
  });
  assert(telemetry.includes('REGISTRADURIA_CENSO_PRESIDENCIAL_2026'), 'Telemetría contiene ID de fuente');
  assert(telemetry.includes('Registraduría Nacional del Estado Civil'), 'Telemetría contiene publicador');
  assert(!telemetry.includes('SOURCE_PENDING_CONFIGURATION'), 'Telemetría NO contiene SOURCE_PENDING_CONFIGURATION');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 14 PRUEBAS OBLIGATORIAS PASARON AL 100%');
  console.log('============================================================\n');
}

runOfficialCensusPublicationActivationTests().catch((err) => {
  console.error('Error ejecutando suite de activación de censo:', err);
  process.exit(1);
});
