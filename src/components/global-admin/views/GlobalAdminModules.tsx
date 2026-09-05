import React, { useState, useEffect } from 'react';
import { GlobalAdminModuleConfig } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import {
  Layers,
  Power,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Activity,
  Sliders,
  CheckSquare,
  Square,
  ShieldCheck
} from 'lucide-react';

export const GlobalAdminModules: React.FC = () => {
  const [modules, setModules] = useState<GlobalAdminModuleConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await GlobalAdminService.getModules();
      setModules(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar módulos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleModule = async (module: GlobalAdminModuleConfig, enable: boolean) => {
    try {
      await GlobalAdminService.toggleModule(module.id, enable, undefined);
      setSuccessMsg(`Módulo "${module.name}" ${enable ? 'habilitado' : 'deshabilitado'}.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al modificar estado del módulo');
    }
  };

  const handleToggleMaintenance = async (module: GlobalAdminModuleConfig, maintenance: boolean) => {
    try {
      await GlobalAdminService.toggleModule(module.id, undefined, maintenance);
      setSuccessMsg(`Modo mantenimiento de "${module.name}" ${maintenance ? 'activado' : 'desactivado'}.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al modificar mantenimiento');
    }
  };

  const handleToggleFeature = async (module: GlobalAdminModuleConfig, featureId: string, enabled: boolean) => {
    try {
      await GlobalAdminService.toggleModuleFeature(module.id, featureId, enabled);
      setSuccessMsg(`Característica actualizada en "${module.name}".`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al modificar funcionalidad');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/40">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-4 h-4" />
            </span>
            <span>SUPERVISIÓN Y CONTROL DE MÓDULOS DEL SISTEMA</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1.5 leading-relaxed">
            Control de interruptores maestros (Feature Flags), mantenimiento aislado y monitoreo de dependencias para los 3 módulos troncales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold font-sans border border-slate-700/80 transition-all cursor-pointer shadow-sm hover:shadow-cyan-950/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Modules List Grid (Only the 3 official system modules) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 font-sans">
        {modules
          .filter((mod) => ['modulo_admin', 'gestion_estrategica', 'gestion_territorial'].includes(mod.code))
          .map((mod) => (
          <div
            key={mod.id}
            className={`border rounded-2xl p-5 sm:p-6 backdrop-blur-md transition-all duration-300 shadow-xl flex flex-col justify-between ${
              mod.maintenanceMode
                ? 'bg-amber-950/20 border-amber-500/40 shadow-amber-950/20'
                : mod.isEnabled
                ? 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700/90'
                : 'bg-slate-950/70 border-slate-800/60 opacity-70'
            }`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white font-display tracking-tight">{mod.name}</h3>
                  <span className="text-[10px] font-semibold bg-cyan-950/70 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 uppercase tracking-wider font-mono">
                    {mod.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{mod.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleModule(mod, !mod.isEnabled)}
                  title={mod.isEnabled ? 'Deshabilitar módulo' : 'Habilitar módulo'}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    mod.isEnabled
                      ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900 hover:shadow-lg hover:shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleMaintenance(mod, !mod.maintenanceMode)}
                  title={mod.maintenanceMode ? 'Desactivar modo mantenimiento' : 'Poner en mantenimiento'}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    mod.maintenanceMode
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900 hover:shadow-lg hover:shadow-amber-950/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metrics pills */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-4">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold tracking-wider block uppercase mb-0.5">USUARIOS 24H</span>
                <span className="text-white font-extrabold text-sm sm:text-base font-mono">{mod.activeUsers24h}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-semibold tracking-wider block uppercase mb-0.5">PETICIONES API</span>
                <span className="text-cyan-400 font-extrabold text-sm sm:text-base font-mono">{mod.apiRequests24h?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-semibold tracking-wider block uppercase mb-0.5">TASA ERRORES</span>
                <span className="text-emerald-400 font-extrabold text-sm sm:text-base font-mono">{mod.errorRatePct}%</span>
              </div>
            </div>

            {/* Feature Flags */}
            <div className="mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-display">
                INTERRUPTORES DE FUNCIONALIDAD (FEATURE FLAGS)
              </span>
              <div className="space-y-2">
                {mod.features?.map((feat) => (
                  <div
                    key={feat.id}
                    onClick={() => handleToggleFeature(mod, feat.id, !feat.enabled)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                      feat.enabled
                        ? 'bg-cyan-950/30 border-cyan-500/30 text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 font-medium">
                      {feat.enabled ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                      <span>{feat.name}</span>
                    </span>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${feat.enabled ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-500/30' : 'text-slate-500 bg-slate-900 border border-slate-800'}`}>
                      {feat.enabled ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dependencies */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium text-xs">Dependencias:</span>
              {mod.dependencies?.map((dep, idx) => (
                <span key={idx} className="bg-slate-800/80 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs font-mono">
                  {dep}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
