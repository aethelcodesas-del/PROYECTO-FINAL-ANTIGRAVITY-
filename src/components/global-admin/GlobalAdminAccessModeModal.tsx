import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  LayoutGrid, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  LogOut,
  Sliders,
  EyeOff
} from 'lucide-react';
import { AuthUser } from '../../types';

interface GlobalAdminAccessModeModalProps {
  isOpen: boolean;
  user: AuthUser | null;
  onSelectGovernance: () => void;
  onSelectModulesExploration: () => void;
  onCancelLogout: () => void;
}

export const GlobalAdminAccessModeModal: React.FC<GlobalAdminAccessModeModalProps> = ({
  isOpen,
  user,
  onSelectGovernance,
  onSelectModulesExploration,
  onCancelLogout,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#020617]/85 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 text-slate-100 z-10 overflow-hidden font-sans"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          {/* Header */}
          <div className="flex items-start justify-between pb-5 border-b border-slate-800 relative z-10">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-950 to-blue-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    Credenciales Validadas
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    TLS 1.3
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white mt-1 font-display">
                  MODO DE ACCESO - ADMINISTRADOR GLOBAL
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bienvenido, <strong className="text-slate-200">{user?.name || user?.email || 'Superadministrador'}</strong>. Seleccione el entorno al que desea acceder para esta sesión:
                </p>
              </div>
            </div>

            <button
              onClick={onCancelLogout}
              title="Cancelar e Iniciar Sesión con otra cuenta"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-5 h-5 text-slate-400 hover:text-rose-400" />
            </button>
          </div>

          {/* Destination Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 relative z-10">
            {/* Option 1: Global Governance Panel */}
            <div 
              onClick={onSelectGovernance}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-slate-950/90 to-slate-900/90 border border-slate-800 hover:border-cyan-500/60 shadow-lg hover:shadow-cyan-950/40 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/15 transition-all pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Gobernanza Central
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors font-display">
                  Panel de Gobernanza Global
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Supervisión de infraestructura, licencias corporativas, usuarios transversales, seguridad y logs de auditoría.
                </p>

                <div className="mt-3.5 space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Control de plataformas y métricas de cuotas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Matriz RBAC, APIs y fuentes oficiales</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">
                  Acceder a Gobernanza
                </span>
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:translate-x-1 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Option 2: System Modules Exploration (Zero-Access Mode) */}
            <div 
              onClick={onSelectModulesExploration}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-slate-950/90 to-slate-900/90 border border-slate-800 hover:border-violet-500/60 shadow-lg hover:shadow-violet-950/40 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/15 transition-all pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                    <EyeOff className="w-3 h-3" />
                    Cero-Acceso Estricto
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors font-display">
                  Exploración de Módulos
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Acceso estructural a todas las vistas para validación de interfaz y flujos sin vincular datos privados de campañas.
                </p>

                <div className="mt-3.5 space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>Validación de pantallas y responsive design</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>Total aislamiento: contadores en cero (0)</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-400 group-hover:text-violet-300">
                  Explorar Módulos
                </span>
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:translate-x-1 group-hover:bg-violet-500 group-hover:text-slate-950 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Confidentiality Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5 relative z-10">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-slate-300">POLÍTICA ZERO-KNOWLEDGE:</strong> En modo exploración, las vistas operan con aislamiento de cliente (<code className="text-cyan-300 font-mono">campana_id = null</code>) para garantizar la soberanía de la información de los candidatos.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
