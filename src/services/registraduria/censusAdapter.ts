/**
 * ADAPTADOR DEL CENSO ELECTORAL OFICIAL DE LA REGISTRADURÍA NACIONAL
 * Procesa y normaliza los datos del censo electoral oficial sin cálculos artificiales.
 */

import {
  ElectoralProcessConfig,
  NormalizedCensusRecord,
  AdapterValidationError,
  AdapterStatistics
} from './types';
import { padLeft, cleanText, resolveHeaderKey } from './divipoleAdapter';

export interface ParsedCensusRawRow {
  codDpto?: string;
  nombreDpto?: string;
  codMpio?: string;
  nombreMpio?: string;
  codUnicoDivipole?: string;
  fechaCorte?: string;
  hombres?: number;
  mujeres?: number;
  totalElectores?: number;
  totalPuestos?: number;
  totalMesas?: number;
  fuente?: string;
  urlFuente?: string;
}

export function parseCensusRows(
  content: string,
  processConfig: ElectoralProcessConfig,
  defaultFechaCorte: string = '2026-01-01',
  fuenteOficialNombre: string = 'Registraduría Nacional del Estado Civil - Censo Oficial'
): {
  census: NormalizedCensusRecord[];
  errors: AdapterValidationError[];
  stats: AdapterStatistics;
} {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return {
      census: [],
      errors: [{ mensaje: 'El archivo de censo no contiene filas suficientes.', critico: true }],
      stats: {
        registrosRecibidos: 0,
        registrosValidos: 0,
        registrosRechazados: 0,
        departamentosEncontrados: 0,
        municipiosEncontrados: 0,
        zonasEncontradas: 0,
        puestosEncontrados: 0,
        mesasEncontradas: 0,
        registrosCensoEncontrados: 0
      }
    };
  }

  let delimiter = ',';
  if (lines[0].includes('\t')) delimiter = '\t';
  else if (lines[0].includes(';')) delimiter = ';';

  const rawHeaders = lines[0].split(delimiter).map(h => cleanText(h.replace(/^["']|["']$/g, '')));
  const headerMap: Record<number, string> = {};

  rawHeaders.forEach((h, idx) => {
    const key = resolveHeaderKey(h);
    if (key) headerMap[idx] = key;
    // Mapeos adicionales específicos de censo
    const lower = h.toLowerCase();
    if (lower.includes('hombres') || lower.includes('varones')) headerMap[idx] = 'hombres';
    if (lower.includes('mujeres') || lower.includes('femenino')) headerMap[idx] = 'mujeres';
    if (lower.includes('total_censo') || lower.includes('censo') || lower.includes('electores')) headerMap[idx] = 'totalElectores';
    if (lower.includes('corte') || lower.includes('fecha')) headerMap[idx] = 'fechaCorte';
  });

  const censusList: NormalizedCensusRecord[] = [];
  const errors: AdapterValidationError[] = [];
  const deptSet = new Set<string>();
  const mpioSet = new Set<string>();

  let validCount = 0;
  let rejectedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const filaNum = i + 1;
    const tokens = lines[i].split(delimiter).map(t => cleanText(t.replace(/^["']|["']$/g, '')));
    const rowObj: Record<string, any> = {};

    tokens.forEach((val, idx) => {
      const colKey = headerMap[idx];
      if (colKey) rowObj[colKey] = val;
    });

    const codDpto = padLeft(rowObj.codDpto || '', 2);
    const codMpio = rowObj.codMpio ? padLeft(rowObj.codMpio, 3) : undefined;
    const hombres = Number(rowObj.hombres) || 0;
    const mujeres = Number(rowObj.mujeres) || 0;

    // Regla de oro: Usar el total oficial publicado si viene en la fuente; de lo contrario sumar
    const totalElectores = Number(rowObj.totalElectores) > 0
      ? Number(rowObj.totalElectores)
      : (hombres + mujeres);

    if (totalElectores <= 0 || !codDpto || codDpto === '00') {
      errors.push({
        fila: filaNum,
        mensaje: `Fila ${filaNum}: Registro de censo inválido (total electores <= 0 o departamento no especificado).`,
        critico: false
      });
      rejectedCount++;
      continue;
    }

    deptSet.add(codDpto);
    if (codMpio) mpioSet.add(`${codDpto}${codMpio}`);

    censusList.push({
      codigoProceso: processConfig.codigoProceso,
      codDptoDivipole: codDpto,
      codMpioDivipole: codMpio,
      codUnicoDivipole: rowObj.codUnicoDivipole ? cleanText(rowObj.codUnicoDivipole) : undefined,
      fechaCorte: rowObj.fechaCorte || defaultFechaCorte,
      hombres,
      mujeres,
      totalElectores,
      totalPuestos: rowObj.mesas ? Number(rowObj.mesas) : undefined,
      totalMesas: rowObj.mesas ? Number(rowObj.mesas) : undefined,
      fuente: fuenteOficialNombre,
      urlFuente: rowObj.urlFuente || undefined,
      fechaPublicacion: rowObj.fechaCorte || defaultFechaCorte
    });

    validCount++;
  }

  const stats: AdapterStatistics = {
    registrosRecibidos: lines.length - 1,
    registrosValidos: validCount,
    registrosRechazados: rejectedCount,
    departamentosEncontrados: deptSet.size,
    municipiosEncontrados: mpioSet.size,
    zonasEncontradas: 0,
    puestosEncontrados: 0,
    mesasEncontradas: 0,
    registrosCensoEncontrados: censusList.length
  };

  return {
    census: censusList,
    errors,
    stats
  };
}
