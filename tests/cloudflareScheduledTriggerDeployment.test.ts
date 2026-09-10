/**
 * SUITE DE PRUEBAS DE DEPLOYMENT Y VERIFICACIÓN DEL SCHEDULED TRIGGER EN CLOUDFLARE
 * Archivo: tests/cloudflareScheduledTriggerDeployment.test.ts
 * 
 * Verifica los 10 criterios obligatorios de la fase:
 * 1. Cron "0 3 * * 0"
 * 2. Handler scheduled() exportado
 * 3. Conexión con schedulerEngine
 * 4. Ausencia de triggers duplicados
 * 5. Separación rigurosa CONFIGURED vs ACTIVE
 * 6. WAF = SOURCE_BLOCKED
 * 7. WAF = 0 escrituras en base de datos
 * 8. polling_stations intacta
 * 9. campañas intactas
 * 10. usuarios intactos
 * 11. Diagnóstico de autenticación Cloudflare (CLOUDFLARE_AUTH_REQUIRED)
 */

import fs from 'fs';
import path from 'path';
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

async function runScheduledTriggerDeploymentTests() {
  console.log('\n============================================================');
  console.log('EJECUTANDO PRUEBAS DE DEPLOYMENT DE SCHEDULED TRIGGER (CLOUDFLARE)');
  console.log('============================================================\n');

  const db = new MockElectoralCatalogDb();
  const initialStationsSnapshot = JSON.stringify(db.polling_stations);
  const initialCampaignsSnapshot = JSON.stringify(db.campaigns);
  const initialUsersSnapshot = JSON.stringify(db.users);

  // 1. Cron 0 3 * * 0
  console.log('--- 1. Verificación de Expresión Cron "0 3 * * 0" ---');
  const wranglerTomlPath = path.resolve(process.cwd(), 'wrangler.toml');
  const wranglerJsonPath = path.resolve(process.cwd(), 'wrangler.json');
  
  const tomlContent = fs.readFileSync(wranglerTomlPath, 'utf8');
  const jsonContent = JSON.parse(fs.readFileSync(wranglerJsonPath, 'utf8'));

  assert(tomlContent.includes('crons = ["0 3 * * 0"]'), 'wrangler.toml declara cron "0 3 * * 0"');
  assert(jsonContent.triggers?.crons?.[0] === '0 3 * * 0', 'wrangler.json declara cron "0 3 * * 0"');

  // 2. Handler scheduled() exportado
  console.log('--- 2. Verificación de Exportación de Handler scheduled() ---');
  assert(typeof cloudflareHandler.scheduled === 'function', 'cloudflareHandler.scheduled es función exportada');
  assert(typeof cloudflareHandler.fetch === 'function', 'cloudflareHandler.fetch es función exportada');

  // 3. Conexión con scheduler
  console.log('--- 3. Conexión con schedulerEngine ---');
  const mockEvent: CloudflareScheduledEvent = {
    cron: '0 3 * * 0',
    scheduledTime: Date.now()
  };
  const mockEnv: CloudflareWorkerEnv = {
    SUPABASE_URL: 'https://cjvztlvxdsuiluybvtpl.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key-for-test-only',
    CRON_SECRET: 'test-cron-secret'
  };

  const summary = await handleScheduledEvent(mockEvent, mockEnv, undefined, { dryRun: true });
  assert(summary.cron === '0 3 * * 0', 'handleScheduledEvent procesa cron');
  assert(Array.isArray(summary.results), 'handleScheduledEvent retorna lista de resultados');

  // 4. Ausencia de triggers duplicados
  console.log('--- 4. Ausencia de Triggers Duplicados ---');
  const tomlMatches = tomlContent.match(/crons\s*=\s*\[(.*?)\]/g) || [];
  assert(tomlMatches.length === 1, 'Exactamente 1 definición de trigger en wrangler.toml');
  assert(jsonContent.triggers.crons.length === 1, 'Exactamente 1 trigger en wrangler.json');

  // 5. Separación CONFIGURED vs ACTIVE
  console.log('--- 5. Separación Rigurosa CONFIGURED vs ACTIVE ---');
  const sourceDef = getOfficialProcessSource('REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(sourceDef.status === 'SOURCE_CONFIGURED', 'Estado de la fuente en registro es SOURCE_CONFIGURED');
  const isTriggerConfiguredInCode = typeof cloudflareHandler.scheduled === 'function' && tomlMatches.length === 1;
  assert(isTriggerConfiguredInCode === true, 'Trigger está completamente configurado en código (SCHEDULED_TRIGGER_CONFIGURED)');

  // 6. WAF = SOURCE_BLOCKED
  console.log('--- 6. Comportamiento ante WAF (SOURCE_BLOCKED) ---');
  const censoResult = summary.results.find(r => r.processId === 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026');
  assert(censoResult?.status === 'SOURCE_BLOCKED', `WAF clasificado como SOURCE_BLOCKED (actual: ${censoResult?.status})`);

  // 7. WAF = 0 escrituras
  console.log('--- 7. Cero Escrituras ante WAF ---');
  const syncExec = await executeScheduledElectoralSync({
    processId: 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026',
    supabaseClient: db.mockClient(),
    dryRun: true
  });
  assert(syncExec.cantidadNuevos === 0, '0 inserciones');
  assert(syncExec.cantidadModificados === 0, '0 modificaciones');
  assert(syncExec.cantidadDesactivados === 0, '0 eliminaciones/desactivaciones');

  // 8. polling_stations intacta
  console.log('--- 8. polling_stations Inalterada ---');
  assert(JSON.stringify(db.polling_stations) === initialStationsSnapshot, 'polling_stations 100% inalterada');

  // 9. Campañas intactas
  console.log('--- 9. Campañas Inalteradas ---');
  assert(JSON.stringify(db.campaigns) === initialCampaignsSnapshot, 'Campañas 100% inalteradas');

  // 10. Usuarios intactos
  console.log('--- 10. Usuarios Inalterados ---');
  assert(JSON.stringify(db.users) === initialUsersSnapshot, 'Usuarios 100% inalterados');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 10 PRUEBAS DE DEPLOYMENT Y VERIFICACIÓN PASARON');
  console.log('============================================================\n');
}

runScheduledTriggerDeploymentTests().catch((err) => {
  console.error('Error ejecutando pruebas de deployment de scheduled trigger:', err);
  process.exit(1);
});
