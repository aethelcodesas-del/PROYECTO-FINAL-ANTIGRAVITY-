/**
 * PRUEBAS DE INGESTA CONTROLADA Y DRY-RUN PARA PDF DIVIPOLE OFICIAL (FASE 8)
 * Ejecutable mediante: npx tsx tests/officialElectoralPdfIngestion.test.ts
 */

import {
  validatePdfBinaryHeader,
  extractTextFromPdfStream,
  parsePdfDivipoleRows,
  processOfficialPdfDivipole
} from '../src/services/registraduria/pdfDivipoleAdapter';
import { calculateSha256 } from '../src/services/registraduria/sha256';
import { DEFAULT_PROCESO_CONGRESO_2026 } from '../src/services/registraduria/schedulerEngine';
import { ElectoralProcessConfig } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runPdfIngestionTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE INGESTA CONTROLADA PDF DIVIPOLE (FASE 8)');
  console.log('============================================================\n');

  // 1. Validación de Firma Binaria de PDF Auténtico
  const validPdfHeader = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
  const headerCheck1 = validatePdfBinaryHeader(validPdfHeader);
  assert(headerCheck1.isValidPdf === true, 'Firma binaria %PDF- debe ser reconocida como PDF válido');
  assert(headerCheck1.isHtml === false, 'No debe confundirse con HTML');

  // 2. Detección y Rechazo de HTML / Desafío Cloudflare disfrazado de PDF
  const htmlChallenge = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Cloudflare Challenge</body></html>';
  const headerCheck2 = validatePdfBinaryHeader(htmlChallenge);
  assert(headerCheck2.isValidPdf === false, 'HTML challenge no debe ser aceptado como PDF');
  assert(headerCheck2.isHtml === true, 'Debe identificar que es HTML/WAF');

  // 3. Detección y Rechazo de Respuesta 403 Forbidden
  const http403 = '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>Access Denied</body></html>';
  const headerCheck3 = validatePdfBinaryHeader(http403);
  assert(headerCheck3.isValidPdf === false, 'Respuesta 403 debe ser rechazada');

  // 4. Archivo Vacío o Corrupto
  const emptyCheck = validatePdfBinaryHeader('');
  assert(emptyCheck.isValidPdf === false, 'Archivo vacío debe ser rechazado');

  // 5. Extracción de Streams de Texto PDF
  const mockPdfStream = '%PDF-1.5\nBT\n[(05) (ANTIOQUIA) (001) (MEDELLIN) (01) (01) (COLEGIO CENTRAL) (25)] TJ\nET\n';
  const extractedLines = extractTextFromPdfStream(mockPdfStream);
  assert(extractedLines.length >= 1, 'Debe extraer líneas legibles de streams de texto PDF');
  assert(extractedLines[0].includes('MEDELLIN'), 'El texto extraído debe contener el municipio');

  // 6. Normalización y Validación de Filas DIVIPOLE (DD/MM/ZZ/PP)
  const samplePdfLines = [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;12',
    '23;CORDOBA;189;COTORRA;99;01;VEREDA LA CULEBRA;4',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;35'
  ];

  const parsed = parsePdfDivipoleRows(samplePdfLines, DEFAULT_PROCESO_CONGRESO_2026);
  assert(parsed.rows.length === 3, 'Debe procesar exactamente 3 puestos de votación válidos');
  assert(parsed.rows[0].codDpto === '23', 'Código de departamento debe tener 2 dígitos con cero');
  assert(parsed.rows[0].codMpio === '189', 'Código de municipio debe tener 3 dígitos con cero');
  assert(parsed.rows[0].mesas === 12, 'Mesas deben ser 12');
  assert(parsed.rows[1].esRural === true, 'Zona 99 debe marcarse como rural');
  assert(parsed.rows[2].codDpto === '05' && parsed.rows[2].codMpio === '001', 'Medellín debe normalizarse a 05 y 001');

  // 7. Rechazo de Códigos DIVIPOLE Inválidos
  const invalidLines = [
    '00;DESCONOCIDO;000;MPIO_INVALIDO;00;00;PUESTO FANTASMA;5',
    'ABC;DEPARTAMENTO;XYZ;MUNICIPIO;01;01;PUESTO;2'
  ];
  const invalidParsed = parsePdfDivipoleRows(invalidLines, DEFAULT_PROCESO_CONGRESO_2026);
  assert(invalidParsed.rows.length === 0, 'Filas con códigos DIVIPOLE inválidos deben ser rechazadas');
  assert(invalidParsed.errors.length > 0, 'Debe registrar errores detallados de validación');

  // 8. Descarte de Duplicados
  const duplicateLines = [
    '23;CORDOBA;189;COTORRA;01;01;PUESTO CENTRAL;10',
    '23;CORDOBA;189;COTORRA;01;01;PUESTO CENTRAL (DUPLICADO);10'
  ];
  const dedupParsed = parsePdfDivipoleRows(duplicateLines, DEFAULT_PROCESO_CONGRESO_2026);
  assert(dedupParsed.rows.length === 1, 'Debe descartar puestos duplicados con el mismo código único DIVIPOLE');

  // 9. Cálculo de SHA-256 Inmutable sobre el PDF Original
  const mockPdfFile = '%PDF-1.7\n' + samplePdfLines.join('\n');
  const sha = await calculateSha256(mockPdfFile);
  assert(sha.length === 64, 'SHA-256 debe generar hash de 64 caracteres');

  // 10. Proceso Completo en DRY-RUN (CERO Escrituras en Base de Datos)
  const dryRunResult = await processOfficialPdfDivipole(
    mockPdfFile,
    'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_2026.pdf',
    DEFAULT_PROCESO_CONGRESO_2026,
    { dryRun: true }
  );

  assert(dryRunResult.success === true, 'DRY-RUN debe completar con éxito la extracción y normalización');
  assert(dryRunResult.departments.length === 2, 'DRY-RUN debe identificar 2 departamentos (Córdoba y Antioquia)');
  assert(dryRunResult.municipalities.length === 2, 'DRY-RUN debe identificar 2 municipios (Cotorra y Medellín)');
  assert(dryRunResult.zones.length === 3, 'DRY-RUN debe identificar 3 zonas');
  assert(dryRunResult.pollingPlaces.length === 3, 'DRY-RUN debe identificar 3 puestos de votación');
  assert(dryRunResult.pollingTables.length === (12 + 4 + 35), 'DRY-RUN debe generar exactamente 51 mesas');
  assert(dryRunResult.pollingPlaces[0].codUnicoDivipole === '231890101', 'Código único DIVIPOLE debe ser 231890101');
  assert(dryRunResult.validation.esValido === true, 'Validación debe reportar lote estructurado válido');

  // 11. Separación Estricta por Proceso Electoral
  const presProcessConfig: ElectoralProcessConfig = {
    codigoProceso: 'COL-2026-PRES-2V',
    nombre: 'Presidenciales 2ª Vuelta 2026',
    tipoProceso: 'PRESIDENCIAL',
    anio: 2026,
    fechaEleccion: '2026-06-21',
    corporacionesHabilitadas: ['PRESIDENCIA']
  };

  const presDryRun = await processOfficialPdfDivipole(
    mockPdfFile,
    'https://www.registraduria.gov.co/IMG/pdf/puestos_votacion_2da_vuelta_2026.pdf',
    presProcessConfig,
    { dryRun: true }
  );

  assert(presDryRun.process.codigoProceso === 'COL-2026-PRES-2V', 'Debe conservar proceso electoral presidencial');
  assert(presDryRun.pollingTables[0].codigoMesaCompleto.startsWith('COL-2026-PRES-2V_'), 'Código de mesa debe estar aislado por proceso');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE INGESTA CONTROLADA PDF (FASE 8) PASARON');
  console.log('============================================================\n');
}

runPdfIngestionTests().catch((err) => {
  console.error('Error ejecutando pruebas de ingesta PDF:', err);
  process.exit(1);
});
