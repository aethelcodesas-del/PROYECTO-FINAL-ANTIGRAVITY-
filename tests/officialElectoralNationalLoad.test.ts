/**
 * PRUEBAS DE CARGA NACIONAL CONTROLADA, PRE-CHECK, PLAUISIBILIDAD Y STAGING (FASE 10)
 * Ejecutable mediante: npx tsx tests/officialElectoralNationalLoad.test.ts
 */

import {
  executeNationalPreCheck,
  executeNationalDivipoleBatchLoad,
  MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS
} from '../src/services/registraduria/nationalDivipoleStagingService';
import { processOfficialPdfDivipole } from '../src/services/registraduria/pdfDivipoleAdapter';
import { DEFAULT_PROCESO_CONGRESO_2026 } from '../src/services/registraduria/schedulerEngine';
import { OfficialAdapterResult } from '../src/services/registraduria/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runNationalLoadTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE CARGA NACIONAL CONTROLADA (FASE 10)');
  console.log('============================================================\n');

  // 1. Pre-Check: Detección de Bloqueo WAF / 403 en Fuente Oficial
  const preCheckResult = await executeNationalPreCheck(
    'COL-2026-CONGRESO',
    'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf'
  );

  // Debido a que Registraduría protege su portal con WAF/403, el pre-check debe clasificarlo de forma segura
  assert(preCheckResult.passed === false, 'Pre-check debe detener la carga ante fuente bloqueada por WAF/403');
  assert(preCheckResult.status === 'FALLIDA_FUENTE_CAIDA', 'Estado debe ser FALLIDA_FUENTE_CAIDA');
  assert(preCheckResult.isWafBlocked === true, 'Debe identificar que existe bloqueo WAF/Anti-bot');

  // 2. Pre-Check: Rechazo de URLs Placeholder de Ejemplo
  const placeholderPreCheck = await executeNationalPreCheck(
    'COL-2026-CONGRESO',
    'https://tu-dominio.com/nacional.pdf'
  );
  assert(placeholderPreCheck.passed === false, 'Debe rechazar URL placeholder de ejemplo');
  assert(placeholderPreCheck.status === 'SOURCE_PENDING_CONFIGURATION', 'Estado debe ser SOURCE_PENDING_CONFIGURATION');

  // 3. Control de Plausibilidad: Rechazo de Muestras Parciales como si fuesen Catálogo Nacional
  const samplePdfText = '%PDF-1.7\n' + [
    'COD_DPTO;DEPARTAMENTO;COD_MPIO;MUNICIPIO;COD_ZONA;COD_PUESTO;PUESTO;MESAS',
    '23;CORDOBA;189;COTORRA;01;01;COLEGIO EL CARMEN;12',
    '05;ANTIOQUIA;001;MEDELLIN;01;01;PLAZA MAYOR;35'
  ].join('\n');

  const sampleAdapterResult: OfficialAdapterResult = await processOfficialPdfDivipole(
    samplePdfText,
    'https://www.registraduria.gov.co/IMG/pdf/Divipole_muestra.pdf',
    DEFAULT_PROCESO_CONGRESO_2026,
    { dryRun: true }
  );

  const strictCheckResult = await executeNationalDivipoleBatchLoad(sampleAdapterResult, {
    strictPlausibilityCheck: true
  });

  assert(strictCheckResult.success === false, 'Debe rechazar una muestra de 2 departamentos cuando se exige cobertura nacional');
  assert(strictCheckResult.status === 'SOURCE_EXTRACTION_INCOMPLETE', 'Estado debe ser SOURCE_EXTRACTION_INCOMPLETE');
  assert(strictCheckResult.pollingStationsUntouched === true, 'polling_stations permanece 100% intacta');

  // 4. Ejecución en DRY-RUN Nacional Seguro
  const dryRunNational = await executeNationalDivipoleBatchLoad(sampleAdapterResult, {
    dryRun: true,
    strictPlausibilityCheck: false
  });

  assert(dryRunNational.success === true, 'DRY-RUN nacional debe reportar éxito');
  assert(dryRunNational.status === 'EXITOSA_DRY_RUN', 'Estado debe ser EXITOSA_DRY_RUN');
  assert(dryRunNational.totalDepartments === 2, 'Detecta 2 departamentos');
  assert(dryRunNational.totalMunicipalities === 2, 'Detecta 2 municipios');
  assert(dryRunNational.totalPollingPlaces === 2, 'Detecta 2 puestos');
  assert(dryRunNational.totalPollingTables === 47, 'Detecta 47 mesas (12 + 35)');
  assert(dryRunNational.idempotencyVerified === true, 'Idempotencia verificada en dry-run');

  // 5. Verificación de Umbrales Mínimos Nacionales
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_DEPARTMENTS === 32, 'Umbral mínimo de departamentos debe ser 32');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_MUNICIPALITIES === 1000, 'Umbral mínimo de municipios debe ser 1000');
  assert(MIN_NATIONAL_PLAUSIBILITY_THRESHOLDS.MIN_POLLING_PLACES === 10000, 'Umbral mínimo de puestos debe ser 10000');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DE CARGA NACIONAL CONTROLADA (FASE 10) PASARON');
  console.log('============================================================\n');
}

runNationalLoadTests().catch((err) => {
  console.error('Error ejecutando pruebas de carga nacional:', err);
  process.exit(1);
});
