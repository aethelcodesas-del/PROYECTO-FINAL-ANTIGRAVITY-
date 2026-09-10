/**
 * REGISTRO OFICIAL DE PROCESOS Y FUENTES ELECTORALES (FASE 6.1 / AUDITORÍA DE FUENTES)
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

export type OfficialSourceType = 
  | 'DIVIPOLE_CSV' 
  | 'CENSO_CSV' 
  | 'DIVIPOLE_JSON' 
  | 'PDF_UNSUPPORTED' 
  | 'HTML_PORTAL'
  | 'OFFICIAL_CENSUS_PUBLICATION'
  | 'PENDING';

export type SourceAuthorityRole =
  | 'DIVIPOLE_MASTER'
  | 'CENSUS_VALIDATION'
  | 'MASTER_VALIDATION'
  | 'COMPLEMENTARY_REFERENCE';

export type SourceConfigurationStatus = 
  | 'SOURCE_CONFIGURED'
  | 'SOURCE_ACTIVE'
  | 'FIRST_CHECK_REQUIRED'
  | 'SOURCE_VALIDATED' 
  | 'SOURCE_PENDING_CONFIGURATION' 
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_BLOCKED'
  | 'AUTHORIZED_SOURCE'
  | 'UNAUTHORIZED_SOURCE'
  | 'NO_CHANGES'
  | 'NEW_OFFICIAL_PUBLICATION'
  | 'VALIDATION_FAILED'
  | 'NO_VALID_VERSION_AVAILABLE';

export interface OfficialProcessSourceDefinition {
  sourceId?: string;
  processId?: string;
  processConfig: ElectoralProcessConfig;
  sourceUrl: string | null;
  sourceType: OfficialSourceType;
  publisher?: string;
  format?: 'HTML' | 'PDF' | 'CSV' | 'JSON' | 'TEXT';
  authority?: SourceAuthorityRole;
  validationMode?: 'CENSUS_VALIDATION' | 'DIVIPOLE_INGESTION' | 'DIVIPOLE_VALIDATION' | string;
  expectedContent?: 'OFFICIAL_ELECTORAL_CENSUS' | 'DIVIPOLE_TABLE' | string;
  enabled: boolean;
  status: SourceConfigurationStatus;
  lastKnownSha256?: string | null;
  lastKnownValidVersion?: any;
  lastSuccessfulCheckAt?: string | null;
  lastSuccessfulValidationAt?: string | null;
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  lastCutoffDate?: string | null;
  notes: string;
  expectedSchema?: string[];
}

/**
 * Catálogo maestro de procesos electorales y estado de sus fuentes oficiales
 */
export const OFFICIAL_PROCESS_SOURCES: Record<string, OfficialProcessSourceDefinition> = {
  'COL-2026-CONGRESO': {
    sourceId: 'COL-2026-CONGRESO',
    processId: 'COL-2026-CONGRESO',
    processConfig: {
      codigoProceso: 'COL-2026-CONGRESO',
      nombre: 'Elecciones de Congreso de la República 2026',
      tipoProceso: 'NACIONAL',
      anio: 2026,
      fechaEleccion: '2026-03-08',
      corporacionesHabilitadas: ['SENADO', 'CAMARA']
    },
    // URL oficial de la Registraduría Nacional (documento PDF)
    sourceUrl: 'https://www.registraduria.gov.co/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf',
    sourceType: 'PDF_UNSUPPORTED',
    format: 'PDF',
    authority: 'DIVIPOLE_MASTER',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Fuente oficial publicada en formato PDF (Divipole definitiva Elecciones Congreso 2026 GEO CITREP Exterior). Requiere canal de extracción estructurado (CSV/JSON) o datos abiertos antes de activar ingesta en base de datos.',
    expectedSchema: [
      'COD_DPTO', 'DEPARTAMENTO', 'COD_MPIO', 'MUNICIPIO', 
      'COD_ZONA', 'ZONA', 'COD_PUESTO', 'PUESTO', 
      'DIRECCION', 'MESAS', 'CENSO', 'LATITUD', 'LONGITUD', 'CITREP_EXTERIOR'
    ]
  },
  'COL-2026-PRES-1V': {
    sourceId: 'COL-2026-PRES-1V',
    processId: 'COL-2026-PRES-1V',
    processConfig: {
      codigoProceso: 'COL-2026-PRES-1V',
      nombre: 'Elecciones Presidenciales Primera Vuelta 2026',
      tipoProceso: 'PRESIDENCIAL',
      anio: 2026,
      fechaEleccion: '2026-05-31',
      corporacionesHabilitadas: ['PRESIDENCIA']
    },
    sourceUrl: 'https://www.registraduria.gov.co/-2026-.html',
    sourceType: 'HTML_PORTAL',
    format: 'HTML',
    authority: 'DIVIPOLE_MASTER',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Portal web informativo de Elecciones 2026. Protegido por WAF/Anti-Bot. Pendiente de publicación de dataset estructurado.',
    expectedSchema: ['COD_DPTO', 'COD_MPIO', 'COD_PUESTO', 'MESAS', 'CENSO']
  },
  'REGISTRADURIA_CENSO_PRESIDENCIAL_2026': {
    sourceId: 'REGISTRADURIA_CENSO_PRESIDENCIAL_2026',
    processId: 'COL-2026-PRES-1V',
    processConfig: {
      codigoProceso: 'COL-2026-PRES-1V',
      nombre: 'Publicación Oficial de Censo Electoral Presidencial 2026',
      tipoProceso: 'PRESIDENCIAL',
      anio: 2026,
      fechaEleccion: '2026-05-31',
      corporacionesHabilitadas: ['PRESIDENCIA']
    },
    publisher: 'Registraduría Nacional del Estado Civil',
    sourceUrl: 'https://www.registraduria.gov.co/Registraduria-Nacional-entrega-detalles-del-censo-electoral-en-Colombia-y-el.html',
    sourceType: 'OFFICIAL_CENSUS_PUBLICATION',
    format: 'HTML',
    authority: 'MASTER_VALIDATION',
    validationMode: 'CENSUS_VALIDATION',
    expectedContent: 'OFFICIAL_ELECTORAL_CENSUS',
    enabled: true,
    status: 'SOURCE_CONFIGURED',
    lastKnownSha256: null,
    lastKnownValidVersion: null,
    lastSuccessfulCheckAt: null,
    lastSuccessfulValidationAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    lastCutoffDate: null,
    notes: 'Publicación oficial informativa de la Registraduría Nacional sobre el censo electoral en Colombia y el exterior para Elecciones 2026. Utilizada exclusivamente como fuente de validación automática del Censo (CENSUS_VALIDATION / MASTER_VALIDATION), sin sustituir la DIVIPOLE oficial ni modificar polling_stations.',
    expectedSchema: [
      'TOTAL_COLOMBIA', 'TOTAL_EXTERIOR', 'TOTAL_NACIONAL',
      'HOMBRES_COLOMBIA', 'MUJERES_COLOMBIA', 'PUESTOS_COLOMBIA', 'MESAS_COLOMBIA',
      'HOMBRES_EXTERIOR', 'MUJERES_EXTERIOR', 'PUESTOS_EXTERIOR', 'MESAS_EXTERIOR',
      'FECHA_CORTE', 'FECHA_ACTUALIZACION', 'DESGLOSE_DEPARTAMENTOS'
    ]
  },
  'COL-2026-PRES-2V': {
    sourceId: 'COL-2026-PRES-2V',
    processId: 'COL-2026-PRES-2V',
    processConfig: {
      codigoProceso: 'COL-2026-PRES-2V',
      nombre: 'Elecciones Presidenciales Segunda Vuelta 2026',
      tipoProceso: 'PRESIDENCIAL',
      anio: 2026,
      fechaEleccion: '2026-06-21',
      corporacionesHabilitadas: ['PRESIDENCIA']
    },
    sourceUrl: 'https://www.registraduria.gov.co/IMG/pdf/puestos_votacion_2da_vuelta_2026.pdf',
    sourceType: 'PDF_UNSUPPORTED',
    format: 'PDF',
    authority: 'DIVIPOLE_MASTER',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Documento PDF de puestos de votación segunda vuelta presidencial. No procesable directamente por parser CSV sin pipeline de extracción.',
    expectedSchema: ['COD_DPTO', 'DEPARTAMENTO', 'COD_MPIO', 'MUNICIPIO', 'COD_PUESTO', 'PUESTO', 'MESAS']
  },
  'COL-2027-TERRITORIAL': {
    sourceId: 'COL-2027-TERRITORIAL',
    processId: 'COL-2027-TERRITORIAL',
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
    authority: 'DIVIPOLE_MASTER',
    enabled: false,
    status: 'SOURCE_PENDING_CONFIGURATION',
    notes: 'Pendiente de convocatoria oficial y calendario electoral de la Registraduría para comicios territoriales 2027.'
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
    status: 'SOURCE_UNAVAILABLE',
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
  if (sourceDef.status === 'SOURCE_PENDING_CONFIGURATION' || sourceDef.status === 'SOURCE_UNAVAILABLE') return false;
  if (!sourceDef.sourceUrl || sourceDef.sourceUrl.trim() === '') return false;
  
  // Rechazar URLs de ejemplo o placeholders genéricos
  const url = sourceDef.sourceUrl.toLowerCase();
  if (url.includes('tu-dominio.com') || url.includes('fuente-oficial.gov.co') || url.includes('example.com')) {
    return false;
  }

  // Si la fuente es PDF no estructurado o portal HTML, no es procesable directamente por el parser CSV/JSON
  if (sourceDef.sourceType === 'PDF_UNSUPPORTED' || sourceDef.sourceType === 'HTML_PORTAL' || url.endsWith('.pdf')) {
    return false;
  }

  return true;
}
