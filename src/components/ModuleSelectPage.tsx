import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  Activity,
  MapPin,
  CheckCircle2,
  LogIn
} from 'lucide-react';
import { ViewMode, AuthUser } from '../types';

interface ModuleSelectPageProps {
  onBack: () => void;
  onSelectModule: (view: ViewMode, moduleTitle: string, defaultUser?: AuthUser) => void;
  onOpenLogin?: () => void;
}

interface ModuleDefinition {
  id: string;
  title: string;
  targetView: ViewMode;
  subtitle: string;
  icon: any;
  iconColor: string;
  cardBg: string;
  borderColor: string;
  glowColor: string;
  features: string[];
  buttonText: string;
  defaultUser: AuthUser;
}

const MODULES_LIST: ModuleDefinition[] = [
  {
    id: 'modulo_admin',
    title: 'Gestión Administrativa',
    targetView: 'modulo_admin',
    subtitle: 'Nómina, Presupuesto CNE, Auditoría, Roles y Seguridad',
    icon: LayoutGrid,
    iconColor: 'text-cyan-400',
    cardBg: 'from-[#04152b]/95 via-[#031122]/90 to-[#020b18]/95',
    borderColor: 'border-cyan-500/40 hover:border-cyan-400',
    glowColor: 'shadow-cyan-900/40 hover:shadow-cyan-500/30',
    features: [
      'Gestión de Roles y privilegios de acceso RBAC',
      'Estructura piramidal de Líderes y CRM de votantes',
      'Presupuesto CNE, control de gastos, ingresos y topes',
      'Gestión Directiva de Campaña, Testigos y Jurados'
    ],
    buttonText: 'Iniciar Sesión - Gestión Administrativa',
    defaultUser: {
      id: 'USR-1001',
      name: 'Dra. María Paula Restrepo',
      email: 'admin.general@campanaganadora.co',
      cedula: '1085294312',
      role: 'superadmin',
      roleName: 'Superadministradora / Candidata',
      moduleName: 'Gestión Administrativa',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026'
    }
  },
  {
    id: 'gestion_estrategica',
    title: 'Gestión Estratégica',
    targetView: 'gestion_estrategica',
    subtitle: 'Diagnóstico 360° AI, Programa de Gobierno, DOFA, Narrativa y Discursos',
    icon: Activity,
    iconColor: 'text-emerald-400',
    cardBg: 'from-[#031926]/95 via-[#02131e]/90 to-[#020b14]/95',
    borderColor: 'border-emerald-500/40 hover:border-emerald-400',
    glowColor: 'shadow-emerald-900/40 hover:shadow-emerald-500/30',
    features: [
      'Diagnóstico 360° AI y Diagnóstico Territorial',
      'Programa de Gobierno, Propuestas y Plan de Acción',
      'Matriz DOFA / SWOT AI y Perfil del Candidato',
      'Narrativa, Discurso, Comunicación y Análisis de Datos AI'
    ],
    buttonText: 'Iniciar Sesión - Gestión Estratégica',
    defaultUser: {
      id: 'USR-1003',
      name: 'Ing. Carlos Alberto Mendoza',
      email: 'director.estrategico@campanaganadora.co',
      cedula: '1020784920',
      role: 'candidato',
      roleName: 'Director Político & Estratégico',
      moduleName: 'Gestión Estratégica',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026'
    }
  },
  {
    id: 'gestion_territorial',
    title: 'Gestión Territorial',
    targetView: 'gestion_territorial',
    subtitle: 'Registro de Votantes, Mapa de Calor, Testigos en Campo, Encuestas y Jurados',
    icon: MapPin,
    iconColor: 'text-teal-400',
    cardBg: 'from-[#02181c]/95 via-[#021115]/90 to-[#010a0e]/95',
    borderColor: 'border-teal-500/40 hover:border-teal-400',
    glowColor: 'shadow-teal-900/40 hover:shadow-teal-500/30',
    features: [
      'Registro y empadronamiento de votantes por comuna',
      'Gestión Territorial y mapa de votos & sectores',
      'Testigos en Campo para reportes del Día E y E-14',
      'Módulo de Encuestas y Control de Jurados en Mesa'
    ],
    buttonText: 'Iniciar Sesión - Gestión Territorial',
    defaultUser: {
      id: 'USR-1002',
      name: 'Carlos Gómez',
      email: 'territorial@campana.ai',
      cedula: '1144028392',
      role: 'coordinador_zona',
      roleName: 'Coordinador Territorial / Logística',
      moduleName: 'Gestión Territorial',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026'
    }
  }
];

export function ModuleSelectPage({ onBack, onSelectModule, onOpenLogin }: ModuleSelectPageProps) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [mousePosMap, setMousePosMap] = useState<Record<string, { x: number; y: number }>>({});

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, moduleId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosMap((prev) => ({ ...prev, [moduleId]: { x, y } }));
  };

  const handleCardClick = (mod: ModuleDefinition) => {
    onSelectModule(mod.targetView, mod.title, mod.defaultUser);
  };

  return (
    <div className="min-h-screen w-full bg-[#020712] flex flex-col items-center justify-start sm:justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-14 relative overflow-x-hidden text-slate-100">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-cyan-600/10 rounded-full blur-[110px] opacity-60" />
        <div className="absolute top-1/2 -right-32 w-[34rem] h-[34rem] bg-teal-600/10 rounded-full blur-[120px] opacity-50" />
        <div className="absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] bg-emerald-600/10 rounded-full blur-[100px] opacity-50" />
      </div>

      {/* Top Navigation Action Bar */}
      {/* Top Bar: Back Button */}
      <div className="relative z-20 w-full max-w-7xl flex items-center justify-start gap-3 mb-6 sm:mb-8">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBack();
          }}
          aria-label="Volver al Portal"
          className="flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-all text-xs sm:text-sm font-medium cursor-pointer min-h-[40px] shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Portal</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col items-center gap-6 sm:gap-8">
        {/* Header Section */}
        <div className="text-center flex flex-col items-center gap-3">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
            Seleccione el Módulo de Operación
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Haga clic en cualquiera de los módulos a continuación para acceder a las herramientas y funciones de su campaña.
          </p>
        </div>

        {/* Dynamic Keyframe Style for Hover Color Shift Animation */}
        <style>{`
          @keyframes colorCycleBorder {
            0% {
              border-color: rgba(6, 182, 212, 0.9);
              box-shadow: 0 0 35px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.15);
            }
            33% {
              border-color: rgba(16, 185, 129, 0.9);
              box-shadow: 0 0 35px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(16, 185, 129, 0.15);
            }
            66% {
              border-color: rgba(45, 212, 191, 0.9);
              box-shadow: 0 0 35px rgba(45, 212, 191, 0.4), inset 0 0 20px rgba(45, 212, 191, 0.15);
            }
            100% {
              border-color: rgba(6, 182, 212, 0.9);
              box-shadow: 0 0 35px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.15);
            }
          }

          .animated-card-glow {
            animation: colorCycleBorder 3.5s infinite linear;
          }
        `}</style>

        {/* 3 Great Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {MODULES_LIST.map((mod) => {
            const Icon = mod.icon;
            const isHovered = hoveredCardId === mod.id;
            const pos = mousePosMap[mod.id] || { x: 150, y: 150 };

            return (
              <div
                key={mod.id}
                onMouseEnter={() => setHoveredCardId(mod.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                onMouseMove={(e) => handleCardMouseMove(e, mod.id)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCardClick(mod);
                }}
                className={`
                  relative rounded-3xl p-6 sm:p-7 md:p-8 flex flex-col justify-between
                  transition-all duration-300 group cursor-pointer overflow-hidden
                  ${
                    isHovered
                      ? 'bg-[#020b18] opacity-100 -translate-y-2 scale-[1.02] z-20 animated-card-glow border-2'
                      : hoveredCardId
                      ? 'bg-[#030d1f]/80 opacity-60 scale-[0.98] border border-slate-800'
                      : `bg-gradient-to-b ${mod.cardBg} border ${mod.borderColor} shadow-2xl ${mod.glowColor} hover:-translate-y-1.5`
                  }
                `}
              >
                {/* Dynamic Cursor Spotlight Effect */}
                {isHovered && (
                  <div
                    className="pointer-events-none absolute rounded-full blur-3xl opacity-90 transition-opacity duration-150"
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: '320px',
                      height: '320px',
                      transform: 'translate(-50%, -50%)',
                      background:
                        'radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(16,185,129,0.3) 45%, transparent 100%)'
                    }}
                  />
                )}

                {/* Ambient overlay */}
                <div
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                    isHovered ? 'bg-[#030d1d]/85 backdrop-blur-xl' : 'opacity-0'
                  }`}
                />

                {/* Card Top & Body Content */}
                <div className="relative z-10">
                  {/* Icon & Title */}
                  <div className="flex items-center gap-3.5 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                      <Icon className={`w-7 h-7 ${mod.iconColor}`} />
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white group-hover:text-cyan-200 transition-colors leading-tight">
                      {mod.title}
                    </h2>
                  </div>

                  {/* Subtitle */}
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed font-medium">
                    {mod.subtitle}
                  </p>

                  {/* Feature Bullet Points */}
                  <div className="space-y-3 mb-6 mt-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                      FUNCIONALIDADES PRINCIPALES:
                    </span>
                    {mod.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="relative z-10 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCardClick(mod);
                    }}
                    className={`
                      w-full py-3 sm:py-3.5 px-4 rounded-2xl font-black text-xs tracking-wide shadow-xl
                      flex items-center justify-between transition-all cursor-pointer
                      ${
                        isHovered
                          ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-300 text-slate-950 shadow-cyan-500/50 scale-[1.01]'
                          : 'bg-gradient-to-r from-[#0284c7] via-[#0d9488] to-[#10b981] hover:from-cyan-500 hover:to-emerald-500 text-white shadow-cyan-900/40'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LogIn className={`w-4 h-4 shrink-0 ${isHovered ? 'text-slate-950' : 'text-cyan-200'}`} />
                      <span className="truncate text-left">{mod.buttonText}</span>
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 ${isHovered ? 'text-slate-950' : 'text-emerald-200'}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
