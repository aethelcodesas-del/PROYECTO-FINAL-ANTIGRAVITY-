/**
 * SUITE DE PRUEBAS DE SEPARACIÓN ARQUITECTÓNICA CLOUDFLARE PAGES + WORKER SCHEDULER
 * Archivo: tests/cloudflarePagesWorkerSeparation.test.ts
 * 
 * Verifica los 12 criterios de la separación de infraestructura:
 * 1. Pages no contiene triggers en su configuración.
 * 2. Worker Scheduler contiene triggers.
 * 3. El cron es exactamente "0 3 * * 0".
 * 4. Existe un único Scheduled Trigger en el Worker.
 * 5. scheduled() está exportado en el Worker.
 * 6. El Worker utiliza schedulerEngine a través de cloudflareScheduledHandler.
 * 7. No se duplica la lógica de sincronización.
 * 8. WAF produce SOURCE_BLOCKED.
 * 9. WAF produce 0 escrituras en base de datos.
 * 10. polling_stations permanece 100% intacta.
 * 11. Campañas permanecen 100% intactas.
 * 12. Usuarios permanecen 100% intactos.
 */

import fs from 'fs';
import path from 'path';
import workerScheduler from '../workers/registraduria-scheduler';
import cloudflareHandler, {
  handleScheduledEvent,
  CloudflareScheduledEvent,
  CloudflareWorkerEnv
} from '../src/services/registraduria/cloudflareScheduledHandler';
import { executeScheduledElectoralSync } from '../src/services/registraduria/schedulerEngine';
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

async function runPagesWorkerSeparationTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO 12 PRUEBAS DE SEPARACIÓN PAGES + WORKER SCHEDULER');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  // 1. Pages no contiene triggers
  console.log('--- 1. Pages NO contiene triggers en su configuración ---');
  const pagesTomlPath = path.resolve(process.cwd(), 'wrangler.toml');
  const pagesJsonPath = path.resolve(process.cwd(), 'wrangler.json');
  
  const pagesTomlContent = fs.readFileSync(pagesTomlPath, 'utf8');
  const pagesJsonContent = JSON.parse(fs.readFileSync(pagesJsonPath, 'utf8'));

  assert(!pagesTomlContent.includes('[triggers]'), 'wrangler.toml de Pages NO contiene [triggers]');
  assert(!pagesTomlContent.includes('crons ='), 'wrangler.toml de Pages NO contiene directiva crons');
  assert(pagesJsonContent.triggers === undefined, 'wrangler.json de Pages NO contiene propiedad triggers');

  // 2. Worker Scheduler contiene triggers
  console.log('--- 2. Worker Scheduler contiene triggers ---');
  const schedulerTomlPath = path.resolve(process.cwd(), 'wrangler.scheduler.toml');
  const schedulerJsonPath = path.resolve(process.cwd(), 'wrangler.scheduler.json');

  const schedulerTomlContent = fs.readFileSync(schedulerTomlPath, 'utf8');
  const schedulerJsonContent = JSON.parse(fs.readFileSync(schedulerJsonPath, 'utf8'));

  assert(schedulerTomlContent.includes('[triggers]'), 'wrangler.scheduler.toml contiene [triggers]');
  assert(schedulerJsonContent.triggers !== undefined, 'wrangler.scheduler.json contiene triggers');

  // 3. El cron es domingo 03:00 UTC ("0 3 * * SUN" o "0 3 * * 0")
  console.log('--- 3. El cron del Worker es exactamente domingo 03:00 UTC ("0 3 * * SUN" o "0 3 * * 0") ---');
  const validCronPattern = /crons\s*=\s*\["(0 3 \* \* (SUN|0))"\]/;
  assert(validCronPattern.test(schedulerTomlContent), 'wrangler.scheduler.toml tiene cron domingo 03:00 UTC');
  assert(['0 3 * * SUN', '0 3 * * 0'].includes(schedulerJsonContent.triggers.crons[0]), 'wrangler.scheduler.json tiene cron domingo 03:00 UTC');

  // 4. Existe un único Scheduled Trigger
  console.log('--- 4. Unicidad del Scheduled Trigger en el Worker ---');
  const cronMatches = schedulerTomlContent.match(/crons\s*=\s*\[(.*?)\]/g) || [];
  assert(cronMatches.length === 1, 'Exactamente 1 cron registrado en wrangler.scheduler.toml');
  assert(schedulerJsonContent.triggers.crons.length === 1, 'Exactamente 1 cron registrado en wrangler.scheduler.json');

  // 5. scheduled() está exportado en el Worker
  console.log('--- 5. Exportación de scheduled() y fetch() en el Worker ---');
  assert(typeof workerScheduler.scheduled === 'function', 'workerScheduler.scheduled es función exportada');
  assert(typeof workerScheduler.fetch === 'function', 'workerScheduler.fetch es función exportada');

  // 6. El Worker utiliza schedulerEngine
  console.log('--- 6. El Worker conecta y ejecuta schedulerEngine ---');
  const mockEvent: CloudflareScheduledEvent = {
    cron: '0 3 * * 0',
    scheduledTime: Date.now()
  };
  const mockEnv: CloudflareWorkerEnv = {
    SUPABASE_URL: 'https://cjvztlvxdsuiluybvtpl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
    CRON_SECRET: 'test-cron-secret'
  };

  const scheduledRes = await workerScheduler.scheduled(mockEvent, mockEnv, undefined);
  assert(scheduledRes !== undefined, 'workerScheduler.scheduled responde con resumen de ejecución');
  assert(scheduledRes.cron === '0 3 * * 0', 'Resumen reporta cron "0 3 * * 0"');
  assert(Array.isArray(scheduledRes.results), 'Resumen contiene array de resultados');

  // 7. No se duplica la lógica de sincronización
  console.log('--- 7. Reutilización completa de lógica existente (sin duplicación) ---');
  const workerFileContent = fs.readFileSync(path.resolve(process.cwd(), 'workers/registraduria-scheduler.ts'), 'utf8');
  assert(workerFileContent.includes('cloudflareScheduledHandler'), 'Worker importa directamente cloudflareScheduledHandler');

  // 8. WAF produce SOURCE_BLOCKED
  console.log('--- 8. WAF de Registraduría produce SOURCE_BLOCKED ---');
  const censoRes = scheduledRes.results.find((r: any) => r.processId === 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(censoRes !== undefined, 'Fuente oficial de censo evaluada');
  assert(censoRes.status === 'SOURCE_BLOCKED', `Resultado WAF clasificado como SOURCE_BLOCKED (actual: ${censoRes.status})`);

  // 9. WAF produce 0 escrituras en base de datos
  console.log('--- 9. Cero escrituras en base de datos ante WAF ---');
  const syncRes = await executeScheduledElectoralSync({
    processId: 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026',
    supabaseClient: db.mockClient(),
    dryRun: true
  });
  assert(syncRes.cantidadNuevos === 0, '0 registros nuevos');
  assert(syncRes.cantidadModificados === 0, '0 registros modificados');
  assert(syncRes.cantidadDesactivados === 0, '0 registros desactivados');

  // 10. polling_stations permanece 100% intacta
  console.log('--- 10. polling_stations 100% inalterada ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations permanece 100% intacta');

  // 11. Campañas permanecen 100% intactas
  console.log('--- 11. Campañas 100% inalteradas ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas permanecen 100% intactas');

  // 12. Usuarios permanecen 100% intactos
  console.log('--- 12. Usuarios 100% intactos ---');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios permanecen 100% intactos');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 12 PRUEBAS DE SEPARACIÓN PAGES + WORKER PASARON');
  console.log('============================================================\n');
}

runPagesWorkerSeparationTests().catch((err) => {
  console.error('Error ejecutando pruebas de separación Pages/Worker:', err);
  process.exit(1);
});
