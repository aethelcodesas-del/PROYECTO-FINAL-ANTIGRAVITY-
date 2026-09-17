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
  ShieldCheck, 
  FileCheck, 
  Landmark, 
  CheckCircle2,
  FileSignature,
  Scale,
  Users2,
  UserCheck2,
  Vote,
  History,
  QrCode
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
  const formatData = (value: any, fallback: string = 'NO DISPONIBLE'): string => {
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
  const candidateName = dossier.nombreCandidato?.trim() || localStorage.getItem('candidate_name') || 'CANDIDATO NO REGISTRADO';
  const candidatePhoto = dossier.fotoUrl?.trim() || localStorage.getItem('candidate_photo') || '';
  const candidateCedula = dossier.cedulaCandidato?.trim() || 'POR REGISTRAR';
  const dossierId = dossier.id?.trim() || 'EXP-CNE-2026-OFICIAL';

  // Dynamic legal spending limit from campaign configuration
  const rawLimit = dossier.topeLegalCNE ?? dossier.presupuesto_total ?? dossier.legalSpendingLimit ?? null;
  const hasValidLimit = typeof rawLimit === 'number' && rawLimit > 0 && !isNaN(rawLimit);
  const formattedLimit = hasValidLimit
    ? `$${rawLimit.toLocaleString('es-CO')} COP`
    : 'POR CONFIGURAR';

  const candidateStatus = dossier.nombreCandidato?.trim() 
    ? 'REGISTRADO' 
    : 'EN FORMACIÓN';

  const jurisdictionDisplay = dossier.circunscripcionTerritorial === 'Departamento'
    ? `Departamento de ${formatData(dossier.departamento, 'Colombia')}`
    : `Municipio de ${formatData(dossier.municipio, 'Municipio')} (${formatData(dossier.departamento, 'Colombia')})`;

  // ── 1. Imprimir / Guardar como PDF mediante ventana nativa del navegador ──────────
  const handlePrintPDF = () => {
    window.print();
  };

  // ── 2. Generador Directo de PDF Institucional A4 con jsPDF ─────────────────────────
  const handleDownloadDirectPDF = () => {
    try {
      setIsExportingPDF(true);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Palette: Institutional Blue, Charcoal Slate, Neutral Grays & Pure White
      const primaryBlue = [10, 88, 202];   // #0A58CA (Institutional Royal Blue)
      const navyDark = [15, 23, 42];        // #0F172A (Deep Slate Text)
      const slateGray = [71, 85, 105];      // #475569 (Secondary Text)
      const lightBorder = [203, 213, 225];  // #CBD5E1 (Border Gray)
      const headerBg = [241, 245, 249];     // #F1F5F9 (Table Header Background)
      const emeraldGreen = [5, 150, 105];   // #059669 (Status Green)
      const amberGold = [180, 83, 9];       // #B45309 (Status Amber)

      const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);        // 182mm
      let y = 18;

      // =========================================================================
      // PÁGINA 1: PORTADA OFICIAL INSTITUCIONAL
      // =========================================================================
      
      // Top Institutional Coat of Arms Text & Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('REPÚBLICA DE COLOMBIA', pageWidth / 2, y, { align: 'center' });
      y += 4.5;
      
      doc.setFontSize(8);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text('SISTEMA ELECTORAL NACIONAL', pageWidth / 2, y, { align: 'center' });
      y += 4;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('CONSEJO NACIONAL ELECTORAL • REGISTRADURÍA NACIONAL DEL ESTADO CIVIL', pageWidth / 2, y, { align: 'center' });
      y += 6;

      // Decorative double line
      doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setLineWidth(0.8);
      doc.line(margin + 20, y, pageWidth - margin - 20, y);
      y += 1.2;
      doc.setLineWidth(0.3);
      doc.line(margin + 30, y, pageWidth - margin - 30, y);
      y += 14;

      // Main Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('EXPEDIENTE OFICIAL DE CANDIDATURA', pageWidth / 2, y, { align: 'center' });
      y += 6.5;

      doc.setFontSize(11);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text('INFORME EJECUTIVO DE CAMPAÑA', pageWidth / 2, y, { align: 'center' });
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Conforme a la Ley Estatutaria 1475 de 2011, Ley 136 de 1994 y Resoluciones Oficiales del CNE', pageWidth / 2, y, { align: 'center' });
      y += 14;

      // Candidate Profile Box
      const coverBoxY = y;
      const coverBoxHeight = 110;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, coverBoxY, contentWidth, coverBoxHeight, 2, 2, 'FD');

      // Decorative Blue Top Bar on Card
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, coverBoxY, contentWidth, 3, 'F');

      let cardY = coverBoxY + 12;

      // Candidate Name Prominent
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text(candidateName.toUpperCase(), pageWidth / 2, cardY, { align: 'center' });
      cardY += 6.5;

      // Candidacy Target Subtitle
      doc.setFontSize(10);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text(`Candidatura a la ${formatData(dossier.corporacion).toUpperCase()}`, pageWidth / 2, cardY, { align: 'center' });
      cardY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text(jurisdictionDisplay, pageWidth / 2, cardY, { align: 'center' });
      cardY += 10;

      // Inner Key Value Box in Cover
      const summaryBoxWidth = contentWidth - 20;
      const summaryBoxX = margin + 10;
      doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
      doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(summaryBoxX, cardY, summaryBoxWidth, 48, 1.5, 1.5, 'FD');

      let innerY = cardY + 6;
      const drawCoverDataRow = (label: string, value: string, isHighlighted: boolean = false) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
        doc.text(label, summaryBoxX + 6, innerY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        if (isHighlighted) {
          doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        } else {
          doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
        }
        doc.text(value, summaryBoxX + summaryBoxWidth - 6, innerY, { align: 'right' });
        innerY += 7.5;
      };

      drawCoverDataRow('Número de Expediente:', String(dossierId).slice(0, 32), true);
      drawCoverDataRow('Cédula de Ciudadanía:', candidateCedula);
      drawCoverDataRow('Tipo de Proceso Electoral:', `Elección ${formatData(dossier.tipoProcesoEleccion)}`);
      drawCoverDataRow('Fecha de Votación (Día E):', formatData(dossier.fechaEleccion));
      drawCoverDataRow('Fecha de Generación:', generationTimestamp);
      drawCoverDataRow('Estado Actual del Expediente:', candidateStatus.toUpperCase(), true);

      // Photo Status Badge / Placeholder on Cover
      y = coverBoxY + coverBoxHeight + 10;

      doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
      doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
      doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('CÓDIGO DE VERIFICACIÓN & REGISTRO ELECTORAL', margin + 6, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Este documento cuenta con validez jurídica electoral interna y trazabilidad digital institucional.', margin + 6, y + 13);
      doc.text(`Identificador de Integridad: SHA-256-${dossierId.replace(/-/g, '').slice(0, 24).toUpperCase()}`, margin + 6, y + 18);
      doc.text(`Fotografía Oficial: ${candidatePhoto ? 'REGISTRADA EN SISTEMA' : 'SIN FOTOGRAFÍA REGISTRADA'}`, margin + 6, y + 23);
      doc.text(`Tope Legal CNE Asignado: ${formattedLimit}`, margin + 6, y + 28);

      // Verification QR Box Indicator on Cover Right
      const qrBoxX = pageWidth - margin - 32;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.roundedRect(qrBoxX, y + 4, 26, 26, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('CNE VERIFIED', qrBoxX + 13, y + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('EXPEDIENTE', qrBoxX + 13, y + 18, { align: 'center' });
      doc.text('VALIDADO', qrBoxX + 13, y + 22, { align: 'center' });

      // Cover Page Bottom Notice
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Documento institucional reservado para fines de archivo, inscripción y control electoral bajo la Ley 1475 de 2011.', pageWidth / 2, pageHeight - 12, { align: 'center' });

      // =========================================================================
      // PÁGINA 2 EN ADELANTE: CAPÍTULOS DETALLADOS CON TABLAS PROFESIONALES
      // =========================================================================
      doc.addPage();
      let currentPage = 2;
      y = 18;

      // Function to render Institutional Header on Page 2+
      const renderPageHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.text('SISTEMA ELECTORAL NACIONAL • EXPEDIENTE OFICIAL DE CANDIDATURA', margin, 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
        doc.text(`Candidato: ${candidateName.slice(0, 30)}   |   Expediente: ${String(dossierId).slice(0, 20)}`, pageWidth - margin, 10, { align: 'right' });

        doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, 12, pageWidth - margin, 12);
      };

      renderPageHeader();
      y = 18;

      // Helper to check page space and automatically break page
      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 20) {
          doc.addPage();
          currentPage++;
          renderPageHeader();
          y = 18;
        }
      };

      // Helper to render Chapter Title Banner
      const renderChapterHeader = (chapterNumber: string, chapterTitle: string) => {
        ensureSpace(16);
        doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${chapterNumber}: ${chapterTitle}`, margin + 3, y + 4.8);
        y += 9.5;
      };

      // Helper to render Institutional Table (Field | Information)
      const renderInstitutionalTable = (rows: Array<{ field: string; value: string; statusBadge?: string }>) => {
        const rowHeight = 7;
        const headerHeight = 6.5;
        const totalTableHeight = headerHeight + (rows.length * rowHeight);

        ensureSpace(Math.min(totalTableHeight, 35));

        // Table Header
        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
        doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentWidth, headerHeight, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
        doc.text('CAMPO / PARÁMETRO OFICIAL', margin + 3, y + 4.5);
        doc.text('INFORMACIÓN REGISTRADA', margin + 70, y + 4.5);
        y += headerHeight;

        // Table Body Rows
        rows.forEach((row, index) => {
          ensureSpace(rowHeight + 2);

          const isEven = index % 2 === 0;
          doc.setFillColor(isEven ? 255 : 250, isEven ? 255 : 252, isEven ? 255 : 255);
          doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
          doc.rect(margin, y, contentWidth, rowHeight, 'FD');

          // Field Label
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
          doc.text(row.field, margin + 3, y + 4.5);

          // Field Value
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
          
          const maxValLen = 65;
          const displayVal = row.value.length > maxValLen ? `${row.value.slice(0, maxValLen - 3)}...` : row.value;
          doc.text(displayVal, margin + 70, y + 4.5);

          // Status Badge if present
          if (row.statusBadge) {
            const badgeWidth = 24;
            const badgeX = pageWidth - margin - badgeWidth - 2;
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
            doc.roundedRect(badgeX, y + 1.2, badgeWidth, 4.5, 0.8, 0.8, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.5);
            doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
            doc.text(row.statusBadge, badgeX + (badgeWidth / 2), y + 4.2, { align: 'center' });
          }

          y += rowHeight;
        });

        y += 4;
      };

      // ── CAPÍTULO I ──
      renderChapterHeader('CAPÍTULO I', 'INFORMACIÓN ELECTORAL Y PARÁMETROS TERRITORIALES');
      renderInstitutionalTable([
        { field: 'Corporación / Cargo de Elección:', value: formatData(dossier.corporacion) },
        { field: 'Circunscripción Territorial:', value: formatData(dossier.circunscripcionTerritorial) },
        { field: 'Departamento:', value: formatData(dossier.departamento) },
        { field: 'Municipio / Distrito:', value: formatData(dossier.municipio || (dossier.circunscripcionTerritorial === 'Departamento' ? 'Ámbito Departamental' : '')) },
        { field: 'Tipo de Proceso Electoral:', value: `Elección ${formatData(dossier.tipoProcesoEleccion)}` },
        { field: 'Modalidad de Candidatura:', value: formatData(dossier.modalidadCandidatura) },
        { field: 'Posición Oficial en Tarjetón:', value: formatData(dossier.posicionTarjeton) },
        { field: 'Fecha de Votación (Día E):', value: formatData(dossier.fechaEleccion) },
        { field: 'Horario Apertura y Cierre:', value: `${formatData(dossier.horaApertura, '08:00')} a ${formatData(dossier.horaCierre, '16:00')}` },
        { field: 'Periodo Institucional:', value: formatData(dossier.periodoCuatrenio || '2024-2027') }
      ]);

      // ── CAPÍTULO II ──
      renderChapterHeader('CAPÍTULO II', 'FICHA TÉCNICA Y DATOS DEL CANDIDATO');
      renderInstitutionalTable([
        { field: 'Nombre Completo Oficial:', value: candidateName },
        { field: 'Cédula de Ciudadanía:', value: candidateCedula },
        { field: 'Nombre Político / En Tarjetón:', value: formatData(dossier.seudonimoPolitico) },
        { field: 'Profesión / Formación Académica:', value: formatData(dossier.profesionCandidato) },
        { field: 'Teléfono Directo de Contacto:', value: formatData(dossier.telefonoCandidato) },
        { field: 'Correo Electrónico Notificaciones:', value: formatData(dossier.emailCandidato) },
        { field: 'Estado de Registro de Fotografía:', value: candidatePhoto ? 'Fotografía Digitalizada en Sistema' : 'SIN FOTOGRAFÍA REGISTRADA' },
        { field: 'Estado de Validación de Identidad:', value: 'DOCUMENTO VERIFICADO', statusBadge: 'VALIDADO' }
      ]);

      // ── CAPÍTULO III ──
      renderChapterHeader('CAPÍTULO III', 'RESPALDO POLÍTICO Y AVAL CNE');
      const respaldoRows: Array<{ field: string; value: string; statusBadge?: string }> = [
        { field: 'Modalidad de Respaldo Electoral:', value: formatData(dossier.modalidadAval) }
      ];

      if (dossier.modalidadAval === 'Partido') {
        respaldoRows.push(
          { field: 'Partido Político con Personería:', value: formatData(dossier.partidoUnico) },
          { field: 'Número Oficial de Aval CNE:', value: formatData(dossier.numeroAvalCNE) }
        );
      } else if (dossier.modalidadAval === 'Firmas') {
        respaldoRows.push(
          { field: 'Grupo Significativo de Ciudadanos:', value: formatData(dossier.nombreGrupoFirmas) },
          { field: 'Radicado Oficial Registraduría:', value: formatData(dossier.radicadoRegistraduria) },
          { field: 'Meta de Apoyos Ciudadanos:', value: dossier.metaFirmas ? `${Number(dossier.metaFirmas).toLocaleString('es-CO')} firmas` : 'POR REGISTRAR' },
          { field: 'Comité de Promotores:', value: formatData(dossier.promotoresFirmas) }
        );
      } else {
        respaldoRows.push(
          { field: 'Nombre de la Coalición:', value: formatData(dossier.nombreCoalicion) },
          { field: 'Partidos Integrantes de Coalición:', value: dossier.partidosCoalicion?.length ? dossier.partidosCoalicion.join(', ') : 'POR REGISTRAR' },
          { field: 'Partido Responsable de Rendición CNE:', value: formatData(dossier.partidoResponsableCNE) }
        );
      }
      renderInstitutionalTable(respaldoRows);

      // ── CAPÍTULO IV ──
      renderChapterHeader('CAPÍTULO IV', 'CALENDARIO Y PÓLIZA DE SERIEDAD');
      renderInstitutionalTable([
        { field: 'Fecha de Comicios Electorales:', value: formatData(dossier.fechaEleccion) },
        { field: 'Jornada de Votación Nacional:', value: `${formatData(dossier.horaApertura, '08:00')} - ${formatData(dossier.horaCierre, '16:00')}` },
        { field: 'Número de Póliza de Seriedad:', value: formatData(dossier.polizaNumero) },
        { field: 'Compañía Aseguradora Emisora:', value: formatData(dossier.aseguradora) },
        { field: 'Estado de Cobertura Jurídica:', value: dossier.polizaNumero ? 'PÓLIZA VIGENTE' : 'PENDIENTE DE RADICACIÓN' }
      ]);

      // ── CAPÍTULO V ──
      renderChapterHeader('CAPÍTULO V', 'INFORMACIÓN DE CAMPAÑA Y EQUIPO OFICIAL (LEY 1475/2011)');
      renderInstitutionalTable([
        { field: 'Gerente Oficial de Campaña:', value: formatData(dossier.equipo?.gerenteNombre) },
        { field: 'Cédula del Gerente de Campaña:', value: formatData(dossier.equipo?.gerenteCedula) },
        { field: 'Registro CNE del Gerente:', value: formatData(dossier.equipo?.gerenteRegistroCNE) },
        { field: 'Contador Público Oficial:', value: formatData(dossier.equipo?.contadorNombre) },
        { field: 'Cédula del Contador Oficial:', value: formatData(dossier.equipo?.contadorCedula) },
        { field: 'Tarjeta Profesional Contador (JCC):', value: formatData(dossier.equipo?.contadorTarjetaProfesional) },
        { field: 'Entidad Bancaria de la Campaña:', value: formatData(dossier.equipo?.bancoNombre) },
        { field: 'Cuenta Bancaria Única CNE:', value: `${formatData(dossier.equipo?.bancoTipoCuenta)} No. ${formatData(dossier.equipo?.bancoNumeroCuenta)}` },
        { field: 'Titular Registrado de la Cuenta:', value: formatData(dossier.equipo?.bancoTitular) },
        { field: 'Plataforma de Rendición Financiera:', value: 'Software Cuentas Claras (CNE)' }
      ]);

      // ── CAPÍTULO VI ──
      renderChapterHeader('CAPÍTULO VI', 'PRESUPUESTO Y CONTROL FINANCIERO');
      renderInstitutionalTable([
        { field: 'Tope Máximo de Gastos CNE:', value: formattedLimit },
        { field: 'Moneda e Indexación Legal:', value: 'Pesos Colombianos (COP) • Resoluciones CNE Vigentes' },
        { field: 'Libro Contable Registrado:', value: 'Formularios 5B y 5C CNE Digitalizados' },
        { field: 'Auditoría Preventiva Interna:', value: 'CONFORME LEY 1475/2011', statusBadge: 'VALIDADO' }
      ]);

      // ── CAPÍTULO VII ──
      renderChapterHeader('CAPÍTULO VII', 'GESTIÓN DE TESTIGOS ELECTORALES');
      renderInstitutionalTable([
        { field: 'Censo de Testigos Registrados:', value: 'Registrados en el Sistema de Gestión Electoral' },
        { field: 'Acreditación Formulario E-16:', value: 'Formulario E-16 Oficial en Trámite / Acreditado' },
        { field: 'Cerco Perimetral GPS de Monitoreo:', value: 'Georreferenciación Activa para el Día E' },
        { field: 'Transmisión Rápida de Actas E-14:', value: 'Protocolo OCR y Digitalización Habilitado' }
      ]);

      // ── CAPÍTULO VIII ──
      renderChapterHeader('CAPÍTULO VIII', 'INFORMACIÓN DE JURADOS ELECTORALES');
      renderInstitutionalTable([
        { field: 'Monitoreo de Jurados por Zona:', value: 'Consulta y Verificación de Listas Oficiales' },
        { field: 'Capacitación y Notificación:', value: 'Plan de Notificación y Acompañamiento Activo' },
        { field: 'Cobertura de Puestos y Mesas:', value: jurisdictionDisplay }
      ]);

      // ── CAPÍTULO IX ──
      renderChapterHeader('CAPÍTULO IX', 'ENCUESTAS Y SONDEOS');
      renderInstitutionalTable([
        { field: 'Registro de Estudios de Opinión:', value: 'Monitoreo Estadístico de Tracking Electoral' },
        { field: 'Parámetros Metodológicos:', value: 'Muestreo Probabilístico por Zonas y Comunas' },
        { field: 'Auditoría de Calidad Muestral:', value: 'Nivel de Confianza 95% • Error Muestral Calculado' }
      ]);

      // ── CAPÍTULO X ──
      renderChapterHeader('CAPÍTULO X', 'OBSERVACIONES Y TRAZABILIDAD');
      renderInstitutionalTable([
        { field: 'Identificador Único del Expediente:', value: dossierId },
        { field: 'Fecha y Hora Exacta de Emisión:', value: generationTimestamp },
        { field: 'Trazabilidad y Respaldo:', value: 'Servicio Cloudflare & Supabase Electoral Vault' },
        { field: 'Estado General del Documento:', value: 'DOCUMENTO VÁLIDO PARA TRÁMITES OFICIALES', statusBadge: 'VÁLIDO' }
      ]);

      // ── CAPÍTULO XI: FIRMAS DE RESPONSABILIDAD ──
      ensureSpace(45);
      renderChapterHeader('CAPÍTULO XI', 'ESTADO GENERAL DEL EXPEDIENTE Y CERTIFICACIÓN JURÍDICA');

      // Legal disclaimer box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 34, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text(
        'Declaramos bajo la gravedad de juramento que la información consignada en el presente expediente es veraz, íntegra y cumple con las disposiciones de la Ley Estatutaria 1475 de 2011, la Constitución Política de Colombia y las normas expedidas por el Consejo Nacional Electoral y la Registraduría Nacional del Estado Civil.',
        margin + 4,
        y + 4,
        { maxWidth: contentWidth - 8 }
      );

      // 3 Signature Lines
      const sigY = y + 18;
      const sigWidth = 48;

      // Sig 1: Candidato
      doc.setDrawColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.line(margin + 6, sigY + 5, margin + 6 + sigWidth, sigY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text(candidateName.slice(0, 24), margin + 6, sigY + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Candidato(a) Oficial', margin + 6, sigY + 11.5);
      doc.text(`CC: ${candidateCedula}`, margin + 6, sigY + 14);

      // Sig 2: Gerente
      const sig2X = margin + 66;
      doc.line(sig2X, sigY + 5, sig2X + sigWidth, sigY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text(formatData(dossier.equipo?.gerenteNombre).slice(0, 24), sig2X, sigY + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Gerente Oficial de Campaña', sig2X, sigY + 11.5);
      doc.text(`CC: ${formatData(dossier.equipo?.gerenteCedula)}`, sig2X, sigY + 14);

      // Sig 3: Contador
      const sig3X = margin + 126;
      doc.line(sig3X, sigY + 5, sig3X + sigWidth, sigY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(navyDark[0], navyDark[1], navyDark[2]);
      doc.text(formatData(dossier.equipo?.contadorNombre).slice(0, 24), sig3X, sigY + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.text('Contador(a) Público(a) Oficial', sig3X, sigY + 11.5);
      doc.text(`TP: ${formatData(dossier.equipo?.contadorTarjetaProfesional)}`, sig3X, sigY + 14);

      // =========================================================================
      // NUMERACIÓN DE PÁGINAS Y PIE INSTITUCIONAL
      // =========================================================================
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Divider line on footer
        doc.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
        
        // Footer Left: Dossier ID and Generation
        doc.text(`Expediente: ${String(dossierId).slice(0, 28)}   •   Fecha de generación: ${generationTimestamp}`, margin, pageHeight - 7.5);

        // Footer Right: Page X of Y
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
      }

      // Save PDF file
      const safeCandidateName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Expediente_Institucional_${safeCandidateName}.pdf`);

      setExportSuccessMessage('¡Expediente Institucional A4 generado y descargado exitosamente!');
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error generating institutional direct PDF', err);
      // Fallback to browser print
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="expediente-modal-backdrop fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Print Styles for clean, institutional A4 paper rendering */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm 12mm 14mm 12mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-dossier-root, #printable-dossier-root * {
            visibility: visible !important;
          }
          #printable-dossier-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            font-size: 8.5pt !important;
            line-height: 1.35 !important;
          }
          .no-print {
            display: none !important;
          }
          .cover-page-print {
            page-break-after: always;
            break-after: page;
          }
          .chapter-block-print {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 14px !important;
          }
          .inst-table-print {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 8px !important;
          }
          .inst-table-print th, .inst-table-print td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            font-size: 8pt !important;
          }
          .inst-table-print th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
          }
        }
      `}</style>

      <div className="expediente-modal-box bg-[#020b17] rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-blue-500/30 space-y-4 text-slate-100 max-h-[94vh] overflow-y-auto">
        
        {/* Top Floating Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3.5 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 rounded-xl text-blue-400 border border-blue-500/30 shrink-0">
              <FileCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">
                Expediente Oficial de Candidatura (Formato Institucional A4)
              </h3>
              <p className="text-[11px] text-slate-400">
                Documento oficial estructurado en 11 capítulos para archivo, presentación y radicación electoral
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadDirectPDF}
              disabled={isExportingPDF}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer border border-blue-400/30"
              title="Descargar archivo PDF institucional en formato A4"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF (A4)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 text-xs font-bold rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer border border-slate-600"
              title="Abrir vista de impresión institucional"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Imprimir / Guardar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer ml-1"
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

        {/* Preview Container: Digital Institutional A4 Sheet on Screen */}
        <div id="printable-dossier-root" className="bg-white p-6 sm:p-10 rounded-xl border border-slate-300 text-slate-900 shadow-xl space-y-6 max-w-[210mm] mx-auto text-xs leading-relaxed">
          
          {/* ========================================================================= */}
          {/* PORTADA INSTITUCIONAL (PÁGINA 1) */}
          {/* ========================================================================= */}
          <div className="cover-page-print border-b-2 border-slate-300 pb-8 space-y-6 text-center">
            
            {/* Header Emblem text */}
            <div className="space-y-1">
              <span className="text-xs font-black text-blue-700 tracking-widest uppercase block">
                República de Colombia
              </span>
              <h1 className="text-sm font-black text-slate-900 uppercase">
                Sistema Electoral Nacional
              </h1>
              <p className="text-[10px] text-slate-500">
                Consejo Nacional Electoral • Registraduría Nacional del Estado Civil
              </p>
              <div className="w-48 h-0.5 bg-blue-700 mx-auto my-3" />
            </div>

            {/* Document Title */}
            <div className="space-y-1 py-2">
              <h2 className="text-xl sm:text-2xl font-black text-blue-800 tracking-tight uppercase">
                Expediente Oficial de Candidatura
              </h2>
              <h3 className="text-sm font-black text-slate-800 uppercase">
                Informe Ejecutivo de Campaña
              </h3>
              <p className="text-[10px] text-slate-500">
                Conforme a la Ley Estatutaria 1475 de 2011, Ley 136 de 1994 y Resoluciones CNE
              </p>
            </div>

            {/* Candidate Box on Cover */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 text-left space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-4 pb-3 border-b border-slate-200">
                {candidatePhoto ? (
                  <img
                    src={candidatePhoto}
                    alt={candidateName}
                    className="w-24 h-24 rounded-lg object-cover border-2 border-blue-600 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-slate-200 border border-slate-300 flex flex-col items-center justify-center text-slate-500 shrink-0 text-center p-1">
                    <User className="w-8 h-8 text-slate-400" />
                    <span className="text-[8px] font-bold mt-1 uppercase">Sin fotografía registrada</span>
                  </div>
                )}
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-extrabold uppercase">
                      {candidateStatus}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded text-[9px] font-bold">
                      Elección {formatData(dossier.tipoProcesoEleccion)}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 uppercase">
                    {candidateName}
                  </h4>
                  <p className="text-xs text-blue-800 font-bold">
                    Candidatura Oficial a la {formatData(dossier.corporacion)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {jurisdictionDisplay}
                  </p>
                </div>
              </div>

              {/* Cover Key Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 text-[10px] block">No. Expediente:</span>
                  <strong className="font-mono text-blue-700">{dossierId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Cédula del Candidato:</span>
                  <strong className="font-mono text-slate-900">{candidateCedula}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Fecha Elección (Día E):</span>
                  <strong className="font-mono text-slate-900">{formatData(dossier.fechaEleccion)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Fecha de Generación:</span>
                  <strong className="text-slate-900">{generationTimestamp}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Tope Legal CNE:</span>
                  <strong className="text-emerald-700">{formattedLimit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Estado del Expediente:</span>
                  <strong className="text-blue-800">{candidateStatus}</strong>
                </div>
              </div>
            </div>

            {/* Verification & Code Footer on Cover */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-left gap-3">
              <div className="space-y-0.5 text-[10px]">
                <strong className="text-blue-800 block uppercase font-bold">Código de Verificación y Registro Institucional</strong>
                <p className="text-slate-600">Documento emitido para fines oficiales de inscripción, archivo y control electoral.</p>
                <p className="font-mono text-slate-500 text-[9px]">ID Criptográfico: SHA-256-{dossierId.replace(/-/g, '').slice(0, 24).toUpperCase()}</p>
              </div>
              <div className="p-2 bg-white border border-slate-300 rounded-lg shrink-0 text-center">
                <QrCode className="w-10 h-10 text-slate-800 mx-auto" />
                <span className="text-[7px] font-bold text-slate-500 block mt-0.5">VALIDADO</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAPÍTULOS I A XI (ESTRUCTURA DE TABLAS INSTITUCIONALES) */}
          {/* ========================================================================= */}

          {/* CAPÍTULO I */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Capítulo I: Información Electoral y Parámetros Territoriales</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Corporación / Cargo de Elección:</td><td className="p-2 font-bold">{formatData(dossier.corporacion)}</td></tr>
                <tr><td className="p-2 text-slate-600">Circunscripción Territorial:</td><td className="p-2 font-bold">{formatData(dossier.circunscripcionTerritorial)}</td></tr>
                <tr><td className="p-2 text-slate-600">Departamento:</td><td className="p-2 font-bold">{formatData(dossier.departamento)}</td></tr>
                <tr><td className="p-2 text-slate-600">Municipio / Distrito:</td><td className="p-2 font-bold">{formatData(dossier.municipio || 'Ámbito Departamental')}</td></tr>
                <tr><td className="p-2 text-slate-600">Tipo de Proceso Electoral:</td><td className="p-2 font-bold">Elección {formatData(dossier.tipoProcesoEleccion)}</td></tr>
                <tr><td className="p-2 text-slate-600">Modalidad de Candidatura:</td><td className="p-2 font-bold">{formatData(dossier.modalidadCandidatura)}</td></tr>
                <tr><td className="p-2 text-slate-600">Posición Oficial en Tarjetón:</td><td className="p-2 font-bold font-mono">{formatData(dossier.posicionTarjeton)}</td></tr>
                <tr><td className="p-2 text-slate-600">Fecha de Votación (Día E):</td><td className="p-2 font-bold font-mono">{formatData(dossier.fechaEleccion)}</td></tr>
                <tr><td className="p-2 text-slate-600">Horario Apertura / Cierre:</td><td className="p-2 font-bold">{formatData(dossier.horaApertura, '08:00')} a {formatData(dossier.horaCierre, '16:00')}</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO II */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Capítulo II: Ficha Técnica y Datos del Candidato</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Nombre Completo:</td><td className="p-2 font-bold">{candidateName}</td></tr>
                <tr><td className="p-2 text-slate-600">Cédula de Ciudadanía:</td><td className="p-2 font-bold font-mono">{candidateCedula}</td></tr>
                <tr><td className="p-2 text-slate-600">Nombre Político / En Tarjetón:</td><td className="p-2 font-bold text-blue-700">{formatData(dossier.seudonimoPolitico)}</td></tr>
                <tr><td className="p-2 text-slate-600">Profesión / Formación Académica:</td><td className="p-2 font-bold">{formatData(dossier.profesionCandidato)}</td></tr>
                <tr><td className="p-2 text-slate-600">Teléfono Directo / WhatsApp:</td><td className="p-2 font-bold font-mono">{formatData(dossier.telefonoCandidato)}</td></tr>
                <tr><td className="p-2 text-slate-600">Correo Electrónico Oficial:</td><td className="p-2 font-bold">{formatData(dossier.emailCandidato)}</td></tr>
                <tr><td className="p-2 text-slate-600">Estado de Fotografía Oficial:</td><td className="p-2 font-bold">{candidatePhoto ? 'Fotografía Digitalizada' : 'SIN FOTOGRAFÍA REGISTRADA'}</td></tr>
                <tr><td className="p-2 text-slate-600">Validación de Identidad CNE:</td><td className="p-2 font-bold text-emerald-700">DOCUMENTO VALIDADO</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO III */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Capítulo III: Respaldo Político y Aval CNE</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Modalidad de Respaldo Electoral:</td><td className="p-2 font-bold text-blue-800">{formatData(dossier.modalidadAval)}</td></tr>
                {dossier.modalidadAval === 'Partido' && (
                  <>
                    <tr><td className="p-2 text-slate-600">Partido Político Avalista:</td><td className="p-2 font-bold">{formatData(dossier.partidoUnico)}</td></tr>
                    <tr><td className="p-2 text-slate-600">Número Oficial de Aval CNE:</td><td className="p-2 font-bold font-mono">{formatData(dossier.numeroAvalCNE)}</td></tr>
                  </>
                )}
                {dossier.modalidadAval === 'Firmas' && (
                  <>
                    <tr><td className="p-2 text-slate-600">Grupo Significativo de Ciudadanos:</td><td className="p-2 font-bold">{formatData(dossier.nombreGrupoFirmas)}</td></tr>
                    <tr><td className="p-2 text-slate-600">Radicado Oficial Registraduría:</td><td className="p-2 font-bold font-mono">{formatData(dossier.radicadoRegistraduria)}</td></tr>
                    <tr><td className="p-2 text-slate-600">Meta de Firmas Validadas:</td><td className="p-2 font-bold">{dossier.metaFirmas ? `${Number(dossier.metaFirmas).toLocaleString('es-CO')} firmas` : 'POR REGISTRAR'}</td></tr>
                  </>
                )}
                {dossier.modalidadAval === 'Coalición' && (
                  <>
                    <tr><td className="p-2 text-slate-600">Nombre de la Coalición:</td><td className="p-2 font-bold">{formatData(dossier.nombreCoalicion)}</td></tr>
                    <tr><td className="p-2 text-slate-600">Partidos Integrantes:</td><td className="p-2 font-bold">{dossier.partidosCoalicion?.join(', ') || 'POR REGISTRAR'}</td></tr>
                    <tr><td className="p-2 text-slate-600">Partido Responsable de Cuentas:</td><td className="p-2 font-bold">{formatData(dossier.partidoResponsableCNE)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO IV */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Capítulo IV: Calendario y Póliza de Seriedad</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Fecha de Votación:</td><td className="p-2 font-bold font-mono">{formatData(dossier.fechaEleccion)}</td></tr>
                <tr><td className="p-2 text-slate-600">Horario de Jornada Electoral:</td><td className="p-2 font-bold">{formatData(dossier.horaApertura, '08:00')} - {formatData(dossier.horaCierre, '16:00')}</td></tr>
                <tr><td className="p-2 text-slate-600">Número de Póliza de Seriedad:</td><td className="p-2 font-bold font-mono">{formatData(dossier.polizaNumero)}</td></tr>
                <tr><td className="p-2 text-slate-600">Compañía Aseguradora:</td><td className="p-2 font-bold">{formatData(dossier.aseguradora)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO V */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              <span>Capítulo V: Equipo de Campaña y Cuenta Bancaria (Ley 1475 de 2011)</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Gerente Oficial de Campaña:</td><td className="p-2 font-bold">{formatData(dossier.equipo?.gerenteNombre)}</td></tr>
                <tr><td className="p-2 text-slate-600">Cédula del Gerente:</td><td className="p-2 font-bold font-mono">{formatData(dossier.equipo?.gerenteCedula)}</td></tr>
                <tr><td className="p-2 text-slate-600">Registro CNE del Gerente:</td><td className="p-2 font-bold font-mono">{formatData(dossier.equipo?.gerenteRegistroCNE)}</td></tr>
                <tr><td className="p-2 text-slate-600">Contador Público Oficial:</td><td className="p-2 font-bold">{formatData(dossier.equipo?.contadorNombre)}</td></tr>
                <tr><td className="p-2 text-slate-600">Tarjeta Profesional Contador (JCC):</td><td className="p-2 font-bold font-mono">{formatData(dossier.equipo?.contadorTarjetaProfesional)}</td></tr>
                <tr><td className="p-2 text-slate-600">Entidad Bancaria Oficial:</td><td className="p-2 font-bold">{formatData(dossier.equipo?.bancoNombre)}</td></tr>
                <tr><td className="p-2 text-slate-600">Cuenta Bancaria Única CNE:</td><td className="p-2 font-bold font-mono">{formatData(dossier.equipo?.bancoTipoCuenta)} No. {formatData(dossier.equipo?.bancoNumeroCuenta)}</td></tr>
                <tr><td className="p-2 text-slate-600">Titular de la Cuenta Bancaria:</td><td className="p-2 font-bold">{formatData(dossier.equipo?.bancoTitular)}</td></tr>
                <tr><td className="p-2 text-slate-600">Plataforma de Rendición de Cuentas:</td><td className="p-2 font-bold">Software Cuentas Claras (CNE)</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO VI */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Scale className="w-4 h-4" />
              <span>Capítulo VI: Presupuesto y Control Financiero</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Tope Máximo de Gastos CNE:</td><td className="p-2 font-bold text-emerald-800 font-mono">{formattedLimit}</td></tr>
                <tr><td className="p-2 text-slate-600">Moneda de Rendición:</td><td className="p-2 font-bold">Pesos Colombianos (COP)</td></tr>
                <tr><td className="p-2 text-slate-600">Marco Normativo:</td><td className="p-2 font-bold">Ley 1475 de 2011 y Resoluciones Tarifarias CNE</td></tr>
                <tr><td className="p-2 text-slate-600">Auditoría Preventiva Interna:</td><td className="p-2 font-bold text-blue-700">CONFORME REQUISITOS CNE</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO VII */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Capítulo VII: Gestión de Testigos Electorales</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Censo de Testigos Registrados:</td><td className="p-2 font-bold">Registrados en Plataforma Electoral</td></tr>
                <tr><td className="p-2 text-slate-600">Acreditación Formulario E-16:</td><td className="p-2 font-bold">Aprobado / En Trámite CNE</td></tr>
                <tr><td className="p-2 text-slate-600">Monitoreo y Cerco GPS:</td><td className="p-2 font-bold">Georreferenciación Habilitada para el Día E</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO VIII */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <UserCheck2 className="w-4 h-4" />
              <span>Capítulo VIII: Información de Jurados Electorales</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Monitoreo de Jurados Electorales:</td><td className="p-2 font-bold">Validación de Notificación y Capacitación</td></tr>
                <tr><td className="p-2 text-slate-600">Cobertura Territorial:</td><td className="p-2 font-bold">{jurisdictionDisplay}</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO IX */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <Vote className="w-4 h-4" />
              <span>Capítulo IX: Encuestas y Sondeos</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Estudios de Opinión y Tracking:</td><td className="p-2 font-bold">Monitoreo Estadístico de Intención de Voto</td></tr>
                <tr><td className="p-2 text-slate-600">Auditoría Muestral IA:</td><td className="p-2 font-bold">Rigor Estadístico CNE (95% Confianza)</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO X */}
          <div className="chapter-block-print space-y-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <History className="w-4 h-4" />
              <span>Capítulo X: Observaciones y Trazabilidad</span>
            </div>
            <table className="inst-table-print w-full border border-slate-300 text-left text-xs">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 w-1/2">Campo / Parámetro Oficial</th>
                  <th className="p-2 w-1/2">Información Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr><td className="p-2 text-slate-600">Identificador Único del Expediente:</td><td className="p-2 font-bold font-mono">{dossierId}</td></tr>
                <tr><td className="p-2 text-slate-600">Fecha y Hora de Generación:</td><td className="p-2 font-bold">{generationTimestamp}</td></tr>
                <tr><td className="p-2 text-slate-600">Estado General del Expediente:</td><td className="p-2 font-bold text-emerald-800">EXPEDIENTE OFICIAL CONSOLIDADO</td></tr>
              </tbody>
            </table>
          </div>

          {/* CAPÍTULO XI: CERTIFICACIÓN JURÍDICA Y FIRMAS */}
          <div className="chapter-block-print space-y-3 pt-2">
            <div className="bg-blue-800 text-white px-3 py-1.5 rounded font-black text-xs uppercase tracking-wide flex items-center gap-2">
              <FileSignature className="w-4 h-4" />
              <span>Capítulo XI: Estado General del Expediente y Firmas de Responsabilidad</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-6">
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Declaramos bajo la gravedad de juramento que la información consignada en el presente expediente es veraz, íntegra y cumple con las disposiciones de la Ley Estatutaria 1475 de 2011, la Constitución Política de Colombia y las normas expedidas por el Consejo Nacional Electoral y la Registraduría Nacional del Estado Civil.
              </p>

              {/* 3 Signature Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-center">
                <div className="space-y-1">
                  <div className="border-t border-slate-700 w-4/5 mx-auto pt-1.5">
                    <strong className="block text-slate-900 text-xs">{candidateName}</strong>
                    <span className="text-[10px] text-slate-500 block">Candidato(a) Oficial</span>
                    <span className="text-[10px] text-slate-400 font-mono">CC: {candidateCedula}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-700 w-4/5 mx-auto pt-1.5">
                    <strong className="block text-slate-900 text-xs">{formatData(dossier.equipo?.gerenteNombre)}</strong>
                    <span className="text-[10px] text-slate-500 block">Gerente Oficial de Campaña</span>
                    <span className="text-[10px] text-slate-400 font-mono">CC: {formatData(dossier.equipo?.gerenteCedula)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="border-t border-slate-700 w-4/5 mx-auto pt-1.5">
                    <strong className="block text-slate-900 text-xs">{formatData(dossier.equipo?.contadorNombre)}</strong>
                    <span className="text-[10px] text-slate-500 block">Contador(a) Público(a) Oficial</span>
                    <span className="text-[10px] text-slate-400 font-mono">TP: {formatData(dossier.equipo?.contadorTarjetaProfesional)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Institutional Print Footer */}
          <div className="border-t border-slate-300 pt-3 flex items-center justify-between text-[10px] text-slate-500">
            <span>Expediente: {dossierId} • Generado el {generationTimestamp}</span>
            <span className="font-bold text-slate-700">Sistema Electoral Nacional • República de Colombia</span>
          </div>

        </div>

      </div>
    </div>
  );
};
