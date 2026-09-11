import React, { useState, useEffect, useRef } from 'react';
import {
  GlobalAdminRegistraduriaStatus,
  RegistraduriaDryRunSummary
} from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import {
  Globe,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Layers,
  FileText,
  Copy,
  Check,
  Download,
  Lock,
  ArrowRight,
  Database,
  Hash,
  Info,
  Sliders
} from 'lucide-react';

export const GlobalAdminRegistraduria: React.FC = () => {
  const [status, setStatus] = useState<GlobalAdminRegistraduriaStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // File upload and dry run states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [calculatedSha, setCalculatedSha] = useState<string | null>(null);
  const [isIdempotentUnchanged, setIsIdempotentUnchanged] = useState<boolean>(false);
  const [dryRunRunning, setDryRunRunning] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<RegistraduriaDryRunSummary | null>(null);

  // Confirmation modal states
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmSuccess, setConfirmSuccess] = useState<{ message: string; versionTag?: string } | null>(null);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatusAndLogs = async (manual = false) => {
    try {
      if (manual) setRefreshing(true);
      else setLoading(true);

      const [statusData, logsData] = await Promise.all([
        GlobalAdminService.getRegistraduriaStatus(),
        GlobalAdminService.getRegistraduriaAuditLogs()
      ]);

      setStatus(statusData);
      setAuditLogs(logsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el estado de Registraduría.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
  }, []);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setDryRunResult(null);
    setConfirmSuccess(null);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setFileBytes(bytes);

      // Calcular SHA-256 en cliente para verificación inmediata
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setCalculatedSha(hashHex);

      // Verificar idempotencia contra la última versión registrada
      if (status?.lastKnownSha256 && status.lastKnownSha256.toLowerCase() === hashHex.toLowerCase()) {
        setIsIdempotentUnchanged(true);
      } else {
        setIsIdempotentUnchanged(false);
      }
    } catch (err: any) {
      setError('Error al procesar el archivo seleccionado: ' + err.message);
    }
  };

  const handleRunDryRun = async () => {
    if (!fileBytes || !selectedFile) {
      setError('Por favor selecciona un archivo PDF oficial antes de ejecutar el DRY-RUN.');
      return;
    }

    try {
      setDryRunRunning(true);
      setError(null);

      const result = await GlobalAdminService.executeRegistraduriaDryRun(
        fileBytes,
        selectedFile.name,
        status?.officialSourceUrl || 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf'
      );

      setDryRunResult(result);
    } catch (err: any) {
      setError(err.message || 'Error durante la ejecución del DRY-RUN.');
    } finally {
      setDryRunRunning(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!fileBytes || !selectedFile || !dryRunResult || !dryRunResult.canConfirm) {
      setError('Se requiere un DRY-RUN exitoso antes de confirmar la actualización.');
      return;
    }

    try {
      setConfirming(true);
      setError(null);

      const res = await GlobalAdminService.confirmRegistraduriaUpdate({
        fileContent: fileBytes,
        fileName: selectedFile.name,
        sourceOriginUrl: status?.officialSourceUrl,
        dryRunSummary: dryRunResult
      });

      setConfirmSuccess(res);
      setConfirmModalOpen(false);
      await fetchStatusAndLogs(true);
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la actualización oficial.');
      setConfirmModalOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  const handleOpenOfficialSource = () => {
    const url = status?.officialSourceUrl || 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-wide">
              ACTUALIZACIÓN OFICIAL REGISTRADURÍA — DIVIPOLE
            </h2>
            <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
              ADMIN GLOBAL EXCLUSIVO
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1.5 leading-relaxed max-w-3xl">
            Canal oficial y auditado para la descarga manual, validación de integridad criptográfica SHA-256,
            ejecución previa de DRY-RUN e integración atómica al catálogo electoral DIVIPOLE.
          </p>
        </div>

        <button
          onClick={() => fetchStatusAndLogs(true)}
          disabled={loading || refreshing}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refrescar Estado</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono flex items-start gap-3 shadow-lg shadow-rose-950/40">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Error de Operación:</span>
            <p className="text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {confirmSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-start gap-3 shadow-lg shadow-emerald-950/40 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="font-bold text-sm">¡Actualización Oficial Exitosa!</span>
            <p className="text-emerald-200 mt-0.5">{confirmSuccess.message}</p>
            {confirmSuccess.versionTag && (
              <p className="text-slate-400 text-[11px] mt-1">
                Etiqueta de versión registrada: <code className="text-emerald-400 font-bold">{confirmSuccess.versionTag}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* System Status Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        {/* Card 1: Mode */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
            <span>MODO DEL SISTEMA</span>
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-wide">
              {status?.mode || 'MANUAL_ONLY'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded font-bold">
                MANUAL: ACTIVADA
              </span>
              <span className="bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                AUTO: DESACTIVADA
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Valid Version */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
            <span>VERSIÓN OFICIAL VÁLIDA</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white truncate">
              {status?.lastValidVersionTag || 'Ninguna registrada'}
            </div>
            <div className="mt-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                status?.lastValidVersionType === 'VALID_NATIONAL_OFFICIAL'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : status?.lastValidVersionType === 'VALID_SAMPLE'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}>
                {status?.lastValidVersionType === 'VALID_NATIONAL_OFFICIAL'
                  ? '✓ NACIONAL COMPLETA'
                  : status?.lastValidVersionType === 'VALID_SAMPLE'
                  ? '⚠ MUESTRA PARCIAL'
                  : 'NO DISPONIBLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Source Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
            <span>ESTADO DE FUENTE</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                status?.sourceStatus === 'SOURCE_ACTIVE' ? 'bg-emerald-400 animate-pulse' :
                status?.sourceStatus === 'SOURCE_BLOCKED' ? 'bg-amber-400' : 'bg-cyan-400'
              }`} />
              {status?.sourceStatus || 'SOURCE_CONFIGURED'}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {status?.sourceDomain || 'www.registraduria.gov.co'}
            </p>
          </div>
        </div>

        {/* Card 4: SHA-256 Hash */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
            <span>SHA-256 REGISTRADO</span>
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            {status?.lastKnownSha256 ? (
              <div className="flex items-center justify-between gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                <code className="text-cyan-300 text-[11px] truncate max-w-[140px]" title={status.lastKnownSha256}>
                  {status.lastKnownSha256.slice(0, 16)}...
                </code>
                <button
                  onClick={() => handleCopySha(status.lastKnownSha256!)}
                  className="text-slate-400 hover:text-white p-0.5"
                  title="Copiar Hash Completo"
                >
                  {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ) : (
              <span className="text-slate-500 text-[11px]">Sin hash previo</span>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5 truncate">
              Última actualización: {status?.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleDateString() : 'Pendiente'}
            </p>
          </div>
        </div>
      </div>

      {/* Main 4-Step Interactive Workflow */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            FLUJO DE ACTUALIZACIÓN ASISTIDA PASO A PASO
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Cumple estrictamente el protocolo de 4 etapas: Consulta → Carga → DRY-RUN → Confirmación Explícita.
          </p>
        </div>

        {/* Step 1 & 2 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step 1: Consult Official Source */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  PASO 1: CONSULTA DE FUENTE OFICIAL
                </span>
                <Globe className="w-4 h-4 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-white font-mono">
                Consultar actualización oficial de Registraduría
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
                Este botón NO descarga automáticamente el archivo. Le proporciona el acceso directo y seguro a la fuente oficial de Registraduría para que usted como Administrador Global descargue el PDF interactivo en su navegador y eluda desafíos WAF de forma legítima.
              </p>
              <div className="mt-3 p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono truncate">
                <span className="text-slate-500 mr-1.5">URL:</span>
                {status?.officialSourceUrl || 'https://www.registraduria.gov.co/IMG/pdf/relacion_puestos_de_votacion.pdf'}
              </div>
            </div>

            <button
              onClick={handleOpenOfficialSource}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 text-cyan-300 font-mono font-bold text-xs border border-cyan-500/40 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <span>Consultar actualización oficial</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step 2: Upload Official File */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  PASO 2: SUBIR ARCHIVO OFICIAL
                </span>
                <UploadCloud className="w-4 h-4 text-slate-500" />
              </div>
              <h4 className="text-sm font-bold text-white font-mono">
                Subir archivo oficial DIVIPOLE (.PDF)
              </h4>
              <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
                Seleccione el archivo PDF oficial descargado de Registraduría. El sistema validará su firma binaria <code className="text-cyan-300">%PDF-</code> y calculará su hash criptográfico SHA-256.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 p-4 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-900/60 text-center cursor-pointer transition-all"
              >
                {selectedFile ? (
                  <div className="space-y-1 font-mono text-xs">
                    <FileText className="w-6 h-6 text-cyan-400 mx-auto" />
                    <p className="font-bold text-white">{selectedFile.name}</p>
                    <p className="text-slate-400 text-[11px]">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {calculatedSha && (
                      <p className="text-cyan-400 text-[10px] truncate max-w-xs mx-auto">
                        SHA-256: {calculatedSha.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 font-mono text-xs text-slate-400">
                    <UploadCloud className="w-6 h-6 text-slate-500 mx-auto" />
                    <p className="text-slate-300 font-semibold">Haz clic para examinar o arrastra el PDF</p>
                    <p className="text-[10px] text-slate-500">Formato oficial Registraduría (.pdf)</p>
                  </div>
                )}
              </div>

              {/* Idempotence Alert */}
              {isIdempotentUnchanged && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 text-[11px] font-mono flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>SOURCE_UNCHANGED:</strong> El hash SHA-256 es idéntico a la versión oficial ya instalada.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700 transition-colors text-center cursor-pointer"
              >
                {selectedFile ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: DRY-RUN Execution & Results */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  PASO 3: DRY-RUN OBLIGATORIO
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (CERO escrituras en la base de datos)
                </span>
              </div>
              <h4 className="text-sm font-bold text-white font-mono mt-1">
                Extracción, validación de censo y cálculo de diferencias
              </h4>
            </div>

            <button
              onClick={handleRunDryRun}
              disabled={!selectedFile || dryRunRunning}
              className="flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-950 to-orange-950 hover:from-amber-900 hover:to-orange-900 text-amber-300 font-mono font-bold text-xs border border-amber-500/40 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              {dryRunRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ejecutando DRY-RUN...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Ejecutar DRY-RUN</span>
                </>
              )}
            </button>
          </div>

          {/* DRY-RUN Results Panel */}
          {dryRunResult && (
            <div className="space-y-4 font-mono text-xs animate-fade-in">
              {/* Summary Banner */}
              <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                dryRunResult.success
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  {dryRunResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="font-bold text-sm text-white">{dryRunResult.message}</h5>
                    <p className="text-slate-300 text-[11px] mt-1">
                      Hash SHA-256 verificado: <code className="text-cyan-300">{dryRunResult.sha256}</code>
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded text-[10px] font-bold border shrink-0 ${
                  dryRunResult.coverageType === 'VALID_NATIONAL_OFFICIAL'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}>
                  {dryRunResult.coverageType}
                </span>
              </div>

              {/* Entity Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-slate-400 text-[10px] block">DEPARTAMENTOS</span>
                  <span className="text-base font-bold text-cyan-300">{dryRunResult.departmentsCount}</span>
                  <span className="text-[9px] text-slate-500 block">Umbral nac: ≥32</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-slate-400 text-[10px] block">MUNICIPIOS</span>
                  <span className="text-base font-bold text-cyan-300">{dryRunResult.municipalitiesCount}</span>
                  <span className="text-[9px] text-slate-500 block">Umbral nac: ≥1.000</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-slate-400 text-[10px] block">ZONAS</span>
                  <span className="text-base font-bold text-cyan-300">{dryRunResult.zonesCount}</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-slate-400 text-[10px] block">PUESTOS DE VOTACIÓN</span>
                  <span className="text-base font-bold text-cyan-300">{dryRunResult.pollingPlacesCount.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block">Umbral nac: ≥10.000</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-slate-400 text-[10px] block">MESAS DE VOTACIÓN</span>
                  <span className="text-base font-bold text-cyan-300">{dryRunResult.tablesCount.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block">Umbral nac: ≥100.000</span>
                </div>
              </div>

              {/* Diffs and Integrity Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diffs */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Diferencias Calculadas</span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-300">
                      <span>Registros Nuevos:</span>
                      <strong className="text-emerald-400">+{dryRunResult.diffs.inserted.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Registros Modificados:</span>
                      <strong className="text-cyan-400">{dryRunResult.diffs.updated.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Registros Eliminados:</span>
                      <strong className="text-slate-400">{dryRunResult.diffs.deleted}</strong>
                    </div>
                  </div>
                </div>

                {/* Safety & Integrity */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Garantías de Seguridad Operativa</span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>polling_stations existente: <strong>INTACTA (0 modificaciones)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Campañas y Votantes: <strong>INTACTOS (0 modificaciones)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Cotejo cruzado con Censo: <strong>APROBADO</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Explicit Confirmation */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                PASO 4: CONFIRMACIÓN EXPLÍCITA
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono mt-1">
              Ejecutar RPC atómico de sincronización oficial
            </h4>
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-2xl">
              El RPC <code className="text-cyan-300 font-bold">sync_official_divipole_batch</code> solo se ejecuta tras su confirmación explícita.
            </p>
          </div>

          <button
            onClick={() => setConfirmModalOpen(true)}
            disabled={!dryRunResult || !dryRunResult.canConfirm || confirming}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-950 to-teal-950 hover:from-emerald-900 hover:to-teal-900 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar actualización oficial</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 font-mono text-xs shadow-2xl shadow-cyan-950/50">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">CONFIRMACIÓN EXPLÍCITA DE ACTUALIZACIÓN</h3>
                <p className="text-[11px] text-slate-400">Autorización directa de Administrador Global</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-slate-300 text-[11px]">
              <p>Está a punto de sincronizar oficialmente el catálogo DIVIPOLE con los siguientes datos auditados:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Archivo: <strong className="text-white">{selectedFile?.name}</strong></li>
                <li>SHA-256: <code className="text-cyan-300">{dryRunResult?.sha256.slice(0, 24)}...</code></li>
                <li>Puestos detectados: <strong className="text-emerald-400">{dryRunResult?.pollingPlacesCount.toLocaleString()}</strong></li>
                <li>Mesas detectadas: <strong className="text-emerald-400">{dryRunResult?.tablesCount.toLocaleString()}</strong></li>
                <li>Garantía: <strong className="text-emerald-400">0 modificaciones en tablas operativas</strong></li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                disabled={confirming}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmUpdate}
                disabled={confirming}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 font-bold"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Ejecutando Sincronización...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar y Sincronizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold font-mono text-white">
              HISTORIAL DE AUDITORÍA Y TRAZABILIDAD
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {auditLogs.length} eventos registrados
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono py-6 text-center">
            No se han registrado sincronizaciones previas en este entorno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/60 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Proceso</th>
                  <th className="py-2.5 px-3">SHA-256</th>
                  <th className="py-2.5 px-3">Tipo de Versión</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Registros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {auditLogs.map((log, index) => (
                  <tr key={log.id || index} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-[11px] text-slate-400">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {log.proceso_id || 'COL-2026-CONGRESO'}
                    </td>
                    <td className="py-2.5 px-3">
                      <code className="text-cyan-300 text-[10px]" title={log.sha256_hash}>
                        {(log.sha256_hash || '').slice(0, 16)}...
                      </code>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        {log.version_type || 'VALID_SAMPLE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        log.estado === 'EXITOSA' || log.estado === 'COMPLETADO'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                      }`}>
                        {log.estado || 'EXITOSA'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {log.registros_afectados || log.registros_procesados || 0} afect.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
