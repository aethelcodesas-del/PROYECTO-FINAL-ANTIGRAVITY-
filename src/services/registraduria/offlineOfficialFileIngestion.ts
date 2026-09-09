/**
 * SERVICIO DE INGESTA CONTROLADA DE ARCHIVOS OFICIALES DESCARGADOS MANUALMENTE (FASE 11)
 * Archivo: src/services/registraduria/offlineOfficialFileIngestion.ts
 * 
 * Canal Oficial: OFFLINE OFFICIAL FILE INGESTION
 * 
 * Flujo:
 * 1. Usuario autorizado descarga el documento directamente desde Registraduría (evitando bloqueos WAF de forma legítima e interactiva).
 * 2. Entrega del archivo binario / contenido oficial al pipeline de ingesta.
 * 3. Cálculo inmutable e independiente de SHA-256 (nunca se confía en un hash manual).
 * 4. Verificación estricta de autenticidad (firma %PDF-, detección de HTML/WAF de error, tamaño mínimo).
 * 5. Extracción y normalización de entidades oficiales DIVIPOLE.
 * 6. Control de completitud y plausibilidad de cobertura nacional.
 * 7. Ejecución de DRY-RUN con CERO escrituras sobre polling_stations ni tablas operativas.
 * 8. Preparación para Staging seguro sin activar sincronizaciones automáticas desatendidas.
 */

import {
  ElectoralProcessConfig,
  OfficialAdapterResult
} from './types';
import { calculateSha256 } from './sha256';
import { processOfficialPdfDivipole, validatePdfBinaryHeader } from './pdfDivipoleAdapter';
import { executeNationalDivipoleBatchLoad, NationalLoadExecutionSummary } from './nationalDivipoleStagingService';
import { getOfficialProcessSource } from './processRegistry';

export interface OfflineIngestionPayloadInput {
  processId: string;
  sourceOriginUrl: string;
  obtainedAt: string;
  fileName?: string;
  mimeType?: string;
  fileBufferOrContent: Uint8Array | ArrayBuffer | string;
  notes?: string;
}

export interface OfflineIngestionValidationResult {
  isValid: boolean;
  status: 'VALID' | 'INVALID' | 'WAF_HTML_ERROR' | 'EMPTY_FILE' | 'UNSUPPORTED_FORMAT';
  fileName?: string;
  mimeType: string;
  fileExtension: string;
  obtainedAt: string;
  sha256: string;
  fileSizeBytes: number;
  isAuthenticPdf: boolean;
  isWafOrHtmlError: boolean;
  processConfig: ElectoralProcessConfig;
  adapterResult?: OfficialAdapterResult;
  nationalSummary?: NationalLoadExecutionSummary;
  errors: string[];
  warnings: string[];
}

/**
 * Valida e ingesta un archivo oficial de la Registraduría obtenido legítimamente
 */
export async function ingestOfflineOfficialFile(
  input: OfflineIngestionPayloadInput,
  options: {
    dryRun?: boolean;
    requireNationalCoverage?: boolean;
    supabaseClient?: any;
  } = { dryRun: true, requireNationalCoverage: false }
): Promise<OfflineIngestionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sourceDef = getOfficialProcessSource(input.processId);
  const processConfig = sourceDef.processConfig;

  // Inferir o extraer extensión y MIME
  const fileName = input.fileName || 'divipole_oficial.pdf';
  const fileExtension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || 'pdf' : 'pdf';
  const mimeType = input.mimeType || (fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream');
  const obtainedAt = input.obtainedAt || new Date().toISOString();

  // 1. Determinar tamaño del archivo
  let fileSizeBytes = 0;
  if (typeof input.fileBufferOrContent === 'string') {
    fileSizeBytes = new TextEncoder().encode(input.fileBufferOrContent).length;
  } else if (input.fileBufferOrContent instanceof Uint8Array) {
    fileSizeBytes = input.fileBufferOrContent.byteLength;
  } else if (input.fileBufferOrContent instanceof ArrayBuffer) {
    fileSizeBytes = input.fileBufferOrContent.byteLength;
  }

  if (fileSizeBytes === 0) {
    return {
      isValid: false,
      status: 'EMPTY_FILE',
      fileName,
      mimeType,
      fileExtension,
      obtainedAt,
      sha256: 'EMPTY_FILE',
      fileSizeBytes: 0,
      isAuthenticPdf: false,
      isWafOrHtmlError: false,
      processConfig,
      errors: ['El archivo proporcionado está completamente vacío (0 bytes).'],
      warnings: []
    };
  }

  // 2. Cálculo inmutable e independiente del hash SHA-256
  const sha256 = await calculateSha256(input.fileBufferOrContent);

  // 3. Verificación de Autenticidad Binaria y Detección de Bloqueos HTML/WAF
  const binaryCheck = validatePdfBinaryHeader(input.fileBufferOrContent);
  if (!binaryCheck.isValidPdf) {
    const isWaf = binaryCheck.isHtml || false;
    if (isWaf) {
      errors.push('El archivo entregado no es un PDF auténtico; corresponde a una página HTML de bloqueo, desafío WAF o error HTTP 403.');
    } else {
      errors.push(binaryCheck.reason || 'El archivo carece de la firma binaria requerida de un documento PDF oficial.');
    }

    return {
      isValid: false,
      status: isWaf ? 'WAF_HTML_ERROR' : 'UNSUPPORTED_FORMAT',
      fileName,
      mimeType: isWaf ? 'text/html' : mimeType,
      fileExtension,
      obtainedAt,
      sha256,
      fileSizeBytes,
      isAuthenticPdf: false,
      isWafOrHtmlError: isWaf,
      processConfig,
      errors,
      warnings
    };
  }

  // 4. Extracción y Normalización de Entidades DIVIPOLE
  const adapterResult = await processOfficialPdfDivipole(
    input.fileBufferOrContent,
    input.sourceOriginUrl,
    processConfig,
    { dryRun: options.dryRun ?? true }
  );

  if (!adapterResult.success) {
    errors.push(adapterResult.rawErrorMessage || 'No fue posible estructurar registros válidos desde el documento oficial.');
    return {
      isValid: false,
      status: 'INVALID',
      fileName,
      mimeType,
      fileExtension,
      obtainedAt,
      sha256,
      fileSizeBytes,
      isAuthenticPdf: true,
      isWafOrHtmlError: false,
      processConfig,
      adapterResult,
      errors,
      warnings: adapterResult.validation.advertencias
    };
  }

  // 5. Control de Cobertura Nacional y Ejecución en DRY-RUN o Carga Real
  const nationalSummary = await executeNationalDivipoleBatchLoad(adapterResult, {
    dryRun: options.dryRun ?? true,
    strictPlausibilityCheck: options.requireNationalCoverage ?? false,
    supabaseClient: options.supabaseClient
  });

  if (!nationalSummary.success) {
    if (nationalSummary.status === 'SOURCE_EXTRACTION_INCOMPLETE') {
      warnings.push(`El archivo contiene una muestra parcial (${nationalSummary.totalDepartments} dptos, ${nationalSummary.totalMunicipalities} mpios). No constituye aún la totalidad del país.`);
    } else {
      errors.push(nationalSummary.error || 'Error durante la validación de lotes nacionales.');
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    status: isValid ? 'VALID' : 'INVALID',
    fileName,
    mimeType,
    fileExtension,
    obtainedAt,
    sha256,
    fileSizeBytes,
    isAuthenticPdf: true,
    isWafOrHtmlError: false,
    processConfig,
    adapterResult,
    nationalSummary,
    errors,
    warnings
  };
}
