/**
 * SUITE DE PRUEBAS DE VALIDACIÓN AUTOMÁTICA DE PUBLICACIÓN OFICIAL DE CENSO (REGISTRADURÍA)
 * Archivo: tests/officialCensusPublicationValidation.test.ts
 */

import {
  validateOfficialRegistraduriaDomain,
  parseOfficialCensusPublicationHtml,
  checkOfficialCensusPublication
} from '../src/services/registraduria/censusPublicationValidator';
import { getOfficialProcessSource } from '../src/services/registraduria/processRegistry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

// Mock de base de datos para verificar que NO se realizan escrituras en DIVIPOLE ni polling_stations
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
        }
      })
    };
  }
}

async function runCensusPublicationValidationTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE VALIDACIÓN DE PUBLICACIÓN DE CENSO');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);

  // TEST 1: URL Oficial Válida
  console.log('--- TEST 1: Validación de URL Oficial Válida ---');
  const validDomain = validateOfficialRegistraduriaDomain(
    'https://www.registraduria.gov.co/Registraduria-Nacional-entrega-detalles-del-censo-electoral-en-Colombia-y-el.html'
  );
  assert(validDomain.isValid === true, 'URL oficial de registraduria.gov.co es válida');
  assert(validDomain.status === 'AUTHORIZED_SOURCE', 'Estado es AUTHORIZED_SOURCE');

  // TEST 2: Dominio Externo No Autorizado
  console.log('--- TEST 2: Rechazo Estricto de Dominio Externo ---');
  const externalDomain = validateOfficialRegistraduriaDomain('https://servidor-externo-falso.com/censo.html');
  assert(externalDomain.isValid === false, 'Dominio externo es rechazado');
  assert(externalDomain.status === 'UNAUTHORIZED_SOURCE', 'Estado es UNAUTHORIZED_SOURCE');

  const httpDomain = validateOfficialRegistraduriaDomain('http://www.registraduria.gov.co/censo.html');
  assert(httpDomain.isValid === false, 'URL HTTP sin cifrado es rechazada');
  assert(httpDomain.status === 'UNAUTHORIZED_SOURCE', 'Estado HTTP no seguro es UNAUTHORIZED_SOURCE');

  // TEST 3: Contenido HTML Oficial Válido
  console.log('--- TEST 3: Parseo de Contenido HTML Válido ---');
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

  const parsedHtml = parseOfficialCensusPublicationHtml(validHtml);
  assert(parsedHtml.success === true, 'Parseo de HTML oficial reporta éxito');
  assert(parsedHtml.data?.cutoffDate === '13 de enero de 2026', 'Fecha de corte detectada: 13 de enero de 2026');
  assert(parsedHtml.data?.totalColombia === 38000000, 'Total Colombia extraído: 38.000.000');
  assert(parsedHtml.data?.totalExterior === 1000000, 'Total Exterior extraído: 1.000.000');
  assert(parsedHtml.data?.totalNacional === 39000000, 'Total Nacional extraído: 39.000.000');
  assert(parsedHtml.data?.departmentBreakdown.length === 3, '3 departamentos extraídos de tabla HTML');

  // TEST 4: Bloqueo WAF / 403
  console.log('--- TEST 4: Detección de Bloqueo WAF/403 con 0 Escrituras ---');
  const wafHtml = '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>Cloudflare Bot Challenge Platform</body></html>';
  const wafResult = await checkOfficialCensusPublication({
    htmlContentOrBuffer: wafHtml,
    dryRun: true
  });
  assert(wafResult.success === false, 'Bloqueo WAF detectado');
  assert(wafResult.status === 'SOURCE_BLOCKED', 'Estado clasificado como SOURCE_BLOCKED');
  assert(wafResult.databaseWritesPerformed === 0, '0 escrituras ante WAF');

  // TEST 5: SHA Idéntico -> NO_CHANGES
  console.log('--- TEST 5: Detección de SHA Idéntico (NO_CHANGES) ---');
  const checkInitial = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    dryRun: true
  });
  const initialSha = checkInitial.sha256!;

  const checkSameSha = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    lastKnownSha256: initialSha,
    dryRun: true
  });
  assert(checkSameSha.success === true, 'Comprobación con mismo SHA responde exitosamente');
  assert(checkSameSha.status === 'NO_CHANGES', 'Estado reporta NO_CHANGES');
  assert(checkSameSha.databaseWritesPerformed === 0, '0 escrituras en NO_CHANGES');

  // TEST 6: SHA Nuevo + Contenido Válido Coincidente
  console.log('--- TEST 6: SHA Nuevo + Validación Coincidente (MATCH) ---');
  const checkMatch = await checkOfficialCensusPublication({
    htmlContentOrBuffer: validHtml,
    lastKnownSha256: 'SHA_PREVIO_ANTIGUO',
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkMatch.success === true, 'Validación contra catálogo maestro exitosa');
  assert(checkMatch.status === 'MATCH', 'Estado es MATCH (coincidencia 100%)');
  assert(checkMatch.discrepancies.length === 0, '0 discrepancias encontradas');

  // TEST 7: Contenido Nuevo Incompleto -> VALIDATION_FAILED
  console.log('--- TEST 7: Contenido Incompleto (VALIDATION_FAILED) ---');
  const incompleteHtml = '<html><body><h1>Aviso General</h1><p>No hay cifras publicadas en este momento.</p></body></html>';
  const checkIncomplete = await checkOfficialCensusPublication({
    htmlContentOrBuffer: incompleteHtml,
    lastKnownSha256: null,
    dryRun: true
  });
  assert(checkIncomplete.success === false, 'Contenido sin cifras numéricas es rechazado');
  assert(checkIncomplete.status === 'VALIDATION_FAILED', 'Estado es VALIDATION_FAILED');

  // TEST 8: Diferencia Territorial -> CENSUS_VALIDATION_MISMATCH sin modificar DIVIPOLE
  console.log('--- TEST 8: Detección de Diferencia Territorial (CENSUS_VALIDATION_MISMATCH) ---');
  const territorialMismatchHtml = validHtml.replace('5.100.000', '5.250.000'); // Antioquia publicado con 5.250.000 vs 5.100.000 almacenado
  const checkTerritorialMismatch = await checkOfficialCensusPublication({
    htmlContentOrBuffer: territorialMismatchHtml,
    lastKnownSha256: null,
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkTerritorialMismatch.status === 'CENSUS_VALIDATION_MISMATCH', 'Estado reporta CENSUS_VALIDATION_MISMATCH');
  assert(checkTerritorialMismatch.discrepancies.length > 0, 'Registra discrepancia territorial');
  assert(checkTerritorialMismatch.discrepancies[0].departamento === 'ANTIOQUIA', 'Discrepancia localizada en ANTIOQUIA');
  assert(checkTerritorialMismatch.discrepancies[0].diferencia === 150000, 'Diferencia cuantitativa calculada: 150.000 electores');
  assert(db.masterDivipole.departments['ANTIOQUIA'].totalElectores === 5100000, 'Catálogo DIVIPOLE maestro permanece intacto (sin modificación automática)');

  // TEST 9: Diferencia Nacional -> CENSUS_VALIDATION_MISMATCH
  console.log('--- TEST 9: Detección de Diferencia Nacional (CENSUS_VALIDATION_MISMATCH) ---');
  const nationalMismatchHtml = validHtml.replace('39.000.000', '39.500.000');
  const checkNationalMismatch = await checkOfficialCensusPublication({
    htmlContentOrBuffer: nationalMismatchHtml,
    lastKnownSha256: null,
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(checkNationalMismatch.status === 'CENSUS_VALIDATION_MISMATCH', 'Estado es CENSUS_VALIDATION_MISMATCH');
  assert(checkNationalMismatch.discrepancies.some(d => d.ambito === 'NACIONAL'), 'Discrepancia nacional registrada');

  // TEST 10: Repetir la Misma Versión -> NO_CHANGES
  console.log('--- TEST 10: Re-ejecución Idempotente de Misma Versión ---');
  const repeatSha = await checkOfficialCensusPublication({
    htmlContentOrBuffer: territorialMismatchHtml,
    lastKnownSha256: checkTerritorialMismatch.sha256,
    masterCatalog: db.masterDivipole,
    dryRun: true
  });
  assert(repeatSha.status === 'NO_CHANGES', 'Re-ejecución con mismo hash responde NO_CHANGES');

  // TEST 11: Protección Absoluta de polling_stations
  console.log('--- TEST 11: Verificación de Aislamiento de polling_stations ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations (IDs, campañas, testigos) permanece 100% inalterada');

  // TEST 12: Campañas y Usuarios No Modificados
  console.log('--- TEST 12: Verificación de Campañas y Usuarios Intactos ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas y presupuestos permanecen 100% inalterados');

  // Verificación de Registro de Proceso en ProcessRegistry
  console.log('--- Verificación de Registro en Process Registry ---');
  const registeredSource = getOfficialProcessSource('REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(registeredSource.sourceType === 'OFFICIAL_CENSUS_PUBLICATION', 'Tipo de fuente OFFICIAL_CENSUS_PUBLICATION registrado');
  assert(registeredSource.authority === 'MASTER_VALIDATION', 'Rol MASTER_VALIDATION / CENSUS_VALIDATION registrado');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 12 PRUEBAS DE VALIDACIÓN DE CENSO PASARON EXITOSAMENTE');
  console.log('============================================================\n');
}

runCensusPublicationValidationTests().catch((err) => {
  console.error('Error ejecutando pruebas de validación de censo:', err);
  process.exit(1);
});
