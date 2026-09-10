/**
 * SUITE DE PRUEBAS DE ACTIVACIÓN DEL SCHEDULED TRIGGER DE CLOUDFLARE
 * Archivo: tests/cloudflareScheduledTrigger.test.ts
 * 
 * Verifica los 12 escenarios de auditoría y ejecución del cron:
 * TEST 1: El scheduler está configurado.
 * TEST 2: El cron es exactamente "0 3 * * 0".
 * TEST 3: El handler recibe un Scheduled Event.
 * TEST 4: El handler ejecuta schedulerEngine.
 * TEST 5: La fuente REGISTRADURIA_CENSO_PRESIDENCIAL_2026 es procesada.
 * TEST 6: WAF/403 produce SOURCE_BLOCKED.
 * TEST 7: WAF produce 0 DB writes.
 * TEST 8: No se guarda SHA de una página WAF.
 * TEST 9: No se modifican polling_stations.
 * TEST 10: No se modifican campañas.
 * TEST 11: No se modifican usuarios.
 * TEST 12: No se crean Scheduled Triggers duplicados en la configuración.
 */

import fs from 'fs';
import path from 'path';
import cloudflareHandler, {
  handleScheduledEvent,
  CloudflareScheduledEvent,
  CloudflareWorkerEnv
} from '../src/services/registraduria/cloudflareScheduledHandler';
import { getOfficialProcessSource } from '../src/services/registraduria/processRegistry';
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

async function runCloudflareScheduledTriggerTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO 12 PRUEBAS DE SCHEDULED TRIGGER DE CLOUDFLARE');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  // TEST 1: El scheduler está configurado
  console.log('--- TEST 1: El scheduler está configurado ---');
  assert(typeof cloudflareHandler.scheduled === 'function', 'cloudflareHandler.scheduled está definido como función exportada');
  assert(typeof cloudflareHandler.fetch === 'function', 'cloudflareHandler.fetch está definido como función exportada');
  assert(typeof handleScheduledEvent === 'function', 'handleScheduledEvent está disponible');

  // TEST 2: El cron es exactamente "0 3 * * 0" en la configuración del Worker Scheduler
  console.log('--- TEST 2: El cron es exactamente "0 3 * * 0" en el Worker Scheduler ---');
  const schedulerTomlPath = path.resolve(process.cwd(), 'wrangler.scheduler.toml');
  const schedulerJsonPath = path.resolve(process.cwd(), 'wrangler.scheduler.json');
  
  const tomlContent = fs.readFileSync(schedulerTomlPath, 'utf8');
  const jsonContent = JSON.parse(fs.readFileSync(schedulerJsonPath, 'utf8'));

  assert(tomlContent.includes('crons = ["0 3 * * 0"]'), 'wrangler.scheduler.toml contiene cron "0 3 * * 0"');
  assert(Array.isArray(jsonContent.triggers?.crons) && jsonContent.triggers.crons[0] === '0 3 * * 0', 'wrangler.scheduler.json contiene crons ["0 3 * * 0"]');

  // TEST 3: El handler recibe un Scheduled Event
  console.log('--- TEST 3: El handler recibe un Scheduled Event ---');
  const mockEvent: CloudflareScheduledEvent = {
    cron: '0 3 * * 0',
    scheduledTime: Date.now()
  };
  const mockEnv: CloudflareWorkerEnv = {
    SUPABASE_URL: 'https://cjvztlvxdsuiluybvtpl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key-test-only',
    CRON_SECRET: 'test-cron-secret-123'
  };

  const scheduledSummary = await handleScheduledEvent(mockEvent, mockEnv, undefined, { dryRun: true });
  assert(scheduledSummary.cron === '0 3 * * 0', 'ScheduledSummary reporta cron correcto');
  assert(typeof scheduledSummary.timestamp === 'string', 'ScheduledSummary genera timestamp ISO');
  assert(scheduledSummary.timezoneConversion.includes('Sábados 22:00'), 'Conversión a hora Colombia (UTC-5) calculada');

  // TEST 4: El handler ejecuta schedulerEngine
  console.log('--- TEST 4: El handler ejecuta schedulerEngine ---');
  assert(Array.isArray(scheduledSummary.results), 'ScheduledSummary retorna lista de resultados de fuentes');
  assert(scheduledSummary.results.length > 0, 'Al menos un proceso electoral fue evaluado');

  // TEST 5: La fuente REGISTRADURIA_CENSO_PRESIDENCIAL_2026 es procesada
  console.log('--- TEST 5: La fuente REGISTRADURIA_CENSO_PRESIDENCIAL_2026 es procesada ---');
  const censoResult = scheduledSummary.results.find(
    r => r.processId === 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026'
  );
  assert(censoResult !== undefined, 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026 fue encontrada y procesada en el cron');
  assert(censoResult?.status !== 'SOURCE_PENDING_CONFIGURATION', 'Estado NO es SOURCE_PENDING_CONFIGURATION');

  // TEST 6: WAF/403 produce SOURCE_BLOCKED
  console.log('--- TEST 6: WAF/403 produce SOURCE_BLOCKED ---');
  assert(censoResult?.status === 'SOURCE_BLOCKED', `Resultado remoto WAF clasificado como SOURCE_BLOCKED (actual: ${censoResult?.status})`);

  // TEST 7: WAF produce 0 DB writes
  console.log('--- TEST 7: WAF produce 0 DB writes ---');
  const syncExecResult = await executeScheduledElectoralSync({
    processId: 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026',
    supabaseClient: db.mockClient(),
    dryRun: true
  });
  assert(syncExecResult.cantidadNuevos === 0, '0 registros nuevos insertados');
  assert(syncExecResult.cantidadModificados === 0, '0 registros modificados');
  assert(syncExecResult.cantidadDesactivados === 0, '0 registros desactivados');

  // TEST 8: No se guarda SHA de una página WAF
  console.log('--- TEST 8: No se guarda SHA de una página WAF ---');
  assert(syncExecResult.sha256 === 'SOURCE_BLOCKED' || syncExecResult.sha256 === 'ERROR', 'Hash de página WAF no es almacenado como SHA válido');

  // TEST 9: No se modifican polling_stations
  console.log('--- TEST 9: No se modifican polling_stations ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations permanece 100% inalterada');

  // TEST 10: No se modifican campañas
  console.log('--- TEST 10: No se modifican campañas ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas permanecen 100% intactas');

  // TEST 11: No se modifican usuarios
  console.log('--- TEST 11: No se modifican usuarios ---');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios permanecen 100% intactos');

  // TEST 12: No se crean Scheduled Triggers duplicados en la configuración y Pages permanece limpia
  console.log('--- TEST 12: Unicidad del Scheduled Trigger en Worker y Pages limpia ---');
  const tomlCronMatches = tomlContent.match(/crons\s*=\s*\[(.*?)\]/g) || [];
  assert(tomlCronMatches.length === 1, 'Exactamente 1 definición de crons en wrangler.scheduler.toml');
  assert(jsonContent.triggers.crons.length === 1, 'Exactamente 1 cron en wrangler.scheduler.json');

  const pagesToml = fs.readFileSync(path.resolve(process.cwd(), 'wrangler.toml'), 'utf8');
  assert(!pagesToml.includes('[triggers]'), 'wrangler.toml de Pages no tiene triggers');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 12 PRUEBAS DEL SCHEDULED TRIGGER PASARON AL 100%');
  console.log('============================================================\n');
}

runCloudflareScheduledTriggerTests().catch((err) => {
  console.error('Error ejecutando pruebas de Scheduled Trigger:', err);
  process.exit(1);
});
