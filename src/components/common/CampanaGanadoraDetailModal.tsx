import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CampanaGanadoraItem } from '../../data/campanaGanadoraModules';
import {
  X,
  Sparkles,
  Bot,
  Calculator,
  BarChart3,
  FileText,
  Radio,
  Users,
  MapPin,
  Target,
  Send,
  Sliders,
  Vote,
  ShieldCheck,
  LayoutDashboard,
  CheckCircle2,
  Lock,
  Building2,
  Award,
  Database,
  Layers,
  ArrowRight,
  Scale,
  Shield,
  Check
} from 'lucide-react';

interface CampanaGanadoraDetailModalProps {
  item: CampanaGanadoraItem | null;
  onClose: () => void;
  onSelectModule?: (item: CampanaGanadoraItem) => void;
  onLogin?: () => void;
}

export const CampanaGanadoraDetailModal: React.FC<CampanaGanadoraDetailModalProps> = ({
  item,
  onClose,
  onSelectModule,
  onLogin
}) => {
  if (!item) return null;

  // Icon mapping
  const renderIcon = (iconName: string, className = "w-6 h-6") => {
    switch (iconName) {
      case 'Bot': return <Bot className={className} />;
      case 'Calculator': return <Calculator className={className} />;
      case 'BarChart3': return <BarChart3 className={className} />;
      case 'FileText': return <FileText className={className} />;
      case 'Radio': return <Radio className={className} />;
      case 'Users': return <Users className={className} />;
      case 'MapPin': return <MapPin className={className} />;
      case 'Target': return <Target className={className} />;
      case 'Send': return <Send className={className} />;
      case 'Sliders': return <Sliders className={className} />;
      case 'Vote': return <Vote className={className} />;
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'LayoutDashboard': return <LayoutDashboard className={className} />;
      case 'CheckCircle2': return <CheckCircle2 className={className} />;
      case 'Lock': return <Lock className={className} />;
      case 'Building2': return <Building2 className={className} />;
      case 'Award': return <Award className={className} />;
      case 'Database': return <Database className={className} />;
      case 'Layers': return <Layers className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  const getCategoryGradient = (category: string) => {
    switch (category) {
      case 'estrategia': return 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 text-amber-400';
      case 'territorio': return 'from-blue-500/20 via-cyan-500/10 to-transparent border-cyan-500/30 text-cyan-400';
      case 'dia_d': return 'from-rose-500/20 via-red-500/10 to-transparent border-rose-500/30 text-rose-400';
      case 'administracion': return 'from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-400';
      case 'seguridad': return 'from-purple-500/20 via-indigo-500/10 to-transparent border-purple-500/30 text-purple-400';
      default: return 'from-red-500/20 via-orange-500/10 to-transparent border-red-500/30 text-[#FF4D4D]';
    }
  };

  const getBadgeStyle = (category: string) => {
    switch (category) {
      case 'estrategia': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'territorio': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'dia_d': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'administracion': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'seguridad': return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      default: return 'bg-red-500/15 text-red-300 border-red-500/30';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="bg-[#090f1d] border border-slate-700/80 rounded-[28px] max-w-3xl w-full my-auto overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col text-slate-100"
        >
          {/* Header Bar with Category Gradient */}
          <div className={`p-6 sm:p-7 border-b bg-gradient-to-r ${getCategoryGradient(item.category)} relative shrink-0`}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${getBadgeStyle(item.category)}`}>
                {item.categoryLabel}
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {item.metricBadge}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#030814] border border-slate-700 flex items-center justify-center shrink-0 shadow-lg text-white">
                {renderIcon(item.iconName, "w-6 h-6 sm:w-7 sm:h-7 text-white")}
              </div>
              <div className="min-w-0 pr-8">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {item.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  {item.shortDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-slate-300">
            {/* Deep Description */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Desarrollo Operativo & Estratégico
              </h4>
              <p className="text-slate-200 leading-relaxed text-xs sm:text-sm font-medium">
                {item.detailedDescription}
              </p>
            </div>

            {/* Key Features */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Funcionalidades Clave para Ganar la Elección
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {item.keyFeatures.map((feat, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-200 leading-relaxed">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operational 3-Step Workflow */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                Flujo de Trabajo en Campaña (Paso a Paso)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {item.operationalWorkflow.map((wf) => (
                  <div key={wf.step} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-black text-xs flex items-center justify-center">
                      {wf.step}
                    </span>
                    <h5 className="font-bold text-white text-xs">{wf.title}</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{wf.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Framework and Impact Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Impacto Electoral Proyectado
                </span>
                <p className="text-xs text-slate-200 font-bold leading-relaxed">{item.electoralImpact}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Marco Legal & Normativo (Colombia)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">{item.legalFramework}</p>
              </div>
            </div>

            {/* Recommended Role */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Perfiles y Roles Recomendados:</span>
              <span className="font-bold text-white text-right">{item.recommendedRole}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#060b17] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer border border-slate-700"
            >
              Cerrar Detalle
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                  if (onLogin) onLogin();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] hover:brightness-110 text-white font-extrabold text-xs shadow-lg shadow-red-950/60 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Ingresar al Módulo en Vivo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
