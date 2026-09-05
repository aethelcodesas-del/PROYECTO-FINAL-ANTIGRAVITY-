/**
 * GeoSubdivisionSelect — Selector de subdivisión geográfica de la campaña
 *
 * Muestra automáticamente el label correcto ("Barrio", "Corregimiento",
 * "Localidad"…) y la lista real del municipio de la campaña activa.
 *
 * Incluye opción "Otro — escribir" para valores no listados.
 *
 * Uso:
 *   <GeoSubdivisionSelect value={zona} onChange={setZona} required />
 */

import React, { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';

interface GeoSubdivisionSelectProps {
  /** Valor actual del campo */
  value: string;
  /** Callback al cambiar */
  onChange: (value: string) => void;
  /** Texto placeholder */
  placeholder?: string;
  /** Clases CSS adicionales para el wrapper */
  className?: string;
  /** Si el campo es requerido */
  required?: boolean;
  /** Deshabilitar el select */
  disabled?: boolean;
  /** Tamaño visual */
  size?: 'sm' | 'md';
}

export const GeoSubdivisionSelect: React.FC<GeoSubdivisionSelectProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
  disabled = false,
  size = 'md',
}) => {
  const geo = useCampaignGeo();
  const [isCustom, setIsCustom] = useState(
    value !== '' && !geo.subdivisions.includes(value) && value !== '__otro__'
  );
  const [customValue, setCustomValue] = useState(isCustom ? value : '');

  const label = geo.subdivisionLabel;
  const ph = placeholder || `Seleccionar ${label}…`;

  const inputClass = size === 'sm'
    ? 'w-full bg-[#0a1628] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all'
    : 'w-full bg-[#0a1628] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all';

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === '__otro__') {
      setIsCustom(true);
      onChange(customValue);
    } else {
      setIsCustom(false);
      onChange(v);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label dinámico */}
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300/80 uppercase tracking-wider">
        <MapPin className="w-3 h-3" />
        {label}
        {required && <span className="text-rose-400">*</span>}
        {geo.municipality && (
          <span className="text-slate-500 font-normal normal-case tracking-normal ml-1">
            — {geo.municipality}
          </span>
        )}
      </label>

      {!isCustom ? (
        <div className="relative">
          <select
            value={geo.subdivisions.includes(value) ? value : ''}
            onChange={handleSelectChange}
            required={required}
            disabled={disabled}
            className={`${inputClass} pr-8 appearance-none cursor-pointer`}
          >
            <option value="">{ph}</option>
            {geo.subdivisions.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
            <option value="__otro__">✏️ Otro — escribir manualmente</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={handleCustomChange}
            placeholder={`Escribir ${label.toLowerCase()}…`}
            required={required}
            disabled={disabled}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => { setIsCustom(false); onChange(''); }}
            className="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition-colors"
          >
            Lista
          </button>
        </div>
      )}

      {/* Hint territorial */}
      {geo.municipality && !isCustom && (
        <p className="text-[10px] text-slate-500 leading-tight">
          {geo.subdivisions.length} {geo.subdivisionLabelPlural.toLowerCase()} disponibles en {geo.municipality}
        </p>
      )}
    </div>
  );
};
