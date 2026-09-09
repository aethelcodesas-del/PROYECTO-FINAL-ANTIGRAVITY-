/**
 * PRUEBAS DE CANAL DE INGESTA OFFLINE DE ARCHIVO OFICIAL (FASE 11)
 * Ejecutable mediante: npx tsx tests/officialElectoralOfflineIngestion.test.ts
 */

import { ingestOfflineOfficialFile } from '../src/services/registraduria/offlineOfficialFileIngestion';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runOfflineIngestionTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE INGESTA OFFLINE CONTROLADA (FASE 11)');
  console.log('============================================================\n');

  // 1. Archivo PDF Oficial Válido Obtenido Legítimamente
  const validOfficialPdfText = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;12',
    '23;CORDOBA;189;COTORRA;99;01;VEREDA LA CULEBRA;4',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;35'
  ].join('\n');

  const validIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_2026.pdf',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: validOfficialPdfText,
    notes: 'Descargado directamente por usuario autorizado desde el portal oficial'
  }, { dryRun: true });

  assert(validIngestion.isValid === true, 'Archivo oficial auténtico debe ser validado con éxito');
  assert(validIngestion.isAuthenticPdf === true, 'Debe reconocer firma auténtica de PDF');
  assert(validIngestion.sha256.length === 64, 'Debe calcular hash SHA-256 automáticamente');
  assert(validIngestion.adapterResult?.pollingPlaces.length === 3, 'Debe normalizar los 3 puestos de votación');
  assert(validIngestion.adapterResult?.pollingTables.length === 51, 'Debe normalizar las 51 mesas');
  assert(validIngestion.nationalSummary?.pollingStationsUntouched === true, 'polling_stations permanece 100% intacta');

  // 2. Rechazo de Archivo Vacío
  const emptyIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/empty.pdf',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: ''
  });

  assert(emptyIngestion.isValid === false, 'Archivo vacío debe ser rechazado');
  assert(emptyIngestion.errors.some(e => e.includes('vacío')), 'Debe reportar error descriptivo de archivo vacío');

  // 3. Rechazo de Página HTML de Bloqueo WAF Disfrazada de PDF
  const wafHtml = '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>Access Denied Cloudflare WAF</body></html>';
  const wafIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/waf.pdf',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: wafHtml
  });

  assert(wafIngestion.isValid === false, 'HTML de bloqueo WAF debe ser rechazado');
  assert(wafIngestion.isWafOrHtmlError === true, 'Debe identificar que es una página HTML/WAF de error');

  // 4. Rechazo de Archivo Binario No-PDF
  const nonPdfBinary = 'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;';
  const nonPdfIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/image.gif',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: nonPdfBinary
  });

  assert(nonPdfIngestion.isValid === false, 'Archivo no PDF debe ser rechazado');
  assert(nonPdfIngestion.isAuthenticPdf === false, 'No debe ser identificado como PDF auténtico');

  // 5. Advertencia ante Cobertura Parcial si se Requiere Cobertura Nacional
  const partialNationalIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-CONGRESO',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/muestra_parcial.pdf',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: validOfficialPdfText
  }, { dryRun: true, requireNationalCoverage: true });

  assert(partialNationalIngestion.warnings.length > 0, 'Debe advertir que contiene una muestra parcial si se exige cobertura nacional');
  assert(partialNationalIngestion.warnings[0].includes('muestra parcial'), 'El mensaje debe indicar que no es Colombia completa');

  // 6. Separación Estricta de Procesos
  const presIngestion = await ingestOfflineOfficialFile({
    processId: 'COL-2026-PRES-2V',
    sourceOriginUrl: 'https://www.registraduria.gov.co/IMG/pdf/pres_2v.pdf',
    obtainedAt: new Date().toISOString(),
    fileBufferOrContent: validOfficialPdfText
  }, { dryRun: true });

  assert(presIngestion.processConfig.codigoProceso === 'COL-2026-PRES-2V', 'Debe conservar proceso presidencial');
  assert(presIngestion.adapterResult?.pollingTables[0].codigoMesaCompleto.startsWith('COL-2026-PRES-2V_'), 'Mesas deben asociarse al proceso correspondiente');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE INGESTA OFFLINE CONTROLADA (FASE 11) PASARON');
  console.log('============================================================\n');
}

runOfflineIngestionTests().catch((err) => {
  console.error('Error ejecutando pruebas de ingesta offline:', err);
  process.exit(1);
});
