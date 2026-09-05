import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { AuthUser } from '../../types';
import { 
  consultarCensoElectoralAPI, 
  verificarActualizacionPuestoAPI,
  CensoConsultaResult 
} from '../../services/censoElectoralApi';
import {
  subscribeVoters,
  subscribeArchivedVoters,
  addVoterDoc,
  updateVoterDoc,
  deleteVoterDoc,
  addArchivedVoterDoc,
  updateArchivedVoterDoc,
  deleteArchivedVoterDoc
} from '../../lib/firestoreService';
import { 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  UserPlus, 
  MapPin, 
  Users, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Filter, 
  Download, 
  Sparkles, 
  Car, 
  SearchCheck, 
  Check, 
  Flag,
  FolderArchive,
  Bell,
  BellRing,
  RefreshCw,
  ArrowRight,
  Inbox,
  Send,
  Trash2,
  FileCheck,
  Building2,
  Clock,
  User,
  UserCog,
  Lock,
  FileText,
  Share2,
  Copy,
  X,
  RefreshCw as RefreshIcon
} from 'lucide-react';

export interface VotanteRegistrado {
  id: string;
  cedula: string;
  nombreCompleto: string;
  telefono: string;
  barrio: string;
  comunaSector: string;
  puestoVotacion: string;
  direccionPuesto: string;
  mesa: number;
  liderAsignado: string;
  intencionVoto: 'Voto Seguro' | 'En Duda' | 'Simpatizante' | 'Reclutado';
  requiereTransporte: boolean;
  observaciones: string;
  fechaRegistro: string;
  estadoCenso: 'Validado API Medellín';
  circunscripcion: string;
}

export interface VotanteArchivado {
  id: string;
  cedula: string;
  nombreCompleto: string;
  telefono: string;
  barrio: string;
  liderAsignado: string;
  circunscripcionOriginal: string;
  puestoOriginal: string;
  motivo: string;
  fechaArchivado: string;
  fechaUltimaConsultaApi: string;
  estadoCne: 'En Espera de Traslado CNE' | '¡LUGAR ACTUALIZADO A MEDELLÍN!';
  puestoNuevoMedellin?: {
    puestoVotacion: string;
    comunaSector: string;
    direccionPuesto: string;
    mesa: number;
    fechaInscripcion: string;
  };
}

export interface CampaignMember {
  id: string;
  nombre: string;
  cargo: string;
  comunaZone: string;
  telefono: string;
}

// Directory of campaign leaders and team members
export const LISTA_MIEMBROS_CAMPAÑA: CampaignMember[] = [];

export interface RegistroVotantesViewProps {
  onSelectView?: (view: any) => void;
  authUser?: AuthUser | null;
}

export const RegistroVotantesView: React.FC<RegistroVotantesViewProps> = ({
  onSelectView,
  authUser
}) => {
  const CIRCUNSCRIPCION_CAMPANA = (() => {
    try {
      const jurisdiction = JSON.parse(localStorage.getItem('active_campaign_jurisdiction_v1') || '{}');
      return String(jurisdiction.municipality || jurisdiction.department || '').trim();
    } catch {
      return '';
    }
  })();
  const territoryLabel = CIRCUNSCRIPCION_CAMPANA || 'Circunscripción activa';

  // Sub-tab state
  const [activeTab, setActiveTab] = useState<'activos' | 'archivados'>('activos');

  // Active platform operating user (strictly bound to logged-in user for territorial roles)
  const [activeOperator, setActiveOperator] = useState<string>(() => {
    if (authUser?.name) {
      return `${authUser.name} (${authUser.roleName || 'Líder Territorial'})`;
    }
    return 'Sin Asignar';
  });

  // Role and Admin privileges (Strict Rule: Only Administrative role can register voters and assign leaders)
  const isAdmin = authUser 
    ? (authUser.role === 'superadmin' || authUser.role === 'administrador')
    : (activeOperator.includes('Administrador') || activeOperator.includes('Coordinador') || activeOperator.includes('Superadmin') || activeOperator.includes('Operación General'));

  // Strict Leader Privacy Rule: Each leader/user can only view their own registered voters
  // Always true for non-admin users
  const [userStrictLeaderModeState, setUserStrictLeaderModeState] = useState<boolean>(true);
  const strictLeaderMode = !isAdmin ? true : userStrictLeaderModeState;

  // Update operator strictly when authUser changes or is present
  useEffect(() => {
    if (authUser?.name) {
      setActiveOperator(`${authUser.name} (${authUser.roleName || 'Líder Territorial'})`);
    }
  }, [authUser]);

  // API Search State
  const [cedulaInput, setCedulaInput] = useState<string>('');
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [consultaResult, setConsultaResult] = useState<CensoConsultaResult | null>(null);
  
  // Registration Form State for Active Voter
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    telefono: '',
    barrio: '',
    liderAsignado: activeOperator,
    intencionVoto: 'Voto Seguro' as VotanteRegistrado['intencionVoto'],
    requiereTransporte: false,
    observaciones: ''
  });

  // Archive Form State (used when archiving a rejected voter)
  const [archiveForm, setArchiveForm] = useState({
    nombreCompleto: '',
    telefono: '',
    liderAsignado: activeOperator,
    observaciones: ''
  });

  // Keep leader form values synchronized when active operator changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, liderAsignado: activeOperator }));
    setArchiveForm(prev => ({ ...prev, liderAsignado: activeOperator }));
  }, [activeOperator]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncingArchived, setIsSyncingArchived] = useState<boolean>(false);

  // State for Reassigning Leader Modal
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    voterId: string;
    voterName: string;
    currentLeader: string;
    voterType: 'activo' | 'archivado';
    selectedNewLeader: string;
  } | null>(null);

  // Duplicate Voter Report Modal State
  const [duplicateReport, setDuplicateReport] = useState<{
    isOpen: boolean;
    record: VotanteRegistrado | VotanteArchivado | null;
    type: 'activo' | 'archivado';
    attemptedCedula: string;
    attemptedByLeader: string;
    attemptTimestamp: string;
  }>({
    isOpen: false,
    record: null,
    type: 'activo',
    attemptedCedula: '',
    attemptedByLeader: '',
    attemptTimestamp: ''
  });

  const handleDownloadDuplicateReportPDF = () => {
    if (!duplicateReport.record) return;
    const r = duplicateReport.record;
    const isActivo = duplicateReport.type === 'activo';

    const doc = new jsPDF();

    // Top Brand Banner
    doc.setFillColor(7, 29, 56); // #071d38
    doc.rect(0, 0, 210, 38, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CAMPAÑA GANADORA AI', 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(45, 212, 191); // Teal accent
    doc.text('REPORTE OFICIAL DE AUDITORÍA Y DUPLICIDAD ELECTORAL', 14, 22);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Fecha y Hora de Generación: ${duplicateReport.attemptTimestamp}`, 14, 30);
    doc.text('SISTEMA DE CONTROL TERRITORIAL', 135, 30);

    // Red Alert Strip
    doc.setFillColor(225, 29, 72); // Rose-600
    doc.rect(14, 44, 182, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ALERTA: REGISTRO BLOQUEADO POR DUPLICIDAD DE CÉDULA', 18, 51.5);

    let y = 64;

    // Section 1: Attempt Info
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 22, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('1. INFORMACIÓN DEL INTENTO DE REGISTRO', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Cédula Consultada: ${duplicateReport.attemptedCedula}`, 18, y + 12);
    doc.text(`Usuario / Líder que Solicitó Registro: ${duplicateReport.attemptedByLeader}`, 18, y + 17);

    y += 28;

    // Section 2: Owner/Leader Registered (Highlighted Box)
    doc.setFillColor(15, 23, 42); // Dark slate bg
    doc.rect(14, y, 182, 30, 'F');

    doc.setTextColor(45, 212, 191); // Teal font
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. LÍDER / PERSONA RESPONSABLE REGISTRADA (TITULAR)', 18, y + 8);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`Líder Asignado: ${r.liderAsignado}`, 18, y + 17);

    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    const fechaReg = 'fechaRegistro' in r ? r.fechaRegistro : r.fechaArchivado;
    doc.text(`Fecha de Registro Inicial en Sistema: ${fechaReg}`, 18, y + 24);

    y += 36;

    // Section 3: Technical Details of Registered Voter
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 70, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, 70, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('3. FICHA TÉCNICA DEL VOTANTE REGISTRADO EN BASE DE DATOS', 18, y + 9);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`• Nombre Completo: ${r.nombreCompleto}`, 18, y + 18);
    doc.text(`• Cédula de Ciudadanía: ${r.cedula}`, 18, y + 25);
    doc.text(`• Teléfono Contacto: ${r.telefono}`, 18, y + 32);
    doc.text(`• Estado en Sistema: ${isActivo ? 'Padrón Activo (Medellín)' : 'Carpeta de Archivados CNE'}`, 18, y + 39);

    const puesto = 'puestoVotacion' in r ? (r as VotanteRegistrado).puestoVotacion : (r as VotanteArchivado).puestoOriginal;
    const mesaStr = 'mesa' in r ? ` (Mesa ${(r as VotanteRegistrado).mesa})` : '';
    const comunaStr = 'comunaSector' in r ? (r as VotanteRegistrado).comunaSector : (r as VotanteArchivado).circunscripcionOriginal;

    doc.text(`• Puesto y Mesa de Votación: ${puesto}${mesaStr}`, 18, y + 46);
    doc.text(`• Comuna / Sector Territorial: ${comunaStr}`, 18, y + 53);

    const obs = ('observaciones' in r ? (r as VotanteRegistrado).observaciones : (r as VotanteArchivado).motivo) || 'Sin observaciones.';
    doc.text(`• Observaciones del Registro: ${obs}`, 18, y + 60);

    y += 80;

    // Footer Certification Stamp
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, 196, y);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Documento oficial generado en formato PDF por la Plataforma Electoral Campaña Ganadora AI.', 14, y + 6);
    doc.text('Certificación válida para resolución de conflictos de asignación territorial y auditoría de votantes.', 14, y + 10);

    doc.save(`Reporte_Duplicidad_CC_${r.cedula}_Lider_${r.liderAsignado.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    showToast('📄 Reporte PDF de Duplicidad descargado exitosamente.');
  };

  const handleShareDuplicateReport = (method: 'whatsapp' | 'clipboard' | 'native') => {
    if (!duplicateReport.record) return;
    const r = duplicateReport.record;
    const isActivo = duplicateReport.type === 'activo';
    const fechaReg = 'fechaRegistro' in r ? r.fechaRegistro : r.fechaArchivado;

    const textSummary = `🚨 *REPORTE DE DUPLICIDAD ELECTORAL - CAMPAÑA GANADORA AI* 🚨

⚠️ *INTENTO DE REGISTRO BLOQUEADO*
• Cédula Consultada: ${duplicateReport.attemptedCedula}
• Solicitado por Líder: ${duplicateReport.attemptedByLeader}
• Fecha/Hora: ${duplicateReport.attemptTimestamp}

👤 *LÍDER / PERSONA TITULAR REGISTRADA*
• *Líder Asignado:* ${r.liderAsignado}
• *Fecha Registro Inicial:* ${fechaReg}

📋 *DATOS DEL VOTANTE REGISTRADO*
• *Nombre:* ${r.nombreCompleto}
• *Cédula:* ${r.cedula}
• *Teléfono:* ${r.telefono}
• *Estado:* ${isActivo ? 'Padrón Activo' : 'Archivado CNE'}
• *Puesto:* ${'puestoVotacion' in r ? r.puestoVotacion : r.puestoOriginal} ${'mesa' in r ? `(Mesa ${r.mesa})` : ''}

_Documento Oficial de Auditoría Electoral - Campaña Ganadora AI_`;

    if (method === 'whatsapp') {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textSummary)}`;
      window.open(url, '_blank');
      showToast('📲 Abriendo WhatsApp para compartir el reporte...');
    } else if (method === 'clipboard') {
      navigator.clipboard.writeText(textSummary);
      showToast('📋 Resumen del reporte de duplicidad copiado al portapapeles.');
    } else if (method === 'native') {
      if (navigator.share) {
        navigator.share({
          title: `Reporte Duplicidad CC ${r.cedula}`,
          text: textSummary
        }).then(() => {
          showToast('✅ Reporte compartido exitosamente.');
        }).catch(() => {
          navigator.clipboard.writeText(textSummary);
          showToast('📋 Resumen del reporte copiado al portapapeles.');
        });
      } else {
        navigator.clipboard.writeText(textSummary);
        showToast('📋 Resumen del reporte copiado al portapapeles.');
      }
    }
  };

  // Initial Active Voters Dataset
  const [votantes, setVotantes] = useState<VotanteRegistrado[]>([
    {
      id: 'v-100a',
      cedula: '1017987654',
      nombreCompleto: 'ALEJANDRO OROZCO OSORIO',
      telefono: '301 555 1234',
      barrio: 'Laureles - San Joaquín',
      comunaSector: 'Comuna 11 - Laureles Estadio',
      puestoVotacion: 'I.E. Marco Fidel Suárez',
      direccionPuesto: 'Cra 70 # 44-51',
      mesa: 5,
      liderAsignado: 'Carlos Ramírez (Coordinador Territorial / Testigo)',
      intencionVoto: 'Voto Seguro',
      requiereTransporte: false,
      observaciones: 'Votante registrado por Carlos Ramírez. Confirmado 100%.',
      fechaRegistro: '2026-08-10',
      estadoCenso: 'Validado API Medellín',
      circunscripcion: 'Medellín - Antioquia'
    },
    {
      id: 'v-100b',
      cedula: '1032445566',
      nombreCompleto: 'DANIELA RESTREPO GIRALDO',
      telefono: '314 777 9900',
      barrio: 'El Poblado - Manila',
      comunaSector: 'Comuna 14 - El Poblado',
      puestoVotacion: 'Inem José Félix de Restrepo',
      direccionPuesto: 'Cra 48 # 1 Sur-125',
      mesa: 12,
      liderAsignado: 'Carlos Ramírez (Coordinador Territorial / Testigo)',
      intencionVoto: 'Simpatizante',
      requiereTransporte: true,
      observaciones: 'Simpatizante clave registrada en jornada territorial.',
      fechaRegistro: '2026-08-09',
      estadoCenso: 'Validado API Medellín',
      circunscripcion: 'Medellín - Antioquia'
    },
    {
      id: 'v-101',
      cedula: '1017123456',
      nombreCompleto: 'CARLOS ALBERTO JARAMILLO MONTOYA',
      telefono: '300 456 7890',
      barrio: 'Laureles - San Joaquín',
      comunaSector: 'Comuna 11 - Laureles Estadio',
      puestoVotacion: 'I.E. Marco Fidel Suárez',
      direccionPuesto: 'Cra 70 # 44-51',
      mesa: 14,
      liderAsignado: 'Carlos Ruiz (Coordinador Comuna 11)',
      intencionVoto: 'Voto Seguro',
      requiereTransporte: true,
      observaciones: 'Simpatizante clave, comprometido con llevar 4 familiares más.',
      fechaRegistro: '2026-08-08',
      estadoCenso: 'Validado API Medellín',
      circunscripcion: 'Medellín - Antioquia'
    },
    {
      id: 'v-102',
      cedula: '1020456789',
      nombreCompleto: 'MARÍA FERNANDA OROZCO RESTREPO',
      telefono: '312 987 6543',
      barrio: 'El Poblado - Manila',
      comunaSector: 'Comuna 14 - El Poblado',
      puestoVotacion: 'Inem José Félix de Restrepo',
      direccionPuesto: 'Cra 48 # 1 Sur-125',
      mesa: 8,
      liderAsignado: 'Ana Patricia Gómez (Coordinadora Comuna 14)',
      intencionVoto: 'Simpatizante',
      requiereTransporte: false,
      observaciones: 'Asistió al foro de jóvenes emprendedores.',
      fechaRegistro: '2026-08-09',
      estadoCenso: 'Validado API Medellín',
      circunscripcion: 'Medellín - Antioquia'
    },
    {
      id: 'v-103',
      cedula: '71345678',
      nombreCompleto: 'JORGE ENRIQUE BEDOYA GÓMEZ',
      telefono: '315 222 1100',
      barrio: 'San Javier Nº 1',
      comunaSector: 'Comuna 13 - San Javier',
      puestoVotacion: 'Escuela San Javier - Escaleras',
      direccionPuesto: 'Calle 44 # 108-20',
      mesa: 22,
      liderAsignado: 'Santi Restrepo (Líder Comuna 13)',
      intencionVoto: 'Voto Seguro',
      requiereTransporte: true,
      observaciones: 'Requiere vehículo accesible para votante adulto mayor.',
      fechaRegistro: '2026-08-10',
      estadoCenso: 'Validado API Medellín',
      circunscripcion: 'Medellín - Antioquia'
    }
  ]);

  // Initial Archived Voters Dataset
  const [archivados, setArchivados] = useState<VotanteArchivado[]>([
    {
      id: 'arc-100',
      cedula: '88990000',
      nombreCompleto: 'PATRICIA ELENA CARDONA VÁSQUEZ',
      telefono: '302 444 1122',
      barrio: 'Laureles - San Joaquín',
      liderAsignado: 'Carlos Ramírez (Coordinador Territorial / Testigo)',
      circunscripcionOriginal: 'Rionegro - Antioquia',
      puestoOriginal: 'I.E. Baldomero Sanín Cano',
      motivo: 'Registrada por Carlos Ramírez. Trámite de traslado en curso.',
      fechaArchivado: '2026-08-04',
      fechaUltimaConsultaApi: '2026-08-10',
      estadoCne: 'En Espera de Traslado CNE'
    },
    {
      id: 'arc-101',
      cedula: '88990011',
      nombreCompleto: 'ANDRÉS FELIPE RINCÓN BUSTAMANTE',
      telefono: '310 888 7766',
      barrio: 'Laureles - Estadio',
      liderAsignado: 'Carlos Ruiz (Coordinador Comuna 11)',
      circunscripcionOriginal: 'Bogotá D.C. - Cundinamarca',
      puestoOriginal: 'Corferias - Pabellón 6',
      motivo: 'Reside en Medellín pero vota en Bogotá. Realizó trámite de inscripción en I.E. Marco Fidel Suárez. Esperando actualización API CNE.',
      fechaArchivado: '2026-08-02',
      fechaUltimaConsultaApi: '2026-08-10',
      estadoCne: 'En Espera de Traslado CNE'
    },
    {
      id: 'arc-102',
      cedula: '99887766',
      nombreCompleto: 'LINA MARÍA OCAMPO BOTERO',
      telefono: '314 555 4433',
      barrio: 'El Poblado - Manila',
      liderAsignado: 'Ana Patricia Gómez (Coordinadora Comuna 14)',
      circunscripcionOriginal: 'Envigado - Antioquia',
      puestoOriginal: 'I.E. Comercial de Envigado',
      motivo: 'Solicitó cambio de puesto a Inem José Félix de Restrepo en jornada especial de la Registraduría.',
      fechaArchivado: '2026-08-05',
      fechaUltimaConsultaApi: '2026-08-10',
      estadoCne: 'En Espera de Traslado CNE'
    }
  ]);

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    const unsubVotantes = subscribeVoters((data) => {
      setVotantes(data);
    });
    const unsubArchivados = subscribeArchivedVoters((data) => {
      setArchivados(data);
    });
    return () => {
      unsubVotantes();
      unsubArchivados();
    };
  }, []);

  // List Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [comunaFilter, setComunaFilter] = useState('Todas');
  const [intencionFilter, setIntencionFilter] = useState('Todas');
  const [liderFilter, setLiderFilter] = useState('Todas');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // API Call Handler
  const handleConsultarCenso = async (cedulaToSearch?: string) => {
    const targetCedula = (cedulaToSearch || cedulaInput).trim();
    if (!targetCedula) {
      showToast('Por favor ingrese un número de cédula válido para consultar.');
      return;
    }
    if (!CIRCUNSCRIPCION_CAMPANA) {
      showToast('Seleccione una campaña con circunscripción antes de consultar el censo.');
      return;
    }

    // DUPLICATE VOTER CHECK: Check if voter was already registered by someone in active or archived lists
    const existingActive = votantes.find(v => v.cedula.trim() === targetCedula);
    const existingArchived = archivados.find(a => a.cedula.trim() === targetCedula);

    if (existingActive || existingArchived) {
      const record = existingActive || existingArchived!;
      setDuplicateReport({
        isOpen: true,
        record,
        type: existingActive ? 'activo' : 'archivado',
        attemptedCedula: targetCedula,
        attemptedByLeader: activeOperator,
        attemptTimestamp: new Date().toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      showToast(`⚠️ DUPLICIDAD DETECTADA: La C.C. ${targetCedula} ya fue registrada previamente por el líder ${record.liderAsignado}.`);
      return;
    }

    setIsConsulting(true);
    setConsultaResult(null);

    try {
      const res = await consultarCensoElectoralAPI(targetCedula, CIRCUNSCRIPCION_CAMPANA);
      setConsultaResult(res);

      if (res.encontrado && res.esCircunscripcionPermitida) {
        setFormData(prev => ({
          ...prev,
          nombreCompleto: res.nombreCompleto || prev.nombreCompleto,
          barrio: res.comunaSector || prev.barrio,
          liderAsignado: activeOperator
        }));
        showToast('✅ Ciudadano verificado en el censo de la campaña. Puede proceder al registro.');
      } else {
        // Pre-fill archive form with name and info from CNE response if available
        setArchiveForm(prev => ({
          ...prev,
          nombreCompleto: res.nombreCompleto || prev.nombreCompleto || `Ciudadano C.C. ${res.cedula}`,
          liderAsignado: activeOperator,
          observaciones: res.mensajeRespuesta || ''
        }));
        showToast('ℹ️ Ciudadano fuera de la circunscripción activa. Puede archivarlo para monitorear su traslado.');
      }
    } catch (err) {
      showToast('Error al conectar con la API de Censo Electoral.');
    } finally {
      setIsConsulting(false);
    }
  };

  // Register Active Voter
  const handleRegisterVotante = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      alert('🔒 ACCESO RESTRINGIDO: Solo los usuarios con Rol Administrativo tienen permisos para registrar votantes en el padrón electoral y asignarles el líder correspondiente.');
      showToast('🔒 Permiso denegado: El registro de votantes y asignación de líderes es exclusivo del Rol Administrativo.');
      return;
    }

    if (!consultaResult || !consultaResult.encontrado || !consultaResult.esCircunscripcionPermitida) {
      alert('🔒 BLOQUEO DE SEGURIDAD: Solo se pueden registrar ciudadanos validados en el censo electoral de la campaña.');
      return;
    }

    if (!formData.nombreCompleto.trim() || !formData.telefono.trim()) {
      alert('Por favor complete el Nombre Completo y Teléfono del votante.');
      return;
    }

    const existingActive = votantes.find(v => v.cedula.trim() === consultaResult.cedula.trim());
    const existingArchived = archivados.find(a => a.cedula.trim() === consultaResult.cedula.trim());

    if (existingActive || existingArchived) {
      const record = existingActive || existingArchived!;
      setDuplicateReport({
        isOpen: true,
        record,
        type: existingActive ? 'activo' : 'archivado',
        attemptedCedula: consultaResult.cedula,
        attemptedByLeader: activeOperator,
        attemptTimestamp: new Date().toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      return;
    }

    const nuevoVotante: VotanteRegistrado = {
      id: `v-${Date.now()}`,
      cedula: consultaResult.cedula,
      nombreCompleto: formData.nombreCompleto,
      telefono: formData.telefono,
      barrio: formData.barrio || 'No especificado',
      comunaSector: consultaResult.comunaSector || 'Sin sector asignado',
      puestoVotacion: consultaResult.puestoVotacion || 'Puesto Central',
      direccionPuesto: consultaResult.direccionPuesto || 'Sede Electoral',
      mesa: consultaResult.mesa || 1,
      liderAsignado: formData.liderAsignado,
      intencionVoto: formData.intencionVoto,
      requiereTransporte: formData.requiereTransporte,
      observaciones: formData.observaciones,
      fechaRegistro: new Date().toISOString().split('T')[0],
      estadoCenso: 'Validado API Medellín',
      circunscripcion: CIRCUNSCRIPCION_CAMPANA
    };

    try {
      await addVoterDoc(nuevoVotante);
    } catch (error) {
      console.error('No fue posible guardar el votante.', error);
      showToast('No fue posible guardar el votante en la base de datos.');
      return;
    }
    showToast(`¡Votante ${nuevoVotante.nombreCompleto} registrado exitosamente asignado a ${nuevoVotante.liderAsignado}!`);

    // Reset Form
    setCedulaInput('');
    setConsultaResult(null);
    setFormData({
      nombreCompleto: '',
      telefono: '',
      barrio: '',
      liderAsignado: activeOperator,
      intencionVoto: 'Voto Seguro',
      requiereTransporte: false,
      observaciones: ''
    });
  };

  // Archive Rejected Voter Workflow
  const handleArchivarCiudadano = async () => {
    if (!isAdmin) {
      alert('🔒 ACCESO RESTRINGIDO: Solo los usuarios con Rol Administrativo tienen permisos para archivar votantes y asignarles el líder correspondiente.');
      showToast('🔒 Permiso denegado: El archivo de votantes y asignación de líderes es exclusivo del Rol Administrativo.');
      return;
    }

    if (!consultaResult) return;

    if (!archiveForm.nombreCompleto.trim() || !archiveForm.telefono.trim()) {
      alert('Por favor ingrese el Nombre Completo y Teléfono de contacto para archivar.');
      return;
    }

    // Check if already in active or archived lists
    const existingActive = votantes.find(v => v.cedula.trim() === consultaResult.cedula.trim());
    const existingArchived = archivados.find(a => a.cedula.trim() === consultaResult.cedula.trim());

    if (existingActive || existingArchived) {
      const record = existingActive || existingArchived!;
      setDuplicateReport({
        isOpen: true,
        record,
        type: existingActive ? 'activo' : 'archivado',
        attemptedCedula: consultaResult.cedula,
        attemptedByLeader: activeOperator,
        attemptTimestamp: new Date().toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      return;
    }

    const nuevoArchivado: VotanteArchivado = {
      id: `arc-${Date.now()}`,
      cedula: consultaResult.cedula,
      nombreCompleto: archiveForm.nombreCompleto,
      telefono: archiveForm.telefono,
      barrio: 'Territorio por confirmar',
      liderAsignado: archiveForm.liderAsignado,
      circunscripcionOriginal: consultaResult.circunscripcionCiudadano || 'Otra Circunscripción / No Inscrito',
      puestoOriginal: consultaResult.puestoVotacion ? `${consultaResult.municipio} - ${consultaResult.puestoVotacion}` : 'Sin puesto confirmado',
      motivo: archiveForm.observaciones || 'Registrado en otra circunscripción. Solicitó traslado al territorio de la campaña.',
      fechaArchivado: new Date().toISOString().split('T')[0],
      fechaUltimaConsultaApi: new Date().toISOString().split('T')[0],
      estadoCne: 'En Espera de Traslado CNE'
    };

    try {
      await addArchivedVoterDoc(nuevoArchivado);
    } catch (error) {
      console.error('No fue posible archivar el ciudadano.', error);
      showToast('No fue posible guardar el registro archivado.');
      return;
    }
    showToast(`📁 Ciudadano ${nuevoArchivado.nombreCompleto} guardado en la Carpeta de Archivados asignado a ${nuevoArchivado.liderAsignado}.`);

    // Reset API Search & Archive Form
    setCedulaInput('');
    setConsultaResult(null);
    setArchiveForm({
      nombreCompleto: '',
      telefono: '',
      liderAsignado: activeOperator,
      observaciones: ''
    });
  };

  // Reassignment Action
  const handleOpenReassignModal = (voterId: string, voterName: string, currentLeader: string, voterType: 'activo' | 'archivado') => {
    if (!isAdmin) {
      showToast('🔒 Acceso Denegado: Solo los administradores de la plataforma pueden reasignar votantes entre líderes.');
      return;
    }
    setReassignModal({
      isOpen: true,
      voterId,
      voterName,
      currentLeader,
      voterType,
      selectedNewLeader: currentLeader
    });
  };

  const handleConfirmReassign = () => {
    if (!reassignModal) return;

    const { voterId, voterName, voterType, selectedNewLeader } = reassignModal;

    if (voterType === 'activo') {
      updateVoterDoc(voterId, { liderAsignado: selectedNewLeader }).catch(err => console.error('Error reassigning voter:', err));
      setVotantes(prev => prev.map(v => v.id === voterId ? { ...v, liderAsignado: selectedNewLeader } : v));
    } else {
      updateArchivedVoterDoc(voterId, { liderAsignado: selectedNewLeader }).catch(err => console.error('Error reassigning archived voter:', err));
      setArchivados(prev => prev.map(a => a.id === voterId ? { ...a, liderAsignado: selectedNewLeader } : a));
    }

    showToast(`✅ Votante ${voterName} reasignado exitosamente a: ${selectedNewLeader}`);
    setReassignModal(null);
  };

  // Batch Check CNE API for all Archived Voters
  const handleSyncAllArchived = async () => {
    setIsSyncingArchived(true);
    let countUpdated = 0;

    try {
      const updatedList = await Promise.all(
        archivados.map(async (item) => {
          const res = await verificarActualizacionPuestoAPI(item.cedula, false);
          if (res.trasladadoAMedellin && res.puestoNuevo) {
            countUpdated++;
            return {
              ...item,
              estadoCne: '¡LUGAR ACTUALIZADO A MEDELLÍN!' as const,
              puestoNuevoMedellin: {
                puestoVotacion: res.puestoNuevo.puestoVotacion,
                comunaSector: res.puestoNuevo.comunaSector,
                direccionPuesto: res.puestoNuevo.direccionPuesto,
                mesa: res.puestoNuevo.mesa,
                fechaInscripcion: res.puestoNuevo.fechaInscripcion
              },
              fechaUltimaConsultaApi: new Date().toISOString().split('T')[0]
            };
          }
          return {
            ...item,
            fechaUltimaConsultaApi: new Date().toISOString().split('T')[0]
          };
        })
      );

      setArchivados(updatedList);

      if (countUpdated > 0) {
        showToast(`🔔 ¡ALERTA CNE! Se detectaron ${countUpdated} actualización(es) de puesto a Medellín en la carpeta de archivados.`);
      } else {
        showToast('Sincronización con API CNE completada. No se detectan nuevos traslados aprobados por el momento.');
      }
    } catch (err) {
      showToast('Error durante la sincronización masiva con la API de Censo.');
    } finally {
      setIsSyncingArchived(false);
    }
  };

  // Simulate CNE Update for Testing
  const handleSimularActualizacionCne = async (id: string) => {
    const target = archivados.find(a => a.id === id);
    if (!target) return;

    setIsSyncingArchived(true);
    const res = await verificarActualizacionPuestoAPI(target.cedula, true);
    setIsSyncingArchived(false);

    if (res.trasladadoAMedellin && res.puestoNuevo) {
      setArchivados(prev => prev.map(a => {
        if (a.id === id) {
          return {
            ...a,
            estadoCne: '¡LUGAR ACTUALIZADO A MEDELLÍN!',
            puestoNuevoMedellin: {
              puestoVotacion: res.puestoNuevo!.puestoVotacion,
              comunaSector: res.puestoNuevo!.comunaSector,
              direccionPuesto: res.puestoNuevo!.direccionPuesto,
              mesa: res.puestoNuevo!.mesa,
              fechaInscripcion: res.puestoNuevo!.fechaInscripcion
            },
            fechaUltimaConsultaApi: new Date().toISOString().split('T')[0]
          };
        }
        return a;
      }));

      showToast(`🔔 ¡NOTIFICACIÓN CNE! La Registraduría actualizó el puesto de ${target.nombreCompleto} a ${res.puestoNuevo.puestoVotacion} (Medellín).`);
    }
  };

  // One-click Transfer from Archived to Active Voters
  const handleTransferirAActivo = async (archivado: VotanteArchivado) => {
    const puestoInfo = archivado.puestoNuevoMedellin || {
      puestoVotacion: 'I.E. Marco Fidel Suárez',
      comunaSector: 'Comuna 11 - Laureles',
      direccionPuesto: 'Cra 70 # 44-51',
      mesa: 14,
      fechaInscripcion: new Date().toISOString().split('T')[0]
    };

    const nuevoVotanteActivo: VotanteRegistrado = {
      id: `v-${Date.now()}`,
      cedula: archivado.cedula,
      nombreCompleto: archivado.nombreCompleto,
      telefono: archivado.telefono,
      barrio: archivado.barrio || 'Medellín',
      comunaSector: puestoInfo.comunaSector,
      puestoVotacion: puestoInfo.puestoVotacion,
      direccionPuesto: puestoInfo.direccionPuesto,
      mesa: puestoInfo.mesa,
      liderAsignado: archivado.liderAsignado,
      intencionVoto: 'Voto Seguro',
      requiereTransporte: false,
      observaciones: `Trasladado desde Carpeta de Archivados. Puesto actualizado el ${puestoInfo.fechaInscripcion}.`,
      fechaRegistro: new Date().toISOString().split('T')[0],
      estadoCenso: 'Validado API Medellín',
      circunscripcion: CIRCUNSCRIPCION_CAMPANA
    };

    try {
      await addVoterDoc(nuevoVotanteActivo);
      await deleteArchivedVoterDoc(archivado.id);
    } catch (error) {
      console.error('No fue posible transferir el votante.', error);
      showToast('No fue posible transferir el votante al padrón activo.');
      return;
    }

    showToast(`🎉 ¡Votante ${archivado.nombreCompleto} transferido exitosamente al Padrón Activo asignado a ${archivado.liderAsignado}!`);
  };

  const handleDeleteVotante = async (id: string) => {
    if (window.confirm('¿Desea eliminar este votante del registro territorial?')) {
      try {
        await deleteVoterDoc(id);
        showToast('Votante eliminado del registro.');
      } catch (error) {
        console.error('No fue posible eliminar el votante.', error);
        showToast('No fue posible eliminar el votante.');
      }
    }
  };

  const handleDeleteArchivado = async (id: string) => {
    if (window.confirm('¿Desea eliminar este registro de la carpeta de archivados?')) {
      try {
        await deleteArchivedVoterDoc(id);
        showToast('Registro eliminado de la carpeta de archivados.');
      } catch (error) {
        console.error('No fue posible eliminar el registro archivado.', error);
        showToast('No fue posible eliminar el registro archivado.');
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['Cedula', 'NombreCompleto', 'Telefono', 'Comuna', 'PuestoVotacion', 'Mesa', 'LiderAsignado', 'IntencionVoto', 'Transporte', 'EstadoCenso'];
    const rows = filteredVotantes.map(v => [
      v.cedula,
      `"${v.nombreCompleto}"`,
      v.telefono,
      `"${v.comunaSector}"`,
      `"${v.puestoVotacion}"`,
      v.mesa,
      `"${v.liderAsignado}"`,
      v.intencionVoto,
      v.requiereTransporte ? 'SI' : 'NO',
      v.estadoCenso
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Votantes_Medellin_Campana2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte CSV de Votantes descargado.');
  };

  // Filtered Active Votantes List (Enforces Privacy Rule: Each leader/user only sees their own registered voters)
  const filteredVotantes = votantes.filter(v => {
    const isMyVoter = v.liderAsignado.toLowerCase().includes(activeOperator.toLowerCase()) || 
                      v.liderAsignado.toLowerCase().includes((authUser?.name || '').toLowerCase());

    // REGLA: cada lider o usuario solo puede ver sus votantes registrados
    if (strictLeaderMode && !isMyVoter) {
      return false;
    }

    const matchesSearch = v.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.cedula.includes(searchTerm) ||
                          v.puestoVotacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.liderAsignado.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesComuna = comunaFilter === 'Todas' || v.comunaSector.includes(comunaFilter);
    const matchesIntencion = intencionFilter === 'Todas' || v.intencionVoto === intencionFilter;
    
    // Leader Filter
    const matchesLider = liderFilter === 'Todas'
      ? true
      : liderFilter === 'Mis Votantes'
      ? isMyVoter
      : v.liderAsignado.toLowerCase().includes(liderFilter.toLowerCase());

    return matchesSearch && matchesComuna && matchesIntencion && matchesLider;
  });

  // Filtered Archived List (Enforces Privacy Rule)
  const filteredArchivados = archivados.filter(a => {
    const isMyArchived = a.liderAsignado.toLowerCase().includes(activeOperator.toLowerCase()) ||
                         a.liderAsignado.toLowerCase().includes((authUser?.name || '').toLowerCase());

    // REGLA: cada lider o usuario solo puede ver sus votantes archivados
    if (strictLeaderMode && !isMyArchived) {
      return false;
    }

    const matchesSearch = a.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.cedula.includes(searchTerm) ||
                          a.liderAsignado.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Calculate Metrics
  const totalVotantes = votantes.length;
  const myVotantesCount = votantes.filter(v => 
    v.liderAsignado.toLowerCase().includes(activeOperator.toLowerCase()) || 
    v.liderAsignado.toLowerCase().includes((authUser?.name || '').toLowerCase())
  ).length;

  const totalArchivados = archivados.length;
  const myArchivadosCount = archivados.filter(a => 
    a.liderAsignado.toLowerCase().includes(activeOperator.toLowerCase()) || 
    a.liderAsignado.toLowerCase().includes((authUser?.name || '').toLowerCase())
  ).length;

  const totalNotificacionesNuevas = (strictLeaderMode ? filteredArchivados : archivados)
    .filter(a => a.estadoCne === '¡LUGAR ACTUALIZADO A MEDELLÍN!').length;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-800">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-[100] bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl shadow-2xl border border-teal-400/40 text-xs font-extrabold flex items-center gap-2 max-w-md"
          >
            <Sparkles className="w-4 h-4 text-teal-200 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REASSIGN LEADER MODAL */}
      <AnimatePresence>
        {reassignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#030d1d] rounded-3xl p-6 shadow-2xl border border-cyan-500/30 max-w-md w-full space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-teal-400" />
                  Reasignar Líder / Usuario de Campaña
                </h3>
                <button
                  onClick={() => setReassignModal(null)}
                  className="text-slate-400 hover:text-white font-extrabold text-sm p-1 rounded-lg transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[#020712] p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">Votante:</span>
                  <span className="font-extrabold text-white text-sm">{reassignModal.voterName}</span>
                  <div className="text-slate-400 text-[11px] pt-1">
                    Líder Actual: <strong className="text-teal-300 font-bold">{reassignModal.currentLeader}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Seleccione el Nuevo Líder o Usuario Asignado:
                  </label>
                  <select
                    value={reassignModal.selectedNewLeader}
                    onChange={(e) => setReassignModal({ ...reassignModal, selectedNewLeader: e.target.value })}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 outline-none focus:border-teal-400 cursor-pointer"
                  >
                    {authUser?.name ? (
                      <option value={`${authUser.name} (${authUser.roleName || 'Usuario Campaña'})`}>
                        📌 Mi Usuario: {authUser.name} ({authUser.roleName || 'Logueado'})
                      </option>
                    ) : (
                      <option value="Sin Asignar">Sin Asignar</option>
                    )}
                    {LISTA_MIEMBROS_CAMPAÑA.map(m => (
                      <option key={m.id} value={`${m.nombre} (${m.cargo})`}>
                        👤 {m.nombre} - {m.cargo} ({m.comunaZone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassignModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer border border-slate-750"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReassign}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Reasignación</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DUPLICATE VOTER REPORT MODAL */}
      <AnimatePresence>
        {duplicateReport.isOpen && duplicateReport.record && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#030d1d] border-2 border-rose-500/60 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden text-slate-200 my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-rose-950 via-red-950 to-slate-950 text-white p-6 relative border-b border-rose-900/60">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-2xl text-rose-300">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2.5 py-0.5 rounded-full inline-block mb-1">
                      REPORTE OFICIAL DE DUPLICIDAD ELECTORAL
                    </span>
                    <h3 className="text-xl font-black text-white leading-tight">
                      Votante Previamente Registrado
                    </h3>
                    <p className="text-xs text-rose-200 mt-0.5">
                      Se ha detectado una coincidencia de Cédula de Ciudadanía en la base de datos de la campaña.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDuplicateReport(prev => ({ ...prev, isOpen: false }))}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* INTENTO BANNER */}
                <div className="bg-rose-950/40 border border-rose-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-extrabold text-rose-300 block uppercase tracking-wider text-[11px]">
                      Detalles del Intento de Registro:
                    </span>
                    <p className="text-slate-200">
                      <strong>Líder / Usuario Solicitante:</strong> {duplicateReport.attemptedByLeader}
                    </p>
                    <p className="text-slate-400 font-mono text-[10px]">
                      Fecha/Hora del Intento: {duplicateReport.attemptTimestamp} | C.C. {duplicateReport.attemptedCedula}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-rose-600 text-white font-mono font-black rounded-lg text-[10px] uppercase shrink-0 shadow">
                    Registro Bloqueado por Duplicidad
                  </span>
                </div>

                {/* LÍDER / PERSONA RELACIONADA REGISTRADA (DESTACADO) */}
                <div className="bg-[#020712] text-white p-5 rounded-2xl border border-teal-500/40 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-teal-500/30 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-teal-400" />
                      Líder / Persona Responsable Relacionada
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/30 text-teal-200 border border-teal-400/40">
                      Titular del Registro Previo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Nombre del Líder / Coordinador Asignado:
                      </span>
                      <strong className="text-base text-teal-200 font-black block mt-0.5">
                        {duplicateReport.record.liderAsignado}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Fecha del Registro Inicial:
                      </span>
                      <strong className="text-sm text-white font-bold block mt-0.5 font-mono">
                        {'fechaRegistro' in duplicateReport.record ? duplicateReport.record.fechaRegistro : duplicateReport.record.fechaArchivado}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* FICHA TÉCNICA DEL VOTANTE */}
                <div className="border border-slate-800 rounded-2xl p-4 bg-[#020712] space-y-3">
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-400" />
                    Ficha Técnica del Votante Relacionado
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Nombre Completo:</span>
                      <strong className="text-slate-100 text-sm font-black">{duplicateReport.record.nombreCompleto}</strong>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Cédula de Ciudadanía:</span>
                      <strong className="text-slate-100 text-sm font-mono font-black">{duplicateReport.record.cedula}</strong>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Teléfono Registrado:</span>
                      <span className="text-slate-200 font-mono font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-teal-400" /> {duplicateReport.record.telefono}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Estado en Sistema:</span>
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] mt-0.5 ${
                        duplicateReport.type === 'activo' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}>
                        {duplicateReport.type === 'activo' ? 'Padrón Activo (Medellín)' : 'Carpeta de Archivados CNE'}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Puesto y Mesa de Votación:</span>
                      <span className="text-slate-200 font-bold block">
                        {'puestoVotacion' in duplicateReport.record ? (duplicateReport.record as VotanteRegistrado).puestoVotacion : (duplicateReport.record as VotanteArchivado).puestoOriginal}
                        {'mesa' in duplicateReport.record ? ` (Mesa ${(duplicateReport.record as VotanteRegistrado).mesa})` : ''}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {'comunaSector' in duplicateReport.record ? (duplicateReport.record as VotanteRegistrado).comunaSector : (duplicateReport.record as VotanteArchivado).circunscripcionOriginal}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Observaciones Registradas:</span>
                      <p className="text-slate-300 italic text-[11px] mt-0.5">
                        {('observaciones' in duplicateReport.record ? (duplicateReport.record as VotanteRegistrado).observaciones : (duplicateReport.record as VotanteArchivado).motivo) || 'Sin observaciones.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer / Actions */}
              <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Left Action Buttons: Download PDF & Share */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleDownloadDuplicateReportPDF}
                      className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4 text-rose-200" />
                      <span>Descargar Reporte PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareDuplicateReport('whatsapp')}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                      title="Compartir por WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareDuplicateReport('clipboard')}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md border border-slate-700"
                      title="Copiar resumen al portapapeles"
                    >
                      <Copy className="w-3.5 h-3.5 text-teal-400" />
                      <span>Copiar Resumen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareDuplicateReport('native')}
                      className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                      title="Compartir con otras apps"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartir</span>
                    </button>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const rec = duplicateReport.record;
                          setDuplicateReport(prev => ({ ...prev, isOpen: false }));
                          if (rec) {
                            handleOpenReassignModal(rec.id, rec.nombreCompleto, rec.liderAsignado, duplicateReport.type);
                          }
                        }}
                        className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <UserCog className="w-4 h-4" />
                        <span>Gestionar Reasignación</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDuplicateReport(prev => ({ ...prev, isOpen: false }))}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer border border-slate-700"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#071d38] via-[#0b294d] to-[#05162a] border border-teal-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden text-white space-y-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Módulo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300">Registro de Votantes</span>
            </h1>
          </div>

          {/* QUICK METRICS */}
          <div className="grid grid-cols-3 gap-3 shrink-0 lg:w-96 font-mono">
            <div className="bg-[#030e1c] p-3 rounded-2xl border border-teal-500/30 text-center">
              <span className="block text-2xl font-black text-teal-300">
                {strictLeaderMode ? myVotantesCount : totalVotantes}
              </span>
              <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold block">
                {strictLeaderMode ? `Tus votantes · ${territoryLabel}` : `Padrón total · ${territoryLabel}`}
              </span>
            </div>

            <div className="bg-[#030e1c] p-3 rounded-2xl border border-amber-500/30 text-center relative">
              <span className="block text-2xl font-black text-amber-400">
                {strictLeaderMode ? myArchivadosCount : totalArchivados}
              </span>
              <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold block">
                {strictLeaderMode ? 'Tus Archivados CNE' : 'Archivados Total CNE'}
              </span>
            </div>

            <div className={`p-3 rounded-2xl text-center relative transition-all ${
              totalNotificacionesNuevas > 0 
                ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-lg shadow-emerald-900/50 animate-pulse' 
                : 'bg-[#030e1c] border border-slate-700'
            }`}>
              <span className="block text-2xl font-black text-emerald-300">{totalNotificacionesNuevas}</span>
              <span className="text-[9px] text-slate-300 font-sans uppercase font-extrabold flex items-center justify-center gap-1">
                <Bell className="w-3 h-3 text-emerald-400" /> Traslados Novedad
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('activos')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'activos'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-teal-200" />
            <span>Padrón activo ({territoryLabel})</span>
            <span className="px-2 py-0.5 rounded-full bg-black/40 text-teal-200 text-[10px] font-mono">
              {filteredVotantes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('archivados')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'archivados'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg'
                : 'bg-slate-900/80 text-amber-300/80 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-amber-300" />
            <span>Carpeta de Archivados (Fuera de Circunscripción)</span>
            <span className="px-2 py-0.5 rounded-full bg-black/40 text-amber-200 text-[10px] font-mono">
              {filteredArchivados.length}
            </span>

            {totalNotificacionesNuevas > 0 && (
              <span className="px-2 py-0.5 bg-emerald-500 text-white font-extrabold text-[9px] rounded-full animate-bounce flex items-center gap-1">
                <BellRing className="w-3 h-3" /> {totalNotificacionesNuevas} listo(s)
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'activos' ? (
        /* ==================== VIEW 1: REGISTRO & PADRÓN ACTIVO ==================== */
        <div className="space-y-6">
          {/* SECTION 1: CONSULTA API & REGISTRO WORKFLOW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* API CONSULTA CARD (LEFT 5 COLS) */}
            <div className="lg:col-span-5 bg-[#030d1d] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-5 text-white">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <SearchCheck className="w-5 h-5 text-teal-400" />
                  1. Consulta de Censo vía API CNE
                </h2>
              </div>

              {/* Search Input Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1">
                    Número de Cédula de Ciudadanía:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: 1017123456"
                      value={cedulaInput}
                      onChange={(e) => setCedulaInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleConsultarCenso()}
                      className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-100 outline-none focus:border-teal-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleConsultarCenso()}
                      disabled={isConsulting}
                      className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isConsulting ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          <span>Consultando...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>Consultar CNE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>

              {/* API CONSULTA RESULT BOX */}
              <AnimatePresence mode="wait">
                {consultaResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {consultaResult.encontrado && consultaResult.esCircunscripcionPermitida ? (
                      /* SUCCESS RESULT: VALID IN MEDELLÍN */
                      <div className="bg-[#020712] border border-emerald-500/40 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                          <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Aprobado para Registro Directo
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                            {consultaResult.estadoCedula}
                          </span>
                        </div>

                        <div className="text-xs space-y-1.5 text-slate-200">
                          <div>
                            <span className="text-slate-400 text-[11px] block">Nombre registrado en Censo:</span>
                            <strong className="text-white font-extrabold text-sm">{consultaResult.nombreCompleto}</strong>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                              <span className="text-[9px] text-slate-400 block uppercase font-sans font-bold">Circunscripción</span>
                              <span className="font-bold text-teal-300">{consultaResult.municipio} ({consultaResult.departamento})</span>
                            </div>

                            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                              <span className="text-[9px] text-slate-400 block uppercase font-sans font-bold">Comuna / Sector</span>
                              <span className="font-bold text-teal-300">{consultaResult.comunaSector}</span>
                            </div>
                          </div>

                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-200 text-[11px] font-bold flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-teal-400" /> Puesto: {consultaResult.puestoVotacion}
                              </span>
                              <span className="text-xs font-mono font-black text-teal-300 bg-teal-950/80 border border-teal-500/30 px-2 py-0.5 rounded">
                                Mesa {consultaResult.mesa}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Dirección: {consultaResult.direccionPuesto}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-emerald-300 font-medium leading-relaxed bg-emerald-950/50 p-2 rounded-xl border border-emerald-500/30">
                          {consultaResult.mensajeRespuesta}
                        </p>
                      </div>
                    ) : (
                      /* REJECTION RESULT: OUTSIDE DISTRICT -> ARCHIVE ACTION OFFERED */
                      <div className="bg-[#020712] border border-amber-500/40 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                          <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            NO CENSADO EN MEDELLÍN
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                            {consultaResult.encontrado ? consultaResult.municipio : 'No Inscrito'}
                          </span>
                        </div>

                        <p className="text-xs text-amber-200 font-semibold leading-relaxed bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                          {consultaResult.mensajeRespuesta}
                        </p>

                        <div className="text-[10px] text-amber-300 bg-amber-950/50 p-2 rounded-xl flex items-start gap-2 border border-amber-500/30">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Regla de Campaña:</strong> Guarde este registro en la <strong>Carpeta de Archivados</strong> para que el software monitoree cuando la Registraduría actualice su puesto a Medellín.
                          </span>
                        </div>

                        {/* ARCHIVE FORM EMBEDDED */}
                        <div className="bg-slate-900/90 p-3 rounded-2xl border border-amber-500/30 space-y-2.5 text-xs">
                          <span className="font-extrabold text-amber-300 flex items-center gap-1.5 text-xs">
                            <FolderArchive className="w-4 h-4 text-amber-400" />
                            Archivar y Monitorear Traslado CNE
                          </span>

                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-300">Nombre Completo:</label>
                              <input
                                type="text"
                                placeholder="Nombre completo..."
                                value={archiveForm.nombreCompleto}
                                onChange={(e) => setArchiveForm({ ...archiveForm, nombreCompleto: e.target.value })}
                                className="w-full bg-[#020712] border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-300">Teléfono / WhatsApp:</label>
                              <input
                                type="text"
                                placeholder="Ej: 300 123 4567"
                                value={archiveForm.telefono}
                                onChange={(e) => setArchiveForm({ ...archiveForm, telefono: e.target.value })}
                                className="w-full bg-[#020712] border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-300">Líder o Miembro Asignado:</label>
                              <select
                                value={archiveForm.liderAsignado}
                                onChange={(e) => setArchiveForm({ ...archiveForm, liderAsignado: e.target.value })}
                                className="w-full bg-[#020712] border border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-100 cursor-pointer"
                              >
                                {authUser?.name ? (
                                  <option value={`${authUser.name} (${authUser.roleName || 'Usuario Campaña'})`}>
                                    👤 Mi Usuario: {authUser.name} ({authUser.roleName || 'Logueado'})
                                  </option>
                                ) : (
                                  <option value="Sin Asignar">Sin Asignar</option>
                                )}
                                {LISTA_MIEMBROS_CAMPAÑA.map(m => (
                                  <option key={m.id} value={`${m.nombre} (${m.cargo})`}>
                                    👥 {m.nombre} - {m.cargo} ({m.comunaZone})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-300">Observaciones del Traslado:</label>
                              <input
                                type="text"
                                placeholder="Ej: Inscripción realizada en Puesto Marco Fidel Suárez el 05/Ago..."
                                value={archiveForm.observaciones}
                                onChange={(e) => setArchiveForm({ ...archiveForm, observaciones: e.target.value })}
                                className="w-full bg-[#020712] border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                              />
                            </div>
                          </div>

                          {!isAdmin ? (
                            <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
                              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Archivo Restringido: Exclusivo para Rol Administrativo</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleArchivarCiudadano}
                              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Inbox className="w-4 h-4" />
                              <span>Guardar en Carpeta de Archivados (Rol Admin)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* FORMULARIO DE REGISTRO DE VOTANTE ACTIVO (RIGHT 7 COLS) */}
            <div className="lg:col-span-7 bg-[#030d1d] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between text-white">
              <div>
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-teal-400" />
                      2. Datos Complementarios y Asignación de Líder
                    </h2>
                  </div>

                  {consultaResult && consultaResult.encontrado && consultaResult.esCircunscripcionPermitida ? (
                    <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" /> Censo Verificado
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-bold rounded-full">
                      Requiere Validación API
                    </span>
                  )}
                </div>

                {/* FORM */}
                <form onSubmit={handleRegisterVotante} className="space-y-4 pt-3">
                  {!isAdmin && (
                    <div className="bg-amber-950/60 border border-amber-500/40 p-3 rounded-2xl flex items-center gap-2.5 text-amber-300 text-xs font-medium">
                      <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <strong className="block font-black text-amber-200 uppercase text-[10px] tracking-wider">
                          🔒 Acceso Restringido a Rol Administrativo
                        </strong>
                        <span>La inscripción de votantes y asignación de líderes correspondientes es una facultad exclusiva de los usuarios administradores.</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Nombre Completo del Votante:
                      </label>
                      <input
                        type="text"
                        disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                        placeholder="Auto-completado por API o Manual..."
                        value={formData.nombreCompleto}
                        onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                        className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-teal-400 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Teléfono / WhatsApp:
                      </label>
                      <input
                        type="text"
                        disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                        placeholder="Ej: 300 123 4567"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-teal-400 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Barrio de Residencia:
                      </label>
                      <input
                        type="text"
                        disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                        placeholder="Ej: Laureles, Aranjuez, Robledo..."
                        value={formData.barrio}
                        onChange={(e) => setFormData({ ...formData, barrio: e.target.value })}
                        className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-teal-400 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-teal-400" /> Líder o Miembro de Campaña Asignado:
                      </label>
                      <select
                        disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                        value={formData.liderAsignado}
                        onChange={(e) => setFormData({ ...formData, liderAsignado: e.target.value })}
                        className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-100 outline-none focus:border-teal-400 disabled:opacity-50 cursor-pointer"
                      >
                        {authUser?.name ? (
                          <option value={`${authUser.name} (${authUser.roleName || 'Usuario Campaña'})`}>
                            📌 Mi Usuario: {authUser.name} ({authUser.roleName})
                          </option>
                        ) : (
                          <option value="Sin Asignar">Sin Asignar</option>
                        )}
                        {LISTA_MIEMBROS_CAMPAÑA.map(m => (
                          <option key={m.id} value={`${m.nombre} (${m.cargo})`}>
                            👥 {m.nombre} - {m.cargo} ({m.comunaZone})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Intención de Voto / Compromiso:
                      </label>
                      <select
                        disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                        value={formData.intencionVoto}
                        onChange={(e) => setFormData({ ...formData, intencionVoto: e.target.value as any })}
                        className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-100 outline-none focus:border-teal-400 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="Voto Seguro">💚 Voto Seguro (Confirmado)</option>
                        <option value="Simpatizante">💙 Simpatizante</option>
                        <option value="Reclutado">💜 Reclutado por Líder</option>
                        <option value="En Duda">💛 En Duda / En Proceso</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className={`flex items-center gap-2 text-xs font-extrabold cursor-pointer p-2.5 rounded-xl border w-full transition-all ${
                        formData.requiereTransporte 
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300' 
                          : 'bg-[#020712] border-slate-800 text-slate-300'
                      }`}>
                        <input
                          type="checkbox"
                          disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                          checked={formData.requiereTransporte}
                          onChange={(e) => setFormData({ ...formData, requiereTransporte: e.target.checked })}
                          className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                        />
                        <Car className="w-4 h-4 text-amber-400" />
                        <span>¿Requiere Transporte el Día E?</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Observaciones / Compromisos del Votante:
                    </label>
                    <textarea
                      rows={2}
                      disabled={!consultaResult || !consultaResult.esCircunscripcionPermitida}
                      placeholder="Ej: Aceptó fijar afiche en su casa, solicita transporte a las 10:00 AM..."
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-teal-400 disabled:opacity-50 resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  {!isAdmin ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 bg-slate-900 text-slate-500 border border-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
                    >
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Registro Restringido: Exclusivo para Rol Administrativo</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!consultaResult || !consultaResult.encontrado || !consultaResult.esCircunscripcionPermitida}
                      className="w-full py-3 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Confirmar y registrar votante (Rol Admin)</span>
                    </button>
                  )}
                </form>
              </div>
            </div>

          </div>

          {/* SECTION 2: TABLA DE VOTANTES REGISTRADOS ACTIVOS */}
          <div className="bg-[#030d1d] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4 text-white">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-400" />
                  Padrón de votantes validados ({filteredVotantes.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-[#020712] p-3 rounded-2xl border border-slate-800">
              
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar cédula, nombre, puesto o líder..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-750 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-400 font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-teal-400" /> Filtros:
                </span>

                {isAdmin ? (
                  <select
                    value={liderFilter}
                    onChange={(e) => setLiderFilter(e.target.value)}
                    className="block w-full min-w-0 max-w-full box-border bg-slate-900 border border-teal-500/40 rounded-xl px-2.5 py-1.5 text-xs text-teal-300 font-bold outline-none cursor-pointer sm:w-auto sm:max-w-[18rem]"
                  >
                    <option value="Todas">👥 Todos los Líderes</option>
                    <option value="Mis Votantes">📌 Mis Votantes ({activeOperator})</option>
                    {LISTA_MIEMBROS_CAMPAÑA.map(m => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre} ({m.cargo})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-1.5 bg-teal-950/80 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-black flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>Mis Votantes ({activeOperator.split('(')[0].trim()})</span>
                  </div>
                )}

                <select
                  value={comunaFilter}
                  onChange={(e) => setComunaFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold outline-none cursor-pointer"
                >
                  <option value="Todas">Todas las Comunas</option>
                  <option value="Comuna 11">Comuna 11 - Laureles</option>
                  <option value="Comuna 14">Comuna 14 - Poblado</option>
                  <option value="Comuna 13">Comuna 13 - San Javier</option>
                  <option value="Comuna 4">Comuna 4 - Aranjuez</option>
                </select>

                <select
                  value={intencionFilter}
                  onChange={(e) => setIntencionFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold outline-none cursor-pointer"
                >
                  <option value="Todas">Toda Intención de Voto</option>
                  <option value="Voto Seguro">💚 Voto Seguro</option>
                  <option value="Simpatizante">💙 Simpatizante</option>
                  <option value="Reclutado">💜 Reclutado</option>
                  <option value="En Duda">💛 En Duda</option>
                </select>
              </div>

            </div>

            {/* VOTANTES TABLE */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-300 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Cédula & Votante</th>
                    <th className="p-3">Puesto & Comuna</th>
                    <th className="p-3">Mesa</th>
                    <th className="p-3">Líder / Miembro Asignado</th>
                    <th className="p-3">Intención</th>
                    <th className="p-3">Transporte</th>
                    <th className="p-3">Validación API</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredVotantes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                        No se encontraron votantes con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredVotantes.map((v) => {
                      const isMyVoter = v.liderAsignado.toLowerCase().includes(activeOperator.toLowerCase()) || 
                                        v.liderAsignado.toLowerCase().includes((authUser?.name || '').toLowerCase());

                      return (
                        <tr key={v.id} className="hover:bg-cyan-950/20 transition-all">
                          
                          <td className="p-3">
                            <div className="font-mono font-bold text-slate-100">{v.cedula}</div>
                            <div className="font-extrabold text-teal-300 text-xs">{v.nombreCompleto}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" /> {v.telefono}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-slate-200">{v.puestoVotacion}</div>
                            <div className="text-[10px] text-teal-400 font-semibold">{v.comunaSector}</div>
                            <div className="text-[9px] text-slate-500">{v.direccionPuesto}</div>
                          </td>

                          <td className="p-3 font-mono font-black text-slate-200">
                            Mesa {v.mesa}
                          </td>

                          <td className="p-3">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded font-bold text-[11px] border inline-flex items-center gap-1 ${
                                isMyVoter
                                  ? 'bg-teal-950 text-teal-300 border-teal-500/40 font-extrabold'
                                  : 'bg-slate-900 text-slate-300 border-slate-750'
                              }`}>
                                <User className="w-3 h-3 text-teal-400 shrink-0" />
                                {v.liderAsignado}
                              </span>

                              {isMyVoter && (
                                <span className="block text-[9px] text-teal-400 font-extrabold uppercase">
                                  📌 Asignado a Ti
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 w-fit ${
                              v.intencionVoto === 'Voto Seguro'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : v.intencionVoto === 'Simpatizante'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                                : v.intencionVoto === 'Reclutado'
                                ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            }`}>
                              {v.intencionVoto}
                            </span>
                          </td>

                          <td className="p-3">
                            {v.requiereTransporte ? (
                              <span className="px-2 py-0.5 bg-amber-950 text-amber-300 font-extrabold rounded text-[10px] border border-amber-500/40 flex items-center gap-1 w-fit">
                                <Car className="w-3 h-3 text-amber-400" /> SÍ
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">No</span>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 font-bold rounded text-[10px] border border-emerald-500/40 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Censo Medellín
                            </span>
                          </td>

                          <td className="p-3 text-right space-y-1">
                            <button
                              onClick={() => handleOpenReassignModal(v.id, v.nombreCompleto, v.liderAsignado, 'activo')}
                              className="px-2 py-1 bg-slate-900 hover:bg-teal-950 text-teal-300 border border-slate-750 hover:border-teal-500/40 font-extrabold text-[10px] rounded-lg transition-all flex items-center gap-1 ml-auto cursor-pointer"
                              title="Reasignar este votante a otro líder o miembro de campaña"
                            >
                              <UserCog className="w-3 h-3 text-teal-400" />
                              <span>Reasignar Líder</span>
                            </button>

                            <button
                              onClick={() => handleDeleteVotante(v.id)}
                              className="text-rose-400 hover:text-rose-300 font-bold text-[10px] block ml-auto hover:underline cursor-pointer"
                              title="Eliminar registro"
                            >
                              Eliminar
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      ) : (
        /* ==================== VIEW 2: CARPETA ARCHIVADOS ==================== */
        <div className="space-y-6">
          
          {/* BANNER FOR PENDING NOTIFICATIONS */}
          {totalNotificacionesNuevas > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white p-5 rounded-3xl border-2 border-emerald-500/60 shadow-2xl space-y-3 relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-500/30 rounded-2xl border border-emerald-400/50 text-emerald-300 shrink-0">
                    <BellRing className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-200 flex items-center gap-2">
                      ¡NOTIFICACIÓN DE CAMBIO DE PUESTO DETECTADA EN CNE!
                    </h3>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Se ha confirmado que <strong>{totalNotificacionesNuevas} ciudadano(s) archivado(s)</strong> completaron el traslado de su lugar de votación a la circunscripción oficial de Medellín. Puede transferirlos inmediatamente al padrón activo.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 font-mono text-xs">
                  <span className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-black rounded-xl border border-emerald-300 uppercase tracking-wider block text-center">
                    {totalNotificacionesNuevas} listo(s) para traslado
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* CONTROL BAR FOR ARCHIVED MONITORS */}
          <div className="bg-[#030d1d] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-amber-400" />
                  Carpeta de Registros Archivados (Fuera de Circunscripción)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSyncAllArchived}
                  disabled={isSyncingArchived || totalArchivados === 0}
                  className="px-4 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingArchived ? 'animate-spin' : ''}`} />
                  <span>{isSyncingArchived ? 'Verificando Censo...' : '🔄 Sincronizar API CNE (Verificar Todos)'}</span>
                </button>
              </div>
            </div>

            {/* TABLE OF ARCHIVED VOTERS */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-300 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Cédula & Ciudadano</th>
                    <th className="p-3">Circunscripción & Puesto Original</th>
                    <th className="p-3">Líder Asignado</th>
                    <th className="p-3">Observaciones de Traslado</th>
                    <th className="p-3">Estado API CNE</th>
                    <th className="p-3 text-right">Acción / Simulación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredArchivados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                        No hay registros archivados visibles con la regla de privacidad activa.
                      </td>
                    </tr>
                  ) : (
                    filteredArchivados.map((item) => {
                      const isUpdated = item.estadoCne === '¡LUGAR ACTUALIZADO A MEDELLÍN!';

                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-all ${
                            isUpdated 
                              ? 'bg-gradient-to-r from-emerald-950/60 via-teal-950/60 to-slate-900 border-l-4 border-l-emerald-500 font-bold' 
                              : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <td className="p-3">
                            <div className="font-mono font-bold text-slate-100">{item.cedula}</div>
                            <div className="font-extrabold text-slate-200 text-xs">{item.nombreCompleto}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" /> {item.telefono}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-slate-200">{item.circunscripcionOriginal}</div>
                            <div className="text-[10px] text-amber-400">{item.puestoOriginal}</div>
                            <div className="text-[9px] text-slate-500">Archivado el: {item.fechaArchivado}</div>
                          </td>

                          <td className="p-3">
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-bold text-[11px] border border-slate-750">
                                {item.liderAsignado}
                              </span>

                              <button
                                onClick={() => handleOpenReassignModal(item.id, item.nombreCompleto, item.liderAsignado, 'archivado')}
                                className="text-[10px] text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <UserCog className="w-3 h-3" /> Reasignar
                              </button>
                            </div>
                          </td>

                          <td className="p-3 max-w-xs text-[11px] text-slate-300 leading-snug">
                            {item.motivo}
                          </td>

                          <td className="p-3">
                            {isUpdated ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black rounded-full text-[10px] uppercase flex items-center gap-1 w-fit shadow animate-pulse">
                                  <BellRing className="w-3 h-3" /> ¡Lugar Actualizado a Medellín!
                                </span>
                                {item.puestoNuevoMedellin && (
                                  <div className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 p-1.5 rounded-lg border border-emerald-500/40">
                                    Puesto: {item.puestoNuevoMedellin.puestoVotacion} ({item.puestoNuevoMedellin.comunaSector}, Mesa {item.puestoNuevoMedellin.mesa})
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="px-2.5 py-1 bg-amber-950 text-amber-300 font-extrabold rounded-full text-[10px] border border-amber-500/40 flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 text-amber-400" /> En Espera de Traslado
                                </span>
                                <span className="text-[9px] text-slate-500 block font-mono">
                                  Última verif: {item.fechaUltimaConsultaApi}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-right space-y-1">
                            {isUpdated ? (
                              <button
                                onClick={() => handleTransferirAActivo(item)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <span>Transferir a Medellín</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSimularActualizacionCne(item.id)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-750 hover:border-emerald-500/40 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                title="Simular que la Registraduría procesó el traslado para probar la notificación"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span>Simular Traslado CNE</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteArchivado(item.id)}
                              className="text-rose-400 hover:text-rose-300 font-bold text-[10px] block ml-auto hover:underline cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
