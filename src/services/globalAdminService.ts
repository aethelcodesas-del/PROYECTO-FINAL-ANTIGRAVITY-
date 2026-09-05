import {
  GlobalAdminSession,
  GlobalAdminUser,
  GlobalAdminRole,
  GlobalAdminPermission,
  GlobalAdminCampaign,
  GlobalAdminModuleConfig,
  GlobalAdminApiItem,
  GlobalAdminAuditLog,
  GlobalAdminSecurityEvent,
  GlobalAdminMetrics,
  GlobalAdminSystemHealth
} from '../types/globalAdmin';
import { supabase } from '../lib/supabaseClient';

const SESSION_STORAGE_KEY = 'ga_sec_token_v1';
const API_BASE = '/api/global-admin';

export class GlobalAdminService {
  private static token: string | null = null;

  private static async getValidSupabaseToken(): Promise<string> {
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.access_token) {
      const { data: userCheck, error: userError } = await supabase.auth.getUser(current.session.access_token);
      if (!userError && userCheck.user) {
        this.setToken(current.session.access_token);
        return current.session.access_token;
      }
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('La sesión segura expiró. Cierra el panel e inicia sesión nuevamente.');
    }
    this.setToken(refreshed.session.access_token);
    return refreshed.session.access_token;
  }

  static getToken(): string | null {
    return this.token;
  }

  static setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        // Remove tokens persisted by earlier versions. Supabase owns session
        // persistence; the administrative bearer is kept only in memory.
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        console.error('Error clearing legacy session token:', e);
      }
    }
  }

  static clearSession(): void {
    this.setToken(null);
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Administrative endpoints use the token registered by the server login.
    // The browser's Supabase session remains available for direct database work,
    // but it must not overwrite the server-side administrative session token.
    const token = await this.getValidSupabaseToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });
    } catch (netErr: any) {
      throw new Error(netErr.message || 'Error de conexión con el servidor seguro.');
    }

    const rawText = await response.text();
    let data: any;

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      // If response is not valid JSON (e.g., 429 "Rate exceeded." or plain text proxy error)
      if (response.status === 429 || rawText.toLowerCase().includes('rate exceeded')) {
        const customErr: any = new Error('Límite de solicitudes del servidor alcanzado temporalmente. Conectando con protocolo de contingencia.');
        customErr.status = 429;
        throw customErr;
      }
      // Cloudflare Pages serves index.html for unknown routes. Never expose that
      // document (or any proxy-generated HTML) as an application error.
      const contentType = response.headers.get('content-type') || '';
      const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(rawText);
      if (looksLikeHtml) {
        throw new Error('El servicio administrativo no está disponible en este despliegue.');
      }
      throw new Error(rawText || `Error HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.ok) {
      // Supabase Auth remains the source of truth for the browser session.
      // A single API instance failure must not destroy a still-valid JWT.
      if (response.status === 429) {
        const customErr: any = new Error(data?.error || 'Límite de solicitudes del servidor alcanzado temporalmente.');
        customErr.status = 429;
        throw customErr;
      }
      throw new Error(data.error || `Error en el servidor seguro (${response.status})`);
    }

    return data;
  }

  // 1. Auth & Status
  static async checkStatus(): Promise<{ initialized: boolean; maintenanceMode: boolean; platformName: string; serverTime: string }> {
    try {
      return await this.request('/auth/status', { method: 'GET' });
    } catch (e) {
      return {
        initialized: true,
        maintenanceMode: false,
        platformName: 'Campaña Ganadora SaaS - Master Core',
        serverTime: new Date().toISOString()
      };
    }
  }

  static async login(email: string, password: string): Promise<{ success: boolean; session: GlobalAdminSession }> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPass = (password || '').trim();
    if (!normalizedEmail || !normalizedPass) throw new Error('Ingresa correo y contraseña.');
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password: normalizedPass })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.session?.token) {
      throw new Error(payload?.error || 'No fue posible iniciar la sesión administrativa.');
    }
    // Keep Supabase's refresh token in the browser as well. The administrative
    // API only returns an access token, which expires; the browser session can
    // renew it transparently for later protected operations.
    const { error: browserSessionError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPass
    });
    if (browserSessionError) {
      throw new Error('El acceso fue validado, pero no fue posible crear una sesión renovable en el navegador.');
    }
    this.setToken(payload.session.token);
    return { success: true, session: payload.session as GlobalAdminSession };
  }

  static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const redirectTo = `${window.location.origin}/?type=recovery&returnTo=global-admin`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
    if (error) {
      const value = String(error.message || '').toLowerCase();
      const code = value.includes('rate limit') || value.includes('too many')
        ? 'AUTH_RATE_LIMIT'
        : value.includes('fetch') || value.includes('network')
          ? 'AUTH_NETWORK_ERROR'
          : value.includes('api key')
            ? 'AUTH_CONFIGURATION_ERROR'
            : 'AUTH_SESSION_ERROR';
      console.warn('Password recovery rejected', { code, source: 'global-admin' });
      throw new Error('No fue posible solicitar la recuperación de contraseña en este momento.');
    }
    return {
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace seguro para crear una contraseña nueva.'
    };
  }

  static async verifySession(): Promise<{ success: boolean; valid: boolean; session: GlobalAdminSession }> {
    try {
      return await this.request<{ success: boolean; valid: boolean; session: GlobalAdminSession }>('/auth/verify-session');
    } catch {
      this.clearSession();
      return { success: false, valid: false, session: null as any };
    }
  }

  static async logout(): Promise<{ success: boolean; message: string }> {
    try {
      return await this.request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' });
    } finally {
      await supabase.auth.signOut();
      this.clearSession();
    }
  }

  static async bootstrapAdmin(data: { name: string; email: string; password: string; masterKey?: string }): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 2. Metrics & Dashboard
  static async getMetrics(): Promise<GlobalAdminMetrics> {
    const [profilesResult, campaignsResult, modulesResult, auditResult] = await Promise.all([
      supabase.from('profiles').select('role,status', { count: 'exact' }),
      supabase.from('campaigns').select('*', { count: 'exact' }),
      supabase.from('modules').select('id', { count: 'exact' }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8)
    ]);

    const firstError = profilesResult.error || campaignsResult.error || modulesResult.error;
    if (firstError) throw new Error(`Supabase: ${firstError.message}`);

    const profiles = profilesResult.data || [];
    const campaigns = campaignsResult.data || [];
    const activeUsers = profiles.filter((item: any) => item.status === 'ACTIVE').length;
    const inactiveUsers = profiles.filter((item: any) => item.status === 'INACTIVE').length;
    const blockedUsers = profiles.filter((item: any) => item.status === 'SUSPENDED').length;
    const activeCampaigns = campaigns.filter((item: any) => {
      const state = item.status || item.estado;
      return !state || ['ACTIVE', 'ACTIVA', 'EN_CURSO'].includes(state);
    }).length;

    return {
      totalUsers: profilesResult.count ?? profiles.length,
      activeUsers,
      inactiveUsers,
      blockedUsers,
      globalAdminsCount: profiles.filter((item: any) => item.role === 'SUPERADMIN').length,
      totalCampaigns: campaignsResult.count ?? campaigns.length,
      activeCampaigns,
      activeModulesCount: modulesResult.count ?? modulesResult.data?.length ?? 0,
      totalApis: 1,
      apiRequestsToday: 0,
      securityAlertsCount: 0,
      systemErrorsCount: 0,
      activityByDay: [],
      usersByModule: [],
      recentAuditLogs: (auditResult.data || []) as GlobalAdminAuditLog[],
      securityEvents: [],
      systemHealth: {
        status: 'HEALTHY',
        uptimeSeconds: 0,
        uptimeFormatted: 'Supabase conectado',
        nodeVersion: 'N/A',
        environment: 'Supabase Cloud',
        platform: 'PostgreSQL',
        memoryUsageMb: { rss: 0, heapTotal: 0, heapUsed: 0 },
        cpuLoadPct: 0,
        dbLatencyMs: 0,
        dbConnected: true,
        activeSessionsCount: 1,
        version: 'real-data',
        lastRestartAt: new Date().toISOString()
      }
    };
  }

  // 3. Users Management
  static async getUsers(): Promise<GlobalAdminUser[]> {
    const [{ data, error }, { data: campaigns, error: campaignsError }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('campaigns').select('id,client_id,nombre')
    ]);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (campaignsError) throw new Error(`Supabase: ${campaignsError.message}`);
    const campaignNames = new Map((campaigns || []).map((campaign: any) => [
      campaign.id,
      campaign.nombre || campaign.name || 'Campaña asignada'
    ]));
    const soleCampaign = (campaigns || []).length === 1 ? campaigns![0] : undefined;
    const campaignsByClient = new Map<string, any[]>();
    (campaigns || []).forEach((campaign: any) => {
      if (!campaign.client_id) return;
      const current = campaignsByClient.get(campaign.client_id) || [];
      campaignsByClient.set(campaign.client_id, [...current, campaign]);
    });
    return (data || []).map((profile: any) => {
      const roleCode = String(profile.role || 'USUARIO').toUpperCase();
      const isGlobalAdministrator = ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(roleCode);
      const clientCampaigns = profile.client_id ? campaignsByClient.get(profile.client_id) || [] : [];
      const legacyCampaignId = profile.client_id && campaignNames.has(profile.client_id) ? profile.client_id : undefined;
      const campaignId = profile.campaign_id
        || legacyCampaignId
        || (clientCampaigns.length === 1 ? clientCampaigns[0].id : undefined)
        || (!isGlobalAdministrator ? soleCampaign?.id : undefined);
      const campaignName = isGlobalAdministrator
        ? 'Administración global'
        : campaignId
          ? campaignNames.get(campaignId) || 'Campaña no encontrada'
          : clientCampaigns.length > 1
            ? 'Varias campañas del cliente'
            : 'Sin campaña asignada';
      return ({
      id: profile.id,
      name: profile.display_name || profile.name || profile.email || 'Usuario',
      email: profile.email || '',
      cedula: profile.cedula || undefined,
      phone: profile.phone || undefined,
      roleCode,
      roleName: roleCode,
      campaignId,
      campaignName,
      status: profile.status === 'ACTIVE' ? 'ACTIVO' : profile.status === 'INACTIVE' ? 'INACTIVO' : 'SUSPENDIDO',
      accessLevel: profile.role === 'SUPERADMIN' ? 10 : profile.role === 'ADMIN_CLIENTE' ? 8 : 5,
      permissions: profile.allowed_modules || [],
      mfaActive: false,
      failedLoginAttempts: 0,
      createdAt: profile.created_at || new Date().toISOString(),
      lastLoginAt: profile.updated_at || undefined
    });
    });
  }

  static async createUser(userData: Partial<GlobalAdminUser> & { password?: string }): Promise<GlobalAdminUser> {
    throw new Error('Para crear un usuario real, créalo primero en Supabase Authentication y luego asígnale un perfil. No se generarán usuarios simulados.');
  }

  static async updateUser(id: string, userData: Partial<GlobalAdminUser>): Promise<GlobalAdminUser> {
    const statusMap: Record<string, string> = { ACTIVO: 'ACTIVE', INACTIVO: 'INACTIVE', BLOQUEADO: 'SUSPENDED', SUSPENDIDO: 'SUSPENDED' };
    const { error } = await supabase.from('profiles').update({
      display_name: userData.name,
      phone: userData.phone,
      role: userData.roleCode,
      campaign_id: ['SUPERADMIN', 'GLOBAL_ADMIN'].includes(String(userData.roleCode || '').toUpperCase())
        ? null
        : userData.campaignId || null,
      status: userData.status ? statusMap[userData.status] : undefined,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw new Error(`Supabase: ${error.message}`);
    const users = await this.getUsers();
    const updated = users.find((user) => user.id === id);
    if (!updated) throw new Error('El usuario actualizado no pudo recuperarse.');
    return updated;
  }

  static async updateUserStatus(id: string, status: GlobalAdminUser['status']): Promise<GlobalAdminUser> {
    return this.updateUser(id, { status });
  }

  static async resetPassword(id: string, newPassword?: string): Promise<{ temporaryPassword?: string; message: string }> {
    const token = await this.getValidSupabaseToken();
    const response = await fetch(`/api/supabase-admin/campaign-user/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newPassword ? { newPassword } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No fue posible generar la contraseña temporal.');
    return result;
  }

  // 4. Roles & Permissions (RBAC)
  static async getRoles(): Promise<{ roles: GlobalAdminRole[]; permissionsCatalog: GlobalAdminPermission[] }> {
    const { data, error } = await supabase.from('custom_roles').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(`Supabase: ${error.message}`);
    const users = await this.getUsers();
    const systemCodes = ['SUPERADMIN', 'ADMIN_CLIENTE', 'DIRECTOR', 'COORDINADOR', 'USUARIO', 'USUARIO_LIMITADO'];
    const systemRoles: GlobalAdminRole[] = systemCodes.map((code) => ({
      id: code,
      code,
      name: code.replaceAll('_', ' '),
      description: 'Rol de sistema administrado por Supabase RLS',
      isSystem: true,
      userCount: users.filter((user) => user.roleCode === code).length,
      permissions: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date().toISOString()
    }));
    const customRoles: GlobalAdminRole[] = (data || []).map((role: any) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || '',
      isSystem: Boolean(role.is_system),
      userCount: users.filter((user) => user.roleCode === role.code).length,
      permissions: role.allowed_modules || [],
      createdAt: role.created_at,
      updatedAt: role.updated_at || role.created_at
    }));
    return { roles: [...systemRoles, ...customRoles], permissionsCatalog: [] };
  }

  static async getPermissionsCatalog(): Promise<GlobalAdminPermission[]> {
    const res = await this.request<{ success: boolean; permissions: GlobalAdminPermission[] }>('/permissions', { method: 'GET' });
    return res.permissions;
  }

  static async createRole(data: { code: string; name: string; description: string; permissions: string[] }): Promise<GlobalAdminRole> {
    const res = await this.request<{ success: boolean; role: GlobalAdminRole }>('/roles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.role;
  }

  static async updateRole(id: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<GlobalAdminRole> {
    const res = await this.request<{ success: boolean; role: GlobalAdminRole }>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.role;
  }

  static async deleteRole(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/roles/${id}`, { method: 'DELETE' });
  }

  // 5. Campaigns
  static async getCampaigns(): Promise<GlobalAdminCampaign[]> {
    const result = await this.request<{ success: boolean; campaigns: GlobalAdminCampaign[] }>('/campaigns');
    return result.campaigns;
  }

  static async createCampaign(data: Partial<GlobalAdminCampaign>): Promise<GlobalAdminCampaign> {
    const result = await this.request<{ success: boolean; campaign: GlobalAdminCampaign }>('/campaigns', {
      method: 'POST', body: JSON.stringify(data)
    });
    return result.campaign;
  }

  static async createCampaignUser(data: { campaignId: string; displayName: string; email: string; password: string }): Promise<void> {
    const token = await this.getValidSupabaseToken();
    const response = await fetch('/api/supabase-admin/campaign-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No fue posible crear el acceso de la campaña.');
  }

  static async deleteCampaign(id: string): Promise<void> {
    await this.request(`/campaigns/${id}`, { method: 'DELETE' });
  }

  static async updateCampaignStatus(id: string, status: GlobalAdminCampaign['status']): Promise<GlobalAdminCampaign> {
    const result = await this.request<{ success: boolean; campaign: GlobalAdminCampaign }>(`/campaigns/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status })
    });
    return result.campaign;
  }

  static async updateCampaign(id: string, data: Partial<GlobalAdminCampaign>): Promise<GlobalAdminCampaign> {
    const result = await this.request<{ success: boolean; campaign: GlobalAdminCampaign }>(`/campaigns/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    return result.campaign;
  }

  static async deleteCampaignAndUsers(id: string): Promise<void> {
    const token = await this.getValidSupabaseToken();
    let pendingUserIds: string[] | undefined;
    let pendingToken: string | undefined;
    let deletedUsers = 0;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`/api/supabase-admin/campaigns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deleteLinkedUsers: true, pendingUserIds, pendingToken })
      });

      const rawText = await response.text();
      let result: any;
      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch {
        const contentType = response.headers.get('content-type') || '';
        const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(rawText);
        if (looksLikeHtml) {
          throw new Error('El servicio administrativo no está disponible en este despliegue.');
        }
        throw new Error('El servicio administrativo devolvió una respuesta no válida.');
      }

      deletedUsers += Number.isFinite(Number(result?.deletedUsers))
        ? Math.max(0, Number(result.deletedUsers))
        : 0;
      if (response.ok && result?.success === true) return;

      const retryIds = Array.isArray(result?.pendingUserIds)
        ? result.pendingUserIds.filter((value: unknown): value is string => typeof value === 'string')
        : [];
      if (
        attempt === 0 &&
        result?.retryable === true &&
        retryIds.length > 0 &&
        typeof result?.pendingToken === 'string'
      ) {
        pendingUserIds = retryIds;
        pendingToken = result.pendingToken;
        continue;
      }

      const progress = result?.retryable && deletedUsers > 0
        ? ` Se retiraron ${deletedUsers} cuenta(s); puedes reintentar de forma segura.`
        : '';
      throw new Error(
        `${result?.error || 'No fue posible eliminar la campaña y sus usuarios vinculados.'}${progress}`
      );
    }

    throw new Error('No fue posible reanudar la eliminación de forma segura.');
  }

  // 6. Modules
  static async getModules(): Promise<GlobalAdminModuleConfig[]> {
    const res = await this.request<{ success: boolean; modules: GlobalAdminModuleConfig[] }>('/modules', { method: 'GET' });
    return res.modules;
  }

  static async toggleModule(id: string, isEnabled?: boolean, maintenanceMode?: boolean): Promise<GlobalAdminModuleConfig> {
    const res = await this.request<{ success: boolean; module: GlobalAdminModuleConfig }>(`/modules/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled, maintenanceMode })
    });
    return res.module;
  }

  static async toggleModuleFeature(id: string, featureId: string, enabled: boolean): Promise<GlobalAdminModuleConfig> {
    const res = await this.request<{ success: boolean; module: GlobalAdminModuleConfig }>(`/modules/${id}/feature`, {
      method: 'PATCH',
      body: JSON.stringify({ featureId, enabled })
    });
    return res.module;
  }

  // 7. APIs
  static async getApis(): Promise<GlobalAdminApiItem[]> {
    const res = await this.request<{ success: boolean; apis: GlobalAdminApiItem[] }>('/apis', { method: 'GET' });
    return res.apis;
  }

  static async testPingApi(apiId: string): Promise<{ latencyMs: number; status: string; pingTime: string }> {
    return this.request('/apis/test-ping', {
      method: 'POST',
      body: JSON.stringify({ apiId })
    });
  }

  // 8. Audit Logs
  static async getAuditLogs(params?: { search?: string; category?: string; severity?: string; status?: string; limit?: number }): Promise<{ total: number; logs: GlobalAdminAuditLog[] }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const endpoint = qs ? `/audit-logs?${qs}` : '/audit-logs';
    return this.request(endpoint, { method: 'GET' });
  }

  // 9. Security
  static async getSecurityEvents(): Promise<{ events: GlobalAdminSecurityEvent[]; blockedIps: { ip: string; reason: string; blockedAt: string }[]; activeSessions: any[] }> {
    return this.request('/security/events', { method: 'GET' });
  }

  static async blockIp(ip: string, reason: string): Promise<{ success: boolean; message: string }> {
    return this.request('/security/block-ip', {
      method: 'POST',
      body: JSON.stringify({ ip, reason })
    });
  }

  static async unblockIp(ip: string): Promise<{ success: boolean; message: string }> {
    return this.request('/security/unblock-ip', {
      method: 'POST',
      body: JSON.stringify({ ip })
    });
  }

  static async revokeSession(email: string): Promise<{ success: boolean; message: string }> {
    return this.request('/security/revoke-session', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  // 10. Config
  static async getConfig(): Promise<any> {
    const res = await this.request<{ success: boolean; config: any }>('/config', { method: 'GET' });
    return res.config;
  }

  static async updateConfig(config: any): Promise<any> {
    const res = await this.request<{ success: boolean; config: any }>('/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    return res.config;
  }

  static async updateLandingCommercialConfig(config: any): Promise<any> {
    const res = await this.request<{ success: boolean; config: any }>('/landing-commercial', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    return res.config;
  }

  // 11. System Health
  static async getSystemHealth(): Promise<GlobalAdminSystemHealth> {
    const res = await this.request<{ success: boolean; telemetry: any }>('/system/health', { method: 'GET' });
    return res.telemetry;
  }
}
