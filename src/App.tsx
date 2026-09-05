import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu } from 'lucide-react';
import { 
  ViewMode, 
  AuthUser, 
  CalendarEvent, 
  BankTransaction, 
  E14Record, 
  TerritorialZone, 
  GeofenceAlert, 
  ChatMessage 
} from './types';
import { getHashForRoute, parseRouteFromHash } from './utils/urlRouter';
import { useAutoLogout } from './hooks/useAutoLogout';
import { usePlatformRealtime } from './hooks/usePlatformRealtime';
import { CampaignProvider } from './contexts/CampaignContext';

// Global Navigation Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FooterBar } from './components/FooterBar';
import { Modals } from './components/common/Modals';
import { LoginModal } from './components/LoginModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Heavy private modules are downloaded only on demand when opened
const PrimeraInterfaz = lazy(() => import('./components/views/PrimeraInterfaz').then(module => ({ default: module.PrimeraInterfaz })));
const ModuloAdministrativo = lazy(() => import('./components/views/ModuloAdministrativo').then(module => ({ default: module.ModuloAdministrativo })));
const GestionEstrategica = lazy(() => import('./components/views/GestionEstrategica').then(module => ({ default: module.GestionEstrategica })));
const GestionTerritorial = lazy(() => import('./components/views/GestionTerritorial').then(module => ({ default: module.GestionTerritorial })));
const TestigoCampoView = lazy(() => import('./components/views/TestigoCampoView').then(module => ({ default: module.TestigoCampoView })));
const EncuestasView = lazy(() => import('./components/views/EncuestasView').then(module => ({ default: module.EncuestasView })));
const JuradoCampoView = lazy(() => import('./components/views/JuradoCampoView').then(module => ({ default: module.JuradoCampoView })));
const PresupuestoContabilidad = lazy(() => import('./components/views/PresupuestoContabilidad').then(module => ({ default: module.PresupuestoContabilidad })));
const ConfiguracionView = lazy(() => import('./components/views/ConfiguracionView').then(module => ({ default: module.ConfiguracionView })));
const PruebasElectoralesView = lazy(() => import('./components/views/PruebasElectoralesView').then(module => ({ default: module.PruebasElectoralesView })));
const PanelAdministrativoSaaS = lazy(() => import('./components/views/PanelAdministrativoSaaS').then(module => ({ default: module.PanelAdministrativoSaaS })));
const GlobalAdminGuard = lazy(() => import('./components/global-admin/GlobalAdminGuard').then(module => ({ default: module.GlobalAdminGuard })));
const PasswordRecoveryPage = lazy(() => import('./components/PasswordRecoveryPage').then(module => ({ default: module.PasswordRecoveryPage })));
const RedSunBeeCampaignLanding = lazy(() => import('./components/RedSunBeeCampaignLanding').then(module => ({ default: module.RedSunBeeCampaignLanding })));
const ModuleSelectPage = lazy(() => import('./components/ModuleSelectPage').then(module => ({ default: module.ModuleSelectPage })));
import { supabase } from './lib/supabaseClient';

// Initial Mock Datasets
import { initialTerritorialZones } from './data/initialData';

const initialCalendarEvents: CalendarEvent[] = [
  { id: 'ev-1', title: 'Debate regional de candidatos', date: '22 May', type: 'Medios' },
  { id: 'ev-2', title: 'Caravana de la Victoria Comuna 13', date: '23 May', type: 'Territorio' },
  { id: 'ev-3', title: 'Cierre de Campaña La Alpujarra', date: '24 May', type: 'Evento Masivo' },
  { id: 'ev-4', title: 'Reunión Jurídica y Testigos Electorales', date: '25 May', type: 'Escrutinio' },
  { id: 'ev-5', title: 'Día D: Instalación de Puestos de Mando', date: '26 May', type: 'Operación Día D' }
];

const initialTransactions: BankTransaction[] = [
  { id: 'tx-1', descripcion: 'Impresión de Volantes y Microperforados', categoria: 'Publicidad', monto: 8500000, fecha: '18 May', estado: 'Completado' },
  { id: 'tx-2', descripcion: 'Honorarios Coordinadores Territoriales Comunas 1 a 6', categoria: 'Personal', monto: 14200000, fecha: '19 May', estado: 'Completado' },
  { id: 'tx-3', descripcion: 'Logística Caravana Móvil y Sonido Comuna 13', categoria: 'Eventos', monto: 4800000, fecha: '20 May', estado: 'Completado' },
  { id: 'tx-4', descripcion: 'Aporte Donación Sector Productivo Aprobado CNE', categoria: 'Ingresos', monto: 35000000, fecha: '20 May', estado: 'Completado' },
  { id: 'tx-5', descripcion: 'Pauta Digital y Segmentación Meta/Google Ads', categoria: 'Publicidad', monto: 12000000, fecha: '21 May', estado: 'Completado' }
];

const ModuleFallback = () => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center text-cyan-300">
    <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" aria-label="Cargando módulo" />
  </div>
);

const ALWAYS_FULL_CAMPAIGN_ROLES = new Set(['GLOBAL_ADMIN', 'superadmin', 'auditor']);
const CAMPAIGN_OWNER_ROLES = new Set(['administrador', 'candidato']);

const hasFullCampaignAccess = (user: AuthUser) =>
  ALWAYS_FULL_CAMPAIGN_ROLES.has(user.role)
  || (CAMPAIGN_OWNER_ROLES.has(user.role)
    && Array.isArray(user.permissions)
    && user.permissions.length === 0);

const FUNCTION_DESTINATIONS: Record<string, {
  view: ViewMode;
  adminTab?: string;
  strategicTab?: string;
  territorialSubTab?: 'registro' | 'mapa';
}> = {
  admin_inicio: { view: 'modulo_admin', adminTab: 'inicio' },
  admin_roles: { view: 'modulo_admin', adminTab: 'roles' },
  admin_lideres: { view: 'modulo_admin', adminTab: 'lideres_votantes' },
  admin_presupuesto: { view: 'modulo_admin', adminTab: 'presupuesto_cne' },
  admin_campana: { view: 'modulo_admin', adminTab: 'gestion_campana' },
  admin_testigos: { view: 'modulo_admin', adminTab: 'gestion_testigos' },
  admin_jurados: { view: 'modulo_admin', adminTab: 'jurados_electorales' },
  admin_encuestas: { view: 'modulo_admin', adminTab: 'encuestas_sondeos' },
  est_diag_360: { view: 'gestion_estrategica', strategicTab: 'diagnostico' },
  est_diag_territorial: { view: 'gestion_estrategica', strategicTab: 'diagnostico_territorial' },
  est_programa: { view: 'gestion_estrategica', strategicTab: 'programa_gobierno' },
  est_perfil: { view: 'gestion_estrategica', strategicTab: 'perfil' },
  est_carga_cv: { view: 'gestion_estrategica', strategicTab: 'hoja_vida' },
  est_dofa: { view: 'gestion_estrategica', strategicTab: 'dofa' },
  est_narrativa: { view: 'gestion_estrategica', strategicTab: 'discurso' },
  est_comunicacion: { view: 'gestion_estrategica', strategicTab: 'comunicacion_redes' },

  est_agenda: { view: 'gestion_estrategica', strategicTab: 'agenda_electoral' },
  terr_voters_reg: { view: 'gestion_territorial', territorialSubTab: 'registro' },
  terr_territorial_mgmt: { view: 'gestion_territorial', territorialSubTab: 'mapa' },
  terr_field_witness: { view: 'testigo_campo' },
  terr_surveys: { view: 'encuestas' },
  terr_table_witness: { view: 'jurado_campo' }
};

const destinationForUser = (user: AuthUser) =>
  (user.permissions || []).map(code => FUNCTION_DESTINATIONS[code]).find(Boolean);

const canAccessViewWithAssignedFunctions = (user: AuthUser, view: ViewMode) => {
  if (hasFullCampaignAccess(user)) return view !== 'global_admin' && view !== 'saas_admin';
  if (view === 'primera_interfaz') return true;
  return (user.permissions || []).some(code => FUNCTION_DESTINATIONS[code]?.view === view);
};

const isAssignedLocation = (
  user: AuthUser,
  view: ViewMode,
  adminTab: string,
  strategicTab: string,
  territorialSubTab: 'registro' | 'mapa'
) => {
  if (hasFullCampaignAccess(user) || view === 'primera_interfaz') return true;
  return (user.permissions || []).some(code => {
    const destination = FUNCTION_DESTINATIONS[code];
    if (!destination || destination.view !== view) return false;
    if (view === 'modulo_admin') return destination.adminTab === adminTab;
    if (view === 'gestion_estrategica') return destination.strategicTab === strategicTab;
    if (view === 'gestion_territorial') return destination.territorialSubTab === territorialSubTab;
    return true;
  });
};

export default function App() {
  const isPasswordRecovery = typeof window !== 'undefined' && (() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'recovery' ||
      queryParams.get('type') === 'recovery' ||
      Boolean(queryParams.get('code'));
  })();
  // Support both shareable clean paths (/global-admin, /modulos, /dashboard)
  // and the existing hash-based navigation used inside the SPA.
  const initialRoute = typeof window !== 'undefined'
    ? parseRouteFromHash(window.location.hash) || parseRouteFromHash(`#${window.location.pathname}`)
    : null;

  // Session Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('bee_auth_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error restoring session:', e);
    }
    return null;
  });
  const [liveDataRevision, setLiveDataRevision] = useState(0);

  usePlatformRealtime(Boolean(authUser || initialRoute?.view === 'global_admin'), () => {
    setLiveDataRevision(revision => revision + 1);
  });

  if (isPasswordRecovery) {
    return <Suspense fallback={<ModuleFallback />}><PasswordRecoveryPage /></Suspense>;
  }

  // Current Active Route / View - Always defaults to 'landing' when opening the site
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    // If private global admin deep link was requested via hash, route to it directly as it possesses its own secure guard
    if (initialRoute?.view === 'global_admin') {
      return 'global_admin';
    }
    // If an explicit deep link route was requested via hash (other than landing), allow it only if user is already authenticated
    const savedUser = localStorage.getItem('bee_auth_user');
    if (initialRoute?.view && initialRoute.view !== 'landing' && savedUser) {
      return initialRoute.view;
    }
    return 'landing';
  });

  // Subtab navigation states
  const [adminTab, setAdminTab] = useState<string>(() => initialRoute?.adminTab || 'inicio');
  const [strategicTab, setStrategicTab] = useState<string>(() => initialRoute?.strategicTab || 'diagnostico');
  const [territorialSubTab, setTerritorialSubTab] = useState<'registro' | 'mapa'>(() => initialRoute?.territorialSubTab || 'registro');

  // Modals & UI Controls
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTargetModule, setLoginTargetModule] = useState<string | undefined>(undefined);
  const [loginTargetView, setLoginTargetView] = useState<ViewMode | undefined>(undefined);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedE14, setSelectedE14] = useState<E14Record | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(3);
  const mainContainerRef = useRef<HTMLElement | null>(null);

  // Logout handler - immediately cleans state and returns to landing
  const handleLogout = () => {
    void supabase.auth.signOut();
    setAuthUser(null);
    try {
      localStorage.removeItem('bee_auth_user');
      localStorage.removeItem('bee_current_view');
      localStorage.removeItem('bee_last_activity_timestamp');
      localStorage.removeItem('active_demo_expires_at');
    } catch {
      // ignore
    }
    setCurrentView('landing');
  };

  useEffect(() => {
    if (!authUser) return;
    const expiration = localStorage.getItem('active_demo_expires_at');
    if (!expiration) return;
    const remainingMs = new Date(expiration).getTime() - Date.now();
    if (remainingMs <= 0) {
      handleLogout();
      return;
    }
    const timer = window.setTimeout(() => handleLogout(), remainingMs);
    return () => window.clearTimeout(timer);
  }, [authUser]);

  // Security: Auto-logout after 15 minutes of user inactivity
  useAutoLogout(
    Boolean(authUser || currentView !== 'landing'),
    () => handleLogout()
  );

  // Synchronize browser URL hash with current view and active subtabs
  useEffect(() => {
    const targetHash = getHashForRoute(currentView, adminTab, strategicTab, territorialSubTab);
    const currentHash = window.location.hash;
    const cleanCurrent = currentHash.replace(/^#\/?/, '').toLowerCase();
    const cleanTarget = targetHash.replace(/^#\/?/, '').toLowerCase();

    // Leaving a private or internal area must restore the canonical public URL.
    // Landing section anchors are preserved when the visitor intentionally uses them.
    if (currentView === 'landing') {
      if (['pilares', 'producto', 'demo', 'roi', 'precios', 'faq'].includes(cleanCurrent) && window.location.pathname === '/') {
        return;
      }
      if (window.location.pathname !== '/' || currentHash) {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    // Keep the private owner entry point as a clean path instead of producing
    // duplicated addresses such as /global-admin#/global-admin.
    if (currentView === 'global_admin' && window.location.pathname === '/global-admin') {
      if (currentHash) window.history.replaceState(null, '', '/global-admin');
      return;
    }

    if (cleanCurrent !== cleanTarget) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [currentView, adminTab, strategicTab, territorialSubTab]);

  // Listen to browser Back/Forward or direct hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteFromHash(window.location.hash);
      if (parsed) {
        if (parsed.view && (authUser || ['landing', 'module_select', 'global_admin'].includes(parsed.view))) {
          setCurrentView(parsed.view);
        }
        if (parsed.adminTab) setAdminTab(parsed.adminTab);
        if (parsed.strategicTab) setStrategicTab(parsed.strategicTab);
        if (parsed.territorialSubTab) setTerritorialSubTab(parsed.territorialSubTab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [authUser]);

  // Auto-scroll main view to top whenever view or tabs change
  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentView, adminTab, strategicTab, territorialSubTab]);

  // Live Data collections
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialCalendarEvents);
  const [transactions, setTransactions] = useState<BankTransaction[]>(initialTransactions);
  const [zones] = useState<TerritorialZone[]>(initialTerritorialZones);

  // A cached UI persona is never sufficient: a real Supabase session is required.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setAuthUser(null);
        localStorage.removeItem('bee_auth_user');
      }
    });
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (authUser) {
      localStorage.setItem('bee_auth_user', JSON.stringify(authUser));
    } else {
      localStorage.removeItem('bee_auth_user');
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.id || ALWAYS_FULL_CAMPAIGN_ROLES.has(authUser.role) || Array.isArray(authUser.permissions)) return;
    let cancelled = false;
    void supabase
      .from('user_permissions')
      .select('function_code,actions')
      .eq('user_id', authUser.id)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const permissions = (data || [])
          .filter((permission: any) => Array.isArray(permission.actions) && permission.actions.includes('ACCESS'))
          .map((permission: any) => String(permission.function_code));
        setAuthUser(current => current?.id === authUser.id ? { ...current, permissions } : current);
      });
    return () => { cancelled = true; };
  }, [authUser?.id, authUser?.role, authUser?.permissions]);

  useEffect(() => {
    if (!authUser || hasFullCampaignAccess(authUser) || !Array.isArray(authUser.permissions)) return;
    if (isAssignedLocation(authUser, currentView, adminTab, strategicTab, territorialSubTab)) return;
    const destination = destinationForUser(authUser);
    if (!destination) return;
    if (destination.adminTab) setAdminTab(destination.adminTab);
    if (destination.strategicTab) setStrategicTab(destination.strategicTab);
    if (destination.territorialSubTab) setTerritorialSubTab(destination.territorialSubTab);
    setCurrentView(destination.view);
  }, [authUser, currentView, adminTab, strategicTab, territorialSubTab]);

  useEffect(() => {
    localStorage.setItem('bee_current_view', currentView);
  }, [currentView]);

  // Login handler
  const handleLoginSuccess = (user: AuthUser, redirectRoute?: ViewMode) => {
    setAuthUser(user);
    setIsLoginModalOpen(false);

    const assignedDestination = destinationForUser(user);
    const canUseRequestedRoute = redirectRoute && redirectRoute !== 'landing'
      && canAccessViewWithAssignedFunctions(user, redirectRoute);
    if (!hasFullCampaignAccess(user) && assignedDestination) {
      setAdminTab(assignedDestination.adminTab || 'inicio');
      setStrategicTab(assignedDestination.strategicTab || 'diagnostico');
      setTerritorialSubTab(assignedDestination.territorialSubTab || 'registro');
      setCurrentView(canUseRequestedRoute ? redirectRoute : assignedDestination.view);
    } else if (canUseRequestedRoute) {
      setAdminTab('inicio');
      setStrategicTab('diagnostico');
      setTerritorialSubTab('registro');
      setCurrentView(redirectRoute);
    } else if (user.role === 'territorial') {
      setCurrentView('gestion_territorial');
    } else if (user.role === 'estrategico') {
      setCurrentView('gestion_estrategica');
    } else if (user.role === 'administrador' || user.role === 'superadmin') {
      setCurrentView('modulo_admin');
    } else {
      setCurrentView('primera_interfaz');
    }
  };

  // Safe navigation with RBAC check
  const handleSelectView = (view: ViewMode) => {
    // Cleanly set initial subtabs for each module whenever navigated to
    if (view === 'modulo_admin') {
      setAdminTab('inicio');
    } else if (view === 'gestion_estrategica') {
      setStrategicTab('diagnostico');
    } else if (view === 'gestion_territorial') {
      setTerritorialSubTab('registro');
    }

    if (view === 'landing' || view === 'module_select') {
      setCurrentView(view);
      setSidebarOpen(false);
      return;
    }

    if (!authUser) {
      setLoginTargetView(view);
      setLoginTargetModule(undefined);
      setIsLoginModalOpen(true);
      return;
    }

    if (view === 'primera_interfaz') {
      setCurrentView(view);
      setSidebarOpen(false);
      return;
    }

    // Role-based permission check
    const userRole = authUser.role;
    const isAllowed = canAccessViewWithAssignedFunctions(authUser, view);

    if (isAllowed) {
      setCurrentView(view);
      setSidebarOpen(false);
    } else {
      // If forbidden, fallback to accessible module
      alert(`El rol ${userRole} no tiene permisos asignados para acceder a este módulo.`);
    }
  };

  // Add Calendar Event Modal Submit
  const handleAddCalendarEvent = (event: CalendarEvent) => {
    setCalendarEvents(prev => [event, ...prev]);
    setActiveModal(null);
  };

  // Add Transaction Modal Submit
  const handleAddTransaction = (tx: BankTransaction) => {
    setTransactions(prev => [tx, ...prev]);
    setActiveModal(null);
  };

  // Render Full Screen Views (Landing / Module Selector)
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-[#080808] text-white relative">
        <Suspense fallback={<ModuleFallback />}>
          <RedSunBeeCampaignLanding 
            onLogin={() => setCurrentView('module_select')}
          />
        </Suspense>

        {/* Global Login Modal */}
        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          targetModule={loginTargetModule}
          targetView={loginTargetView}
        />
      </div>
    );
  }

  if (currentView === 'module_select') {
    return (
      <div className="min-h-screen bg-[#020712] text-white">
        <Suspense fallback={<ModuleFallback />}>
          <ModuleSelectPage 
            onBack={() => setCurrentView('landing')}
            onSelectModule={(view, moduleTitle) => {
              setLoginTargetModule(moduleTitle);
              setLoginTargetView(view);
              setIsLoginModalOpen(true);
            }}
            onOpenLogin={() => {
              setLoginTargetModule(undefined);
              setLoginTargetView(undefined);
              setIsLoginModalOpen(true);
            }}
          />
        </Suspense>

        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          targetModule={loginTargetModule}
          targetView={loginTargetView}
        />
      </div>
    );
  }

  if (currentView === 'saas_admin') {
    return (
      <div key={`saas-${liveDataRevision}`} className="min-h-screen bg-[#020813] text-slate-100">
        <Suspense fallback={<ModuleFallback />}>
        <PanelAdministrativoSaaS 
          onSelectView={handleSelectView}
          authUser={authUser}
          onImpersonateCampaign={(campaignName) => {
            if (authUser) {
              setAuthUser({
                ...authUser,
                clientName: campaignName
              });
            }
            handleSelectView('primera_interfaz');
          }}
        />
        </Suspense>
      </div>
    );
  }

  if (currentView === 'global_admin') {
    return (
      <div key={`global-${liveDataRevision}`} className="min-h-screen bg-[#020617] text-slate-100">
        <Suspense fallback={<ModuleFallback />}>
        <GlobalAdminGuard 
          onBackToApp={() => {
            handleSelectView('landing');
          }}
        />
        </Suspense>
      </div>
    );
  }

  const restrictedPermissionsReady = !authUser
    || ALWAYS_FULL_CAMPAIGN_ROLES.has(authUser.role)
    || Array.isArray(authUser.permissions);
  const restrictedLocationAllowed = !authUser
    || hasFullCampaignAccess(authUser)
    || (restrictedPermissionsReady
      && isAssignedLocation(authUser, currentView, adminTab, strategicTab, territorialSubTab));
  if (!restrictedPermissionsReady || !restrictedLocationAllowed) {
    return <ModuleFallback />;
  }

  // Render Main Dashboard Layout Shell
  return (
    <CampaignProvider>
    <div className="app-shell h-[100dvh] min-h-0 w-full min-w-0 overflow-hidden flex flex-col bg-[#030712] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Main Workspace: Sidebar + Dynamic View Content */}
      <div className="flex-1 flex h-full overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <Sidebar 
          currentView={currentView}
          onSelectView={handleSelectView}
          adminTab={adminTab}
          onSelectAdminTab={setAdminTab}
          strategicTab={strategicTab}
          onSelectStrategicTab={setStrategicTab}
          territorialSubTab={territorialSubTab}
          onSelectTerritorialSubTab={setTerritorialSubTab}
          onOpenUserRolesModal={() => setActiveModal('user_roles')}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          authUser={authUser}
          onLogout={handleLogout}
        />

        {/* Main Content Area with Smooth Motion Transitions */}
        <main ref={mainContainerRef} className="app-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#040e21] via-[#020817] to-[#01040a] relative custom-scrollbar">
          {/* Top Mobile Bar for fast drawer access on phones & tablets */}
          <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-[#051329]/95 border-b border-cyan-500/20 backdrop-blur-md">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-emerald-400 shadow-md transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
            >
              <Menu className="w-4 h-4" />
              <span>Menú</span>
            </button>

            <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
              Campaña Ganadora IA
            </span>
          </div>

          <ErrorBoundary 
            moduleName={currentView}
            onReset={() => setCurrentView('primera_interfaz')}
          >
            <Suspense fallback={<ModuleFallback />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView + (currentView === 'modulo_admin' ? adminTab : '') + (currentView === 'gestion_estrategica' ? strategicTab : '') + (currentView === 'modulo_admin' ? '' : `-live-${liveDataRevision}`)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full h-full"
              >
                {/* Executive Command Center / Sala de Control */}
                {currentView === 'primera_interfaz' && (
                  <PrimeraInterfaz 
                    onLoginSuccess={handleLoginSuccess}
                  />
                )}

                {/* Modulo 1: Gestion Administrativa & Financiera */}
                {currentView === 'modulo_admin' && (
                  <ModuloAdministrativo 
                    onSelectView={handleSelectView}
                    calendarEvents={calendarEvents}
                    onAddEventClick={() => setActiveModal('add_event')}
                    onOpenUserRolesModal={() => setActiveModal('user_roles')}
                    activeTab={adminTab}
                    onTabChange={setAdminTab}
                    authUser={authUser}
                  />
                )}

                {/* Modulo 2: Gestion Estratégica, IA, FODA & Campaña */}
                {currentView === 'gestion_estrategica' && (
                  <GestionEstrategica 
                    onSelectView={handleSelectView}
                    activeTab={strategicTab as any}
                    onSelectTab={setStrategicTab as any}
                    onOpenBudgetModal={() => setActiveModal('add_tx')}
                    authUser={authUser}
                  />
                )}

                {/* Modulo 3: Operacion Territorial & Censo */}
                {currentView === 'gestion_territorial' && (
                  <GestionTerritorial 
                    onSelectView={handleSelectView}
                    zones={zones}
                    onOpenFieldRegistrationModal={() => setTerritorialSubTab('registro')}
                    initialSubTab={territorialSubTab}
                    onSubTabChange={setTerritorialSubTab}
                    authUser={authUser}
                  />
                )}

                {/* Testigos de Campo (Día E) */}
                {currentView === 'testigo_campo' && (
                  <TestigoCampoView 
                    onSelectView={handleSelectView}
                    authUser={authUser}
                  />
                )}

                {/* Encuestas y Sondeos Electorales */}
                {currentView === 'encuestas' && (
                  <EncuestasView 
                    onSelectView={handleSelectView}
                    authUser={authUser}
                  />
                )}

                {/* Jurados de Mesa y Escrutinio */}
                {currentView === 'jurado_campo' && (
                  <JuradoCampoView 
                    onSelectView={handleSelectView}
                    authUser={authUser}
                  />
                )}

                {/* Presupuesto y Contabilidad CNE */}
                {currentView === 'presupuesto' && (
                  <PresupuestoContabilidad 
                    onSelectView={handleSelectView}
                    transactions={transactions}
                    onOpenAddTransactionModal={() => setActiveModal('add_tx')}
                    onOpenOCRModal={() => setActiveModal('ocr_scanner')}
                  />
                )}

                {/* QA & Simulacros Electorales */}
                {currentView === 'pruebas_electorales' && (
                  <PruebasElectoralesView 
                    onSelectView={handleSelectView}
                    authUser={authUser || {
                      id: 'usr-admin-default',
                      name: 'Super Administrador Electoral',
                      email: 'admin@campanaganadora.com',
                      role: 'superadmin',
                      roleName: 'Superadministrador AI',
                      moduleName: 'Auditoría & Control'
                    }}
                  />
                )}

                {/* Configuración del Sistema */}
                {currentView === 'configuracion' && (
                  <ConfiguracionView 
                    onSelectView={handleSelectView}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Modals Manager */}
      <Modals 
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        selectedE14={selectedE14}
        onAddCalendarEvent={handleAddCalendarEvent}
        onAddTransaction={handleAddTransaction}
      />

      {/* Global Login & Persona Switcher Modal */}
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
    </CampaignProvider>
  );
}
