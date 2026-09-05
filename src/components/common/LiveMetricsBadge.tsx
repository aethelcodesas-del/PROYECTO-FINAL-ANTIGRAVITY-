/**
 * LiveMetricsBadge — Componente mini que muestra una métrica en vivo
 * con un pulso animado que indica actualización en tiempo real.
 *
 * Uso:
 *   <LiveMetricsBadge value={live.leaderCount} label="Líderes" color="emerald" />
 *   <LiveMetricsBadge value={live.budgetExecutedCop} label="Ejecutado" format="cop" color="amber" />
 */

import React from 'react';
import { useCampaignLive, useCampaign } from '../../contexts/CampaignContext';

type Color = 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';

interface LiveMetricsBadgeProps {
  /** Valor a mostrar */
  value: number;
  /** Etiqueta descriptiva */
  label: string;
  /** Formato de visualización */
  format?: 'number' | 'cop' | 'pct';
  /** Color del tema */
  color?: Color;
  /** Mostrar punto de pulso animado */
  showPulse?: boolean;
  className?: string;
}

const COLOR_MAP: Record<Color, { text: string; badge: string; pulse: string }> = {
  cyan:    { text: 'text-cyan-300',    badge: 'bg-cyan-500/10 border-cyan-500/30',    pulse: 'bg-cyan-400' },
  emerald: { text: 'text-emerald-300', badge: 'bg-emerald-500/10 border-emerald-500/30', pulse: 'bg-emerald-400' },
  amber:   { text: 'text-amber-300',   badge: 'bg-amber-500/10 border-amber-500/30',   pulse: 'bg-amber-400' },
  rose:    { text: 'text-rose-300',    badge: 'bg-rose-500/10 border-rose-500/30',    pulse: 'bg-rose-400' },
  violet:  { text: 'text-violet-300',  badge: 'bg-violet-500/10 border-violet-500/30', pulse: 'bg-violet-400' },
  sky:     { text: 'text-sky-300',     badge: 'bg-sky-500/10 border-sky-500/30',      pulse: 'bg-sky-400' },
};

function formatValue(value: number, format: 'number' | 'cop' | 'pct'): string {
  if (format === 'cop') {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)         return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString('es-CO')}`;
  }
  if (format === 'pct') return `${value}%`;
  return value.toLocaleString('es-CO');
}

export const LiveMetricsBadge: React.FC<LiveMetricsBadgeProps> = ({
  value,
  label,
  format = 'number',
  color = 'cyan',
  showPulse = true,
  className = '',
}) => {
  const { live } = useCampaign();
  const isStale = live.lastUpdatedAt === 0;
  const colors = COLOR_MAP[color];

  return (
    <div className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border ${colors.badge} ${className}`}>
      <div className="flex items-center gap-1.5">
        {showPulse && (
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${colors.pulse}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.pulse}`} />
          </span>
        )}
        <span className={`text-base font-black leading-none tabular-nums ${colors.text} ${isStale ? 'opacity-40' : ''}`}>
          {isStale ? '—' : formatValue(value, format)}
        </span>
      </div>
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
    </div>
  );
};

// ── Panel de métricas completo (usado en PrimeraInterfaz y headers de módulos) ─

export const CampaignLivePanel: React.FC<{ className?: string }> = ({ className = '' }) => {
  const live = useCampaignLive();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <LiveMetricsBadge value={live.budgetLimitCop}    label="Tope CNE"   format="cop"    color="violet" />
      <LiveMetricsBadge value={live.budgetExecutedCop} label="Ejecutado"  format="cop"    color="amber"  />
      <LiveMetricsBadge value={live.budgetExecutionPct} label="Ejecución" format="pct"    color={live.budgetExecutionPct > 90 ? 'rose' : 'emerald'} />
      <LiveMetricsBadge value={live.leaderCount}       label="Líderes"    format="number" color="cyan"   />
      <LiveMetricsBadge value={live.voterCount}        label="Votantes"   format="number" color="emerald" />
      <LiveMetricsBadge value={live.witnessCount}      label="Testigos"   format="number" color="sky"    />
      <LiveMetricsBadge value={live.jurorCount}        label="Jurados"    format="number" color="amber"  />
    </div>
  );
};
