import React, { useState, useEffect } from 'react';
import { GlobalAdminSession, GlobalAdminTab } from '../../types/globalAdmin';
import { GlobalAdminService } from '../../services/globalAdminService';
import { GlobalAdminDashboard } from './views/GlobalAdminDashboard';
import { GlobalAdminUsers } from './views/GlobalAdminUsers';
import { GlobalAdminRoles } from './views/GlobalAdminRoles';
import { GlobalAdminCampaigns } from './views/GlobalAdminCampaigns';
import { GlobalAdminModules } from './views/GlobalAdminModules';
import { GlobalAdminApis } from './views/GlobalAdminApis';
import { GlobalAdminAudit } from './views/GlobalAdminAudit';
import { GlobalAdminSecurity } from './views/GlobalAdminSecurity';
import { GlobalAdminConfig } from './views/GlobalAdminConfig';
import { GlobalAdminSystem } from './views/GlobalAdminSystem';
import { GlobalAdminCommercial } from './views/GlobalAdminCommercial';
import { GlobalAdminRegistraduria } from './views/GlobalAdminRegistraduria';
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Flag,
  Layers,
  Zap,
  FileText,
  Lock,
  Sliders,
  Cpu,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Clock,
  Radio,
  ExternalLink,
  BadgeDollarSign,
  Globe
} from 'lucide-react';

interface GlobalAdminLayoutProps {
  session: GlobalAdminSession;
  onLogout: () => void;
  onExitToApp?: () => void;
}

export const GlobalAdminLayout: React.FC<GlobalAdminLayoutProps> = ({
  session,
  onLogout,
  onExitToApp
}) => {
  const [activeTab, setActiveTab] = useState<GlobalAdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sessionRemaining, setSessionRemaining] = useState<string>('59:59');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number>(() => new Date(session.expiresAt).getTime());

  // Keep the visual session and API authorization synchronized with Supabase's
  // automatic token rotation while the administrator remains authenticated.
  useEffect(() => {
    let cancelled = false;
    const renewSession = async () => {
      try {
        const result = await GlobalAdminService.verifySession();
        if (!cancelled && result.valid && result.session) {
          setSessionExpiresAt(new Date(result.session.expiresAt).getTime());
        } else if (!cancelled) {
          onLogout();
        }
      } catch {
        if (!cancelled) onLogout();
      }
    };

    const renewTimer = window.setInterval(renewSession, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(renewTimer);
    };
  }, [onLogout]);

  // Session countdown calculation
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((sessionExpiresAt - now) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setSessionRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);

    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [sessionExpiresAt]);

  const navItems = [
    { id: 'dashboard' as GlobalAdminTab, label: 'Dashboard Central', icon: LayoutDashboard },
    { id: 'usuarios' as GlobalAdminTab, label: 'Usuarios y Accesos', icon: Users },
    { id: 'roles' as GlobalAdminTab, label: 'Roles y Matriz RBAC', icon: ShieldCheck },
    { id: 'campanas' as GlobalAdminTab, label: 'Gestión Campañas', icon: Flag },
    { id: 'modulos' as GlobalAdminTab, label: 'Control Módulos', icon: Layers },
    { id: 'registraduria' as GlobalAdminTab, label: 'Actualización Registraduría', icon: Globe },
    { id: 'apis' as GlobalAdminTab, label: 'APIs & Integraciones', icon: Zap },
    { id: 'auditoria' as GlobalAdminTab, label: 'Logs de Auditoría', icon: FileText },
    { id: 'seguridad' as GlobalAdminTab, label: 'Centro de Seguridad', icon: ShieldAlert },
    { id: 'configuracion' as GlobalAdminTab, label: 'Parámetros Globales', icon: Sliders },
    { id: 'comercial' as GlobalAdminTab, label: 'Planes y Landing', icon: BadgeDollarSign },
    { id: 'sistema' as GlobalAdminTab, label: 'Telemetría Sistema', icon: Cpu },
  ];

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <GlobalAdminDashboard onNavigateTab={setActiveTab} />;
      case 'usuarios':
        return <GlobalAdminUsers />;
      case 'roles':
        return <GlobalAdminRoles />;
      case 'campanas':
        return <GlobalAdminCampaigns />;
      case 'modulos':
        return <GlobalAdminModules />;
      case 'registraduria':
        return <GlobalAdminRegistraduria />;
      case 'apis':
        return <GlobalAdminApis />;
      case 'auditoria':
        return <GlobalAdminAudit />;
      case 'seguridad':
        return <GlobalAdminSecurity />;
      case 'configuracion':
        return <GlobalAdminConfig />;
      case 'comercial':
        return <GlobalAdminCommercial />;
      case 'sistema':
        return <GlobalAdminSystem />;
      default:
        return <GlobalAdminDashboard onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <div className="global-admin-shell min-h-[100dvh] w-full min-w-0 bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800/90 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo & Terminal Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-950 to-blue-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-950/50">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm sm:text-base text-white tracking-wider">
                  GLOBAL ADMIN
                </span>
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/40 hidden sm:inline-block">
                  MASTER PROXY
                </span>
              </div>
              <span className="text-[11px] font-sans text-slate-400 block -mt-0.5">
                Terminal Privado Cifrado
              </span>
            </div>
          </div>
        </div>

        {/* Right Session & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Session Timer Pill */}
          <div className="hidden sm:flex items-center space-x-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-slate-400 font-sans">Expira en:</span>
            <span className="text-cyan-300 font-bold font-mono tracking-wider">{sessionRemaining}</span>
          </div>

          {/* User badge */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 font-semibold font-sans truncate max-w-[140px]">
              {session.user.name}
            </span>
          </div>

          {/* Return to App Button */}
          {onExitToApp && (
            <button
              onClick={onExitToApp}
              title="Volver a la interfaz electoral regular"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold font-sans border border-slate-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir al Sistema</span>
            </button>
          )}

          {/* Emergency Quick Lock Button */}
          <button
            onClick={onLogout}
            title="Bloquear terminal y cerrar sesión inmediatamente"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 text-xs font-sans font-bold border border-rose-500/40 transition-all shadow-lg shadow-rose-950/30 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bloquear Terminal</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-950/90 border-r border-slate-800/80 p-4 shrink-0 font-sans text-xs overflow-y-auto">
          <div className="mb-3 px-2 text-[11px] font-extrabold font-display text-slate-500 uppercase tracking-widest">
            NÚCLEO DE ADMINISTRACIÓN
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/30 translate-x-0.5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-800/80">
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold font-display tracking-wider text-slate-400 uppercase">ESTADO SISTEMA</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 100% OK
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Protección contra intrusiones activa y logs firmados digitalmente.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div 
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-slate-950 border-r border-slate-800 p-4 font-sans text-xs flex flex-col z-10 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <span className="font-bold font-display text-white text-sm">MENÚ GLOBAL ADMIN</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left font-semibold transition-all ${
                        isActive
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-500/30 font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Bloquear y Salir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content View Body */}
        <main className="app-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 bg-[#020617]">
          <div className="w-full max-w-7xl mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};
