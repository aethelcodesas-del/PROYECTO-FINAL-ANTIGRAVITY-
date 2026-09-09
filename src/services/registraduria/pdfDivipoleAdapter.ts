/**
 * ADAPTADOR DE INGESTA CONTROLADA PARA PDF DIVIPOLE OFICIAL (FASE 8)
 * Archivo: src/services/registraduria/pdfDivipoleAdapter.ts
 * 
 * Estrategia Técnica:
 * 1. Detección y validación de firma binaria PDF (%PDF-).
 * 2. Rechazo inmediato de HTML/WAF/Captcha disfrazado de PDF.
 * 3. Extracción de streams de texto y bloques tabulares sin dependencias binarias pesadas incompatibles con Cloudflare Workers.
 * 4. Normalización estricta de códigos DIVIPOLE (DD/MM/ZZ/PP) con zero-padding (DD: 2 dig, MM: 3 dig, ZZ: 2 dig, PP: 2 dig -> 9 dígitos).
 * 5. Cálculo inmutable de SHA-256 sobre el buffer original descargado.
 * 6. Modo DRY-RUN con CERO escrituras en base de datos para inspección y certificación.
 */

import {
  ElectoralProcessConfig,
  NormalizedDepartment,
  NormalizedMunicipality,
  NormalizedZone,
  NormalizedPollingPlace,
  NormalizedPollingTable,
  AdapterStatistics,
  AdapterValidationError,
  AdapterValidationResult,
  OfficialAdapterResult
} from './types';
import { calculateSha256 } from './sha256';
import { isHtmlOrBlockedContent } from './registraduriaOfficialAdapter';
import { padLeft, cleanText } from './divipoleAdapter';

export interface PdfExtractionOptions {
  dryRun?: boolean;
  maxRowsToInspect?: number;
}

/**
 * Valida si el buffer corresponde a un archivo PDF auténtico o a una respuesta HTML/Error
 */
export function validatePdfBinaryHeader(buffer: Uint8Array | ArrayBuffer | string): {
  isValidPdf: boolean;
  isHtml: boolean;
  reason?: string;
  textContent?: string;
} {
  let text = '';
  if (typeof buffer === 'string') {
    text = buffer;
  } else {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    text = new TextDecoder('latin1').decode(uint8.slice(0, 4096));
  }

  // 1. Detección de Bloqueo HTML/WAF/Captcha
  const blockCheck = isHtmlOrBlockedContent(text);
  if (blockCheck.isBlocked) {
    return {
      isValidPdf: false,
      isHtml: true,
      reason: `El contenido no es un PDF válido. ${blockCheck.reason}`
    };
  }

  // 2. Comprobar firma binaria %PDF-
  if (!text.startsWith('%PDF-') && !text.includes('%PDF-')) {
    return {
      isValidPdf: false,
      isHtml: false,
      reason: 'El archivo recibido no contiene la firma binaria requerida de un documento PDF oficial (%PDF-).'
    };
  }

  return {
    isValidPdf: true,
    isHtml: false
  };
}

/**
 * Extrae texto legible de streams PDF (objetos BT ... ET y bloques de texto)
 */
export function extractTextFromPdfStream(pdfContent: string): string[] {
  const extractedLines: string[] = [];

  // Extraer todos los literales de texto de PDF: (texto) Tj o [(t1) -10 (t2)] TJ
  const tokenRegex = /\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  let currentLineTokens: string[] = [];

  while ((match = tokenRegex.exec(pdfContent)) !== null) {
    const rawToken = match[1] || '';
    const cleanToken = rawToken
      .replace(/\\[nrtbf]/g, ' ')
      .replace(/\\([()])/g, '$1')
      .trim();

    if (cleanToken && cleanToken.length > 0) {
      currentLineTokens.push(cleanToken);
    }

    if (currentLineTokens.length >= 8) {
      extractedLines.push(currentLineTokens.join(';'));
      currentLineTokens = [];
    }
  }

  if (currentLineTokens.length >= 4) {
    extractedLines.push(currentLineTokens.join(';'));
  }

  return extractedLines;
}

export interface PdfRawRow {
  codDpto: string;
  nombreDpto: string;
  codMpio: string;
  nombreMpio: string;
  codZona: string;
  nombreZona?: string;
  codPuesto: string;
  nombrePuesto: string;
  direccion?: string;
  mesas: number;
  censo?: number;
  latitud?: number;
  longitud?: number;
  esRural?: boolean;
}

/**
 * Analiza e interpreta filas tabulares de DIVIPOLE desde texto estructurado o extraído de PDF
 */
export function parsePdfDivipoleRows(
  lines: string[],
  processConfig: ElectoralProcessConfig
): {
  rows: PdfRawRow[];
  errors: AdapterValidationError[];
  warnings: string[];
} {
  const rows: PdfRawRow[] = [];
  const errors: AdapterValidationError[] = [];
  const warnings: string[] = [];

  const seenCodes = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/[;\t,|]+/).map(p => cleanText(p));
    if (parts.length < 5) {
      continue;
    }

    // Detectar si es fila de cabecera
    const firstCol = (parts[0] || '').toLowerCase();
    if (firstCol.includes('cod') || firstCol === 'departamento' || firstCol === 'dpto') {
      continue;
    }

    // Identificar columnas estándar
    const rawDpto = parts[0] || '';
    const nombreDpto = parts[1] || '';
    const rawMpio = parts[2] || '';
    const nombreMpio = parts[3] || '';
    const rawZona = parts.length >= 7 ? parts[4] : '01';
    const rawPuesto = parts.length >= 7 ? parts[5] : parts[4];
    const nombrePuesto = parts.length >= 7 ? parts[6] : parts[parts.length - 2];
    const rawMesas = parts[parts.length - 1];

    const codDpto = padLeft(rawDpto.replace(/\D/g, ''), 2);
    const codMpio = padLeft(rawMpio.replace(/\D/g, ''), 3);
    const codZona = padLeft(rawZona.replace(/\D/g, ''), 2) || '01';
    const codPuesto = padLeft(rawPuesto.replace(/\D/g, ''), 2) || '01';

    // Validar código DIVIPOLE
    if (!codDpto || codDpto === '00' || !codMpio || codMpio === '000') {
      errors.push({
        fila: i + 1,
        campo: 'COD_DIVIPOLE',
        codigo: `${codDpto}${codMpio}${codZona}${codPuesto}`,
        mensaje: `Fila ${i + 1}: Código DIVIPOLE inválido o incompleto.`,
        critico: false
      });
      continue;
    }

    const codUnico = `${codDpto}${codMpio}${codZona}${codPuesto}`;
    if (seenCodes.has(codUnico)) {
      continue; // Evitar duplicar en catálogo único
    }
    seenCodes.add(codUnico);

    const mesasNum = parseInt(rawMesas.replace(/\D/g, ''), 10);
    const mesasValidas = (!isNaN(mesasNum) && mesasNum > 0) ? mesasNum : 1;

    const esRural = codZona === '99' || nombrePuesto.toLowerCase().includes('correg') || nombrePuesto.toLowerCase().includes('vereda');

    rows.push({
      codDpto,
      nombreDpto: nombreDpto || `DPTO ${codDpto}`,
      codMpio,
      nombreMpio: nombreMpio || `MPIO ${codMpio}`,
      codZona,
      nombreZona: `ZONA ${codZona}`,
      codPuesto,
      nombrePuesto: nombrePuesto || `PUESTO ${codPuesto}`,
      mesas: mesasValidas,
      esRural
    });
  }

  return {
    rows,
    errors,
    warnings: errors.length > 0 ? [`Se encontraron ${errors.length} líneas no estructurables en el archivo.`] : []
  };
}

/**
 * Adaptador Principal de Ingesta Controlada y DRY-RUN para PDF Oficial
 */
export async function processOfficialPdfDivipole(
  pdfBufferOrText: Uint8Array | ArrayBuffer | string,
  sourceUrl: string,
  processConfig: ElectoralProcessConfig,
  options: PdfExtractionOptions = {}
): Promise<OfficialAdapterResult> {
  const fetchedAt = new Date().toISOString();
  const sha256 = await calculateSha256(pdfBufferOrText);

  // 1. Validar Cabecera y Detección de Bloqueos
  const validation = validatePdfBinaryHeader(pdfBufferOrText);
  if (!validation.isValidPdf) {
    return {
      success: false,
      sourceUrl,
      sourceType: 'UNKNOWN',
      fetchedAt,
      sha256,
      process: processConfig,
      departments: [],
      municipalities: [],
      zones: [],
      pollingPlaces: [],
      pollingTables: [],
      census: [],
      validation: {
        esValido: false,
        advertencias: [],
        errores: [{
          mensaje: validation.reason || 'El archivo no es un PDF válido.',
          critico: true
        }]
      },
      statistics: {
        registrosRecibidos: 0,
        registrosValidos: 0,
        registrosRechazados: 0,
        departamentosEncontrados: 0,
        municipiosEncontrados: 0,
        zonasEncontradas: 0,
        puestosEncontrados: 0,
        mesasEncontradas: 0,
        registrosCensoEncontrados: 0
      },
      rawErrorMessage: validation.reason
    };
  }

  // 2. Decodificar texto plano o extraer tokens de PDF
  let rawText = '';
  if (typeof pdfBufferOrText === 'string') {
    rawText = pdfBufferOrText;
  } else {
    const uint8 = pdfBufferOrText instanceof Uint8Array ? pdfBufferOrText : new Uint8Array(pdfBufferOrText);
    rawText = new TextDecoder('latin1').decode(uint8);
  }

  let lines: string[] = [];
  if (rawText.includes(';') || rawText.includes('\t') || rawText.includes(',')) {
    // Si contiene líneas tabulares directas (preprocesadas o exportadas de tabla PDF)
    lines = rawText.split(/\r?\n/);
  } else {
    // Extracción de tokens internos de PDF
    lines = extractTextFromPdfStream(rawText);
  }

  const { rows, errors, warnings } = parsePdfDivipoleRows(lines, processConfig);

  if (rows.length === 0) {
    return {
      success: false,
      sourceUrl,
      sourceType: 'TEXT_DIVIPOLE',
      fetchedAt,
      sha256,
      process: processConfig,
      departments: [],
      municipalities: [],
      zones: [],
      pollingPlaces: [],
      pollingTables: [],
      census: [],
      validation: {
        esValido: false,
        advertencias: warnings,
        errores: [{
          mensaje: 'No se pudieron extraer registros estructurados de DIVIPOLE del documento PDF proporcionado.',
          critico: true
        }]
      },
      statistics: {
        registrosRecibidos: lines.length,
        registrosValidos: 0,
        registrosRechazados: lines.length,
        departamentosEncontrados: 0,
        municipiosEncontrados: 0,
        zonasEncontradas: 0,
        puestosEncontrados: 0,
        mesasEncontradas: 0,
        registrosCensoEncontrados: 0
      },
      rawErrorMessage: 'Estructura PDF no reconocible o sin tablas de datos.'
    };
  }

  // 3. Normalizar Entidades Oficiales
  const dptosMap = new Map<string, NormalizedDepartment>();
  const mpiosMap = new Map<string, NormalizedMunicipality>();
  const zonasMap = new Map<string, NormalizedZone>();
  const puestosMap = new Map<string, NormalizedPollingPlace>();
  const mesasArr: NormalizedPollingTable[] = [];

  let totalMesasCount = 0;

  for (const r of rows) {
    if (!dptosMap.has(r.codDpto)) {
      dptosMap.set(r.codDpto, {
        codDptoDivipole: r.codDpto,
        nombreDepartamento: r.nombreDpto
      });
    }

    const codMpioComp = `${r.codDpto}${r.codMpio}`;
    if (!mpiosMap.has(codMpioComp)) {
      mpiosMap.set(codMpioComp, {
        codDptoDivipole: r.codDpto,
        codMpioDivipole: r.codMpio,
        codCompletoDivipole: codMpioComp,
        nombreMunicipio: r.nombreMpio,
        esCapital: r.codMpio === '001'
      });
    }

    const codZonaComp = `${codMpioComp}${r.codZona}`;
    if (!zonasMap.has(codZonaComp)) {
      zonasMap.set(codZonaComp, {
        codCompletoMunicipio: codMpioComp,
        codZonaDivipole: r.codZona,
        nombreZona: r.nombreZona || `ZONA ${r.codZona}`,
        tipoZona: r.esRural ? 'RURAL' : 'URBANA'
      });
    }

    const codUnico = `${r.codDpto}${r.codMpio}${r.codZona}${r.codPuesto}`;
    if (!puestosMap.has(codUnico)) {
      puestosMap.set(codUnico, {
        codDptoDivipole: r.codDpto,
        codMpioDivipole: r.codMpio,
        codZonaDivipole: r.codZona,
        codPuestoDivipole: r.codPuesto,
        codUnicoDivipole: codUnico,
        nombrePuesto: r.nombrePuesto,
        direccion: r.direccion,
        esRural: Boolean(r.esRural),
        latitud: r.latitud,
        longitud: r.longitud,
        mesasTotalOficial: r.mesas
      });

      // Generar mesas oficiales
      for (let m = 1; m <= r.mesas; m++) {
        mesasArr.push({
          codUnicoDivipole: codUnico,
          codigoProceso: processConfig.codigoProceso,
          numeroMesa: m,
          codigoMesaCompleto: `${processConfig.codigoProceso}_${codUnico}_MESA_${padLeft(m, 2)}`
        });
        totalMesasCount++;
      }
    }
  }

  const statistics: AdapterStatistics = {
    registrosRecibidos: lines.length,
    registrosValidos: puestosMap.size,
    registrosRechazados: errors.length,
    departamentosEncontrados: dptosMap.size,
    municipiosEncontrados: mpiosMap.size,
    zonasEncontradas: zonasMap.size,
    puestosEncontrados: puestosMap.size,
    mesasEncontradas: totalMesasCount,
    registrosCensoEncontrados: 0
  };

  return {
    success: true,
    sourceUrl,
    sourceType: 'TEXT_DIVIPOLE',
    fetchedAt,
    sha256,
    process: processConfig,
    departments: Array.from(dptosMap.values()),
    municipalities: Array.from(mpiosMap.values()),
    zones: Array.from(zonasMap.values()),
    pollingPlaces: Array.from(puestosMap.values()),
    pollingTables: mesasArr,
    census: [],
    validation: {
      esValido: true,
      advertencias: warnings,
      errores: errors
    },
    statistics
  };
}
