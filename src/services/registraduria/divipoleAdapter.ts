/**
 * ADAPTADOR Y NORMALIZADOR DIVIPOLE DE LA REGISTRADURÍA NACIONAL
 * Convierte registros crudos (CSV, TSV, JSON, Text) en entidades normalizadas con integridad referencial.
 */

import {
  ElectoralProcessConfig,
  NormalizedDepartment,
  NormalizedMunicipality,
  NormalizedZone,
  NormalizedPollingPlace,
  NormalizedPollingTable,
  AdapterValidationError,
  AdapterStatistics
} from './types';

export function padLeft(value: string | number, length: number): string {
  if (value === null || value === undefined) return ''.padStart(length, '0');
  const str = String(value).trim().replace(/\D/g, '');
  return str.padStart(length, '0');
}

export function cleanText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remover caracteres invisibles y BOM
    .trim()
    .replace(/\s+/g, ' ');
}

// Diccionario flexible de encabezados para soportar variaciones en publicaciones oficiales
const HEADER_ALIASES: Record<string, string[]> = {
  codDpto: ['cod_dpto', 'cod_depto', 'departamento_codigo', 'cód_dpto', 'código_dpto', 'coddpto', 'cod_dep', 'codigo_departamento', 'codigo_dpto'],
  nombreDpto: ['departamento', 'nombre_departamento', 'nombre_dpto', 'dpto', 'nom_dpto'],
  codMpio: ['cod_mpio', 'cod_municipio', 'municipio_codigo', 'cód_mpio', 'código_mpio', 'codmpio', 'cod_mun', 'codigo_municipio', 'codigo_mpio'],
  nombreMpio: ['municipio', 'nombre_municipio', 'nombre_mpio', 'mpio', 'nom_mpio', 'ciudad'],
  codZona: ['cod_zona', 'zona_codigo', 'zona', 'codzona', 'codigo_zona'],
  nombreZona: ['nombre_zona', 'nom_zona', 'comuna', 'sector', 'descripcion_zona'],
  codPuesto: ['cod_puesto', 'puesto_codigo', 'puesto_id', 'codpuesto', 'codigo_puesto'],
  codUnicoDivipole: ['cod_unico', 'cod_divipole', 'divipole', 'codigo_unico', 'codigo_divipole', 'codigo_unico_divipole'],
  nombrePuesto: ['puesto', 'nombre_puesto', 'puesto_votacion', 'nombre_del_puesto', 'nom_puesto', 'lugar_votacion', 'lugar_de_votacion', 'nombre_de_puesto'],
  direccion: ['direccion', 'dirección', 'direccion_puesto', 'ubicacion', 'sede'],
  comunaSector: ['comuna', 'corregimiento', 'comuna_sector', 'comuna_corregimiento', 'barrio'],
  mesas: ['mesas', 'total_mesas', 'mesas_total', 'cantidad_mesas', 'num_mesas', 'nro_mesas', 'nro_de_mesas'],
  latitud: ['latitud', 'lat', 'coord_lat'],
  longitud: ['longitud', 'lng', 'lon', 'coord_lng', 'long']
};

export function resolveHeaderKey(headerName: string): string | null {
  const normalized = cleanText(headerName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_');

  for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIASES)) {
    if (canonicalKey.toLowerCase() === normalized || aliases.includes(normalized)) {
      return canonicalKey;
    }
  }
  return null;
}

export interface ParsedDivipoleRawRow {
  codDpto?: string;
  nombreDpto?: string;
  codMpio?: string;
  nombreMpio?: string;
  codZona?: string;
  nombreZona?: string;
  codPuesto?: string;
  codUnicoDivipole?: string;
  nombrePuesto?: string;
  direccion?: string;
  comunaSector?: string;
  mesas?: number;
  latitud?: number;
  longitud?: number;
  esRural?: boolean;
}

export function parseDelimitedTextToRows(content: string, delimiter: string = ','): { rows: ParsedDivipoleRawRow[]; warnings: string[] } {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return { rows: [], warnings: ['El archivo no contiene suficientes filas de datos.'] };
  }

  // Detectar delimitador si no está definido
  let actualDelimiter = delimiter;
  const headerLine = lines[0];
  if (headerLine.includes('\t')) actualDelimiter = '\t';
  else if (headerLine.includes(';')) actualDelimiter = ';';
  else if (headerLine.includes('|')) actualDelimiter = '|';

  const rawHeaders = headerLine.split(actualDelimiter).map(h => cleanText(h.replace(/^["']|["']$/g, '')));
  const headerMap: Record<number, string> = {};

  rawHeaders.forEach((h, idx) => {
    const key = resolveHeaderKey(h);
    if (key) {
      headerMap[idx] = key;
    }
  });

  const rows: ParsedDivipoleRawRow[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Manejo básico de campos entrecomillados
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === actualDelimiter && !inQuotes) {
        tokens.push(cleanText(current.replace(/^"|"$/g, '')));
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(cleanText(current.replace(/^"|"$/g, '')));

    const rowObj: Record<string, any> = {};
    tokens.forEach((val, idx) => {
      const colKey = headerMap[idx];
      if (colKey) {
        rowObj[colKey] = val;
      }
    });

    if (rowObj.nombrePuesto || rowObj.codPuesto || rowObj.codUnicoDivipole) {
      rows.push({
        codDpto: rowObj.codDpto,
        nombreDpto: rowObj.nombreDpto,
        codMpio: rowObj.codMpio,
        nombreMpio: rowObj.nombreMpio,
        codZona: rowObj.codZona,
        nombreZona: rowObj.nombreZona,
        codPuesto: rowObj.codPuesto,
        codUnicoDivipole: rowObj.codUnicoDivipole,
        nombrePuesto: rowObj.nombrePuesto,
        direccion: rowObj.direccion,
        comunaSector: rowObj.comunaSector,
        mesas: rowObj.mesas ? Number(rowObj.mesas) : undefined,
        latitud: rowObj.latitud ? Number(rowObj.latitud) : undefined,
        longitud: rowObj.longitud ? Number(rowObj.longitud) : undefined,
        esRural: rowObj.comunaSector?.toLowerCase().includes('corregimiento') || rowObj.comunaSector?.toLowerCase().includes('rural') || rowObj.codZona === '99'
      });
    }
  }

  return { rows, warnings };
}

export function normalizeDivipoleEntities(
  rawRows: ParsedDivipoleRawRow[],
  processConfig: ElectoralProcessConfig
): {
  departments: NormalizedDepartment[];
  municipalities: NormalizedMunicipality[];
  zones: NormalizedZone[];
  pollingPlaces: NormalizedPollingPlace[];
  pollingTables: NormalizedPollingTable[];
  errors: AdapterValidationError[];
  stats: AdapterStatistics;
} {
  const deptMap = new Map<string, NormalizedDepartment>();
  const mpioMap = new Map<string, NormalizedMunicipality>();
  const zoneMap = new Map<string, NormalizedZone>();
  const placeMap = new Map<string, NormalizedPollingPlace>();
  const tableList: NormalizedPollingTable[] = [];
  const errors: AdapterValidationError[] = [];

  let registrosValidos = 0;
  let registrosRechazados = 0;

  rawRows.forEach((row, idx) => {
    const filaNum = idx + 2;

    // Normalizar códigos con ceros a la izquierda
    const codDpto = padLeft(row.codDpto || '', 2);
    const codMpio = padLeft(row.codMpio || '', 3);
    const codZona = padLeft(row.codZona || '01', 2);
    const codPuesto = padLeft(row.codPuesto || '', 2);

    const nombreDpto = cleanText(row.nombreDpto);
    const nombreMpio = cleanText(row.nombreMpio);
    const nombrePuesto = cleanText(row.nombrePuesto);

    // Validación de campos mandatorios
    if (!nombrePuesto) {
      errors.push({
        fila: filaNum,
        campo: 'nombrePuesto',
        mensaje: `Fila ${filaNum}: El puesto de votación no tiene nombre oficial.`,
        critico: false
      });
      registrosRechazados++;
      return;
    }

    if (!codDpto || codDpto === '00' || !codMpio || codMpio === '000') {
      errors.push({
        fila: filaNum,
        campo: 'codDpto/codMpio',
        mensaje: `Fila ${filaNum}: Código DIVIPOLE de departamento (${codDpto}) o municipio (${codMpio}) inválido.`,
        critico: false
      });
      registrosRechazados++;
      return;
    }

    // Código único oficial de 9 dígitos: DD + MMM + ZZ + PP
    const codCompletoMpio = `${codDpto}${codMpio}`;
    const codUnicoDivipole = cleanText(row.codUnicoDivipole) && cleanText(row.codUnicoDivipole).length === 9
      ? cleanText(row.codUnicoDivipole)
      : `${codCompletoMpio}${codZona}${codPuesto}`;

    // 1. Departamento
    if (!deptMap.has(codDpto)) {
      deptMap.set(codDpto, {
        codDptoDivipole: codDpto,
        nombreDepartamento: nombreDpto || `Departamento ${codDpto}`
      });
    }

    // 2. Municipio
    if (!mpioMap.has(codCompletoMpio)) {
      mpioMap.set(codCompletoMpio, {
        codDptoDivipole: codDpto,
        codMpioDivipole: codMpio,
        codCompletoDivipole: codCompletoMpio,
        nombreMunicipio: nombreMpio || `Municipio ${codMpio}`,
        esCapital: codMpio === '001'
      });
    }

    // 3. Zona
    const zoneKey = `${codCompletoMpio}_${codZona}`;
    if (!zoneMap.has(zoneKey)) {
      const isRural = codZona === '99' || row.esRural || false;
      zoneMap.set(zoneKey, {
        codCompletoMunicipio: codCompletoMpio,
        codZonaDivipole: codZona,
        nombreZona: cleanText(row.nombreZona) || (isRural ? 'Zona Rural Corregimientos' : `Zona ${codZona}`),
        tipoZona: isRural ? 'RURAL' : 'URBANA'
      });
    }

    // 4. Puesto de Votación
    if (!placeMap.has(codUnicoDivipole)) {
      const mesasCount = Number(row.mesas) > 0 ? Number(row.mesas) : 1;
      const isRural = row.esRural || codZona === '99';

      const placeEntity: NormalizedPollingPlace = {
        codDptoDivipole: codDpto,
        codMpioDivipole: codMpio,
        codZonaDivipole: codZona,
        codPuestoDivipole: codPuesto,
        codUnicoDivipole,
        nombrePuesto,
        direccion: cleanText(row.direccion) || undefined,
        comunaOCorregimiento: cleanText(row.comunaSector) || undefined,
        esRural: isRural,
        latitud: row.latitud,
        longitud: row.longitud,
        mesasTotalOficial: mesasCount
      };
      placeMap.set(codUnicoDivipole, placeEntity);

      // 5. Mesas Oficiales por Puesto y Proceso (No inventar: generar 1..N si la fuente indica N mesas)
      for (let m = 1; m <= mesasCount; m++) {
        const mesaStr = padLeft(m, 2);
        tableList.push({
          codUnicoDivipole,
          codigoProceso: processConfig.codigoProceso,
          numeroMesa: m,
          codigoMesaCompleto: `${processConfig.codigoProceso}_${codUnicoDivipole}_MESA_${mesaStr}`
        });
      }

      registrosValidos++;
    } else {
      // Puesto duplicado encontrado en la misma fuente
      errors.push({
        fila: filaNum,
        codigo: codUnicoDivipole,
        mensaje: `Fila ${filaNum}: Código único DIVIPOLE duplicado (${codUnicoDivipole}) para '${nombrePuesto}'.`,
        critico: false
      });
    }
  });

  const stats: AdapterStatistics = {
    registrosRecibidos: rawRows.length,
    registrosValidos,
    registrosRechazados,
    departamentosEncontrados: deptMap.size,
    municipiosEncontrados: mpioMap.size,
    zonasEncontradas: zoneMap.size,
    puestosEncontrados: placeMap.size,
    mesasEncontradas: tableList.length,
    registrosCensoEncontrados: 0
  };

  return {
    departments: Array.from(deptMap.values()),
    municipalities: Array.from(mpioMap.values()),
    zones: Array.from(zoneMap.values()),
    pollingPlaces: Array.from(placeMap.values()),
    pollingTables: tableList,
    errors,
    stats
  };
}
