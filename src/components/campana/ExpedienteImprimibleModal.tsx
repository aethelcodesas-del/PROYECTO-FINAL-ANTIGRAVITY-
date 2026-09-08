import React from 'react';
import { CampanaDossier } from '../../types/campana';
import { 
  Printer, 
  X, 
  Building2, 
  User, 
  Award, 
  Calendar, 
  Briefcase, 
  Users, 
  ShieldCheck, 
  FileCheck, 
  Clock, 
  Landmark, 
  CreditCard,
  FileSignature,
  FileText
} from 'lucide-react';

interface ExpedienteImprimibleModalProps {
  dossier: CampanaDossier;
  isOpen: boolean;
  onClose: () => void;
}

export const ExpedienteImprimibleModal: React.FC<ExpedienteImprimibleModalProps> = ({
  dossier,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  // Format Helper: guarantees real data or 'Información pendiente' without mock or fake strings
  const formatData = (value: any, fallback: string = 'Información pendiente'): string => {
    if (value === null || value === undefined) return fallback;
    const str = String(value).trim();
    if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'no registrado' || str.toLowerCase() === 'sin asignar' || str.toLowerCase() === 'sin banco') {
      return fallback;
    }
    return str;
  };

  const generationTimestamp = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());

  const handlePrintPDF = () => {
    if (!dossier.nombreCandidato?.trim() || !dossier.cedulaCandidato?.trim()) {
      alert('No es posible generar el expediente PDF sin antes registrar la información básica obligatoria del candidato (Nombre y Cédula).');
      return;
    }
    window.print();
  };

  // Dynamic legal spending limit from campaign configuration (eliminating any demo or hardcoded values)
  const rawLimit = dossier.topeLegalCNE ?? dossier.presupuesto_total ?? dossier.legalSpendingLimit ?? null;
  const hasValidLimit = typeof rawLimit === 'number' && rawLimit > 0 && !isNaN(rawLimit);
  const formattedLimit = hasValidLimit
    ? `$${rawLimit.toLocaleString('es-CO')} COP`
    : 'Pendiente de configuración';

  const candidateFullName = formatData(dossier.nombreCandidato, 'Información pendiente');
  const candidateStatus = dossier.nombreCandidato?.trim() && dossier.cedulaCandidato?.trim() 
    ? 'Expediente Oficial Registrado' 
    : 'Información pendiente';

  const jurisdictionDisplay = dossier.circunscripcionTerritorial === 'Departamento'
    ? `Departamento de ${formatData(dossier.departamento)}`
    : `Municipio de ${formatData(dossier.municipio)} (${formatData(dossier.departamento)})`;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Print Styles for clean, high-contrast, official paper/PDF rendering */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 12mm 15mm 12mm 15mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-dossier-root, #printable-dossier-root * {
            visibility: visible;
          }
          #printable-dossier-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9.5pt !important;
            line-height: 1.35 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-section {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 12px !important;
            border-radius: 6px !important;
          }
          .print-header-bar {
            background: #f1f5f9 !important;
            border-bottom: 1.5px solid #94a3b8 !important;
            color: #0f172a !important;
            padding: 6px 10px !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-text-muted {
            color: #475569 !important;
          }
          .print-badge {
            background: #f8fafc !important;
            color: #0f172a !important;
            border: 1px solid #94a3b8 !important;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th, .print-table td {
            border: 1px solid #e2e8f0 !important;
            padding: 4px 8px !important;
            font-size: 8.5pt !important;
          }
          .print-table th {
            background: #f8fafc !important;
            color: #1e293b !important;
          }
        }
      `}</style>

      <div className="bg-[#030e21] rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-5 text-white max-h-[92vh] overflow-y-auto">
        
        {/* Top Floating Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/30 shrink-0">
              <FileCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">
                Expediente Oficial de Campaña (Informe Ejecutivo en PDF)
              </h3>
              <p className="text-[11px] text-slate-400">
                Estructura jurídica oficial consolidada para radicación ante autoridades electorales (CNE / Registraduría)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Generar / Imprimir PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#081f3d] text-slate-400 hover:text-white cursor-pointer ml-1"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area Container */}
        <div id="printable-dossier-root" className="bg-[#020712] p-4 sm:p-7 rounded-2xl border border-cyan-500/20 space-y-5 text-xs text-slate-200">
          
          {/* ========================================================================= */}
          {/* PORTADA INSTITUCIONAL & ENCABEZADO OFICIAL */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#030f24] rounded-xl border border-cyan-500/30 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 print-text-dark block">
                    REPÚBLICA DE COLOMBIA • SISTEMA ELECTORAL NACIONAL
                  </span>
                  <h1 className="text-sm sm:text-base font-black text-white print-text-dark">
                    EXPEDIENTE OFICIAL DE CANDIDATURA & INFORME EJECUTIVO DE CAMPAÑA
                  </h1>
                  <span className="text-[10px] text-slate-400 print-text-muted">
                    Conforme a la Ley Estatutaria 1475 de 2011, Ley 136 de 1994 y Resoluciones CNE
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0 bg-[#020712] print-badge px-3 py-1.5 rounded-lg border border-cyan-500/20 text-[10px]">
                <span className="text-slate-400 print-text-muted block">Expediente No.</span>
                <span className="font-mono font-bold text-amber-300 print-text-dark">{formatData(dossier.id)}</span>
              </div>
            </div>

            {/* Candidate Header Profile Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="flex justify-center md:justify-start">
                {dossier.fotoUrl ? (
                  <img
                    src={dossier.fotoUrl}
                    alt={candidateFullName}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-cyan-400/40 shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#051833] border border-cyan-400/40 flex flex-col items-center justify-center text-slate-400 shrink-0 shadow-md">
                    <User className="w-10 h-10 text-slate-400" />
                    <span className="text-[9px] text-slate-500 mt-1">Sin fotografía</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-extrabold uppercase">
                    {candidateStatus}
                  </span>
                  <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-bold">
                    Elección {formatData(dossier.tipoProcesoEleccion)}
                  </span>
                </div>

                <h2 className="text-lg sm:text-2xl font-black text-white print-text-dark">
                  {candidateFullName}
                </h2>
                
                <p className="text-slate-300 print-text-dark font-medium text-xs">
                  Candidatura Oficial a la <strong>{formatData(dossier.corporacion)}</strong> • {jurisdictionDisplay}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Cédula de Ciudadanía:</span>
                    <strong className="font-mono text-white print-text-dark">{formatData(dossier.cedulaCandidato)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Fecha Elecciones (Día E):</span>
                    <strong className="font-mono text-amber-300 print-text-dark">{formatData(dossier.fechaEleccion)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Tope Legal CNE (Campaña Actual):</span>
                    <strong className={`font-mono ${hasValidLimit ? 'text-emerald-400' : 'text-slate-400 italic'} print-text-dark`}>
                      {formattedLimit}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 1: INFORMACIÓN ELECTORAL & PARÁMETROS TERRITORIALES */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                Capítulo I: Información Electoral & Parámetros Territoriales
              </h3>
            </div>
            <div className="p-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Corporación / Cargo:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.corporacion)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Circunscripción:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.circunscripcionTerritorial)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Departamento:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.departamento)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Municipio / Distrito:</span>
                  <strong className="text-white print-text-dark">
                    {formatData(dossier.municipio || (dossier.circunscripcionTerritorial === 'Departamento' ? 'Ámbito Departamental' : ''))}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Tipo de Proceso:</span>
                  <strong className="text-white print-text-dark">Elección {formatData(dossier.tipoProcesoEleccion)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Modalidad de Candidatura:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.modalidadCandidatura)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Posición en Tarjetón:</span>
                  <strong className="text-amber-300 print-text-dark font-mono">{formatData(dossier.posicionTarjeton)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Fecha de Votación:</span>
                  <strong className="text-white print-text-dark font-mono">{formatData(dossier.fechaEleccion)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 2: FICHA TÉCNICA DEL CANDIDATO */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                Capítulo II: Ficha Técnica & Datos del Candidato
              </h3>
            </div>
            <div className="p-3.5 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Nombre Completo:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.nombreCandidato)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Cédula de Ciudadanía:</span>
                  <strong className="text-white print-text-dark font-mono">{formatData(dossier.cedulaCandidato)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Nombre Político / Tarjetón:</span>
                  <strong className="text-cyan-300 print-text-dark">{formatData(dossier.seudonimoPolitico)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Profesión / Formación:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.profesionCandidato)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Teléfono Directo / WhatsApp:</span>
                  <strong className="text-white print-text-dark font-mono">{formatData(dossier.telefonoCandidato)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Correo Electrónico Oficial:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.emailCandidato)}</strong>
                </div>
              </div>

              {dossier.resumenVida?.trim() && (
                <div className="bg-[#020712] print-badge p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-0.5">
                  <span className="text-slate-400 print-text-muted font-bold block uppercase">Resumen de Hoja de Vida & Perfil Político:</span>
                  <p className="text-slate-300 print-text-dark leading-relaxed">
                    {dossier.resumenVida.trim()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 3 & 4: RESPALDO POLÍTICO, CALENDARIO & PÓLIZA */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 3. Respaldo Político & Aval */}
            <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
              <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                  Capítulo III: Respaldo Político & Aval CNE
                </h3>
              </div>
              <div className="p-3.5 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Modalidad de Respaldo:</span>
                  <strong className="text-emerald-400 print-text-dark font-bold">{formatData(dossier.modalidadAval)}</strong>
                </div>
                {dossier.modalidadAval === 'Partido' && (
                  <>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Partido Avalista con Personería:</span>
                      <strong className="text-white print-text-dark">{formatData(dossier.partidoUnico)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Número de Aval CNE:</span>
                      <strong className="text-cyan-300 print-text-dark font-mono">{formatData(dossier.numeroAvalCNE)}</strong>
                    </div>
                  </>
                )}
                {dossier.modalidadAval === 'Firmas' && (
                  <>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Grupo Significativo de Ciudadanos:</span>
                      <strong className="text-white print-text-dark">{formatData(dossier.nombreGrupoFirmas)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Radicado Registraduría:</span>
                      <strong className="text-cyan-300 print-text-dark font-mono">{formatData(dossier.radicadoRegistraduria)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Meta de Firmas Validadas:</span>
                      <strong className="text-white print-text-dark font-mono">
                        {dossier.metaFirmas ? `${Number(dossier.metaFirmas).toLocaleString('es-CO')} firmas` : 'Información pendiente'}
                      </strong>
                    </div>
                  </>
                )}
                {dossier.modalidadAval === 'Coalición' && (
                  <>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Nombre Oficial de Coalición:</span>
                      <strong className="text-white print-text-dark">{formatData(dossier.nombreCoalicion)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Partidos Miembros de la Coalición:</span>
                      <strong className="text-cyan-300 print-text-dark">
                        {dossier.partidosCoalicion && dossier.partidosCoalicion.length > 0 ? dossier.partidosCoalicion.join(', ') : 'Información pendiente'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted block text-[10px]">Partido Responsable ante CNE:</span>
                      <strong className="text-emerald-400 print-text-dark font-bold">{formatData(dossier.partidoResponsableCNE)}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 4. Calendario & Póliza */}
            <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
              <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                  Capítulo IV: Calendario & Póliza de Seriedad
                </h3>
              </div>
              <div className="p-3.5 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Apertura de Mesas:</span>
                    <strong className="text-white print-text-dark font-mono">{formatData(dossier.horaApertura ? `${dossier.horaApertura} AM` : '')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Cierre de Mesas:</span>
                    <strong className="text-white print-text-dark font-mono">{formatData(dossier.horaCierre ? `${dossier.horaCierre} PM` : '')}</strong>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Número de Póliza de Seriedad:</span>
                  <strong className="text-amber-300 print-text-dark font-mono">{formatData(dossier.polizaNumero)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Compañía Aseguradora Emisora:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.aseguradora)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 5: EQUIPO OFICIAL DE CAMPAÑA (LEY 1475 DE 2011) */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                  Capítulo V: Equipo Directivo Oficial de Campaña (Ley 1475/2011)
                </h3>
              </span>
              <span className="text-[10px] text-emerald-400 print-text-dark font-bold bg-emerald-500/20 print-badge px-2 py-0.5 rounded border border-emerald-500/30">
                Auditoría CNE
              </span>
            </div>
            
            <div className="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 print-text-muted block font-bold text-[10px] uppercase">Gerente de Campaña</span>
                <strong className="text-white print-text-dark block text-xs">{formatData(dossier.equipo?.gerenteNombre)}</strong>
                <span className="text-slate-400 print-text-muted text-[10px] block font-mono">CC: {formatData(dossier.equipo?.gerenteCedula)}</span>
                <span className="text-cyan-300 print-text-dark text-[10px] block font-mono">Reg CNE: {formatData(dossier.equipo?.gerenteRegistroCNE)}</span>
              </div>

              <div className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 print-text-muted block font-bold text-[10px] uppercase">Contador Público Oficial</span>
                <strong className="text-white print-text-dark block text-xs">{formatData(dossier.equipo?.contadorNombre)}</strong>
                <span className="text-slate-400 print-text-muted text-[10px] block font-mono">CC: {formatData(dossier.equipo?.contadorCedula)}</span>
                <span className="text-emerald-400 print-text-dark text-[10px] block font-mono font-bold">TP: {formatData(dossier.equipo?.contadorTarjetaProfesional)}</span>
              </div>

              <div className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-500 print-text-muted block font-bold text-[10px] uppercase">Auditor Interno de Campaña</span>
                <strong className="text-white print-text-dark block text-xs">{formatData(dossier.equipo?.auditorNombre)}</strong>
                <span className="text-slate-400 print-text-muted text-[10px] block font-mono">CC: {formatData(dossier.equipo?.auditorCedula)}</span>
                <span className="text-cyan-300 print-text-dark text-[10px] block font-mono">TP: {formatData(dossier.equipo?.auditorTarjetaProfesional)}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 6: INFORMACIÓN FINANCIERA & CUENTA BANCARIA ÚNICA */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                Capítulo VI: Información Financiera & Cuenta Bancaria Única CNE
              </h3>
            </div>
            
            <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-slate-500 print-text-muted block font-bold text-[10px] uppercase flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> Datos Bancarios Registrados
                </span>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Entidad Financiera:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.equipo?.bancoNombre)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Tipo y Número de Cuenta:</span>
                  <strong className="text-amber-300 print-text-dark font-mono">
                    {dossier.equipo?.bancoNumeroCuenta ? `${formatData(dossier.equipo?.bancoTipoCuenta)} No. ${dossier.equipo.bancoNumeroCuenta}` : 'Información pendiente'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Titular Registrado:</span>
                  <strong className="text-white print-text-dark">{formatData(dossier.equipo?.bancoTitular)}</strong>
                </div>
              </div>

              <div className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-slate-500 print-text-muted block font-bold text-[10px] uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Parámetros Contables CNE
                </span>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Tope Legal CNE (Campaña Actual):</span>
                  <strong className={`font-mono text-xs ${hasValidLimit ? 'text-emerald-400' : 'text-slate-400 italic'} print-text-dark`}>
                    {formattedLimit}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Plataforma Obligatoria:</span>
                  <strong className="text-white print-text-dark">Software Cuentas Claras - Consejo Nacional Electoral</strong>
                </div>
                <div>
                  <span className="text-slate-400 print-text-muted text-[10px] block">Régimen Contable:</span>
                  <strong className="text-white print-text-dark">Auditoría Financiera y Rendición Oficial de Ingresos y Gastos</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 7: CO-CANDIDATURAS & LISTAS ALIADAS */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                  Capítulo VII: Co-Candidaturas & Listas Aliadas Vinculadas ({dossier.campanasAliadas?.length || 0} Listas)
                </h3>
              </span>
              <span className="text-[10px] text-cyan-300 print-text-dark font-bold bg-cyan-500/20 print-badge px-2 py-0.5 rounded border border-cyan-500/30">
                Concejo • Asamblea • JAL
              </span>
            </div>

            <div className="p-3.5">
              {dossier.campanasAliadas && dossier.campanasAliadas.length > 0 ? (
                <div className="space-y-2 text-[11px]">
                  {dossier.campanasAliadas.map((aliada, idx) => (
                    <div key={aliada.id} className="p-2.5 bg-[#020712] print-badge rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-white print-text-dark">{idx + 1}. {formatData(aliada.nombreLista)}</span>
                        <span className="text-[10px] text-slate-400 print-text-muted block">
                          {formatData(aliada.corporacion)} • {formatData(aliada.partidoOLista)} • {formatData(aliada.modalidad)} • Meta: {aliada.metaVotosEsperada ? `${Number(aliada.metaVotosEsperada).toLocaleString('es-CO')} votos` : 'Información pendiente'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 print-text-dark bg-emerald-500/10 print-badge px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 self-start sm:self-auto">
                        {aliada.candidatos?.length || 0} candidatos inscritos
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 print-text-muted text-[11px] italic">Información pendiente de registro de listas aliadas en este expediente.</p>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULO 8: CERTIFICACIÓN JURÍDICA & FIRMAS OFICIALES */}
          {/* ========================================================================= */}
          <div className="print-section bg-[#041021] rounded-xl border border-cyan-500/20 overflow-hidden">
            <div className="print-header-bar bg-[#051833] px-4 py-2 border-b border-cyan-500/20 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white print-text-dark text-xs uppercase tracking-wide">
                Capítulo VIII: Certificación de Veracidad Jurídica & Responsabilidad Legal (Ley 1475 de 2011)
              </h3>
            </div>
            
            <div className="p-4 space-y-6">
              <p className="text-[10px] text-slate-300 print-text-muted text-justify leading-relaxed">
                Los suscritos declaramos bajo la gravedad de juramento que la totalidad de la información contenida en el presente <strong>Expediente Oficial de Campaña</strong> es veraz, fidedigna y cumple a cabalidad con la normatividad constitucional y legal colombiana (Constitución Política, Ley 1475 de 2011, Ley 136 de 1994 y directrices del Consejo Nacional Electoral). Nos hacemos legalmente responsables de la autenticidad de los datos aquí consignados.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 text-center text-[10px]">
                <div className="space-y-1">
                  <div className="border-t border-slate-600 print-card pt-2 w-4/5 mx-auto"></div>
                  <strong className="block text-white print-text-dark text-[11px]">{formatData(dossier.nombreCandidato)}</strong>
                  <span className="text-slate-400 print-text-muted block">Candidato(a) Oficial</span>
                  <span className="text-slate-500 print-text-muted block font-mono">CC: {formatData(dossier.cedulaCandidato)}</span>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-600 print-card pt-2 w-4/5 mx-auto"></div>
                  <strong className="block text-white print-text-dark text-[11px]">{formatData(dossier.equipo?.gerenteNombre)}</strong>
                  <span className="text-slate-400 print-text-muted block">Gerente Oficial de Campaña</span>
                  <span className="text-slate-500 print-text-muted block font-mono">CC: {formatData(dossier.equipo?.gerenteCedula)}</span>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-600 print-card pt-2 w-4/5 mx-auto"></div>
                  <strong className="block text-white print-text-dark text-[11px]">{formatData(dossier.equipo?.contadorNombre)}</strong>
                  <span className="text-slate-400 print-text-muted block">Contador(a) Público(a) Oficial</span>
                  <span className="text-slate-500 print-text-muted block font-mono">TP: {formatData(dossier.equipo?.contadorTarjetaProfesional)}</span>
                </div>
              </div>

              {/* Integrity & Generation Footer */}
              <div className="border-t border-slate-800 print-card pt-3 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-500 print-text-muted gap-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 print-text-dark" />
                  Fecha y hora de expedición oficial: <strong className="font-mono text-slate-300 print-text-dark">{generationTimestamp}</strong>
                </span>
                <span className="font-mono text-[8.5px]">
                  ID Radicado: {formatData(dossier.id)} • Sistema de Gestión Electoral Colombia
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-cyan-500/20 no-print">
          <div className="text-[11px] text-slate-400 text-center sm:text-left">
            * Para generar el archivo <strong className="text-emerald-400">PDF</strong>, haga clic en el botón y seleccione <em>"Guardar como PDF"</em> en la ventana de impresión.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Generar / Imprimir PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#051833] hover:bg-[#09254d] text-slate-300 font-bold text-xs rounded-xl border border-cyan-500/30 transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
