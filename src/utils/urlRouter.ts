import { ViewMode } from '../types';

export interface RouteState {
  view: ViewMode;
  adminTab?: string;
  strategicTab?: string;
  territorialSubTab?: 'registro' | 'mapa';
}

const LANDING_SECTION_HASHES = ['pilares', 'producto', 'demo', 'roi', 'precios', 'faq', 'inicio'];

/**
 * Returns the canonical URL hash for a given view & tab state.
 */
export function getHashForRoute(
  view: ViewMode,
  adminTab = 'inicio',
  strategicTab = 'diagnostico',
  territorialSubTab: 'registro' | 'mapa' = 'registro'
): string {
  switch (view) {
    case 'landing': {
      const currentRaw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').toLowerCase();
      if (LANDING_SECTION_HASHES.includes(currentRaw)) {
        return `#${currentRaw}`;
      }
      return '#/';
    }
    case 'module_select':
      return '#/modulos';
    case 'global_admin':
      return '#/global-admin';
    case 'saas_admin':
      return '#/saas-admin';
    case 'primera_interfaz':
      return '#/dashboard';
    case 'modulo_admin': {
      switch (adminTab) {
        case 'inicio': return '#/admin/inicio';
        case 'roles': return '#/admin/roles';
        case 'lideres_votantes': return '#/admin/lideres';
        case 'presupuesto_cne': return '#/admin/presupuesto';
        case 'gestion_campana': return '#/admin/campana';
        case 'gestion_testigos': return '#/admin/testigos';
        case 'jurados_electorales': return '#/admin/jurados';
        case 'encuestas_sondeos': return '#/admin/encuestas';
        default: return `#/admin/${adminTab}`;
      }
    }
    case 'gestion_estrategica': {
      switch (strategicTab) {
        case 'diagnostico': return '#/estrategia/diagnostico';
        case 'diagnostico_territorial': return '#/estrategia/territorial';
        case 'programa_gobierno': return '#/estrategia/programa';
        case 'perfil': return '#/estrategia/perfil';
        case 'hoja_vida': return '#/estrategia/hoja-vida';
        case 'dofa': return '#/estrategia/dofa';
        case 'discurso': return '#/estrategia/discurso';
        case 'comunicacion_redes': return '#/estrategia/comunicacion';
        case 'analisis_datos': return '#/estrategia/datos';
        case 'agenda_electoral': return '#/estrategia/agenda';
        default: return `#/estrategia/${strategicTab}`;
      }
    }
    case 'gestion_territorial':
      return territorialSubTab === 'mapa' ? '#/territorio/mapa' : '#/territorio/registro';
    case 'testigo_campo':
      return '#/testigo-campo';
    case 'jurado_campo':
      return '#/jurado-campo';
    case 'encuestas':
      return '#/encuestas';
    case 'presupuesto':
      return '#/presupuesto';
    case 'configuracion':
      return '#/configuracion';
    case 'pruebas_electorales':
      return '#/pruebas';
    default:
      return '#/dashboard';
  }
}

/**
 * Parses the current window hash into a structured view & sub-tab state.
 */
export function parseRouteFromHash(hash: string): RouteState | null {
  const clean = hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (!clean || clean === '/') return null;

  // 1. Landing Sections
  if (LANDING_SECTION_HASHES.includes(clean)) {
    return { view: 'landing' };
  }

  // 2. Modulos Selection & SaaS Admin & Private Global Admin
  if (clean === 'modulos' || clean === 'module_select' || clean === 'modulos-electorales') {
    return { view: 'module_select' };
  }
  if (clean === 'global-admin' || clean === 'globaladmin' || clean === 'admin-global') {
    return { view: 'global_admin' };
  }
  if (clean === 'saas-admin' || clean === 'saas_admin' || clean === 'superadmin') {
    return { view: 'saas_admin' };
  }

  // 3. Command Center / Dashboard
  if (clean === 'dashboard' || clean === 'inicio-dashboard' || clean === 'sala-de-control' || clean === 'sala_control' || clean === 'primera_interfaz') {
    return { view: 'primera_interfaz' };
  }

  // 4. Modulo Administrativo and its tabs
  if (clean.startsWith('admin') || clean.startsWith('modulo_admin') || clean.startsWith('modulo-admin')) {
    const parts = clean.split('/');
    const sub = parts[1] || 'inicio';
    
    let adminTab = 'inicio';
    if (sub === 'testigos' || sub === 'gestion_testigos' || sub === 'e16') adminTab = 'gestion_testigos';
    else if (sub === 'campana' || sub === 'gestion_campana' || sub === 'candidato') adminTab = 'gestion_campana';
    else if (sub === 'presupuesto' || sub === 'presupuesto_cne' || sub === 'cne') adminTab = 'presupuesto_cne';
    else if (sub === 'roles' || sub === 'gestion_roles') adminTab = 'roles';
    else if (sub === 'lideres' || sub === 'lideres_votantes' || sub === 'votantes') adminTab = 'lideres_votantes';
    else if (sub === 'jurados' || sub === 'jurados_electorales') adminTab = 'jurados_electorales';
    else if (sub === 'encuestas' || sub === 'encuestas_sondeos') adminTab = 'encuestas_sondeos';
    else if (sub === 'inicio') adminTab = 'inicio';
    else adminTab = sub;

    return { view: 'modulo_admin', adminTab };
  }

  // Direct tab alias shortcuts for administrative module
  if (clean === 'testigos' || clean === 'gestion-testigos' || clean === 'e-16' || clean === 'e16') {
    return { view: 'modulo_admin', adminTab: 'gestion_testigos' };
  }
  if (clean === 'campana' || clean === 'gestion-campana' || clean === 'configuracion-campana') {
    return { view: 'modulo_admin', adminTab: 'gestion_campana' };
  }

  // 5. Estrategia & tabs
  if (clean.startsWith('estrategia') || clean.startsWith('gestion_estrategica')) {
    const parts = clean.split('/');
    const sub = parts[1] || 'diagnostico';

    let strategicTab = 'diagnostico';
    if (sub === 'territorial' || sub === 'diagnostico_territorial') strategicTab = 'diagnostico_territorial';
    else if (sub === 'programa' || sub === 'programa_gobierno') strategicTab = 'programa_gobierno';
    else if (sub === 'perfil') strategicTab = 'perfil';
    else if (sub === 'hoja-vida' || sub === 'hoja_vida' || sub === 'cv') strategicTab = 'hoja_vida';
    else if (sub === 'dofa' || sub === 'swot') strategicTab = 'dofa';
    else if (sub === 'discurso' || sub === 'narrativa') strategicTab = 'discurso';
    else if (sub === 'comunicacion' || sub === 'comunicacion_redes' || sub === 'redes') strategicTab = 'comunicacion_redes';
    else if (sub === 'datos' || sub === 'analisis_datos') strategicTab = 'analisis_datos';
    else if (sub === 'agenda' || sub === 'agenda_electoral') strategicTab = 'agenda_electoral';
    else strategicTab = sub;

    return { view: 'gestion_estrategica', strategicTab };
  }

  // 6. Territorio & tabs
  if (clean.startsWith('territorio') || clean.startsWith('gestion_territorial')) {
    const parts = clean.split('/');
    const sub = parts[1];
    const territorialSubTab = (sub === 'mapa' || sub === 'cobertura') ? 'mapa' : 'registro';
    return { view: 'gestion_territorial', territorialSubTab };
  }

  // 7. Specific Views
  if (clean === 'testigo-campo' || clean === 'testigo_campo') {
    return { view: 'testigo_campo' };
  }
  if (clean === 'jurado-campo' || clean === 'jurado_campo') {
    return { view: 'jurado_campo' };
  }
  if (clean === 'encuestas' || clean === 'sondeos') {
    return { view: 'encuestas' };
  }
  if (clean === 'presupuesto' || clean === 'contabilidad' || clean === 'presupuesto_contabilidad') {
    return { view: 'presupuesto' };
  }
  if (clean === 'configuracion' || clean === 'settings') {
    return { view: 'configuracion' };
  }
  if (clean === 'pruebas' || clean === 'simulacros' || clean === 'pruebas_electorales') {
    return { view: 'pruebas_electorales' };
  }

  return null;
}
