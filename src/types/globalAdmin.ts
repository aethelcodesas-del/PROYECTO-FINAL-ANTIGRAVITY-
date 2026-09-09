export type GlobalAdminTab = 
  | 'dashboard'
  | 'usuarios'
  | 'roles'
  | 'campanas'
  | 'modulos'
  | 'apis'
  | 'auditoria'
  | 'seguridad'
  | 'configuracion'
  | 'comercial'
  | 'sistema';

export interface GlobalAdminSession {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'GLOBAL_ADMIN';
    roleTitle: string;
    permissions: string[];
    mfaEnabled: boolean;
    avatarUrl?: string;
    lastLoginAt: string;
  };
  expiresAt: string;
}

export interface GlobalAdminUser {
  id: string;
  name: string;
  email: string;
  cedula?: string;
  phone?: string;
  roleCode: string;
  roleName: string;
  campaignId?: string;
  campaignName?: string;
  status: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO' | 'SUSPENDIDO';
  accessLevel: number;
  permissions: string[];
  mfaActive: boolean;
  failedLoginAttempts: number;
  createdAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

export interface GlobalAdminRole {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GlobalAdminPermission {
  code: string;
  name: string;
  category: 'Usuarios' | 'Roles' | 'Campañas' | 'Módulos' | 'APIs' | 'Auditoría' | 'Seguridad' | 'Sistema';
  description: string;
}

export interface GlobalAdminCampaign {
  id: string;
  code: string;
  name: string;
  candidateName: string;
  type: 'Presidencia' | 'Alcaldía' | 'Gobernación' | 'Senado' | 'Cámara' | 'Concejo' | 'Asamblea';
  department: string;
  city: string;
  status: 'Activa' | 'En Pausa' | 'Finalizada' | 'En Configuración';
  adminManager: string;
  totalUsers: number;
  registeredVoters: number;
  assignedWitnesses: number;
  budgetExecutedCop: number;
  budgetLimitCop: number;
  createdAt: string;
  lastActivityAt: string;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
  demoDays?: number;
}

export interface GlobalAdminModuleConfig {
  id: string;
  code: 'modulo_admin' | 'gestion_estrategica' | 'gestion_territorial' | 'testigo_campo' | 'encuestas' | 'jurado_campo' | 'presupuesto' | 'pruebas_electorales';
  name: string;
  category: 'Administración' | 'Estrategia' | 'Territorio' | 'Día E' | 'Auditoría';
  description: string;
  isEnabled: boolean;
  maintenanceMode: boolean;
  activeUsers24h: number;
  apiRequests24h: number;
  errorRatePct: number;
  dependencies: string[];
  features: { id: string; name: string; enabled: boolean }[];
  updatedAt: string;
}

export interface GlobalAdminApiItem {
  id: string;
  name: string;
  provider: 'Google Gemini' | 'PostgreSQL Cloud' | 'Twilio / WhatsApp' | 'Google Maps Platform' | 'Registraduría Nacional' | 'Pasarela de Pagos';
  endpoint: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';
  responseTimeMs: number;
  requests24h: number;
  rateLimitPerMin: number;
  errorCount24h: number;
  maskedApiKey: string;
  lastPingAt: string;
  sslValid: boolean;
  quotaUsedPct: number;
}

export interface GlobalAdminAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  category: 'AUTH' | 'USERS' | 'ROLES' | 'CAMPAIGNS' | 'MODULES' | 'APIS' | 'SECURITY' | 'CONFIG';
  resource: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY';
  status: 'ÉXITO' | 'DENEGADO' | 'FALLO';
  ipAddress: string;
  userAgent: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface GlobalAdminSecurityEvent {
  id: string;
  timestamp: string;
  type: 'FAILED_LOGIN' | 'SUSPICIOUS_IP' | 'BRUTE_FORCE_BLOCKED' | 'UNAUTHORIZED_ACCESS_ATTEMPT' | 'SESSION_REVOKED' | 'PRIVILEGE_ESCALATION_ATTEMPT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceIp: string;
  targetUser?: string;
  description: string;
  resolved: boolean;
  resolutionNotes?: string;
}

export interface GlobalAdminSystemConfig {
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  requireMfaForAdmins: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  emergencyContactEmail: string;
  allowedIpRanges?: string[];
  corsOrigins?: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface GlobalAdminSystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  uptimeSeconds: number;
  uptimeFormatted: string;
  nodeVersion: string;
  environment: string;
  platform?: string;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpuLoadPct: number;
  dbLatencyMs: number;
  dbConnected: boolean;
  activeSessionsCount: number;
  version: string;
  lastRestartAt: string;
}

export interface GlobalAdminMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  blockedUsers: number;
  globalAdminsCount: number;
  totalCampaigns: number;
  activeCampaigns: number;
  activeModulesCount: number;
  totalApis: number;
  apiRequestsToday: number;
  securityAlertsCount: number;
  systemErrorsCount: number;
  activityByDay: { date: string; users: number; requests: number; errors: number }[];
  usersByModule: { module: string; users: number; share: number }[];
  recentAuditLogs: GlobalAdminAuditLog[];
  securityEvents: GlobalAdminSecurityEvent[];
  systemHealth: GlobalAdminSystemHealth;
}
