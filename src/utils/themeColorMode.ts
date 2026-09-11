/**
 * SISTEMA DE ALTERNANCIA DE COLOR AISLADO POR MÓDULO
 * Archivo: src/utils/themeColorMode.ts
 * 
 * Permite alternar visualmente entre:
 * 1. COLOR ESTABLECIDO (ESTABLISHED): Estilo cibernético nativo con acentos cian/azul.
 * 2. EFECTO BLANCO (WHITE): Efecto claro luminoso de alto contraste con tarjetas y fondos blancos.
 * 
 * Alcance y Aislamiento:
 * - Cada módulo gestiona y recuerda su propio estado de forma totalmente aislada:
 *   1. Gestión Administrativa ('gestion_administrativa') -> 'app_color_mode_gestion_administrativa'
 *   2. Gestión Estratégica ('gestion_estrategica') -> 'app_color_mode_gestion_estrategica'
 *   3. Gestión Territorial ('gestion_territorial') -> 'app_color_mode_gestion_territorial'
 *   4. Admin Global ('global_admin') -> 'app_color_mode_global_admin'
 * 
 * Inmunidad Garantizada:
 * - La Landing Page y la pantalla "Seleccione el Módulo de Operación" NUNCA reciben el tema blanco.
 * - Cero mutación global de document.documentElement para páginas públicas.
 * - Preservación 100% de colores funcionales (éxito, error, advertencia, info).
 * - Cero modificaciones a Supabase, campañas, usuarios, Registraduría ni datos.
 */

import { useState, useEffect } from 'react';

export type ColorMode = 'ESTABLISHED' | 'WHITE';

export type ModuleThemeId = 
  | 'global_admin' 
  | 'gestion_administrativa' 
  | 'gestion_estrategica' 
  | 'gestion_territorial';

export const COLOR_MODES = {
  ESTABLISHED: 'ESTABLISHED' as const,
  WHITE: 'WHITE' as const
};

export const MODULE_STORAGE_KEYS: Record<ModuleThemeId, string> = {
  global_admin: 'app_color_mode_global_admin',
  gestion_administrativa: 'app_color_mode_gestion_administrativa',
  gestion_estrategica: 'app_color_mode_gestion_estrategica',
  gestion_territorial: 'app_color_mode_gestion_territorial'
};

export const LEGACY_COLOR_MODE_STORAGE_KEY = 'app_color_mode';
export const THEME_STORAGE_KEY = LEGACY_COLOR_MODE_STORAGE_KEY;
export const COLOR_MODE_CHANGE_EVENT = 'app-module-color-mode-changed';

/**
 * Obtiene el modo de color guardado para un módulo específico
 */
export function getModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa'): ColorMode {
  if (typeof window === 'undefined') return 'ESTABLISHED';
  try {
    const specificKey = MODULE_STORAGE_KEYS[moduleId] || `app_color_mode_${moduleId}`;
    const saved = localStorage.getItem(specificKey);
    if (saved === 'WHITE' || saved === 'white') return 'WHITE';
    if (saved === 'ESTABLISHED' || saved === 'established') return 'ESTABLISHED';

    // Migración segura / fallback a clave legacy si no se ha configurado la específica
    const legacy = localStorage.getItem(LEGACY_COLOR_MODE_STORAGE_KEY);
    if (legacy === 'WHITE' || legacy === 'white') return 'WHITE';
    return 'ESTABLISHED';
  } catch {
    return 'ESTABLISHED';
  }
}

/**
 * Guarda y despacha el nuevo modo de color para un módulo específico
 */
export function setModuleColorMode(
  mode: ColorMode, 
  moduleId: ModuleThemeId = 'gestion_administrativa'
): ColorMode {
  if (typeof window === 'undefined') return mode;
  try {
    const specificKey = MODULE_STORAGE_KEYS[moduleId] || `app_color_mode_${moduleId}`;
    localStorage.setItem(specificKey, mode);
  } catch (e) {
    console.warn(`Error guardando preferencia de tema para ${moduleId}:`, e);
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent(COLOR_MODE_CHANGE_EVENT, { detail: { mode, moduleId } })
    );
  }

  return mode;
}

/**
 * Alterna el modo de color para un módulo específico
 */
export function toggleModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa'): ColorMode {
  const current = getModuleColorMode(moduleId);
  const next: ColorMode = current === 'WHITE' ? 'ESTABLISHED' : 'WHITE';
  setModuleColorMode(next, moduleId);
  return next;
}

/**
 * Métodos de compatibilidad histórica
 */
export function getColorMode(): ColorMode {
  return getModuleColorMode('gestion_administrativa');
}

export function setColorMode(mode: ColorMode): ColorMode {
  return setModuleColorMode(mode, 'gestion_administrativa');
}

export function toggleColorMode(): ColorMode {
  return toggleModuleColorMode('gestion_administrativa');
}

export function applyColorModeToDocument(mode: ColorMode): void {
  // Función de compatibilidad no invasiva (no muta document.documentElement para proteger la Landing)
}

export function initColorMode(): ColorMode {
  return getColorMode();
}

/**
 * Hook de React para acceder y reaccionar a cambios de tema dentro de un módulo
 */
export function useModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa') {
  const [colorMode, setModeState] = useState<ColorMode>(() => getModuleColorMode(moduleId));

  useEffect(() => {
    const current = getModuleColorMode(moduleId);
    setModeState(current);

    const handleColorModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: ColorMode; moduleId?: ModuleThemeId }>;
      if (!customEvent.detail?.moduleId || customEvent.detail.moduleId === moduleId) {
        if (customEvent.detail?.mode) {
          setModeState(customEvent.detail.mode);
        } else {
          setModeState(getModuleColorMode(moduleId));
        }
      }
    };

    window.addEventListener(COLOR_MODE_CHANGE_EVENT, handleColorModeChange);
    window.addEventListener('storage', handleColorModeChange);

    return () => {
      window.removeEventListener(COLOR_MODE_CHANGE_EVENT, handleColorModeChange);
      window.removeEventListener('storage', handleColorModeChange);
    };
  }, [moduleId]);

  const setMode = (mode: ColorMode) => {
    setModeState(mode);
    setModuleColorMode(mode, moduleId);
  };

  const toggle = () => {
    const next: ColorMode = colorMode === 'WHITE' ? 'ESTABLISHED' : 'WHITE';
    setMode(next);
    return next;
  };

  return {
    colorMode,
    setColorMode: setMode,
    toggleColorMode: toggle,
    isWhiteMode: colorMode === 'WHITE',
    isEstablishedMode: colorMode === 'ESTABLISHED',
    moduleId
  };
}

export function useColorMode(moduleId?: ModuleThemeId) {
  return useModuleColorMode(moduleId || 'gestion_administrativa');
}
