/**
 * TIPOS Y DEFINICIONES PARA EL ADAPTADOR OFICIAL DE LA REGISTRADURÍA NACIONAL
 * Catálogo Electoral DIVIPOLE y Censo Electoral Oficial
 */

export type TipoProcesoElectoral = 'NACIONAL' | 'TERRITORIAL' | 'ATIPICA' | 'CONSULTA';

export interface ElectoralProcessConfig {
  codigoProceso: string;          // Ej: 'COL-2026-CONGRESO', 'COL-2026-PRES-1V', 'COL-2027-TERRITORIAL'
  nombre: string;                 // Ej: 'Elecciones Congreso de la República 2026'
  tipoProceso: TipoProcesoElectoral;
  anio: number;
  fechaEleccion: string;          // 'YYYY-MM-DD'
  corporacionesHabilitadas: string[]; // ['SENADO', 'CAMARA', 'PRESIDENCIA', 'ALCALDIA', 'CONCEJO', 'GOBERNACION', 'ASAMBLEA', 'JAL']
}

export interface NormalizedDepartment {
  codDptoDivipole: string;        // Formato 2 dígitos con cero a la izquierda (Ej: '01', '05', '23')
  nombreDepartamento: string;
  region?: string;
}

export interface NormalizedMunicipality {
  codDptoDivipole: string;        // '23'
  codMpioDivipole: string;        // '001', '189'
  codCompletoDivipole: string;    // '23189' (5 dígitos)
  nombreMunicipio: string;
  esCapital: boolean;
}

export interface NormalizedZone {
  codCompletoMunicipio: string;   // '23189'
  codZonaDivipole: string;        // '01', '99'
  nombreZona: string;
  tipoZona: 'URBANA' | 'RURAL' | 'CARCEL' | 'EXTERIOR';
}

export interface NormalizedPollingPlace {
  codDptoDivipole: string;        // '23'
  codMpioDivipole: string;        // '189'
  codZonaDivipole: string;        // '01'
  codPuestoDivipole: string;      // '01'
  codUnicoDivipole: string;       // '231890101' (9 dígitos)
  nombrePuesto: string;
  direccion?: string;
  comunaOCorregimiento?: string;
  esRural: boolean;
  latitud?: number;
  longitud?: number;
  mesasTotalOficial?: number;
}

export interface NormalizedPollingTable {
  codUnicoDivipole: string;       // '231890101'
  codigoProceso: string;          // 'COL-2026-CONGRESO'
  numeroMesa: number;             // 1, 2, 3...
  codigoMesaCompleto: string;     // 'COL-2026-CONGRESO_231890101_MESA_01'
  censoOficialMesa?: number;
  rangoCedulasInicio?: string;
  rangoCedulasFin?: string;
}

export interface NormalizedCensusRecord {
  codigoProceso: string;
  codDptoDivipole: string;
  codMpioDivipole?: string;
  codUnicoDivipole?: string;
  fechaCorte: string;             // 'YYYY-MM-DD'
  hombres: number;
  mujeres: number;
  totalElectores: number;         // Valor oficial puro (NO calculado artificialmente)
  totalPuestos?: number;
  totalMesas?: number;
  fuente: string;
  urlFuente?: string;
  fechaPublicacion?: string;
}

export interface AdapterStatistics {
  registrosRecibidos: number;
  registrosValidos: number;
  registrosRechazados: number;
  departamentosEncontrados: number;
  municipiosEncontrados: number;
  zonasEncontradas: number;
  puestosEncontrados: number;
  mesasEncontradas: number;
  registrosCensoEncontrados: number;
}

export interface AdapterValidationError {
  fila?: number;
  campo?: string;
  codigo?: string;
  mensaje: string;
  critico: boolean;
}

export interface AdapterValidationResult {
  esValido: boolean;
  advertencias: string[];
  errores: AdapterValidationError[];
}

export interface OfficialAdapterResult {
  success: boolean;
  sourceUrl: string;
  sourceType: 'CSV_DIVIPOLE' | 'JSON_DIVIPOLE' | 'TEXT_DIVIPOLE' | 'CENSO_OFFICIAL' | 'API_OFFICIAL' | 'UNKNOWN';
  fetchedAt: string;
  sha256: string;
  process: ElectoralProcessConfig;
  departments: NormalizedDepartment[];
  municipalities: NormalizedMunicipality[];
  zones: NormalizedZone[];
  pollingPlaces: NormalizedPollingPlace[];
  pollingTables: NormalizedPollingTable[];
  census: NormalizedCensusRecord[];
  validation: AdapterValidationResult;
  statistics: AdapterStatistics;
  rawErrorMessage?: string;
}

export interface FetchSourceOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  expectedType?: 'DIVIPOLE' | 'CENSO';
}
