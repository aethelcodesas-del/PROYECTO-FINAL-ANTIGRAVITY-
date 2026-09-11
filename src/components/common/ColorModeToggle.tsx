import React from 'react';
import { useColorMode, ColorMode } from '../../utils/themeColorMode';
import { Palette, Sparkles, Check } from 'lucide-react';

interface ColorModeToggleProps {
  variant?: 'switch' | 'segmented' | 'cards';
  showLabel?: boolean;
  className?: string;
}

export const ColorModeToggle: React.FC<ColorModeToggleProps> = ({
  variant = 'segmented',
  showLabel = true,
  className = ''
}) => {
  const { colorMode, setColorMode, isWhiteMode } = useColorMode();

  if (variant === 'cards') {
    return (
      <div className={`space-y-3 ${className}`}>
        {showLabel && (
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="font-bold flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              ESTILO VISUAL Y ACENTOS
            </span>
            <span className="text-[10px] text-slate-400">
              {isWhiteMode ? 'Modo Blanco Activo' : 'Color Establecido Activo'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Selección de Estilo Visual">
          {/* Card 1: Color Establecido */}
          <button
            type="button"
            role="radio"
            aria-checked={!isWhiteMode}
            onClick={() => setColorMode('ESTABLISHED')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer font-mono text-xs flex flex-col justify-between ${
              !isWhiteMode
                ? 'bg-gradient-to-br from-cyan-950/60 to-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-950/40 translate-y-[-1px]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Palette className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Color Establecido</h4>
                  <p className="text-[10px] text-cyan-400">Cian & Acentos Nativos</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                !isWhiteMode ? 'border-cyan-400 bg-cyan-500 text-black' : 'border-slate-700'
              }`}>
                {!isWhiteMode && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              Conserva el diseño cibernético estándar con resaltados cian, azules y contrastes oscuros.
            </p>
          </button>

          {/* Card 2: Efecto Blanco */}
          <button
            type="button"
            role="radio"
            aria-checked={isWhiteMode}
            onClick={() => setColorMode('WHITE')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer font-mono text-xs flex flex-col justify-between ${
              isWhiteMode
                ? 'bg-gradient-to-br from-slate-800/80 to-slate-900 border-white/60 shadow-lg shadow-white/10 translate-y-[-1px]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-800 border border-white/50 flex items-center justify-center text-white shadow-sm shadow-white/30">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Efecto Blanco</h4>
                  <p className="text-[10px] text-slate-300">Blanco Puro & Resplandor</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                isWhiteMode ? 'border-white bg-white text-black' : 'border-slate-700'
              }`}>
                {isWhiteMode && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              Aplica un efecto blanco brillante y sobrio a los acentos principales manteniendo la legibilidad.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // Segmented Pill Control (Compact for Navbars & Headers)
  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      {showLabel && (
        <span className={`text-[11px] hidden md:inline-block mr-1 ${isWhiteMode ? 'text-slate-600 font-bold' : 'text-slate-400'}`}>
          Tema:
        </span>
      )}

      <div
        role="radiogroup"
        aria-label="Alternar Color Establecido o Blanco"
        className={`rounded-xl p-0.5 flex items-center transition-all ${
          isWhiteMode
            ? 'bg-slate-100 border border-slate-300 shadow-inner'
            : 'bg-slate-900/90 border border-slate-800 shadow-inner'
        }`}
      >
        {/* Option 1: Color Establecido */}
        <button
          type="button"
          role="radio"
          aria-checked={!isWhiteMode}
          aria-label="Color establecido"
          title="Activar color establecido (cian nativo)"
          onClick={() => setColorMode('ESTABLISHED')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
            !isWhiteMode
              ? 'bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Palette className={`w-3 h-3 ${!isWhiteMode ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">Color establecido</span>
          <span className="sm:hidden">Color</span>
        </button>

        {/* Option 2: Blanco */}
        <button
          type="button"
          role="radio"
          aria-checked={isWhiteMode}
          aria-label="Blanco"
          title="Activar efecto blanco"
          onClick={() => setColorMode('WHITE')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
            isWhiteMode
              ? 'bg-white text-slate-900 border border-slate-300 font-bold shadow-sm shadow-slate-200/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Sparkles className={`w-3 h-3 ${isWhiteMode ? 'text-blue-600' : 'text-slate-500'}`} />
          <span>Blanco</span>
        </button>
      </div>
    </div>
  );
};
