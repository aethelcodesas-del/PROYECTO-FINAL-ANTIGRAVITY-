const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

const PERMISSIONS_CATALOG = [
  { code: 'GLOBAL_ADMIN_FULL', name: 'Control Maestro de Plataforma', category: 'Sistema', description: 'Acceso total a la configuración administrativa de la plataforma.' },
  { code: 'USERS_VIEW', name: 'Consultar Usuarios', category: 'Usuarios', description: 'Consultar usuarios de campañas y de la plataforma.' },
  { code: 'USERS_CREATE', name: 'Crear Usuarios', category: 'Usuarios', description: 'Crear usuarios y asignarlos a una campaña.' },
  { code: 'USERS_EDIT', name: 'Modificar Usuarios', category: 'Usuarios', description: 'Modificar perfiles, roles y permisos.' },
  { code: 'USERS_STATUS', name: 'Cambiar Estado de Usuarios', category: 'Usuarios', description: 'Activar, suspender o bloquear cuentas.' },
  { code: 'ROLES_MANAGE', name: 'Gestionar Roles', category: 'Roles', description: 'Crear y mantener roles personalizados.' },
  { code: 'CAMPAIGNS_MANAGE', name: 'Administrar Campañas', category: 'Campañas', description: 'Crear, editar, pausar y eliminar campañas.' },
  { code: 'MODULES_CONTROL', name: 'Controlar Módulos', category: 'Módulos', description: 'Consultar y controlar módulos de la plataforma.' },
  { code: 'APIS_MANAGE', name: 'Supervisar APIs', category: 'APIs', description: 'Consultar disponibilidad de integraciones.' },
  { code: 'AUDIT_VIEW', name: 'Consultar Auditoría', category: 'Auditoría', description: 'Consultar la trazabilidad administrativa.' },
  { code: 'SECURITY_CONTROL', name: 'Gestionar Seguridad', category: 'Seguridad', description: 'Consultar y gestionar incidentes de seguridad.' },
  { code: 'CONFIG_MANAGE', name: 'Configuración Global', category: 'Sistema', description: 'Modificar parámetros globales persistidos.' }
];

const CAMPAIGN_STATUS_TO_CLIENT = {
  ACTIVA: 'Activa',
  PAUSADA: 'En Pausa',
  FINALIZADA: 'Finalizada',
  PLANIFICACION: 'En Configuración'
};

const CAMPAIGN_STATUS_TO_DATABASE = {
  Activa: 'ACTIVA',
  'En Pausa': 'PAUSADA',
  Finalizada: 'FINALIZADA',
  'En Configuración': 'PLANIFICACION'
};

const ELECTION_TYPES = new Set([
  'Presidencia', 'Alcaldía', 'Gobernación', 'Senado', 'Cámara', 'Concejo', 'Asamblea'
]);

const PROTECTED_ROLE_CODES = new Set([
  'SUPERADMIN', 'GLOBAL_ADMIN', 'ADMIN_CLIENTE', 'ADMINISTRADOR',
  'DIRECTOR', 'COORDINADOR', 'USUARIO', 'USUARIO_LIMITADO'
]);

const KNOWN_RESOURCES = new Set([
  'auth', 'dashboard', 'users', 'roles', 'permissions', 'campaigns', 'modules',
  'apis', 'audit-logs', 'security', 'config', 'landing-commercial', 'system', 'maintenance'
]);

const DEFAULT_SYSTEM_CONFIG = Object.freeze({
  sessionTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5,
  requireMfaForAdmins: false,
  maintenanceMode: false,
  maintenanceMessage: 'La plataforma se encuentra temporalmente en mantenimiento.',
  emergencyContactEmail: '',
  allowedIpRanges: [],
  corsOrigins: []
});

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function clean(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n]/g, '');
}

const DEFAULT_SUPABASE_URL = 'https://cjvztlvxdsuiluybvtpl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjU3MDAsImV4cCI6MjEwNDA0MTcwMH0.E-aIfV1P8XUDRW-lGC7lC6x6eOpwIdJeCpFDnxOI-uY';

function configuration(env) {
  const url = clean(env?.VITE_SUPABASE_URL || env?.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
  const publicKey = clean(
    env?.VITE_SUPABASE_ANON_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
  const serverKey = clean(env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY || publicKey);
  return { url, publicKey, serverKey };
}

function requireConfiguration(config) {
  if (!config.url || !config.publicKey) {
    throw new HttpError(
      503,
      'Supabase no está configurado en el entorno de Cloudflare Pages.',
      'SUPABASE_NOT_CONFIGURED'
    );
  }
}

function bearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

function databaseHeaders(config, userToken, extra = {}) {
  return {
    apikey: config.publicKey,
    authorization: `Bearer ${userToken || config.publicKey}`,
    accept: 'application/json',
    ...extra
  };
}

async function parseResponse(response) {
  if (response.status === 204 || response.status === 205) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseRest(config, userToken, resource, init = {}) {
  const headers = databaseHeaders(config, userToken, init.headers || {});
  if (init.body !== undefined && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${config.url}/rest/v1/${resource}`, {
    ...init,
    headers,
    body: init.body === undefined || typeof init.body === 'string'
      ? init.body
      : JSON.stringify(init.body)
  });
  const data = await parseResponse(response);

  if (!response.ok) {
    console.error('Global Admin Supabase request failed', {
      resource: resource.split('?')[0],
      method: init.method || 'GET',
      upstreamStatus: response.status,
      upstreamCode: data && typeof data === 'object' ? data.code : undefined
    });
    throw new HttpError(
      502,
      'Supabase no pudo completar la operación administrativa.',
      'SUPABASE_REQUEST_FAILED'
    );
  }

  return { data, response };
}

async function requireGlobalAdmin(request, config) {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, 'Token de autorización requerido.', 'AUTH_TOKEN_REQUIRED');
  }

  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publicKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });
  const user = await parseResponse(userResponse);
  if (!userResponse.ok || !user || typeof user !== 'object' || !user.id) {
    throw new HttpError(401, 'La sesión administrativa expiró.', 'AUTH_SESSION_EXPIRED');
  }

  const profileUrl = new URL(`${config.url}/rest/v1/profiles`);
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  profileUrl.searchParams.set('select', 'id,email,display_name,role,status,allowed_modules');
  profileUrl.searchParams.set('limit', '1');

  const profileResponse = await fetch(profileUrl, {
    headers: databaseHeaders(config, token)
  });
  const profiles = await parseResponse(profileResponse);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profileResponse.ok || !profile) {
    throw new HttpError(403, 'La cuenta no tiene un perfil administrativo activo.', 'AUTH_PROFILE_REQUIRED');
  }

  const role = String(profile.role || '').trim().toUpperCase();
  const status = String(profile.status || '').trim().toUpperCase();
  if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(role) || !['ACTIVE', 'ACTIVO'].includes(status)) {
    throw new HttpError(403, 'La cuenta no tiene acceso de propietario global.', 'AUTH_GLOBAL_ADMIN_REQUIRED');
  }

  return { token, user, profile };
}

async function readJsonBody(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body;
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud debe ser un objeto JSON válido.', 'INVALID_JSON_BODY');
  }
}

function routePath(request) {
  const pathname = new URL(request.url).pathname;
  return pathname
    .replace(/^\/api\/global-admin\/?/, '')
    .replace(/\/+$/, '');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function parseMetadata(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function campaignJurisdiction(type) {
  if (['Presidencia', 'Senado', 'Cámara'].includes(type)) return 'NACIONAL';
  if (['Gobernación', 'Asamblea'].includes(type)) return 'DEPARTAMENTAL';
  return 'MUNICIPAL';
}

function mapCampaign(row, totalUsers = 0) {
  const metadata = parseMetadata(row.descripcion);
  const createdAt = row.created_at || new Date().toISOString();
  return {
    id: row.id,
    code: row.code || metadata.code || `CAM-${String(row.id).slice(0, 8).toUpperCase()}`,
    name: row.nombre || row.name || 'Campaña sin nombre',
    candidateName: row.candidato_nombre || row.candidate_name || 'Sin candidato',
    type: row.cargo_postulacion || row.election_type || 'Alcaldía',
    department: row.departamento || row.department || '',
    city: row.municipio || row.city || '',
    status: CAMPAIGN_STATUS_TO_CLIENT[String(row.estado || row.status || '').toUpperCase()]
      || ({ ACTIVE: 'Activa', PAUSED: 'En Pausa', FINALIZED: 'Finalizada', CONFIGURATION: 'En Configuración' })[String(row.status || '').toUpperCase()]
      || 'En Configuración',
    adminManager: metadata.adminManager || row.admin_manager || row.candidato_nombre || row.candidate_name || '',
    totalUsers,
    registeredVoters: 0,
    assignedWitnesses: 0,
    budgetExecutedCop: 0,
    budgetLimitCop: Number(row.presupuesto_total || row.cne_spending_limit || 0),
    createdAt,
    lastActivityAt: row.updated_at || createdAt,
    isDemo: Boolean(row.is_demo || metadata.systemType === 'DEMO'),
    demoExpiresAt: row.demo_expires_at || metadata.demoExpiresAt || null,
    demoDays: Number(metadata.demoDays || 5),
    statisticsAvailable: false
  };
}

function campaignValues(body, currentRow = null, adminUserId = '') {
  const patch = {};
  const currentMetadata = parseMetadata(currentRow?.descripcion);

  if (!currentRow || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'El nombre de la campaña es obligatorio.', 'CAMPAIGN_NAME_REQUIRED');
    patch.nombre = name;
    patch.name = name;
  }

  if (!currentRow || body.candidateName !== undefined) {
    const candidateName = String(body.candidateName || '').trim();
    if (!candidateName) throw new HttpError(400, 'El nombre del candidato es obligatorio.', 'CANDIDATE_NAME_REQUIRED');
    patch.candidato_nombre = candidateName;
    patch.candidate_name = candidateName;
  }

  if (!currentRow || body.type !== undefined) {
    const type = String(body.type || 'Alcaldía');
    if (!ELECTION_TYPES.has(type)) {
      throw new HttpError(400, 'El tipo de elección no es válido.', 'INVALID_ELECTION_TYPE');
    }
    patch.cargo_postulacion = type;
    patch.election_type = type;
    patch.circunscripcion = campaignJurisdiction(type);
  }

  if (!currentRow || body.department !== undefined) patch.departamento = String(body.department || '').trim();
  if (!currentRow || body.city !== undefined) patch.municipio = String(body.city || '').trim();

  if (!currentRow || body.budgetLimitCop !== undefined) {
    const budget = Number(body.budgetLimitCop || 0);
    if (!Number.isFinite(budget) || budget < 0) {
      throw new HttpError(400, 'El tope presupuestal debe ser un número positivo.', 'INVALID_CAMPAIGN_BUDGET');
    }
    patch.presupuesto_total = budget;
    patch.cne_spending_limit = budget;
  }

  const demoDays = Math.min(5, Math.max(1, Number.parseInt(String(body.demoDays || currentMetadata.demoDays || 5), 10) || 5));
  const isDemo = body.isDemo === undefined
    ? currentMetadata.systemType === 'DEMO'
    : Boolean(body.isDemo);
  const shouldRenewDemo = !currentRow || body.isDemo !== undefined || body.demoDays !== undefined;
  const demoExpiresAt = isDemo
    ? shouldRenewDemo || !currentMetadata.demoExpiresAt
      ? new Date(Date.now() + demoDays * 24 * 60 * 60 * 1000).toISOString()
      : currentMetadata.demoExpiresAt
    : null;

  const metadata = {
    ...currentMetadata,
    adminManager: body.adminManager === undefined
      ? currentMetadata.adminManager || currentRow?.candidato_nombre || ''
      : String(body.adminManager || '').trim(),
    demoDays,
    systemType: isDemo ? 'DEMO' : undefined,
    demoExpiresAt: isDemo ? demoExpiresAt : undefined
  };
  patch.admin_manager = metadata.adminManager;
  patch.descripcion = JSON.stringify(metadata);
  patch.updated_at = new Date().toISOString();
  if (!currentRow) {
    patch.created_by = adminUserId || null;
    patch.vote_goal = 0;
  }
  return patch;
}

function mapCustomRole(row) {
  const createdAt = row.created_at || new Date().toISOString();
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    isSystem: Boolean(row.is_system),
    userCount: 0,
    permissions: Array.isArray(row.allowed_modules) ? row.allowed_modules : [],
    createdAt,
    updatedAt: row.updated_at || createdAt
  };
}

async function readCustomRole(config, admin, id) {
  const query = new URLSearchParams({ id: `eq.${id}`, select: '*', limit: '1' });
  const { data } = await supabaseRest(config, admin.token, `custom_roles?${query}`);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND');
  return row;
}

async function listCustomRoles(config, admin) {
  const { data } = await supabaseRest(
    config,
    admin.token,
    'custom_roles?select=*&order=created_at.asc'
  );
  return json({
    success: true,
    roles: (Array.isArray(data) ? data : []).map(mapCustomRole),
    permissionsCatalog: PERMISSIONS_CATALOG
  });
}

async function createCustomRole(context, config, admin) {
  const body = await readJsonBody(context.request);
  const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const name = String(body.name || '').trim();
  if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(code) || !name) {
    throw new HttpError(400, 'Código y nombre del rol son obligatorios.', 'INVALID_ROLE');
  }
  if (PROTECTED_ROLE_CODES.has(code)) {
    throw new HttpError(409, 'Ese código pertenece a un rol protegido del sistema.', 'PROTECTED_ROLE_CODE');
  }
  const { data } = await supabaseRest(config, admin.token, 'custom_roles?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      client_id: null,
      code,
      name,
      description: String(body.description || '').trim(),
      is_active: true,
      is_system: false,
      allowed_modules: Array.isArray(body.permissions) ? body.permissions.map(String) : [],
      updated_at: new Date().toISOString()
    }
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(502, 'Supabase no devolvió el rol creado.', 'ROLE_CREATE_EMPTY');
  scheduleAudit(
    context, config, admin, 'ROL_CREADO', 'ROLES', `Rol ${row.id}`,
    'INFO', `Se creó el rol ${name}.`, { roleId: row.id, roleCode: code }
  );
  return json({ success: true, role: mapCustomRole(row) }, 201);
}

async function updateCustomRole(context, config, admin, id) {
  const current = await readCustomRole(config, admin, id);
  if (current.is_system || PROTECTED_ROLE_CODES.has(String(current.code || '').toUpperCase())) {
    throw new HttpError(400, 'Los roles protegidos del sistema no se pueden modificar.', 'PROTECTED_ROLE');
  }
  const body = await readJsonBody(context.request);
  const patch = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'El nombre del rol es obligatorio.', 'ROLE_NAME_REQUIRED');
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = String(body.description || '').trim();
  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions)) {
      throw new HttpError(400, 'Los permisos del rol no son válidos.', 'INVALID_ROLE_PERMISSIONS');
    }
    patch.allowed_modules = body.permissions.map(String);
  }
  const query = new URLSearchParams({ id: `eq.${id}`, select: '*' });
  const { data } = await supabaseRest(config, admin.token, `custom_roles?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: patch
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND');
  scheduleAudit(
    context, config, admin, 'ROL_ACTUALIZADO', 'ROLES', `Rol ${id}`,
    'INFO', `Se actualizó el rol ${row.name}.`, { roleId: id }
  );
  return json({ success: true, role: mapCustomRole(row) });
}

async function deleteCustomRole(context, config, admin, id) {
  const current = await readCustomRole(config, admin, id);
  if (current.is_system || PROTECTED_ROLE_CODES.has(String(current.code || '').toUpperCase())) {
    throw new HttpError(400, 'Los roles protegidos del sistema no se pueden eliminar.', 'PROTECTED_ROLE');
  }
  const query = new URLSearchParams({ id: `eq.${id}`, select: 'id' });
  const { data } = await supabaseRest(config, admin.token, `custom_roles?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND');
  }
  scheduleAudit(
    context, config, admin, 'ROL_ELIMINADO', 'ROLES', `Rol ${id}`,
    'WARNING', `Se eliminó el rol ${current.name}.`, { roleId: id }
  );
  return json({ success: true, message: 'Rol eliminado correctamente.' });
}

function auditDetails(request, admin, category, severity, status, detail, metadata = {}) {
  return {
    actorName: admin.profile.display_name || admin.profile.email || admin.user.email || 'Administrador Global',
    actorEmail: admin.profile.email || admin.user.email || '',
    actorRole: String(admin.profile.role || 'GLOBAL_ADMIN').toUpperCase(),
    category,
    severity,
    status,
    ipAddress: request.headers.get('cf-connecting-ip') || '',
    userAgent: request.headers.get('user-agent') || '',
    detail,
    metadata
  };
}

async function recordAudit(config, request, admin, action, category, resource, severity, detail, metadata = {}) {
  await supabaseRest(config, admin.token, 'audit_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: {
      user_id: admin.user.id,
      action,
      resource,
      details: auditDetails(request, admin, category, severity, 'ÉXITO', detail, metadata),
      timestamp: new Date().toISOString()
    }
  });
}

function scheduleAudit(context, config, admin, action, category, resource, severity, detail, metadata) {
  const task = recordAudit(config, context.request, admin, action, category, resource, severity, detail, metadata)
    .catch((error) => console.error('Global Admin audit persistence failed', { action, code: error?.code }));
  context.waitUntil(task);
}

async function listCampaigns(config, admin) {
  const { data } = await supabaseRest(
    config,
    admin.token,
    'campaigns?select=*&order=created_at.desc'
  );
  let userCounts = new Map();
  try {
    const profilesResult = await supabaseRest(config, admin.token, 'profiles?select=campaign_id');
    userCounts = (Array.isArray(profilesResult.data) ? profilesResult.data : []).reduce((counts, profile) => {
      const campaignId = String(profile.campaign_id || '');
      if (campaignId) counts.set(campaignId, (counts.get(campaignId) || 0) + 1);
      return counts;
    }, new Map());
  } catch (error) {
    console.warn(JSON.stringify({
      message: 'campaign user totals unavailable',
      code: error?.code || 'UNKNOWN'
    }));
  }
  const campaigns = (Array.isArray(data) ? data : []).map((row) => (
    mapCampaign(row, userCounts.get(String(row.id)) || 0)
  ));
  return json({ success: true, campaigns });
}

async function createCampaign(context, config, admin) {
  const body = await readJsonBody(context.request);
  const payload = {
    ...campaignValues(body, null, admin.user.id),
    estado: 'ACTIVA'
  };
  const { data } = await supabaseRest(config, admin.token, 'campaigns?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: payload
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(502, 'Supabase no devolvió la campaña creada.', 'CAMPAIGN_CREATE_EMPTY');
  const campaign = mapCampaign(row);
  scheduleAudit(
    context, config, admin, 'CAMPAÑA_CREADA', 'CAMPAIGNS', `Campaña ${campaign.id}`,
    'INFO', `Se creó la campaña ${campaign.name}.`, { campaignId: campaign.id }
  );
  return json({ success: true, campaign }, 201);
}

async function readCampaignRow(config, admin, id) {
  const query = new URLSearchParams({ id: `eq.${id}`, select: '*', limit: '1' });
  const { data } = await supabaseRest(config, admin.token, `campaigns?${query}`);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(404, 'Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND');
  return row;
}

async function updateCampaign(context, config, admin, id) {
  const current = await readCampaignRow(config, admin, id);
  const body = await readJsonBody(context.request);
  const query = new URLSearchParams({ id: `eq.${id}`, select: '*' });
  const { data } = await supabaseRest(config, admin.token, `campaigns?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: campaignValues(body, current, admin.user.id)
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(404, 'Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND');
  const campaign = mapCampaign(row);
  scheduleAudit(
    context, config, admin, 'CAMPAÑA_ACTUALIZADA', 'CAMPAIGNS', `Campaña ${id}`,
    'INFO', `Se actualizó la campaña ${campaign.name}.`, { campaignId: id }
  );
  return json({ success: true, campaign });
}

async function updateCampaignStatus(context, config, admin, id) {
  const body = await readJsonBody(context.request);
  const databaseStatus = CAMPAIGN_STATUS_TO_DATABASE[body.status];
  if (!databaseStatus) {
    throw new HttpError(400, 'El estado de campaña no es válido.', 'INVALID_CAMPAIGN_STATUS');
  }
  const query = new URLSearchParams({ id: `eq.${id}`, select: '*' });
  const { data } = await supabaseRest(config, admin.token, `campaigns?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { estado: databaseStatus, updated_at: new Date().toISOString() }
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(404, 'Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND');
  const campaign = mapCampaign(row);
  scheduleAudit(
    context, config, admin, 'CAMBIO_ESTADO_CAMPAÑA', 'CAMPAIGNS', `Campaña ${id}`,
    'INFO', `El estado de ${campaign.name} cambió a ${campaign.status}.`, { campaignId: id, status: campaign.status }
  );
  return json({ success: true, campaign });
}

async function linkedCampaignUsers(config, admin, campaignId) {
  const query = new URLSearchParams({ campaign_id: `eq.${campaignId}`, select: 'id' });
  const { data } = await supabaseRest(config, admin.token, `profiles?${query}`);
  return (Array.isArray(data) ? data : []).map((profile) => profile.id).filter(isUuid);
}

async function deleteCampaign(context, config, admin, id) {
  if (!config.serverKey) {
    throw new HttpError(
      503,
      'La eliminación completa requiere configurar el secreto privado de Supabase en Cloudflare.',
      'SUPABASE_SERVER_KEY_REQUIRED'
    );
  }
  const current = await readCampaignRow(config, admin, id);
  const linkedUsers = await linkedCampaignUsers(config, admin, id);
  if (linkedUsers.length > 0) {
    throw new HttpError(
      409,
      'La campaña tiene usuarios vinculados. Debes retirarlos antes de eliminar la campaña para evitar cuentas huérfanas.',
      'CAMPAIGN_HAS_LINKED_USERS'
    );
  }
  const query = new URLSearchParams({ id: `eq.${id}`, select: 'id' });
  const { data } = await supabaseRest(config, admin.token, `campaigns?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new HttpError(404, 'Campaña no encontrada.', 'CAMPAIGN_NOT_FOUND');
  }
  scheduleAudit(
    context, config, admin, 'CAMPAÑA_ELIMINADA', 'CAMPAIGNS', `Campaña ${id}`,
    'WARNING', `Se eliminó la campaña ${mapCampaign(current).name}.`,
    { campaignId: id, deletedUsers: 0 }
  );
  return json({ success: true, deletedUsers: 0 });
}

async function probeSupabase(config) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${config.url}/auth/v1/health`, {
      headers: { apikey: config.publicKey, accept: 'application/json' },
      signal: controller.signal
    });
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    return {
      latencyMs,
      status: response.ok ? 'ONLINE' : response.status >= 500 ? 'OFFLINE' : 'DEGRADED',
      httpStatus: response.status,
      pingTime: new Date().toISOString()
    };
  } catch {
    return {
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      status: 'OFFLINE',
      httpStatus: 0,
      pingTime: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

function apiItem(config, probe) {
  return {
    id: 'supabase',
    name: 'Supabase Auth / PostgreSQL',
    provider: 'Supabase PostgreSQL',
    endpoint: `${config.url}/rest/v1/`,
    status: probe.status,
    responseTimeMs: probe.latencyMs,
    requests24h: 0,
    rateLimitPerMin: 0,
    errorCount24h: probe.status === 'ONLINE' ? 0 : 1,
    maskedApiKey: config.publicKey ? 'Configurada en Cloudflare' : 'No configurada',
    lastPingAt: probe.pingTime,
    sslValid: config.url.startsWith('https://'),
    quotaUsedPct: 0,
    telemetryAvailable: {
      requests24h: false,
      rateLimitPerMin: false,
      quotaUsedPct: false
    }
  };
}

async function listApis(config) {
  const probe = await probeSupabase(config);
  return json({ success: true, apis: [apiItem(config, probe)] });
}

async function testApi(context, config) {
  const body = await readJsonBody(context.request);
  if (!['supabase', 'API-SUPABASE', 'API-002'].includes(String(body.apiId || ''))) {
    throw new HttpError(404, 'La integración solicitada no está configurada.', 'API_NOT_FOUND');
  }
  const probe = await probeSupabase(config);
  return json({
    success: true,
    latencyMs: probe.latencyMs,
    status: probe.status,
    pingTime: probe.pingTime
  });
}

function moduleCategory(code) {
  if (code === 'ADMINISTRATIVE') return 'Administración';
  if (code === 'STRATEGY' || code === 'COMMUNICATIONS') return 'Estrategia';
  if (code === 'TERRITORY' || code === 'CRM') return 'Territorio';
  if (code === 'ELECTORAL') return 'Día E';
  return 'Auditoría';
}

async function listModules(config, admin) {
  const [modulesResult, functionsResult] = await Promise.all([
    supabaseRest(config, admin.token, 'modules?select=id,code,name,description,created_at&order=created_at.asc'),
    supabaseRest(config, admin.token, 'module_functions?select=id,module_code,code,name,description&order=module_code.asc,code.asc')
  ]);
  const functions = Array.isArray(functionsResult.data) ? functionsResult.data : [];
  const modules = (Array.isArray(modulesResult.data) ? modulesResult.data : []).map((moduleItem) => ({
    id: moduleItem.id,
    code: String(moduleItem.code || '').toLowerCase(),
    sourceCode: moduleItem.code,
    name: moduleItem.name,
    category: moduleCategory(moduleItem.code),
    description: moduleItem.description || '',
    isEnabled: true,
    maintenanceMode: false,
    activeUsers24h: 0,
    apiRequests24h: 0,
    errorRatePct: 0,
    dependencies: [],
    features: functions
      .filter((feature) => feature.module_code === moduleItem.code)
      .map((feature) => ({ id: feature.id, code: feature.code, name: feature.name, enabled: true })),
    updatedAt: moduleItem.created_at || new Date(0).toISOString(),
    controlStatePersisted: false,
    telemetryAvailable: false
  }));
  return json({
    success: true,
    modules,
    warning: 'El catálogo proviene de Supabase; los interruptores y métricas no tienen todavía una tabla persistente.'
  });
}

function inferAuditCategory(action) {
  const value = String(action || '').toUpperCase();
  if (value.includes('AUTH') || value.includes('SESION') || value.includes('LOGIN')) return 'AUTH';
  if (value.includes('USUARIO')) return 'USERS';
  if (value.includes('ROL')) return 'ROLES';
  if (value.includes('CAMPA')) return 'CAMPAIGNS';
  if (value.includes('MODULO') || value.includes('FEATURE')) return 'MODULES';
  if (value.includes('API')) return 'APIS';
  if (value.includes('IP') || value.includes('SECURITY') || value.includes('SEGUR')) return 'SECURITY';
  return 'CONFIG';
}

function mapAuditLog(row) {
  const details = parseMetadata(row.details ?? row.metadata);
  const timestamp = row.timestamp || row.created_at || new Date(0).toISOString();
  return {
    id: String(row.id),
    timestamp,
    actorId: row.user_id || row.actor_id || '',
    actorName: details.actorName || 'Usuario de Supabase',
    actorEmail: details.actorEmail || '',
    actorRole: details.actorRole || '',
    action: row.action || 'EVENTO',
    category: details.category || inferAuditCategory(row.action),
    resource: row.resource || row.entity || row.entity_id || '',
    severity: details.severity || 'INFO',
    status: details.status || 'ÉXITO',
    ipAddress: details.ipAddress || '',
    userAgent: details.userAgent || '',
    details: details.detail || (typeof row.details === 'string' ? row.details : row.action || ''),
    metadata: details.metadata || (row.metadata && typeof row.metadata === 'object' ? row.metadata : {})
  };
}

async function readAuditRows(config, admin) {
  try {
    const { data } = await supabaseRest(config, admin.token, 'audit_logs?select=*&order=timestamp.desc&limit=500');
    return Array.isArray(data) ? data : [];
  } catch (firstError) {
    try {
      const { data } = await supabaseRest(config, admin.token, 'audit_logs?select=*&order=created_at.desc&limit=500');
      return Array.isArray(data) ? data : [];
    } catch {
      throw firstError;
    }
  }
}

async function listAuditLogs(request, config, admin) {
  const url = new URL(request.url);
  const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
  const category = String(url.searchParams.get('category') || 'ALL').toUpperCase();
  const severity = String(url.searchParams.get('severity') || 'ALL').toUpperCase();
  const status = String(url.searchParams.get('status') || 'ALL').toUpperCase();
  const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100));
  let logs = (await readAuditRows(config, admin)).map(mapAuditLog);

  if (category !== 'ALL') logs = logs.filter((log) => log.category === category);
  if (severity !== 'ALL') logs = logs.filter((log) => log.severity === severity);
  if (status !== 'ALL') logs = logs.filter((log) => String(log.status).toUpperCase() === status);
  if (search) {
    logs = logs.filter((log) => [
      log.actorName, log.actorEmail, log.action, log.resource, log.details, log.ipAddress
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }

  return json({ success: true, total: logs.length, logs: logs.slice(0, limit) });
}

function securityEventFromAudit(log) {
  const action = String(log.action || '').toUpperCase();
  let type = 'UNAUTHORIZED_ACCESS_ATTEMPT';
  if (action.includes('FAILED') || action.includes('FALL')) type = 'FAILED_LOGIN';
  else if (action.includes('BRUTE')) type = 'BRUTE_FORCE_BLOCKED';
  else if (action.includes('REVO')) type = 'SESSION_REVOKED';
  else if (action.includes('PRIVILE')) type = 'PRIVILEGE_ESCALATION_ATTEMPT';
  else if (action.includes('IP')) type = 'SUSPICIOUS_IP';
  return {
    id: log.id,
    timestamp: log.timestamp,
    type,
    severity: log.severity === 'CRITICAL' ? 'CRITICAL' : log.severity === 'WARNING' ? 'MEDIUM' : log.severity === 'SECURITY' ? 'HIGH' : 'LOW',
    sourceIp: log.ipAddress,
    targetUser: log.actorEmail || undefined,
    description: log.details,
    resolved: Boolean(log.metadata?.resolved),
    resolutionNotes: log.metadata?.resolutionNotes
  };
}

async function listSecurityEvents(config, admin) {
  const logs = (await readAuditRows(config, admin))
    .map(mapAuditLog)
    .filter((log) => log.category === 'SECURITY' || log.severity === 'SECURITY' || log.severity === 'CRITICAL');
  return json({
    success: true,
    events: logs.map(securityEventFromAudit),
    blockedIps: [],
    activeSessions: [],
    capabilities: {
      eventsSource: 'audit_logs',
      blockedIpsPersisted: false,
      activeSessionsAvailable: false
    },
    warning: 'Supabase Auth usa sesiones JWT; este esquema no contiene tablas de IPs bloqueadas ni sesiones administrativas activas.'
  });
}

async function readLandingCommercial(config) {
  try {
    const { data } = await supabaseRest(
      config,
      '',
      'landing_commercial_config?id=eq.main&select=plans,contact&limit=1'
    );
    const row = Array.isArray(data) ? data[0] : null;
    return json({ success: true, config: row || { plans: [], contact: {} }, persisted: Boolean(row) });
  } catch {
    return json({ success: true, config: { plans: [], contact: {} }, persisted: false });
  }
}

async function saveLandingCommercial(context, config, admin) {
  const body = await readJsonBody(context.request);
  if (!Array.isArray(body.plans) || !body.contact || typeof body.contact !== 'object' || Array.isArray(body.contact)) {
    throw new HttpError(400, 'La configuración comercial debe contener planes y datos de contacto válidos.', 'INVALID_COMMERCIAL_CONFIG');
  }
  const query = new URLSearchParams({ on_conflict: 'id', select: 'plans,contact' });
  const { data } = await supabaseRest(config, admin.token, `landing_commercial_config?${query}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: {
      id: 'main',
      plans: body.plans,
      contact: body.contact,
      updated_at: new Date().toISOString(),
      updated_by: admin.user.id
    }
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new HttpError(502, 'Supabase no devolvió la configuración guardada.', 'COMMERCIAL_CONFIG_EMPTY');
  scheduleAudit(
    context, config, admin, 'CONFIGURACION_COMERCIAL_ACTUALIZADA', 'CONFIG',
    'Landing comercial', 'INFO', 'Se actualizó la configuración comercial de la landing.'
  );
  return json({ success: true, config: row });
}

async function systemHealth(config) {
  const probe = await probeSupabase(config);
  const healthy = probe.status === 'ONLINE';
  return json({
    success: true,
    telemetry: {
      status: healthy ? 'HEALTHY' : probe.status === 'DEGRADED' ? 'DEGRADED' : 'CRITICAL',
      uptimeSeconds: 0,
      uptimeFormatted: 'No expuesto por Cloudflare Workers',
      nodeVersion: 'Cloudflare Workers Web Runtime',
      environment: 'Cloudflare Pages',
      platform: 'Cloudflare Workers + Supabase PostgreSQL',
      memoryUsageMb: { rss: 0, heapTotal: 0, heapUsed: 0 },
      cpuLoadPct: 0,
      dbLatencyMs: probe.latencyMs,
      dbConnected: healthy,
      activeSessionsCount: 0,
      version: 'pages-supabase-v1',
      lastRestartAt: probe.pingTime,
      unavailableMetrics: ['workerUptime', 'workerMemory', 'workerCpu', 'activeJwtSessions'],
      checkedAt: probe.pingTime
    }
  });
}

function methodNotAllowed(allowed) {
  return json(
    { success: false, error: 'Método no permitido para esta ruta.', code: 'METHOD_NOT_ALLOWED' },
    405,
    { Allow: allowed.join(', ') }
  );
}

function persistenceUnavailable(capability) {
  return json({
    success: false,
    code: 'PERSISTENCE_NOT_CONFIGURED',
    error: `${capability} no está disponible porque el esquema actual de Supabase no contiene una tabla persistente para esta función.`
  }, 501);
}

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const path = routePath(request);
  const segments = path.split('/').filter(Boolean);
  const resource = segments[0] || '';
  const config = configuration(env);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
        'cache-control': 'no-store'
      }
    });
  }

  try {
    if (path === 'auth/status' && method === 'GET') {
      return json({
        initialized: Boolean(config.url && config.publicKey),
        maintenanceMode: false,
        platformName: 'Campaña Ganadora SaaS - Master Core',
        serverTime: new Date().toISOString()
      });
    }

    requireConfiguration(config);

    if (path === 'landing-commercial/public') {
      return method === 'GET' ? readLandingCommercial(config) : methodNotAllowed(['GET']);
    }

    const admin = await requireGlobalAdmin(request, config);

    if (path === 'campaigns') {
      if (method === 'GET') return listCampaigns(config, admin);
      if (method === 'POST') return createCampaign(context, config, admin);
      return methodNotAllowed(['GET', 'POST']);
    }

    if (resource === 'campaigns' && segments.length >= 2) {
      const id = segments[1];
      if (!isUuid(id)) throw new HttpError(400, 'El identificador de campaña no es válido.', 'INVALID_CAMPAIGN_ID');
      if (segments.length === 2 && method === 'PUT') return updateCampaign(context, config, admin, id);
      if (segments.length === 2 && method === 'DELETE') return deleteCampaign(context, config, admin, id);
      if (segments.length === 3 && segments[2] === 'status' && method === 'PATCH') {
        return updateCampaignStatus(context, config, admin, id);
      }
      return methodNotAllowed(segments[2] === 'status' ? ['PATCH'] : ['PUT', 'DELETE']);
    }

    if (path === 'permissions') {
      return method === 'GET'
        ? json({ success: true, permissions: PERMISSIONS_CATALOG })
        : methodNotAllowed(['GET']);
    }

    if (path === 'roles') {
      if (method === 'GET') return listCustomRoles(config, admin);
      if (method === 'POST') return createCustomRole(context, config, admin);
      return methodNotAllowed(['GET', 'POST']);
    }
    if (resource === 'roles' && segments.length === 2) {
      const id = segments[1];
      if (!isUuid(id)) throw new HttpError(400, 'El identificador del rol no es válido.', 'INVALID_ROLE_ID');
      if (method === 'PUT') return updateCustomRole(context, config, admin, id);
      if (method === 'DELETE') return deleteCustomRole(context, config, admin, id);
      return methodNotAllowed(['PUT', 'DELETE']);
    }

    if (path === 'modules') {
      return method === 'GET' ? listModules(config, admin) : methodNotAllowed(['GET']);
    }
    if (resource === 'modules') return persistenceUnavailable('El control de módulos y funcionalidades');

    if (path === 'apis') {
      return method === 'GET' ? listApis(config) : methodNotAllowed(['GET']);
    }
    if (path === 'apis/test-ping') {
      return method === 'POST' ? testApi(context, config) : methodNotAllowed(['POST']);
    }

    if (path === 'audit-logs') {
      return method === 'GET'
        ? listAuditLogs(request, config, admin)
        : methodNotAllowed(['GET']);
    }

    if (path === 'security/events') {
      return method === 'GET'
        ? listSecurityEvents(config, admin)
        : methodNotAllowed(['GET']);
    }
    if (resource === 'security') return persistenceUnavailable('La mutación de controles de seguridad');

    if (path === 'config') {
      if (method === 'GET') {
        return json({
          success: true,
          config: DEFAULT_SYSTEM_CONFIG,
          persisted: false,
          warning: 'Se muestran valores operativos seguros; este esquema no contiene una tabla de configuración global.'
        });
      }
      if (method === 'PUT') return persistenceUnavailable('La configuración global');
      return methodNotAllowed(['GET', 'PUT']);
    }

    if (path === 'landing-commercial') {
      return method === 'PUT'
        ? saveLandingCommercial(context, config, admin)
        : methodNotAllowed(['PUT']);
    }

    if (path === 'system/health') {
      return method === 'GET' ? systemHealth(config) : methodNotAllowed(['GET']);
    }

    if (KNOWN_RESOURCES.has(resource)) {
      return json({
        success: false,
        code: 'NOT_IMPLEMENTED_ON_PAGES',
        error: 'Esta operación administrativa todavía no está disponible en Cloudflare Pages.'
      }, 501);
    }

    return json({ success: false, error: 'Ruta administrativa no encontrada.', code: 'ROUTE_NOT_FOUND' }, 404);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
    const message = error instanceof HttpError
      ? error.message
      : 'No fue posible completar la operación administrativa.';
    console.error('Global Admin Pages Function failed', { requestId, path, method, status, code });
    return json({ success: false, error: message, code, requestId }, status);
  }
}
