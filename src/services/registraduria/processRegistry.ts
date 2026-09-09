/**
 * REGISTRO OFICIAL DE PROCESOS Y FUENTES ELECTORALES (FASE 6.1)
 * 
 * Centraliza la configuración de fuentes para cada proceso electoral:
 * - COL-2026-CONGRESO
 * - COL-2026-PRES-1V
 * - COL-2026-PRES-2V
 * - COL-2027-TERRITORIAL
 * 
 * Regla Estricta:
 * Si una fuente oficial no está verificada, no está habilitada o es un PDF no estructurado,
 * se clasifica como SOURCE_PENDING_CONFIGURATION y el scheduler la omite de forma segura
 * sin descargar, sin inventar datos y sin ejecutar la RPC de base de datos.
 */

import { ElectoralProcessConfig } from './types';

export type OfficialSourceType = 'DIVIPOLE_CSV' | 'CENSO_CSV' | 'DIVIPOLE_JSON' | 'PDF_UNSUPPORTED' | 'PENDING';
export type SourceConfigurationStatus = 'CONFIGURED' | 'SOURCE_PENDING_CONFIGURATION';

export interface OfficialProcessSourceDefinition {
  processConfig: ElectoralProcessConfig;
  sourceUrl: string | null;
  sourceType: OfficialSourceType;
  enabled: boolean;
  status: SourceConfigurationStatus;
  notes: string;
}

/**
 * Catálogo maestro de procesos electorales y estado de sus fuentes oficiales
 */
export const OFFICIAL_PROCESS_SOURCES: Record<string, OfficialProcessSourceDefinition> = {
  'COL-2026-CONGRESO': {
    processConfig: {
      codigoProceso: 'COL-2026-CONGRESO',
      nombre: 'Elecciones de Congreso de la República 2026',
      tipoProceso: 'NACIONAL',
      anio: 2026,
      fechaEleccion: '2026-03-08',
      corporacionesHabilitadas: ['SENADO', 'CAMARA']
    },
    // Si la Registraduría publica únicamente PDF, se marca como no soportado/pendiente
    sourceUrl: null,
    sourceType: 'PENDING',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Pendiente de enlace oficial estructurado (CSV/JSON) publicado por la Registraduría Nacional para Congreso 2026.'
  },
  'COL-2026-PRES-1V': {
    processConfig: {
      codigoProceso: 'COL-2026-PRES-1V',
      nombre: 'Elecciones Presidenciales Primera Vuelta 2026',
      tipoProceso: 'PRESIDENCIAL',
      anio: 2026,
      fechaEleccion: '2026-05-31',
      corporacionesHabilitadas: ['PRESIDENCIA']
    },
    sourceUrl: null,
    sourceType: 'PENDING',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Pendiente de publicación de DIVIPOLE oficial para Presidencia 2026 Primera Vuelta.'
  },
  'COL-2026-PRES-2V': {
    processConfig: {
      codigoProceso: 'COL-2026-PRES-2V',
      nombre: 'Elecciones Presidenciales Segunda Vuelta 2026',
      tipoProceso: 'PRESIDENCIAL',
      anio: 2026,
      fechaEleccion: '2026-06-21',
      corporacionesHabilitadas: ['PRESIDENCIA']
    },
    sourceUrl: null,
    sourceType: 'PENDING',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Pendiente de confirmación según calendario electoral para Segunda Vuelta Presidencial 2026.'
  },
  'COL-2027-TERRITORIAL': {
    processConfig: {
      codigoProceso: 'COL-2027-TERRITORIAL',
      nombre: 'Elecciones de Autoridades Territoriales 2027',
      tipoProceso: 'TERRITORIAL',
      anio: 2027,
      fechaEleccion: '2027-10-31',
      corporacionesHabilitadas: ['GOBERNACION', 'ALCALDIA', 'ASAMBLEA', 'CONCEJO', 'JAL']
    },
    sourceUrl: null,
    sourceType: 'PENDING',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Pendiente de convocatoria y calendario oficial para Elecciones Territoriales 2027.'
  }
};

/**
 * Obtiene la definición de fuente de un proceso electoral
 */
export function getOfficialProcessSource(processId: string): OfficialProcessSourceDefinition {
  const found = OFFICIAL_PROCESS_SOURCES[processId];
  if (found) {
    return found;
  }
  return {
    processConfig: {
      codigoProceso: processId,
      nombre: `Proceso ${processId}`,
      tipoProceso: 'NACIONAL',
      anio: new Date().getFullYear(),
      fechaEleccion: '2026-01-01',
      corporacionesHabilitadas: []
    },
    sourceUrl: null,
    sourceType: 'PENDING',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: `Proceso ${processId} no registrado en el catálogo oficial.`
  };
}

/**
 * Retorna todos los procesos electorales registrados
 */
export function getAllOfficialProcessSources(): OfficialProcessSourceDefinition[] {
  return Object.values(OFFICIAL_PROCESS_SOURCES);
}

/**
 * Evalúa si una fuente está lista para ser consumida automáticamente
 */
export function isSourceReadyForSync(sourceDef: OfficialProcessSourceDefinition): boolean {
  if (!sourceDef.enabled) return false;
  if (sourceDef.status !== 'CONFIGURED') return false;
  if (!sourceDef.sourceUrl || sourceDef.sourceUrl.trim() === '') return false;
  
  // Rechazar URLs de ejemplo o placeholders genéricos
  const url = sourceDef.sourceUrl.toLowerCase();
  if (url.includes('tu-dominio.com') || url.includes('fuente-oficial.gov.co') || url.includes('example.com')) {
    return false;
  }

  // Si la fuente es PDF no estructurado, no es procesable directamente por el parser CSV/JSON
  if (sourceDef.sourceType === 'PDF_UNSUPPORTED' || url.endsWith('.pdf')) {
    return false;
  }

  return true;
}
