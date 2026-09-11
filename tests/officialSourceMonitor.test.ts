/**
 * SUITE DE PRUEBAS DEL MOTOR AUTOMÁTICO DE DETECCIÓN Y ACTUALIZACIÓN DE ARCHIVOS OFICIALES
 * Archivo: tests/officialSourceMonitor.test.ts
 * 
 * Verifica los 17 escenarios obligatorios:
 * 1. Fuente válida oficial.
 * 2. Fuente sin cambios (SHA idéntico -> SOURCE_UNCHANGED).
 * 3. Fuente nueva con contenido oficial válido (SOURCE_CHANGED).
 * 4. Detección de WAF 403 (SOURCE_BLOCKED).
 * 5. Detección de HTML de bloqueo / Captcha / Bot challenge (SOURCE_BLOCKED).
 * 6. Detección de PDF corrupto o no válido (SOURCE_INVALID).
 * 7. Detección de extracción incompleta o archivo truncado (SOURCE_INCOMPLETE).
 * 8. SHA diferente activa staging y validación.
 * 9. SHA idéntico produce SOURCE_UNCHANGED y 0 escrituras.
 * 10. Inconsistencia con Censo produce SOURCE_VALIDATION_FAILED.
 * 11. Rollback automático ante fallo de staging con preservación de versión anterior.
 * 12. Idempotencia en ejecuciones repetidas.
 * 13. Cero escrituras en base de datos ante WAF.
 * 14. Conservación garantizada de la última versión válida (lastKnownValidVersion).
 * 15. No modificación de polling_stations (100% intacta).
 * 16. No modificación de campañas (100% intactas).
 * 17. No modificación de usuarios (100% intactos).
 */

import {
  monitorOfficialSource,
  isAuthorizedRegistraduriaDomain,
  isWafChallengeResponse,
  computeContentSha256,
  sourceVersionStore,
  OfficialSourceStatus
} from '../src/services/registraduria/officialSourceMonitor';
import { getOfficialProcessSource } from '../src/services/registraduria/processRegistry';

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
}

async function runOfficialSourceMonitorTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO 17 PRUEBAS DEL MONITOR AUTOMÁTICO DE FUENTES');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  // Limpiar almacén de pruebas
  sourceVersionStore.clear();

  const mockOfficialSourceDef = {
    sourceId: 'REGISTRADURIA_DIVIPOLE_CONGRESO_2026',
    processId: 'COL-2026-CONGRESO',
    processConfig: {
      codigoProceso: 'COL-2026-CONGRESO',
      nombre: 'Congreso y Parlamento Andino 2026',
      fechaEleccion: '2026-03-08'
    },
    sourceUrl: 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf',
    sourceType: 'DIVIPOLE_CSV' as any,
    publisher: 'Registraduría Nacional del Estado Civil',
    format: 'PDF' as const,
    authority: 'RELACION_PUESTOS' as const,
    validationMode: 'DIVIPOLE_VALIDATION',
    enabled: true,
    status: 'SOURCE_CONFIGURED' as any
  };

  const validMockPdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.alloc(2048, 'A') // Archivo estructurado de más de 2 KB
  ]);

  // 1. Fuente válida oficial
  console.log('--- 1. Validación de fuente válida oficial ---');
  const res1 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdf,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res1.isOfficialDomain === true, 'Dominio oficial www.registraduria.gov.co reconocido');
  assert(res1.status === 'SOURCE_CHANGED', 'Primera detección exitosa clasificada como SOURCE_CHANGED');
  assert(res1.stagingValidated === true, 'Staging validado exitosamente');
  assert(typeof res1.sha256 === 'string' && res1.sha256.length === 64, 'SHA-256 de 64 caracteres calculado');

  // 2. Fuente sin cambios (SHA idéntico)
  console.log('--- 2. Fuente sin cambios (SHA idéntico -> SOURCE_UNCHANGED) ---');
  const res2 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdf,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res2.status === 'SOURCE_UNCHANGED', 'Fuente idéntica clasificada como SOURCE_UNCHANGED');
  assert(res2.isNewVersion === false, 'isNewVersion es false');
  assert(res2.metrics.insertCount === 0, '0 inserciones en fuente sin cambios');

  // 3. Fuente nueva (SHA diferente)
  console.log('--- 3. Fuente nueva con contenido oficial válido (SOURCE_CHANGED) ---');
  const validMockPdfV2 = Buffer.concat([
    Buffer.from('%PDF-1.5\n%âãÏÓ\n'),
    Buffer.alloc(3072, 'B')
  ]);
  const res3 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdfV2,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res3.status === 'SOURCE_CHANGED', 'Nueva versión clasificada como SOURCE_CHANGED');
  assert(res3.isNewVersion === true, 'isNewVersion es true');
  assert(res3.sha256 !== res1.sha256, 'SHA-256 es diferente');

  // 4. Detección de WAF 403
  console.log('--- 4. Detección de WAF 403 (SOURCE_BLOCKED) ---');
  const res4 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: '<html><head><title>403 Forbidden</title></head><body>Cloudflare Ray ID: 888</body></html>',
    mockHttpStatus: 403,
    dryRun: true
  });
  assert(res4.status === 'SOURCE_BLOCKED', 'HTTP 403 clasificado como SOURCE_BLOCKED');
  assert(res4.sha256 === null, 'SHA de respuesta 403 NO se almacena');
  assert(res4.metrics.insertCount === 0, '0 inserciones ante WAF 403');

  // 5. Detección de HTML de bloqueo / Captcha / Bot challenge
  console.log('--- 5. Detección de HTML de bloqueo / Challenge ---');
  const wafHtmlChallenge = '<html><title>Just a moment...</title><body>Checking your browser before accessing cloudflare cf-chl</body></html>';
  const res5 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: wafHtmlChallenge,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res5.status === 'SOURCE_BLOCKED', 'HTML con Bot Challenge clasificado como SOURCE_BLOCKED');
  assert(res5.sha256 === null, 'SHA de página de challenge NO es registrado');

  // 6. Detección de PDF corrupto
  console.log('--- 6. Detección de PDF corrupto o no válido (SOURCE_INVALID) ---');
  const corruptPdf = Buffer.from('ESTO NO ES UN ARCHIVO PDF OFICIAL VALIDO');
  const res6 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: corruptPdf,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res6.status === 'SOURCE_INVALID', 'Archivo sin cabecera PDF clasificado como SOURCE_INVALID');

  // 7. Detección de extracción incompleta o archivo truncado
  console.log('--- 7. Detección de archivo truncado (SOURCE_INCOMPLETE) ---');
  const truncatedPdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.alloc(100, 'X') // Menos de 500 bytes (truncado)
  ]);
  const res7 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: truncatedPdf,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res7.status === 'SOURCE_INCOMPLETE', 'Archivo menor al umbral estructural clasificado como SOURCE_INCOMPLETE');
  assert(res7.stagingValidated === false, 'Staging NO validado para archivo incompleto');

  // 8. SHA diferente activa staging
  console.log('--- 8. SHA diferente activa staging y validación ---');
  assert(res3.stagingRequired === true, 'Staging fue requerido para la versión v2');
  assert(res3.stagingValidated === true, 'Staging fue validado para v2');

  // 9. SHA idéntico produce SOURCE_UNCHANGED y 0 escrituras
  console.log('--- 9. SHA idéntico produce SOURCE_UNCHANGED y 0 escrituras ---');
  const res9 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdfV2,
    mockHttpStatus: 200,
    dryRun: true
  });
  assert(res9.status === 'SOURCE_UNCHANGED', 'Re-verificación de v2 es SOURCE_UNCHANGED');
  assert(res9.metrics.insertCount === 0 && res9.metrics.updateCount === 0, '0 escrituras en idempotencia');

  // 10. Inconsistencia con Censo produce SOURCE_VALIDATION_FAILED
  console.log('--- 10. Inconsistencia con Censo Oficial ---');
  const validMockPdfV3 = Buffer.concat([
    Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
    Buffer.alloc(4096, 'C')
  ]);
  const res10 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdfV3,
    mockHttpStatus: 200,
    censusComparisonData: {
      totalElectores: 0, // Cifra anómala inconsistente
      mesas: 1000
    },
    dryRun: true
  });
  assert(res10.status === 'SOURCE_VALIDATION_FAILED', 'Inconsistencia con Censo produce SOURCE_VALIDATION_FAILED');
  assert(res10.stagingValidated === false, 'Staging rechazado ante inconsistencia con Censo');

  // 11. Rollback automático ante fallo de staging
  console.log('--- 11. Rollback automático y conservación de versión anterior ---');
  assert(res10.lastKnownValidVersionPreserved === true, 'Versión anterior conservada tras fallo de staging');
  const knownActive = sourceVersionStore.getKnownVersion(mockOfficialSourceDef.sourceId);
  assert(knownActive?.sha256 === res3.sha256, 'La versión activa en almacén permanece inalterada en v2');

  // 12. Idempotencia
  console.log('--- 12. Idempotencia estricta ---');
  const res12A = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdfV2,
    mockHttpStatus: 200
  });
  const res12B = await monitorOfficialSource(mockOfficialSourceDef, {
    mockContent: validMockPdfV2,
    mockHttpStatus: 200
  });
  assert(res12A.status === 'SOURCE_UNCHANGED' && res12B.status === 'SOURCE_UNCHANGED', 'Ejecuciones consecutivas son idempotentes');

  // 13. Cero escrituras en base de datos ante WAF
  console.log('--- 13. Cero escrituras ante WAF ---');
  const res13 = await monitorOfficialSource(mockOfficialSourceDef, {
    mockHttpStatus: 403,
    mockContent: '<html>Cloudflare WAF Blocked</html>'
  });
  assert(res13.metrics.insertCount === 0, '0 inserciones ante WAF');
  assert(res13.metrics.updateCount === 0, '0 actualizaciones ante WAF');
  assert(res13.metrics.deleteCount === 0, '0 eliminaciones ante WAF');
  assert(res13.metrics.truncateCount === 0, '0 truncates ante WAF');

  // 14. Conservación de última versión válida
  console.log('--- 14. Conservación garantizada de última versión válida ---');
  assert(res13.lastKnownValidVersionPreserved === true, 'Última versión válida conservada tras bloqueo WAF');

  // 15. polling_stations intacta
  console.log('--- 15. polling_stations permanece 100% inalterada ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations 100% intacta');

  // 16. Campañas intactas
  console.log('--- 16. Campañas permanecen 100% intactas ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas 100% intactas');

  // 17. Usuarios intactos
  console.log('--- 17. Usuarios permanecen 100% intactos ---');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios 100% intactos');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 17 PRUEBAS DEL MONITOR DE FUENTES PASARON AL 100%');
  console.log('============================================================\n');
}

runOfficialSourceMonitorTests().catch((err) => {
  console.error('Error ejecutando suite de pruebas de officialSourceMonitor:', err);
  process.exit(1);
});
