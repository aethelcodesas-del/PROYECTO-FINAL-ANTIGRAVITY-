const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

const GLOBAL_OWNER_ROLES = ['SUPERADMIN', 'GLOBAL_ADMIN'];
const MANAGER_ROLES = [...GLOBAL_OWNER_ROLES, 'ADMIN_CLIENTE', 'ADMINISTRADOR'];
const ACTIVE_STATUSES = ['ACTIVE', 'ACTIVO'];
const E14_OCR_ROLES = [
  ...MANAGER_ROLES,
  'DIRECTOR', 'COORDINADOR', 'USUARIO', 'USUARIO_LIMITADO', 'TESTIGO'
];

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function clean(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n]/g, '');
}

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : '';
}

function pendingDeletionMessage(campaignId, userIds) {
  return `campaign-delete:v1:${campaignId}:${[...userIds].sort().join(',')}`;
}

async function signPendingDeletion(configuration, campaignId, userIds) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(configuration.serverKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(pendingDeletionMessage(campaignId, userIds))
  ));
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function verifyPendingDeletion(configuration, campaignId, userIds, token) {
  if (!token) return false;
  const expected = await signPendingDeletion(configuration, campaignId, userIds);
  if (expected.length !== token.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return difference === 0;
}

const DEFAULT_SUPABASE_URL = 'https://cjvztlvxdsuiluybvtpl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjU3MDAsImV4cCI6MjEwNDA0MTcwMH0.E-aIfV1P8XUDRW-lGC7lC6x6eOpwIdJeCpFDnxOI-uY';

function getConfiguration(env) {
  const url = clean(env?.VITE_SUPABASE_URL || env?.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
  const publicKey = clean(
    env?.VITE_SUPABASE_ANON_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
  const serverKey = clean(env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY || '');

  return { url, publicKey, serverKey };
}

function bearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

async function parseRequestBody(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { error: json({ error: 'La solicitud enviada no contiene un JSON válido.' }, 400) };
  }
}

function errorMessage(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback;
  return String(
    payload.message ||
    payload.msg ||
    payload.error_description ||
    payload.error ||
    payload.details ||
    fallback
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: 'Supabase devolvió una respuesta no válida.' };
    }
  }
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

function exactResultCount(result) {
  const contentRange = result?.headers?.get?.('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function serviceHeaders(configuration, withBody = false, prefer = '') {
  const headers = {
    apikey: configuration.serverKey,
    accept: 'application/json'
  };
  // Legacy service_role keys are JWTs. Modern sb_secret_* keys are opaque
  // and must never be presented as bearer JWTs.
  if (/^eyJ[^.]*\.[^.]+\.[^.]+$/.test(configuration.serverKey)) {
    headers.authorization = `Bearer ${configuration.serverKey}`;
  }
  if (withBody) headers['content-type'] = 'application/json';
  if (prefer) headers.prefer = prefer;
  return headers;
}

async function readAuthenticatedUser(configuration, token) {
  const result = await fetchJson(`${configuration.url}/auth/v1/user`, {
    headers: {
      apikey: configuration.publicKey || configuration.serverKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });
  if (!result.ok || !result.data?.id) return null;
  return result.data;
}

async function restRequest(configuration, table, options = {}) {
  const url = new URL(`${configuration.url}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const method = options.method || 'GET';
  const withBody = options.body !== undefined;
  const headers = options.token
    ? {
        apikey: configuration.publicKey,
        authorization: `Bearer ${options.token}`,
        accept: 'application/json',
        ...(withBody ? { 'content-type': 'application/json' } : {}),
        ...(options.prefer ? { prefer: options.prefer } : {})
      }
    : serviceHeaders(configuration, withBody, options.prefer || '');

  return fetchJson(url, {
    method,
    headers,
    body: withBody ? JSON.stringify(options.body) : undefined
  });
}

async function readProfile(configuration, userId, select = 'id,role,status,client_id,campaign_id,allowed_modules', token = '') {
  const result = await restRequest(configuration, 'profiles', {
    query: { id: `eq.${userId}`, select, limit: 1 },
    token
  });
  if (!result.ok) return { error: result };
  const rows = Array.isArray(result.data) ? result.data : [];
  return { profile: rows[0] || null };
}

async function verifyRequester(request, configuration, allowedRoles) {
  const token = bearerToken(request);
  if (!token) {
    return { error: json({ error: 'Sesión administrativa requerida.' }, 401) };
  }

  const user = await readAuthenticatedUser(configuration, token);
  if (!user) {
    return { error: json({ error: 'La sesión administrativa expiró. Inicia sesión nuevamente.' }, 401) };
  }

  const profileResult = await readProfile(configuration, user.id, undefined, token);
  if (profileResult.error) {
    return { error: json({ error: 'No fue posible validar el perfil administrativo.' }, 502) };
  }

  const profile = profileResult.profile;
  const role = String(profile?.role || '').trim().toUpperCase();
  const status = String(profile?.status || '').trim().toUpperCase();
  if (!profile || !allowedRoles.includes(role) || !ACTIVE_STATUSES.includes(status)) {
    return { error: json({ error: 'Tu cuenta no tiene permisos para realizar esta acción.' }, 403) };
  }

  return { token, user, profile, role };
}

function authAdminUrl(configuration, userId = '') {
  const suffix = userId ? `/${encodeURIComponent(userId)}` : '';
  return `${configuration.url}/auth/v1/admin/users${suffix}`;
}

async function createAuthUser(configuration, attributes) {
  if (!configuration.serverKey) {
    return { ok: false, status: 503, data: { message: 'SUPABASE_SECRET_KEY no está configurada en las variables de entorno de Cloudflare Pages.' } };
  }
  return fetchJson(authAdminUrl(configuration), {
    method: 'POST',
    headers: serviceHeaders(configuration, true),
    body: JSON.stringify(attributes)
  });
}

async function updateAuthUser(configuration, userId, attributes) {
  if (!configuration.serverKey) {
    return { ok: false, status: 503, data: { message: 'SUPABASE_SECRET_KEY no está configurada en las variables de entorno de Cloudflare Pages.' } };
  }
  return fetchJson(authAdminUrl(configuration, userId), {
    method: 'PUT',
    headers: serviceHeaders(configuration, true),
    body: JSON.stringify(attributes)
  });
}

async function deleteAuthUser(configuration, userId) {
  if (!configuration.serverKey) {
    return { ok: false, status: 503, data: { message: 'SUPABASE_SECRET_KEY no está configurada en las variables de entorno de Cloudflare Pages.' } };
  }
  return fetchJson(authAdminUrl(configuration, userId), {
    method: 'DELETE',
    headers: serviceHeaders(configuration)
  });
}

function authUserFrom(payload) {
  return payload?.user || payload?.data?.user || (payload?.id ? payload : null);
}

async function upsertProfile(configuration, profile, token = '') {
  return restRequest(configuration, 'profiles', {
    method: 'POST',
    query: { on_conflict: 'id' },
    body: profile,
    prefer: 'resolution=merge-duplicates,return=minimal',
    token
  });
}

async function createCampaignUser(request, configuration) {
  const requester = await verifyRequester(request, configuration, GLOBAL_OWNER_ROLES);
  if (requester.error) return requester.error;

  const parsed = await parseRequestBody(request);
  if (parsed.error) return parsed.error;
  const email = String(parsed.body?.email || '').trim().toLowerCase();
  const password = String(parsed.body?.password || '');
  const displayName = String(parsed.body?.displayName || '').trim();
  const campaignId = String(parsed.body?.campaignId || '').trim();
  if (!email || !password || !displayName || !campaignId) {
    return json({ error: 'Correo, contraseña, responsable y campaña son obligatorios.' }, 400);
  }
  if (password.length < 10) {
    return json({ error: 'La contraseña debe tener al menos 10 caracteres.' }, 400);
  }

  const campaignResult = await restRequest(configuration, 'campaigns', {
    query: { id: `eq.${campaignId}`, select: 'id,client_id', limit: 1 },
    token: requester.token
  });
  const campaign = Array.isArray(campaignResult.data) ? campaignResult.data[0] : null;
  if (!campaignResult.ok || !campaign) {
    return json({ error: 'La campaña indicada no existe o no está disponible.' }, 404);
  }

  const createResult = await createAuthUser(configuration, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      campaign_id: campaign.id,
      client_id: campaign.client_id || null
    }
  });
  const createdUser = authUserFrom(createResult.data);
  if (!createResult.ok || !createdUser) {
    return json({ error: errorMessage(createResult.data, 'No fue posible crear el usuario.') }, 400);
  }

  const profileResult = await upsertProfile(configuration, {
    id: createdUser.id,
    email,
    display_name: displayName,
    role: 'ADMIN_CLIENTE',
    status: 'ACTIVE',
    client_id: campaign.client_id || null,
    campaign_id: campaign.id,
    allowed_modules: ['ADMINISTRATIVE', 'TERRITORY', 'STRATEGY', 'CRM', 'DAY_D'],
    updated_at: new Date().toISOString()
  }, requester.token);

  if (!profileResult.ok) {
    await deleteAuthUser(configuration, createdUser.id).catch(() => undefined);
    return json({
      error: `No se pudo vincular el perfil: ${errorMessage(profileResult.data, 'Error desconocido.')}`
    }, 400);
  }

  return json({
    success: true,
    user: { id: createdUser.id, email: createdUser.email || email, campaignId: campaign.id }
  }, 201);
}

async function listAuthUserByEmail(configuration, email) {
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(authAdminUrl(configuration));
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    const result = await fetchJson(url, { headers: serviceHeaders(configuration) });
    if (!result.ok) return { error: result };
    const users = Array.isArray(result.data?.users) ? result.data.users : [];
    const user = users.find((candidate) => String(candidate.email || '').toLowerCase() === email);
    if (user) return { user };
    if (users.length < 100) break;
  }
  return { user: null };
}

async function resolveCampaignScope(configuration, profile) {
  let clientId = profile.client_id || null;
  let campaignId = profile.campaign_id || null;
  if (!campaignId && clientId) {
    const legacyResult = await restRequest(configuration, 'campaigns', {
      query: { id: `eq.${clientId}`, select: 'id,client_id', limit: 1 }
    });
    if (legacyResult.ok && Array.isArray(legacyResult.data) && legacyResult.data[0]) {
      campaignId = legacyResult.data[0].id;
      clientId = legacyResult.data[0].client_id || null;
    } else {
      const campaignsResult = await restRequest(configuration, 'campaigns', {
        query: { client_id: `eq.${clientId}`, select: 'id', limit: 2 }
      });
      if (campaignsResult.ok && Array.isArray(campaignsResult.data) && campaignsResult.data.length === 1) {
        campaignId = campaignsResult.data[0].id;
      }
    }
  }
  return { clientId, campaignId };
}

async function deleteProfile(configuration, userId) {
  return restRequest(configuration, 'profiles', {
    method: 'DELETE',
    query: { id: `eq.${userId}` },
    prefer: 'return=minimal'
  });
}

async function createManagedUser(request, configuration) {
  const requester = await verifyRequester(request, configuration, MANAGER_ROLES);
  if (requester.error) return requester.error;

  const parsed = await parseRequestBody(request);
  if (parsed.error) return parsed.error;
  const email = String(parsed.body?.email || '').trim().toLowerCase();
  const password = String(parsed.body?.password || '');
  const displayName = String(parsed.body?.displayName || '').trim();
  if (!email || !displayName || !password) {
    return json({ error: 'Nombre, correo y contraseña son obligatorios.' }, 400);
  }
  if (password.length < 10) {
    return json({ error: 'La contraseña debe tener al menos 10 caracteres.' }, 400);
  }

  const requestedRole = String(parsed.body?.role || '').trim().toUpperCase();
  const role = ['ADMIN_CLIENTE', 'DIRECTOR', 'COORDINADOR'].includes(requestedRole)
    ? requestedRole
    : 'ADMIN_CLIENTE';
  const allowedModules = Array.isArray(parsed.body?.allowedModules)
    ? [...new Set(parsed.body.allowedModules.map((value) => String(value).trim().toUpperCase()).filter(Boolean))]
    : [];
  const permissions = Array.isArray(parsed.body?.permissions) ? parsed.body.permissions : [];
  if (permissions.some((permission) => (
    !String(permission?.moduleCode || '').trim() || !String(permission?.functionCode || '').trim()
  ))) {
    return json({ error: 'La selección de permisos contiene valores incompletos.' }, 400);
  }
  const requesterIsGlobalOwner = GLOBAL_OWNER_ROLES.includes(requester.role);
  const requesterModules = new Set(
    (Array.isArray(requester.profile.allowed_modules) ? requester.profile.allowed_modules : [])
      .map((value) => String(value).trim().toUpperCase())
  );
  if (!requesterIsGlobalOwner) {
    const delegatedModules = new Set([
      ...allowedModules,
      ...permissions.map((permission) => String(permission?.moduleCode || '').trim().toUpperCase()).filter(Boolean)
    ]);
    const unauthorizedModule = [...delegatedModules].find((moduleCode) => !requesterModules.has(moduleCode));
    if (unauthorizedModule) {
      return json({
        error: 'No puedes delegar módulos que no están habilitados en tu propia cuenta.'
      }, 403);
    }
  }
  const { clientId, campaignId } = await resolveCampaignScope(configuration, requester.profile);
  const metadata = {
    display_name: displayName,
    role,
    client_id: clientId,
    campaign_id: campaignId
  };

  let targetUser = null;
  let createdNow = false;
  const createResult = await createAuthUser(configuration, {
    email,
    password,
    email_confirm: true,
    user_metadata: metadata
  });
  const newlyCreated = authUserFrom(createResult.data);
  if (createResult.ok && newlyCreated) {
    targetUser = newlyCreated;
    createdNow = true;
  } else if (errorMessage(createResult.data, '').toLowerCase().includes('already')) {
    if (!requesterIsGlobalOwner) {
      return json({
        error: 'El correo ya existe. Solo el propietario global puede reparar una cuenta de Auth sin perfil.'
      }, 409);
    }
    const existingResult = await listAuthUserByEmail(configuration, email);
    if (existingResult.error) {
      return json({ error: errorMessage(existingResult.error.data, 'No fue posible consultar la cuenta existente.') }, 400);
    }
    targetUser = existingResult.user;
    if (!targetUser) {
      return json({ error: 'El correo ya existe, pero no fue posible recuperar la cuenta.' }, 409);
    }

    const profileResult = await readProfile(configuration, targetUser.id, 'id');
    if (profileResult.error) {
      return json({ error: 'No fue posible validar la cuenta existente.' }, 400);
    }
    if (profileResult.profile) {
      return json({ error: 'Ya existe un usuario registrado con este correo.' }, 409);
    }

    const repairResult = await updateAuthUser(configuration, targetUser.id, {
      password,
      email_confirm: true,
      user_metadata: metadata
    });
    if (!repairResult.ok) {
      return json({ error: errorMessage(repairResult.data, 'No fue posible reparar la cuenta existente.') }, 400);
    }
  } else {
    return json({ error: errorMessage(createResult.data, 'No fue posible crear el acceso.') }, 400);
  }

  const profileResult = await upsertProfile(configuration, {
    id: targetUser.id,
    client_id: clientId,
    campaign_id: campaignId,
    email,
    display_name: displayName,
    role,
    status: 'ACTIVE',
    allowed_modules: allowedModules,
    updated_at: new Date().toISOString()
  });
  if (!profileResult.ok) {
    if (createdNow) await deleteAuthUser(configuration, targetUser.id).catch(() => undefined);
    return json({
      error: `No se pudo crear el perfil: ${errorMessage(profileResult.data, 'Error desconocido.')}`
    }, 400);
  }

  if (permissions.length) {
    const permissionRows = permissions.map((permission) => ({
      user_id: targetUser.id,
      module_code: String(permission?.moduleCode || ''),
      function_code: String(permission?.functionCode || ''),
      actions: ['ACCESS']
    }));
    const permissionsResult = await restRequest(configuration, 'user_permissions', {
      method: 'POST',
      body: permissionRows,
      prefer: 'return=minimal'
    });
    if (!permissionsResult.ok) {
      await deleteProfile(configuration, targetUser.id).catch(() => undefined);
      if (createdNow) await deleteAuthUser(configuration, targetUser.id).catch(() => undefined);
      return json({
        error: `No se pudieron asignar los permisos: ${errorMessage(permissionsResult.data, 'Error desconocido.')}`
      }, 400);
    }
  }

  return json({
    success: true,
    repaired: !createdNow,
    user: { id: targetUser.id, email, clientId, campaignId }
  }, createdNow ? 201 : 200);
}

function randomTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `Cg#${encoded}9a`;
}

async function resetCampaignUserPassword(request, configuration, userId) {
  const requester = await verifyRequester(request, configuration, GLOBAL_OWNER_ROLES);
  if (requester.error) return requester.error;
  if (!userId) return json({ error: 'El usuario es obligatorio.' }, 400);

  const temporaryPassword = randomTemporaryPassword();
  const updateResult = await updateAuthUser(configuration, userId, {
    password: temporaryPassword,
    user_metadata: { password_reset_by_global_admin_at: new Date().toISOString() }
  });
  if (!updateResult.ok || !authUserFrom(updateResult.data)) {
    return json({ error: errorMessage(updateResult.data, 'No fue posible actualizar la contraseña.') }, 400);
  }

  return json({
    success: true,
    message: 'Contraseña temporal creada. Se mostrará una sola vez.',
    temporaryPassword
  });
}

async function readAuthUser(configuration, userId) {
  const result = await fetchJson(authAdminUrl(configuration, userId), {
    headers: serviceHeaders(configuration)
  });
  if (result.status === 404) return { user: null };
  if (!result.ok) return { error: result };
  return { user: authUserFrom(result.data) };
}

async function listPendingAuthUsers(configuration, campaignId) {
  const users = [];
  const pageSize = 100;
  const maximumPages = 5;
  for (let page = 1; page <= maximumPages; page += 1) {
    const url = new URL(authAdminUrl(configuration));
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(pageSize));
    const result = await fetchJson(url, { headers: serviceHeaders(configuration) });
    if (!result.ok) return { error: result };
    const pageUsers = Array.isArray(result.data?.users) ? result.data.users : [];
    users.push(...pageUsers.filter((user) => (
      String(user?.app_metadata?.campaign_delete_pending || '').toLowerCase() === campaignId
    )));
    const total = Number(result.data?.total || result.data?.total_count || 0);
    if (pageUsers.length < pageSize || (total > 0 && page * pageSize >= total)) return { users };
  }
  return {
    error: { data: { message: 'No fue posible revisar por completo las eliminaciones pendientes.' } }
  };
}

async function pendingAuthUsersFromIds(configuration, campaignId, rawUserIds, pendingToken) {
  if (!Array.isArray(rawUserIds) || rawUserIds.length === 0) return { users: null };
  const userIds = [...new Set(rawUserIds.map(normalizeUuid).filter(Boolean))];
  if (userIds.length !== rawUserIds.length || userIds.length > 10) {
    return { error: { data: { message: 'La lista de cuentas pendientes no es válida.' } } };
  }
  if (!await verifyPendingDeletion(configuration, campaignId, userIds, String(pendingToken || ''))) {
    return { error: { data: { message: 'La firma de reanudación no es válida.' } } };
  }

  const users = [];
  for (const userId of userIds) {
    const authResult = await readAuthUser(configuration, userId);
    if (authResult.error) return { error: authResult.error };
    if (!authResult.user) continue;
    if (String(authResult.user.app_metadata?.campaign_delete_pending || '').toLowerCase() !== campaignId) {
      return { error: { data: { message: 'Una cuenta no pertenece a esta eliminación pendiente.' } } };
    }
    users.push(authResult.user);
  }
  return { users };
}

function safeRows(result) {
  return Array.isArray(result?.data) ? result.data : [];
}

function responseWasTruncated(result, rows) {
  const total = exactResultCount(result);
  return total !== null && total > rows.length;
}

async function readProfilesByIds(configuration, userIds) {
  if (!userIds.length) return { profiles: [] };
  const result = await restRequest(configuration, 'profiles', {
    query: {
      id: `in.(${userIds.join(',')})`,
      select: 'id,role,campaign_id,client_id',
      limit: 11
    },
    prefer: 'count=exact'
  });
  const profiles = safeRows(result);
  if (!result.ok || responseWasTruncated(result, profiles)) return { error: result };
  return { profiles };
}

async function readOtherMembershipIds(configuration, userIds, campaignId) {
  if (!userIds.length) return { userIds: new Set() };
  const result = await restRequest(configuration, 'campaign_members', {
    query: {
      user_id: `in.(${userIds.join(',')})`,
      campaign_id: `neq.${campaignId}`,
      select: 'user_id,campaign_id',
      limit: 11
    },
    prefer: 'count=exact'
  });
  const memberships = safeRows(result);
  if (!result.ok || responseWasTruncated(result, memberships)) return { error: result };
  return {
    userIds: new Set(memberships.map((row) => normalizeUuid(row.user_id)).filter(Boolean))
  };
}

async function readClientIdsWithOtherCampaigns(configuration, profiles, campaignId) {
  const clientIds = [...new Set(profiles.map((profile) => normalizeUuid(profile.client_id)).filter(Boolean))];
  const sharedClientIds = new Set();
  for (const clientId of clientIds) {
    const result = await restRequest(configuration, 'campaigns', {
      query: {
        client_id: `eq.${clientId}`,
        id: `neq.${campaignId}`,
        select: 'id',
        limit: 1
      }
    });
    if (!result.ok) return { error: result };
    if (safeRows(result).length > 0) sharedClientIds.add(clientId);
  }
  return { clientIds: sharedClientIds };
}

async function deleteCampaignAndExclusiveUsers(request, configuration, campaignId) {
  const requester = await verifyRequester(request, configuration, GLOBAL_OWNER_ROLES);
  if (requester.error) return requester.error;
  const requestedCampaignId = normalizeUuid(campaignId);
  if (!requestedCampaignId) return json({ error: 'La campaña indicada no es válida.' }, 400);

  const parsed = await parseRequestBody(request);
  if (parsed.error) return parsed.error;
  if (parsed.body?.deleteLinkedUsers !== true) {
    return json({
      error: 'Debes confirmar explícitamente la eliminación de la campaña y sus usuarios exclusivos.'
    }, 400);
  }

  const campaignResult = await restRequest(configuration, 'campaigns', {
    query: { id: `eq.${requestedCampaignId}`, select: 'id,created_by,client_id', limit: 1 }
  });
  if (!campaignResult.ok) {
    return json({ error: errorMessage(campaignResult.data, 'No fue posible consultar la campaña.') }, 502);
  }
  const campaign = Array.isArray(campaignResult.data) ? campaignResult.data[0] : null;
  const canonicalCampaignId = normalizeUuid(campaign?.id) || requestedCampaignId;
  const profilesById = new Map();
  const authUsersById = new Map();
  const targetIds = new Set();
  let preservedUsers = 0;

  if (campaign) {
    const profilesResult = await restRequest(configuration, 'profiles', {
      query: {
        campaign_id: `eq.${canonicalCampaignId}`,
        select: 'id,role,campaign_id,client_id',
        limit: 11
      },
      prefer: 'count=exact'
    });
    if (!profilesResult.ok) {
      return json({ error: 'No fue posible consultar los perfiles vinculados.' }, 502);
    }
    const linkedProfiles = safeRows(profilesResult);
    if (linkedProfiles.length > 10 || responseWasTruncated(profilesResult, linkedProfiles)) {
      return json({ error: 'La campaña supera el límite seguro de 10 cuentas por operación.' }, 409);
    }
    for (const profile of linkedProfiles) {
      const userId = normalizeUuid(profile.id);
      if (!userId) return json({ error: 'La campaña contiene un perfil con identificación no válida.' }, 409);
      profilesById.set(userId, profile);
    }

    const campaignMembersResult = await restRequest(configuration, 'campaign_members', {
      query: {
        campaign_id: `eq.${canonicalCampaignId}`,
        select: 'user_id,campaign_id',
        limit: 11
      },
      prefer: 'count=exact'
    });
    const campaignMembers = safeRows(campaignMembersResult);
    if (!campaignMembersResult.ok) {
      return json({ error: 'No fue posible consultar los miembros de la campaña.' }, 502);
    }
    if (campaignMembers.length > 10 || responseWasTruncated(campaignMembersResult, campaignMembers)) {
      return json({ error: 'La campaña supera el límite seguro de 10 cuentas por operación.' }, 409);
    }

    const candidateIds = new Set(profilesById.keys());
    for (const membership of campaignMembers) {
      const userId = normalizeUuid(membership.user_id);
      if (!userId) return json({ error: 'La campaña contiene un miembro con identificación no válida.' }, 409);
      candidateIds.add(userId);
    }
    if (candidateIds.size > 10) {
      return json({ error: 'La campaña supera el límite seguro de 10 cuentas por operación.' }, 409);
    }

    const missingProfileIds = [...candidateIds].filter((userId) => !profilesById.has(userId));
    const missingProfilesResult = await readProfilesByIds(configuration, missingProfileIds);
    if (missingProfilesResult.error) {
      return json({ error: 'No fue posible validar todos los perfiles miembros.' }, 502);
    }
    for (const profile of missingProfilesResult.profiles) {
      const userId = normalizeUuid(profile.id);
      if (userId) profilesById.set(userId, profile);
    }

    for (const userId of candidateIds) {
      const authResult = await readAuthUser(configuration, userId);
      if (authResult.error) return json({ error: 'No fue posible validar las cuentas vinculadas.' }, 502);
      if (authResult.user) authUsersById.set(userId, authResult.user);
    }

    const candidateIdList = [...candidateIds];
    const otherMembershipsResult = await readOtherMembershipIds(
      configuration,
      candidateIdList,
      canonicalCampaignId
    );
    if (otherMembershipsResult.error) {
      return json({ error: 'No fue posible validar las demás campañas de los usuarios.' }, 502);
    }
    const clientAccessResult = await readClientIdsWithOtherCampaigns(
      configuration,
      [...profilesById.values()],
      canonicalCampaignId
    );
    if (clientAccessResult.error) {
      return json({ error: 'No fue posible validar el acceso compartido por cliente.' }, 502);
    }

    const creatorId = normalizeUuid(campaign.created_by);
    for (const userId of candidateIds) {
      const profile = profilesById.get(userId);
      const authUser = authUsersById.get(userId);
      const roles = [
        profile?.role,
        authUser?.app_metadata?.role,
        ...(Array.isArray(authUser?.app_metadata?.roles) ? authUser.app_metadata.roles : [])
      ].map((role) => String(role || '').trim().toUpperCase());
      const profileCampaignId = normalizeUuid(profile?.campaign_id);
      const profileClientId = normalizeUuid(profile?.client_id);
      const belongsToAnotherCampaign = otherMembershipsResult.userIds.has(userId) || (
        profileCampaignId && profileCampaignId !== canonicalCampaignId
      );
      const sharesAnotherClientCampaign = profileClientId && clientAccessResult.clientIds.has(profileClientId);
      const protectedAccount = (
        userId === normalizeUuid(requester.user.id) ||
        (creatorId && userId === creatorId) ||
        roles.some((role) => GLOBAL_OWNER_ROLES.includes(role))
      );
      if (protectedAccount || belongsToAnotherCampaign || sharesAnotherClientCampaign) preservedUsers += 1;
      else targetIds.add(userId);
    }
  } else {
    // Retry only accounts marked by an earlier server-side pass. User-editable
    // user_metadata is intentionally never used for destructive decisions.
    const suppliedPendingResult = await pendingAuthUsersFromIds(
      configuration,
      canonicalCampaignId,
      parsed.body?.pendingUserIds,
      parsed.body?.pendingToken
    );
    const pendingResult = suppliedPendingResult.users === null
      ? await listPendingAuthUsers(configuration, canonicalCampaignId)
      : suppliedPendingResult;
    if (pendingResult.error) {
      return json({ error: errorMessage(pendingResult.error.data, 'No fue posible revisar eliminaciones pendientes.') }, 502);
    }
    if (pendingResult.users.length > 10) {
      return json({ error: 'Hay demasiadas cuentas pendientes para completar la operación de forma segura.' }, 409);
    }
    for (const authUser of pendingResult.users) {
      const userId = normalizeUuid(authUser.id);
      if (!userId) return json({ error: 'Una cuenta pendiente tiene identificación no válida.' }, 409);
      authUsersById.set(userId, authUser);
    }

    const pendingIds = [...authUsersById.keys()];
    const pendingProfilesResult = await readProfilesByIds(configuration, pendingIds);
    if (pendingProfilesResult.error) {
      return json({ error: 'No fue posible validar una cuenta pendiente.' }, 502);
    }
    for (const profile of pendingProfilesResult.profiles) {
      const userId = normalizeUuid(profile.id);
      if (userId) profilesById.set(userId, profile);
    }
    const otherMembershipsResult = await readOtherMembershipIds(
      configuration,
      pendingIds,
      canonicalCampaignId
    );
    if (otherMembershipsResult.error) {
      return json({ error: 'No fue posible validar las campañas de una cuenta pendiente.' }, 502);
    }
    const clientAccessResult = await readClientIdsWithOtherCampaigns(
      configuration,
      [...profilesById.values()],
      canonicalCampaignId
    );
    if (clientAccessResult.error) {
      return json({ error: 'No fue posible validar el acceso compartido de una cuenta pendiente.' }, 502);
    }

    for (const [userId, authUser] of authUsersById) {
      const profile = profilesById.get(userId);
      const roles = [
        profile?.role,
        authUser?.app_metadata?.role,
        ...(Array.isArray(authUser?.app_metadata?.roles) ? authUser.app_metadata.roles : [])
      ].map((role) => String(role || '').trim().toUpperCase());
      const profileCampaignId = normalizeUuid(profile?.campaign_id);
      const profileClientId = normalizeUuid(profile?.client_id);
      const protectedAccount = (
        userId === normalizeUuid(requester.user.id) ||
        roles.some((role) => GLOBAL_OWNER_ROLES.includes(role)) ||
        otherMembershipsResult.userIds.has(userId) ||
        (profileCampaignId && profileCampaignId !== canonicalCampaignId) ||
        (profileClientId && clientAccessResult.clientIds.has(profileClientId))
      );
      if (protectedAccount) {
        return json({ error: 'Una cuenta pendiente ahora está protegida o pertenece a otra campaña.' }, 409);
      }
      targetIds.add(userId);
    }

    if (targetIds.size === 0) {
      return json({ success: true, alreadyDeleted: true, deletedUsers: 0, failedUsers: 0 });
    }
  }

  const pendingAt = new Date().toISOString();
  for (const userId of targetIds) {
    const authUser = authUsersById.get(userId);
    if (!authUser) continue;
    if (String(authUser.app_metadata?.campaign_delete_pending || '').toLowerCase() === canonicalCampaignId) {
      continue;
    }
    const markResult = await updateAuthUser(configuration, userId, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        campaign_delete_pending: canonicalCampaignId,
        campaign_delete_pending_at: pendingAt
      }
    });
    if (!markResult.ok) {
      return json({ error: 'No fue posible preparar todas las cuentas. No se eliminó la campaña.' }, 502);
    }
  }

  if (campaign) {
    const campaignDelete = await restRequest(configuration, 'campaigns', {
      method: 'DELETE',
      query: { id: `eq.${canonicalCampaignId}` },
      prefer: 'return=representation'
    });
    if (!campaignDelete.ok || !Array.isArray(campaignDelete.data) || campaignDelete.data.length !== 1) {
      const failedUserIds = [...authUsersById.keys()].filter((userId) => targetIds.has(userId));
      return json({
        error: 'No fue posible confirmar la eliminación de la campaña. Puedes reintentar de forma segura.',
        retryable: true,
        deletedUsers: 0,
        failedUsers: failedUserIds.length,
        pendingUserIds: failedUserIds,
        pendingToken: await signPendingDeletion(configuration, canonicalCampaignId, failedUserIds)
      }, 502);
    }
  }

  const ids = [...targetIds];
  const pendingUserIds = ids.filter((userId) => authUsersById.has(userId));
  if (ids.length) {
    const inFilter = `in.(${ids.join(',')})`;
    const permissionsResult = await restRequest(configuration, 'user_permissions', {
      method: 'DELETE',
      query: { user_id: inFilter },
      prefer: 'return=minimal'
    });
    if (!permissionsResult.ok) {
      return json({
        error: 'La campaña fue eliminada, pero falta retirar permisos. Reintenta.',
        deletedUsers: 0,
        failedUsers: ids.length,
        pendingUserIds,
        pendingToken: await signPendingDeletion(configuration, canonicalCampaignId, pendingUserIds),
        retryable: true
      }, 502);
    }

    const profilesResult = await restRequest(configuration, 'profiles', {
      method: 'DELETE',
      query: { id: inFilter },
      prefer: 'return=minimal'
    });
    if (!profilesResult.ok) {
      return json({
        error: 'La campaña fue eliminada, pero falta retirar perfiles. Reintenta.',
        deletedUsers: 0,
        failedUsers: ids.length,
        pendingUserIds,
        pendingToken: await signPendingDeletion(configuration, canonicalCampaignId, pendingUserIds),
        retryable: true
      }, 502);
    }
  }

  let deletedUsers = 0;
  for (let index = 0; index < pendingUserIds.length; index += 1) {
    const userId = pendingUserIds[index];
    const authResult = await deleteAuthUser(configuration, userId);
    if (!authResult.ok && authResult.status !== 404) {
      const remainingUserIds = pendingUserIds.slice(index);
      return json({
        error: 'La campaña fue eliminada, pero una cuenta quedó pendiente. Reintenta.',
        deletedUsers,
        failedUsers: remainingUserIds.length,
        pendingUserIds: remainingUserIds,
        pendingToken: await signPendingDeletion(configuration, canonicalCampaignId, remainingUserIds),
        retryable: true
      }, 502);
    }
    if (authResult.ok) deletedUsers += 1;
  }

  return json({
    success: true,
    deletedUsers,
    preservedUsers,
    failedUsers: 0
  });
}

function safeOcrInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 999999 ? number : null;
}

async function analyzeE14Image(request, configuration, env) {
  const requester = await verifyRequester(request, configuration, E14_OCR_ROLES);
  if (requester.error) return requester.error;

  const geminiApiKey = clean(env.GEMINI_API_KEY);
  if (!env.AI && !geminiApiKey) {
    return json({ error: 'El servicio de lectura E-14 aún no tiene configurado un motor visual.' }, 503);
  }

  const parsed = await parseRequestBody(request);
  if (parsed.error) return parsed.error;
  const imageData = String(parsed.body?.imageData || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const mimeType = String(parsed.body?.mimeType || 'image/jpeg').toLowerCase();
  const mesa = String(parsed.body?.mesa || '').trim().slice(0, 120);
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !/^[a-zA-Z0-9+/=]+$/.test(imageData)) {
    return json({ error: 'La fotografía enviada no tiene un formato válido.' }, 400);
  }
  if (imageData.length > 19_000_000) {
    return json({ error: 'La fotografía es demasiado grande. Tome una foto con menor resolución.' }, 413);
  }

  const prompt = `Analiza esta fotografía como un lector electoral estricto del formulario colombiano E-14${mesa ? ` de ${mesa}` : ''}. Extrae solamente cifras claramente visibles; jamás inventes, completes o corrijas números dudosos. Ordena candidateVotes según el orden vertical en el acta. Distingue votos en blanco, votos nulos y tarjetas no marcadas. validDocument debe ser false si no es un E-14 o si la imagen no permite una lectura responsable. confidence es un porcentaje de 0 a 100. Devuelve exclusivamente JSON válido con esta estructura exacta: {"validDocument":boolean,"message":string,"candidateVotes":[{"name":string,"votes":number|null}],"blankVotes":number|null,"nullVotes":number|null,"unmarkedVotes":number|null,"totalVotes":number|null,"confidence":number,"warnings":string[]}.`;
  let responseText = '';

  if (env.AI) {
    try {
      const aiResult = await env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'query',
        image: `data:${mimeType};base64,${imageData}`,
        question: prompt,
        reasoning: false,
        temperature: 0,
        max_tokens: 2500,
        stream: false,
      });
      responseText = String(aiResult?.answer || '');
    } catch (error) {
      console.error(JSON.stringify({ event: 'e14_ocr_workers_ai_failed', message: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'El lector E-14 no pudo procesar la imagen en este momento.' }, 502);
    }
  } else {
    const model = clean(env.GEMINI_MODEL) || 'gemini-2.5-flash';
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageData } }, { text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    const upstreamText = await upstream.text();
    let upstreamPayload = {};
    try { upstreamPayload = upstreamText ? JSON.parse(upstreamText) : {}; } catch { upstreamPayload = {}; }
    if (!upstream.ok) {
      console.error(JSON.stringify({ event: 'e14_ocr_provider_failed', status: upstream.status }));
      return json({ error: 'El lector E-14 no pudo procesar la imagen en este momento.' }, 502);
    }
    responseText = String(upstreamPayload?.candidates?.[0]?.content?.parts?.find?.((part) => part?.text)?.text || '');
  }

  responseText = responseText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let result;
  try { result = JSON.parse(responseText); } catch {
    return json({ error: 'El lector no devolvió resultados verificables. Tome nuevamente la fotografía.' }, 502);
  }

  const candidateVotes = Array.isArray(result.candidateVotes)
    ? result.candidateVotes.slice(0, 100).map((candidate) => ({
        name: String(candidate?.name || 'Candidato sin nombre').trim().slice(0, 160),
        votes: safeOcrInteger(candidate?.votes),
      }))
    : [];
  return json({
    validDocument: result.validDocument === true,
    message: String(result.message || '').slice(0, 500),
    candidateVotes,
    blankVotes: safeOcrInteger(result.blankVotes),
    nullVotes: safeOcrInteger(result.nullVotes),
    unmarkedVotes: safeOcrInteger(result.unmarkedVotes),
    totalVotes: safeOcrInteger(result.totalVotes),
    confidence: Math.max(0, Math.min(100, Number(result.confidence) || 0)),
    warnings: Array.isArray(result.warnings) ? result.warnings.slice(0, 10).map((warning) => String(warning).slice(0, 300)) : [],
  });
}

function routeSegments(url) {
  const pathname = new URL(url).pathname;
  const rawSegments = pathname.split('/').filter(Boolean);
  const adminIndex = rawSegments.findIndex((segment, index) =>
    segment === 'supabase-admin' && rawSegments[index - 1] === 'api'
  );
  if (adminIndex < 0) return [];
  return rawSegments.slice(adminIndex + 1).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return '';
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return json({ success: true });

  const segments = routeSegments(request.url);
  const isCampaignUser = segments.length === 1 && segments[0] === 'campaign-user';
  const isManagedUser = segments.length === 1 && segments[0] === 'managed-user';
  const isPasswordReset = segments.length === 3 &&
    segments[0] === 'campaign-user' && segments[2] === 'reset-password';
  const isCampaignDelete = segments.length === 2 && segments[0] === 'campaigns';
  const isE14Ocr = segments.length === 1 && segments[0] === 'e14-ocr';
  const knownRoute = isCampaignUser || isManagedUser || isPasswordReset || isCampaignDelete || isE14Ocr;

  if (!knownRoute) return json({ error: 'Ruta administrativa no disponible.' }, 404);

  const configuration = getConfiguration(env);
  if (!configuration.url || !configuration.serverKey) {
    return json({
      error: 'Falta configurar SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'
    }, 503);
  }

  try {
    if (isCampaignUser && method === 'POST') return createCampaignUser(request, configuration);
    if (isManagedUser && method === 'POST') return createManagedUser(request, configuration);
    if (isPasswordReset && method === 'POST') {
      return resetCampaignUserPassword(request, configuration, segments[1]);
    }
    if (isCampaignDelete && method === 'DELETE') {
      return deleteCampaignAndExclusiveUsers(request, configuration, segments[1]);
    }
    if (isE14Ocr && method === 'POST') return analyzeE14Image(request, configuration, env);

    const allow = isCampaignDelete ? 'DELETE' : 'POST';
    return json({ error: 'Método HTTP no permitido para esta ruta.' }, 405, { allow });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'supabase_admin_operation_failed',
      method,
      route: segments.join('/'),
      message: error instanceof Error ? error.message : String(error)
    }));
    return json({ error: 'No fue posible completar la operación segura en Supabase.' }, 502);
  }
}
