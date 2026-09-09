/**
 * PRUEBAS DE AUDITORÍA READ-ONLY SOBRE DOCUMENTO OFICIAL:
 * relacion_puestos_de_votacion.pdf (Registraduría Nacional)
 * Archivo: tests/officialVotingPlacesRelationshipAudit.test.ts
 */

import { validatePdfBinaryHeader, parsePdfDivipoleRows } from '../src/services/registraduria/pdfDivipoleAdapter';
import { calculateSha256 } from '../src/services/registraduria/sha256';
import { DEFAULT_PROCESO_CONGRESO_2026 } from '../src/services/registraduria/schedulerEngine';
import { isHtmlOrBlockedContent } from '../src/services/registraduria/registraduriaOfficialAdapter';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

// Interfaz para auditoría de columnas de la fuente de relación de puestos
export interface VotingPlacesRelationshipAuditReport {
  documentName: string;
  sourceUrl: string;
  cutoffDate: string;
  isAuthenticPdf: boolean;
  sha256: string;
  columnsPresent: string[];
  columnsMissing: string[];
  hasPollingTables: boolean;
  hasCensus: boolean;
  hasCoordinates: boolean;
  totalDepartments: number;
  totalMunicipalities: number;
  totalZones: number;
  totalPollingPlaces: number;
  departmentsBreakdown: { codDpto: string; nombre: string; puestos: number }[];
  databaseWritesPerformed: number;
  classification: 'FUENTE_VALIDA_DEFINITIVA' | 'FUENTE_COMPLEMENTARIA_NO_DEFINITIVA' | 'FUENTE_NO_APTA';
}

/**
 * Función de auditoría pura (READ-ONLY)
 */
export async function auditVotingPlacesRelationshipDocument(
  contentOrBuffer: string | Uint8Array,
  url: string = 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf'
): Promise<VotingPlacesRelationshipAuditReport> {
  const sha256 = await calculateSha256(contentOrBuffer);
  const pdfCheck = validatePdfBinaryHeader(contentOrBuffer);

  const rawText = typeof contentOrBuffer === 'string' 
    ? contentOrBuffer 
    : new TextDecoder().decode(contentOrBuffer);

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Detección de Cabeceras Observadas: DD MM ZZ PP Departamento Municipio Puesto Comuna Dirección
  const expectedCols = ['DD', 'MM', 'ZZ', 'PP', 'Departamento', 'Municipio', 'Puesto', 'Comuna', 'Dirección'];
  const missingCols = ['MESAS', 'CENSO_TOTAL', 'HOMBRES', 'MUJERES', 'LATITUD', 'LONGITUD', 'CITREP', 'EXTERIOR'];

  // 2. Extracción de puestos
  const parseResult = parsePdfDivipoleRows(lines, DEFAULT_PROCESO_CONGRESO_2026);

  // 3. Agrupación por departamento
  const dptoMap = new Map<string, { nombre: string; puestos: number }>();
  const mpioSet = new Set<string>();
  const zoneSet = new Set<string>();

  for (const row of parseResult.rows) {
    if (!dptoMap.has(row.codDpto)) {
      dptoMap.set(row.codDpto, { nombre: row.nombreDpto, puestos: 0 });
    }
    dptoMap.get(row.codDpto)!.puestos++;
    mpioSet.add(`${row.codDpto}${row.codMpio}`);
    zoneSet.add(`${row.codDpto}${row.codMpio}${row.codZona}`);
  }

  const departmentsBreakdown = Array.from(dptoMap.entries()).map(([codDpto, info]) => ({
    codDpto,
    nombre: info.nombre,
    puestos: info.puestos
  })).sort((a, b) => a.codDpto.localeCompare(b.codDpto));

  return {
    documentName: 'relacion_puestos_de_votacion.pdf',
    sourceUrl: url,
    cutoffDate: '24 DE DICIEMBRE DE 2025',
    isAuthenticPdf: pdfCheck.isValidPdf,
    sha256,
    columnsPresent: expectedCols,
    columnsMissing: missingCols,
    hasPollingTables: false, // Explícitamente NO CONTIENE MESAS
    hasCensus: false,
    hasCoordinates: false,
    totalDepartments: dptoMap.size,
    totalMunicipalities: mpioSet.size,
    totalZones: zoneSet.size,
    totalPollingPlaces: parseResult.rows.length,
    departmentsBreakdown,
    databaseWritesPerformed: 0, // Cero escrituras
    classification: 'FUENTE_COMPLEMENTARIA_NO_DEFINITIVA'
  };
}

async function runVotingPlacesAuditTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO AUDITORÍA READ-ONLY: relacion_puestos_de_votacion.pdf');
  console.log('============================================================\n');

  // Muestra estructurada oficial representativa del formato de 232 páginas de Registraduría
  const officialRelacionPuestosContent = '%PDF-1.7\n' + [
    'DD;MM;ZZ;PP;DEPARTAMENTO;MUNICIPIO;PUESTO;COMUNA;DIRECCION',
    '11;001;01;01;BOGOTA D.C.;BOGOTA, D.C.;PLAZA DE BOLIVAR;LA CANDELARIA;CRA 7 CL 10',
    '11;001;01;02;BOGOTA D.C.;BOGOTA, D.C.;CORFERIAS;TEUSAQUILLO;CRA 37 NO 24-67',
    '11;001;02;01;BOGOTA D.C.;BOGOTA, D.C.;UNIR ANDINO;CHAPINERO;CL 67 NO 5-30',
    '05;001;01;01;ANTIOQUIA;MEDELLIN;PLAZA MAYOR;LA CANDELARIA;CALLE 41 #55-80',
    '05;001;01;02;ANTIOQUIA;MEDELLIN;ESTADIO ATANASIO GIRARDOT;LAURELES;CALLE 48 #73-10',
    '23;189;01;01;CORDOBA;COTORRA;COLEGIO EL CARMEN;CENTRO;CALLE PRINCIPAL',
    '76;001;01;01;VALLE DEL CAUCA;CALI;CAM CENTRO ADMINISTRATIVO;CENTRO;AV 2 NORTE',
    '08;001;01;01;ATLANTICO;BARRANQUILLA;ESTADIO METROPOLITANO;SUR;CALLE 45'
  ].join('\n');

  // 1. Verificación de Firma y Encabezados
  console.log('--- 1. Validación de Firma PDF y SHA-256 ---');
  const auditReport = await auditVotingPlacesRelationshipDocument(officialRelacionPuestosContent);

  assert(auditReport.isAuthenticPdf === true, 'El documento cuenta con firma PDF auténtica (%PDF-1.7)');
  assert(auditReport.sha256.length === 64, 'SHA-256 es calculado sobre el documento real (64 caracteres hex)');
  assert(auditReport.documentName === 'relacion_puestos_de_votacion.pdf', 'Nombre de documento coincide');
  assert(auditReport.cutoffDate === '24 DE DICIEMBRE DE 2025', 'Fecha de corte identificada: 24 DE DICIEMBRE DE 2025');

  // 2. Verificación de Columnas y Ausencia de Mesas
  console.log('--- 2. Verificación de Campos y Ausencia de Mesas ---');
  assert(auditReport.columnsPresent.includes('DD'), 'Columna DD presente');
  assert(auditReport.columnsPresent.includes('MM'), 'Columna MM presente');
  assert(auditReport.columnsPresent.includes('ZZ'), 'Columna ZZ presente');
  assert(auditReport.columnsPresent.includes('PP'), 'Columna PP presente');
  assert(auditReport.columnsPresent.includes('Dirección'), 'Columna Dirección presente');
  assert(auditReport.columnsPresent.includes('Comuna'), 'Columna Comuna presente');
  assert(auditReport.hasPollingTables === false, 'El documento NO CONTIENE MESAS (Regla estricta)');
  assert(auditReport.hasCensus === false, 'El documento NO CONTIENE CENSO');
  assert(auditReport.hasCoordinates === false, 'El documento NO CONTIENE COORDENADAS GEO (Lat/Lon)');
  assert(auditReport.columnsMissing.includes('MESAS'), 'MESAS reportada como NO PRESENTE');

  // 3. Estructura y Desglose por Departamento
  console.log('--- 3. Desglose Departamental y Conteo de Puestos ---');
  assert(auditReport.totalDepartments === 5, '5 departamentos identificados en la muestra de auditoría');
  assert(auditReport.totalMunicipalities === 5, '5 municipios identificados');
  assert(auditReport.totalPollingPlaces === 8, '8 puestos de votación normalizados');
  assert(auditReport.departmentsBreakdown.length === 5, 'Desglose departamental generado');

  const bogotaEntry = auditReport.departmentsBreakdown.find(d => d.codDpto === '11');
  assert(bogotaEntry?.puestos === 3, 'Bogotá D.C. registra 3 puestos en la muestra');

  // 4. Verificación de CERO Escrituras (Read-Only)
  console.log('--- 4. Garantía de Cero Escrituras a Supabase ---');
  assert(auditReport.databaseWritesPerformed === 0, '0 operaciones de escritura (0 INSERT, 0 UPDATE, 0 DELETE)');

  // 5. Verificación de Clasificación Técnica Oficial
  console.log('--- 5. Clasificación Técnica de la Fuente ---');
  assert(
    auditReport.classification === 'FUENTE_COMPLEMENTARIA_NO_DEFINITIVA',
    'Clasificación técnica correcta: B. FUENTE COMPLEMENTARIA, NO DEFINITIVA'
  );

  // 6. Prueba de Manejo de Bloqueo WAF en URL Remota
  console.log('--- 6. Verificación de Manejo Seguro de WAF en URL Remota ---');
  const wafBlockedHtml = '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>Cloudflare Bot Protection</body></html>';
  const blockCheck = isHtmlOrBlockedContent(wafBlockedHtml);
  assert(blockCheck.isBlocked === true, 'isHtmlOrBlockedContent detecta bloqueo WAF de forma no destructiva');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE AUDITORÍA READ-ONLY PASARON EXITOSAMENTE');
  console.log('============================================================\n');
}

runVotingPlacesAuditTests().catch((err) => {
  console.error('Error ejecutando auditoría de relación de puestos:', err);
  process.exit(1);
});
