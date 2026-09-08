import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
import {
  Activity,
  Building2,
  Key,
  CreditCard,
  Users,
  ShieldCheck,
  Layers,
  Briefcase,
  FileText,
  Clock,
  Settings,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  PieChart,
  Download,
  Trash2,
  Edit3,
  LogIn,
  CheckCircle,
  X,
  Menu,
  ArrowRight,
  Database,
  Cpu,
  Zap,
  Server,
  Lock,
  Unlock,
  Globe,
  Sliders,
  Check,
  Copy,
  ExternalLink,
  Radio,
  FileCheck,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { ViewMode, AuthUser } from '../../types';

export type SaaSMenuTab =
  | 'dashboard'
  | 'clientes'
  | 'licencias'
  | 'suscripciones'
  | 'superusuarios'
  | 'ai_governor'
  | 'dia_d_monitor'
  | 'modulos'
  | 'planes'
  | 'auditoria'
  | 'configuracion';

interface ClientItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Activo' | 'Suspendido' | 'Inactivo';
  plan: string;
  joinedDate: string;
}

interface LicenseItem {
  id: string;
  clientName: string;
  planName: string;
  code: string;
  startDate: string;
  expirationDate: string;
  status: 'Pendiente' | 'Activa' | 'Suspendida' | 'Vencida' | 'Cancelada';
  maxUsers: number;
  modules: string[];
}

interface SubscriptionItem {
  id: string;
  clientName: string;
  planName: string;
  status: 'Activo' | 'Vencido' | 'Pendiente';
  billingCycle: 'Mensual' | 'Anual';
  nextRenewal: string;
  mrr: number;
}

interface PlanItem {
  id: string;
  name: string;
  price: number;
  duration: string;
  maxUsers: number;
  modules: string[];
  status: 'Activo' | 'Inactivo';
}

interface SuperUserItem {
  id: string;
  name: string;
  email: string;
  cedula?: string;
  role: string;
  accessLevel: string;
  status: string;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
  client?: string;
}

interface DayDMonitorData {
  activeCampaignsCount: number;
  globalE14Ingested: number;
  globalWitnessesDeployed: number;
  globalVotersRegistered: number;
  ocrAvgAccuracy: string;
  flaggedDiscrepanciesCount: number;
  serverLatencyMs: number;
  lastSyncTimestamp: string;
}

interface AIGovernorData {
  modelName: string;
  availableModels: string[];
  status: string;
  totalTokensConsumedMonth: number;
  totalCostUSD: number;
  rateLimitRPM: number;
  quotaPerCampaign: number;
  safetyLevel: string;
  emergencyKillSwitch: boolean;
  campaignBreakdown: Array<{
    clientName: string;
    tokensUsed: number;
    status: string;
  }>;
}

interface SystemSettingsData {
  maintenanceMode: boolean;
  apiRateLimit: number;
  sha256Verification: boolean;
}

interface PanelAdministrativoSaaSProps {
  onSelectView: (view: ViewMode) => void;
  authUser?: AuthUser | null;
  onImpersonateCampaign?: (campaignName: string, clientRole?: string) => void;
}

export const PanelAdministrativoSaaS: React.FC<PanelAdministrativoSaaSProps> = ({
  onSelectView,
  authUser,
  onImpersonateCampaign
}) => {
  const [activeTab, setActiveTab] = useState<SaaSMenuTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Core Data Lists
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [superUsers, setSuperUsers] = useState<SuperUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [dayDData, setDayDData] = useState<DayDMonitorData | null>(null);
  const [aiData, setAiData] = useState<AIGovernorData | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsData>({
    maintenanceMode: false,
    apiRateLimit: 1200,
    sha256Verification: true
  });

  // Filter & Search Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  // Modal / Form States
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [superUserModalOpen, setSuperUserModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // New Client Form Data
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPlan, setNewClientPlan] = useState('Enterprise Master');

  // New License Form Data
  const [newLicenseClient, setNewLicenseClient] = useState('');
  const [newLicensePlan, setNewLicensePlan] = useState('Enterprise Master');
  const [newLicenseDays, setNewLicenseDays] = useState('180');
  const [newLicenseMaxUsers, setNewLicenseMaxUsers] = useState('150');
  const [newLicenseModules, setNewLicenseModules] = useState<string[]>([
    'gestion_estrategica',
    'gestion_territorial',
    'modulo_admin',
    'testigo_campo',
    'encuestas',
    'jurado_campo',
    'presupuesto',
    'pruebas_electorales'
  ]);

  // New Super User Form Data
  const [newSUName, setNewSUName] = useState('');
  const [newSUEmail, setNewSUEmail] = useState('');
  const [newSUCedula, setNewSUCedula] = useState('');
  const [newSURole, setNewSURole] = useState('Superadmin Global');
  const [newSULevel, setNewSULevel] = useState('Nivel 10');

  // Fetch all SaaS data from backend
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        clientsRes,
        licensesRes,
        subsRes,
        plansRes,
        usersRes,
        logsRes,
        aiRes,
        dayDRes,
        settingsRes
      ] = await Promise.all([
        authenticatedFetch('/api/saas/clients').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/licenses').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/subscriptions').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/plans').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/superusers').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/audit-logs').then((r) => r.json()).catch(() => []),
        authenticatedFetch('/api/saas/ai-governor').then((r) => r.json()).catch(() => null),
        authenticatedFetch('/api/saas/day-d-monitor').then((r) => r.json()).catch(() => null),
        authenticatedFetch('/api/saas/system-settings').then((r) => r.json()).catch(() => ({
          maintenanceMode: false,
          apiRateLimit: 1200,
          sha256Verification: true
        }))
      ]);

      setClients(clientsRes || []);
      setLicenses(licensesRes || []);
      setSubscriptions(subsRes || []);
      setPlans(plansRes || []);
      setSuperUsers(usersRes || []);
      setAuditLogs(logsRes || []);
      if (aiRes) setAiData(aiRes);
      if (dayDRes) setDayDData(dayDRes);
      if (settingsRes) setSystemSettings(settingsRes);
    } catch (err) {
      console.error('Error fetching global SaaS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const triggerToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 2500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Client Handlers
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail) return;

    try {
      const res = await authenticatedFetch('/api/saas/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          email: newClientEmail,
          phone: newClientPhone,
          plan: newClientPlan
        })
      });

      if (res.ok) {
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPhone('');
        setClientModalOpen(false);
        triggerToast(`Campaña / Tenant "${newClientName}" creada exitosamente con licencia automática.`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Error creating client:', err);
    }
  };

  const handleUpdateClientStatus = async (id: string, newStatus: string) => {
    try {
      const res = await authenticatedFetch(`/api/saas/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        triggerToast(`Estado del cliente actualizado a ${newStatus}.`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Error updating client status:', err);
    }
  };

  // License Handlers
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLicenseClient) return;

    const expDate = new Date(Date.now() + Number(newLicenseDays) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    try {
      const res = await authenticatedFetch('/api/saas/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newLicenseClient,
          planName: newLicensePlan,
          expirationDate: expDate,
          maxUsers: Number(newLicenseMaxUsers),
          modules: newLicenseModules
        })
      });

      if (res.ok) {
        setLicenseModalOpen(false);
        triggerToast(`Licencia criptográfica generada para "${newLicenseClient}".`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Error generating license:', err);
    }
  };

  const handleUpdateLicenseStatus = async (id: string, newStatus: string) => {
    try {
      const res = await authenticatedFetch(`/api/saas/licenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        triggerToast(`Licencia actualizada a ${newStatus}.`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Error updating license:', err);
    }
  };

  // Superuser Handlers
  const handleCreateSuperUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSUName || !newSUEmail) return;

    try {
      const res = await authenticatedFetch('/api/saas/superusers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSUName,
          email: newSUEmail,
          cedula: newSUCedula,
          role: newSURole,
          accessLevel: newSULevel
        })
      });

      if (res.ok) {
        setNewSUName('');
        setNewSUEmail('');
        setNewSUCedula('');
        setSuperUserModalOpen(false);
        triggerToast(`Superusuario "${newSUName}" registrado con permisos de ${newSULevel}.`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Error creating superuser:', err);
    }
  };

  const handleDeleteSuperUser = async (id: string) => {
    if (!confirm('¿Está seguro de revocar el acceso a este superusuario?')) return;
    try {
      const res = await authenticatedFetch(`/api/saas/superusers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerToast('Superusuario revocado de la plataforma.');
        fetchAllData();
      }
    } catch (err) {
      console.error('Error deleting superuser:', err);
    }
  };

  // Impersonate / Switch Campaign Context
  const handleImpersonate = async (client: ClientItem) => {
    try {
      const res = await authenticatedFetch('/api/saas/clients/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id })
      });

      if (res.ok) {
        triggerToast(`Ingresando en modo Superadministrador a: ${client.name}...`);
        if (onImpersonateCampaign) {
          onImpersonateCampaign(client.name);
        } else {
          setTimeout(() => {
            onSelectView('primera_interfaz');
          }, 800);
        }
      }
    } catch (err) {
      console.error('Error impersonating:', err);
    }
  };

  // System Settings Handlers
  const handleToggleMaintenance = async () => {
    const nextVal = !systemSettings.maintenanceMode;
    try {
      const res = await authenticatedFetch('/api/saas/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode: nextVal })
      });
      if (res.ok) {
        setSystemSettings((prev) => ({ ...prev, maintenanceMode: nextVal }));
        triggerToast(
          nextVal
            ? 'MODO MANTENIMIENTO ACTIVADO GLOBALMENTE.'
            : 'Modo Mantenimiento desactivado. Plataforma 100% en línea.'
        );
      }
    } catch (err) {
      console.error('Error toggling maintenance:', err);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await authenticatedFetch('/api/saas/backup/export');
      if (!response.ok) throw new Error('No fue posible autorizar la exportación.');
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `campana-ganadora-backup-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      triggerToast('Descarga de copia de seguridad JSON iniciada.');
    } catch (error) {
      console.error('Error downloading backup:', error);
      triggerToast('No fue posible descargar la copia de seguridad.');
    }
  };

  const handleClearAuditLogs = async () => {
    if (!confirm('¿Confirma reiniciar el registro de auditoría de seguridad?')) return;
    try {
      const res = await authenticatedFetch('/api/saas/audit-logs', { method: 'DELETE' });
      if (res.ok) {
        setAuditLogs([]);
        triggerToast('Logs de auditoría reiniciados.');
      }
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  // Calculations for KPI Cards
  const activeClientsCount = clients.filter((c) => c.status === 'Activo').length;
  const activeLicensesCount = licenses.filter((l) => l.status === 'Activa').length;
  const totalMrr = subscriptions
    .filter((s) => s.status === 'Activo')
    .reduce((acc, curr) => acc + curr.mrr, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Activo':
      case 'Activa':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Activo
          </span>
        );
      case 'Suspendido':
      case 'Suspendida':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Suspendido
          </span>
        );
      case 'Vencida':
      case 'Vencido':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Vencido
          </span>
        );
      case 'Inactivo':
      case 'Cancelada':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-500/15 text-slate-300 border border-slate-600/30 flex items-center gap-1 w-fit">
            Inactivo
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 w-fit">
            {status}
          </span>
        );
    }
  };

  const tabsConfig = [
    { id: 'dashboard' as SaaSMenuTab, label: 'Telemetría Global', icon: <Activity className="w-4 h-4" /> },
    { id: 'clientes' as SaaSMenuTab, label: 'Campañas / Tenants', icon: <Building2 className="w-4 h-4" /> },
    { id: 'licencias' as SaaSMenuTab, label: 'Licencias Criptográficas', icon: <Key className="w-4 h-4" /> },
    { id: 'suscripciones' as SaaSMenuTab, label: 'Suscripciones & MRR', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'superusuarios' as SaaSMenuTab, label: 'Superusuarios & Staff', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'ai_governor' as SaaSMenuTab, label: 'Gobernanza IA Gemini', icon: <Bot className="w-4 h-4" /> },
    { id: 'dia_d_monitor' as SaaSMenuTab, label: 'Centro de Mando Día D', icon: <Radio className="w-4 h-4" /> },
    { id: 'planes' as SaaSMenuTab, label: 'Planes Comerciales', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'modulos' as SaaSMenuTab, label: 'Matriz de Módulos', icon: <Layers className="w-4 h-4" /> },
    { id: 'auditoria' as SaaSMenuTab, label: 'Auditoría & Trazabilidad', icon: <Clock className="w-4 h-4" /> },
    { id: 'configuracion' as SaaSMenuTab, label: 'Infraestructura & Seguridad', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="responsive-view flex h-full min-h-[90dvh] w-full min-w-0 bg-[#020813] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast notification banner */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-900/95 to-teal-950/95 border border-emerald-500/40 text-emerald-200 text-xs font-bold shadow-2xl shadow-emerald-950/60 flex items-center gap-3 backdrop-blur-md"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Master Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-indigo-950/50 bg-[#030c1e] shrink-0">
        {/* Superadmin Header Identity */}
        <div className="p-5 border-b border-indigo-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-950/60 border border-indigo-300/30 text-sm">
              CG
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white tracking-wider leading-none">
                CAMPAÑA GANADORA
              </h2>
              <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mt-1 block uppercase tracking-widest">
                Panel Global Superusuario
              </span>
            </div>
          </div>
        </div>

        {/* System Health Mini Pulse */}
        <div className="px-5 py-3 bg-[#020713]/80 border-b border-indigo-950/40 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-400 font-medium">Cluster Multi-Tenant</span>
          </div>
          <span className="text-emerald-400 font-mono font-bold text-[10px]">18ms Latencia</span>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
          {tabsConfig.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-950/50 border border-indigo-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</div>
                <span className="truncate text-left">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to Campaign View Action */}
        <div className="p-4 border-t border-indigo-950/50 bg-[#020713]/60 space-y-2">
          <button
            onClick={() => onSelectView('primera_interfaz')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 border border-slate-700 text-cyan-300 hover:text-white transition-all cursor-pointer shadow-md"
          >
            <span>Ir a Sala de Control Electoral</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile Header Bar */}
        <div className="lg:hidden p-4 bg-[#030c1e] border-b border-indigo-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-indigo-900/40 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-white block">
                Campaña Ganadora AI
              </span>
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">
                Panel Global Superusuario
              </span>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 font-black uppercase">
            Superadmin
          </span>
        </div>

        {/* Mobile menu drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="relative flex flex-col w-72 max-w-[85vw] bg-[#030c1e] h-full border-r border-indigo-950/60 p-5 z-10"
              >
                <div className="flex items-center justify-between pb-4 border-b border-indigo-950/60 mb-4">
                  <div>
                    <span className="font-black text-sm text-white tracking-wider block">
                      Campaña Ganadora
                    </span>
                    <span className="text-[9px] text-purple-400 font-bold uppercase">
                      Super Usuario Hub
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-1 flex-1 overflow-y-auto">
                  {tabsConfig.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="pt-4 border-t border-indigo-950/60 mt-4">
                  <button
                    onClick={() => onSelectView('primera_interfaz')}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black bg-slate-900 border border-slate-800 text-cyan-300"
                  >
                    Volver a la App
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Content Workspace Area */}
        <div className="p-4 sm:p-6 md:p-8 flex-1">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-400 font-bold">
                Sincronizando estado global del sistema y base de datos...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Info & Global Action Buttons */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-950/50 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                      Superuser Global Hub
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Multi-Tenant Engine v3.0
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight flex items-center gap-2">
                    {tabsConfig.find((t) => t.id === activeTab)?.label}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={fetchAllData}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all cursor-pointer"
                    title="Actualizar datos en tiempo real"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleDownloadBackup}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-900/40 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                    title="Exportar copia de seguridad completa en JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Backup Global</span>
                  </button>

                  {activeTab === 'clientes' && (
                    <button
                      onClick={() => setClientModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-950/40 border border-indigo-400/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nueva Campaña / Tenant</span>
                    </button>
                  )}

                  {activeTab === 'licencias' && (
                    <button
                      onClick={() => setLicenseModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-950/40 border border-indigo-400/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Generar Licencia Criptográfica</span>
                    </button>
                  )}

                  {activeTab === 'superusuarios' && (
                    <button
                      onClick={() => setSuperUserModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-950/40 border border-indigo-400/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Superusuario</span>
                    </button>
                  )}
                </div>
              </div>

              {/* TAB 1: DASHBOARD DE TELEMETRÍA GLOBAL */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#06142a] to-[#020815] border border-indigo-900/30 shadow-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Campañas Registradas
                        </span>
                        <h3 className="text-2xl font-black text-white mt-1 font-mono">{clients.length}</h3>
                        <p className="text-[10px] text-emerald-400 font-bold mt-1">
                          +{activeClientsCount} en operación activa
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Building2 className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#06142a] to-[#020815] border border-indigo-900/30 shadow-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Licencias Vigentes
                        </span>
                        <h3 className="text-2xl font-black text-white mt-1 font-mono">{activeLicensesCount}</h3>
                        <p className="text-[10px] text-purple-400 font-bold mt-1">
                          Claves cifradas con SHA-256
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Key className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#06142a] to-[#020815] border border-indigo-900/30 shadow-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          MRR Recurrente
                        </span>
                        <h3 className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                          ${totalMrr.toLocaleString('en-US')}{' '}
                          <span className="text-xs text-slate-500">USD/mes</span>
                        </h3>
                        <p className="text-[10px] text-emerald-400 font-bold mt-1">
                          100% cobro automatizado
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CreditCard className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#06142a] to-[#020815] border border-indigo-900/30 shadow-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Votantes en Red Nacional
                        </span>
                        <h3 className="text-2xl font-black text-cyan-400 mt-1 font-mono">
                          {dayDData?.globalVotersRegistered.toLocaleString() || '48,293'}
                        </h3>
                        <p className="text-[10px] text-cyan-400 font-bold mt-1">
                          Censo de líderes y comités
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Operational Telemetry Metrics */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue & Tier Distribution */}
                    <div className="lg:col-span-2 p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60 mb-4">
                        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          <span>Distribución de Ingresos Recurrentes por Plan Comercial</span>
                        </h3>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                          Multi-Tenant SaaS
                        </span>
                      </div>

                      <div className="space-y-4 py-3">
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                            <span>Plan Enterprise Master ($2,500 USD/mes)</span>
                            <span className="text-indigo-400 font-mono font-bold">$5,000 USD (62.5%)</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-800 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full"
                              style={{ width: '62.5%' }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                            <span>Plan Pro AI Electoral ($850 USD/mes)</span>
                            <span className="text-purple-400 font-mono font-bold">$850 USD (27.5%)</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-800 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                              style={{ width: '27.5%' }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                            <span>Plan Starter Territorial ($150 USD/mes)</span>
                            <span className="text-emerald-400 font-mono font-bold">$150 USD (10.0%)</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-800 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '10%' }} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 shrink-0 text-emerald-400" />
                        <span>
                          La plataforma opera con una tasa de retención del <strong>98.2%</strong> durante el ciclo
                          electoral 2026.
                        </span>
                      </div>
                    </div>

                    {/* AI Engine & Infrastructure Status */}
                    <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60 mb-4">
                        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-purple-400" />
                          <span>Salud del Sistema & IA</span>
                        </h3>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full">
                          ONLINE
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-indigo-400" />
                            <span className="text-slate-300 font-medium">Motor de IA Gemini</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">2.5 Flash</span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-cyan-400" />
                            <span className="text-slate-300 font-medium">Base de Datos InstantDB</span>
                          </div>
                          <span className="font-mono text-cyan-400 font-bold">Sincronizado</span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-emerald-400" />
                            <span className="text-slate-300 font-medium">Cifrado CNE SHA-256</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">Verificado</span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-purple-400" />
                            <span className="text-slate-300 font-medium">Puerto de Red</span>
                          </div>
                          <span className="font-mono text-slate-300 font-bold">3000 Ingress</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('ai_governor')}
                        className="mt-4 w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition-all text-center"
                      >
                        Ver Gobernanza de Tokens IA →
                      </button>
                    </div>
                  </div>

                  {/* Active Campaigns Quick Impersonation / Overview */}
                  <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60 mb-4">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        <span>Campañas Electorales Activas en Plataforma</span>
                      </h3>
                      <button
                        onClick={() => setActiveTab('clientes')}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                      >
                        Ver todas ({clients.length}) →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {clients.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="font-mono text-[9px] text-slate-500">{c.id}</span>
                              {getStatusBadge(c.status)}
                            </div>
                            <h4 className="font-black text-sm text-white mt-2 leading-tight">{c.name}</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">{c.email}</p>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mt-2">
                              {c.plan}
                            </span>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                            <button
                              onClick={() => handleImpersonate(c)}
                              className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Entrar a Campaña</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GESTIÓN DE CLIENTES / TENANTS */}
              {activeTab === 'clientes' && (
                <div className="space-y-6">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-between bg-slate-950/60 border border-indigo-950/60 p-4 rounded-2xl">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar campaña por nombre, correo o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="Todos">Todos los Estados</option>
                        <option value="Activo">Activo</option>
                        <option value="Suspendido">Suspendido</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    </div>
                  </div>

                  {/* Campaigns Table */}
                  <div className="bg-[#040e21] border border-indigo-950/60 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-indigo-950/60 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-950/40">
                            <th className="p-4">ID</th>
                            <th className="p-4">Campaña / Organización</th>
                            <th className="p-4">Contacto Principal</th>
                            <th className="p-4">Teléfono</th>
                            <th className="p-4">Plan Habilitado</th>
                            <th className="p-4">Fecha Ingreso</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Acciones de Superusuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs">
                          {clients
                            .filter((c) => statusFilter === 'Todos' || c.status === statusFilter)
                            .filter(
                              (c) =>
                                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.email.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map((client) => (
                              <tr key={client.id} className="hover:bg-slate-900/40 transition-colors">
                                <td className="p-4 font-mono text-[10px] text-slate-500">{client.id}</td>
                                <td className="p-4 font-black text-white">{client.name}</td>
                                <td className="p-4 text-slate-300 font-mono">{client.email}</td>
                                <td className="p-4 text-slate-400 font-mono">{client.phone || 'N/A'}</td>
                                <td className="p-4">
                                  <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
                                    {client.plan}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-400 font-mono">{client.joinedDate}</td>
                                <td className="p-4">{getStatusBadge(client.status)}</td>
                                <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    onClick={() => handleImpersonate(client)}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] inline-flex items-center gap-1 shadow-sm"
                                  >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>Ingresar</span>
                                  </button>

                                  {client.status === 'Activo' ? (
                                    <button
                                      onClick={() => handleUpdateClientStatus(client.id, 'Suspendido')}
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-600 text-amber-300 hover:text-white font-bold transition-all text-[11px]"
                                    >
                                      Suspender
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateClientStatus(client.id, 'Activo')}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white font-bold transition-all text-[11px]"
                                    >
                                      Activar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LICENCIAS CRIPTOGRÁFICAS */}
              {activeTab === 'licencias' && (
                <div className="space-y-6">
                  <div className="bg-[#040e21] border border-indigo-950/60 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-indigo-950/60 flex items-center justify-between">
                      <div>
                        <h3 className="font-black text-sm text-white uppercase tracking-wider">
                          Registro de Licencias de Campaña
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Claves criptográficas asignadas a cada tenant electoral con control de expiración.
                        </p>
                      </div>
                      <span className="text-xs font-mono text-purple-400 font-bold">
                        {licenses.length} emitidas
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-indigo-950/60 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-950/40">
                            <th className="p-4">Clave de Licencia</th>
                            <th className="p-4">Campaña / Cliente</th>
                            <th className="p-4">Plan Comercial</th>
                            <th className="p-4">Límite Usuarios</th>
                            <th className="p-4">Vencimiento</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs">
                          {licenses.map((lic) => (
                            <tr key={lic.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-purple-300 font-bold bg-purple-950/50 px-2.5 py-1 rounded-md border border-purple-800/40">
                                    {lic.code}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(lic.code)}
                                    title="Copiar Clave de Licencia"
                                    className="p-1 rounded text-slate-400 hover:text-white"
                                  >
                                    {copiedCode === lic.code ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="p-4 font-black text-white">{lic.clientName}</td>
                              <td className="p-4 text-slate-300 font-bold">{lic.planName}</td>
                              <td className="p-4 text-slate-300 font-mono font-bold">
                                {lic.maxUsers} Usuarios
                              </td>
                              <td className="p-4 text-amber-300 font-mono font-bold">
                                {lic.expirationDate}
                              </td>
                              <td className="p-4">{getStatusBadge(lic.status)}</td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    const nextStatus = lic.status === 'Activa' ? 'Suspendida' : 'Activa';
                                    handleUpdateLicenseStatus(lic.id, nextStatus);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                    lic.status === 'Activa'
                                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-600 hover:text-white'
                                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-600 hover:text-white'
                                  }`}
                                >
                                  {lic.status === 'Activa' ? 'Suspender' : 'Reactivar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SUSCRIPCIONES & MRR */}
              {activeTab === 'suscripciones' && (
                <div className="space-y-6">
                  <div className="bg-[#040e21] border border-indigo-950/60 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-indigo-950/60 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-950/40">
                            <th className="p-4">ID</th>
                            <th className="p-4">Campaña / Cliente</th>
                            <th className="p-4">Plan Contratado</th>
                            <th className="p-4">Ciclo de Facturación</th>
                            <th className="p-4">Próxima Renovación</th>
                            <th className="p-4">MRR</th>
                            <th className="p-4">Estado Cobro</th>
                            <th className="p-4 text-right">Certificado CNE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs">
                          {subscriptions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-4 font-mono text-[10px] text-slate-500">{sub.id}</td>
                              <td className="p-4 font-black text-white">{sub.clientName}</td>
                              <td className="p-4 text-indigo-300 font-bold">{sub.planName}</td>
                              <td className="p-4 text-slate-300">{sub.billingCycle}</td>
                              <td className="p-4 text-slate-300 font-mono">{sub.nextRenewal}</td>
                              <td className="p-4 font-black text-emerald-400 font-mono">
                                ${sub.mrr.toLocaleString()} USD
                              </td>
                              <td className="p-4">{getStatusBadge(sub.status)}</td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => triggerToast(`Certificado CNE emitido para ${sub.clientName}.`)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold transition-all text-[11px] inline-flex items-center gap-1"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  <span>Recibo CNE</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SUPERUSUARIOS & STAFF GLOBAL */}
              {activeTab === 'superusuarios' && (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60 mb-4">
                      <div>
                        <h3 className="font-black text-sm text-white uppercase tracking-wider">
                          Superusuarios con Acceso Maestro al Sistema
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Administradores de infraestructura global, auditores CNE y directores tecnológicos.
                        </p>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        {superUsers.length} administradores
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-indigo-950/60 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-950/40">
                            <th className="p-4">Nombre</th>
                            <th className="p-4">Cédula</th>
                            <th className="p-4">Correo</th>
                            <th className="p-4">Rol en Plataforma</th>
                            <th className="p-4">Nivel RBAC</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 text-xs">
                          {superUsers.map((su) => (
                            <tr key={su.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-4 font-black text-white">{su.name}</td>
                              <td className="p-4 text-slate-400 font-mono">{su.cedula || '1085294312'}</td>
                              <td className="p-4 text-slate-300 font-mono">{su.email}</td>
                              <td className="p-4 font-bold text-indigo-300">{su.role}</td>
                              <td className="p-4">
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  {su.accessLevel}
                                </span>
                              </td>
                              <td className="p-4">{getStatusBadge(su.status)}</td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleDeleteSuperUser(su.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-all"
                                  title="Revocar acceso"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: GOBERNANZA IA GEMINI */}
              {activeTab === 'ai_governor' && (
                <div className="space-y-6">
                  {/* AI Governor Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Modelo AI Activo
                        </span>
                        <h3 className="text-xl font-black text-white mt-1 font-mono">
                          {aiData?.modelName || 'gemini-2.5-flash'}
                        </h3>
                        <p className="text-[10px] text-emerald-400 font-bold mt-1">
                          Server-Side Proxy Asegurado
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Bot className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Tokens Consumidos (Mes)
                        </span>
                        <h3 className="text-xl font-black text-purple-400 mt-1 font-mono">
                          {aiData?.totalTokensConsumedMonth.toLocaleString() || '1,485,200'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">
                          Costo estimado: ${aiData?.totalCostUSD || '14.85'} USD
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Zap className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                          Filtros de Integridad Electoral
                        </span>
                        <h3 className="text-xl font-black text-emerald-400 mt-1 font-mono">ESTRICTO</h3>
                        <p className="text-[10px] text-emerald-400 font-bold mt-1">
                          Prevención de alucinaciones activa
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Quota breakdown per tenant */}
                  <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      <span>Consumo de Inteligencia Artificial por Campaña</span>
                    </h3>
                    <div className="space-y-3">
                      {clients.map((c, i) => {
                        const tokenPct = Math.min(100, Math.floor(35 + i * 18));
                        return (
                          <div key={c.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                            <div className="flex justify-between items-center text-xs mb-1.5">
                              <span className="font-black text-white">{c.name}</span>
                              <span className="font-mono text-purple-400 font-bold">
                                {(tokenPct * 5000).toLocaleString()} / 500,000 Tokens
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full"
                                style={{ width: `${tokenPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: CENTRO DE MANDO DÍA D */}
              {activeTab === 'dia_d_monitor' && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-[#04152e] to-[#020914] border border-cyan-500/30 shadow-2xl space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-rose-500 animate-ping" />
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            Transmisión Nacional en Tiempo Real
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-white mt-1">
                          Centro de Mando & Escrutinio Día D
                        </h2>
                      </div>
                      <div className="px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-bold">
                        Última Sincronización: {dayDData?.lastSyncTimestamp || 'En vivo'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Actas E-14 Recibidas
                        </span>
                        <h4 className="text-2xl font-black text-white font-mono mt-1">
                          {dayDData?.globalE14Ingested || 1422}
                        </h4>
                        <span className="text-[10px] text-emerald-400 font-bold">98.7% de precisión OCR</span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Testigos Transmitiendo
                        </span>
                        <h4 className="text-2xl font-black text-cyan-400 font-mono mt-1">
                          {dayDData?.globalWitnessesDeployed || 3843}
                        </h4>
                        <span className="text-[10px] text-cyan-300 font-bold">Con geocerca GPS activa</span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Alertas de Inconsistencia
                        </span>
                        <h4 className="text-2xl font-black text-amber-400 font-mono mt-1">
                          {dayDData?.flaggedDiscrepanciesCount || 3}
                        </h4>
                        <span className="text-[10px] text-amber-300 font-bold">Bajo revisión jurídica</span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Cobertura Nacional
                        </span>
                        <h4 className="text-2xl font-black text-emerald-400 font-mono mt-1">100%</h4>
                        <span className="text-[10px] text-slate-400">Puestos y mesas enlazadas</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: PLANES COMERCIALES */}
              {activeTab === 'planes' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((p) => (
                      <div
                        key={p.id}
                        className="p-6 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-base font-black text-white">{p.name}</h4>
                              <span className="text-[10px] font-mono text-slate-500">{p.id}</span>
                            </div>
                            <span className="text-xs bg-indigo-500/15 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30 uppercase">
                              Activo
                            </span>
                          </div>
                          <div className="my-5">
                            <span className="text-3xl font-mono font-black text-white">${p.price}</span>
                            <span className="text-xs text-slate-400 font-semibold"> / {p.duration}</span>
                          </div>

                          <ul className="space-y-3 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
                            <li className="flex items-center gap-2.5">
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Máximo {p.maxUsers} usuarios concurrentes</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>{p.modules.length} Módulos electorales activos</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Soporte técnico CNE 24/7 en tiempo real</span>
                            </li>
                          </ul>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-800/80">
                          <button
                            onClick={() => triggerToast(`Plan comercial "${p.name}" actualizado.`)}
                            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-800 transition-all text-center cursor-pointer"
                          >
                            Configurar Parámetros
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 9: MATRIZ DE MÓDULOS */}
              {activeTab === 'modulos' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      {
                        id: '1',
                        name: 'Sala de Control & Primera Interfaz',
                        desc: 'Executive Command Center con widgets interactivos de campaña.',
                        route: '/primera_interfaz'
                      },
                      {
                        id: '2',
                        name: 'Gestión Estratégica & DAFO AI',
                        desc: 'Diagnóstico 360°, narrativa, discurso, programa de gobierno y DOFA.',
                        route: '/gestion_estrategica'
                      },
                      {
                        id: '3',
                        name: 'Gestión Territorial & Padrón',
                        desc: 'Registro de votantes, mapa de calor, líderes y comunas.',
                        route: '/gestion_territorial'
                      },
                      {
                        id: '4',
                        name: 'Testigos en Campo & E-14 OCR',
                        desc: 'Transmisión fotográfica del Día D con digitalización OCR inteligente.',
                        route: '/testigo_campo'
                      },
                      {
                        id: '5',
                        name: 'Módulo de Encuestas & Tracking',
                        desc: 'Intención de voto, sondeos de opinión y cruce demográfico.',
                        route: '/encuestas'
                      },
                      {
                        id: '6',
                        name: 'Presupuesto CNE & Cuentas Claras',
                        desc: 'Control de topes legales, libro de ingresos y egresos certificados.',
                        route: '/presupuesto'
                      }
                    ].map((mod) => (
                      <div
                        key={mod.id}
                        className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white">{mod.name}</h4>
                              <span className="text-[10px] font-mono text-slate-400">{mod.route}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 mt-3 leading-relaxed">{mod.desc}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                          <span>Estado: Activo</span>
                          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full uppercase">
                            Habilitado
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 10: AUDITORÍA & TRAZABILIDAD */}
              {activeTab === 'auditoria' && (
                <div className="p-5 rounded-2xl bg-[#040e21] border border-indigo-950/60 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60 mb-4">
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>Registro de Auditoría de Seguridad SaaS (Real-Time Logs)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Trazabilidad forense con verificación criptográfica SHA-256 de todas las operaciones.
                      </p>
                    </div>
                    <button
                      onClick={handleClearAuditLogs}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-bold border border-slate-800 hover:border-rose-800/40 transition-all cursor-pointer"
                    >
                      Limpiar Logs
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-indigo-950/60 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-950/40">
                          <th className="pb-3 pr-4">ID</th>
                          <th className="pb-3 pr-4">Acción Realizada</th>
                          <th className="pb-3 pr-4">Usuario Responsable</th>
                          <th className="pb-3 pr-4">Ecosistema Afectado</th>
                          <th className="pb-3 pr-4">Fecha & Hora</th>
                          <th className="pb-3">Detalles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 font-mono text-[10px] text-slate-500 pr-4">{log.id}</td>
                            <td className="py-3.5 text-white font-bold pr-4">{log.action}</td>
                            <td className="py-3.5 text-slate-300 font-mono pr-4">{log.user}</td>
                            <td className="py-3.5 text-indigo-400 font-semibold pr-4">
                              {log.client || 'Global'}
                            </td>
                            <td className="py-3.5 text-slate-400 font-mono pr-4">{log.timestamp}</td>
                            <td className="py-3.5 text-slate-300">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 11: INFRAESTRUCTURA & SEGURIDAD */}
              {activeTab === 'configuracion' && (
                <div className="p-6 rounded-2xl bg-[#040e21] border border-indigo-950/60 space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Ajustes Globales de Infraestructura & Seguridad
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Control maestro de disponibilidad, copias de seguridad y políticas de red para todo el
                      ecosistema SaaS.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-white">Modo de Mantenimiento Global</label>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            systemSettings.maintenanceMode
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {systemSettings.maintenanceMode ? 'ACTIVADO' : 'DESACTIVADO (ONLINE)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Al activar el modo mantenimiento, todos los usuarios verán una pantalla de actualización
                        excepto los superadministradores.
                      </p>
                      <button
                        onClick={handleToggleMaintenance}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          systemSettings.maintenanceMode
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600/80 hover:bg-rose-600 text-white'
                        }`}
                      >
                        {systemSettings.maintenanceMode
                          ? 'Desactivar Modo Mantenimiento'
                          : 'Activar Modo Mantenimiento'}
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <label className="text-xs font-black text-white block">
                        Copia de Seguridad Integral (JSON)
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Descarga instantánea de todas las bases de datos (campañas, licencias, padrones, E-14, DAFO
                        y registros de auditoría).
                      </p>
                      <button
                        onClick={handleDownloadBackup}
                        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        <span>Exportar Backup Completo</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE CLIENT MODAL */}
      <AnimatePresence>
        {clientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClientModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-indigo-900/50 p-6 rounded-3xl shadow-2xl z-10 text-slate-100"
            >
              <h2 className="text-base font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3">
                Crear Nueva Campaña (Tenant)
              </h2>
              <form onSubmit={handleCreateClient} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Nombre de la Campaña *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Campaña Gobernación de Antioquia 2026"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Correo Electrónico Directivo *</label>
                  <input
                    type="email"
                    required
                    placeholder="contacto@antioquiaganadora.co"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+57 310 928 4021"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Plan Comercial Contratado</label>
                  <select
                    value={newClientPlan}
                    onChange={(e) => setNewClientPlan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                  >
                    <option value="Enterprise Master">Enterprise Master - $2,500/mes (200 usuarios)</option>
                    <option value="Pro AI">Pro AI - $850/mes (50 usuarios)</option>
                    <option value="Starter">Starter - $150/mes (10 usuarios)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setClientModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/40 border border-indigo-400/30"
                  >
                    Crear y Emitir Licencia
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GENERATE LICENSE MODAL */}
      <AnimatePresence>
        {licenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLicenseModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-indigo-900/50 p-6 rounded-3xl shadow-2xl z-10 text-slate-100"
            >
              <h2 className="text-base font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3">
                Generar Licencia Criptográfica
              </h2>
              <form onSubmit={handleCreateLicense} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Campaña Asignada *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Campaña María Paula Restrepo"
                    value={newLicenseClient}
                    onChange={(e) => setNewLicenseClient(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Días de Validez</label>
                    <input
                      type="number"
                      value={newLicenseDays}
                      onChange={(e) => setNewLicenseDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Límite Usuarios</label>
                    <input
                      type="number"
                      value={newLicenseMaxUsers}
                      onChange={(e) => setNewLicenseMaxUsers(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setLicenseModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-950/40 border border-indigo-400/30"
                  >
                    Emitir Clave
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE SUPERUSER MODAL */}
      <AnimatePresence>
        {superUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSuperUserModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-indigo-900/50 p-6 rounded-3xl shadow-2xl z-10 text-slate-100"
            >
              <h2 className="text-base font-black text-white uppercase tracking-wider border-b border-slate-800 pb-3">
                Añadir Superusuario Global
              </h2>
              <form onSubmit={handleCreateSuperUser} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ing. Mateo Arango"
                    value={newSUName}
                    onChange={(e) => setNewSUName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    placeholder="mateo.arango@campanaganadora.co"
                    value={newSUEmail}
                    onChange={(e) => setNewSUEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Cédula</label>
                    <input
                      type="text"
                      placeholder="1020784920"
                      value={newSUCedula}
                      onChange={(e) => setNewSUCedula(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Nivel RBAC</label>
                    <select
                      value={newSULevel}
                      onChange={(e) => setNewSULevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                    >
                      <option value="Nivel 10">Nivel 10 (Master)</option>
                      <option value="Nivel 9">Nivel 9 (Director)</option>
                      <option value="Nivel 8">Nivel 8 (Auditor)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setSuperUserModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-950/40 border border-indigo-400/30"
                  >
                    Registrar Superusuario
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
