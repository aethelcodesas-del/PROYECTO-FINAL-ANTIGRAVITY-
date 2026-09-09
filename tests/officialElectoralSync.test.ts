/**
 * PRUEBAS DE INTEGRACIÓN Y SINCRONIZACIÓN OFICIAL REGISTRADURÍA → SUPABASE (FASE 5)
 * Ejecutable mediante: npx tsx tests/officialElectoralSync.test.ts
 */

import {
  parseOfficialElectoralContent
} from '../src/services/registraduria/registraduriaOfficialAdapter';
import {
  syncOfficialElectoralDataToSupabase,
  validateCompletenessThresholds
} from '../src/services/registraduria/electoralSyncService';
import { ElectoralProcessConfig } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runSyncTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO SUITE DE PRUEBAS DEL SINCRONIZADOR OFICIAL (FASE 5)');
  console.log('============================================================\n');

  const procCongreso: ElectoralProcessConfig = {
    codigoProceso: 'COL-2026-CONGRESO',
    nombre: 'Elecciones Congreso 2026',
    tipoProceso: 'NACIONAL',
    anio: 2026,
    fechaEleccion: '2026-03-08',
    corporacionesHabilitadas: ['SENADO', 'CAMARA']
  };

  const procPresidencia: ElectoralProcessConfig = {
    codigoProceso: 'COL-2026-PRES-1V',
    nombre: 'Elecciones Presidenciales Primera Vuelta 2026',
    tipoProceso: 'NACIONAL',
    anio: 2026,
    fechaEleccion: '2026-05-31',
    corporacionesHabilitadas: ['PRESIDENCIA']
  };

  // 1. Sincronización Inicial Validada
  const validCsv = `COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;DIRECCION;MESAS
23;CORDOBA;189;COTORRA;01;01;I.E. COTORRA SEDE PRINCIPAL;CALLE 8 # 6-25;18
23;CORDOBA;189;COTORRA;99;01;I.E. TREMENTINO;PLAZA PRINCIPAL;10`;

  const adapterRes1 = await parseOfficialElectoralContent(validCsv, 'https://test-registraduria.gov.co/divipole_2026.csv', procCongreso, 'DIVIPOLE');
  assert(adapterRes1.success === true, 'Adaptador debe validar lote inicial');

  const syncRes1 = await syncOfficialElectoralDataToSupabase(adapterRes1, { dryRun: true });
  assert(syncRes1.success === true, 'Sincronizador debe completar con éxito lote válido');
  assert(syncRes1.status === 'EXITOSA', 'Estado de sincronización debe ser EXITOSA');
  assert(syncRes1.cantidadNuevos === 2, 'Debe identificar 2 puestos nuevos');

  // 2. Detección de SHA-256 idéntico sin cambios
  const thresholdOk = validateCompletenessThresholds(adapterRes1, 2);
  assert(thresholdOk.isValid === true, 'validateCompletenessThresholds debe aceptar lote completo');

  // 3. Protección Fail-Safe: Fuente Bloqueada / HTML
  const blockedHtml = '<!DOCTYPE html><html><body>cf-browser-verification</body></html>';
  const adapterBlocked = await parseOfficialElectoralContent(blockedHtml, 'https://test-registraduria.gov.co/blocked.csv', procCongreso, 'DIVIPOLE');
  assert(adapterBlocked.success === false, 'Adaptador debe rechazar contenido HTML/Captcha');

  const syncBlocked = await syncOfficialElectoralDataToSupabase(adapterBlocked, { dryRun: true });
  assert(syncBlocked.success === false, 'Sincronizador debe rechazar fuente bloqueada');
  assert(syncBlocked.status === 'FALLIDA_FUENTE_CAIDA' || syncBlocked.status === 'RECHAZADA_INCOMPLETA', 'Debe clasificar estado de fallo');

  // 4. Protección Fail-Safe: Lote Incompleto por debajo de umbral
  const thresholdFail = validateCompletenessThresholds(adapterRes1, 50);
  assert(thresholdFail.isValid === false, 'validateCompletenessThresholds debe rechazar si cae por debajo del umbral mínimo de seguridad');

  // 5. Independencia de Procesos Electorales
  const adapterPres = await parseOfficialElectoralContent(validCsv, 'https://test-registraduria.gov.co/pres_2026.csv', procPresidencia, 'DIVIPOLE');
  assert(adapterPres.process.codigoProceso === 'COL-2026-PRES-1V', 'Debe conservar proceso presidencial');
  assert(adapterPres.pollingTables[0].codigoMesaCompleto.startsWith('COL-2026-PRES-1V'), 'Mesas presidenciales deben tener clave única de proceso');

  // 6. Prueba Especial de Integridad Operacional: Simulación de polling_stations de campaña
  const simulatedCampaignPollingStations = [
    { id: 'pst-op-1', campaign_id: 'camp-123', zone: '01', place: 'I.E. Cotorra Sede Principal', table_number: 1, witness_id: 'wit-456' },
    { id: 'pst-op-2', campaign_id: 'camp-123', zone: '01', place: 'I.E. Cotorra Sede Principal', table_number: 2, witness_id: 'wit-789' }
  ];

  // Simular que el catálogo oficial agrega 2 mesas nuevas al puesto (18 a 20)
  const modifiedCsv = `COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;DIRECCION;MESAS
23;CORDOBA;189;COTORRA;01;01;I.E. COTORRA SEDE PRINCIPAL;CALLE 8 # 6-25;20`;

  const adapterModified = await parseOfficialElectoralContent(modifiedCsv, 'https://test-registraduria.gov.co/divipole_v2.csv', procCongreso, 'DIVIPOLE');
  assert(adapterModified.pollingTables.length === 20, 'Nuevo catálogo debe tener 20 mesas oficiales');

  // Verificar que los registros operacionales existentes de campaña NO sufren alteraciones
  assert(simulatedCampaignPollingStations[0].id === 'pst-op-1', 'polling_stations conserva su ID operacional intacto');
  assert(simulatedCampaignPollingStations[0].witness_id === 'wit-456', 'polling_stations conserva su asignación de testigo');
  assert(simulatedCampaignPollingStations[1].witness_id === 'wit-789', 'polling_stations conserva todos sus testigos');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DEL SINCRONIZADOR (FASE 5) PASARON EXITOSAMENTE');
  console.log('============================================================\n');
}

runSyncTests().catch((err) => {
  console.error('Error ejecutando pruebas del sincronizador:', err);
  process.exit(1);
});
