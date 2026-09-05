import assert from 'node:assert/strict';

// Test metric calculations
function computeMetrics(profiles, campaigns) {
  const activeUsers = profiles.filter((item) => {
    const status = String(item.status || '').toUpperCase();
    return status === 'ACTIVE' || status === 'ACTIVO';
  }).length;
  const inactiveUsers = profiles.filter((item) => {
    const status = String(item.status || '').toUpperCase();
    return status === 'INACTIVE' || status === 'INACTIVO';
  }).length;
  const blockedUsers = profiles.filter((item) => {
    const status = String(item.status || '').toUpperCase();
    return status === 'SUSPENDED' || status === 'SUSPENDIDO' || status === 'BLOQUEADO' || status === 'BLOCKED';
  }).length;
  const activeCampaigns = campaigns.filter((item) => {
    const state = String(item.estado || item.status || '').toUpperCase();
    return state === 'ACTIVA' || state === 'ACTIVE' || state === 'EN_CURSO' || !state;
  }).length;

  return {
    totalUsers: profiles.length,
    activeUsers,
    inactiveUsers,
    blockedUsers,
    globalAdminsCount: profiles.filter((item) => {
      const role = String(item.role || '').toUpperCase();
      return role === 'SUPERADMIN' || role === 'GLOBAL_ADMIN';
    }).length,
    totalCampaigns: campaigns.length,
    activeCampaigns,
  };
}

console.log('--- Test 1: Initial state (0 campaigns, 1 superadmin user) ---');
let profiles = [
  { id: 'usr-1', role: 'SUPERADMIN', status: 'ACTIVE', campaign_id: null }
];
let campaigns = [];
let m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 0);
assert.equal(m.totalCampaigns, 0);
assert.equal(m.totalUsers, 1);
assert.equal(m.activeUsers, 1);
console.log('PASS - Estado inicial: 0 campañas activas, 1 usuario total.');

console.log('--- Test 2: Create Campaign A with Candidate User ---');
campaigns.push({ id: 'cmp-1', nombre: 'Campaña A', estado: 'ACTIVA' });
profiles.push({ id: 'usr-2', role: 'ADMIN_CLIENTE', status: 'ACTIVE', campaign_id: 'cmp-1' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1);
assert.equal(m.totalCampaigns, 1);
assert.equal(m.totalUsers, 2);
assert.equal(m.activeUsers, 2);
console.log('PASS - Crear campaña A: 1 campaña activa, 2 usuarios totales.');

console.log('--- Test 3: Candidate creates Subuser 1 (COORDINADOR) in Campaign A ---');
profiles.push({ id: 'usr-3', role: 'COORDINADOR', status: 'ACTIVE', campaign_id: 'cmp-1' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1);
assert.equal(m.totalUsers, 3);
assert.equal(m.activeUsers, 3);
console.log('PASS - Crear subusuario 1: 1 campaña activa, 3 usuarios totales.');

console.log('--- Test 4: Candidate creates Subuser 2 (TESTIGO) in Campaign A ---');
profiles.push({ id: 'usr-4', role: 'TESTIGO', status: 'ACTIVO', campaign_id: 'cmp-1' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1);
assert.equal(m.totalUsers, 4);
assert.equal(m.activeUsers, 4);
console.log('PASS - Crear subusuario 2: 1 campaña activa, 4 usuarios totales (admite status ACTIVO).');

console.log('--- Test 5: Candidate creates Subuser 3 (DIGITADOR) in Campaign A ---');
profiles.push({ id: 'usr-5', role: 'USUARIO', status: 'ACTIVE', campaign_id: 'cmp-1' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1);
assert.equal(m.totalUsers, 5);
assert.equal(m.activeUsers, 5);
console.log('PASS - Crear subusuario 3: 1 campaña activa, 5 usuarios totales.');

console.log('--- Test 6: Create Campaign B with Candidate B ---');
campaigns.push({ id: 'cmp-2', nombre: 'Campaña B', estado: 'ACTIVA' });
profiles.push({ id: 'usr-6', role: 'ADMIN_CLIENTE', status: 'ACTIVE', campaign_id: 'cmp-2' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 2);
assert.equal(m.totalCampaigns, 2);
assert.equal(m.totalUsers, 6);
assert.equal(m.activeUsers, 6);
console.log('PASS - Crear campaña B: 2 campañas activas, 6 usuarios totales.');

console.log('--- Test 7: Candidate B creates 2 Subusers in Campaign B ---');
profiles.push({ id: 'usr-7', role: 'COORDINADOR', status: 'ACTIVE', campaign_id: 'cmp-2' });
profiles.push({ id: 'usr-8', role: 'TESTIGO', status: 'ACTIVE', campaign_id: 'cmp-2' });
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 2);
assert.equal(m.totalCampaigns, 2);
assert.equal(m.totalUsers, 8);
assert.equal(m.activeUsers, 8);
console.log('PASS - Subusuarios en Campaña B: 2 campañas activas, 8 usuarios totales.');

console.log('--- Test 8: Pause Campaign A (estado = PAUSADA) ---');
campaigns[0].estado = 'PAUSADA';
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1, 'Solo Campaña B sigue activa');
assert.equal(m.totalCampaigns, 2, 'Total campañas sigue siendo 2');
assert.equal(m.totalUsers, 8, 'Total usuarios sigue siendo 8');
console.log('PASS - Pausar campaña: 1 campaña activa, 2 totales, 8 usuarios.');

console.log('--- Test 9: Suspend/Block Subuser usr-3 ---');
profiles[2].status = 'SUSPENDED';
m = computeMetrics(profiles, campaigns);
assert.equal(m.activeCampaigns, 1);
assert.equal(m.totalUsers, 8, 'Total usuarios sigue siendo 8');
assert.equal(m.activeUsers, 7, 'Activos se reducen a 7');
assert.equal(m.blockedUsers, 1, 'Bloqueados aumenta a 1');
console.log('PASS - Suspender subusuario: 8 totales, 7 activos, 1 bloqueado.');

console.log('--- Test 10: Delete Subuser usr-5 ---');
profiles = profiles.filter(p => p.id !== 'usr-5');
m = computeMetrics(profiles, campaigns);
assert.equal(m.totalUsers, 7);
assert.equal(m.activeUsers, 6);
console.log('PASS - Eliminar subusuario: 7 usuarios totales.');

console.log('\nTODOS LOS CONTROLES DE CONTADORES PASARON SATISFACTORIAMENTE (10/10).');
