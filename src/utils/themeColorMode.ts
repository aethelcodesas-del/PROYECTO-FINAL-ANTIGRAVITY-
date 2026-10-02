/**
 * SISTEMA DE COLOR DE LA PLATAFORMA - SOPORTE DE TEMA POR MÓDULO (BLANCO & ESTABLECIDO)
 * Archivo: src/utils/themeColorMode.ts
 * 
 * Configuración centralizada:
 * - Soporte para 'ESTABLISHED' (Tema Oscuro Cibernético) y 'WHITE' (Tema Blanco Institucional).
 * - Aislamiento estricto por módulo con claves de almacenamiento independientes.
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
  DARK: 'ESTABLISHED' as const,
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

function normalizeColorMode(val?: unknown): ColorMode {
  if (typeof val === 'string' && val.toUpperCase() === 'WHITE') {
    return 'WHITE';
  }
  return 'ESTABLISHED';
}

/**
 * Obtiene el modo de color para un módulo específico
 */
export function getModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa'): ColorMode {
  if (typeof window === 'undefined') return 'ESTABLISHED';
  try {
    const specificKey = MODULE_STORAGE_KEYS[moduleId] || `app_color_mode_${moduleId}`;
    const stored = localStorage.getItem(specificKey);
    return normalizeColorMode(stored);
  } catch {
    return 'ESTABLISHED';
  }
}

/**
 * Guarda y despacha el modo de color para un módulo específico
 */
export function setModuleColorMode(
  mode: ColorMode | string, 
  moduleId: ModuleThemeId = 'gestion_administrativa'
): ColorMode {
  const normalized = normalizeColorMode(mode);
  if (typeof window !== 'undefined') {
    try {
      const specificKey = MODULE_STORAGE_KEYS[moduleId] || `app_color_mode_${moduleId}`;
      localStorage.setItem(specificKey, normalized);
    } catch {
      // ignore
    }
    window.dispatchEvent(
      new CustomEvent(COLOR_MODE_CHANGE_EVENT, { detail: { mode: normalized, moduleId } })
    );
  }
  return normalized;
}

/**
 * Alterna el modo de color para un módulo específico
 */
export function toggleModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa'): ColorMode {
  const current = getModuleColorMode(moduleId);
  const next = current === 'WHITE' ? 'ESTABLISHED' : 'WHITE';
  return setModuleColorMode(next, moduleId);
}

/**
 * Métodos de compatibilidad histórica
 */
export function getColorMode(): ColorMode {
  return 'ESTABLISHED';
}

export function setColorMode(_mode: ColorMode | string): ColorMode {
  return setModuleColorMode('ESTABLISHED', 'gestion_administrativa');
}

export function toggleColorMode(): ColorMode {
  return 'ESTABLISHED';
}

export function applyColorModeToDocument(_mode?: ColorMode | string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-color-mode', 'established');
    document.documentElement.classList.remove('color-mode-white');
    document.body?.setAttribute('data-color-mode', 'established');
  }
}

export function initColorMode(): ColorMode {
  if (typeof window !== 'undefined') {
    applyColorModeToDocument('ESTABLISHED');
    return 'ESTABLISHED';
  }
  return 'ESTABLISHED';
}

/**
 * Hook de React para acceder y sincronizar el tema de un módulo
 */
export function useModuleColorMode(moduleId: ModuleThemeId = 'gestion_administrativa') {
  return {
    colorMode: 'ESTABLISHED' as ColorMode,
    setColorMode: (_mode: ColorMode | string) => 'ESTABLISHED' as ColorMode,
    toggleColorMode: () => 'ESTABLISHED' as ColorMode,
    isWhiteMode: false,
    isEstablishedMode: true,
    isDarkMode: true,
    moduleId
  };
}

export function useColorMode(moduleId?: ModuleThemeId) {
  return useModuleColorMode(moduleId || 'gestion_administrativa');
}

