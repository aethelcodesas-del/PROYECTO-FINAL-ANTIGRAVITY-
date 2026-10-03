import React from 'react';
import { motion } from 'motion/react';
import { AuthUser } from '../../types';
import { useCampaignData } from '../../contexts/CampaignContext';
import { Clock, MapPin } from 'lucide-react';

export interface VotanteRegistrado {
  id: string;
  cedula: string;
  nombreCompleto: string;
  telefono: string;
  barrio: string;
  comunaSector: string;
  puestoVotacion: string;
  direccionPuesto: string;
  mesa: number;
  liderAsignado: string;
  liderId?: string;
  intencionVoto: 'Voto Seguro' | 'En Duda' | 'Simpatizante' | 'Reclutado';
  requiereTransporte: boolean;
  observaciones: string;
  fechaRegistro: string;
  estadoCenso: string;
  circunscripcion: string;
}

export interface VotanteArchivado {
  id: string;
  cedula: string;
  nombreCompleto: string;
  telefono: string;
  barrio: string;
  liderAsignado: string;
  liderId?: string;
  circunscripcionOriginal: string;
  puestoOriginal: string;
  motivo: string;
  fechaArchivado: string;
  fechaUltimaConsultaApi: string;
  estadoCne: string;
  puestoNuevo?: any;
}

export interface RegistroVotantesViewProps {
  onSelectView?: (view: any) => void;
  authUser?: AuthUser | null;
  onSwitchToMap?: () => void;
  onSelectSubTab?: (tab: 'registro' | 'mapa') => void;
}

export const RegistroVotantesView: React.FC<RegistroVotantesViewProps> = ({
  onSelectView,
  onSelectSubTab,
  onSwitchToMap
}) => {
  const campaignCtx = useCampaignData();
  const municipality = campaignCtx.municipality || 'Cotorra';
  const department = campaignCtx.department || 'Córdoba';

  const handleNavigateToMap = () => {
    if (onSelectSubTab) {
      onSelectSubTab('mapa');
    } else if (onSwitchToMap) {
      onSwitchToMap();
    } else if (onSelectView) {
      onSelectView('gestion_territorial');
    }
  };

  return (
    <div className="registro-votantes-view p-4 sm:p-6 md:p-8 max-w-5xl mx-auto min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-[#030d1d] border border-cyan-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center space-y-6"
      >
        {/* Glow ambient background effects */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-4 max-w-xl mx-auto">
          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-cyan-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-2">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/35 text-xs font-mono font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Estado del Módulo
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Próximo a Desarrollar
          </h1>

          <p className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">
            Módulo de Registro de Votantes
          </p>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium pt-1">
            Esta funcionalidad se encuentra en planificación técnica para el control de censo y gestión territorial de {municipality} ({department}).
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleNavigateToMap}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-teal-400/40 hover:border-emerald-300"
            >
              <MapPin className="w-4 h-4 text-emerald-200" />
              <span>Ir a Mapa & Cobertura</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
