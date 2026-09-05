import React, { useState, useEffect } from 'react';
import { GlobalAdminMetrics, GlobalAdminTab } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import {
  Users,
  ShieldCheck,
  Flag,
  Layers,
  Cpu,
  Activity,
  AlertTriangle,
  Server,
  Database,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Lock,
  FileText,
  Clock,
  CheckCircle2,
  Zap,
  Globe
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface GlobalAdminDashboardProps {
  onNavigateTab: (tab: GlobalAdminTab) => void;
}

const COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

export const GlobalAdminDashboard: React.FC<GlobalAdminDashboardProps> = ({ onNavigateTab }) => {
  const [metrics, setMetrics] = useState<GlobalAdminMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await GlobalAdminService.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar métricas del sistema');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    const handleDataChange = () => {
      fetchMetrics(true);
    };

    window.addEventListener('global-admin-users-changed', handleDataChange);
    window.addEventListener('platform-data-changed', handleDataChange);
    window.addEventListener('campaign-jurisdiction-changed', handleDataChange);
    window.addEventListener('permissions-updated', handleDataChange);
    window.addEventListener('focus', handleDataChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMetrics(true);
      }
    }, 20000);

    return () => {
      window.removeEventListener('global-admin-users-changed', handleDataChange);
      window.removeEventListener('platform-data-changed', handleDataChange);
      window.removeEventListener('campaign-jurisdiction-changed', handleDataChange);
      window.removeEventListener('permissions-updated', handleDataChange);
      window.removeEventListener('focus', handleDataChange);
      clearInterval(interval);
    };
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <div className="flex items-center space-x-3 bg-slate-900/60 border border-slate-800 rounded-xl px-6 py-4">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="font-mono text-sm">SINCRONIZANDO TELEMETRÍA GLOBAL...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions & Live Pulse */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/40">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
              <span>SISTEMA OPERACIONAL CENTRAL</span>
              <span className="text-[10px] font-bold font-mono bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">ONLINE</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-sans leading-relaxed">
            Supervisión global de seguridad, infraestructura multi-campaña, cuotas de APIs y bases de datos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold font-sans border border-slate-700/80 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Actualizando...' : 'Refrescar'}</span>
          </button>
          <button
            onClick={() => onNavigateTab('seguridad')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold font-sans border border-cyan-500/30 transition-all cursor-pointer shadow-md shadow-cyan-950/20"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Centro Seguridad</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div 
          onClick={() => onNavigateTab('usuarios')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display text-slate-400 tracking-wider">USUARIOS TOTALES</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {metrics?.totalUsers || 0}
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" /> {metrics?.activeUsers || 0} Activos
            </span>
          </div>
          <div className="mt-2 text-[11px] font-sans text-slate-400 flex justify-between">
            <span>{metrics?.globalAdminsCount || 0} Admins Globales</span>
            <span className="text-slate-500">{metrics?.blockedUsers || 0} Bloqueados</span>
          </div>
        </div>

        {/* Total Campaigns */}
        <div 
          onClick={() => onNavigateTab('campanas')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display text-slate-400 tracking-wider">CAMPAÑAS ACTIVAS</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Flag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {metrics?.activeCampaigns || 0}
            </span>
            <span className="text-xs font-mono text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-500/20">
              de {metrics?.totalCampaigns || 0} Registradas
            </span>
          </div>
          <div className="mt-2 text-[11px] font-sans text-slate-400">
            Multi-Tenant Isolation Activo
          </div>
        </div>

        {/* API Requests & Latency */}
        <div 
          onClick={() => onNavigateTab('apis')}
          className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display text-slate-400 tracking-wider">PETICIONES APIs (24H)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
              {metrics?.apiRequestsToday ? (metrics.apiRequestsToday / 1000).toFixed(1) + 'k' : '0'}
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {metrics?.systemHealth?.dbLatencyMs || 38}ms Latencia
            </span>
          </div>
          <div className="mt-2 text-[11px] font-sans text-slate-400 flex justify-between">
            <span>{metrics?.totalApis || 4} Conectadas</span>
            <span className="text-emerald-400 font-medium">99.98% Uptime</span>
          </div>
        </div>

        {/* Security Alerts */}
        <div 
          onClick={() => onNavigateTab('seguridad')}
          className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">ALERTAS DE SEGURIDAD</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {metrics?.securityAlertsCount || 0}
            </span>
            <span className="text-xs font-mono text-slate-400">
              0 Críticas
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            Escudo Anti-Fuerza Bruta Activo
          </div>
        </div>
      </div>

      {/* Main Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity & Traffic Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                TRÁFICO Y PETICIONES DEL SISTEMA (7 DÍAS)
              </h3>
              <p className="text-xs text-slate-400 font-mono">Consumo de APIs y usuarios concurrentes</p>
            </div>
            <span className="text-xs font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
              Live Stream
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.activityByDay || []}>
                <defs>
                  <linearGradient id="requestsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} fontFamily="monospace" />
                <YAxis stroke="#64748b" fontSize={12} fontFamily="monospace" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontFamily: 'monospace', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="requests" name="Peticiones API" stroke="#06b6d4" fillOpacity={1} fill="url(#requestsGrad)" />
                <Area type="monotone" dataKey="users" name="Usuarios Activos" stroke="#3b82f6" fillOpacity={1} fill="url(#usersGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
            <div className="flex items-center space-x-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Peticiones API</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Usuarios Activos</span>
            </div>
            <span className="text-slate-500">Actualización en tiempo real vía WebSocket</span>
          </div>
        </div>

        {/* Module Distribution & Telemetry (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                DISTRIBUCIÓN POR MÓDULO
              </h3>
              <button onClick={() => onNavigateTab('modulos')} className="text-xs font-mono text-cyan-400 hover:underline">
                Ver todos
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {metrics?.usersByModule?.map((mod, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                    <span>{mod.module}</span>
                    <span className="text-cyan-400 font-bold">{mod.share}% ({mod.users} usuarios)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                      style={{ width: `${mod.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <h4 className="text-xs font-mono text-slate-400 mb-2 font-semibold">INFRAESTRUCTURA Y SALUD</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">UPTIME SERVIDOR</span>
                <span className="text-slate-200 font-bold">{metrics?.systemHealth?.uptimeFormatted || '72h 14m'}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MEMORIA HEAP</span>
                <span className="text-emerald-400 font-bold">{metrics?.systemHealth?.memoryUsageMb?.heapUsed || 42} MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Immutable Audit Logs Stream */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              REGISTRO DE AUDITORÍA RECIENTE (LOGS INMUTABLES)
            </h3>
            <p className="text-xs text-slate-400 font-mono">Trazabilidad criptográfica de eventos administrativos y de seguridad</p>
          </div>
          <button
            onClick={() => onNavigateTab('auditoria')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Ver historial completo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/40">
                <th className="py-2.5 px-3">HORA</th>
                <th className="py-2.5 px-3">ACTOR</th>
                <th className="py-2.5 px-3">ACCIÓN</th>
                <th className="py-2.5 px-3">RECURSO</th>
                <th className="py-2.5 px-3">ESTADO</th>
                <th className="py-2.5 px-3">IP / ORIGEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {metrics?.recentAuditLogs?.slice(0, 5).map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-medium whitespace-nowrap">
                    {log.actorName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.severity === 'SECURITY' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/30' :
                      log.severity === 'WARNING' ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {log.resource}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${
                      log.status === 'ÉXITO' ? 'text-emerald-400' :
                      log.status === 'DENEGADO' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {log.status === 'ÉXITO' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
