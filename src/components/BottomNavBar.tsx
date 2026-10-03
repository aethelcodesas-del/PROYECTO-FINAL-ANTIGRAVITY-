import React from 'react';
import { ViewMode } from '../types';
import { 
  Sparkles, 
  MapPin, 
  Building2, 
  Menu
} from 'lucide-react';

interface BottomNavBarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenSidebar: () => void;
  userRole?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onSelectView,
  onOpenSidebar,
  userRole
}) => {
  const isGlobalAdmin = userRole === 'GLOBAL_ADMIN' || userRole === 'superadmin';

  const navItems = [
    {
      id: 'gestion_estrategica' as ViewMode,
      label: 'Estrategia',
      icon: Sparkles,
      activeColor: 'text-emerald-400',
      activeBg: 'bg-emerald-500/15'
    },
    {
      id: 'gestion_territorial' as ViewMode,
      label: 'Territorio',
      icon: MapPin,
      activeColor: 'text-teal-400',
      activeBg: 'bg-teal-500/15'
    },
    {
      id: 'modulo_admin' as ViewMode,
      label: 'Admin',
      icon: Building2,
      activeColor: 'text-blue-400',
      activeBg: 'bg-blue-500/15'
    },
  ];

  return (
    <nav 
      aria-label="Navegación móvil"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#051329]/95 border-t border-cyan-500/25 backdrop-blur-xl shadow-2xl transition-all duration-200"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-4 items-center justify-around h-14 px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectView(item.id);
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] w-full py-1 rounded-xl transition-all duration-150 cursor-pointer ${
                isActive 
                  ? `${item.activeBg} ${item.activeColor} font-bold` 
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: Open Full Drawer Menu */}
        <button
          onClick={onOpenSidebar}
          aria-label="Abrir menú completo de navegación"
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] w-full py-1 rounded-xl text-slate-400 hover:text-cyan-300 active:scale-95 transition-all cursor-pointer"
        >
          <div className="relative p-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Menu className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight leading-none text-slate-300">
            Menú
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavBar;
