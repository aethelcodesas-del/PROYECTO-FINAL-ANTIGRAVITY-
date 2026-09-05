const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff'
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
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

function getConfiguration(env) {
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

function bearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

function jwtExpiresAt(token) {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return Date.now() + 60 * 60 * 1000;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return Number(payload.exp) * 1000 || Date.now() + 60 * 60 * 1000;
  } catch {
    return Date.now() + 60 * 60 * 1000;
  }
}

async function readSupabaseUser(configuration, token) {
  const response = await fetch(`${configuration.url}/auth/v1/user`, {
    headers: {
      apikey: configuration.publicKey,
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });

  if (!response.ok) return null;
  return response.json();
}

async function readGlobalAdminProfile(configuration, token, userId) {
  const profileUrl = new URL(`${configuration.url}/rest/v1/profiles`);
  profileUrl.searchParams.set('id', `eq.${userId}`);
  profileUrl.searchParams.set('select', 'id,email,display_name,role,status,allowed_modules');
  profileUrl.searchParams.set('limit', '1');

  const key = configuration.serverKey || configuration.publicKey;
  const response = await fetch(profileUrl, {
    headers: {
      apikey: key,
      authorization: `Bearer ${configuration.serverKey || token}`,
      accept: 'application/json'
    }
  });

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

function isActiveGlobalAdmin(profile) {
  const role = String(profile?.role || '').trim().toUpperCase();
  const status = String(profile?.status || '').trim().toUpperCase();
  return ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(role) &&
    ['ACTIVE', 'ACTIVO'].includes(status);
}

function sessionPayload(token, user, profile, expiresAt) {
  return {
    success: true,
    session: {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      user: {
        id: user.id,
        email: profile.email || user.email || '',
        name: profile.display_name || 'Propietario Global',
        role: 'GLOBAL_ADMIN',
        roleTitle: 'Propietario Global',
        permissions: ['GLOBAL_ADMIN_FULL', ...(profile.allowed_modules || [])],
        mfaEnabled: Boolean(user.factors?.length),
        lastLoginAt: new Date().toISOString()
      }
    }
  };
}

async function login(request, configuration) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'La solicitud de acceso no es válida.' }, 400);
  }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) {
    return json({
      success: false,
      error: 'Debes proporcionar correo electrónico y contraseña de acceso.'
    }, 400);
  }

  const response = await fetch(`${configuration.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: configuration.publicKey,
      authorization: `Bearer ${configuration.publicKey}`,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const authentication = await response.json().catch(() => ({}));

  if (!response.ok || !authentication.access_token || !authentication.user) {
    const detail = String(
      authentication.msg ||
      authentication.message ||
      authentication.error_description ||
      authentication.error ||
      ''
    ).toLowerCase();
    let error = 'Correo o contraseña incorrectos.';
    if (detail.includes('email not confirmed')) {
      error = 'El correo todavía no está confirmado en Supabase Authentication.';
    } else if (detail.includes('rate limit') || response.status === 429) {
      error = 'Demasiados intentos. Espera unos minutos antes de volver a ingresar.';
    }
    return json({ success: false, error }, response.status === 429 ? 429 : 403);
  }

  const profile = await readGlobalAdminProfile(
    configuration,
    authentication.access_token,
    authentication.user.id
  );
  if (!isActiveGlobalAdmin(profile)) {
    return json({ success: false, error: 'La cuenta no tiene acceso SUPERADMIN activo.' }, 403);
  }

  const expiresAt = Number(authentication.expires_at) * 1000 ||
    Date.now() + Number(authentication.expires_in || 3600) * 1000;
  return json(sessionPayload(
    authentication.access_token,
    authentication.user,
    profile,
    expiresAt
  ));
}

async function verifySession(request, configuration) {
  const token = bearerToken(request);
  if (!token) {
    return json({ success: false, error: 'Token de autorización requerido.' }, 401);
  }

  const user = await readSupabaseUser(configuration, token);
  if (!user?.id) {
    return json({ success: false, error: 'La sesión administrativa expiró.' }, 401);
  }
  const profile = await readGlobalAdminProfile(configuration, token, user.id);
  if (!isActiveGlobalAdmin(profile)) {
    return json({ success: false, error: 'La cuenta no tiene acceso SUPERADMIN activo.' }, 403);
  }

  return json({
    ...sessionPayload(token, user, profile, jwtExpiresAt(token)),
    valid: true
  });
}

async function logout(request, configuration) {
  const token = bearerToken(request);
  if (token) {
    await fetch(`${configuration.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: {
        apikey: configuration.publicKey,
        authorization: `Bearer ${token}`
      }
    }).catch(() => undefined);
  }
  return json({ success: true, message: 'Sesión finalizada correctamente.' });
}

export async function onRequest(context) {
  const { request, env } = context;
  const configuration = getConfiguration(env);
  if (!configuration.url || !configuration.publicKey) {
    return json({
      success: false,
      error: 'Supabase Auth no está configurado en el servidor de Cloudflare.'
    }, 503);
  }

  const route = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) || '';
  const method = request.method.toUpperCase();

  try {
    if (route === 'status' && method === 'GET') {
      return json({
        initialized: true,
        maintenanceMode: false,
        platformName: 'Campaña Ganadora SaaS - Master Core',
        serverTime: new Date().toISOString()
      });
    }
    if (route === 'login' && method === 'POST') return login(request, configuration);
    if (route === 'verify-session' && method === 'GET') {
      return verifySession(request, configuration);
    }
    if (route === 'logout' && method === 'POST') return logout(request, configuration);

    return json({ success: false, error: 'Ruta administrativa no disponible.' }, 404);
  } catch {
    return json({
      success: false,
      error: 'No fue posible conectar con el servicio seguro de autenticación.'
    }, 502);
  }
}
