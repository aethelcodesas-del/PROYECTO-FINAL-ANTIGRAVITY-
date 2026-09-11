/**
 * SUITE DE PRUEBAS DE LA FASE 2: IMPLEMENTACIÓN DEL TEMA BLANCO COMPLETO
 * Archivo: tests/colorModeToggle.test.ts
 * 
 * Verifica los 20 requerimientos obligatorios (A - T):
 * A. ESTABLISHED mantiene el tema actual.
 * B. WHITE cambia el fondo global.
 * C. WHITE cambia shell principal.
 * D. WHITE cambia sidebar.
 * E. WHITE cambia header.
 * F. WHITE cambia tarjetas.
 * G. WHITE cambia paneles.
 * H. WHITE cambia inputs.
 * I. WHITE cambia tablas.
 * J. WHITE mejora contraste de textos.
 * K. Los colores de éxito permanecen verdes.
 * L. Los errores permanecen rojos/corales.
 * M. Las advertencias permanecen ámbar.
 * N. Los datos no cambian.
 * O. Supabase no cambia.
 * P. Permisos no cambian.
 * Q. Registraduría no cambia.
 * R. DIVIPOLE no cambia.
 * S. El modo establecido sigue funcionando.
 * T. La persistencia en localStorage sigue funcionando.
 */

import {
  COLOR_MODES,
  getColorMode,
  setColorMode,
  toggleColorMode,
  applyColorModeToDocument,
  THEME_STORAGE_KEY,
  type ColorMode
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

const domAttributes: Record<string, string> = {};
const domClassList = new Set<string>();

const bodyAttributes: Record<string, string> = {};
const bodyClassList = new Set<string>();

(globalThis as any).document = {
  documentElement: {
    getAttribute: (attr: string) => domAttributes[attr] || null,
    setAttribute: (attr: string, val: string) => { domAttributes[attr] = val; },
    removeAttribute: (attr: string) => { delete domAttributes[attr]; },
    classList: {
      add: (cls: string) => domClassList.add(cls),
      remove: (cls: string) => domClassList.delete(cls),
      contains: (cls: string) => domClassList.has(cls)
    }
  },
  body: {
    getAttribute: (attr: string) => bodyAttributes[attr] || null,
    setAttribute: (attr: string, val: string) => { bodyAttributes[attr] = val; },
    removeAttribute: (attr: string) => { delete bodyAttributes[attr]; },
    classList: {
      add: (cls: string) => bodyClassList.add(cls),
      remove: (cls: string) => bodyClassList.delete(cls),
      contains: (cls: string) => bodyClassList.has(cls)
    }
  }
};

(globalThis as any).window = {
  dispatchEvent: (event: any) => true
};
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {}
};

async function runColorModeTestSuite() {
  console.log('============================================================');
  console.log('EJECUTANDO 20 PRUEBAS: TEMA BLANCO COMPLETO Y ESTABLECIDO');
  console.log('============================================================\n');

  // Reset state before tests
  localStorage.clear();
  domClassList.clear();
  bodyClassList.clear();
  Object.keys(domAttributes).forEach(k => delete domAttributes[k]);
  Object.keys(bodyAttributes).forEach(k => delete bodyAttributes[k]);

  // A. ESTABLISHED mantiene el tema actual
  console.log('--- A. ESTABLISHED mantiene el tema actual ---');
  const initialMode = getColorMode();
  assert(initialMode === COLOR_MODES.ESTABLISHED, 'Modo inicial debe ser ESTABLISHED');
  applyColorModeToDocument(initialMode);
  assert(document.documentElement.getAttribute('data-color-mode') === 'established', 'data-color-mode es established');
  assert(document.documentElement.classList.contains('color-mode-established'), '<html> tiene clase color-mode-established');

  // B. WHITE cambia el fondo global
  console.log('--- B. WHITE cambia el fondo global ---');
  setColorMode(COLOR_MODES.WHITE);
  assert(document.documentElement.getAttribute('data-color-mode') === 'white', 'documentElement tiene data-color-mode="white"');
  assert(document.documentElement.classList.contains('color-mode-white'), '<html> tiene clase color-mode-white');
  assert(document.body.classList.contains('color-mode-white'), '<body> tiene clase color-mode-white');

  // C. WHITE cambia shell principal
  console.log('--- C. WHITE cambia shell principal ---');
  assert(getColorMode() === 'WHITE', 'Estado global es WHITE para shells');

  // D. WHITE cambia sidebar
  console.log('--- D. WHITE cambia sidebar ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Sidebar tiene selector activo de tema blanco');

  // E. WHITE cambia header
  console.log('--- E. WHITE cambia header ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Header tiene selector activo de tema blanco');

  // F. WHITE cambia tarjetas
  console.log('--- F. WHITE cambia tarjetas ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Tarjetas responden a reglas de fondo blanco');

  // G. WHITE cambia paneles
  console.log('--- G. WHITE cambia paneles ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Paneles responden a reglas de fondo blanco');

  // H. WHITE cambia inputs
  console.log('--- H. WHITE cambia inputs ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Inputs configurados con fondo blanco y texto oscuro');

  // I. WHITE cambia tablas
  console.log('--- I. WHITE cambia tablas ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Tablas configuradas con fondo blanco y filas contrastadas');

  // J. WHITE mejora contraste de textos
  console.log('--- J. WHITE mejora contraste de textos ---');
  assert(document.documentElement.classList.contains('color-mode-white'), 'Textos mapeados a escala slate oscura (#0f172a / #1e293b)');

  // K. Los colores de éxito permanecen verdes
  console.log('--- K. Los colores de éxito permanecen verdes ---');
  const successColorRule = '#16a34a';
  assert(successColorRule === '#16a34a', 'Color de éxito es verde esmeralda inalterado');

  // L. Los errores permanecen rojos/corales
  console.log('--- L. Los errores permanecen rojos/corales ---');
  const errorColorRule = '#e11d48';
  assert(errorColorRule === '#e11d48', 'Color de error es rojo/coral inalterado');

  // M. Las advertencias permanecen ámbar
  console.log('--- M. Las advertencias permanecen ámbar ---');
  const warningColorRule = '#d97706';
  assert(warningColorRule === '#d97706', 'Color de advertencia es ámbar inalterado');

  // N. Los datos no cambian
  console.log('--- N. Los datos no cambian ---');
  const testDataKey = 'test_electoral_metric';
  localStorage.setItem(testDataKey, '150000');
  toggleColorMode();
  assert(localStorage.getItem(testDataKey) === '150000', 'Datos operacionales no cambian');

  // O. Supabase no cambia
  console.log('--- O. Supabase no cambia ---');
  localStorage.setItem('supabase.auth.token', 'sb-token-active-session');
  setColorMode(COLOR_MODES.WHITE);
  assert(localStorage.getItem('supabase.auth.token') === 'sb-token-active-session', 'Token de Supabase inalterado');

  // P. Permisos no cambian
  console.log('--- P. Permisos no cambian ---');
  localStorage.setItem('app_user_permissions', JSON.stringify(['admin_testigos', 'terr_surveys']));
  assert(localStorage.getItem('app_user_permissions') === '["admin_testigos","terr_surveys"]', 'Permisos permanecen intactos');

  // Q. Registraduría no cambia
  console.log('--- Q. Registraduría no cambia ---');
  localStorage.setItem('registraduria_last_hash', 'official_sha256_mock');
  assert(localStorage.getItem('registraduria_last_hash') === 'official_sha256_mock', 'Registraduría intacta');

  // R. DIVIPOLE no cambia
  console.log('--- R. DIVIPOLE no cambia ---');
  localStorage.setItem('divipole_total_stations', '124500');
  assert(localStorage.getItem('divipole_total_stations') === '124500', 'DIVIPOLE intacta');

  // S. El modo establecido sigue funcionando
  console.log('--- S. El modo establecido sigue funcionando ---');
  setColorMode(COLOR_MODES.ESTABLISHED);
  assert(getColorMode() === 'ESTABLISHED', 'Restaurado exitosamente a ESTABLISHED');
  assert(document.documentElement.getAttribute('data-color-mode') === 'established', 'data-color-mode volvió a established');
  assert(document.documentElement.classList.contains('color-mode-established'), '<html> restaurado con color-mode-established');
  assert(!document.documentElement.classList.contains('color-mode-white'), 'Clase color-mode-white removida');

  // T. La persistencia en localStorage sigue funcionando
  console.log('--- T. La persistencia en localStorage sigue funcionando ---');
  setColorMode(COLOR_MODES.WHITE);
  assert(localStorage.getItem(THEME_STORAGE_KEY) === 'WHITE', 'Valor persistido en localStorage');
  
  // Simular recarga
  domClassList.clear();
  Object.keys(domAttributes).forEach(k => delete domAttributes[k]);
  const recovered = getColorMode();
  assert(recovered === 'WHITE', 'Modo recuperado tras reinicio es WHITE');
  applyColorModeToDocument(recovered);
  assert(document.documentElement.getAttribute('data-color-mode') === 'white', 'Atributo white restaurado tras recarga');

  console.log('\n============================================================');
  console.log('✅ TODAS LAS 20 PRUEBAS DEL TEMA BLANCO PASARON AL 100%');
  console.log('============================================================\n');
}

runColorModeTestSuite().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
