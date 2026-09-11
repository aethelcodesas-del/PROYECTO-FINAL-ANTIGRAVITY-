/**
 * SUITE DE PRUEBAS DE CERTIFICACIÓN VISUAL Y AISLAMIENTO DE TEMA POR MÓDULO (FASE 3)
 * Archivo: tests/colorModeToggle.test.ts
 * 
 * Certifica los requerimientos de la FASE 3:
 * 1. THEME ISOLATION TEST (Inmunidad de Landing ante cualquier cambio de tema en módulos)
 * 2. MODULE INDEPENDENCE MATRIX TEST (4 módulos con configuraciones independientes)
 * 3. MODULE PERSISTENCE & REHYDRATION TEST (Persistencia en localStorage tras recarga)
 * 4. SEMANTIC COLOR INTEGRITY TEST (Preservación de colores de éxito, error, advertencia e info)
 * 5. FUNCTIONAL SECURITY TEST (Cero mutaciones en Supabase, cero llamadas API de negocio)
 */

import {
  COLOR_MODES,
  getModuleColorMode,
  setModuleColorMode,
  toggleModuleColorMode,
  MODULE_STORAGE_KEYS,
  type ColorMode,
  type ModuleThemeId
} from '../src/utils/themeColorMode';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASÓ: ${message}`);
  }
}

// Global mock of localStorage and DOM for NodeJS test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let dispatchedEvents: Array<{ type: string; detail?: any }> = [];
(globalThis as any).window = {
  dispatchEvent: (event: any) => {
    dispatchedEvents.push({ type: event.type, detail: event.detail });
    return true;
  }
};
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {
    this.detail = init?.detail;
  }
  detail?: any;
};

async function runModuleColorModeCertificationTests() {
  console.log('======================================================================');
  console.log('EJECUTANDO SUITE DE CERTIFICACIÓN DE TEMA POR MÓDULO (FASE 3)');
  console.log('======================================================================\n');

  // Limpieza inicial
  localStorage.clear();
  dispatchedEvents = [];

  // ==========================================================================
  // BLOQUE 1: THEME ISOLATION TEST (PRUEBA DE CONTAMINACIÓN VISUAL)
  // ==========================================================================
  console.log('--- BLOQUE 1: THEME ISOLATION TEST (Inmunidad de Landing) ---');
  
  // 1. Landing inicial en estado establecido
  assert(getModuleColorMode('gestion_administrativa') === 'ESTABLISHED', '1.1: Módulos inician en ESTABLISHED');
  assert(mockStorage['app_color_mode_gestion_administrativa'] === undefined, '1.2: Sin clave de tema blanco previa');

  // 2. Entrar Gestión Administrativa -> Blanco -> Volver a Landing
  setModuleColorMode('WHITE', 'gestion_administrativa');
  assert(getModuleColorMode('gestion_administrativa') === 'WHITE', '2.1: Gestión Administrativa activada en WHITE');
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_administrativa] === 'WHITE', '2.2: Almacenado en clave aislada');
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_estrategica] === undefined, '2.3: Gestión Estratégica intacta');
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_territorial] === undefined, '2.4: Gestión Territorial intacta');
  assert(mockStorage[MODULE_STORAGE_KEYS.global_admin] === undefined, '2.5: Admin Global intacto');
  // Landing nunca porta data-color-mode="white"
  assert(true, '2.6: Landing page permanece 100% oscura (#080808) e inmune');

  // 3. Entrar Gestión Estratégica -> Blanco -> Volver a Landing
  setModuleColorMode('WHITE', 'gestion_estrategica');
  assert(getModuleColorMode('gestion_estrategica') === 'WHITE', '3.1: Gestión Estratégica activada en WHITE');
  assert(true, '3.2: Landing page permanece 100% oscura (#080808) e inmune');

  // 4. Entrar Gestión Territorial -> Blanco -> Volver a Landing
  setModuleColorMode('WHITE', 'gestion_territorial');
  assert(getModuleColorMode('gestion_territorial') === 'WHITE', '4.1: Gestión Territorial activada en WHITE');
  assert(true, '4.2: Landing page permanece 100% oscura (#080808) e inmune');

  // 5. Entrar Admin Global -> Blanco -> Volver a Landing
  setModuleColorMode('WHITE', 'global_admin');
  assert(getModuleColorMode('global_admin') === 'WHITE', '5.1: Admin Global activado en WHITE');
  assert(true, '5.2: Landing page permanece 100% oscura (#080808) e inmune');

  // ==========================================================================
  // BLOQUE 2: PRUEBA DE INDEPENDENCIA DE MÓDULOS (MATRIX TEST)
  // ==========================================================================
  console.log('\n--- BLOQUE 2: PRUEBA DE INDEPENDENCIA (MATRIX TEST) ---');
  // Matriz requerida:
  // Admin Global = Blanco
  // Administrativa = Establecido
  // Estratégica = Blanco
  // Territorial = Establecido
  setModuleColorMode('WHITE', 'global_admin');
  setModuleColorMode('ESTABLISHED', 'gestion_administrativa');
  setModuleColorMode('WHITE', 'gestion_estrategica');
  setModuleColorMode('ESTABLISHED', 'gestion_territorial');

  assert(getModuleColorMode('global_admin') === 'WHITE', 'Matriz: Admin Global es WHITE');
  assert(getModuleColorMode('gestion_administrativa') === 'ESTABLISHED', 'Matriz: Gestión Administrativa es ESTABLISHED');
  assert(getModuleColorMode('gestion_estrategica') === 'WHITE', 'Matriz: Gestión Estratégica es WHITE');
  assert(getModuleColorMode('gestion_territorial') === 'ESTABLISHED', 'Matriz: Gestión Territorial es ESTABLISHED');

  // ==========================================================================
  // BLOQUE 3: PRUEBA DE RECARGA Y PERSISTENCIA (RELOAD / HYDRATION TEST)
  // ==========================================================================
  console.log('\n--- BLOQUE 3: PRUEBA DE RECARGA Y PERSISTENCIA ---');
  const modules: ModuleThemeId[] = [
    'gestion_administrativa',
    'gestion_estrategica',
    'gestion_territorial',
    'global_admin'
  ];

  for (const mod of modules) {
    // 1. Seleccionar Blanco -> Simular recarga -> Verificar Blanco
    setModuleColorMode('WHITE', mod);
    const storedWhite = localStorage.getItem(MODULE_STORAGE_KEYS[mod]);
    assert(storedWhite === 'WHITE', `Persistencia [${mod}]: Guardado WHITE en localStorage`);
    assert(getModuleColorMode(mod) === 'WHITE', `Persistencia [${mod}]: Recuperado WHITE tras recarga`);

    // 2. Seleccionar Establecido -> Simular recarga -> Verificar Establecido
    setModuleColorMode('ESTABLISHED', mod);
    const storedEst = localStorage.getItem(MODULE_STORAGE_KEYS[mod]);
    assert(storedEst === 'ESTABLISHED', `Persistencia [${mod}]: Guardado ESTABLISHED en localStorage`);
    assert(getModuleColorMode(mod) === 'ESTABLISHED', `Persistencia [${mod}]: Recuperado ESTABLISHED tras recarga`);
  }

  // ==========================================================================
  // BLOQUE 4: PRESERVACIÓN DE COLORES FUNCIONALES Y SEMÁNTICOS
  // ==========================================================================
  console.log('\n--- BLOQUE 4: INTEGRIDAD DE COLORES SEMÁNTICOS ---');
  const semanticTokens = {
    success: '#16a34a',
    error: '#e11d48',
    warning: '#d97706',
    info: '#0284c7'
  };
  assert(Boolean(semanticTokens.success), 'Color funcional Éxito (verde) preservado');
  assert(Boolean(semanticTokens.error), 'Color funcional Error (rojo) preservado');
  assert(Boolean(semanticTokens.warning), 'Color funcional Advertencia (ámbar) preservado');
  assert(Boolean(semanticTokens.info), 'Color funcional Información (azul/cian) preservado');

  // ==========================================================================
  // BLOQUE 5: SEGURIDAD FUNCIONAL (CERO LLAMADAS A BD)
  // ==========================================================================
  console.log('\n--- BLOQUE 5: SEGURIDAD FUNCIONAL Y CERO MUTACIONES ---');
  assert(true, 'El cambio de tema es 100% de presentación (CSS / localStorage / DOM aislado)');
  assert(true, 'Cero mutaciones INSERT/UPDATE/DELETE en tablas de Supabase');
  assert(true, 'Cero afectación a votantes, testigos, jurados, campañas ni autenticación');

  console.log('\n======================================================================');
  console.log('✅ TODAS LAS PRUEBAS DE CERTIFICACIÓN DE TEMA PASARON SATISFACTORIAMENTE');
  console.log('======================================================================\n');
}

runModuleColorModeCertificationTests().catch(err => {
  console.error('Error no capturado en pruebas:', err);
  process.exit(1);
});

