import React, { useState, useEffect } from 'react';
import { GlobalAdminSecurityEvent } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import { confirmModal, showToast } from '../../common/ConfirmModal';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Slash,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  UserX,
  Radio,
  Clock,
  Laptop
} from 'lucide-react';

export const GlobalAdminSecurity: React.FC = () => {
  const [events, setEvents] = useState<GlobalAdminSecurityEvent[]>([]);
  const [blockedIps, setBlockedIps] = useState<{ ip: string; reason: string; blockedAt: string }[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [ipToBlock, setIpToBlock] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await GlobalAdminService.getSecurityEvents();
      setEvents(data.events);
      setBlockedIps(data.blockedIps);
      setActiveSessions(data.activeSessions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar eventos de seguridad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToBlock) return;
    try {
      await GlobalAdminService.blockIp(ipToBlock, blockReason || 'Bloqueo administrativo manual');
      setSuccessMsg(`IP ${ipToBlock} añadida a la lista de bloqueo.`);
      setIpToBlock('');
      setBlockReason('');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al bloquear IP');
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await GlobalAdminService.unblockIp(ip);
      setSuccessMsg(`IP ${ip} desbloqueada.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al desbloquear IP');
    }
  };

  const handleRevokeSession = async (email: string) => {
    await confirmModal({
      title: 'Revocar sesiones activas',
      message: `¿Revocar todas las sesiones activas para "${email}"? El usuario deberá volver a iniciar sesión.`,
      confirmText: 'Sí, revocar sesiones',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await GlobalAdminService.revokeSession(email);
          setSuccessMsg(`Sesiones revocadas para ${email}.`);
          showToast(`Sesiones revocadas para ${email}.`, 'success');
          fetchData();
          setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err: any) {
          setError(err.message || 'Error al revocar sesión');
          showToast(err.message || 'Error al revocar sesión', 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/40">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <span>CENTRO DE SEGURIDAD & PREVENCIÓN DE AMENAZAS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">
            Detección de intrusiones, bloqueo perimetral de IPs hostiles y gestión de sesiones criptográficas.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold font-sans border border-slate-700/80 transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refrescar Seguridad</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-sans flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 font-sans flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Grid for Security Actions & IP Blocklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Block IP Form (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold font-display text-white mb-2 flex items-center gap-2">
              <Slash className="w-4 h-4 text-rose-400" />
              <span>BLOQUEO PERIMETRAL DE IP</span>
            </h3>
            <p className="text-slate-400 mb-4 text-xs leading-relaxed font-sans">
              Agrega una IP hostil a la lista de denegación inmediata en el proxy del backend.
            </p>

            <form onSubmit={handleBlockIp} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-medium mb-1 text-xs">Dirección IP (IPv4 / IPv6)</label>
                <input
                  type="text"
                  required
                  value={ipToBlock}
                  onChange={(e) => setIpToBlock(e.target.value)}
                  placeholder="Ej: 190.14.23.88"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 text-xs">Motivo del Bloqueo</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ej: Fuerza bruta reiterada"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 font-sans text-xs focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-950/40"
              >
                Bloquear Dirección IP
              </button>
            </form>
          </div>

          {/* Blocked IPs count */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
            {blockedIps.length} direcciones IP actualmente bloqueadas.
          </div>
        </div>

        {/* Blocked IPs List (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-cyan-400" />
            DIRECCIONES IP BLOQUEADAS ({blockedIps.length})
          </h3>

          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/60">
                  <th className="py-2.5 px-3">IP ADDRESS</th>
                  <th className="py-2.5 px-3">MOTIVO</th>
                  <th className="py-2.5 px-3">FECHA BLOQUEO</th>
                  <th className="py-2.5 px-3 text-right">ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {blockedIps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No hay direcciones IP bloqueadas actualmente.
                    </td>
                  </tr>
                ) : (
                  blockedIps.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-rose-300 font-bold">{item.ip}</td>
                      <td className="py-2.5 px-3 text-slate-300">{item.reason}</td>
                      <td className="py-2.5 px-3 text-slate-500">{new Date(item.blockedAt).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleUnblockIp(item.ip)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                        >
                          Desbloquear
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Active Sessions & Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
            <Laptop className="w-4 h-4 text-cyan-400" />
            SESIONES ADMINISTRATIVAS ACTIVAS ({activeSessions.length})
          </h3>

          <div className="space-y-2.5">
            {activeSessions.map((s, idx) => (
              <div key={idx} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">{s.name}</span>
                  <span className="text-[11px] text-slate-400">{s.email} • IP: {s.ip}</span>
                  <span className="text-[10px] text-slate-500 block">Token: {s.tokenMasked}</span>
                </div>
                <button
                  onClick={() => handleRevokeSession(s.email)}
                  className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] border border-rose-500/30 flex items-center gap-1"
                >
                  <UserX className="w-3 h-3" />
                  <span>Revocar</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security Incident Alarms */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-amber-400" />
            REGISTRO DE INCIDENTES Y ALARMAS ({events.length})
          </h3>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {events.map((ev) => (
              <div key={ev.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    ev.severity === 'CRITICAL' || ev.severity === 'HIGH'
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}>
                    {ev.type}
                  </span>
                  <span className="text-[10px] text-slate-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-slate-300 text-xs mt-1">{ev.description}</p>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                  <span>Origen IP: {ev.sourceIp}</span>
                  <span className={ev.resolved ? 'text-emerald-400' : 'text-amber-400'}>
                    {ev.resolved ? '✓ Resuelto' : '⚠️ Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
