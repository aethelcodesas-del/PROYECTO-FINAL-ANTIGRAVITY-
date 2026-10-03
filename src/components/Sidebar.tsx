import React, { useState, useEffect, useRef } from 'react';
import { useCampaignData } from '../contexts/CampaignContext';
import { supabase } from '../lib/supabaseClient';
import { motion, LayoutGroup } from 'motion/react';
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2
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
  const userRole = authUser?.role || 'administrador';

  // ── Datos de campaña y perfil desde Supabase en tiempo real ───────────────
  const campaignCtx = useCampaignData();
  const [liveProfile, setLiveProfile] = useState<{
    displayName: string;
    role: string;
    roleLabel: string;
  } | null>(null);

  const [candidatePhoto, setCandidatePhoto] = useState<string | null>(() => {
    return localStorage.getItem('candidate_photo');
  });

  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning in Sidebar:', err);
    }
    try {
      if (onLogout) {
        await onLogout();
      }
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  useEffect(() => {
    if (!showLogoutModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingOut) {
        setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showLogoutModal, isLoggingOut]);

  useEffect(() => {
    let cancelled = false;
    const roleLabelMap: Record<string, string> = {
      GLOBAL_ADMIN: 'Superadministrador',
      SUPERADMIN: 'Superadministrador',
      superadmin: 'Superadministrador',
      ADMIN: 'Administrador de campaña',
      admin: 'Administrador de campaña',
      administrador: 'Administrador de campaña',
      CANDIDATO: 'Candidato Oficial',
      candidato: 'Candidato Oficial',
      ESTRATEGICO: 'Estratega de campaña',
      estrategico: 'Estratega de campaña',
      TERRITORIAL: 'Coordinador Territorial',
      territorial: 'Coordinador Territorial',
      AUDITOR: 'Auditor CNE',
      auditor: 'Auditor CNE',
    };

    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data?.session?.user;
      const targetId = sessionUser?.id || authUser?.id;
      if (!targetId || cancelled) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, role, email')
        .eq('id', targetId)
        .maybeSingle();

      if (!cancelled && profile) {
        const rawRole = String(profile.role || authUser?.role || 'administrador');
        setLiveProfile({
          displayName: String(profile.display_name || authUser?.name || profile.email || '').trim(),
          role: rawRole,
          roleLabel: roleLabelMap[rawRole] || authUser?.roleName || rawRole,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, authUser?.name, authUser?.role, authUser?.roleName]);

  const effectiveRole = liveProfile?.role || userRole;
  const isGlobalSuperAdmin =
    effectiveRole === 'GLOBAL_ADMIN' ||
    effectiveRole === 'superadmin' ||
    effectiveRole === 'SUPERADMIN' ||
    authUser?.role === 'SUPERADMIN' ||
    authUser?.role === 'GLOBAL_ADMIN';

  const candidateName = !isGlobalSuperAdmin ? (campaignCtx.candidateName || '') : '';

  const campaignTerritory = !isGlobalSuperAdmin && campaignCtx.municipality
    ? `${campaignCtx.officeType ? campaignCtx.officeType + ' · ' : ''}${campaignCtx.municipality}`
    : '';

  // Desktop collapsible sidebar state (stored in localStorage)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_desktop_collapsed') === 'true';
    }
    return false;
  });

  const toggleDesktopCollapse = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDesktopCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar_desktop_collapsed', String(next));
      }
      return next;
    });
  };

  // Touch swipe gesture handling to close drawer on mobile swipe-left
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchStartX.current - touchEndX;
      // Swiped left by at least 45px -> close drawer
      if (deltaX > 45 && onCloseMobile) {
        onCloseMobile();
      }
      touchStartX.current = null;
    }
  };

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

  const userDisplayName = liveProfile?.displayName || authUser?.name || candidateName || authUser?.email || '';
  const userRoleDisplay = liveProfile?.roleLabel || authUser?.roleName || authUser?.moduleName || '';

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
    { 
      id: 'terr_voters_reg', 
      label: 'Registro de Votantes', 
      type: 'subtab' as const, 
      subtab: 'registro' as const, 
      icon: <UserCheck className="w-4 h-4 text-emerald-400" />,
      hoverGlowClass: 'group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]'
    },
    { 
      id: 'terr_territorial_mgmt', 
      label: 'Gestión Territorial', 
      type: 'subtab' as const, 
      subtab: 'mapa' as const, 
      icon: <MapPin className="w-4 h-4 text-amber-400" />,
      hoverGlowClass: 'group-hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]'
    },
    { 
      id: 'terr_field_witness', 
      label: 'Testigos en Campo', 
      type: 'view' as const, 
      view: 'testigo_campo' as ViewMode, 
      icon: <ClipboardList className="w-4 h-4 text-emerald-400" />,
      hoverGlowClass: 'group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]'
    },
    { 
      id: 'terr_surveys', 
      label: 'Módulo de Encuestas', 
      type: 'view' as const, 
      view: 'encuestas' as ViewMode, 
      icon: <BarChart3 className="w-4 h-4 text-cyan-400" />,
      hoverGlowClass: 'group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]'
    },
    { 
      id: 'terr_table_witness', 
      label: 'Jurados en Mesa', 
      type: 'view' as const, 
      view: 'jurado_campo' as ViewMode, 
      icon: <Users className="w-4 h-4 text-sky-400" />,
      hoverGlowClass: 'group-hover:drop-shadow-[0_0_6px_rgba(14,165,233,0.5)]'
    },
  ];

  // Administrative Section Sub-Items (8 administrative functions)
  const adminMenuItems = [
    { id: 'admin_inicio', label: 'Inicio', tab: 'inicio', icon: <Activity className="w-4 h-4 text-emerald-400" />, glowClass: 'glow-icon-emerald' },
    { id: 'admin_roles', label: 'Gestión de Roles', tab: 'roles', icon: <UserCheck className="w-4 h-4 text-cyan-400" />, glowClass: 'glow-icon-cyan' },
    { id: 'admin_lideres', label: 'Líderes / Votantes', tab: 'lideres_votantes', icon: <Users className="w-4 h-4 text-teal-400" />, glowClass: 'glow-icon-teal' },
    { id: 'admin_presupuesto', label: 'Presupuesto / CNE', tab: 'presupuesto_cne', icon: <CreditCard className="w-4 h-4 text-amber-400" />, glowClass: 'glow-icon-amber' },
    { id: 'admin_campana', label: 'Gestión de Campaña', tab: 'gestion_campana', icon: <Building2 className="w-4 h-4 text-blue-400" />, glowClass: 'glow-icon-blue' },
    { id: 'admin_testigos', label: 'Gestión de Testigos', tab: 'gestion_testigos', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, glowClass: 'glow-icon-rose' },
    { id: 'admin_jurados', label: 'Jurados Electorales', tab: 'jurados_electorales', icon: <Sliders className="w-4 h-4 text-purple-400" />, glowClass: 'glow-icon-purple' },
    { id: 'admin_encuestas', label: 'Encuestas y Sondeos', tab: 'encuestas_sondeos', icon: <PieChart className="w-4 h-4 text-cyan-400" />, glowClass: 'glow-icon-cyan' },
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

      <aside 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed inset-y-0 left-0 z-50 ${isDesktopCollapsed ? 'lg:w-[76px]' : 'lg:w-64'} w-[280px] xs:w-72 md:w-64 max-w-[85vw] bg-[#051329] border-r border-cyan-500/25 text-slate-100 flex flex-col shrink-0 transition-[width,transform] duration-300 ease-in-out select-none lg:sticky lg:top-0 lg:translate-x-0 h-[100dvh] max-h-[100dvh] ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header Block matching app design with generous top breathing room and safe-area */}
        <div
          className={`shrink-0 pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-5 pb-3.5 px-4 flex items-center ${
            isDesktopCollapsed ? 'justify-center' : 'justify-between gap-2.5'
          } w-full border-b border-cyan-500/15`}
        >
          {!isDesktopCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <CampaignLogoBadge size="md" className="shrink-0" />
              <div className="min-w-0">
                <h1 className="font-extrabold text-sm tracking-wide text-white leading-tight truncate">
                  Campaña Ganadora IA
                </h1>
                <p className="text-[11px] font-semibold text-emerald-400/90 mt-0.5 truncate">
                  Panel de Control
                </p>
              </div>
            </div>
          )}

          <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center w-full' : 'gap-1 shrink-0'}`}>
            {/* Desktop Collapsible Toggle Button */}
            <button
              type="button"
              onClick={toggleDesktopCollapse}
              aria-label={isDesktopCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
              title={isDesktopCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white cursor-pointer transition-all shrink-0"
            >
              {isDesktopCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Mobile Close Button (Minimum 44x44px Touch Target) */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCloseMobile();
                }}
                aria-label="Cerrar menú"
                className="lg:hidden p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:text-white cursor-pointer transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 px-3 sm:px-4 py-3 space-y-4 overflow-y-auto custom-scrollbar">



        {/* Navigation Menu Links: Strictly separated per Active Module */}
        <div className="space-y-4">
          
          {/* 1. MÓDULO ESTRATÉGICO */}
          {activeSection === 'estrategico' && (
            <div>
              <p className={`px-3 text-[10px] font-black uppercase tracking-wider text-emerald-400/90 mb-2 ${isDesktopCollapsed ? 'lg:hidden' : ''}`}>
                Funciones Estratégicas
              </p>
              <LayoutGroup id="sidebar-strategic-nav">
                <nav className="space-y-1">
                  {strategicMenuItems.filter(item => hasPermission(item.id)).map((item, index) => {
                    const isActive = currentView === 'gestion_estrategica' && strategicTab === item.tab;
                    
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: index * 0.025,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        title={item.label}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (currentView !== 'gestion_estrategica') {
                            onSelectView('gestion_estrategica');
                          }
                          if (item.tab && onSelectStrategicTab) {
                            onSelectStrategicTab(item.tab);
                          }
                          if (onCloseMobile) onCloseMobile();
                          document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`group relative w-full flex items-center ${
                          isDesktopCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-3'
                        } min-h-[44px] py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-[0.98] transition-all duration-75 select-none will-change-[transform,opacity] ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/50 hover:translate-x-1'
                        }`}
                      >
                        {/* Indicador de píldora activa con gradiente cian/azul y resplandor perimetral sutil */}
                        {isActive && (
                          <motion.div
                            layoutId="activeStrategicPill"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 34,
                            }}
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-[#0284c7] shadow-[0_4px_20px_-2px_rgba(6,182,212,0.35)] border border-cyan-400/40 z-0 pointer-events-none"
                          />
                        )}

                        {/* Contenido con micro-interacciones GPU */}
                        <div
                          className={`relative z-10 flex items-center ${
                            isDesktopCollapsed ? 'lg:justify-center' : 'gap-3'
                          } w-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
                        >
                          {/* Icono con escala continua al estar activo y resplandor temático en hover */}
                          <div
                            className={`shrink-0 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              isActive
                                ? 'scale-[1.04] text-white drop-shadow-[0_0_8px_rgba(6,182,212,0.45)]'
                                : 'text-slate-400 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.45)]'
                            }`}
                          >
                            {item.icon}
                          </div>

                          <span
                            className={`truncate tracking-wide text-left transition-colors duration-200 ${
                              isDesktopCollapsed ? 'lg:hidden' : ''
                            } ${isActive ? 'text-white font-extrabold' : 'text-slate-300 group-hover:text-white'}`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </nav>
              </LayoutGroup>
            </div>
          )}

          {/* 2. GESTIÓN TERRITORIAL */}
          {activeSection === 'territorial' && (
            <div>
              <p 
                className={`px-3 text-[10px] font-black uppercase text-teal-400 mb-2 tracking-[0.05em] [text-shadow:0_0_10px_rgba(20,184,166,0.2)] ${isDesktopCollapsed ? 'lg:hidden' : ''}`}
              >
                Funciones Territoriales
              </p>
              <LayoutGroup id="sidebar-territorial-nav">
                <nav className="space-y-1">
                  {territorialMenuItems.filter(item => hasPermission(item.id)).map((item, index) => {
                    const isActive = item.type === 'subtab'
                      ? currentView === 'gestion_territorial' && territorialSubTab === item.subtab
                      : currentView === item.view;

                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.18,
                          delay: index * 0.03,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        title={item.label}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item.type === 'subtab') {
                            if (currentView !== 'gestion_territorial') {
                              onSelectView('gestion_territorial');
                            }
                            if (onSelectTerritorialSubTab) onSelectTerritorialSubTab(item.subtab);
                          } else {
                            onSelectView(item.view);
                          }
                          if (onCloseMobile) onCloseMobile();
                          document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`group relative w-full flex items-center ${
                          isDesktopCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-3'
                        } min-h-[44px] py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-[0.97] transition-all duration-75 select-none will-change-[transform,opacity] ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-300 hover:text-white hover:bg-[#1e293b]/45 hover:translate-x-[5px]'
                        }`}
                      >
                        {/* Indicador de píldora activa con resplandor esmeralda y respiración en reposo */}
                        {isActive && (
                          <motion.div
                            layoutId="activeTerritorialPill"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 34,
                            }}
                            className="nav-item-active-emerald absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 shadow-[0_4px_20px_-2px_rgba(16,185,129,0.35)] border border-emerald-400/40 z-0 pointer-events-none"
                          />
                        )}

                        <div
                          className={`relative z-10 flex items-center ${
                            isDesktopCollapsed ? 'lg:justify-center' : 'gap-3'
                          } w-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
                        >
                          <div
                            className={`shrink-0 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              isActive
                                ? 'scale-[1.05] text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : `text-slate-400 group-hover:scale-110 ${item.hoverGlowClass || 'group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]'}`
                            }`}
                          >
                            {item.icon}
                          </div>
                          <span
                            className={`truncate tracking-wide text-left transition-colors duration-200 ${
                              isDesktopCollapsed ? 'lg:hidden' : ''
                            } ${isActive ? 'text-white font-extrabold' : 'text-slate-300 group-hover:text-white'}`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </nav>
              </LayoutGroup>
            </div>
          )}

          {/* 3. MÓDULO ADMINISTRATIVO */}
          {activeSection === 'administrativo' && (
            <div>
              <p className={`px-3 text-[10px] font-black uppercase tracking-wider text-cyan-400/90 mb-2 ${isDesktopCollapsed ? 'lg:hidden' : ''}`}>
                Funciones Administrativas
              </p>
              <LayoutGroup id="sidebar-admin-nav">
                <nav className="space-y-1">
                  {adminMenuItems.filter(item => hasPermission(item.id)).map((item, index) => {
                    const isActive = currentView === 'modulo_admin' && adminTab === item.tab;
                    
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        title={item.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: index * 0.025,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (currentView !== 'modulo_admin') {
                            onSelectView('modulo_admin');
                          }
                          if (item.tab && onSelectAdminTab) {
                            onSelectAdminTab(item.tab);
                          }
                          if (onCloseMobile) onCloseMobile();
                          document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`group relative w-full flex items-center ${
                          isDesktopCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-3'
                        } min-h-[44px] py-2.5 rounded-xl text-xs font-bold cursor-pointer active:scale-[0.98] transition-all duration-75 select-none will-change-[transform,opacity] ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/50 hover:translate-x-1'
                        }`}
                      >
                        {/* Indicador de píldora activa deslizante (Sliding Active Indicator) */}
                        {isActive && (
                          <motion.div
                            layoutId="activeAdminPill"
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 34,
                            }}
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_4px_20px_-2px_rgba(6,182,212,0.35)] border border-cyan-400/40 z-0 pointer-events-none"
                          />
                        )}

                        {/* Contenido con micro-interacciones GPU */}
                        <div
                          className={`relative z-10 flex items-center ${
                            isDesktopCollapsed ? 'lg:justify-center' : 'gap-3'
                          } w-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
                        >
                          {/* Micro-animación en icono activo e iluminación tenue en hover */}
                          <div
                            className={`shrink-0 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              isActive
                                ? 'scale-[1.04] drop-shadow-[0_0_8px_rgba(6,182,212,0.45)]'
                                : (item.glowClass || '') + ' text-slate-400 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.45)]'
                            }`}
                          >
                            {item.icon}
                          </div>

                          <span
                            className={`truncate tracking-wide text-left transition-colors duration-200 ${
                              isDesktopCollapsed ? 'lg:hidden' : ''
                            } ${isActive ? 'text-white font-extrabold' : 'text-slate-300 group-hover:text-white'}`}
                          >
                            {item.label}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </nav>
              </LayoutGroup>
            </div>
          )}

        </div>

      </div>

      {/* User Profile Footer Card - Professional Cyber Design */}
      <div className={`shrink-0 ${isDesktopCollapsed ? 'lg:mx-1.5 lg:p-2' : 'mx-2.5 p-3.5'} mt-2.5 mb-[max(0.625rem,env(safe-area-inset-bottom))] rounded-2xl bg-gradient-to-b from-[#072448]/90 to-[#031127]/95 border border-cyan-500/30 shadow-lg shadow-cyan-950/40 backdrop-blur-md transition-all group/profile`}>
        <div className={`flex items-center ${isDesktopCollapsed ? 'lg:justify-center' : 'gap-3'}`}>
          {/* Avatar with Status Indicator */}
          <div className="relative shrink-0">
            {authUser?.avatar ? (
              <img
                src={authUser.avatar}
                alt={userDisplayName}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-cyan-400/40 object-cover shadow-[0_0_16px_rgba(59,130,246,0.35)]"
              />
            ) : authUser?.role === 'candidato' && candidatePhoto ? (
              <img
                src={candidatePhoto}
                alt={userDisplayName}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-cyan-400/40 object-cover shadow-[0_0_16px_rgba(59,130,246,0.35)]"
              />
            ) : (
              <div 
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.35)] border border-cyan-400/50 tracking-wider select-none"
              >
                {getInitials(userDisplayName)}
              </div>
            )}
            {/* Online radar pulse dot */}
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center pointer-events-none">
              <span className="status-dot-user inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#051329]" />
            </span>
          </div>

          {/* Name & Role */}
          <div className={`text-left min-w-0 flex-1 ${isDesktopCollapsed ? 'lg:hidden' : ''}`}>
            <div
              className="font-extrabold text-xs text-white uppercase tracking-wider break-words line-clamp-1 drop-shadow-sm"
              title={userDisplayName}
            >
              {userDisplayName}
            </div>
            <div 
              className="text-[11px] font-semibold text-cyan-300/90 truncate mt-0.5"
              title={userRoleDisplay}
            >
              {userRoleDisplay}
            </div>
            {campaignTerritory && (
              <div 
                className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#020b18]/80 border border-cyan-500/25 group-hover/profile:border-cyan-500/40 text-[10px] font-medium text-cyan-200 max-w-full transition-colors duration-200"
                title={campaignTerritory}
              >
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{campaignTerritory}</span>
              </div>
            )}
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowLogoutModal(true);
            }}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className={`group/logout mt-3 w-full min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/40 shadow-sm transition-all duration-200 ease-out active:scale-[0.97] cursor-pointer will-change-transform`}
          >
            <LogOut className="w-4 h-4 shrink-0 transition-transform duration-200 ease-out group-hover/logout:-translate-x-0.5" />
            <span className={isDesktopCollapsed ? 'lg:hidden' : ''}>Cerrar sesión</span>
          </button>
        )}
      </div>
    </aside>

    {/* Modal de confirmación de cierre de sesión */}
    {showLogoutModal && (
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop-animate"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isLoggingOut) {
            setShowLogoutModal(false);
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
      >
        <div
          className="bg-[#0c1425]/95 border border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.7)] rounded-2xl max-w-sm w-full p-6 text-center modal-container-animate relative overflow-hidden text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Luz ambiental sutil */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Icono central de salida */}
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <LogOut className="w-6 h-6" />
          </div>

          {/* Título y descripción */}
          <h3 id="logout-modal-title" className="text-lg font-semibold text-white">
            ¿Cerrar sesión en la plataforma?
          </h3>
          <p className="text-sm text-slate-400 mt-1 mb-6 leading-relaxed">
            Deberá ingresar nuevamente sus credenciales para acceder a la gestión de campaña.
          </p>

          {/* Botones de acción */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleConfirmLogout}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(225,29,72,0.35)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Cerrando sesión...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sí, cerrar sesión</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
