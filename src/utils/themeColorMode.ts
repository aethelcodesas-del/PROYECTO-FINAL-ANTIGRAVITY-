/**
 * SISTEMA DE ALTERNANCIA DE COLOR: COLOR ESTABLECIDO VS EFECTO BLANCO
 * Archivo: src/utils/themeColorMode.ts
 * 
 * Permite alternar visualmente entre:
 * 1. COLOR ESTABLECIDO (ESTABLISHED): Estilo cibernético nativo con acentos cian/azul.
 * 2. EFECTO BLANCO (WHITE): Efecto luminoso y acentos blancos puros sobre fondo oscuro de alto contraste.
 * 
 * Garantías:
 * - Persistencia automática en localStorage ('app_color_mode').
 * - Sincronización en tiempo real entre componentes vía evento 'app-color-mode-changed'.
 * - Preservación 100% inalterada de colores funcionales (éxito, error, advertencia).
 * - Cero modificación de lógica de negocio, campañas, usuarios, Registraduría o datos.
 */

import { useState, useEffect } from 'react';

export type ColorMode = 'ESTABLISHED' | 'WHITE';

export const COLOR_MODES = {
  ESTABLISHED: 'ESTABLISHED' as const,
  WHITE: 'WHITE' as const
};

export const COLOR_MODE_STORAGE_KEY = 'app_color_mode';
export const THEME_STORAGE_KEY = COLOR_MODE_STORAGE_KEY;
export const COLOR_MODE_CHANGE_EVENT = 'app-color-mode-changed';

/**
 * Obtiene el modo de color actualmente guardado o el valor por defecto ('ESTABLISHED')
 */
export function getColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'ESTABLISHED';
  try {
    const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (saved === 'WHITE' || saved === 'white') return 'WHITE';
    return 'ESTABLISHED';
  } catch {
    return 'ESTABLISHED';
  }
}

/**
 * Aplica las clases y atributos correspondientes al elemento documentElement y body
 */
export function applyColorModeToDocument(mode: ColorMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  if (mode === 'WHITE') {
    root.setAttribute('data-color-mode', 'white');
    root.classList.add('color-mode-white');
    root.classList.remove('color-mode-established');
    if (body) {
      body.setAttribute('data-color-mode', 'white');
      body.classList.add('color-mode-white');
      body.classList.remove('color-mode-established');
    }
  } else {
    root.setAttribute('data-color-mode', 'established');
    root.classList.add('color-mode-established');
    root.classList.remove('color-mode-white');
    if (body) {
      body.setAttribute('data-color-mode', 'established');
      body.classList.add('color-mode-established');
      body.classList.remove('color-mode-white');
    }
  }
}

/**
 * Guarda y aplica el nuevo modo de color, notificando a todos los escuchadores
 */
export function setColorMode(mode: ColorMode): ColorMode {
  if (typeof window === 'undefined') return mode;
  try {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Error saving color mode preference:', e);
  }

  applyColorModeToDocument(mode);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent(COLOR_MODE_CHANGE_EVENT, { detail: { mode } })
    );
  }

  return mode;
}

/**
 * Alterna entre 'ESTABLISHED' y 'WHITE'
 */
export function toggleColorMode(): ColorMode {
  const current = getColorMode();
  const next: ColorMode = current === 'WHITE' ? 'ESTABLISHED' : 'WHITE';
  setColorMode(next);
  return next;
}

/**
 * Inicializa el modo de color al cargar la página
 */
export function initColorMode(): ColorMode {
  const mode = getColorMode();
  applyColorModeToDocument(mode);
  return mode;
}

/**
 * Hook de React para usar y reaccionar a cambios del modo de color
 */
export function useColorMode() {
  const [colorMode, setModeState] = useState<ColorMode>(() => getColorMode());

  useEffect(() => {
    // Sincronizar en montaje
    const current = getColorMode();
    setModeState(current);
    applyColorModeToDocument(current);

    const handleColorModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: ColorMode }>;
      if (customEvent.detail?.mode) {
        setModeState(customEvent.detail.mode);
      } else {
        setModeState(getColorMode());
      }
    };

    window.addEventListener(COLOR_MODE_CHANGE_EVENT, handleColorModeChange);
    window.addEventListener('storage', handleColorModeChange);

    return () => {
      window.removeEventListener(COLOR_MODE_CHANGE_EVENT, handleColorModeChange);
      window.removeEventListener('storage', handleColorModeChange);
    };
  }, []);

  const setMode = (mode: ColorMode) => {
    setModeState(mode);
    setColorMode(mode);
  };

  const toggle = () => {
    const next = toggleColorMode();
    setModeState(next);
  };

  return {
    colorMode,
    setColorMode: setMode,
    toggleColorMode: toggle,
    isWhiteMode: colorMode === 'WHITE',
    isEstablishedMode: colorMode === 'ESTABLISHED'
  };
}
