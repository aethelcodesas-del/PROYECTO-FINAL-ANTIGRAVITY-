import React from 'react';
import { ModuleThemeId } from '../../utils/themeColorMode';

interface ColorModeToggleProps {
  variant?: 'switch' | 'segmented' | 'cards';
  showLabel?: boolean;
  className?: string;
  moduleId?: ModuleThemeId;
}

/**
 * ColorModeToggle - La plataforma opera exclusivamente en Tema Oscuro Premium (Cyber Executive).
 * No muestra controles de conmutación a tema blanco.
 */
export const ColorModeToggle: React.FC<ColorModeToggleProps> = () => {
  return null;
};
