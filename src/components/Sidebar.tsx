import React, { useState, useEffect } from 'react';
import { useCampaignData } from '../contexts/CampaignContext';
import { motion } from 'motion/react';
import { ViewMode, AuthUser } from '../types';
import { CampaignLogoBadge } from './common/CampaignLogoIcon';
import { isViewAllowed, isViewAllowedForModule } from '../utils/rolePermissions';
import { 
  Activity, 
  CreditCard, 
  ShieldAlert, 
  UserCheck, 
  Sliders, 
  Bot, 
  Users, 
  Settings,
  Building2,
  Lock,
  PieChart,
  MapPin,
  Layers,
  Sparkles,
  User,
  FileText,
  MessageSquare,
  DollarSign,
  BookOpen,
  Share2,
  BarChart3,
  Calendar,
  X,
  ClipboardList,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  adminTab?: string;
  onSelectAdminTab?: (tab: string) => void;
  strategicTab?: string;
  onSelectStrategicTab?: (tab: string) => void;
  territorialSubTab?: 'registro' | 'mapa';
  onSelectTerritorialSubTab?: (tab: 'registro' | 'mapa') => void;
  onOpenUserRolesModal?: () => void;
  isOpen?: boolean;
  onCloseMobile?: () => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  adminTab = 'inicio',
  onSelectAdminTab,
  strategicTab = 'diagnostico',
  onSelectStrategicTab,
  territorialSubTab = 'registro',
  onSelectTerritorialSubTab,
  onOpenUserRolesModal,
  isOpen = true,
  onCloseMobile,
  authUser,
  onLogout
}) => {
  const userRole = authUser?.role || 'superadmin';

  // ── Datos de campaña desde el contexto global ──────────────────────────────
  const campaignCtx = useCampaignData();

  const [candidatePhoto, setCandidatePhoto] = useState<string | null>(() => {
    return localStorage.getItem('candidate_photo');
  });

  // Prioridad: contexto global > localStorage > fallback
  const candidateName = campaignCtx.candidateName
    || localStorage.getItem('candidate_name')
    || 'Candidato Principal';

  const campaignTerritory = campaignCtx.municipality
    ? `${campaignCtx.officeType ? campaignCtx.officeType + ' · ' : ''}${campaignCtx.municipality}`
    : '';

  useEffect(() => {
    const refreshPhoto = () => {
      const photo = localStorage.getItem('candidate_photo');
      setCandidatePhoto(photo);
    };
    window.addEventListener('candidate_photo_updated', refreshPhoto);
    window.addEventListener('storage', refreshPhoto);
    return () => {
      window.removeEventListener('candidate_photo_updated', refreshPhoto);
      window.removeEventListener('storage', refreshPhoto);
    };
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'US';
    const cleanName = name.replace(/^(Dr\.|Dra\.|Ing\.|Capitán|Lic\.|Mg\.)\s+/i, '');
    const parts = cleanName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0] || name).slice(0, 2).toUpperCase();
  };

  const userDisplayName = authUser?.name || candidateName || 'Usuario Activo';
  const userRoleDisplay = authUser?.roleName || authUser?.moduleName || 'Candidato Oficial';

  const hasPermission = (permId: string) => {
    const permissions = authUser?.permissions;
    const isAlwaysFullAccess = userRole === 'GLOBAL_ADMIN' || userRole === 'superadmin' || userRole === 'auditor';
    const isUnrestrictedCampaignOwner = (userRole === 'administrador' || userRole === 'candidato')
      && Array.isArray(permissions)
      && permissions.length === 0;
    if (isAlwaysFullAccess || isUnrestrictedCampaignOwner) {
      return true;
    }
    return (permissions || []).includes(permId);
  };

  // Módulo Estratégico Sub-Items (10 strategic functions)
  const strategicMenuItems = [
    { id: 'est_diag_360', label: 'Diagnóstico 360° AI', tab: 'diagnostico', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
    { id: 'est_diag_territorial', label: 'Diagnóstico Territorial', tab: 'diagnostico_territorial', icon: <MapPin className="w-4 h-4 text-cyan-400" /> },
    { id: 'est_programa', label: 'Programa de Gobierno', tab: 'programa_gobierno', icon: <BookOpen className="w-4 h-4 text-amber-400" /> },
    { id: 'est_perfil', label: 'Perfil del Candidato', tab: 'perfil', icon: <UserCheck className="w-4 h-4 text-teal-400" /> },
    { id: 'est_carga_cv', label: 'Carga & Análisis CV', tab: 'hoja_vida', icon: <FileText className="w-4 h-4 text-teal-400" /> },
    { id: 'est_dofa', label: 'Matriz DOFA / SWOT AI', tab: 'dofa', icon: <PieChart className="w-4 h-4 text-emerald-400" /> },
    { id: 'est_narrativa', label: 'Narrativa & Discurso', tab: 'discurso', icon: <MessageSquare className="w-4 h-4 text-cyan-400" /> },
    { id: 'est_comunicacion', label: 'Comunicación & Redes', tab: 'comunicacion_redes', icon: <Share2 className="w-4 h-4 text-emerald-400" /> },

    { id: 'est_agenda', label: 'Agenda & Calendario Electoral', tab: 'agenda_electoral', icon: <Calendar className="w-4 h-4 text-amber-400" /> },
  ];

  // Territorial Operations Sub-Items (5 territorial functions)
  const territorialMenuItems = [
    { id: 'terr_voters_reg', label: 'Registro de Votantes', type: 'subtab' as const, subtab: 'registro' as const, icon: <UserCheck className="w-4 h-4 text-teal-400" /> },
    { id: 'terr_territorial_mgmt', label: 'Gestión Territorial', type: 'subtab' as const, subtab: 'mapa' as const, icon: <MapPin className="w-4 h-4 text-amber-400" /> },
    { id: 'terr_field_witness', label: 'Testigos en Campo', type: 'view' as const, view: 'testigo_campo' as ViewMode, icon: <ClipboardList className="w-4 h-4 text-emerald-400" /> },
    { id: 'terr_surveys', label: 'Módulo de Encuestas', type: 'view' as const, view: 'encuestas' as ViewMode, icon: <BarChart3 className="w-4 h-4 text-blue-400" /> },
    { id: 'terr_table_witness', label: 'Jurados en Mesa', type: 'view' as const, view: 'jurado_campo' as ViewMode, icon: <Users className="w-4 h-4 text-cyan-400" /> },
  ];

  // Administrative Section Sub-Items (8 administrative functions)
  const adminMenuItems = [
    { id: 'admin_inicio', label: 'Inicio', tab: 'inicio', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
    { id: 'admin_roles', label: 'Gestión de Roles', tab: 'roles', icon: <UserCheck className="w-4 h-4 text-cyan-400" /> },
    { id: 'admin_lideres', label: 'Líderes / Votantes', tab: 'lideres_votantes', icon: <Users className="w-4 h-4 text-teal-400" /> },
    { id: 'admin_presupuesto', label: 'Presupuesto / CNE', tab: 'presupuesto_cne', icon: <CreditCard className="w-4 h-4 text-amber-400" /> },
    { id: 'admin_campana', label: 'Gestión de Campaña', tab: 'gestion_campana', icon: <Building2 className="w-4 h-4 text-blue-400" /> },
    { id: 'admin_testigos', label: 'Gestión de Testigos', tab: 'gestion_testigos', icon: <ShieldAlert className="w-4 h-4 text-rose-400" /> },
    { id: 'admin_jurados', label: 'Jurados Electorales', tab: 'jurados_electorales', icon: <Sliders className="w-4 h-4 text-purple-400" /> },
    { id: 'admin_encuestas', label: 'Encuestas y Sondeos', tab: 'encuestas_sondeos', icon: <PieChart className="w-4 h-4 text-cyan-400" /> },
  ];

  // Determine current active section automatically based on currentView & user module
  const [activeSection, setActiveSection] = useState<'estrategico' | 'territorial' | 'administrativo'>(() => {
    if (currentView === 'modulo_admin' || authUser?.moduleName === 'modulo_admin') return 'administrativo';
    if (['gestion_territorial', 'testigo_campo', 'encuestas', 'jurado_campo'].includes(currentView) || authUser?.moduleName === 'modulo_territorial') return 'territorial';
    return 'estrategico';
  });

  useEffect(() => {
    if (currentView === 'modulo_admin') {
      setActiveSection('administrativo');
    } else if (['gestion_territorial', 'testigo_campo', 'encuestas', 'jurado_campo'].includes(currentView)) {
      setActiveSection('territorial');
    } else if (currentView === 'gestion_estrategica') {
      setActiveSection('estrategico');
    } else if (authUser?.moduleName === 'modulo_admin') {
      setActiveSection('administrativo');
    } else if (authUser?.moduleName === 'modulo_territorial') {
      setActiveSection('territorial');
    } else if (authUser?.moduleName === 'modulo_estrategico') {
      setActiveSection('estrategico');
    }
  }, [currentView, authUser?.moduleName]);

  useEffect(() => {
    // ESC key listener to close mobile drawer
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onCloseMobile) {
        onCloseMobile();
      }
    };

    // Body scroll lock on mobile and tablet when sidebar drawer is open
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCloseMobile]);

  return (
    <>
      {/* Mobile & Tablet dark backdrop overlay when drawer is open */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden animate-in fade-in transition-all"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] xs:w-72 md:w-64 max-w-[85vw] bg-[#051329] border-r border-cyan-500/25 text-slate-100 flex flex-col shrink-0 transition-transform duration-300 ease-in-out select-none lg:sticky lg:top-0 lg:translate-x-0 h-[100dvh] max-h-[100dvh] ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      <div className="flex-1 p-3 sm:p-4 md:p-5 space-y-4 overflow-y-auto custom-scrollbar">
        
        {/* Header Block matching app design */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-cyan-500/15">
          <div className="flex items-center gap-3">
            <CampaignLogoBadge size="md" />
            <div>
              <h1 className="font-extrabold text-sm tracking-wide text-white leading-tight">
                Campaña Ganadora IA
              </h1>
              <p className="text-[11px] font-semibold text-emerald-400/90 mt-0.5">
                Panel de Control
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Cerrar menú"
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:text-white cursor-pointer transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>



        {/* Navigation Menu Links: Strictly separated per Active Module */}
        <div className="space-y-4">
          
          {/* 1. MÓDULO ESTRATÉGICO */}
          {activeSection === 'estrategico' && (
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-emerald-400/90 mb-2">
                Funciones Estratégicas
              </p>
              <nav className="space-y-1">
                {strategicMenuItems.filter(item => hasPermission(item.id)).map((item) => {
                  const isActive = currentView === 'gestion_estrategica' && strategicTab === item.tab;
                  
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ scale: 1.01, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onSelectView('gestion_estrategica');
                        if (item.tab && onSelectStrategicTab) {
                          onSelectStrategicTab(item.tab);
                        }
                        if (onCloseMobile) onCloseMobile();
                        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/50'
                          : 'text-slate-300 hover:text-white hover:bg-emerald-500/10'
                      }`}
                    >
                      <div className={`shrink-0 transition-transform ${isActive ? 'scale-110 text-white' : 'text-slate-400'}`}>
                        {item.icon}
                      </div>
                      <span className="truncate tracking-wide text-left">{item.label}</span>
                    </motion.button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* 2. GESTIÓN TERRITORIAL */}
          {activeSection === 'territorial' && (
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-teal-400/90 mb-2">
                Funciones Territoriales
              </p>
              <div className="space-y-1">
                {territorialMenuItems.filter(item => hasPermission(item.id)).map((item) => {
                  const isActive = item.type === 'subtab'
                    ? currentView === 'gestion_territorial' && territorialSubTab === item.subtab
                    : currentView === item.view;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'subtab') {
                          onSelectView('gestion_territorial');
                          if (onSelectTerritorialSubTab) onSelectTerritorialSubTab(item.subtab);
                        } else {
                          onSelectView(item.view);
                        }
                        if (onCloseMobile) onCloseMobile();
                        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-md shadow-teal-900/40 border border-teal-400/50'
                          : 'text-slate-300 hover:text-white hover:bg-teal-500/10'
                      }`}
                    >
                      <div className={`shrink-0 transition-transform ${isActive ? 'scale-110 text-white' : ''}`}>
                        {item.icon}
                      </div>
                      <div className="text-left truncate">
                        <div className="tracking-wide text-white">{item.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. MÓDULO ADMINISTRATIVO */}
          {activeSection === 'administrativo' && (
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-cyan-400/90 mb-2">
                Funciones Administrativas
              </p>
              <nav className="space-y-1">
                {adminMenuItems.filter(item => hasPermission(item.id)).map((item) => {
                  const isActive = currentView === 'modulo_admin' && adminTab === item.tab;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectView('modulo_admin');
                        if (item.tab && onSelectAdminTab) {
                          onSelectAdminTab(item.tab);
                        }
                        if (onCloseMobile) onCloseMobile();
                        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-md shadow-cyan-950/40 border border-cyan-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-cyan-500/10'
                      }`}
                    >
                      <div className={`shrink-0 transition-transform ${isActive ? 'scale-110 text-white' : 'text-slate-400'}`}>
                        {item.icon}
                      </div>
                      <span className="truncate tracking-wide text-left">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

        </div>

      </div>

      {/* User Profile Footer Card - Professional Executive UI */}
      <div className="shrink-0 mx-2.5 mt-2.5 mb-[max(0.625rem,env(safe-area-inset-bottom))] p-3 rounded-2xl bg-gradient-to-b from-slate-900/95 to-[#030d1e] border border-slate-700/90 shadow-lg shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar with Status Indicator */}
            <div className="relative shrink-0">
              {authUser?.avatar ? (
                <img
                  src={authUser.avatar}
                  alt={userDisplayName}
                  className="w-9 h-9 rounded-xl border border-emerald-500/40 object-cover shadow-sm"
                />
              ) : authUser?.role === 'candidato' && candidatePhoto ? (
                <img
                  src={candidatePhoto}
                  alt={userDisplayName}
                  className="w-9 h-9 rounded-xl border border-emerald-500/40 object-cover shadow-sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-900/90 via-teal-900/80 to-slate-900 border border-cyan-500/30 text-cyan-200 flex items-center justify-center font-bold text-xs shadow-inner">
                  {getInitials(userDisplayName)}
                </div>
              )}
              {/* Online pulse dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-[#020b17]"></span>
              </span>
            </div>

            {/* Name & Role */}
            <div className="text-left min-w-0 flex-1">
              <div
                className="font-semibold text-slate-100 text-xs leading-4 tracking-tight break-words line-clamp-2"
                title={userDisplayName}
              >
                {userDisplayName}
              </div>
              <div 
                className="text-[11px] text-teal-400 font-normal truncate mt-0.5"
                title={userRoleDisplay}
              >
                {userRoleDisplay}
              </div>
              {campaignTerritory && (
                <div className="text-[10px] text-cyan-300/70 font-semibold truncate mt-0.5 flex items-center gap-1">
                  <span>📍</span>
                  <span className="truncate">{campaignTerritory}</span>
                </div>
              )}
            </div>
          </div>

        </div>
        {onLogout && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="mt-3 w-full min-h-10 px-3 py-2 rounded-xl text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-bold shadow-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Cerrar sesión</span>
          </motion.button>
        )}
      </div>
    </aside>
    </>
  );
};
