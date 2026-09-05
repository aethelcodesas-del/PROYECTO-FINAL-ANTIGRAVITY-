import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import globalAdminRouter from './server/routes/globalAdmin.ts';
import { supabaseAdmin } from './server/services/dbService.ts';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT || 3000);
// Vercel functions can only write temporary files under /tmp. The JSON store is
// merely a local fallback; persistent production data continues to live in
// Supabase.
const RUNTIME_DATA_DIR = process.env.VERCEL === '1' ? tmpdir() : process.cwd();
const DB_FILE = path.join(RUNTIME_DATA_DIR, 'data_db.json');

// Interface for database structure
interface DatabaseSchema {
  admin: {
    users: Array<{ id: string; name: string; cedula?: string; email: string; role: string; accessLevel: string; status: string; createdAt: string }>;
    payroll: Array<{ id: string; concept: string; category: string; amount: number; date: string; status: string }>;
    auditLogs: Array<{ id: string; action: string; user: string; timestamp: string; details: string }>;
    systemSettings: { maintenanceMode: boolean; apiRateLimit: number; sha256Verification: boolean };
  };
  strategic: {
    dafoEntries: Array<{ id: string; type: 'Debilidad' | 'Oportunidad' | 'Fortaleza' | 'Amenaza'; description: string; impact: string; status: string }>;
    budgets: Array<{ id: string; title: string; allocated: number; executed: number; department: string }>;
    aiNotes: Array<{ id: string; topic: string; content: string; date: string }>;
    candidateProfile?: {
      name: string;
      cedula: string;
      pseudonym: string;
      profession: string;
      photo: string;
      phone: string;
      email: string;
      slogan: string;
      bio: string;
      party: string;
      numberOnBallot: string;
      socialMedia: {
        whatsapp?: string;
        facebook?: string;
        instagram?: string;
        twitter?: string;
        tiktok?: string;
        youtube?: string;
        website?: string;
      };
    };
  };
  territorial: {
    voters: Array<{ id: string; name: string; cedula: string; puesto: string; mesa: string; leaderName: string; status: string }>;
    e14Actas: Array<{ id: string; mesa: string; puesto: string; votosCandidato: number; votosOponente: number; nulos: number; status: string; timestamp: string }>;
    witnesses: Array<{ id: string; name: string; puesto: string; mesa: string; phone: string; geofenceVerified: boolean; batteryPct: number }>;
  };
  saas: {
    clients: Array<{ id: string; name: string; email: string; phone: string; status: 'Activo' | 'Suspendido' | 'Inactivo'; plan: string; joinedDate: string }>;
    licenses: Array<{ id: string; clientName: string; planName: string; code: string; startDate: string; expirationDate: string; status: 'Pendiente' | 'Activa' | 'Suspendida' | 'Vencida' | 'Cancelada'; maxUsers: number; modules: string[] }>;
    subscriptions: Array<{ id: string; clientName: string; planName: string; status: 'Activo' | 'Vencido' | 'Pendiente'; billingCycle: 'Mensual' | 'Anual'; nextRenewal: string; mrr: number }>;
    plans: Array<{ id: string; name: string; price: number; duration: string; maxUsers: number; modules: string[]; status: 'Activo' | 'Inactivo' }>;
    auditLogs: Array<{ id: string; action: string; user: string; timestamp: string; details: string; client?: string }>;
  };
}

// Initial default seed
const initialDbData: DatabaseSchema = {
  admin: {
    users: [
      { id: 'USR-1001', name: 'Dra. María Paula Restrepo', cedula: '1085294312', email: 'admin.general@campanaganadora.co', role: 'Superadmin', accessLevel: 'Nivel 10', status: 'Activo', createdAt: '2026-01-10' },
      { id: 'USR-1002', name: 'Ing. Carlos Alberto Mendoza', cedula: '1020784920', email: 'director.estrategico@campanaganadora.co', role: 'Director Político', accessLevel: 'Nivel 9', status: 'Activo', createdAt: '2026-01-15' },
      { id: 'USR-1003', name: 'Capitán Fernando Torres', cedula: '1144028392', email: 'coordinador.e14@campanaganadora.co', role: 'Coordinador Territorial', accessLevel: 'Nivel 7', status: 'Activo', createdAt: '2026-02-01' },
      { id: 'USR-1004', name: 'Dra. Elena Gómez Soler', cedula: '31894021', email: 'tesoreria@campanaganadora.co', role: 'Tesorero / Contador CNE', accessLevel: 'Nivel 8', status: 'Activo', createdAt: '2026-02-01' }
    ],
    payroll: [
      { id: 'PAY-101', concept: 'Honorarios Coordinadores de Comuna', category: 'Nómina Campo', amount: 45000000, date: '2026-02-01', status: 'Pagado' },
      { id: 'PAY-102', concept: 'Servicios Servidores Cloud & API OCR', category: 'Tecnología', amount: 8200000, date: '2026-02-05', status: 'Pagado' },
      { id: 'PAY-103', concept: 'Logística de Transporte Día E', category: 'Operación Electoral', amount: 32000000, date: '2026-02-06', status: 'Aprobado' }
    ],
    auditLogs: [
      { id: 'LOG-801', action: 'Cambio de Permisos RBAC', user: 'Dra. María Paula Restrepo', timestamp: '2026-08-06 20:30', details: 'Nivel 10 habilitado para módulo E-14' },
      { id: 'LOG-802', action: 'Verificación SHA-256', user: 'Sistema Automático', timestamp: '2026-08-06 21:15', details: 'Base de datos sincronizada sin errores' }
    ],
    systemSettings: {
      maintenanceMode: false,
      apiRateLimit: 1200,
      sha256Verification: true
    }
  },
  strategic: {
    dafoEntries: [
      { id: 'DAF-01', type: 'Fortaleza', description: 'Consolidación de votación en Comunas 2, 17 y 19 con 42% intención de voto.', impact: 'Alto', status: 'Activo' },
      { id: 'DAF-02', type: 'Oportunidad', description: 'Capta de votantes independientes tras debate televisado regional.', impact: 'Muy Alto', status: 'En Proceso' },
      { id: 'DAF-03', type: 'Amenaza', description: 'Campaña sucia en redes sociales sobre propuestas de movilidad.', impact: 'Medio', status: 'Mitigado' }
    ],
    budgets: [
      { id: 'STR-B01', title: 'Publicidad Digital & Redes Sociales', allocated: 120000000, executed: 84000000, department: 'Comunicaciones' },
      { id: 'STR-B02', title: 'Encuestas & Tracking Telefónico', allocated: 65000000, executed: 42000000, department: 'Investigación Electoral' },
      { id: 'STR-B03', title: 'Giras Municipales y Eventos Masivos', allocated: 180000000, executed: 125000000, department: 'Dirección Estratégica' }
    ],
    aiNotes: [
      { id: 'NTE-01', topic: 'Discurso Cierre de Precampaña', content: 'Énfasis en seguridad urbana, reactivación económica y control transparente de presupuestos.', date: '2026-08-05' }
    ],
    candidateProfile: {
      name: 'Dra. María Paula Restrepo',
      cedula: '1085294312',
      pseudonym: 'María Paula "La Doctora del Pueblo"',
      profession: 'Abogada Especialista en Derecho Público y Gestión Territorial',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
      phone: '+57 310 892 4021',
      email: 'maria.restrepo@campanaganadora.co',
      slogan: 'Unidos por el Progreso, la Seguridad y el Futuro de Nuestra Ciudad',
      bio: 'Líder social con más de 15 años de experiencia en la administración pública, defensora de la transparencia institucional y el desarrollo económico incluyente.',
      party: 'Movimiento Político Fuerza Ciudadana',
      numberOnBallot: 'N° 101',
      socialMedia: {
        whatsapp: 'https://wa.me/573108924021',
        facebook: 'https://facebook.com/mariapaula.restrepo.oficial',
        instagram: 'https://instagram.com/mariapaularestrepo',
        twitter: 'https://x.com/mrestrepo2026',
        tiktok: 'https://tiktok.com/@mariapaularestrepo',
        youtube: 'https://youtube.com/@mariapaulaoficial',
        website: 'https://mariapaularestrepo.co'
      }
    }
  },
  territorial: {
    voters: [
      { id: 'VOT-001', name: 'Carlos Eduardo Gómez', cedula: '1085294312', puesto: 'INEM Jorge Isaacs', mesa: 'Mesa 18', leaderName: 'Líder Fernando Torres', status: 'Confirmado' },
      { id: 'VOT-002', name: 'Ana Lucía Bermúdez', cedula: '31942081', puesto: 'Colegio Santa Librada', mesa: 'Mesa 05', leaderName: 'Líder Fernando Torres', status: 'Confirmado' },
      { id: 'VOT-003', name: 'Jorge Ignacio Valencia', cedula: '16789423', puesto: 'SENA Salomia', mesa: 'Mesa 12', leaderName: 'Líder Beatriz Morales', status: 'Pendiente Movilización' }
    ],
    e14Actas: [
      { id: 'E14-101', mesa: 'Mesa 18', puesto: 'INEM Jorge Isaacs', votosCandidato: 184, votosOponente: 92, nulos: 3, status: 'Verificada OCR', timestamp: '2026-08-06 17:40' },
      { id: 'E14-102', mesa: 'Mesa 05', puesto: 'Colegio Santa Librada', votosCandidato: 210, votosOponente: 88, nulos: 2, status: 'Verificada OCR', timestamp: '2026-08-06 17:45' }
    ],
    witnesses: [
      { id: 'WIT-01', name: 'Capitán Fernando Torres', puesto: 'INEM Jorge Isaacs', mesa: 'Mesa 18', phone: '3104829102', geofenceVerified: true, batteryPct: 94 },
      { id: 'WIT-02', name: 'Beatriz Morales', puesto: 'SENA Salomia', mesa: 'Mesa 12', phone: '3159201923', geofenceVerified: true, batteryPct: 88 },
      { id: 'WIT-03', name: 'Héctor Fabio Ramírez', puesto: 'Coliseo del Pueblo', mesa: 'Mesa 01', phone: '3001829301', geofenceVerified: false, batteryPct: 45 }
    ]
  },
  saas: {
    clients: [
      { id: 'CLI-101', name: 'Campaña María Paula Restrepo', email: 'contacto@restrepomaria.co', phone: '+57 310 892 4021', status: 'Activo', plan: 'Enterprise Master', joinedDate: '2026-01-10' },
      { id: 'CLI-102', name: 'Alcaldía de Rionegro Progresa', email: 'alcaldia@rionegro.gov.co', phone: '+57 312 405 9182', status: 'Activo', plan: 'Pro AI', joinedDate: '2026-02-15' },
      { id: 'CLI-103', name: 'Campaña Medellín Segura 2026', email: 'contacto@medellinsegura.co', phone: '+57 301 928 4029', status: 'Suspendido', plan: 'Starter', joinedDate: '2026-03-01' },
      { id: 'CLI-104', name: 'Gobernación del Valle Ganadora', email: 'contacto@valleganadora.com', phone: '+57 315 293 8402', status: 'Inactivo', plan: 'Enterprise Master', joinedDate: '2026-04-10' }
    ],
    licenses: [
      { id: 'LIC-201', clientName: 'Campaña María Paula Restrepo', planName: 'Enterprise Master', code: 'LIC-RESTREPO-ENTERPRISE-2026-99A', startDate: '2026-01-10', expirationDate: '2026-11-30', status: 'Activa', maxUsers: 150, modules: ['gestion_estrategica', 'gestion_territorial', 'modulo_admin', 'testigo_campo', 'encuestas', 'jurado_campo', 'presupuesto', 'pruebas_electorales'] },
      { id: 'LIC-202', clientName: 'Alcaldía de Rionegro Progresa', planName: 'Pro AI', code: 'LIC-RIONEGRO-PROAI-2026-12C', startDate: '2026-02-15', expirationDate: '2026-12-31', status: 'Activa', maxUsers: 50, modules: ['gestion_estrategica', 'gestion_territorial', 'encuestas', 'presupuesto'] },
      { id: 'LIC-203', clientName: 'Campaña Medellín Segura 2026', planName: 'Starter', code: 'LIC-MEDELLIN-STARTER-2026-88F', startDate: '2026-03-01', expirationDate: '2026-06-30', status: 'Suspendida', maxUsers: 10, modules: ['gestion_territorial', 'testigo_campo'] },
      { id: 'LIC-204', clientName: 'Gobernación del Valle Ganadora', planName: 'Enterprise Master', code: 'LIC-VALLE-ENTERPRISE-2026-04D', startDate: '2026-04-10', expirationDate: '2026-10-31', status: 'Vencida', maxUsers: 200, modules: ['gestion_estrategica', 'gestion_territorial', 'modulo_admin', 'testigo_campo', 'encuestas', 'jurado_campo', 'presupuesto'] }
    ],
    subscriptions: [
      { id: 'SUB-301', clientName: 'Campaña María Paula Restrepo', planName: 'Enterprise Master', status: 'Activo', billingCycle: 'Anual', nextRenewal: '2026-11-30', mrr: 2500 },
      { id: 'SUB-302', clientName: 'Alcaldía de Rionegro Progresa', planName: 'Pro AI', status: 'Activo', billingCycle: 'Mensual', nextRenewal: '2026-09-15', mrr: 850 },
      { id: 'SUB-303', clientName: 'Campaña Medellín Segura 2026', planName: 'Starter', status: 'Vencido', billingCycle: 'Mensual', nextRenewal: '2026-07-01', mrr: 150 },
      { id: 'SUB-304', clientName: 'Gobernación del Valle Ganadora', planName: 'Enterprise Master', status: 'Pendiente', billingCycle: 'Anual', nextRenewal: '2026-10-31', mrr: 2500 }
    ],
    plans: [
      { id: 'PLN-01', name: 'Starter', price: 150, duration: 'Mensual', maxUsers: 10, modules: ['gestion_territorial', 'testigo_campo'], status: 'Activo' },
      { id: 'PLN-02', name: 'Pro AI', price: 850, duration: 'Mensual', maxUsers: 50, modules: ['gestion_estrategica', 'gestion_territorial', 'encuestas', 'presupuesto'], status: 'Activo' },
      { id: 'PLN-03', name: 'Enterprise Master', price: 2500, duration: 'Mensual', maxUsers: 200, modules: ['gestion_estrategica', 'gestion_territorial', 'modulo_admin', 'testigo_campo', 'encuestas', 'jurado_campo', 'presupuesto', 'pruebas_electorales'], status: 'Activo' }
    ],
    auditLogs: [
      { id: 'SALOG-001', action: 'Acceso Superadmin', user: 'Superadmin Principal', timestamp: '2026-08-14 20:30', details: 'Inicio de sesión en Panel de Administración SaaS', client: 'TECHNEO Platform' },
      { id: 'SALOG-002', action: 'Renovación de Licencia', user: 'Soporte TECHNEO', timestamp: '2026-08-14 18:15', details: 'Se renovó la licencia de Campaña María Paula Restrepo por un periodo adicional', client: 'Campaña María Paula Restrepo' }
    ]
  }
};

// Helper: Read DB
function getDb(): DatabaseSchema {
  try {
    // Cloudflare Pages Workers do not have file system access.
    if (process.env.CF_PAGES || typeof (process as any).env?.CF_PAGES !== 'undefined' || typeof (globalThis as any).caches === 'object') {
      return initialDbData;
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDbData, null, 2), 'utf-8');
      return initialDbData;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as any;
    parsed.admin.users = (parsed.admin?.users || []).map((user: any) => {
      const { passwordHash: _retiredCredential, ...safeUser } = user;
      return safeUser;
    });
    return parsed as DatabaseSchema;
  } catch (err) {
    console.error('Error reading database file:', err);
    return initialDbData;
  }
}

// Helper: Save DB
function saveDb(data: DatabaseSchema): void {
  try {
    if (process.env.CF_PAGES || typeof (process as any).env?.CF_PAGES !== 'undefined' || typeof (globalThis as any).caches === 'object') {
      return;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

const app = express();
const verifierUrl = (process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const verifierKey = String(
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim().replace(/^['"]|['"]$/g, '');
const supabaseVerifier = verifierUrl && verifierKey
  ? createClient(verifierUrl, verifierKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function verifyGlobalOwner(accessToken: string) {
  if (!supabaseVerifier || !supabaseAdmin || !accessToken) return null;
  const { data: requester, error } = await supabaseVerifier.auth.getUser(accessToken);
  if (error || !requester.user) return null;
  const { data: adminProfile } = await supabaseAdmin
    .from('profiles')
    .select('role,status')
    .eq('id', requester.user.id)
    .maybeSingle();
  const scopedClient = createClient(verifierUrl, verifierKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
  let profile = adminProfile;
  if (!profile) {
    const { data: scopedProfile } = await scopedClient
      .from('profiles')
      .select('role,status')
      .eq('id', requester.user.id)
      .maybeSingle();
    profile = scopedProfile;
  }
  if (!profile) return null;
  const normalizedRole = String(profile.role || '').trim().toUpperCase();
  const normalizedStatus = String(profile.status || '').trim().toUpperCase();
  const isOwner = ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(normalizedRole);
  const isActive = ['ACTIVE', 'ACTIVO'].includes(normalizedStatus);
  return isOwner && isActive ? requester.user : null;
}

async function startAppServer(shouldListen = true) {
  app.use(express.json({ limit: '15mb' }));

  // Legacy administrative endpoints must fail closed just like the primary
  // Global Admin API. A verified active owner profile is required.
  const requireGlobalOwnerRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const bearer = req.headers.authorization || '';
    const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!accessToken) {
      return res.status(401).json({ error: 'Sesión de propietario global requerida.' });
    }
    try {
      const requester = await verifyGlobalOwner(accessToken);
      if (!requester) {
        return res.status(403).json({ error: 'Sesión inválida o sin permisos de propietario global.' });
      }
      return next();
    } catch {
      return res.status(503).json({ error: 'No fue posible validar la sesión administrativa.' });
    }
  };

  const requireActiveSupabaseRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const bearer = req.headers.authorization || '';
    const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!accessToken) return res.status(401).json({ error: 'Sesión Supabase requerida.' });

    const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const publicKey = String(
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
    ).trim().replace(/^['"]|['"]$/g, '');
    if (!supabaseUrl || !publicKey) return res.status(503).json({ error: 'Supabase Auth no está configurado.' });

    try {
      const authClient = createClient(supabaseUrl, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
      });
      const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
      if (userError || !userData.user) return res.status(401).json({ error: 'Sesión Supabase inválida.' });

      const profileClient = supabaseAdmin || authClient;
      const { data: profile, error: profileError } = await profileClient
        .from('profiles')
        .select('id,status')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (profileError || !profile || !['ACTIVE', 'ACTIVO'].includes(String(profile.status || '').toUpperCase())) {
        return res.status(403).json({ error: 'La cuenta no tiene un perfil activo.' });
      }
      return next();
    } catch {
      return res.status(503).json({ error: 'No fue posible validar la sesión.' });
    }
  };

  app.use(
    [
      '/api/admin',
      '/api/saas',
      '/api/territorial',
      '/api/strategic/dafo',
      '/api/strategic/budget',
      '/api/strategic/candidate'
    ],
    requireGlobalOwnerRequest
  );
  app.use('/api/strategic', requireActiveSupabaseRequest);

  // Initialize Gemini AI client server-side if key exists
  let aiClient: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('Gemini client initialization warning:', e);
    }
  }

  // InstantDB App ID Configuration API
  app.get('/api/instantdb-config', (req, res) => {
    const appId = process.env.INSTANTDB_APP_ID || '';
    res.json({
      appId,
      status: appId ? 'online' : 'not_configured',
      syncEnabled: Boolean(appId)
    });
  });

  // Supabase Configuration & Status API with SSL/TLS security
  app.get('/api/supabase-config', (req, res) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
    const publicKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const configured = Boolean(cleanUrl && publicKey);
    res.json({
      supabaseUrl: cleanUrl,
      restEndpoint: configured ? `${cleanUrl}/rest/v1/` : '',
      status: configured ? 'configured' : 'not_configured',
      ssl: configured && cleanUrl.startsWith('https://') ? 'TLS_ENABLED' : 'NOT_AVAILABLE',
      rlsEnabled: configured,
      anonKeyConfigured: Boolean(publicKey),
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================
  // PRIVATE GLOBAL ADMIN API (RESTRICTED & ENCRYPTED)
  // ==========================================
  app.use('/api/global-admin', globalAdminRouter);

  app.post('/api/supabase-admin/campaign-user', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: 'Falta configurar SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
      }

      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      if (!accessToken) return res.status(401).json({ error: 'Sesión administrativa requerida.' });

      const requester = await verifyGlobalOwner(accessToken);
      if (!requester) return res.status(401).json({ error: 'Sesión administrativa inválida o sin permisos de propietario global.' });

      const { email, password, displayName, campaignId } = req.body || {};
      if (!email || !password || !displayName || !campaignId) {
        return res.status(400).json({ error: 'Correo, contraseña, responsable y campaña son obligatorios.' });
      }
      if (String(password).length < 10) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres.' });
      }

      const { data: sourceCampaign, error: sourceCampaignError } = await supabaseAdmin
        .from('campaigns')
        .select('id,client_id')
        .eq('id', campaignId)
        .maybeSingle();
      if (sourceCampaignError || !sourceCampaign) {
        return res.status(404).json({ error: 'La campaña indicada no existe o no está disponible.' });
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true,
        user_metadata: { display_name: displayName, campaign_id: sourceCampaign.id, client_id: sourceCampaign.client_id || null }
      });
      if (createError || !created.user) {
        return res.status(400).json({ error: createError?.message || 'No fue posible crear el usuario.' });
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: created.user.id,
        email: String(email).trim().toLowerCase(),
        display_name: displayName,
        role: 'ADMIN_CLIENTE',
        status: 'ACTIVE',
        client_id: sourceCampaign.client_id || null,
        campaign_id: sourceCampaign.id,
        allowed_modules: ['ADMINISTRATIVE', 'TERRITORY', 'STRATEGY', 'CRM', 'DAY_D'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return res.status(400).json({ error: `No se pudo vincular el perfil: ${profileError.message}` });
      }

      return res.status(201).json({
        success: true,
        user: { id: created.user.id, email: created.user.email, campaignId: sourceCampaign.id }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Error interno al crear el acceso.' });
    }
  });

  app.post('/api/supabase-admin/managed-user', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: 'Falta configurar SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
      }

      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      if (!accessToken) return res.status(401).json({ error: 'Sesión administrativa requerida.' });

      const publicKey = String(
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
      ).trim().replace(/^['"]|['"]$/g, '');
      const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
      if (!supabaseUrl || !publicKey) return res.status(503).json({ error: 'Supabase Auth público no está configurado.' });

      const globalOwner = await verifyGlobalOwner(accessToken);
      let requesterUser = globalOwner;
      if (!requesterUser) {
        const authVerifier = createClient(supabaseUrl, publicKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: requesterData } = await authVerifier.auth.getUser(accessToken);
        requesterUser = requesterData.user;
      }
      if (!requesterUser) return res.status(401).json({ error: 'La sesión administrativa expiró. Inicia sesión nuevamente.' });

      const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id,role,status,client_id,campaign_id')
        .eq('id', requesterUser.id)
        .maybeSingle();
      const requesterRole = String(requesterProfile?.role || '').trim().toUpperCase();
      const requesterStatus = String(requesterProfile?.status || '').trim().toUpperCase();
      if (
        requesterProfileError || !requesterProfile ||
        !['SUPERADMIN', 'GLOBAL_ADMIN', 'ADMIN_CLIENTE', 'ADMINISTRADOR'].includes(requesterRole) ||
        !['ACTIVE', 'ACTIVO'].includes(requesterStatus)
      ) {
        return res.status(403).json({ error: 'Tu cuenta no tiene permisos para crear usuarios.' });
      }

      const { email, password, displayName, role, allowedModules, permissions } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !displayName || !password) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
      }
      if (String(password).length < 10) return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres.' });

      const normalizedRole = ['ADMIN_CLIENTE', 'DIRECTOR', 'COORDINADOR'].includes(String(role || '').toUpperCase())
        ? String(role).toUpperCase()
        : 'ADMIN_CLIENTE';
      let clientId = requesterProfile.client_id || null;
      let campaignId = requesterProfile.campaign_id || null;
      if (!campaignId && clientId) {
        const { data: legacyCampaign } = await supabaseAdmin
          .from('campaigns')
          .select('id,client_id')
          .eq('id', clientId)
          .maybeSingle();
        if (legacyCampaign) {
          campaignId = legacyCampaign.id;
          clientId = legacyCampaign.client_id || null;
        } else {
          const { data: clientCampaigns } = await supabaseAdmin
            .from('campaigns')
            .select('id')
            .eq('client_id', clientId)
            .limit(2);
          if (clientCampaigns?.length === 1) campaignId = clientCampaigns[0].id;
        }
      }
      let targetUser: any = null;
      let createdNow = false;

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { display_name: displayName, role: normalizedRole, client_id: clientId, campaign_id: campaignId }
      });

      if (created?.user) {
        targetUser = created.user;
        createdNow = true;
      } else if ((createError?.message || '').toLowerCase().includes('already')) {
        // A previous browser-side attempt may have created Auth but failed the
        // profile because of RLS. Repair only that orphaned account.
        for (let page = 1; page <= 10 && !targetUser; page += 1) {
          const { data: pageData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
          if (listError) return res.status(400).json({ error: listError.message });
          targetUser = pageData.users.find((user: any) => String(user.email || '').toLowerCase() === normalizedEmail) || null;
          if (pageData.users.length < 100) break;
        }
        if (!targetUser) return res.status(409).json({ error: 'El correo ya existe, pero no fue posible recuperar la cuenta.' });
        const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('id', targetUser.id).maybeSingle();
        if (existingProfile) return res.status(409).json({ error: 'Ya existe un usuario registrado con este correo.' });
        const { error: repairAuthError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
          password: String(password),
          email_confirm: true,
          user_metadata: { display_name: displayName, role: normalizedRole, client_id: clientId, campaign_id: campaignId }
        });
        if (repairAuthError) return res.status(400).json({ error: repairAuthError.message });
      } else {
        return res.status(400).json({ error: createError?.message || 'No fue posible crear el acceso.' });
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: targetUser.id,
        client_id: clientId,
        campaign_id: campaignId,
        email: normalizedEmail,
        display_name: String(displayName).trim(),
        role: normalizedRole,
        status: 'ACTIVE',
        allowed_modules: Array.isArray(allowedModules) ? allowedModules : [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profileError) {
        if (createdNow) await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
        return res.status(400).json({ error: `No se pudo crear el perfil: ${profileError.message}` });
      }

      if (Array.isArray(permissions) && permissions.length) {
        const { error: permissionsError } = await supabaseAdmin.from('user_permissions').insert(
          permissions.map((permission: any) => ({
            user_id: targetUser.id,
            module_code: String(permission.moduleCode || ''),
            function_code: String(permission.functionCode || ''),
            actions: ['ACCESS']
          }))
        );
        if (permissionsError) {
          await supabaseAdmin.from('profiles').delete().eq('id', targetUser.id);
          if (createdNow) await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
          return res.status(400).json({ error: `No se pudieron asignar los permisos: ${permissionsError.message}` });
        }
      }

      return res.status(createdNow ? 201 : 200).json({
        success: true,
        repaired: !createdNow,
        user: { id: targetUser.id, email: normalizedEmail, clientId, campaignId }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Error interno al crear el usuario.' });
    }
  });

  app.post('/api/supabase-admin/campaign-user/:userId/reset-password', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: 'Falta configurar SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
      }

      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const requester = await verifyGlobalOwner(accessToken);
      if (!requester) return res.status(401).json({ error: 'Sesión administrativa inválida o sin permisos de propietario global.' });

      const userId = String(req.params.userId || '').trim();
      if (!userId) return res.status(400).json({ error: 'El usuario es obligatorio.' });

      // Supabase nunca permite leer una contraseña existente. Se genera una
      // credencial temporal nueva y se devuelve únicamente en esta respuesta.
      const temporaryPassword = `Cg#${randomBytes(9).toString('base64url')}9a`;
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        user_metadata: { password_reset_by_global_admin_at: new Date().toISOString() }
      });

      if (error || !data.user) {
        return res.status(400).json({ error: error?.message || 'No fue posible actualizar la contraseña.' });
      }

      return res.json({
        success: true,
        message: 'Contraseña temporal creada. Se mostrará una sola vez.',
        temporaryPassword
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Error interno al actualizar la contraseña.' });
    }
  });

  app.delete('/api/supabase-admin/campaigns/:campaignId', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'Falta configurar SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const requester = await verifyGlobalOwner(accessToken);
      if (!requester) return res.status(401).json({ error: 'Sesión administrativa inválida o sin permisos de propietario global.' });

      const campaignId = req.params.campaignId;
      const { data: linkedProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles').select('id').eq('campaign_id', campaignId);
      if (profilesError) return res.status(400).json({ error: profilesError.message });

      const { error: campaignError } = await supabaseAdmin.from('campaigns').delete().eq('id', campaignId);
      if (campaignError) return res.status(400).json({ error: campaignError.message });

      const deletionResults = await Promise.allSettled(
        (linkedProfiles || []).map((profile: any) => supabaseAdmin.auth.admin.deleteUser(profile.id))
      );
      const failedUsers = deletionResults.filter((result) => result.status === 'rejected').length;
      return res.json({ success: true, deletedUsers: (linkedProfiles || []).length - failedUsers, failedUsers });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'No fue posible eliminar la campaña.' });
    }
  });

  // ==========================================
  // MODULE 1: GESTIÓN ADMINISTRATIVA APIs (ISOLATED)
  // ==========================================
  app.get('/api/admin/users', (req, res) => {
    const db = getDb();
    res.json(db.admin.users);
  });

  app.post('/api/admin/users', (req, res) => {
    const { name, cedula, email, role, accessLevel } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }
    const db = getDb();
    const newUser = {
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      cedula: cedula || `${Math.floor(1000000000 + Math.random() * 90000000)}`,
      email,
      role: role || 'Operador Administrativo',
      accessLevel: accessLevel || 'Nivel 5',
      status: 'Activo',
      createdAt: new Date().toISOString().split('T')[0]
    };
    db.admin.users.push(newUser);
    db.admin.auditLogs.unshift({
      id: `LOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Usuario Creado',
      user: 'Dra. María Paula Restrepo',
      timestamp: new Date().toLocaleString(),
      details: `Creación de usuario: ${name} (${email}) - CC: ${newUser.cedula}`
    });
    saveDb(db);
    res.json(newUser);
  });

  app.patch('/api/admin/users/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDb();
    const user = db.admin.users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    user.status = status || (user.status === 'Activo' ? 'Inactivo' : 'Activo');
    db.admin.auditLogs.unshift({
      id: `LOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Estado de Acceso Modificado',
      user: 'Dra. María Paula Restrepo',
      timestamp: new Date().toLocaleString(),
      details: `Modificación de estado de acceso a usuario: ${user.name} (${user.email}) -> ${user.status}`
    });
    saveDb(db);
    res.json(user);
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    const { id } = req.params;
    const db = getDb();
    db.admin.users = db.admin.users.filter((u) => u.id !== id);
    db.admin.auditLogs.unshift({
      id: `LOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Usuario Eliminado',
      user: 'Dra. María Paula Restrepo',
      timestamp: new Date().toLocaleString(),
      details: `Eliminación de usuario ID: ${id}`
    });
    saveDb(db);
    res.json({ success: true });
  });

  app.get('/api/admin/payroll', (req, res) => {
    const db = getDb();
    res.json(db.admin.payroll);
  });

  app.post('/api/admin/payroll', (req, res) => {
    const { concept, category, amount } = req.body;
    const db = getDb();
    const newItem = {
      id: `PAY-${Math.floor(100 + Math.random() * 900)}`,
      concept: concept || 'Gasto Operativo',
      category: category || 'Logística',
      amount: Number(amount) || 0,
      date: new Date().toISOString().split('T')[0],
      status: 'Pagado'
    };
    db.admin.payroll.unshift(newItem);
    saveDb(db);
    res.json(newItem);
  });

  app.get('/api/admin/logs', (req, res) => {
    const db = getDb();
    res.json(db.admin.auditLogs);
  });

  // ==========================================
  // MODULE 2: GESTIÓN ESTRATÉGICA APIs (ISOLATED)
  // ==========================================
  app.get('/api/strategic/dafo', (req, res) => {
    const db = getDb();
    res.json(db.strategic.dafoEntries);
  });

  app.post('/api/strategic/dafo', (req, res) => {
    const { type, description, impact } = req.body;
    const db = getDb();
    const newEntry = {
      id: `DAF-${Math.floor(10 + Math.random() * 90)}`,
      type: type || 'Fortaleza',
      description: description || 'Nuevo punto estratégico identificado',
      impact: impact || 'Alto',
      status: 'Activo'
    };
    db.strategic.dafoEntries.unshift(newEntry);
    saveDb(db);
    res.json(newEntry);
  });

  app.delete('/api/strategic/dafo/:id', (req, res) => {
    const { id } = req.params;
    const db = getDb();
    db.strategic.dafoEntries = db.strategic.dafoEntries.filter((d) => d.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  app.get('/api/strategic/budget', (req, res) => {
    const db = getDb();
    res.json(db.strategic.budgets);
  });

  app.post('/api/strategic/budget', (req, res) => {
    const { title, allocated, executed, department } = req.body;
    const db = getDb();
    const newBudget = {
      id: `STR-B${Math.floor(10 + Math.random() * 90)}`,
      title: title || 'Nueva Línea Presupuestaria',
      allocated: Number(allocated) || 0,
      executed: Number(executed) || 0,
      department: department || 'Estrategia'
    };
    db.strategic.budgets.push(newBudget);
    saveDb(db);
    res.json(newBudget);
  });

  app.get('/api/strategic/candidate', (req, res) => {
    const db = getDb();
    res.json(db.strategic.candidateProfile || {});
  });

  app.post('/api/strategic/candidate', (req, res) => {
    const db = getDb();
    db.strategic.candidateProfile = {
      ...db.strategic.candidateProfile,
      ...req.body
    };
    saveDb(db);
    res.json(db.strategic.candidateProfile);
  });

  app.post('/api/strategic/cv-upload', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'El almacenamiento privado no está configurado en el servidor.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId, storagePath, fileName, mimeType, fileBase64 } = req.body || {};
      if (!campaignId || !storagePath || !fileBase64 || !String(storagePath).startsWith(`${campaignId}/candidate-cv/`)) {
        return res.status(400).json({ error: 'Documento o campaña inválidos.' });
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(String(mimeType)) && !/\.(pdf|docx|doc)$/i.test(String(fileName))) {
        return res.status(400).json({ error: 'Solo se permiten documentos PDF, DOCX o DOC.' });
      }
      const bytes = Buffer.from(String(fileBase64), 'base64');
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'El documento es inválido o supera 10 MB.' });
      const [{ data: profile }, { data: campaign }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id').eq('id', campaignId).maybeSingle(),
      ]);
      const authorized = Boolean(campaign && profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized) return res.status(403).json({ error: 'No tiene acceso al expediente de esta campaña.' });
      const { error: bucketError } = await supabaseAdmin.storage.createBucket('campaign-documents', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: allowedTypes,
      });
      if (bucketError && !/already exists|duplicate/i.test(bucketError.message || '')) throw bucketError;
      const { error: uploadError } = await supabaseAdmin.storage.from('campaign-documents').upload(String(storagePath), bytes, {
        contentType: String(mimeType || 'application/octet-stream'),
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      return res.status(201).json({ success: true, storagePath });
    } catch (error: any) {
      console.error('CV upload failed:', error);
      return res.status(500).json({ error: error?.message || 'No fue posible almacenar la hoja de vida.' });
    }
  });

  app.post('/api/strategic/media-upload', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'El almacenamiento privado no está configurado.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId, storagePath, fileName, mimeType, fileBase64 } = req.body || {};
      if (!campaignId || !storagePath || !fileBase64 || !String(storagePath).startsWith(`${campaignId}/communications/`)) return res.status(400).json({ error: 'Archivo o campaña inválidos.' });
      const isAllowed = /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(String(mimeType)) || /^video\/(mp4|quicktime|webm)$/.test(String(mimeType));
      if (!isAllowed) return res.status(400).json({ error: `${fileName || 'El archivo'} no tiene un formato permitido.` });
      const bytes = Buffer.from(String(fileBase64), 'base64');
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'El archivo es inválido o supera 10 MB.' });
      const [{ data: profile }, { data: campaign }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id').eq('id', campaignId).maybeSingle(),
      ]);
      const authorized = Boolean(campaign && profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized) return res.status(403).json({ error: 'No tiene acceso a esta campaña.' });
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/quicktime', 'video/webm'];
      const { error: bucketError } = await supabaseAdmin.storage.createBucket('campaign-media', { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes });
      if (bucketError && !/already exists|duplicate/i.test(bucketError.message || '')) throw bucketError;
      const { error: uploadError } = await supabaseAdmin.storage.from('campaign-media').upload(String(storagePath), bytes, { contentType: String(mimeType), cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      return res.status(201).json({ success: true, storagePath });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'No fue posible almacenar el archivo.' });
    }
  });

  app.post('/api/strategic/media-sign', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'El almacenamiento privado no está configurado.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId, storagePath } = req.body || {};
      if (!campaignId || !storagePath || !String(storagePath).startsWith(`${campaignId}/communications/`)) return res.status(400).json({ error: 'Archivo inválido.' });
      const [{ data: profile }, { data: campaign }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id').eq('id', campaignId).maybeSingle(),
      ]);
      const authorized = Boolean(campaign && profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized) return res.status(403).json({ error: 'No tiene acceso a esta campaña.' });
      const { data, error } = await supabaseAdmin.storage.from('campaign-media').createSignedUrl(String(storagePath), 3600);
      if (error) throw error;
      return res.json({ signedUrl: data.signedUrl });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'No fue posible consultar el archivo.' });
    }
  });

  app.post('/api/strategic/cv-analyze', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'El almacenamiento privado no está configurado en el servidor.' });
      if (!aiClient || !process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'El análisis de documentos con IA no está configurado.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      if (!accessToken) return res.status(401).json({ error: 'Sesión requerida.' });
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId, storagePath } = req.body || {};
      if (!campaignId || !storagePath || !String(storagePath).startsWith(`${campaignId}/candidate-cv/`)) {
        return res.status(400).json({ error: 'Documento o campaña inválidos.' });
      }
      const [{ data: profile }, { data: campaign }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id').eq('id', campaignId).maybeSingle(),
      ]);
      const authorized = Boolean(campaign && profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized) return res.status(403).json({ error: 'No tiene acceso al expediente de esta campaña.' });
      const { data: document, error: downloadError } = await supabaseAdmin.storage.from('campaign-documents').download(String(storagePath));
      if (downloadError || !document) return res.status(404).json({ error: downloadError?.message || 'No se encontró el documento.' });
      const bytes = Buffer.from(await document.arrayBuffer());
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: document.type || 'application/pdf', data: bytes.toString('base64') } },
            { text: `Extrae únicamente información explícita y verificable de esta hoja de vida. No inventes, completes ni infieras datos. Devuelve exclusivamente JSON válido con esta estructura: {"academicDegrees":[{"title":"","institution":"","year":"","level":"Pregrado|Posgrado|Maestría|Doctorado|Diplomado"}],"experienceItems":[{"role":"","entityCompany":"","period":"","achievements":"","type":"Público|Privado|Político/Social"}],"financialDeclaration":{"totalAssets":0,"totalLiabilities":0,"netWorth":0,"taxReturnYear":"","declarationStatus":""}}. Si un dato no aparece, usa una lista vacía, cero o texto vacío. No declares antecedentes, habilitación CNE ni validaciones oficiales a partir de una hoja de vida.` },
          ],
        }],
      });
      const raw = String(response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(raw);
      return res.json({
        academicDegrees: Array.isArray(parsed.academicDegrees) ? parsed.academicDegrees : [],
        experienceItems: Array.isArray(parsed.experienceItems) ? parsed.experienceItems : [],
        financialDeclaration: parsed.financialDeclaration || { totalAssets: 0, totalLiabilities: 0, netWorth: 0, taxReturnYear: '', declarationStatus: '' },
        backgroundChecks: { procuraduria: '', contraloria: '', fiscalia: '', cneStatus: '', verifiedDate: '' },
      });
    } catch (error: any) {
      console.error('CV analysis failed:', error);
      return res.status(500).json({ error: error?.message || 'No fue posible analizar la hoja de vida.' });
    }
  });

  app.post('/api/strategic/content-generate', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'La base de datos privada no está configurada.' });
      if (!aiClient || !process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'La generación con IA no está configurada.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId, topic, platform, tone, targetAudience, keyHighlight } = req.body || {};
      if (!campaignId || !String(topic || '').trim()) return res.status(400).json({ error: 'Campaña y tema son obligatorios.' });
      const [{ data: profile }, { data: campaign }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,descripcion').eq('id', campaignId).maybeSingle(),
      ]);
      const authorized = Boolean(campaign && profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized || !campaign) return res.status(403).json({ error: 'No tiene acceso a esta campaña.' });
      let description: any = {};
      try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }
      const evidence = {
        candidate: campaign.candidato_nombre,
        office: campaign.cargo_postulacion,
        territory: [campaign.municipio, campaign.departamento].filter(Boolean).join(', '),
        profile: description.candidateProfile || {},
        narrative: description.strategicIdentity || {},
        governmentProgram: description.governmentProgram || description.programaGobierno || {},
      };
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Crea una pieza de comunicación electoral en español para la plataforma indicada, utilizando solamente los datos comprobables aportados. No inventes cifras, alianzas, logros, encuestas, comunas ni propuestas. Si la solicitud incluye un dato sin respaldo, omítelo. Devuelve solo JSON válido: {"hook":"","caption":"","videoScript":"","hashtags":string[],"callToAction":""}. Plataforma: ${platform}. Tono: ${tone}. Tema solicitado: ${topic}. Audiencia declarada: ${targetAudience || 'no especificada'}. Punto destacado: ${keyHighlight || 'no especificado'}. EVIDENCIA REAL: ${JSON.stringify(evidence).slice(0, 50000)}`,
      });
      const raw = String(response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(raw);
      return res.json({
        hook: String(parsed.hook || ''), caption: String(parsed.caption || ''),
        videoScript: String(parsed.videoScript || ''),
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((tag: any) => typeof tag === 'string') : [],
        callToAction: String(parsed.callToAction || ''),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'No fue posible generar el contenido.' });
    }
  });

  app.post('/api/strategic/swot-generate', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'La base de datos privada no está configurada en el servidor.' });
      if (!aiClient || !process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'La generación con IA no está configurada.' });
      const bearer = req.headers.authorization || '';
      const accessToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData.user) return res.status(401).json({ error: 'Sesión inválida o vencida.' });
      const { campaignId } = req.body || {};
      if (!campaignId) return res.status(400).json({ error: 'Seleccione una campaña activa.' });
      const [{ data: profile }, { data: campaign, error: campaignError }] = await Promise.all([
        supabaseAdmin.from('profiles').select('client_id,campaign_id').eq('id', authData.user.id).maybeSingle(),
        supabaseAdmin.from('campaigns').select('id,client_id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,meta_votos,presupuesto_total,descripcion').eq('id', campaignId).maybeSingle(),
      ]);
      if (campaignError || !campaign) return res.status(404).json({ error: 'No se encontró la campaña activa.' });
      const authorized = Boolean(profile && (String(profile.campaign_id || '') === String(campaign.id) || String(profile.client_id || '') === String(campaign.client_id || '')));
      if (!authorized) return res.status(403).json({ error: 'No tiene acceso a esta campaña.' });
      let description: any = {};
      try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }
      const evidence = {
        campaign: {
          name: campaign.nombre,
          candidate: campaign.candidato_nombre,
          office: campaign.cargo_postulacion,
          department: campaign.departamento,
          municipality: campaign.municipio,
          constituency: campaign.circunscripcion,
          voteGoal: campaign.meta_votos,
          budget: campaign.presupuesto_total,
        },
        candidateProfile: description.candidateProfile || {},
        candidateCv: description.candidateCv || {},
        territorialDiagnosis: description.territorialDiagnosis || description.diagnosticoTerritorial || {},
        campaignDiagnosis: description.campaignDiagnosis || description.diagnostico || {},
        governmentProgram: description.governmentProgram || description.programaGobierno || {},
      };
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Actúa como analista electoral. Construye una matriz DOFA usando exclusivamente la evidencia JSON proporcionada. No inventes encuestas, competidores, apoyos, antecedentes, porcentajes, logros ni condiciones territoriales. Si no existe evidencia suficiente para una categoría, devuelve esa lista vacía. Las fortalezas y debilidades deben derivarse de recursos internos comprobables; oportunidades y amenazas, de diagnósticos externos registrados. Devuelve únicamente JSON válido con {"strengths":string[],"weaknesses":string[],"opportunities":string[],"threats":string[]}. Máximo 6 factores breves por categoría. EVIDENCIA: ${JSON.stringify(evidence).slice(0, 60000)}`,
      });
      const raw = String(response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(raw);
      return res.json({
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item: any) => typeof item === 'string' && item.trim()) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((item: any) => typeof item === 'string' && item.trim()) : [],
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.filter((item: any) => typeof item === 'string' && item.trim()) : [],
        threats: Array.isArray(parsed.threats) ? parsed.threats.filter((item: any) => typeof item === 'string' && item.trim()) : [],
      });
    } catch (error: any) {
      console.error('SWOT generation failed:', error);
      return res.status(500).json({ error: error?.message || 'No fue posible generar la matriz DOFA.' });
    }
  });

  // Gemini AI Strategic Diagnostic Server Route
  app.post('/api/strategic/ai-diagnose', async (req, res) => {
    const { prompt } = req.body;
    const db = getDb();

    try {
      if (aiClient && process.env.GEMINI_API_KEY) {
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Eres el Asistente de Estrategia Electoral AI para Campaña Ganadora en Colombia. Responde de manera profesional, estructurada y precisa sobre el siguiente tema de campaña: "${prompt}". Incluye diagnóstico DAFO, recomendación para coordinadores y propuesta de movilización.`
        });
        const aiText = response.text || 'Respuesta de análisis estratégico generada correctamente.';
        return res.json({ response: aiText });
      }
    } catch (e) {
      console.error('Gemini API call failed, using internal strategy engine fallback:', e);
    }

    // Fallback strategy generator based on DAFO data in strategic module
    const dafoCount = db.strategic.dafoEntries.length;
    const totalBudget = db.strategic.budgets.reduce((acc, b) => acc + b.allocated, 0);
    const fallbackText = 
      `📊 DIAGNÓSTICO ESTRATÉGICO IA (CAMPAÑA GANADORA):\n` +
      `• Análisis de Solicitud: "${prompt}"\n` +
      `• Elementos DAFO Activos: ${dafoCount} hallazgos registrados en matriz de riesgo.\n` +
      `• Asignación Presupuestaria Estratégica: $${totalBudget.toLocaleString('es-CO')} COP.\n` +
      `• Recomendación Táctica: Intensificar movilización territorial en puestos clave con cobertura >90% e implementar piezas digitales focalizadas.`;

    res.json({ response: fallbackText });
  });

  // ==========================================
  // MODULE 3: GESTIÓN TERRITORIAL APIs (ISOLATED)
  // ==========================================
  app.get('/api/territorial/voters', (req, res) => {
    const db = getDb();
    res.json(db.territorial.voters);
  });

  app.post('/api/territorial/voters', (req, res) => {
    const { name, cedula, puesto, mesa, leaderName } = req.body;
    const db = getDb();

    // Check strict duplicate CC constraint inside campaign
    const existing = db.territorial.voters.find((v) => v.cedula === cedula);
    if (existing) {
      return res.status(400).json({ 
        error: `DUPLICIDAD DETECTADA: La cédula ${cedula} ya fue asignada previamente al líder "${existing.leaderName}".` 
      });
    }

    const newVoter = {
      id: `VOT-${Math.floor(100 + Math.random() * 900)}`,
      name: name || 'Votante Registrado',
      cedula,
      puesto: puesto || 'INEM Jorge Isaacs',
      mesa: mesa || 'Mesa 01',
      leaderName: leaderName || 'Líder Capitán Fernando Torres',
      status: 'Confirmado'
    };

    db.territorial.voters.unshift(newVoter);
    saveDb(db);
    res.json(newVoter);
  });

  // Dedicated voter lookup endpoint for database & external API integration
  app.get('/api/territorial/voters/lookup', (req, res) => {
    const { cedula, query } = req.query;
    const searchTerm = (cedula || query || '').toString().trim().toLowerCase();
    const db = getDb();

    if (!searchTerm) {
      return res.status(400).json({ error: 'Parámetro de búsqueda de cédula requerido.' });
    }

    const match = db.territorial.voters.find(
      (v) => v.cedula === searchTerm || v.name.toLowerCase().includes(searchTerm)
    );

    if (match) {
      return res.json({
        found: true,
        voter: match
      });
    }

    return res.json({
      found: false,
      message: 'No se encontró en base de datos local. Listo para consulta en API externa.'
    });
  });

  app.get('/api/territorial/e14', (req, res) => {
    const db = getDb();
    res.json(db.territorial.e14Actas);
  });

  app.post('/api/territorial/e14', (req, res) => {
    const { mesa, puesto, votosCandidato, votosOponente, nulos } = req.body;
    const db = getDb();
    const newActa = {
      id: `E14-${Math.floor(100 + Math.random() * 900)}`,
      mesa: mesa || 'Mesa 01',
      puesto: puesto || 'INEM Jorge Isaacs',
      votosCandidato: Number(votosCandidato) || 0,
      votosOponente: Number(votosOponente) || 0,
      nulos: Number(nulos) || 0,
      status: 'Verificada OCR',
      timestamp: new Date().toLocaleString()
    };
    db.territorial.e14Actas.unshift(newActa);
    saveDb(db);
    res.json(newActa);
  });

  app.get('/api/territorial/witnesses', (req, res) => {
    const db = getDb();
    res.json(db.territorial.witnesses);
  });

  app.post('/api/territorial/witnesses', (req, res) => {
    const { name, puesto, mesa, phone } = req.body;
    const db = getDb();
    const newWitness = {
      id: `WIT-${Math.floor(10 + Math.random() * 90)}`,
      name: name || 'Nuevo Testigo E-14',
      puesto: puesto || 'INEM Jorge Isaacs',
      mesa: mesa || 'Mesa 01',
      phone: phone || '3000000000',
      geofenceVerified: true,
      batteryPct: 95
    };
    db.territorial.witnesses.unshift(newWitness);
    saveDb(db);
    res.json(newWitness);
  });

  // ==========================================
  // MODULE 4: SAAS ADMIN PANEL APIs (ISOLATED)
  // ==========================================
  app.get('/api/saas/clients', (req, res) => {
    const db = getDb();
    res.json(db.saas?.clients || []);
  });

  app.post('/api/saas/clients', (req, res) => {
    const { name, email, phone, plan } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos.' });
    }
    const db = getDb();
    if (!db.saas) db.saas = { clients: [], licenses: [], subscriptions: [], plans: [], auditLogs: [] };
    
    const newClient = {
      id: `CLI-${Math.floor(100 + Math.random() * 900)}`,
      name,
      email,
      phone: phone || '',
      status: 'Activo' as const,
      plan: plan || 'Starter',
      joinedDate: new Date().toISOString().split('T')[0]
    };
    db.saas.clients.push(newClient);
    
    // Auto-create a license and subscription for this client
    const newLicense = {
      id: `LIC-${Math.floor(100 + Math.random() * 900)}`,
      clientName: name,
      planName: plan || 'Starter',
      code: `LIC-${name.toUpperCase().replace(/\s+/g, '-')}-${Math.floor(100 + Math.random() * 900)}`,
      startDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      status: 'Activa' as const,
      maxUsers: plan === 'Enterprise Master' ? 150 : plan === 'Pro AI' ? 50 : 10,
      modules: plan === 'Enterprise Master' 
        ? ['gestion_estrategica', 'gestion_territorial', 'modulo_admin', 'testigo_campo', 'encuestas', 'jurado_campo', 'presupuesto', 'pruebas_electorales']
        : plan === 'Pro AI' 
          ? ['gestion_estrategica', 'gestion_territorial', 'encuestas', 'presupuesto']
          : ['gestion_territorial', 'testigo_campo']
    };
    db.saas.licenses.push(newLicense);

    const newSub = {
      id: `SUB-${Math.floor(100 + Math.random() * 900)}`,
      clientName: name,
      planName: plan || 'Starter',
      status: 'Activo' as const,
      billingCycle: 'Mensual' as const,
      nextRenewal: newLicense.expirationDate,
      mrr: plan === 'Enterprise Master' ? 2500 : plan === 'Pro AI' ? 850 : 150
    };
    db.saas.subscriptions.push(newSub);

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Cliente Creado',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `SaaS Client creado: ${name}. Plan: ${plan}. Licencia & suscripción auto-creadas.`,
      client: name
    });

    saveDb(db);
    res.json(newClient);
  });

  app.patch('/api/saas/clients/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, phone, status, plan } = req.body;
    const db = getDb();
    if (!db.saas) return res.status(404).json({ error: 'SaaS DB no inicializado' });
    
    const clientIndex = db.saas.clients.findIndex(c => c.id === id);
    if (clientIndex === -1) return res.status(404).json({ error: 'Cliente no encontrado' });
    
    const client = db.saas.clients[clientIndex];
    if (name) client.name = name;
    if (email) client.email = email;
    if (phone) client.phone = phone;
    if (status) client.status = status;
    if (plan) client.plan = plan;

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Cliente Actualizado',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `Cliente ${client.name} actualizado. Status: ${client.status}, Plan: ${client.plan}.`,
      client: client.name
    });

    saveDb(db);
    res.json(client);
  });

  app.get('/api/saas/licenses', (req, res) => {
    const db = getDb();
    res.json(db.saas?.licenses || []);
  });

  app.post('/api/saas/licenses', (req, res) => {
    const { clientName, planName, expirationDate, maxUsers, modules } = req.body;
    const db = getDb();
    if (!db.saas) db.saas = { clients: [], licenses: [], subscriptions: [], plans: [], auditLogs: [] };

    const newLicense = {
      id: `LIC-${Math.floor(100 + Math.random() * 900)}`,
      clientName: clientName || 'Nuevo Cliente',
      planName: planName || 'Starter',
      code: `LIC-${(clientName || 'NEW').toUpperCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`,
      startDate: new Date().toISOString().split('T')[0],
      expirationDate: expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Activa' as const,
      maxUsers: Number(maxUsers) || 10,
      modules: modules || ['gestion_territorial']
    };
    db.saas.licenses.push(newLicense);

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Licencia Creada',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `Nueva licencia creada para ${clientName}. Vence: ${newLicense.expirationDate}.`,
      client: clientName
    });

    saveDb(db);
    res.json(newLicense);
  });

  app.patch('/api/saas/licenses/:id', (req, res) => {
    const { id } = req.params;
    const { status, expirationDate, maxUsers, modules } = req.body;
    const db = getDb();
    if (!db.saas) return res.status(404).json({ error: 'SaaS DB no inicializado' });

    const licenseIndex = db.saas.licenses.findIndex(l => l.id === id);
    if (licenseIndex === -1) return res.status(404).json({ error: 'Licencia no encontrada' });

    const license = db.saas.licenses[licenseIndex];
    if (status) license.status = status;
    if (expirationDate) license.expirationDate = expirationDate;
    if (maxUsers) license.maxUsers = Number(maxUsers);
    if (modules) license.modules = modules;

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Licencia Actualizada',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `Licencia de ${license.clientName} actualizada. Status: ${license.status}, Max Users: ${license.maxUsers}.`,
      client: license.clientName
    });

    saveDb(db);
    res.json(license);
  });

  app.get('/api/saas/subscriptions', (req, res) => {
    const db = getDb();
    res.json(db.saas?.subscriptions || []);
  });

  app.patch('/api/saas/subscriptions/:id', (req, res) => {
    const { id } = req.params;
    const { status, billingCycle, nextRenewal, mrr } = req.body;
    const db = getDb();
    if (!db.saas) return res.status(404).json({ error: 'SaaS DB no inicializado' });

    const subIndex = db.saas.subscriptions.findIndex(s => s.id === id);
    if (subIndex === -1) return res.status(404).json({ error: 'Suscripción no encontrada' });

    const sub = db.saas.subscriptions[subIndex];
    if (status) sub.status = status;
    if (billingCycle) sub.billingCycle = billingCycle;
    if (nextRenewal) sub.nextRenewal = nextRenewal;
    if (mrr) sub.mrr = Number(mrr);

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Suscripción Actualizada',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `Suscripción de ${sub.clientName} modificada. MRR: $${sub.mrr}, Status: ${sub.status}.`,
      client: sub.clientName
    });

    saveDb(db);
    res.json(sub);
  });

  app.get('/api/saas/plans', (req, res) => {
    const db = getDb();
    res.json(db.saas?.plans || []);
  });

  app.post('/api/saas/plans', (req, res) => {
    const { name, price, duration, maxUsers, modules } = req.body;
    const db = getDb();
    if (!db.saas) db.saas = { clients: [], licenses: [], subscriptions: [], plans: [], auditLogs: [] };

    const newPlan = {
      id: `PLN-${Math.floor(10 + Math.random() * 90)}`,
      name,
      price: Number(price) || 0,
      duration: duration || 'Mensual',
      maxUsers: Number(maxUsers) || 10,
      modules: modules || [],
      status: 'Activo' as const
    };
    db.saas.plans.push(newPlan);

    db.saas.auditLogs.unshift({
      id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Plan Creado',
      user: 'Superadmin Principal',
      timestamp: new Date().toLocaleString(),
      details: `Plan de facturación creado: ${name} ($${price} USD).`,
      client: 'TECHNEO Platform'
    });

    saveDb(db);
    res.json(newPlan);
  });

  app.get('/api/saas/audit-logs', (req, res) => {
    const db = getDb();
    res.json(db.saas?.auditLogs || []);
  });

  app.delete('/api/saas/audit-logs', (req, res) => {
    const db = getDb();
    if (db.saas) {
      db.saas.auditLogs = [];
      saveDb(db);
    }
    res.json({ success: true, message: 'Logs de auditoría reiniciados.' });
  });

  // Superusers endpoints
  app.get('/api/saas/superusers', (req, res) => {
    const db = getDb();
    const users = db.admin?.users || [];
    res.json(users);
  });

  app.post('/api/saas/superusers', (req, res) => {
    const { name, email, role, accessLevel, cedula } = req.body;
    const db = getDb();
    if (!db.admin) db.admin = { users: [], payroll: [], auditLogs: [], systemSettings: { maintenanceMode: false, apiRateLimit: 1200, sha256Verification: true } };

    const newUser = {
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name || 'Superusuario Operativo',
      email: email || 'operador@campanaganadora.co',
      cedula: cedula || '1020304050',
      role: role || 'Superadmin',
      accessLevel: accessLevel || 'Nivel 10',
      status: 'Activo',
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.admin.users.push(newUser);
    if (db.saas) {
      db.saas.auditLogs.unshift({
        id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
        action: 'Superusuario Creado',
        user: 'Superadmin Principal',
        timestamp: new Date().toLocaleString(),
        details: `Nuevo superusuario asignado: ${name} (${role} - ${accessLevel})`,
        client: 'Global System'
      });
    }
    saveDb(db);
    res.json(newUser);
  });

  app.patch('/api/saas/superusers/:id', (req, res) => {
    const { id } = req.params;
    const { status, accessLevel, role, name, email } = req.body;
    const db = getDb();
    const userIndex = db.admin?.users.findIndex(u => u.id === id) ?? -1;
    if (userIndex === -1) return res.status(404).json({ error: 'Superusuario no encontrado' });

    const user = db.admin.users[userIndex];
    if (status) user.status = status;
    if (accessLevel) user.accessLevel = accessLevel;
    if (role) user.role = role;
    if (name) user.name = name;
    if (email) user.email = email;

    if (db.saas) {
      db.saas.auditLogs.unshift({
        id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
        action: 'Superusuario Modificado',
        user: 'Superadmin Principal',
        timestamp: new Date().toLocaleString(),
        details: `Superusuario ${user.name} actualizado a ${user.status} (${user.accessLevel})`,
        client: 'Global System'
      });
    }

    saveDb(db);
    res.json(user);
  });

  app.delete('/api/saas/superusers/:id', (req, res) => {
    const { id } = req.params;
    const db = getDb();
    if (db.admin?.users) {
      db.admin.users = db.admin.users.filter(u => u.id !== id);
      saveDb(db);
    }
    res.json({ success: true, id });
  });

  // AI Governor & Quota Monitor
  app.get('/api/saas/ai-governor', (req, res) => {
    const db = getDb();
    const activeCampaigns = db.saas?.clients.length || 4;
    res.json({
      modelName: 'gemini-2.5-flash',
      availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-thinking'],
      status: process.env.GEMINI_API_KEY ? 'active' : 'fallback_mode',
      totalTokensConsumedMonth: 1485200,
      totalCostUSD: 14.85,
      rateLimitRPM: 300,
      quotaPerCampaign: 500000,
      safetyLevel: 'Strict Electoral Integrity',
      emergencyKillSwitch: false,
      campaignBreakdown: (db.saas?.clients || []).map(c => ({
        clientName: c.name,
        tokensUsed: Math.floor(120000 + Math.random() * 250000),
        status: 'OK'
      }))
    });
  });

  // Day D National E-14 aggregation monitor
  app.get('/api/saas/day-d-monitor', (req, res) => {
    const db = getDb();
    const e14Count = db.territorial?.e14Actas.length || 0;
    const votersCount = db.territorial?.voters.length || 0;
    const witnessesCount = db.territorial?.witnesses.length || 0;

    res.json({
      activeCampaignsCount: db.saas?.clients.filter(c => c.status === 'Activo').length || 0,
      globalE14Ingested: e14Count + 1420,
      globalWitnessesDeployed: witnessesCount + 3840,
      globalVotersRegistered: votersCount + 48290,
      ocrAvgAccuracy: '98.7%',
      flaggedDiscrepanciesCount: 3,
      serverLatencyMs: 18,
      lastSyncTimestamp: new Date().toLocaleTimeString()
    });
  });

  // System Settings & Maintenance mode
  app.get('/api/saas/system-settings', (req, res) => {
    const db = getDb();
    res.json(db.admin?.systemSettings || {
      maintenanceMode: false,
      apiRateLimit: 1200,
      sha256Verification: true
    });
  });

  app.post('/api/saas/system-settings', (req, res) => {
    const { maintenanceMode, apiRateLimit, sha256Verification } = req.body;
    const db = getDb();
    if (!db.admin) db.admin = { users: [], payroll: [], auditLogs: [], systemSettings: { maintenanceMode: false, apiRateLimit: 1200, sha256Verification: true } };

    if (maintenanceMode !== undefined) db.admin.systemSettings.maintenanceMode = Boolean(maintenanceMode);
    if (apiRateLimit !== undefined) db.admin.systemSettings.apiRateLimit = Number(apiRateLimit);
    if (sha256Verification !== undefined) db.admin.systemSettings.sha256Verification = Boolean(sha256Verification);

    if (db.saas) {
      db.saas.auditLogs.unshift({
        id: `SALOG-${Math.floor(100 + Math.random() * 900)}`,
        action: 'Ajustes de Sistema Modificados',
        user: 'Superadmin Principal',
        timestamp: new Date().toLocaleString(),
        details: `Mantenimiento: ${db.admin.systemSettings.maintenanceMode}, RateLimit: ${db.admin.systemSettings.apiRateLimit}`,
        client: 'Global System'
      });
    }

    saveDb(db);
    res.json(db.admin.systemSettings);
  });

  // Backup JSON export
  app.get('/api/saas/backup/export', (req, res) => {
    const db = getDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=campana-ganadora-backup-${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  // Impersonate / switch campaign context
  app.post('/api/saas/clients/impersonate', (req, res) => {
    const { clientId } = req.body;
    const db = getDb();
    const client = db.saas?.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: 'Campaña no encontrada' });

    db.saas?.auditLogs.unshift({
      id: `SALOG-${Math.floor(100000 + Math.random() * 900000)}`,
      action: 'Cambio de contexto administrativo',
      user: 'Propietario global autenticado',
      timestamp: new Date().toISOString(),
      details: `Contexto seleccionado para el cliente ${client.id}`,
      client: client.name
    });
    saveDb(db);

    res.json({
      success: true,
      client,
      mode: 'OWNER_CONTEXT_SWITCH',
      redirectUrl: '/primera_interfaz'
    });
  });

  // Serve static files in production or Vite middleware in development
  if (process.env.NODE_ENV === 'development') {
    // Keep Vite out of the production serverless bundle. It is only required by
    // the local development server.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configLoader: 'runner',
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (shouldListen) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

export default app;

// Vercel imports the Express application through api/index.ts and manages
// the HTTP listener. Local execution keeps the conventional port 3000 server.
const isServerless = process.env.VERCEL === '1' || process.env.CF_PAGES === '1' || typeof (globalThis as any).caches === 'object';
startAppServer(!isServerless);
