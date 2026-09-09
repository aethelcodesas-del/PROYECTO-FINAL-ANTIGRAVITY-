/**
 * PRUEBAS DE AUTOMATIZACIÓN, SCHEDULER, LOCK DISTRIBUIDO Y VALIDACIÓN DE FUENTES (FASE 6.1)
 * Ejecutable mediante: npx tsx tests/officialElectoralScheduler.test.ts
 */

import {
  acquireDistributedSyncLock,
  releaseDistributedSyncLock,
  acquireLocalSyncLock,
  releaseLocalSyncLock,
  detectAnomalousVariation,
  executeScheduledElectoralSync,
  DEFAULT_PROCESO_CONGRESO_2026
} from '../src/services/registraduria/schedulerEngine';

import {
  getOfficialProcessSource,
  getAllOfficialProcessSources,
  isSourceReadyForSync,
  OfficialProcessSourceDefinition
} from '../src/services/registraduria/processRegistry';

import { handleScheduledEvent } from '../src/services/registraduria/cloudflareScheduledHandler';
import { parseOfficialElectoralContent, isHtmlOrBlockedContent } from '../src/services/registraduria/registraduriaOfficialAdapter';
import { calculateSha256 } from '../src/services/registraduria/sha256';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

async function runSchedulerTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO SUITE DE PRUEBAS DEL SCHEDULER Y FAIL-SAFE (FASE 6.1)');
  console.log('============================================================\n');

  // 1. Control de Concurrencia y Lock Local / Distribuido
  releaseLocalSyncLock();
  const lock1 = acquireLocalSyncLock('worker-A', 15);
  assert(lock1.acquired === true, 'Primer lock debe ser adquirido exitosamente');

  const lock2 = acquireLocalSyncLock('worker-B', 15);
  assert(lock2.acquired === false, 'Segundo lock concurrente debe ser rechazado');
  assert(lock2.reason?.includes('activa') === true, 'Debe incluir razón descriptiva del bloqueo concurrente');

  // Auto-recuperación de lock expirado
  const expiredMockLock = acquireLocalSyncLock('worker-C', -1); // TTL negativo = expirado inmediatamente
  assert(expiredMockLock.acquired === true, 'Lock expirado debe poder ser recuperado automáticamente por un nuevo worker');

  releaseLocalSyncLock();
  const lock3 = acquireLocalSyncLock('worker-D', 15);
  assert(lock3.acquired === true, 'Lock liberado debe poder ser adquirido nuevamente');
  releaseLocalSyncLock();

  // 2. Simulación de Lock con Mock Supabase Client
  let mockLockTable: Record<string, any> = {};
  const mockSupabaseClient = {
    rpc: async (fnName: string, params: any) => {
      if (fnName === 'acquire_official_sync_lock') {
        const existing = mockLockTable[params.p_lock_key];
        const now = Date.now();
        if (existing && existing.expires_at > now && existing.locked_by !== params.p_locked_by) {
          return {
            data: {
              acquired: false,
              reason: `Lock ocupado por ${existing.locked_by}`
            },
            error: null
          };
        }
        mockLockTable[params.p_lock_key] = {
          locked_by: params.p_locked_by,
          expires_at: now + (params.p_ttl_minutes * 60 * 1000)
        };
        return {
          data: {
            acquired: true,
            recovered_expired: false,
            lock_key: params.p_lock_key,
            locked_by: params.p_locked_by
          },
          error: null
        };
      }
      if (fnName === 'release_official_sync_lock') {
        delete mockLockTable[params.p_lock_key];
        return { data: { released: true }, error: null };
      }
      return { data: null, error: 'Unknown RPC' };
    }
  };

  const distLock1 = await acquireDistributedSyncLock(mockSupabaseClient, 'TEST_KEY', 'worker-1', 10);
  assert(distLock1.acquired === true, 'Lock distribuido Supabase debe ser adquirido por worker-1');

  const distLock2 = await acquireDistributedSyncLock(mockSupabaseClient, 'TEST_KEY', 'worker-2', 10);
  assert(distLock2.acquired === false, 'Lock distribuido Supabase debe rechazar a worker-2 mientras worker-1 está activo');

  await releaseDistributedSyncLock(mockSupabaseClient, 'TEST_KEY', 'worker-1');
  const distLock3 = await acquireDistributedSyncLock(mockSupabaseClient, 'TEST_KEY', 'worker-2', 10);
  assert(distLock3.acquired === true, 'Lock distribuido Supabase liberado debe permitir adquisición por worker-2');
  await releaseDistributedSyncLock(mockSupabaseClient, 'TEST_KEY', 'worker-2');

  // 3. Verificación de Fuentes Oficiales por Proceso (SOURCE_PENDING_CONFIGURATION)
  const congresoSource = getOfficialProcessSource('COL-2026-CONGRESO');
  assert(congresoSource.status === 'SOURCE_PENDING_CONFIGURATION', 'Congreso 2026 con fuente PDF debe estar en SOURCE_PENDING_CONFIGURATION');
  assert(isSourceReadyForSync(congresoSource) === false, 'Fuente en SOURCE_PENDING_CONFIGURATION no debe estar lista para sincronizar');
  assert(congresoSource.expectedSchema?.includes('COD_DPTO') === true, 'Debe registrar esquema esperado de columnas oficiales');

  const pres1vSource = getOfficialProcessSource('COL-2026-PRES-1V');
  assert(pres1vSource.status === 'SOURCE_PENDING_CONFIGURATION', 'Presidencial 1V debe estar en SOURCE_PENDING_CONFIGURATION');

  const pres2vSource = getOfficialProcessSource('COL-2026-PRES-2V');
  assert(pres2vSource.status === 'SOURCE_PENDING_CONFIGURATION', 'Presidencial 2V debe estar en SOURCE_PENDING_CONFIGURATION');

  const territorialSource = getOfficialProcessSource('COL-2027-TERRITORIAL');
  assert(territorialSource.status === 'SOURCE_PENDING_CONFIGURATION', 'Territoriales 2027 debe estar en SOURCE_PENDING_CONFIGURATION');

  // 4. Ejecución del Scheduler con Proceso en SOURCE_PENDING_CONFIGURATION
  const pendingSync = await executeScheduledElectoralSync({
    processId: 'COL-2026-CONGRESO'
  });
  assert(pendingSync.status === 'RECHAZADA_INCOMPLETA', 'Debe rechazar sincronización de proceso sin fuente configurada');
  assert(pendingSync.sha256 === 'SOURCE_PENDING_CONFIGURATION', 'Debe reportar sha256 como SOURCE_PENDING_CONFIGURATION');
  assert(pendingSync.message.includes('SOURCE_PENDING_CONFIGURATION'), 'Debe documentar claramente que se omite descarga y RPC');

  // 5. Rechazo de URLs de Ejemplo o Placeholder
  const placeholderSync = await executeScheduledElectoralSync({
    processConfig: DEFAULT_PROCESO_CONGRESO_2026,
    sourceUrl: 'https://tu-dominio.com/archivo_divipole.csv'
  });
  assert(placeholderSync.sha256 === 'INVALID_SOURCE_URL', 'Debe rechazar URL placeholder "tu-dominio.com" sin descargar ni invocar RPC');

  // 6. Detección de Respuestas HTML / Captcha / WAF
  const htmlChallenge = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Cloudflare Challenge</body></html>';
  const blockCheck1 = isHtmlOrBlockedContent(htmlChallenge);
  assert(blockCheck1.isBlocked === true, 'Debe detectar y rechazar página de desafío Cloudflare / Captcha');

  const http403Page = '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body>Access Denied</body></html>';
  const blockCheck2 = isHtmlOrBlockedContent(http403Page);
  assert(blockCheck2.isBlocked === true, 'Debe detectar y rechazar respuesta 403 Forbidden');

  // 7. Validación de Archivo Vacío o Columnas Obligatorias Ausentes
  const emptyCsvResult = await parseOfficialElectoralContent('', 'https://test.gov.co/empty.csv', DEFAULT_PROCESO_CONGRESO_2026);
  assert(emptyCsvResult.success === false, 'Archivo vacío debe ser rechazado');
  assert(emptyCsvResult.statistics.registrosValidos === 0, 'Archivo vacío no debe generar registros válidos');

  const missingColumnsCsv = 'COLUMNA_INEXISTENTE,OTRA_COLUMNA\n1,2';
  const missingColsResult = await parseOfficialElectoralContent(missingColumnsCsv, 'https://test.gov.co/missing.csv', DEFAULT_PROCESO_CONGRESO_2026);
  assert(missingColsResult.success === false, 'CSV sin columnas obligatorias debe ser rechazado');

  // 8. Cálculo de SHA-256
  const sampleContent = 'COD_DPTO,DEPARTAMENTO,COD_MPIO,MUNICIPIO,COD_ZONA,COD_PUESTO,PUESTO,MESAS\n23,CORDOBA,189,COTORRA,01,01,COLEGIO CENTRAL,10';
  const hash = await calculateSha256(sampleContent);
  assert(hash.length === 64, 'SHA-256 debe generar hash hexadecimal de 64 caracteres');

  // 9. Simulación de Proceso en SOURCE_VALIDATED
  const validatedMockDef: OfficialProcessSourceDefinition = {
    processConfig: DEFAULT_PROCESO_CONGRESO_2026,
    sourceUrl: 'https://opendata.registraduria.gov.co/divipole_2026.csv',
    sourceType: 'DIVIPOLE_CSV',
    enabled: true,
    status: 'SOURCE_VALIDATED',
    notes: 'Dataset oficial estructurado verificado'
  };
  assert(isSourceReadyForSync(validatedMockDef) === true, 'Proceso en SOURCE_VALIDATED con URL y CSV debe estar listo para sincronizar');

  // 10. Detección de Variación Anómala
  const anomalyReduction = detectAnomalousVariation(50, 100, 40);
  assert(anomalyReduction.isAnomalous === true, 'Debe detectar reducción del 50% como anómala');
  assert(anomalyReduction.reason?.includes('50.0%') === true, 'El mensaje debe detallar el porcentaje de reducción');

  const normalVariation = detectAnomalousVariation(98, 100, 40);
  assert(normalVariation.isAnomalous === false, 'Variación del 2% no debe considerarse anómala');

  const zeroPlaces = detectAnomalousVariation(0, 50, 40);
  assert(zeroPlaces.isAnomalous === true, '0 puestos en catálogo previo debe ser detectado como anómalo');

  // 11. Liberación del Lock en bloque Finally ante Errores
  try {
    await executeScheduledElectoralSync({
      processConfig: DEFAULT_PROCESO_CONGRESO_2026,
      sourceUrl: 'https://test-registraduria.gov.co/divipole_inexistente.csv',
      dryRun: true,
      maxRetries: 1
    });
  } catch (e) {}

  const postErrorLock = acquireLocalSyncLock('worker-verify', 15);
  assert(postErrorLock.acquired === true, 'Lock debe liberarse en finally aun si ocurre un fallo en la sincronización');
  releaseLocalSyncLock();

  // 12. Scheduled Handler de Cloudflare (handleScheduledEvent)
  const scheduledResult = await handleScheduledEvent(
    { cron: '0 3 * * 0', scheduledTime: Date.now() },
    { CRON_SECRET: 'test-secret' }
  );

  assert(scheduledResult.cron === '0 3 * * 0', 'Scheduled handler debe capturar la expresión cron');
  assert(scheduledResult.timezoneConversion.includes('Sábados 22:00'), 'Debe documentar la conversión horaria UTC a Colombia');
  assert(scheduledResult.results.length >= 4, 'Debe iterar y procesar todos los procesos registrados');
  assert(scheduledResult.results.every(r => r.status === 'SOURCE_PENDING_CONFIGURATION'), 'Todos los procesos pendientes deben ser omitidos de forma segura');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS PRUEBAS DEL SCHEDULER Y VALIDACIÓN DE FUENTES (FASE 6.1) PASARON');
  console.log('============================================================\n');
}

runSchedulerTests().catch((err) => {
  console.error('Error ejecutando pruebas del scheduler:', err);
  process.exit(1);
});
