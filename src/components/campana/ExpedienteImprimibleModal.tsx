import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { CampanaDossier } from '../../types/campana';
import { 
  Printer, 
  Download,
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
  FileText,
  CheckCircle2,
  AlertCircle
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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Format Helper: guarantees real data or clean official fallback
  const formatData = (value: any, fallback: string = 'Por registrar'): string => {
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

  // Dynamic candidate photo and name fallbacks
  const candidateName = dossier.nombreCandidato?.trim() || localStorage.getItem('candidate_name') || 'Candidato Oficial';
  const candidatePhoto = dossier.fotoUrl?.trim() || localStorage.getItem('candidate_photo') || '';
  const candidateCedula = dossier.cedulaCandidato?.trim() || 'Pendiente de radicación';

  // ── 1. Imprimir / Guardar como PDF mediante ventana nativa del navegador ──────────
  const handlePrintPDF = () => {
    window.print();
  };

  // ── 2. Descargar archivo PDF directo con jsPDF ──────────────────────────────────────
  const handleDownloadDirectPDF = () => {
    try {
      setIsExportingPDF(true);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const primaryBlue = [14, 116, 144]; // #0e7490
      const darkNavy = [15, 23, 42];      // #0f172a
      const slateGray = [100, 116, 139];   // #64748b
      const emeraldGreen = [5, 150, 105];  // #059669
      const lightBg = [248, 250, 252];    // #f8fafc
      const borderGray = [226, 232, 240];  // #e2e8f0

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 16;

      // ── Header Box ──
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('REPÚBLICA DE COLOMBIA • CONSEJO NACIONAL ELECTORAL & REGISTRADURÍA', margin + 4, y + 6);

      doc.setFontSize(11);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text('EXPEDIENTE OFICIAL DE CANDIDATURA & INFORME EJECUTIVO', margin + 4, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Conforme a la Ley Estatutaria 1475 de 2011, Ley 136 de 1994 y Resoluciones del CNE', margin + 4, y + 17);

      // Expediente Number Pill
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(`EXP: ${String(dossier.id || 'CNE-2027-OFICIAL').slice(0, 24)}`, pageWidth - margin - 45, y + 12);
      doc.setFontSize(6.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text(`Fecha: ${generationTimestamp}`, pageWidth - margin - 45, y + 17);

      y += 26;

      // ── Candidate Profile Banner ──
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 30, 2, 2, 'FD');

      // Candidate Badge
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
      doc.roundedRect(margin + 4, y + 4, 48, 5, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
      doc.text(candidateStatus.toUpperCase(), margin + 6, y + 7.5);

      // Election Process Badge
      doc.setFillColor(238, 246, 255);
      doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.roundedRect(margin + 54, y + 4, 38, 5, 1, 1, 'FD');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text(`ELECCIÓN ${formatData(dossier.tipoProcesoEleccion).toUpperCase()}`, margin + 56, y + 7.5);

      // Candidate Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(candidateName.toUpperCase(), margin + 4, y + 15);

      // Candidacy Target
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(`Candidatura Oficial a la ${formatData(dossier.corporacion)} • ${jurisdictionDisplay}`, margin + 4, y + 20);

      // Sub-stats grid
      doc.setFontSize(7.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Cédula de Ciudadanía:', margin + 4, y + 25);
      doc.text('Fecha Elecciones (Día E):', margin + 65, y + 25);
      doc.text('Tope Legal CNE:', margin + 125, y + 25);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(candidateCedula, margin + 4, y + 28.5);
      doc.text(formatData(dossier.fechaEleccion), margin + 65, y + 28.5);
      doc.text(formattedLimit, margin + 125, y + 28.5);

      y += 34;

      // ── Helper Function for Section Rendering ──
      const renderSectionHeader = (title: string) => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), 6.5, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
        doc.text(title, margin + 3, y + 4.5);
        y += 8;
      };

      const renderGridBlock = (data: Array<{ label: string; value: string }>, cols: number = 3) => {
        const startY = y;
        const colWidth = (pageWidth - (margin * 2)) / cols;
        const rowHeight = 9.5;
        const rowsCount = Math.ceil(data.length / cols);
        const boxHeight = rowsCount * rowHeight + 3;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.roundedRect(margin, startY, pageWidth - (margin * 2), boxHeight, 1, 1, 'FD');

        data.forEach((item, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const cellX = margin + 3 + (col * colWidth);
          const cellY = startY + 3 + (row * rowHeight);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
          doc.text(item.label, cellX, cellY + 2);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
          doc.text(item.value.length > 34 ? `${item.value.slice(0, 32)}...` : item.value, cellX, cellY + 5.5);
        });

        y += boxHeight + 4;
      };

      // ── Capítulo I ──
      renderSectionHeader('CAPÍTULO I: INFORMACIÓN ELECTORAL & PARÁMETROS TERRITORIALES');
      renderGridBlock([
        { label: 'Corporación / Cargo:', value: formatData(dossier.corporacion) },
        { label: 'Circunscripción:', value: formatData(dossier.circunscripcionTerritorial) },
        { label: 'Departamento:', value: formatData(dossier.departamento) },
        { label: 'Municipio / Distrito:', value: formatData(dossier.municipio || 'Ámbito Departamental') },
        { label: 'Tipo de Proceso:', value: `Elección ${formatData(dossier.tipoProcesoEleccion)}` },
        { label: 'Modalidad Candidatura:', value: formatData(dossier.modalidadCandidatura) },
        { label: 'Posición Tarjetón:', value: formatData(dossier.posicionTarjeton) },
        { label: 'Fecha de Votación:', value: formatData(dossier.fechaEleccion) },
        { label: 'Horario Apertura / Cierre:', value: `${formatData(dossier.horaApertura, '08:00')} - ${formatData(dossier.horaCierre, '16:00')}` }
      ], 3);

      // ── Capítulo II ──
      renderSectionHeader('CAPÍTULO II: FICHA TÉCNICA & DATOS DEL CANDIDATO');
      renderGridBlock([
        { label: 'Nombre Completo:', value: candidateName },
        { label: 'Cédula de Ciudadanía:', value: candidateCedula },
        { label: 'Nombre Político / Tarjetón:', value: formatData(dossier.seudonimoPolitico) },
        { label: 'Profesión / Formación:', value: formatData(dossier.profesionCandidato) },
        { label: 'Teléfono Directo / WhatsApp:', value: formatData(dossier.telefonoCandidato) },
        { label: 'Correo Electrónico Oficial:', value: formatData(dossier.emailCandidato) }
      ], 3);

      // ── Capítulo III ──
      renderSectionHeader('CAPÍTULO III: RESPALDO POLÍTICO, AVAL CNE & PÓLIZA DE SERIEDAD');
      const avalData = [
        { label: 'Modalidad de Aval:', value: formatData(dossier.modalidadAval) },
        { 
          label: dossier.modalidadAval === 'Partido' ? 'Partido Avalista:' : dossier.modalidadAval === 'Firmas' ? 'Grupo Significativo:' : 'Coalición:',
          value: dossier.modalidadAval === 'Partido' ? formatData(dossier.partidoUnico) : dossier.modalidadAval === 'Firmas' ? formatData(dossier.nombreGrupoFirmas) : formatData(dossier.nombreCoalicion)
        },
        { 
          label: dossier.modalidadAval === 'Partido' ? 'No. Aval CNE:' : dossier.modalidadAval === 'Firmas' ? 'Radicado Registraduría:' : 'Partido Responsable CNE:',
          value: dossier.modalidadAval === 'Partido' ? formatData(dossier.numeroAvalCNE) : dossier.modalidadAval === 'Firmas' ? formatData(dossier.radicadoRegistraduria) : formatData(dossier.partidoResponsableCNE)
        },
        { label: 'No. Póliza de Seriedad:', value: formatData(dossier.polizaNumero) },
        { label: 'Compañía Aseguradora:', value: formatData(dossier.aseguradora) },
        { label: 'Meta de Firmas / Apoyos:', value: dossier.metaFirmas ? `${Number(dossier.metaFirmas).toLocaleString('es-CO')} firmas` : 'No aplica' }
      ];
      renderGridBlock(avalData, 3);

      // Check if page overflow will occur
      if (y > 215) {
        doc.addPage();
        y = 16;
      }

      // ── Capítulo IV & V: Equipo CNE y Cuenta Bancaria ──
      renderSectionHeader('CAPÍTULO IV: EQUIPO OFICIAL DE CAMPAÑA & CUENTA BANCARIA (LEY 1475/2011)');
      renderGridBlock([
        { label: 'Gerente Oficial de Campaña:', value: formatData(dossier.equipo?.gerenteNombre) },
        { label: 'Cédula del Gerente:', value: formatData(dossier.equipo?.gerenteCedula) },
        { label: 'Registro CNE Gerente:', value: formatData(dossier.equipo?.gerenteRegistroCNE) },
        { label: 'Contador Público Oficial:', value: formatData(dossier.equipo?.contadorNombre) },
        { label: 'Tarjeta Profesional JCC:', value: formatData(dossier.equipo?.contadorTarjetaProfesional) },
        { label: 'Entidad Bancaria:', value: formatData(dossier.equipo?.bancoNombre) },
        { label: 'Cuenta Bancaria Única CNE:', value: `${formatData(dossier.equipo?.bancoTipoCuenta)} No. ${formatData(dossier.equipo?.bancoNumeroCuenta)}` },
        { label: 'Titular Oficial Registrado:', value: formatData(dossier.equipo?.bancoTitular) },
        { label: 'Plataforma de Rendición:', value: 'Software Cuentas Claras (CNE)' }
      ], 3);

      // Check for signatures block
      if (y > 225) {
        doc.addPage();
        y = 16;
      }

      // ── Legal Declarations and Signatures ──
      renderSectionHeader('CAPÍTULO V: CERTIFICACIÓN JURÍDICA & RESPONSABILIDAD LEGAL');

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      const sigBoxHeight = 36;
      doc.roundedRect(margin, y, pageWidth - (margin * 2), sigBoxHeight, 1, 1, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text(
        'Declaramos bajo la gravedad de juramento que la información contenida en el presente expediente oficial es veraz y cumple con la Ley 1475/2011.',
        margin + 3,
        y + 4
      );

      // 3 Signature Lines
      const sigWidth = 46;
      const sigY = y + 16;

      // Sig 1: Candidato
      doc.setDrawColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.line(margin + 6, sigY + 6, margin + 6 + sigWidth, sigY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(candidateName.slice(0, 24), margin + 6, sigY + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Candidato(a) Oficial', margin + 6, sigY + 13);
      doc.text(`CC: ${candidateCedula}`, margin + 6, sigY + 16);

      // Sig 2: Gerente
      const sig2X = margin + 68;
      doc.line(sig2X, sigY + 6, sig2X + sigWidth, sigY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(formatData(dossier.equipo?.gerenteNombre).slice(0, 24), sig2X, sigY + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Gerente de Campaña', sig2X, sigY + 13);
      doc.text(`CC: ${formatData(dossier.equipo?.gerenteCedula)}`, sig2X, sigY + 16);

      // Sig 3: Contador
      const sig3X = margin + 130;
      doc.line(sig3X, sigY + 6, sig3X + sigWidth, sigY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
      doc.text(formatData(dossier.equipo?.contadorNombre).slice(0, 24), sig3X, sigY + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Contador(a) Público(a) Oficial', sig3X, sigY + 13);
      doc.text(`TP: ${formatData(dossier.equipo?.contadorTarjetaProfesional)}`, sig3X, sigY + 16);

      // Footer timestamp
      y += sigBoxHeight + 3;
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text(`Expedido el ${generationTimestamp} • Radicado: ${formatData(dossier.id)} • Sistema de Gestión Electoral Colombia`, margin, y + 2);

      // Save PDF file
      const safeCandidateName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Expediente_Oficial_${safeCandidateName}.pdf`);

      setExportSuccessMessage('¡Expediente Oficial PDF generado y descargado exitosamente!');
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error generating direct PDF', err);
      // Fallback to browser print
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Dynamic legal spending limit from campaign configuration
  const rawLimit = dossier.topeLegalCNE ?? dossier.presupuesto_total ?? dossier.legalSpendingLimit ?? null;
  const hasValidLimit = typeof rawLimit === 'number' && rawLimit > 0 && !isNaN(rawLimit);
  const formattedLimit = hasValidLimit
    ? `$${rawLimit.toLocaleString('es-CO')} COP`
    : 'Pendiente de configuración CNE';

  const candidateStatus = dossier.nombreCandidato?.trim() 
    ? 'Expediente Oficial Registrado' 
    : 'Expediente en Formación';

  const jurisdictionDisplay = dossier.circunscripcionTerritorial === 'Departamento'
    ? `Departamento de ${formatData(dossier.departamento, 'Colombia')}`
    : `Municipio de ${formatData(dossier.municipio, 'Municipio')} (${formatData(dossier.departamento, 'Colombia')})`;

  return (
    <div className="expediente-modal-backdrop fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Print Styles for clean, high-contrast, official paper/PDF rendering */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 10mm 12mm 10mm 12mm;
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
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-card {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          .print-section {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 10px !important;
            border-radius: 6px !important;
          }
          .print-header-bar {
            background: #f1f5f9 !important;
            border-bottom: 1.5px solid #94a3b8 !important;
            color: #0f172a !important;
            padding: 5px 8px !important;
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
        }
      `}</style>

      <div className="expediente-modal-box bg-[#030e21] rounded-2xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-5 text-white max-h-[92vh] overflow-y-auto">
        
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
              onClick={handleDownloadDirectPDF}
              disabled={isExportingPDF}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer border border-emerald-400/30"
              title="Descargar archivo PDF directamente a su equipo"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer border border-cyan-400/30"
              title="Abrir vista de impresión y guardar como PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
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

        {/* Success Alert Toast */}
        {exportSuccessMessage && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn no-print">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
        )}

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
                {candidatePhoto ? (
                  <img
                    src={candidatePhoto}
                    alt={candidateName}
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
                  {candidateName}
                </h2>
                
                <p className="text-slate-300 print-text-dark font-medium text-xs">
                  Candidatura Oficial a la <strong>{formatData(dossier.corporacion)}</strong> • {jurisdictionDisplay}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 print-text-muted block text-[10px]">Cédula de Ciudadanía:</span>
                    <strong className="font-mono text-white print-text-dark">{candidateCedula}</strong>
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
                  <strong className="text-white print-text-dark">{candidateName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 print-text-muted block text-[10px]">Cédula de Ciudadanía:</span>
                  <strong className="text-white print-text-dark font-mono">{candidateCedula}</strong>
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
                  <strong className="block text-white print-text-dark text-[11px]">{candidateName}</strong>
                  <span className="text-slate-400 print-text-muted block">Candidato(a) Oficial</span>
                  <span className="text-slate-500 print-text-muted block font-mono">CC: {candidateCedula}</span>
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
            * Puede descargar el archivo <strong className="text-emerald-400">PDF Directo</strong> o usar <strong className="text-cyan-300">Imprimir / Guardar PDF</strong> para vista previa oficial.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadDirectPDF}
              disabled={isExportingPDF}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-cyan-400/30"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
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
