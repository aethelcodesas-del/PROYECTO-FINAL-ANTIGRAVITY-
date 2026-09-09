/**
 * ADAPTADOR OFICIAL PRINCIPAL DE LA REGISTRADURÍA NACIONAL DEL ESTADO CIVIL
 * Orquestador de Descarga Segura, Detección de Formato, Parseo, Normalización y Validación.
 * 
 * Cumple con:
 * 1. Cero escrituras a Base de Datos (Fase 4 - Solo lectura y transformación).
 * 2. Detección de Bloqueos / Captcha / HTML de error.
 * 3. Hashing criptográfico SHA-256 universal.
 * 4. Extensible para cualquier proceso electoral (Nacional, Territorial, Futuro).
 */

import {
  ElectoralProcessConfig,
  OfficialAdapterResult,
  FetchSourceOptions
} from './types';
import { calculateSha256 } from './sha256';
import { parseDelimitedTextToRows, normalizeDivipoleEntities } from './divipoleAdapter';
import { parseCensusRows } from './censusAdapter';

/**
 * Detecta si el contenido devuelto es una página HTML de bloqueo, captcha o error del servidor
 */
export function isHtmlOrBlockedContent(content: string): { isBlocked: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { isBlocked: true, reason: 'El contenido recibido está vacío o no es una cadena válida.' };
  }

  const sample = content.slice(0, 1000).toLowerCase();

  if (sample.includes('<!doctype html') || sample.includes('<html') || sample.includes('<head>')) {
    if (sample.includes('cf-browser-verification') || sample.includes('just a moment...') || sample.includes('challenge-platform')) {
      return { isBlocked: true, reason: 'La fuente oficial devolvió un desafío Cloudflare / Captcha de protección bot.' };
    }
    if (sample.includes('403 forbidden') || sample.includes('access denied')) {
      return { isBlocked: true, reason: 'Acceso denegado (403) por el servidor oficial de la Registraduría.' };
    }
    if (sample.includes('404 not found') || sample.includes('página no encontrada')) {
      return { isBlocked: true, reason: 'El archivo oficial no fue encontrado (404) en la URL de la Registraduría.' };
    }
    return { isBlocked: true, reason: 'El servidor oficial devolvió una página HTML en lugar de un archivo de datos estructurado.' };
  }

  return { isBlocked: false };
}

/**
 * Procesa contenido en bruto (CSV, TSV, JSON, Texto estructurado) de la Registraduría
 */
export async function parseOfficialElectoralContent(
  rawContent: string,
  sourceUrl: string,
  processConfig: ElectoralProcessConfig,
  sourceType: 'DIVIPOLE' | 'CENSO' = 'DIVIPOLE'
): Promise<OfficialAdapterResult> {
  const fetchedAt = new Date().toISOString();
  const sha256 = await calculateSha256(rawContent);

  // 1. Detección de bloqueos o errores HTML
  const blockCheck = isHtmlOrBlockedContent(rawContent);
  if (blockCheck.isBlocked) {
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
        errores: [{ mensaje: blockCheck.reason || 'Contenido inválido', critico: true }]
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
      rawErrorMessage: blockCheck.reason
    };
  }

  // 2. Procesamiento según tipo de fuente (DIVIPOLE o CENSO)
  if (sourceType === 'CENSO') {
    const { census, errors, stats } = parseCensusRows(rawContent, processConfig);
    const esValido = census.length > 0 && errors.filter(e => e.critico).length === 0;

    return {
      success: esValido,
      sourceUrl,
      sourceType: 'CENSO_OFFICIAL',
      fetchedAt,
      sha256,
      process: processConfig,
      departments: [],
      municipalities: [],
      zones: [],
      pollingPlaces: [],
      pollingTables: [],
      census,
      validation: {
        esValido,
        advertencias: [],
        errores: errors
      },
      statistics: stats
    };
  } else {
    // 3. Procesamiento DIVIPOLE
    const { rows, warnings } = parseDelimitedTextToRows(rawContent);
    const {
      departments,
      municipalities,
      zones,
      pollingPlaces,
      pollingTables,
      errors,
      stats
    } = normalizeDivipoleEntities(rows, processConfig);

    const esValido = pollingPlaces.length > 0 && errors.filter(e => e.critico).length === 0;

    return {
      success: esValido,
      sourceUrl,
      sourceType: 'CSV_DIVIPOLE',
      fetchedAt,
      sha256,
      process: processConfig,
      departments,
      municipalities,
      zones,
      pollingPlaces,
      pollingTables,
      census: [],
      validation: {
        esValido,
        advertencias: warnings,
        errores: errors
      },
      statistics: stats
    };
  }
}

/**
 * Descarga y procesa de forma segura una fuente oficial mediante HTTP GET con AbortController y Timeout
 */
export async function fetchAndParseOfficialSource(
  sourceUrl: string,
  processConfig: ElectoralProcessConfig,
  options: FetchSourceOptions = {}
): Promise<OfficialAdapterResult> {
  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'TechneoElectoralOfficialAdapter/1.0 (Gobierno de Colombia; DIVIPOLE)',
        'Accept': 'text/csv, application/json, text/plain, */*',
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const sha256 = await calculateSha256(`HTTP_ERROR_${response.status}`);
      return {
        success: false,
        sourceUrl,
        sourceType: 'UNKNOWN',
        fetchedAt: new Date().toISOString(),
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
          errores: [{ mensaje: `HTTP ${response.status}: ${response.statusText} al acceder a la fuente oficial.`, critico: true }]
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
        rawErrorMessage: `Respuesta HTTP ${response.status} de la fuente oficial.`
      };
    }

    const textContent = await response.text();
    return await parseOfficialElectoralContent(
      textContent,
      sourceUrl,
      processConfig,
      options.expectedType || 'DIVIPOLE'
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    const errorMsg = isAbort
      ? `Tiempo de espera agotado (${timeoutMs}ms) al descargar la fuente oficial.`
      : `Error de conexión con la fuente oficial: ${error?.message || 'Desconocido'}`;

    const sha256 = await calculateSha256(`FETCH_EXCEPTION_${errorMsg}`);

    return {
      success: false,
      sourceUrl,
      sourceType: 'UNKNOWN',
      fetchedAt: new Date().toISOString(),
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
        errores: [{ mensaje: errorMsg, critico: true }]
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
      rawErrorMessage: errorMsg
    };
  }
}
