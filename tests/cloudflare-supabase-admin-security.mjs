import assert from 'node:assert/strict';

const functionUrl = new URL('../functions/api/supabase-admin/[[path]].js', import.meta.url).href;
const { onRequest } = await import(`${functionUrl}?security-test=${Date.now()}`);

assert.equal(typeof onRequest, 'function', 'La Function debe exportar onRequest(context).');

const originalFetch = globalThis.fetch;
const calls = [];
let scenario = '';
let mockCampaignExists = true;
let failPermissionsOnce = false;
const mockAppMetadata = new Map();

const ids = Object.freeze({
  campaign: 'a1111111-b111-4111-8111-c11111111111',
  otherCampaign: 'b2222222-c222-4222-8222-d22222222222',
  sharedClient: 'c3333333-d333-4333-8333-e33333333333',
  requester: '00000000-0000-4000-8000-000000000001',
  creator: '00000000-0000-4000-8000-000000000002',
  exclusive: '00000000-0000-4000-8000-000000000003',
  shared: '00000000-0000-4000-8000-000000000004',
  global: '00000000-0000-4000-8000-000000000005',
  userMetadataNoise: '00000000-0000-4000-8000-000000000006',
  canonicalMember: '00000000-0000-4000-8000-00000000000b',
  clientShared: '00000000-0000-4000-8000-00000000000c'
});

const opaqueServerKey = 'sb_secret_security_test_only';
const env = {
  VITE_SUPABASE_URL: 'https://security-test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-security-test',
  SUPABASE_SECRET_KEY: opaqueServerKey
};

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function exactRows(rows, total = rows.length, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-range', rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`);
  return jsonResponse(rows, { ...init, headers });
}

function requestMethod(input, init) {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

function parseBody(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(String(value));
  } catch {
    return String(value);
  }
}

function profile(id, role, campaignId = ids.campaign, clientId = null) {
  return {
    id,
    role,
    status: 'ACTIVE',
    client_id: clientId,
    campaign_id: campaignId,
    allowed_modules: role === 'SUPERADMIN' || role === 'GLOBAL_ADMIN'
      ? ['GLOBAL_ADMIN_FULL']
      : ['ADMINISTRATIVE']
  };
}

const authorizedProfiles = [
  profile(ids.exclusive, 'ADMIN_CLIENTE'),
  profile(ids.shared, 'COORDINADOR'),
  profile(ids.requester, 'SUPERADMIN'),
  profile(ids.creator, 'ADMIN_CLIENTE'),
  profile(ids.global, 'GLOBAL_ADMIN'),
  profile(ids.clientShared, 'COORDINADOR', ids.campaign, ids.sharedClient)
];

const canonicalMemberProfile = profile(ids.canonicalMember, 'ADMIN_CLIENTE', null);

const authorizedAuthUsers = new Map([
  [ids.exclusive, {
    id: ids.exclusive,
    app_metadata: { role: 'ADMIN_CLIENTE' },
    user_metadata: { campaign_id: ids.otherCampaign }
  }],
  [ids.shared, {
    id: ids.shared,
    app_metadata: { role: 'COORDINADOR' },
    user_metadata: { campaign_id: ids.campaign }
  }],
  [ids.requester, {
    id: ids.requester,
    app_metadata: { role: 'SUPERADMIN' },
    user_metadata: { campaign_id: ids.campaign }
  }],
  [ids.creator, {
    id: ids.creator,
    app_metadata: { role: 'ADMIN_CLIENTE' },
    user_metadata: { campaign_id: ids.campaign }
  }],
  [ids.global, {
    id: ids.global,
    app_metadata: { role: 'GLOBAL_ADMIN' },
    user_metadata: { campaign_id: ids.campaign }
  }],
  [ids.canonicalMember, {
    id: ids.canonicalMember,
    app_metadata: { role: 'ADMIN_CLIENTE' },
    user_metadata: {}
  }],
  [ids.clientShared, {
    id: ids.clientShared,
    app_metadata: { role: 'COORDINADOR' },
    user_metadata: { campaign_id: ids.campaign }
  }]
]);

const canonicalCampaignMembers = [
  ids.exclusive,
  ids.shared,
  ids.requester,
  ids.creator,
  ids.global,
  ids.canonicalMember,
  ids.clientShared
].map((userId) => ({ user_id: userId, campaign_id: ids.campaign }));

function requesterProfile() {
  if (scenario === 'existing-email' || scenario === 'foreign-module') {
    return {
      id: 'requester-admin-client',
      role: 'ADMIN_CLIENTE',
      status: 'ACTIVE',
      client_id: 'client-1',
      campaign_id: 'campaign-1',
      allowed_modules: ['ADMINISTRATIVE']
    };
  }
  return profile(ids.requester, 'SUPERADMIN');
}

function profilesForIdFilter(value) {
  const match = String(value || '').match(/^eq\.(.+)$/);
  const userId = match?.[1] || '';
  if (userId === 'requester-admin-client') return [requesterProfile()];
  if (userId === ids.requester) return [requesterProfile()];
  const candidate = authorizedProfiles.find((item) => item.id === userId);
  return candidate ? [candidate] : [];
}

function idsFromInFilter(value) {
  const match = String(value || '').match(/^in\.\((.*)\)$/);
  return match?.[1] ? match[1].split(',') : [];
}

function profilesForInFilter(value) {
  return idsFromInFilter(value).flatMap((userId) => {
    if (userId === ids.canonicalMember) return [canonicalMemberProfile];
    const candidate = authorizedProfiles.find((item) => item.id === userId);
    return candidate ? [candidate] : [];
  });
}

function tooManyProfiles() {
  return Array.from({ length: 11 }, (_, index) => profile(
    `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    'ADMIN_CLIENTE'
  ));
}

function authUserForId(userId) {
  const user = authorizedAuthUsers.get(userId);
  if (!user) return null;
  return {
    ...user,
    app_metadata: mockAppMetadata.has(userId)
      ? { ...mockAppMetadata.get(userId) }
      : { ...(user.app_metadata || {}) },
    user_metadata: { ...(user.user_metadata || {}) }
  };
}

function isCountedRead(call) {
  return call.method === 'GET' && call.headers.get('prefer') === 'count=exact';
}

function isTargetMembershipRead(call) {
  return call.url.pathname === '/rest/v1/campaign_members' &&
    call.method === 'GET' &&
    call.url.searchParams.get('campaign_id') === `eq.${ids.campaign}` &&
    !call.url.searchParams.has('user_id');
}

function isOtherMembershipRead(call) {
  return call.url.pathname === '/rest/v1/campaign_members' &&
    call.method === 'GET' &&
    call.url.searchParams.get('campaign_id') === `neq.${ids.campaign}` &&
    String(call.url.searchParams.get('user_id') || '').startsWith('in.(');
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = requestMethod(input, init);
  const headers = new Headers(init.headers);
  const call = { url, method, headers, body: parseBody(init.body) };
  calls.push(call);

  if (url.pathname === '/auth/v1/user') {
    return jsonResponse({
      id: scenario === 'existing-email' || scenario === 'foreign-module'
        ? 'requester-admin-client'
        : ids.requester,
      email: 'requester@example.test'
    });
  }

  if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
    const idFilter = url.searchParams.get('id');
    if (String(idFilter || '').startsWith('eq.')) return jsonResponse(profilesForIdFilter(idFilter));
    if (String(idFilter || '').startsWith('in.(')) {
      if (headers.get('prefer') !== 'count=exact') {
        return jsonResponse({ message: 'Falta Prefer: count=exact en perfiles por IDs.' }, { status: 500 });
      }
      const rows = profilesForInFilter(idFilter);
      return exactRows(rows);
    }

    if (url.searchParams.get('campaign_id') === `eq.${ids.campaign}`) {
      if (headers.get('prefer') !== 'count=exact') {
        return jsonResponse({ message: 'Falta Prefer: count=exact en perfiles vinculados.' }, { status: 500 });
      }
      const rows = scenario === 'delete-too-many' ? tooManyProfiles() : authorizedProfiles;
      return exactRows(rows);
    }
    return jsonResponse([]);
  }

  if (url.pathname === '/rest/v1/campaigns' && method === 'GET') {
    if (!mockCampaignExists) return jsonResponse([]);
    if (url.searchParams.get('id') === `eq.${ids.campaign}`) {
      return jsonResponse([{
        id: ids.campaign,
        created_by: ids.creator,
        client_id: ids.sharedClient
      }]);
    }
    if (
      url.searchParams.get('client_id') === `eq.${ids.sharedClient}` &&
      url.searchParams.get('id') === `neq.${ids.campaign}`
    ) {
      return jsonResponse([{ id: ids.otherCampaign }]);
    }
    return jsonResponse([]);
  }

  if (url.pathname === '/rest/v1/campaign_members' && method === 'GET') {
    if (headers.get('prefer') !== 'count=exact') {
      return jsonResponse({ message: 'Falta Prefer: count=exact en campaign_members.' }, { status: 500 });
    }
    const campaignFilter = url.searchParams.get('campaign_id');
    const userFilter = url.searchParams.get('user_id');
    if (campaignFilter === `eq.${ids.campaign}` && !userFilter) {
      if (scenario === 'delete-truncated-members') {
        return exactRows(canonicalCampaignMembers.slice(0, 1), canonicalCampaignMembers.length);
      }
      return exactRows(canonicalCampaignMembers);
    }
    if (campaignFilter === `neq.${ids.campaign}` && String(userFilter || '').startsWith('in.(')) {
      const requestedIds = idsFromInFilter(userFilter);
      const rows = requestedIds.includes(ids.shared)
        ? [{ user_id: ids.shared, campaign_id: ids.otherCampaign }]
        : [];
      if (scenario === 'delete-truncated-other-memberships') return exactRows(rows, rows.length + 1);
      return exactRows(rows);
    }
    return jsonResponse({ message: 'Consulta campaign_members no reconocida por el mock semántico.' }, { status: 500 });
  }

  if (url.pathname === '/auth/v1/admin/users' && method === 'GET') {
    return jsonResponse({
      users: [
        {
          id: ids.userMetadataNoise,
          app_metadata: { role: 'ADMIN_CLIENTE' },
          user_metadata: {
            campaign_id: ids.campaign,
            campaign_delete_pending: ids.campaign
          }
        }
      ]
    });
  }

  const authUserMatch = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (authUserMatch && method === 'GET') {
    const user = authUserForId(decodeURIComponent(authUserMatch[1]));
    return user ? jsonResponse(user) : jsonResponse({ message: 'Not found' }, { status: 404 });
  }
  if (authUserMatch && method === 'PUT') {
    const userId = decodeURIComponent(authUserMatch[1]);
    if (call.body?.app_metadata) mockAppMetadata.set(userId, { ...call.body.app_metadata });
    return jsonResponse({ id: userId });
  }
  if (authUserMatch && method === 'DELETE') {
    return jsonResponse({});
  }

  if (url.pathname === '/auth/v1/admin/users' && method === 'POST') {
    return jsonResponse(
      { message: 'A user with this email address has already been registered' },
      { status: 422 }
    );
  }

  if (url.pathname === '/rest/v1/campaigns' && method === 'DELETE') {
    if (scenario === 'delete-token-flow') mockCampaignExists = false;
    return jsonResponse([{ id: ids.campaign }]);
  }

  if (method === 'DELETE' && url.pathname === '/rest/v1/user_permissions') {
    if (scenario === 'delete-token-flow' && failPermissionsOnce) {
      failPermissionsOnce = false;
      return jsonResponse({ message: 'Fallo transitorio simulado.' }, { status: 503 });
    }
    return jsonResponse({});
  }

  if (method === 'DELETE' && url.pathname === '/rest/v1/profiles') {
    return jsonResponse({});
  }

  return jsonResponse(
    { message: `El mock no esperaba ${method} ${url.pathname}${url.search}` },
    { status: 500 }
  );
};

function wildcardFor(pathname) {
  return pathname
    .replace(/^\/api\/supabase-admin\/?/, '')
    .split('/')
    .filter(Boolean);
}

async function invoke(pathname, { method = 'POST', body } = {}) {
  const headers = new Headers({ authorization: 'Bearer requester-token' });
  if (body !== undefined) headers.set('content-type', 'application/json');

  const response = await onRequest({
    request: new Request(`https://software.example.test${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    env,
    params: { path: wildcardFor(pathname) },
    data: {},
    waitUntil() {},
    next: async () => new Response('<!doctype html><html>SPA fallback</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  });

  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';
  assert.match(contentType, /^application\/json\b/i, `${pathname} no devolvió Content-Type JSON.`);
  assert.doesNotMatch(rawBody.trimStart(), /^<(?:!doctype|html)\b/i, `${pathname} filtró HTML.`);
  assert.doesNotThrow(() => JSON.parse(rawBody), `${pathname} no devolvió JSON válido.`);

  return { response, payload: JSON.parse(rawBody) };
}

function resetScenario(nextScenario) {
  scenario = nextScenario;
  calls.length = 0;
  mockCampaignExists = !nextScenario.startsWith('delete-retry-invalid');
  failPermissionsOnce = nextScenario === 'delete-token-flow';
  mockAppMetadata.clear();
}

function callsTo(pathname, method) {
  return calls.filter((call) => (
    call.url.pathname === pathname && (!method || call.method === method)
  ));
}

function isMutation(call) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method);
}

function mutationMentionsId(call, userId) {
  return isMutation(call) && decodeURIComponent(
    `${call.url.pathname}${call.url.search}${JSON.stringify(call.body || {})}`
  ).includes(userId);
}

function authMutation(userId, method) {
  return calls.find((call) => (
    call.method === method && call.url.pathname === `/auth/v1/admin/users/${userId}`
  ));
}

function assertNoMutations(message) {
  assert.deepEqual(calls.filter(isMutation), [], message);
}

function assertOpaqueSecretNeverUsedAsBearer() {
  const serviceCalls = calls.filter((call) => call.headers.get('apikey') === opaqueServerKey);
  for (const call of serviceCalls) {
    assert.equal(
      call.headers.get('authorization'),
      null,
      `sb_secret debe enviarse solo en apikey, sin Authorization Bearer, en ${call.method} ${call.url.pathname}.`
    );
  }
}

try {
  const uppercaseCampaignId = ids.campaign.toUpperCase();

  resetScenario('existing-email');
  const existingEmail = await invoke('/api/supabase-admin/managed-user', {
    body: {
      email: 'existing@example.test',
      password: 'Secure#Pass123',
      displayName: 'Usuario existente',
      role: 'COORDINADOR',
      allowedModules: ['ADMINISTRATIVE']
    }
  });
  assert.equal(existingEmail.response.status, 409);
  assert.match(existingEmail.payload.error, /solo el propietario global/i);
  assert.equal(authMutation('requester-admin-client', 'PUT'), undefined);
  assert.equal(callsTo('/rest/v1/profiles', 'POST').length, 0);
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('foreign-module');
  const foreignModule = await invoke('/api/supabase-admin/managed-user', {
    body: {
      email: 'new-user@example.test',
      password: 'Secure#Pass123',
      displayName: 'Usuario nuevo',
      role: 'COORDINADOR',
      allowedModules: ['STRATEGY'],
      permissions: [{ moduleCode: 'STRATEGY', functionCode: 'DASHBOARD' }]
    }
  });
  assert.equal(foreignModule.response.status, 403);
  assert.match(foreignModule.payload.error, /no puedes delegar módulos/i);
  assert.equal(callsTo('/auth/v1/admin/users', 'POST').length, 0);
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-flag-missing');
  const missingFlag = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: {}
  });
  assert.equal(missingFlag.response.status, 400);
  assert.match(String(missingFlag.payload.error || ''), /confirm|explícitamente|usuarios exclusivos/i);
  assertNoMutations('Sin deleteLinkedUsers=true no debe ejecutarse ninguna mutación.');
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-authorized');
  const authorized = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: { deleteLinkedUsers: true }
  });
  assert.equal(authorized.response.status, 200, authorized.payload.error || 'El flujo autorizado falló.');
  assert.equal(authorized.payload.success, true);
  assert.equal(authorized.payload.deletedUsers, 2);
  assert.equal(authorized.payload.preservedUsers, 5);

  const campaignLookup = calls.find((call) => (
    call.method === 'GET' &&
    call.url.pathname === '/rest/v1/campaigns' &&
    call.url.searchParams.get('id')?.startsWith('eq.')
  ));
  assert.equal(
    campaignLookup?.url.searchParams.get('id'),
    `eq.${ids.campaign}`,
    'El campaignId en mayúsculas debe normalizarse antes de consultar Supabase.'
  );

  const targetMembershipReads = calls.filter(isTargetMembershipRead);
  const otherMembershipReads = calls.filter(isOtherMembershipRead);
  assert.equal(targetMembershipReads.length, 1, 'Debe consultar los miembros canónicos de la campaña objetivo una vez.');
  assert.equal(otherMembershipReads.length, 1, 'Debe consultar por separado membresías en otras campañas.');
  assert.ok(targetMembershipReads.every(isCountedRead), 'La consulta de miembros objetivo debe pedir count=exact.');
  assert.ok(otherMembershipReads.every(isCountedRead), 'La consulta de membresías ajenas debe pedir count=exact.');

  const exclusiveMark = authMutation(ids.exclusive, 'PUT');
  assert.ok(exclusiveMark, 'La cuenta exclusiva debe marcarse antes del borrado.');
  assert.equal(exclusiveMark.body?.app_metadata?.campaign_delete_pending, ids.campaign);
  assert.equal(
    exclusiveMark.body?.app_metadata?.role,
    'ADMIN_CLIENTE',
    'El marcador debe conservar app_metadata existente.'
  );

  const canonicalMemberMark = authMutation(ids.canonicalMember, 'PUT');
  assert.ok(
    canonicalMemberMark,
    'Un miembro canónico debe incluirse aunque su profiles.campaign_id sea nulo.'
  );

  const campaignDeleteIndex = calls.findIndex((call) => (
    call.method === 'DELETE' && call.url.pathname === '/rest/v1/campaigns'
  ));
  const exclusiveDeleteIndex = calls.findIndex((call) => (
    call.method === 'DELETE' && call.url.pathname === `/auth/v1/admin/users/${ids.exclusive}`
  ));
  assert.ok(campaignDeleteIndex >= 0, 'La campaña debe eliminarse.');
  assert.ok(
    exclusiveDeleteIndex > campaignDeleteIndex,
    'La cuenta exclusiva solo debe eliminarse después de confirmar el borrado de la campaña.'
  );

  for (const preservedId of [ids.shared, ids.requester, ids.creator, ids.global, ids.clientShared]) {
    assert.equal(authMutation(preservedId, 'PUT'), undefined, `La cuenta protegida ${preservedId} no debe marcarse.`);
    assert.equal(authMutation(preservedId, 'DELETE'), undefined, `La cuenta protegida ${preservedId} no debe borrarse.`);
    assert.equal(
      calls.some((call) => mutationMentionsId(call, preservedId)),
      false,
      `La cuenta protegida ${preservedId} no debe incluirse en permisos ni perfiles eliminados.`
    );
  }
  assert.ok(
    calls.some((call) => (
      call.method === 'GET' &&
      call.url.pathname === '/rest/v1/campaigns' &&
      call.url.searchParams.get('client_id') === `eq.${ids.sharedClient}` &&
      call.url.searchParams.get('id') === `neq.${ids.campaign}`
    )),
    'Debe verificar si el client_id mantiene acceso mediante otra campaña.'
  );
  assert.ok(
    authMutation(ids.canonicalMember, 'DELETE'),
    'El miembro canónico exclusivo debe eliminarse después de la campaña.'
  );
  assert.equal(
    calls.some((call) => mutationMentionsId(call, ids.userMetadataNoise)),
    false,
    'user_metadata nunca debe agregar una cuenta al conjunto destructivo.'
  );
  assert.equal(
    callsTo('/auth/v1/admin/users', 'GET').length,
    0,
    'Con campaña presente no debe escanearse el directorio usando metadata editable.'
  );
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-token-flow');
  const retryable = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: { deleteLinkedUsers: true }
  });
  assert.equal(retryable.response.status, 502);
  assert.equal(retryable.payload.retryable, true);
  assert.deepEqual(
    [...retryable.payload.pendingUserIds].sort(),
    [ids.exclusive, ids.canonicalMember].sort(),
    'La respuesta retryable debe firmar exactamente todas las cuentas aún pendientes.'
  );
  assert.match(
    String(retryable.payload.pendingToken || ''),
    /^[A-Za-z0-9_-]{40,}$/,
    'La Function debe emitir un pendingToken HMAC opaco en el flujo real.'
  );
  assert.equal(callsTo('/rest/v1/campaigns', 'DELETE').length, 1);
  assert.ok(authMutation(ids.exclusive, 'PUT'));
  assert.ok(authMutation(ids.canonicalMember, 'PUT'));

  const issuedPendingUserIds = retryable.payload.pendingUserIds;
  const issuedPendingToken = retryable.payload.pendingToken;
  const resumeStart = calls.length;
  const retry = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: {
      deleteLinkedUsers: true,
      pendingUserIds: issuedPendingUserIds.map((userId) => userId.toUpperCase()),
      pendingToken: issuedPendingToken
    }
  });
  assert.equal(retry.response.status, 200, retry.payload.error || 'El reintento seguro falló.');
  assert.equal(retry.payload.success, true);
  assert.equal(retry.payload.deletedUsers, 2);
  const resumeCalls = calls.slice(resumeStart);
  assert.equal(
    resumeCalls.filter((call) => call.url.pathname === '/rest/v1/campaigns' && call.method === 'DELETE').length,
    0,
    'Una campaña ya ausente no debe volver a eliminarse.'
  );
  assert.equal(
    resumeCalls.filter((call) => call.method === 'PUT' && call.url.pathname.startsWith('/auth/v1/admin/users/')).length,
    0,
    'El reintento firmado no debe volver a marcar cuentas ya preparadas.'
  );
  for (const pendingUserId of issuedPendingUserIds) {
    assert.ok(
      resumeCalls.some((call) => (
        call.method === 'DELETE' && call.url.pathname === `/auth/v1/admin/users/${pendingUserId}`
      )),
      `La cuenta firmada ${pendingUserId} debe completarse en el reintento.`
    );
  }
  assert.equal(
    resumeCalls.filter((call) => call.url.pathname === '/auth/v1/admin/users' && call.method === 'GET').length,
    0,
    'pendingUserIds firmados debe evitar el escaneo paginado del directorio Auth.'
  );
  assert.equal(
    resumeCalls.some((call) => mutationMentionsId(call, ids.userMetadataNoise)),
    false,
    'El reintento dirigido no debe incorporar cuentas desde user_metadata.'
  );
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-retry-invalid-partial');
  const partialList = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: {
      deleteLinkedUsers: true,
      pendingUserIds: [issuedPendingUserIds[0]],
      pendingToken: issuedPendingToken
    }
  });
  assert.equal(partialList.response.status, 502);
  assert.match(String(partialList.payload.error || ''), /firma.*no es válida/i);
  assertNoMutations('Una lista parcial no debe validarse con el token de la lista completa.');
  assert.equal(callsTo('/auth/v1/admin/users', 'GET').length, 0);
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-retry-invalid-token');
  const tamperedToken = `${issuedPendingToken.slice(0, -1)}${issuedPendingToken.endsWith('A') ? 'B' : 'A'}`;
  const tampered = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: {
      deleteLinkedUsers: true,
      pendingUserIds: issuedPendingUserIds,
      pendingToken: tamperedToken
    }
  });
  assert.equal(tampered.response.status, 502);
  assert.match(String(tampered.payload.error || ''), /firma.*no es válida/i);
  assertNoMutations('Un pendingToken alterado debe rechazarse antes de cualquier mutación.');
  assert.equal(callsTo('/auth/v1/admin/users', 'GET').length, 0);
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-too-many');
  const tooMany = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: { deleteLinkedUsers: true }
  });
  assert.equal(tooMany.response.status, 409);
  assert.match(String(tooMany.payload.error || ''), /límite seguro de 10|supera.*10/i);
  assertNoMutations('Más de 10 perfiles debe bloquear la operación antes de cualquier mutación.');
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-truncated-members');
  const truncatedMembers = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: { deleteLinkedUsers: true }
  });
  assert.equal(truncatedMembers.response.status, 409);
  assert.match(String(truncatedMembers.payload.error || ''), /límite seguro de 10|supera.*10/i);
  assertNoMutations('Una lista truncada de miembros canónicos debe abortar antes de mutar datos.');
  assertOpaqueSecretNeverUsedAsBearer();

  resetScenario('delete-truncated-other-memberships');
  const truncatedOtherMemberships = await invoke(`/api/supabase-admin/campaigns/${uppercaseCampaignId}`, {
    method: 'DELETE',
    body: { deleteLinkedUsers: true }
  });
  assert.equal(truncatedOtherMemberships.response.status, 502);
  assert.match(String(truncatedOtherMemberships.payload.error || ''), /demás campañas/i);
  assertNoMutations('Membresías ajenas truncadas deben abortar antes de cualquier mutación.');
  assert.equal(calls.filter(isTargetMembershipRead).length, 1);
  assert.equal(calls.filter(isOtherMembershipRead).length, 1);
  assertOpaqueSecretNeverUsedAsBearer();

  console.log('Cloudflare Supabase Admin security: 11 casos aprobados; pendingToken HMAC, reintento dirigido, membresías, conteos exactos, límites, JSON y sb_secret verificados.');
} finally {
  globalThis.fetch = originalFetch;
}
