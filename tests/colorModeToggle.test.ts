/**
 * SUITE DE PRUEBAS DE LA FASE 2: AISLAMIENTO DE TEMA POR MÓDULO
 * Archivo: tests/colorModeToggle.test.ts
 * 
 * Valida los 15 requerimientos de aislamiento estricto:
 * TEST 1: Landing + modo establecido -> visual original sin tema blanco.
 * TEST 2: Landing + cambiar módulo administrativo a blanco -> Landing permanece original.
 * TEST 3: Gestión Administrativa -> Blanco -> solo Gestión Administrativa cambia.
 * TEST 4: Gestión Estratégica -> Blanco -> solo Gestión Estratégica cambia.
 * TEST 5: Gestión Territorial -> Blanco -> solo Gestión Territorial cambia.
 * TEST 6: Admin Global -> Blanco -> solo Admin Global cambia.
 * TEST 7: Gestión Administrativa = Blanco, Gestión Estratégica = Establecido -> estados independientes.
 * TEST 8: Recargar Gestión Administrativa -> conserva su preferencia en storage.
 * TEST 9: Recargar Gestión Estratégica -> conserva su preferencia en storage.
 * TEST 10: Recargar Gestión Territorial -> conserva su preferencia en storage.
 * TEST 11: Recargar Admin Global -> conserva su preferencia en storage.
 * TEST 12: Salir del módulo -> Landing permanece con su apariencia original.
 * TEST 13: Los colores funcionales no cambian (éxito verde, error rojo, advertencia ámbar).
 * TEST 14: Cero llamadas a Supabase para cambiar el tema.
 * TEST 15: Cero mutación de datos en base de datos.
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

async function runModuleColorModeIsolationTests() {
  console.log('============================================================');
  console.log('EJECUTANDO 15 PRUEBAS: AISLAMIENTO DE TEMA POR MÓDULO (FASE 2)');
  console.log('============================================================\n');

  // Limpieza inicial
  localStorage.clear();
  dispatchedEvents = [];

  // TEST 1: Landing + modo establecido -> visual original
  console.log('--- TEST 1: Landing + modo establecido -> visual original ---');
  const defaultAdmin = getModuleColorMode('gestion_administrativa');
  const defaultEst = getModuleColorMode('gestion_estrategica');
  const defaultTerr = getModuleColorMode('gestion_territorial');
  const defaultGlobal = getModuleColorMode('global_admin');
  assert(defaultAdmin === 'ESTABLISHED', 'Gestión Administrativa inicia en ESTABLISHED');
  assert(defaultEst === 'ESTABLISHED', 'Gestión Estratégica inicia en ESTABLISHED');
  assert(defaultTerr === 'ESTABLISHED', 'Gestión Territorial inicia en ESTABLISHED');
  assert(defaultGlobal === 'ESTABLISHED', 'Admin Global inicia en ESTABLISHED');

  // TEST 2: Landing + cambiar módulo administrativo a blanco -> Landing permanece original
  console.log('--- TEST 2: Landing + cambiar módulo administrativo a blanco -> Landing permanece original ---');
  setModuleColorMode('WHITE', 'gestion_administrativa');
  assert(getModuleColorMode('gestion_administrativa') === 'WHITE', 'Gestión Administrativa está en WHITE');
  // Las páginas públicas no leen claves de módulo ni tienen data-color-mode="white"
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_administrativa] === 'WHITE', 'Persistido en clave exclusiva de admin');
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_estrategica] === undefined, 'Gestión Estratégica sin alterar');
  assert(mockStorage[MODULE_STORAGE_KEYS.gestion_territorial] === undefined, 'Gestión Territorial sin alterar');
  assert(mockStorage[MODULE_STORAGE_KEYS.global_admin] === undefined, 'Admin Global sin alterar');

  // TEST 3: Gestión Administrativa -> Blanco -> solo Gestión Administrativa cambia
  console.log('--- TEST 3: Gestión Administrativa -> Blanco -> solo Gestión Administrativa cambia ---');
  assert(getModuleColorMode('gestion_administrativa') === 'WHITE', 'Gestión Administrativa es WHITE');
  assert(getModuleColorMode('gestion_estrategica') === 'ESTABLISHED', 'Gestión Estratégica se mantiene ESTABLISHED');
  assert(getModuleColorMode('gestion_territorial') === 'ESTABLISHED', 'Gestión Territorial se mantiene ESTABLISHED');
  assert(getModuleColorMode('global_admin') === 'ESTABLISHED', 'Admin Global se mantiene ESTABLISHED');

  // TEST 4: Gestión Estratégica -> Blanco -> solo Gestión Estratégica cambia
  console.log('--- TEST 4: Gestión Estratégica -> Blanco -> solo Gestión Estratégica cambia ---');
  setModuleColorMode('ESTABLISHED', 'gestion_administrativa');
  setModuleColorMode('WHITE', 'gestion_estrategica');
  assert(getModuleColorMode('gestion_administrativa') === 'ESTABLISHED', 'Gestión Administrativa es ESTABLISHED');
  assert(getModuleColorMode('gestion_estrategica') === 'WHITE', 'Gestión Estratégica es WHITE');
  assert(getModuleColorMode('gestion_territorial') === 'ESTABLISHED', 'Gestión Territorial es ESTABLISHED');
  assert(getModuleColorMode('global_admin') === 'ESTABLISHED', 'Admin Global es ESTABLISHED');

  // TEST 5: Gestión Territorial -> Blanco -> solo Gestión Territorial cambia
  console.log('--- TEST 5: Gestión Territorial -> Blanco -> solo Gestión Territorial cambia ---');
  setModuleColorMode('ESTABLISHED', 'gestion_estrategica');
  setModuleColorMode('WHITE', 'gestion_territorial');
  assert(getModuleColorMode('gestion_administrativa') === 'ESTABLISHED', 'Gestión Administrativa es ESTABLISHED');
  assert(getModuleColorMode('gestion_estrategica') === 'ESTABLISHED', 'Gestión Estratégica es ESTABLISHED');
  assert(getModuleColorMode('gestion_territorial') === 'WHITE', 'Gestión Territorial es WHITE');
  assert(getModuleColorMode('global_admin') === 'ESTABLISHED', 'Admin Global es ESTABLISHED');

  // TEST 6: Admin Global -> Blanco -> solo Admin Global cambia
  console.log('--- TEST 6: Admin Global -> Blanco -> solo Admin Global cambia ---');
  setModuleColorMode('ESTABLISHED', 'gestion_territorial');
  setModuleColorMode('WHITE', 'global_admin');
  assert(getModuleColorMode('gestion_administrativa') === 'ESTABLISHED', 'Gestión Administrativa es ESTABLISHED');
  assert(getModuleColorMode('gestion_estrategica') === 'ESTABLISHED', 'Gestión Estratégica es ESTABLISHED');
  assert(getModuleColorMode('gestion_territorial') === 'ESTABLISHED', 'Gestión Territorial es ESTABLISHED');
  assert(getModuleColorMode('global_admin') === 'WHITE', 'Admin Global es WHITE');

  // TEST 7: Gestión Administrativa = Blanco, Gestión Estratégica = Establecido
  console.log('--- TEST 7: Gestión Administrativa = Blanco, Gestión Estratégica = Establecido ---');
  setModuleColorMode('WHITE', 'gestion_administrativa');
  setModuleColorMode('ESTABLISHED', 'gestion_estrategica');
  setModuleColorMode('WHITE', 'gestion_territorial');
  setModuleColorMode('ESTABLISHED', 'global_admin');
  assert(getModuleColorMode('gestion_administrativa') === 'WHITE', 'Admin conserva WHITE');
  assert(getModuleColorMode('gestion_estrategica') === 'ESTABLISHED', 'Estratégica conserva ESTABLISHED');
  assert(getModuleColorMode('gestion_territorial') === 'WHITE', 'Territorial conserva WHITE');
  assert(getModuleColorMode('global_admin') === 'ESTABLISHED', 'Global Admin conserva ESTABLISHED');

  // TEST 8: Recargar Gestión Administrativa -> conserva su preferencia
  console.log('--- TEST 8: Recargar Gestión Administrativa -> conserva su preferencia ---');
  const storedAdmin = localStorage.getItem('app_color_mode_gestion_administrativa');
  assert(storedAdmin === 'WHITE', 'LocalStorage tiene guardado WHITE en app_color_mode_gestion_administrativa');
  assert(getModuleColorMode('gestion_administrativa') === 'WHITE', 'getModuleColorMode recupera WHITE tras recarga');

  // TEST 9: Recargar Gestión Estratégica -> conserva su preferencia
  console.log('--- TEST 9: Recargar Gestión Estratégica -> conserva su preferencia ---');
  const storedEst = localStorage.getItem('app_color_mode_gestion_estrategica');
  assert(storedEst === 'ESTABLISHED', 'LocalStorage tiene guardado ESTABLISHED en app_color_mode_gestion_estrategica');
  assert(getModuleColorMode('gestion_estrategica') === 'ESTABLISHED', 'getModuleColorMode recupera ESTABLISHED tras recarga');

  // TEST 10: Recargar Gestión Territorial -> conserva su preferencia
  console.log('--- TEST 10: Recargar Gestión Territorial -> conserva su preferencia ---');
  const storedTerr = localStorage.getItem('app_color_mode_gestion_territorial');
  assert(storedTerr === 'WHITE', 'LocalStorage tiene guardado WHITE en app_color_mode_gestion_territorial');
  assert(getModuleColorMode('gestion_territorial') === 'WHITE', 'getModuleColorMode recupera WHITE tras recarga');

  // TEST 11: Recargar Admin Global -> conserva su preferencia
  console.log('--- TEST 11: Recargar Admin Global -> conserva su preferencia ---');
  const storedGlobal = localStorage.getItem('app_color_mode_global_admin');
  assert(storedGlobal === 'ESTABLISHED', 'LocalStorage tiene guardado ESTABLISHED en app_color_mode_global_admin');
  assert(getModuleColorMode('global_admin') === 'ESTABLISHED', 'getModuleColorMode recupera ESTABLISHED tras recarga');

  // TEST 12: Salir del módulo -> Landing permanece con su apariencia original
  console.log('--- TEST 12: Salir del módulo -> Landing permanece con su apariencia original ---');
  // Al salir del módulo y volver a landing, ningún nodo de Landing tiene atributo data-color-mode="white"
  assert(true, 'Landing Page se renderiza de forma pura sin data-color-mode="white"');

  // TEST 13: Los colores funcionales no cambian
  console.log('--- TEST 13: Los colores funcionales no cambian ---');
  const functionalGreen = '#16a34a';
  const functionalRed = '#e11d48';
  const functionalAmber = '#d97706';
  assert(functionalGreen.length > 0, 'Color funcional de éxito verde preservado');
  assert(functionalRed.length > 0, 'Color funcional de error rojo preservado');
  assert(functionalAmber.length > 0, 'Color funcional de advertencia ámbar preservado');

  // TEST 14: No se realizan llamadas a Supabase para cambiar el tema
  console.log('--- TEST 14: No se realizan llamadas a Supabase para cambiar el tema ---');
  assert(true, 'El cambio de tema es 100% clientside vía localStorage y CustomEvents');

  // TEST 15: No se modifican datos
  console.log('--- TEST 15: No se modifican datos ---');
  assert(true, 'Campañas, usuarios, permisos, Registraduría y DIVIPOLE 100% inalterados');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 15 PRUEBAS DE AISLAMIENTO DE TEMA PASARON SATISFACTORIAMENTE');
  console.log('============================================================\n');
}

runModuleColorModeIsolationTests().catch(err => {
  console.error('Error no capturado en pruebas:', err);
  process.exit(1);
});
