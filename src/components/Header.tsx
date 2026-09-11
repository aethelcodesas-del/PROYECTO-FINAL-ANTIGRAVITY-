import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, AuthUser } from '../types';
import {
  LayoutDashboard,
  Bell,
  Menu
} from 'lucide-react';
import { ColorModeToggle } from './common/ColorModeToggle';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  unreadNotifications: number;
  onClearNotifications?: () => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  unreadNotifications,
  onClearNotifications,
  onToggleSidebar
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Nueva encuesta de intención de voto cargada en Gestión Territorial', time: 'Hace 5 min', read: false },
    { id: 2, text: 'Ober Osorio envió un comando de análisis al Centro de Control', time: 'Hace 15 min', read: false },
    { id: 3, text: 'Alerta: Posible abstención detectada en Comuna 4 (Aranjuez)', time: 'Hace 1 hora', read: false }
  ]);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync new notifications when unreadCount increases in parent
  useEffect(() => {
    const unreadLocal = notifications.filter(n => !n.read).length;
    if (unreadNotifications > unreadLocal) {
      const diff = unreadNotifications - unreadLocal;
      const newNotifs = Array.from({ length: diff }).map((_, i) => ({
        id: Date.now() + i,
        text: 'Nueva alerta del Centro de Comando IA: Se procesó un comando de análisis territorial.',
        time: 'Hace un momento',
        read: false
      }));
      setNotifications(prev => [...newNotifs, ...prev]);
    } else if (unreadNotifications === 0 && unreadLocal > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [unreadNotifications]);

  // Click outside listener for notification popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (onClearNotifications) {
      onClearNotifications();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#030d1d]/90 border-b border-slate-800 text-white px-3 sm:px-6 py-2.5 shadow-xl backdrop-blur-xl transition-all w-full">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">

        {/* Left Side: Panel de Control */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              aria-label="Abrir menú de navegación"
              className="lg:hidden p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight whitespace-nowrap">
                Panel de Control
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                En línea
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Appearance Toggle & Notifications */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Visual Appearance Color Mode Toggle */}
          <ColorModeToggle />

          {/* Notifications */}
          <div className="relative" ref={popoverRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notificaciones"
              className="relative p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 active:bg-slate-600 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute 0 top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#030d1d]" />
              )}
            </button>

            {showNotifications && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-[340px] bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-xl z-50 text-left space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Notificaciones</h3>
                  {unreadNotifications > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Marcar leídas
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No hay notificaciones pendientes</p>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-2.5 rounded-lg border transition-all ${
                          notif.read 
                            ? 'bg-slate-950/40 border-slate-800 text-slate-400' 
                            : 'bg-cyan-950/30 border-cyan-500/30 text-slate-200'
                        }`}
                      >
                        <p className="text-xs font-medium leading-relaxed">{notif.text}</p>
                        <span className="text-[9px] text-slate-500 mt-1 block font-mono">{notif.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
