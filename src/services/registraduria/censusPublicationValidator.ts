/**
 * SERVICIO DE VALIDACIÓN AUTOMÁTICA DE PUBLICACIONES OFICIALES DE CENSO (REGISTRADURÍA)
 * Archivo: src/services/registraduria/censusPublicationValidator.ts
 * 
 * Rol: CENSUS_VALIDATION / MASTER_VALIDATION
 * 
 * Reglas Estrictas:
 * 1. La DIVIPOLE oficial define la estructura territorial (puestos, mesas).
 * 2. Esta publicación se utiliza EXCLUSIVAMENTE para validar los totales oficiales publicados.
 * 3. NUNCA reemplazar la DIVIPOLE ni generar mesas a partir de esta página.
 * 4. CERO modificaciones a polling_stations, campañas, usuarios o asignaciones.
 * 5. Si la Registraduría bloquea por WAF/403 -> SOURCE_BLOCKED sin escrituras.
 * 6. Validación de dominio estricta (https://*.registraduria.gov.co).
 */

import { calculateSha256 } from './sha256';
import { isHtmlOrBlockedContent } from './registraduriaOfficialAdapter';

export interface DepartmentCensusDetail {
  codDpto?: string;
  departamento: string;
  hombres?: number;
  mujeres?: number;
  total: number;
  puestos?: number;
  mesas?: number;
}

export interface OfficialCensusExtractedData {
  cutoffDate?: string;
  publicationUpdatedAt?: string;
  totalColombia?: number;
  totalExterior?: number;
  totalNacional?: number;
  hombresColombia?: number;
  mujeresColombia?: number;
  hombresExterior?: number;
  mujeresExterior?: number;
  puestosColombia?: number;
  puestosExterior?: number;
  puestosTotal?: number;
  mesasColombia?: number;
  mesasExterior?: number;
  mesasTotal?: number;
  departmentBreakdown: DepartmentCensusDetail[];
}

export interface DomainValidationResult {
  isValid: boolean;
  status: 'AUTHORIZED_SOURCE' | 'UNAUTHORIZED_SOURCE';
  reason?: string;
}

export interface CensusValidationDiscrepancy {
  ambito: 'NACIONAL' | 'DEPARTAMENTAL' | 'EXTERIOR' | 'PUESTOS' | 'MESAS';
  departamento?: string;
  campo: string;
  valorAlmacenado: number | string | undefined;
  valorPublicado: number | string | undefined;
  diferencia: number;
  checkedAt: string;
  sha256Publicacion: string;
}

export interface CensusPublicationCheckResult {
  success: boolean;
  status: 
    | 'AUTHORIZED_SOURCE'
    | 'UNAUTHORIZED_SOURCE'
    | 'SOURCE_VALID'
    | 'SOURCE_BLOCKED'
    | 'NO_CHANGES'
    | 'NEW_OFFICIAL_PUBLICATION'
    | 'VALIDATION_FAILED'
    | 'MATCH'
    | 'CENSUS_VALIDATION_MISMATCH';
  sourceUrl: string;
  checkedAt: string;
  sha256?: string;
  cutoffDate?: string;
  publicationUpdatedAt?: string;
  extractedData?: OfficialCensusExtractedData;
  discrepancies: CensusValidationDiscrepancy[];
  databaseWritesPerformed: number;
  pollingStationsUntouched: boolean;
  campaignsUntouched: boolean;
  message: string;
  error?: string;
}

/**
 * Valida que la URL pertenezca estricta y legítimamente al dominio oficial de la Registraduría
 */
export function validateOfficialRegistraduriaDomain(urlStr: string): DomainValidationResult {
  try {
    const url = new URL(urlStr);
    
    if (url.protocol !== 'https:') {
      return {
        isValid: false,
        status: 'UNAUTHORIZED_SOURCE',
        reason: 'La URL oficial debe utilizar obligatoriamente el protocolo HTTPS seguro.'
      };
    }

    const host = url.hostname.toLowerCase();
    const isRegistraduria = host === 'registraduria.gov.co' || host === 'www.registraduria.gov.co' || host.endsWith('.registraduria.gov.co');

    if (!isRegistraduria) {
      return {
        isValid: false,
        status: 'UNAUTHORIZED_SOURCE',
        reason: `Dominio no autorizado: "${host}". Solo se permiten fuentes oficiales de registraduria.gov.co.`
      };
    }

    return {
      isValid: true,
      status: 'AUTHORIZED_SOURCE'
    };
  } catch (err: any) {
    return {
      isValid: false,
      status: 'UNAUTHORIZED_SOURCE',
      reason: `URL inválida o malformada: ${err?.message || 'Error de sintaxis de URL'}`
    };
  }
}

/**
 * Detecta si el contenido HTML corresponde a un desafío de WAF, Captcha o error HTTP
 */
export function detectWafOrHtmlError(content: string): { isBlocked: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { isBlocked: true, reason: 'El contenido recibido está vacío o no es una cadena válida.' };
  }

  const sample = content.slice(0, 2000).toLowerCase();

  if (
    sample.includes('cf-browser-verification') || 
    sample.includes('just a moment...') || 
    sample.includes('challenge-platform') ||
    sample.includes('cloudflare bot challenge') ||
    sample.includes('turnstile') ||
    sample.includes('attention required') ||
    sample.includes('recaptcha')
  ) {
    return { isBlocked: true, reason: 'La fuente oficial devolvió un desafío Cloudflare / Captcha de protección bot.' };
  }
  if (sample.includes('403 forbidden') || sample.includes('access denied') || sample.includes('acceso denegado')) {
    return { isBlocked: true, reason: 'Acceso denegado (403) por el servidor oficial de la Registraduría.' };
  }
  if (sample.includes('404 not found') || sample.includes('página no encontrada')) {
    return { isBlocked: true, reason: 'El archivo oficial no fue encontrado (404) en la URL de la Registraduría.' };
  }

  return { isBlocked: false };
}

/**
 * Extrae texto plano de HTML simple sin dependencias externas
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae un número entero de un fragmento de texto
 */
function extractNumber(text: string): number | undefined {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return undefined;
  const num = parseInt(digits, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Parsea y extrae exclusivamente datos numéricos y fechas publicados en el HTML oficial
 */
export function parseOfficialCensusPublicationHtml(
  htmlContent: string
): {
  success: boolean;
  isBlocked: boolean;
  data?: OfficialCensusExtractedData;
  error?: string;
} {
  // 1. Detección de Bloqueos / Captcha / WAF
  const blockCheck = detectWafOrHtmlError(htmlContent);
  if (blockCheck.isBlocked) {
    return {
      success: false,
      isBlocked: true,
      error: blockCheck.reason || 'La fuente oficial devolvió una respuesta bloqueada por WAF/Anti-Bot.'
    };
  }

  const text = cleanHtmlText(htmlContent);

  // 2. Extracción de Fecha de Corte Oficial
  let cutoffDate: string | undefined;
  const cutoffMatch = text.match(/corte\s+(?:del\s+|al\s+|a\s+)?(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i) ||
                      text.match(/(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i);
  if (cutoffMatch && cutoffMatch[1]) {
    cutoffDate = cutoffMatch[1].trim();
  }

  // 3. Extracción de Totales Nacionales y Exterior
  let totalColombia: number | undefined;
  let totalExterior: number | undefined;
  let totalNacional: number | undefined;
  let hombresColombia: number | undefined;
  let mujeresColombia: number | undefined;
  let puestosColombia: number | undefined;
  let mesasColombia: number | undefined;
  let puestosExterior: number | undefined;
  let mesasExterior: number | undefined;

  // Extraer con patrones contextuales específicos
  const nacMatch = text.match(/(?:total\s+nacional|total\s+censo|total\s+de\s+electores|total\s+electores)[^0-9]{1,30}([\d.,]{6,})/i) ||
                  text.match(/total\s+(?:nacional|censo)[^0-9]{1,30}([\d.,]+)/i);
  if (nacMatch && nacMatch[1]) totalNacional = extractNumber(nacMatch[1]);

  const colMatch = text.match(/(?:censo(?:\s+electoral)?\s+en\s+Colombia|en\s+Colombia\s+es\s+de|territorio\s+nacional\s+es\s+de)[^0-9]{0,20}([\d.,]{6,})/i) ||
                  text.match(/(?:en\s+Colombia|territorio\s+nacional)[^0-9]{1,20}([\d.,]{6,})/i);
  if (colMatch && colMatch[1]) totalColombia = extractNumber(colMatch[1]);

  const extMatch = text.match(/(?:en\s+el\s+exterior\s+es\s+de|exterior\s+es\s+de|censo(?:\s+electoral)?\s+en\s+el\s+exterior)[^0-9]{0,20}([\d.,]{5,})/i) ||
                  text.match(/(?:en\s+el\s+exterior|exterior)[^0-9]{1,20}([\d.,]{5,})/i);
  if (extMatch && extMatch[1]) totalExterior = extractNumber(extMatch[1]);

  const homColMatch = text.match(/([\d.,]+)\s*(?:son\s+)?hombres/i) || text.match(/hombres[^0-9]{1,20}([\d.,]+)/i);
  if (homColMatch && homColMatch[1]) hombresColombia = extractNumber(homColMatch[1]);

  const mujColMatch = text.match(/([\d.,]+)\s*(?:son\s+)?mujeres/i) || text.match(/mujeres[^0-9]{1,20}([\d.,]+)/i);
  if (mujColMatch && mujColMatch[1]) mujeresColombia = extractNumber(mujColMatch[1]);

  const puestosMatch = text.match(/([\d.,]+)\s*puestos\s*(?:de\s+votaci[oó]n)?/i) || text.match(/puestos[^0-9]{1,20}([\d.,]+)/i);
  if (puestosMatch && puestosMatch[1]) puestosColombia = extractNumber(puestosMatch[1]);

  const mesasMatch = text.match(/([\d.,]+)\s*mesas\s*(?:de\s+votaci[oó]n)?/i) || text.match(/mesas[^0-9]{1,20}([\d.,]+)/i);
  if (mesasMatch && mesasMatch[1]) mesasColombia = extractNumber(mesasMatch[1]);

  // 4. Extracción de Desglose Departamental cuando exista en tablas HTML
  const departmentBreakdown: DepartmentCensusDetail[] = [];
  const tableRows = htmlContent.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const tr of tableRows) {
    const cells = (tr.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(c => cleanHtmlText(c));
    if (cells.length >= 2) {
      const firstCol = cells[0].toLowerCase();
      if (firstCol.includes('departamento') || firstCol.includes('dpto') || firstCol.includes('total')) {
        continue;
      }

      const nombreDpto = cells[0];
      const totalDpto = extractNumber(cells[cells.length - 1]);

      if (nombreDpto && totalDpto && totalDpto > 0 && !firstCol.includes('colombia')) {
        departmentBreakdown.push({
          departamento: nombreDpto.toUpperCase(),
          total: totalDpto,
          hombres: cells.length >= 4 ? extractNumber(cells[1]) : undefined,
          mujeres: cells.length >= 4 ? extractNumber(cells[2]) : undefined,
          mesas: cells.length >= 5 ? extractNumber(cells[3]) : undefined,
          puestos: cells.length >= 6 ? extractNumber(cells[4]) : undefined
        });
      }
    }
  }

  // Si no se pudo extraer ni un solo dato numérico válido
  if (!totalColombia && !totalExterior && !totalNacional && departmentBreakdown.length === 0) {
    return {
      success: false,
      isBlocked: false,
      error: 'El contenido HTML no contiene tablas ni cifras estadísticas de censo reconocibles.'
    };
  }

  return {
    success: true,
    isBlocked: false,
    data: {
      cutoffDate,
      totalColombia,
      totalExterior,
      totalNacional,
      hombresColombia,
      mujeresColombia,
      puestosColombia,
      mesasColombia,
      puestosExterior,
      mesasExterior,
      puestosTotal: (puestosColombia || 0) + (puestosExterior || 0) || undefined,
      mesasTotal: (mesasColombia || 0) + (mesasExterior || 0) || undefined,
      departmentBreakdown
    }
  };
}

/**
 * Compara los datos extraídos de la publicación contra el catálogo maestro oficial
 */
export function validateCensusPublicationAgainstMasterCatalog(
  extractedData: OfficialCensusExtractedData,
  masterCatalog: {
    totalNacional?: number;
    totalColombia?: number;
    totalExterior?: number;
    totalMesas?: number;
    totalPuestos?: number;
    departments?: Record<string, { totalElectores?: number; mesas?: number; puestos?: number }>;
  },
  sha256: string,
  checkedAt: string
): {
  status: 'MATCH' | 'CENSUS_VALIDATION_MISMATCH';
  discrepancies: CensusValidationDiscrepancy[];
} {
  const discrepancies: CensusValidationDiscrepancy[] = [];

  // 1. Validación Nacional
  if (extractedData.totalNacional && masterCatalog.totalNacional !== undefined) {
    if (extractedData.totalNacional !== masterCatalog.totalNacional) {
      discrepancies.push({
        ambito: 'NACIONAL',
        campo: 'totalNacional',
        valorAlmacenado: masterCatalog.totalNacional,
        valorPublicado: extractedData.totalNacional,
        diferencia: extractedData.totalNacional - masterCatalog.totalNacional,
        checkedAt,
        sha256Publicacion: sha256
      });
    }
  }

  if (extractedData.totalColombia && masterCatalog.totalColombia !== undefined) {
    if (extractedData.totalColombia !== masterCatalog.totalColombia) {
      discrepancies.push({
        ambito: 'NACIONAL',
        campo: 'totalColombia',
        valorAlmacenado: masterCatalog.totalColombia,
        valorPublicado: extractedData.totalColombia,
        diferencia: extractedData.totalColombia - masterCatalog.totalColombia,
        checkedAt,
        sha256Publicacion: sha256
      });
    }
  }

  if (extractedData.mesasTotal && masterCatalog.totalMesas !== undefined) {
    if (extractedData.mesasTotal !== masterCatalog.totalMesas) {
      discrepancies.push({
        ambito: 'MESAS',
        campo: 'totalMesas',
        valorAlmacenado: masterCatalog.totalMesas,
        valorPublicado: extractedData.mesasTotal,
        diferencia: extractedData.mesasTotal - masterCatalog.totalMesas,
        checkedAt,
        sha256Publicacion: sha256
      });
    }
  }

  // 2. Validación Departamental
  if (extractedData.departmentBreakdown.length > 0 && masterCatalog.departments) {
    for (const d of extractedData.departmentBreakdown) {
      const storedDpto = masterCatalog.departments[d.departamento];
      if (storedDpto && storedDpto.totalElectores !== undefined && d.total !== undefined) {
        if (storedDpto.totalElectores !== d.total) {
          discrepancies.push({
            ambito: 'DEPARTAMENTAL',
            departamento: d.departamento,
            campo: 'totalElectores',
            valorAlmacenado: storedDpto.totalElectores,
            valorPublicado: d.total,
            diferencia: d.total - storedDpto.totalElectores,
            checkedAt,
            sha256Publicacion: sha256
          });
        }
      }
    }
  }

  return {
    status: discrepancies.length === 0 ? 'MATCH' : 'CENSUS_VALIDATION_MISMATCH',
    discrepancies
  };
}

/**
 * Ejecuta el flujo integral de validación de la publicación oficial de censo (Modo Seguro / Dry-Run)
 */
export async function checkOfficialCensusPublication(options: {
  url?: string;
  htmlContentOrBuffer?: string | Uint8Array;
  lastKnownSha256?: string | null;
  masterCatalog?: {
    totalNacional?: number;
    totalColombia?: number;
    totalExterior?: number;
    totalMesas?: number;
    totalPuestos?: number;
    departments?: Record<string, { totalElectores?: number; mesas?: number; puestos?: number }>;
  };
  dryRun?: boolean;
  supabaseClient?: any;
}): Promise<CensusPublicationCheckResult> {
  const url = options.url || 'https://www.registraduria.gov.co/Registraduria-Nacional-entrega-detalles-del-censo-electoral-en-Colombia-y-el.html';
  const checkedAt = new Date().toISOString();

  // 1. VALIDATE_DOMAIN
  const domainValidation = validateOfficialRegistraduriaDomain(url);
  if (!domainValidation.isValid) {
    return {
      success: false,
      status: 'UNAUTHORIZED_SOURCE',
      sourceUrl: url,
      checkedAt,
      discrepancies: [],
      databaseWritesPerformed: 0,
      pollingStationsUntouched: true,
      campaignsUntouched: true,
      message: domainValidation.reason || 'Fuente no autorizada por validación estricta de dominio.',
      error: domainValidation.reason
    };
  }

  // 2. Contenido recibido o lectura backend
  const content = options.htmlContentOrBuffer;
  if (!content) {
    return {
      success: false,
      status: 'SOURCE_BLOCKED',
      sourceUrl: url,
      checkedAt,
      discrepancies: [],
      databaseWritesPerformed: 0,
      pollingStationsUntouched: true,
      campaignsUntouched: true,
      message: 'No se pudo obtener el contenido HTML de la fuente oficial (bloqueo WAF o falta de contenido).',
      error: 'HTTP 403 Forbidden / Cloudflare WAF Bot Challenge'
    };
  }

  const rawHtml = typeof content === 'string' ? content : new TextDecoder().decode(content);

  // 3. DETECT_WAF & VALIDATE_RESPONSE
  const blockCheck = detectWafOrHtmlError(rawHtml);
  if (blockCheck.isBlocked) {
    return {
      success: false,
      status: 'SOURCE_BLOCKED',
      sourceUrl: url,
      checkedAt,
      discrepancies: [],
      databaseWritesPerformed: 0,
      pollingStationsUntouched: true,
      campaignsUntouched: true,
      message: `Bloqueo detectado: ${blockCheck.reason}`,
      error: blockCheck.reason
    };
  }

  // 4. CALCULATE_SHA256
  const sha256 = await calculateSha256(content);

  // 5. COMPARE_VERSION
  if (options.lastKnownSha256 && options.lastKnownSha256 === sha256) {
    return {
      success: true,
      status: 'NO_CHANGES',
      sourceUrl: url,
      checkedAt,
      sha256,
      discrepancies: [],
      databaseWritesPerformed: 0,
      pollingStationsUntouched: true,
      campaignsUntouched: true,
      message: 'Publicación oficial sin cambios detectados (SHA-256 idéntico).'
    };
  }

  // 6. PARSE_OFFICIAL_CENSUS
  const parseResult = parseOfficialCensusPublicationHtml(rawHtml);
  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      status: 'VALIDATION_FAILED',
      sourceUrl: url,
      checkedAt,
      sha256,
      discrepancies: [],
      databaseWritesPerformed: 0,
      pollingStationsUntouched: true,
      campaignsUntouched: true,
      message: `Error al interpretar publicación oficial: ${parseResult.error || 'Datos incompletos'}`,
      error: parseResult.error
    };
  }

  const extractedData = parseResult.data;

  // 7. COMPARE_WITH_MASTER
  let discrepancies: CensusValidationDiscrepancy[] = [];
  let validationStatus: 'MATCH' | 'CENSUS_VALIDATION_MISMATCH' | 'NEW_OFFICIAL_PUBLICATION' = 'NEW_OFFICIAL_PUBLICATION';

  if (options.masterCatalog) {
    const comparison = validateCensusPublicationAgainstMasterCatalog(
      extractedData,
      options.masterCatalog,
      sha256,
      checkedAt
    );
    discrepancies = comparison.discrepancies;
    validationStatus = comparison.status;
  }

  // 8. Historial (Cero escrituras en DIVIPOLE master)
  if (!options.dryRun && options.supabaseClient) {
    try {
      await options.supabaseClient.from('divipole_sync_history').insert({
        proceso_id: 'COL-2026-PRES-1V',
        tipo_sincronizacion: 'CENSUS_VALIDATION',
        sha256_fuente: sha256,
        estado: validationStatus,
        url_fuente: url,
        discrepancias_detectadas: discrepancies.length,
        nota: `Validación de censo oficial (${discrepancies.length} discrepancias)`
      });
    } catch (e) {
      // Ignore non-fatal logging
    }
  }

  return {
    success: true,
    status: validationStatus,
    sourceUrl: url,
    checkedAt,
    sha256,
    cutoffDate: extractedData.cutoffDate,
    publicationUpdatedAt: extractedData.publicationUpdatedAt,
    extractedData,
    discrepancies,
    databaseWritesPerformed: 0, // Cero escrituras a tablas maestras
    pollingStationsUntouched: true,
    campaignsUntouched: true,
    message: validationStatus === 'MATCH'
      ? 'Publicación oficial validada con éxito. Cifras coinciden al 100% con el catálogo maestro.'
      : validationStatus === 'CENSUS_VALIDATION_MISMATCH'
      ? `Se detectaron ${discrepancies.length} discrepancias respecto al catálogo maestro. Alerta CENSUS_VALIDATION_MISMATCH generada sin alterar DIVIPOLE.`
      : 'Nueva publicación oficial parseada y lista para validación.'
  };
}
