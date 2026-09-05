import React, { useState, useRef, useEffect } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { motion, AnimatePresence } from 'motion/react';
import { ViewMode, AuthUser } from '../../types';
import { ElectionLocationCheckIn } from '../common/ElectionLocationCheckIn';
import { supabase } from '../../lib/supabase';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  FileText, 
  Camera, 
  Send, 
  Check, 
  MapPin, 
  UserCheck, 
  Activity, 
  Info,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Scale,
  FileSpreadsheet,
  PenTool,
  Hash,
  RotateCcw,
  TrendingUp,
  Minus,
  Lock,
  ClipboardCheck,
  Printer
} from 'lucide-react';

interface TestigoCampoViewProps {
  onSelectView: (view: ViewMode) => void;
  authUser: AuthUser | null;
}

interface Incidente {
  id: string;
  categoria: string;
  severidad: 'Baja' | 'Media' | 'Alta';
  detalles: string;
  hora: string;
  estado: 'Reportado' | 'En análisis jurídico' | 'Resuelto';
}

interface ReporteParticipacion {
  hora: string;
  votosAcumulados: number;
  reportadoA: string;
}

export const TestigoCampoView: React.FC<TestigoCampoViewProps> = ({ onSelectView, authUser }) => {
  const [activeTab, setActiveTab] = useState<'apertura' | 'participacion' | 'escrutinio' | 'novedades' | 'impugnacion' | 'cuentavotos'>('apertura');
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const currentTabEl = tabRefs.current[activeTab];
    const container = tabsContainerRef.current;
    if (currentTabEl && container) {
      const tabOffset = currentTabEl.offsetLeft;
      const tabWidth = currentTabEl.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollTarget = tabOffset - (containerWidth / 2) + (tabWidth / 2);
      
      container.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: 'smooth'
      });
    }
  }, [activeTab]);

  const [puestoAsignado, setPuestoAsignado] = useState({
    id: '',
    nombre: 'Sin puesto asignado',
    direccion: '',
    mesa: 'Sin mesa',
    zona: '',
    votantesHabilitados: 0,
    observaciones: '' as string | null,
  });
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentMessage, setAssignmentMessage] = useState('');

  // 1. Apertura State
  const [aperturaReportada, setAperturaReportada] = useState(false);
  const [horaApertura, setHoraApertura] = useState('08:00');
  const [tarjetasRecibidas, setTarjetasRecibidas] = useState(0);
  const [testigosOtrosPartidos, setTestigosOtrosPartidos] = useState({
    pacto: false,
    centro: false,
    derecha: false
  });

  // 2. Participación State
  const [participacionReportes, setParticipacionReportes] = useState<ReporteParticipacion[]>([]);
  const [nuevoVotosAcumulados, setNuevoVotosAcumulados] = useState('');
  const [horaReporteSeleccionada, setHoraReporteSeleccionada] = useState('02:00 PM');

  useEffect(() => {
    let mounted = true;
    const loadRealAssignment = async () => {
      setAssignmentLoading(true);
      setAssignmentMessage('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId || !authUser?.email) throw new Error('Inicie sesión con el correo asignado al testigo.');
        const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id) throw new Error('El usuario no tiene una campaña asignada.');
        const { data, error } = await supabase
          .from('witnesses')
          .select('id,nombre,email,puesto,mesa,zona,municipio,observaciones,estado')
          .eq('client_id', profile.client_id)
          .ilike('email', authUser.email.trim())
          .neq('estado', 'INACTIVO')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No existe una asignación de puesto y mesa para este testigo.');
        let metadata: any = {};
        try { metadata = JSON.parse(data.observaciones || '{}'); } catch { metadata = {}; }
        const fieldOperations = metadata.fieldOperations || {};
        const enabledVoters = Number(fieldOperations.votantesHabilitados || metadata.votantesHabilitados || 0);
        if (!mounted) return;
        setPuestoAsignado({
          id: String(data.id),
          nombre: String(data.puesto || 'Sin puesto asignado'),
          direccion: String(fieldOperations.direccionPuesto || metadata.direccionPuesto || 'Dirección no registrada'),
          mesa: String(data.mesa || 'Sin mesa'),
          zona: String(data.zona || data.municipio || ''),
          votantesHabilitados: enabledVoters,
          observaciones: data.observaciones,
        });
        setTarjetasRecibidas(Number(fieldOperations.tarjetasRecibidas || enabledVoters));
        setParticipacionReportes(Array.isArray(fieldOperations.participacionReportes) ? fieldOperations.participacionReportes : []);
        setAperturaReportada(Boolean(fieldOperations.aperturaReportada));
        setHoraApertura(String(fieldOperations.horaApertura || '08:00'));
      } catch (error: any) {
        const message = error?.message || 'No fue posible cargar la asignación real.';
        if (mounted) setAssignmentMessage(/no tiene una campaña asignada/i.test(message) ? '' : message);
      } finally {
        if (mounted) setAssignmentLoading(false);
      }
    };
    void loadRealAssignment();
    return () => { mounted = false; };
  }, [authUser?.email]);

  // 3. Escrutinio State
  const [ocrEscaneando, setOcrEscaneando] = useState(false);
  const [ocrCompletado, setOcrCompletado] = useState(false);
  const [ocrPhotoUrl, setOcrPhotoUrl] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrDetectedCandidates, setOcrDetectedCandidates] = useState<Array<{ name: string; votes: number | null }>>([]);
  const e14CameraInputRef = useRef<HTMLInputElement | null>(null);
  const [e14Transmitido, setE14Transmitido] = useState(false);
  const [votosNuestros, setVotosNuestros] = useState<number | ''>('');
  const [votosCandidatoB, setVotosCandidatoB] = useState<number | ''>('');
  const [votosCandidatoC, setVotosCandidatoC] = useState<number | ''>('');
  const [votosNulos, setVotosNulos] = useState<number | ''>('');
  const [votosBlanco, setVotosBlanco] = useState<number | ''>('');

  // 3b. CuentaVotos State
  interface CandidatoCuenta {
    id: string;
    nombre: string;
    partido: string;
    color: string;
    votos: number;
  }

  interface RegistroCuenta {
    candidatoNombre: string;
    accion: '+1' | '-1' | 'reset';
    votosTras: number;
    hora: string;
  }

  const [candidatosCuenta, setCandidatosCuenta] = useState<CandidatoCuenta[]>([
    { id: 'cv_4', nombre: 'Voto en Blanco', partido: '', color: 'slate', votos: 0 },
    { id: 'cv_5', nombre: 'Voto Nulo', partido: '', color: 'red', votos: 0 },
  ]);
  const [registroCuenta, setRegistroCuenta] = useState<RegistroCuenta[]>([]);
  const [cuentaCerrada, setCuentaCerrada] = useState(false);
  const [nuevoCandidatoNombre, setNuevoCandidatoNombre] = useState('');
  const [nuevoCandidatoPartido, setNuevoCandidatoPartido] = useState('');

  // Cierre de Mesa State
  const [cierreFormalizado, setCierreFormalizado] = useState(false);
  const [horaCierre, setHoraCierre] = useState(() => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
  const [totalSufragantes, setTotalSufragantes] = useState('');
  const [nombrePresidenteMesa, setNombrePresidenteMesa] = useState('');
  const [cedulaPresidenteMesa, setCedulaPresidenteMesa] = useState('');
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [mostrarActaCierre, setMostrarActaCierre] = useState(false);
  const [firmaTestigoCierre, setFirmaTestigoCierre] = useState<string | null>(null);
  const canvasCierreRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawingCierre, setIsDrawingCierre] = useState(false);

  const startDrawingCierre = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasCierreRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
    setIsDrawingCierre(true);
  };
  const drawCierre = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingCierre) return;
    const canvas = canvasCierreRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
  };
  const stopDrawingCierre = () => {
    if (!isDrawingCierre) return;
    setIsDrawingCierre(false);
    if (canvasCierreRef.current) setFirmaTestigoCierre(canvasCierreRef.current.toDataURL());
  };
  const clearCanvasCierre = () => {
    const canvas = canvasCierreRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaTestigoCierre(null);
  };

  const handleFormalizarCierre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalSufragantes || !nombrePresidenteMesa) {
      alert('Complete todos los campos obligatorios para formalizar el cierre.');
      return;
    }
    setCierreFormalizado(true);
    setCuentaCerrada(true);
  };

  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; bar: string }> = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300', bar: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/40',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300',    bar: 'bg-blue-500' },
    purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/40',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300',  bar: 'bg-purple-500' },
    slate:   { bg: 'bg-slate-700/20',   border: 'border-slate-600/40',   text: 'text-slate-300',   badge: 'bg-slate-700/40 text-slate-300',   bar: 'bg-slate-500' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/40',     text: 'text-red-400',     badge: 'bg-red-500/20 text-red-300',     bar: 'bg-red-500' },
    orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/40',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300',  bar: 'bg-orange-500' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/40',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300',    bar: 'bg-cyan-500' },
  };

  const totalVotosCuenta = candidatosCuenta.reduce((sum, c) => sum + c.votos, 0);

  const handleCuentaVoto = (candidatoId: string, delta: 1 | -1) => {
    if (cuentaCerrada) return;
    setCandidatosCuenta(prev => prev.map(c => {
      if (c.id !== candidatoId) return c;
      const nuevoVotos = Math.max(0, c.votos + delta);
      const reg: RegistroCuenta = {
        candidatoNombre: c.nombre,
        accion: delta === 1 ? '+1' : '-1',
        votosTras: nuevoVotos,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setRegistroCuenta(prev2 => [reg, ...prev2].slice(0, 50));
      return { ...c, votos: nuevoVotos };
    }));
  };

  const handleResetCuenta = () => {
    if (!window.confirm('¿Está seguro de reiniciar todos los contadores a cero? Esta acción no se puede deshacer.')) return;
    setCandidatosCuenta(prev => prev.map(c => ({ ...c, votos: 0 })));
    setRegistroCuenta([]);
    setCuentaCerrada(false);
  };

  const handleAgregarCandidato = () => {
    if (!nuevoCandidatoNombre.trim()) return;
    const colors = ['orange', 'cyan', 'purple', 'blue'];
    const newC: CandidatoCuenta = {
      id: `cv_${Date.now()}`,
      nombre: nuevoCandidatoNombre.trim(),
      partido: nuevoCandidatoPartido.trim(),
      color: colors[candidatosCuenta.length % colors.length],
      votos: 0
    };
    setCandidatosCuenta(prev => [...prev, newC]);
    setNuevoCandidatoNombre('');
    setNuevoCandidatoPartido('');
  };

  // 4. Novedades State
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [incidenteCategoria, setIncidenteCategoria] = useState('Falta de Tarjetines');
  const [incidenteSeveridad, setIncidenteSeveridad] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [incidenteDetalles, setIncidenteDetalles] = useState('');

  // 5. Impugnaciones State
  interface Impugnacion {
    id: string;
    causalCodigo: string;
    causalTitulo: string;
    descripcion: string;
    hora: string;
    firmado: boolean;
    firmaDigitalUrl?: string;
    estado: 'Radicado digitalmente' | 'Firma física generada' | 'Enviado a Jurado';
  }

  const [impugnaciones, setImpugnaciones] = useState<Impugnacion[]>([]);
  const [nuevaCausal, setNuevaCausal] = useState('Causal 1 (Art. 192 C.E.)');
  const [impugnacionDescripcion, setImpugnacionDescripcion] = useState('');
  const [nombreTestigoFirmante, setNombreTestigoFirmante] = useState(authUser?.name || '');
  const [cedulaTestigo, setCedulaTestigo] = useState('');
  const [mostrarPrevisualizacionDocumento, setMostrarPrevisualizacionDocumento] = useState<string | null>(null);

  // Digital Signature Canvas Drawing State
  const [firmaDigital, setFirmaDigital] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a'; // dark stroke for print
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setFirmaDigital(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaDigital(null);
  };

  // Handlers
  const handleImpugnacionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!impugnacionDescripcion.trim()) return;
    const causalesTitulos: Record<string, string> = {
      'Causal 1 (Art. 192 C.E.)': 'Diferencia numérica de sufragantes',
      'Causal 2 (Art. 192 C.E.)': 'Suplantación o doble voto',
      'Causal 3 (Art. 192 C.E.)': 'Coacción al elector',
      'Causal 4 (Art. 192 C.E.)': 'Alteraciones en E-14',
      'Causal 5 (Art. 192 C.E.)': 'Cierre prematuro de mesa',
      'Causal 6 (Art. 192 C.E.)': 'Negación de recuento de votos'
    };
    const nuevaImp: Impugnacion = {
      id: `imp_${Date.now()}`,
      causalCodigo: nuevaCausal,
      causalTitulo: causalesTitulos[nuevaCausal] || 'Causal Especial',
      descripcion: impugnacionDescripcion.trim(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      firmado: !!firmaDigital,
      firmaDigitalUrl: firmaDigital || undefined,
      estado: firmaDigital ? 'Firma física generada' : 'Radicado digitalmente'
    };
    setImpugnaciones(prev => [nuevaImp, ...prev]);
    setImpugnacionDescripcion('');
    clearCanvas();
  };
  const handleAperturaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAperturaReportada(true);
  };

  const handleParticipacionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puestoAsignado.id || puestoAsignado.votantesHabilitados <= 0) {
      alert('La mesa debe tener una asignación y un censo electoral configurados antes de reportar participación.');
      return;
    }
    const votos = parseInt(nuevoVotosAcumulados);
    if (isNaN(votos) || votos < 0 || votos > puestoAsignado.votantesHabilitados) {
      alert('Por favor ingrese un número de votos válido.');
      return;
    }
    const nuevoReporte: ReporteParticipacion = {
      hora: horaReporteSeleccionada,
      votosAcumulados: votos,
      reportadoA: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const nextReports = [...participacionReportes, nuevoReporte].sort((a,b) => a.hora.localeCompare(b.hora));
    let metadata: any = {};
    try { metadata = JSON.parse(puestoAsignado.observaciones || '{}'); } catch { metadata = {}; }
    const { error } = await supabase.from('witnesses').update({
      observaciones: JSON.stringify({
        ...metadata,
        fieldOperations: { ...(metadata.fieldOperations || {}), participacionReportes: nextReports },
      }),
      updated_at: new Date().toISOString(),
    }).eq('id', puestoAsignado.id);
    if (error) {
      alert('No fue posible guardar el reporte de participación.');
      return;
    }
    setParticipacionReportes(nextReports);
    setNuevoVotosAcumulados('');
  };

  const prepareE14Image = (file: File) => new Promise<{ dataUrl: string; base64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No fue posible leer la fotografía seleccionada.'));
    reader.onload = () => {
      const source = String(reader.result || '');
      const image = new Image();
      image.onerror = () => reject(new Error('La imagen no tiene un formato compatible.'));
      image.onload = () => {
        const maxSide = 1800;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('No fue posible preparar la fotografía.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] || '', mimeType: 'image/jpeg' });
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });

  const openE14Camera = () => {
    setOcrError('');
    if (e14CameraInputRef.current) e14CameraInputRef.current.value = '';
    e14CameraInputRef.current?.click();
  };

  const handleE14Photo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setOcrError('Seleccione o tome una fotografía válida del formulario E-14.');
      return;
    }

    setOcrEscaneando(true);
    setOcrCompletado(false);
    setOcrError('');
    setOcrConfidence(null);
    setOcrDetectedCandidates([]);
    try {
      const prepared = await prepareE14Image(file);
      setOcrPhotoUrl(prepared.dataUrl);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('La sesión venció. Inicie sesión nuevamente para analizar el E-14.');
      }

      const response = await fetch('/api/supabase-admin/e14-ocr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          imageData: prepared.base64,
          mimeType: prepared.mimeType,
          mesa: puestoAsignado.mesa,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No fue posible analizar la fotografía del E-14.');
      if (!result.validDocument) throw new Error(result.message || 'La fotografía no permite identificar un formulario E-14 legible.');

      const candidates = Array.isArray(result.candidateVotes) ? result.candidateVotes.slice(0, 3) : [];
      const numericOrEmpty = (value: unknown): number | '' => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : '';
      setVotosNuestros(numericOrEmpty(candidates[0]?.votes));
      setVotosCandidatoB(numericOrEmpty(candidates[1]?.votes));
      setVotosCandidatoC(numericOrEmpty(candidates[2]?.votes));
      setVotosBlanco(numericOrEmpty(result.blankVotes));
      const nullVotes = numericOrEmpty(result.nullVotes);
      const unmarkedVotes = numericOrEmpty(result.unmarkedVotes);
      setVotosNulos(nullVotes === '' && unmarkedVotes === '' ? '' : (Number(nullVotes) || 0) + (Number(unmarkedVotes) || 0));
      setOcrDetectedCandidates(candidates.map((candidate: any, index: number) => ({
        name: String(candidate?.name || `Candidato ${index + 1}`),
        votes: numericOrEmpty(candidate?.votes) === '' ? null : Number(candidate.votes),
      })));
      setOcrConfidence(typeof result.confidence === 'number' ? result.confidence : null);
      setOcrCompletado(true);
    } catch (error: any) {
      setOcrError(error?.message || 'No fue posible completar la lectura del E-14.');
    } finally {
      setOcrEscaneando(false);
    }
  };

  const handleE14Transmit = () => {
    setE14Transmitido(true);
  };

  const handleIncidenteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidenteDetalles.trim()) return;
    const nuevoIncidente: Incidente = {
      id: `inc_${Date.now()}`,
      categoria: incidenteCategoria,
      severidad: incidenteSeveridad,
      detalles: incidenteDetalles.trim(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: 'Reportado'
    };
    setIncidentes(prev => [nuevoIncidente, ...prev]);
    setIncidenteDetalles('');
  };

  // Calcular participación actual
  const ultimoReporteVotos = participacionReportes.length > 0 
    ? participacionReportes[participacionReportes.length - 1].votosAcumulados 
    : 0;
  const porcentajeParticipacion = puestoAsignado.votantesHabilitados > 0
    ? Math.round((ultimoReporteVotos / puestoAsignado.votantesHabilitados) * 100)
    : 0;

  // Calcular total de votos en escrutinio
  const totalVotosEscrutinio = 
    (Number(votosNuestros) || 0) + 
    (Number(votosCandidatoB) || 0) + 
    (Number(votosCandidatoC) || 0) + 
    (Number(votosBlanco) || 0) + 
    (Number(votosNulos) || 0);

  return (
    <div className="responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#030712] text-slate-100 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto overflow-x-hidden">
      
      {/* Top Banner: Assigned Voting Table details */}
      <div className={`rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden ${puestoAsignado.id ? 'bg-gradient-to-r from-[#0b1d38] via-[#0d2a4a] to-[#047857]' : 'bg-[#071426] border border-slate-800'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.08),transparent)]" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            {(assignmentLoading || puestoAsignado.id) && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs text-emerald-300 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                <span>{assignmentLoading ? 'Consultando asignación' : 'Puesto de Votación Asignado'}</span>
              </div>
            )}
            <h2 className="text-xl md:text-2xl font-black tracking-tight">{puestoAsignado.nombre}</h2>
            {puestoAsignado.id && (puestoAsignado.direccion || puestoAsignado.zona) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-teal-100/90 font-medium">
                {puestoAsignado.direccion && <span>{puestoAsignado.direccion}</span>}
                {puestoAsignado.direccion && puestoAsignado.zona && <span className="text-teal-400/40">•</span>}
                {puestoAsignado.zona && <span>{puestoAsignado.zona}</span>}
              </div>
            )}
          </div>
          <div className="bg-[#041733]/90 border border-cyan-500/30 rounded-2xl p-4 flex flex-row items-center gap-4 shrink-0 shadow-lg">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mesa de Votación</div>
              <div className="text-lg font-black text-white">{puestoAsignado.mesa}</div>
              <div className="text-[10px] text-emerald-400 font-semibold font-mono">
                {puestoAsignado.votantesHabilitados > 0 ? `Censo: ${puestoAsignado.votantesHabilitados} votantes` : 'Censo no configurado'}
              </div>
            </div>
          </div>
        </div>
        {assignmentMessage && <p className="relative z-10 mt-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">{assignmentMessage}</p>}
      </div>

      <ElectionLocationCheckIn authUser={authUser} personType="witness" />

      {/* Tabs Switcher */}
      <div 
        ref={tabsContainerRef}
        className="bg-[#041126]/90 p-1.5 rounded-2xl border border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none shadow-lg scroll-smooth"
      >
        {[
          { id: 'apertura', step: '1', label: 'Apertura de Mesa', icon: <Clock className="w-4 h-4" /> },
          { id: 'participacion', step: '2', label: 'Control de Votos', icon: <Activity className="w-4 h-4" /> },
          { id: 'escrutinio', step: '3', label: 'Escrutinio & E-14', icon: <FileText className="w-4 h-4" /> },
          { id: 'novedades', step: '4', label: 'Reportar Incidente', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'impugnacion', step: '5', label: 'Impugnación de Mesa', icon: <Scale className="w-4 h-4" /> },
          { id: 'cuentavotos', step: '6', label: 'Cuenta Votos', icon: <Hash className="w-4 h-4" /> }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                isActive 
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-black' 
                  : 'bg-slate-800/90 text-slate-400'
              }`}>
                {tab.step}
              </span>
              <span className="shrink-0">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-[#041733]/50 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: APERTURA */}
          {activeTab === 'apertura' && (
            <motion.div
              key="apertura"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="max-w-2xl space-y-5">
                <div>
                  <h3 className="text-base font-black text-white">Reportar Apertura de la {puestoAsignado.mesa}</h3>
                </div>

                {aperturaReportada ? (
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Apertura Reportada con Éxito</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        La mesa se reportó como **abierta e instalada correctamente** a las {horaApertura} AM.
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-3 bg-[#020a17] p-3 rounded-xl border border-emerald-500/20 text-xs">
                        <div>
                          <span className="text-slate-400">Tarjetines recibidos:</span>
                          <p className="font-bold font-mono text-emerald-300">{tarjetasRecibidas} unidades</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Otros partidos presentes:</span>
                          <p className="font-bold text-slate-200">
                            {Object.entries(testigosOtrosPartidos)
                              .filter(([_, v]) => v)
                              .map(([k]) => k.toUpperCase())
                              .join(', ') || 'Ninguno'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAperturaSubmit} className="w-full min-w-0 space-y-5">
                    <div className="grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0 space-y-2 overflow-hidden">
                        <label className="text-xs font-bold text-slate-300">Hora Oficial de Apertura</label>
                        <input
                          type="time"
                          value={horaApertura}
                          onChange={(e) => setHoraApertura(e.target.value)}
                          className="block w-full min-w-0 max-w-full box-border bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300">Tarjetines Recibidos en Mesa</label>
                        <input
                          type="number"
                          value={tarjetasRecibidas}
                          onChange={(e) => setTarjetasRecibidas(Number(e.target.value))}
                          className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Presencia de Testigos de Otras Campañas</label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 bg-[#020a17] border border-slate-700/60 rounded-xl px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-900/60">
                          <input
                            type="checkbox"
                            checked={testigosOtrosPartidos.pacto}
                            onChange={(e) => setTestigosOtrosPartidos({ ...testigosOtrosPartidos, pacto: e.target.checked })}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>Testigo Partido A</span>
                        </label>
                        <label className="flex items-center gap-2 bg-[#020a17] border border-slate-700/60 rounded-xl px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-900/60">
                          <input
                            type="checkbox"
                            checked={testigosOtrosPartidos.centro}
                            onChange={(e) => setTestigosOtrosPartidos({ ...testigosOtrosPartidos, centro: e.target.checked })}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>Testigo Partido B</span>
                        </label>
                        <label className="flex items-center gap-2 bg-[#020a17] border border-slate-700/60 rounded-xl px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-900/60">
                          <input
                            type="checkbox"
                            checked={testigosOtrosPartidos.derecha}
                            onChange={(e) => setTestigosOtrosPartidos({ ...testigosOtrosPartidos, derecha: e.target.checked })}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>Testigo Partido C</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
                    >
                      Reportar Apertura de Mesa
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: PARTICIPACION */}
          {activeTab === 'participacion' && (
            <motion.div
              key="participacion"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Form & Historic Turnout */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-base font-black text-white">Reporte de Participación de Votantes</h3>
                </div>

                {/* Progress Turnout */}
                <div className="bg-[#020a17] border border-cyan-500/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Última Participación</span>
                      <h4 className="text-lg font-black text-white">{ultimoReporteVotos} / {puestoAsignado.votantesHabilitados} Votaron</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Porcentaje Turnout</span>
                      <h4 className="text-lg font-black text-emerald-400 font-mono">{porcentajeParticipacion}%</h4>
                    </div>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${porcentajeParticipacion}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Participación ({porcentajeParticipacion}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                      <span>Abstención ({100 - porcentajeParticipacion}%)</span>
                    </div>
                  </div>
                </div>

                {/* Form to submit cut */}
                <form onSubmit={handleParticipacionSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Hora de Corte</label>
                    <select
                      value={horaReporteSeleccionada}
                      onChange={(e) => setHoraReporteSeleccionada(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="02:00 PM">02:00 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Votos Acumulados (Fórmulas)</label>
                    <input
                      type="number"
                      placeholder="Ej. 140"
                      value={nuevoVotosAcumulados}
                      onChange={(e) => setNuevoVotosAcumulados(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!puestoAsignado.id || puestoAsignado.votantesHabilitados <= 0}
                    className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Reportar Corte</span>
                  </button>
                </form>
              </div>

              {/* Feed of submitted cuts */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Historial de Reportes</h4>
                <div className="space-y-2">
                  {participacionReportes.map((rep, idx) => (
                    <div key={idx} className="bg-[#020a17] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{rep.hora}</div>
                          <div className="text-[10px] text-slate-400">Reportado a las {rep.reportadoA}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-white font-mono">{rep.votosAcumulados} votos</div>
                        <div className="text-[9px] text-slate-400">{puestoAsignado.votantesHabilitados > 0 ? Math.round((rep.votosAcumulados / puestoAsignado.votantesHabilitados) * 100) : 0}% de la mesa</div>
                      </div>
                    </div>
                  ))}
                  {participacionReportes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-[#020a17] p-5 text-center text-xs text-slate-500">
                      No existen reportes de participación registrados para esta mesa.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: ESCRUTINIO & E-14 */}
          {activeTab === 'escrutinio' && (
            <motion.div
              key="escrutinio"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-white">Escrutinio Final & Transmisión de Acta E-14</h3>
              </div>

              {e14Transmitido ? (
                <div className="space-y-6 max-w-2xl mx-auto">
                  
                  {/* Status Badge & Stamp */}
                  <div className="p-6 rounded-3xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 text-[9px] font-black uppercase bg-emerald-500 text-slate-950 tracking-wider rounded-bl-2xl">
                      Mesa Cerrada
                    </div>
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-white">Acta E-14 Transmitida con Éxito</h4>
                      <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                        El acta de la **{puestoAsignado.mesa}** ha sido firmada criptográficamente por el testigo y consolidada en el centro nacional de control.
                      </p>
                    </div>

                    {/* Stamp */}
                    <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-[10px] font-black uppercase text-emerald-300 tracking-widest animate-pulse mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Estado: Cierre Consolidado
                    </div>
                  </div>

                  {/* Vote Tally breakdown */}
                  <div className="bg-[#020a17] border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Resumen Oficial de Escrutinio</h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Total Votos: {totalVotosEscrutinio}</span>
                    </div>

                    {/* Results table */}
                    <div className="space-y-3">
                      {[
                        { label: 'NUESTRO CANDIDATO (Campaña Ganadora AI)', value: votosNuestros, highlight: true },
                        { label: 'Candidato Partido A', value: votosCandidatoB, highlight: false },
                        { label: 'Candidato Partido B', value: votosCandidatoC, highlight: false },
                        { label: 'Votos en Blanco', value: votosBlanco, highlight: false },
                        { label: 'Votos Nulos / No Marcados', value: votosNulos, highlight: false }
                      ].map((item, idx) => {
                        const count = Number(item.value) || 0;
                        const percent = totalVotosEscrutinio > 0 ? Math.round((count / totalVotosEscrutinio) * 100) : 0;
                        const barColor = item.highlight ? 'bg-emerald-500' : 'bg-slate-700';

                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span className={item.highlight ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                                {item.label}
                              </span>
                              <span className="font-mono text-slate-200">
                                {count} votos ({percent}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/60">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <div>
                        <span>Hash de Transmisión:</span>
                        <p className="font-mono text-slate-400 select-all truncate">0x9f4a9b2b512ea2c1f9d45e56d78a8f15</p>
                      </div>
                      <div className="text-right">
                        <span>Fecha y Hora de Cierre:</span>
                        <p className="font-bold text-slate-400">
                          {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Left Column: Form or OCR status */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Votos Escrutados por Candidato</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border border-emerald-500/20 rounded-xl px-4 py-3">
                        <span className="text-xs font-bold text-emerald-300">NUESTRO CANDIDATO (Campaña Ganadora AI)</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={votosNuestros}
                          onChange={(e) => setVotosNuestros(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-right font-bold text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border border-slate-800 rounded-xl px-4 py-3">
                        <span className="text-xs font-medium text-slate-300">Candidato Partido A</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={votosCandidatoB}
                          onChange={(e) => setVotosCandidatoB(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border border-slate-800 rounded-xl px-4 py-3">
                        <span className="text-xs font-medium text-slate-300">Candidato Partido B</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={votosCandidatoC}
                          onChange={(e) => setVotosCandidatoC(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border border-slate-800 rounded-xl px-4 py-3">
                        <span className="text-xs font-medium text-slate-300 font-mono">Votos en Blanco</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={votosBlanco}
                          onChange={(e) => setVotosBlanco(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border border-slate-800 rounded-xl px-4 py-3">
                        <span className="text-xs font-medium text-slate-300 font-mono">Votos Nulos / No Marcados</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={votosNulos}
                          onChange={(e) => setVotosNulos(e.target.value !== '' ? Number(e.target.value) : '')}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 bg-[#020a17] border-t border-slate-800 pt-3 px-2">
                        <span className="text-xs font-bold text-white">TOTAL VOTOS REGISTRADOS</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">{totalVotosEscrutinio}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleE14Transmit}
                      disabled={totalVotosEscrutinio === 0}
                      className={`w-full py-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                        totalVotosEscrutinio > 0 
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' 
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmitir Acta Oficial E-14</span>
                    </button>
                  </div>

                  {/* Right Column: Simulated OCR Camera */}
                  <div className="bg-[#020a17] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <input
                      ref={e14CameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => void handleE14Photo(event.target.files?.[0])}
                    />
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Escáner E-14 de Campaña</h4>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Fotografíe el documento E-14. Nuestro motor de IA extraerá las cifras del acta automáticamente en segundos.
                      </p>
                    </div>

                    {ocrEscaneando ? (
                      <div className="flex-1 min-h-64 flex flex-col items-center justify-center py-12 space-y-4 bg-slate-900/60 border border-slate-800 border-dashed rounded-xl relative overflow-hidden">
                        {ocrPhotoUrl && <img src={ocrPhotoUrl} alt="Formulario E-14 capturado" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                        {/* Simulated rotating scanlines */}
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500 shadow-lg shadow-emerald-500/70 animate-bounce" />
                        <Camera className="w-8 h-8 text-emerald-400 animate-pulse" />
                        <div className="text-center space-y-1">
                          <span className="text-xs text-white font-extrabold flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                            Procesando Acta con IA...
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">Aplicando filtros de contraste OCR</span>
                        </div>
                      </div>
                    ) : ocrCompletado ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-3 bg-emerald-950/20 border border-emerald-500/20 border-dashed rounded-xl">
                        {ocrPhotoUrl && <img src={ocrPhotoUrl} alt="Formulario E-14 analizado" className="w-full max-h-56 object-contain rounded-lg border border-emerald-500/20 bg-black" />}
                        <Check className="w-8 h-8 text-emerald-400 bg-emerald-950 border border-emerald-500/40 p-1.5 rounded-full" />
                        <div className="text-center">
                          <span className="text-xs text-white font-extrabold block">Lectura OCR Completada</span>
                          <span className="text-[10px] text-emerald-400 font-semibold font-mono block mt-0.5">
                            {ocrConfidence === null ? 'Cifras extraídas para revisión' : `${Math.round(ocrConfidence)}% de confianza estimada`}
                          </span>
                        </div>
                        {ocrDetectedCandidates.length > 0 && (
                          <div className="w-full rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-[10px] text-slate-300 space-y-1">
                            {ocrDetectedCandidates.map((candidate, index) => (
                              <div key={`${candidate.name}-${index}`} className="flex justify-between gap-3">
                                <span className="truncate">{candidate.name}</span>
                                <strong className="font-mono text-white">{candidate.votes ?? 'Revisar'}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                        <button 
                          onClick={openE14Camera}
                          className="text-[11px] font-bold text-teal-400 hover:text-teal-300 underline mt-2"
                        >
                          Volver a escanear
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={openE14Camera}
                        className="flex-1 flex flex-col items-center justify-center py-12 space-y-3 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 hover:border-slate-700 border-dashed rounded-xl transition-all cursor-pointer group"
                      >
                        <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-slate-700/60 text-slate-400 group-hover:text-white transition-all">
                          <Camera className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-slate-300 group-hover:text-white">Capturar Foto E-14</span>
                        <span className="text-[10px] text-slate-500 font-mono">Cámara trasera · Lectura inteligente</span>
                      </button>
                    )}

                    {ocrError && (
                      <div role="alert" className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-[11px] leading-relaxed text-rose-200">
                        {ocrError}
                      </div>
                    )}

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-normal flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p>
                        <strong>Importante:</strong> Valide las cifras obtenidas por el escáner con el acta física original antes de presionar el botón de transmisión final.
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: NOVEDADES */}
          {activeTab === 'novedades' && (
            <motion.div
              key="novedades"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Report form */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-base font-black text-white">Reportar Novedad en la Mesa / Puesto</h3>
                </div>

                <form onSubmit={handleIncidenteSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Categoría del Incidente</label>
                      <select
                        value={incidenteCategoria}
                        onChange={(e) => setIncidenteCategoria(e.target.value)}
                        className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="Falta de Tarjetines">Falta de Tarjetines / Tarjetas de votación</option>
                        <option value="Ausencia de Jurados">Ausencia o Retraso de Jurados</option>
                        <option value="Coacción de Votante">Presión / Coacción de votantes</option>
                        <option value="Falta de Testigos">Inconvenientes para el ingreso de testigos</option>
                        <option value="Jurado Sospechoso">Acciones irregulares del jurado de mesa</option>
                        <option value="Otro">Otro incidente menor</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Nivel de Alerta / Severidad</label>
                      <div className="flex gap-2">
                        {['Baja', 'Media', 'Alta'].map((sev) => {
                          const isSelected = incidenteSeveridad === sev;
                          const color = 
                            sev === 'Alta' ? 'border-red-500 text-red-400 bg-red-950/20' :
                            sev === 'Media' ? 'border-amber-500 text-amber-400 bg-amber-950/20' :
                            'border-slate-700 text-slate-300 bg-[#020a17]';
                          return (
                            <button
                              key={sev}
                              type="button"
                              onClick={() => setIncidenteSeveridad(sev as any)}
                              className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                isSelected ? color : 'border-slate-800 text-slate-500 bg-slate-950/20'
                              }`}
                            >
                              {sev}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Detalle de la novedad</label>
                    <textarea
                      placeholder="Describa brevemente lo sucedido. Escriba números de mesa o cédulas si aplica..."
                      rows={4}
                      value={incidenteDetalles}
                      onChange={(e) => setIncidenteDetalles(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none placeholder-slate-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Radicar Alerta de Campaña</span>
                  </button>
                </form>
              </div>

              {/* Feed of submitted incidents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Incidentes Radicados</h4>
                <div className="space-y-3">
                  {incidentes.map((inc) => {
                    const badgeColor = 
                      inc.severidad === 'Alta' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      inc.severidad === 'Media' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-slate-800 text-slate-300 border border-slate-700';

                    const statusColor = 
                      inc.estado === 'Resuelto' ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30' :
                      inc.estado === 'En análisis jurídico' ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' :
                      'text-red-400 bg-red-950/60 border border-red-500/30';

                    return (
                      <div key={inc.id} className="bg-[#020a17] border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {inc.categoria}
                          </span>
                          <span className="text-[10px] text-slate-500">{inc.hora}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-normal">{inc.detalles}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-400">Jurisdicción de la campaña</span>
                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-md ${statusColor}`}>
                            {inc.estado}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: IMPUGNACIONES (RECLAMACIONES DE MESA) */}
          {activeTab === 'impugnacion' && (
            <motion.div
              key="impugnacion"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Form and Document Preview Generator */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-base font-black text-white">Reclamación e Impugnación de Mesa</h3>
                </div>

                <form onSubmit={handleImpugnacionSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Causal Legal de Reclamación</label>
                      <select
                        value={nuevaCausal}
                        onChange={(e) => setNuevaCausal(e.target.value)}
                        className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="Causal 1 (Art. 192 C.E.)">Causal 1: Diferencia numérica de sufragantes</option>
                        <option value="Causal 2 (Art. 192 C.E.)">Causal 2: Suplantación o doble voto en mesa</option>
                        <option value="Causal 3 (Art. 192 C.E.)">Causal 3: Coacción o presión al elector</option>
                        <option value="Causal 4 (Art. 192 C.E.)">Causal 4: Alteración material o enmendaduras en E-14</option>
                        <option value="Causal 5 (Art. 192 C.E.)">Causal 5: Cierre prematuro de mesa</option>
                        <option value="Causal 6 (Art. 192 C.E.)">Causal 6: Negación de recuento de votos</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Identificación del Testigo (Firma física)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nombre del Testigo"
                          value={nombreTestigoFirmante}
                          onChange={(e) => setNombreTestigoFirmante(e.target.value)}
                          className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Cédula"
                          value={cedulaTestigo}
                          onChange={(e) => setCedulaTestigo(e.target.value)}
                          className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Hechos y Fundamentos de la Impugnación</label>
                    <textarea
                      placeholder="Describa con precisión los hechos observados (ej. 'Al abrir la urna se encontraron 3 tarjetas adicionales no registradas...')"
                      rows={5}
                      value={impugnacionDescripcion}
                      onChange={(e) => setImpugnacionDescripcion(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 resize-none placeholder-slate-500"
                      required
                    />
                  </div>

                  {/* Digital Signature Canvas Pad */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Firma Digital del Testigo</span>
                      <span className="text-[10px] text-slate-500 font-normal">(Dibuje su firma con mouse o táctil en el recuadro blanco)</span>
                    </label>
                    <div className="bg-white border border-slate-700/60 rounded-2xl p-2 relative overflow-hidden h-[120px] flex items-center justify-center">
                      <canvas
                        ref={canvasRef}
                        width={500}
                        height={100}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-full bg-white cursor-crosshair touch-none"
                      />
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        Limpiar Firma
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Radicar Digitalmente</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Feed of submitted challenges */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Impugnaciones Radicadas</h4>
                <div className="space-y-3">
                  {impugnaciones.map((imp) => {
                    const statusColor = 
                      imp.estado === 'Enviado a Jurado' ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30' :
                      imp.estado === 'Firma física generada' ? 'text-amber-400 bg-amber-950/60 border border-amber-500/30' :
                      'text-blue-400 bg-blue-950/60 border border-blue-500/30';

                    return (
                      <div key={imp.id} className="bg-[#020a17] border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-emerald-300 font-mono">
                            {imp.causalCodigo}
                          </span>
                          <span className="text-[10px] text-slate-500">{imp.hora}</span>
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-white">{imp.causalTitulo}</h5>
                          <p className="text-[11px] text-slate-400 leading-normal mt-1">{imp.descripcion}</p>
                        </div>
                        <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-500">Mesa {puestoAsignado.mesa}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${statusColor}`}>
                              {imp.estado}
                            </span>
                          </div>
                          
                          {/* Printable sheet preview button */}
                          <button
                            onClick={() => setMostrarPrevisualizacionDocumento(mostrarPrevisualizacionDocumento === imp.id ? null : imp.id)}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700/60 text-[10px] font-bold text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {mostrarPrevisualizacionDocumento === imp.id ? 'Ocultar Documento Físico' : 'Previsualizar Documento Físico'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Printable Letterhead Document Preview Overlay */}
          {mostrarPrevisualizacionDocumento && (
            <div className="fixed inset-0 z-50 bg-[#000]/70 backdrop-blur-sm flex items-center justify-center p-4">
              {(() => {
                const targetImp = impugnaciones.find(i => i.id === mostrarPrevisualizacionDocumento);
                if (!targetImp) return null;
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-6 border border-slate-300"
                  >
                    {/* Header */}
                    <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                      <h4 className="text-sm font-black tracking-widest text-slate-800 uppercase">RECLAMACIÓN ELECTORAL DE MESA (DÍA E)</h4>
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase">Formato Oficial de Impugnación - Ley 1475 & Código Electoral</p>
                    </div>

                    {/* Meta info */}
                    <div className="text-xs space-y-1.5">
                      <p><strong>Señores:</strong> JURADOS DE VOTACIÓN / CLAVEROS DE ELECCIONES</p>
                      <p><strong>Municipio:</strong> Según campaña activa</p>
                      <p><strong>Lugar:</strong> {puestoAsignado.nombre}</p>
                      <p><strong>Ubicación de Mesa:</strong> {puestoAsignado.mesa} - Zona {puestoAsignado.zona}</p>
                    </div>

                    {/* Legal declaration text */}
                    <div className="text-xs leading-relaxed text-slate-800 space-y-4 text-justify">
                      <p>
                        Yo, <strong>{nombreTestigoFirmante}</strong>, identificado con Cédula de Ciudadanía Nro. <strong>{cedulaTestigo}</strong>, en mi condición de Testigo Electoral debidamente acreditado y en representación de la campaña política, acudo respetuosamente ante ustedes para presentar formal **RECLAMACIÓN ELECTORAL** al tenor del artículo 192 del Código Electoral Colombiano.
                      </p>
                      
                      <div className="bg-slate-100 p-3 rounded-lg border-l-4 border-slate-800">
                        <p className="font-extrabold">CAUSAL INVOCADA:</p>
                        <p className="font-bold text-slate-700">{targetImp.causalCodigo}: {targetImp.causalTitulo}</p>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-extrabold">HECHOS Y CONSIDERACIONES:</p>
                        <p className="whitespace-pre-wrap">{targetImp.descripcion}</p>
                      </div>

                      <p>
                        <strong>PETICIÓN:</strong> Con fundamento en los hechos expuestos, solicito respetuosamente a los señores jurados proceder de conformidad con la ley, ordenando el recuento de los votos correspondientes o dejando constancia escrita en el acta E-14 para el estudio posterior de la comisión escrutadora.
                      </p>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                      <div className="flex flex-col items-center justify-end h-28 space-y-2">
                        {targetImp.firmaDigitalUrl ? (
                          <img 
                            src={targetImp.firmaDigitalUrl} 
                            alt="Firma del Testigo" 
                            className="max-h-16 object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="h-16" />
                        )}
                        <div className="border-b border-slate-900 w-full" />
                        <div className="text-center w-full">
                          <p className="font-bold">{nombreTestigoFirmante}</p>
                          <p className="text-slate-500">C.C. {cedulaTestigo}</p>
                          <p className="text-[10px] text-slate-400">Testigo Electoral Acreditado</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-end h-28 space-y-2">
                        <div className="h-16" />
                        <div className="border-b border-slate-900 w-full" />
                        <div className="text-center w-full">
                          <p className="font-bold">Firma Jurado de Mesa</p>
                          <p className="text-slate-500">Constancia de Recibido</p>
                          <p className="text-[10px] text-slate-400">Mesa Nro. {puestoAsignado.mesa}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions on PDF preview */}
                    <div className="flex gap-3 justify-end pt-4 shrink-0">
                      <button
                        onClick={() => {
                          window.print();
                        }}
                        type="button"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Imprimir Documento</span>
                      </button>
                      <button
                        onClick={() => {
                          setImpugnaciones(prev => prev.map(i => i.id === targetImp.id ? { ...i, estado: 'Firma física generada' } : i));
                          setMostrarPrevisualizacionDocumento(null);
                        }}
                        type="button"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        <span>Cerrar e Imprimir</span>
                      </button>
                    </div>

                  </motion.div>
                );
              })()}
            </div>
          )}

          {/* TAB 6: CUENTA VOTOS */}
          {activeTab === 'cuentavotos' && (
            <motion.div
              key="cuentavotos"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Hash className="w-5 h-5 text-emerald-400" />
                    Cuenta Votos en Tiempo Real
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cuentaCerrada && (
                    <span className="px-3 py-1.5 bg-red-900/40 border border-red-500/40 text-red-300 text-xs font-bold rounded-xl">
                      🔒 Conteo Cerrado
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCuentaCerrada(v => !v)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      cuentaCerrada
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {cuentaCerrada ? '🔓 Reabrir Conteo' : '🔒 Cerrar Conteo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCuenta}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-900/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reiniciar</span>
                  </button>
                </div>
              </div>

              {/* Totals Bar */}
              <div className="bg-[#020a17] border border-cyan-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Total Votos Contados</span>
                  </div>
                  <span className="text-2xl font-black text-white font-mono">{totalVotosCuenta}</span>
                </div>
                {/* Multi-segment progress bar */}
                <div className="w-full h-4 rounded-full overflow-hidden bg-slate-900 flex">
                  {candidatosCuenta.filter(c => c.votos > 0).map(c => {
                    const pct = totalVotosCuenta > 0 ? (c.votos / totalVotosCuenta) * 100 : 0;
                    const col = colorMap[c.color]?.bar || 'bg-slate-500';
                    return (
                      <div
                        key={c.id}
                        className={`${col} h-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                        title={`${c.nombre}: ${c.votos} (${pct.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                  {candidatosCuenta.map(c => {
                    const pct = totalVotosCuenta > 0 ? ((c.votos / totalVotosCuenta) * 100).toFixed(1) : '0.0';
                    const col = colorMap[c.color];
                    return (
                      <div key={c.id} className="flex items-center gap-1.5 text-[10px] font-medium">
                        <span className={`w-2.5 h-2.5 rounded-full ${col?.bar || 'bg-slate-500'}`} />
                        <span className="text-slate-400">{c.nombre}</span>
                        <span className={`font-bold ${col?.text || 'text-white'}`}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Candidate Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidatosCuenta.map(c => {
                  const pct = totalVotosCuenta > 0 ? ((c.votos / totalVotosCuenta) * 100).toFixed(1) : '0.0';
                  const col = colorMap[c.color] || colorMap['slate'];
                  return (
                    <div
                      key={c.id}
                      className={`rounded-2xl p-4 border ${col.bg} ${col.border} space-y-3 transition-all`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-black text-white leading-tight">{c.nombre}</p>
                          {c.partido && <p className="text-[10px] text-slate-500 mt-0.5">{c.partido}</p>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{pct}%</span>
                      </div>

                      {/* Big counter display */}
                      <div className={`text-4xl font-black font-mono text-center py-2 ${col.text}`}>
                        {c.votos.toString().padStart(3, '0')}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div
                          className={`${col.bar} h-full rounded-full transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* +/- Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={cuentaCerrada || c.votos === 0}
                          onClick={() => handleCuentaVoto(c.id, -1)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black text-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={cuentaCerrada}
                          onClick={() => handleCuentaVoto(c.id, 1)}
                          className={`flex-[2] py-3 rounded-xl font-black text-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${col.bg} border ${col.border} ${col.text} hover:brightness-125 active:scale-95`}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-sm">Sumar Voto</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Candidate Row */}
              {!cuentaCerrada && (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Agregar Candidato / Partido Adicional</h4>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400">Nombre del Candidato</label>
                      <input
                        type="text"
                        placeholder="Ej. Candidato C"
                        value={nuevoCandidatoNombre}
                        onChange={(e) => setNuevoCandidatoNombre(e.target.value)}
                        className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400">Partido / Aval</label>
                      <input
                        type="text"
                        placeholder="Ej. Partido Nacional"
                        value={nuevoCandidatoPartido}
                        onChange={(e) => setNuevoCandidatoPartido(e.target.value)}
                        className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAgregarCandidato}
                      disabled={!nuevoCandidatoNombre.trim()}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Log */}
              {registroCuenta.length > 0 && (
                <div className="bg-[#020a17] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bitácora de Conteo ({registroCuenta.length} registros)</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {registroCuenta.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] border-b border-slate-800/60 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm ${
                            r.accion === '+1' ? 'text-emerald-400' : 'text-red-400'
                          }`}>{r.accion}</span>
                          <span className="text-slate-300 font-medium">{r.candidatoNombre}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                          <span>→ {r.votosTras} votos</span>
                          <span className="font-mono">{r.hora}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Table when closed */}
              {cuentaCerrada && totalVotosCuenta > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <FileSpreadsheet className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Resumen Final del Conteo</h4>
                  </div>
                  <div className="space-y-2">
                    {candidatosCuenta.sort((a, b) => b.votos - a.votos).map(c => {
                      const pct = totalVotosCuenta > 0 ? ((c.votos / totalVotosCuenta) * 100).toFixed(2) : '0.00';
                      const col = colorMap[c.color] || colorMap['slate'];
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${col.bar}`} />
                            <span className="font-medium text-slate-200">{c.nombre}</span>
                            {c.partido && <span className="text-slate-500">({c.partido})</span>}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`font-black font-mono text-sm ${col.text}`}>{c.votos}</span>
                            <span className="text-slate-400 w-14 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="border-t border-emerald-800/50 pt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-white">TOTAL VOTOS</span>
                      <span className="font-black font-mono text-emerald-400 text-sm">{totalVotosCuenta}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">Puesto: {puestoAsignado.nombre} · {puestoAsignado.mesa} · Generado: {new Date().toLocaleString('es-CO')}</p>
                </div>
              )}

              {/* ======== CIERRE DE MESA ======== */}
              {cierreFormalizado ? (
                /* Cierre ya formalizado - Estado final */
                <div className="bg-gradient-to-br from-emerald-950/60 to-teal-950/40 border-2 border-emerald-500/50 rounded-3xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0">
                    <div className="px-4 py-1.5 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-bl-2xl flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> MESA CERRADA OFICIALMENTE
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <ClipboardCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Cierre de Mesa Formalizado</h3>
                      <p className="text-xs text-emerald-300 mt-0.5">
                        {puestoAsignado.mesa} · {puestoAsignado.nombre} · Hora de cierre: <strong>{horaCierre}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Sufragantes', value: totalSufragantes, color: 'text-emerald-400' },
                      { label: 'Total Votos Contados', value: String(totalVotosCuenta), color: 'text-cyan-400' },
                      { label: 'Presidente de Mesa', value: nombrePresidenteMesa, color: 'text-white' },
                      { label: 'Hora de Cierre', value: horaCierre, color: 'text-amber-300' },
                    ].map(item => (
                      <div key={item.label} className="bg-[#020a17]/80 border border-slate-800 rounded-xl p-3">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</p>
                        <p className={`text-sm font-black mt-1 font-mono ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setMostrarActaCierre(true)}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Ver e Imprimir Acta de Cierre
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('¿Reabrir el proceso de cierre? Esto reanudará el conteo.')) { setCierreFormalizado(false); setCuentaCerrada(false); } }}
                      className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-900/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Reabrir Cierre
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulario de cierre */
                <div className="bg-[#020a17] border-2 border-amber-500/30 rounded-3xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Formalizar Cierre de Mesa</h3>
                    </div>
                  </div>

                  <form onSubmit={handleFormalizarCierre} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">Hora Oficial de Cierre <span className="text-red-400">*</span></label>
                        <input
                          type="time"
                          value={horaCierre}
                          onChange={(e) => setHoraCierre(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">Total Sufragantes (Padrón) <span className="text-red-400">*</span></label>
                        <input
                          type="number"
                          placeholder="Ej. 230"
                          value={totalSufragantes}
                          onChange={(e) => setTotalSufragantes(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">Votos Contados</label>
                        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-emerald-400 font-black font-mono">
                          {totalVotosCuenta} votos
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">Nombre Presidente de Mesa <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="Nombre completo del jurado"
                          value={nombrePresidenteMesa}
                          onChange={(e) => setNombrePresidenteMesa(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300">Cédula Presidente de Mesa</label>
                        <input
                          type="text"
                          placeholder="Ej. 71.234.567"
                          value={cedulaPresidenteMesa}
                          onChange={(e) => setCedulaPresidenteMesa(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Observaciones del Cierre</label>
                      <textarea
                        placeholder="Registre cualquier novedad ocurrida al momento del cierre (urna sellada, material entregado, etc.)"
                        value={observacionesCierre}
                        onChange={(e) => setObservacionesCierre(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    {/* Firma digital del testigo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">Firma Digital del Testigo Electoral</label>
                        {firmaTestigoCierre && (
                          <button type="button" onClick={clearCanvasCierre} className="text-[10px] text-red-400 hover:text-red-300 font-medium">
                            Borrar firma
                          </button>
                        )}
                      </div>
                      <div className="relative border-2 border-dashed border-slate-700 rounded-xl overflow-hidden bg-white">
                        <canvas
                          ref={canvasCierreRef}
                          width={500}
                          height={100}
                          onMouseDown={startDrawingCierre}
                          onMouseMove={drawCierre}
                          onMouseUp={stopDrawingCierre}
                          onMouseLeave={stopDrawingCierre}
                          onTouchStart={startDrawingCierre}
                          onTouchMove={drawCierre}
                          onTouchEnd={stopDrawingCierre}
                          className="w-full h-24 cursor-crosshair touch-none"
                          style={{ display: 'block' }}
                        />
                        {!firmaTestigoCierre && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-slate-400/60 text-xs">✍️ Dibuje su firma aquí</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!cuentaCerrada && totalVotosCuenta === 0}
                      className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Formalizar Cierre Oficial de la Mesa
                    </button>
                  </form>
                </div>
              )}

              {/* ===== MODAL: ACTA DE CIERRE IMPRIMIBLE ===== */}
              {mostrarActaCierre && (
                <motion.div
                  key="actaCierre"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 z-50 bg-slate-950/90 flex items-start justify-center overflow-y-auto p-4"
                >
                  <div className="w-full max-w-2xl">
                    {/* Close/Print controls */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-black text-base flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                        Acta Oficial de Cierre de Mesa
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.print()}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                        <button
                          onClick={() => setMostrarActaCierre(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>

                    {/* Printable document */}
                    <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl space-y-5 text-[11px] leading-relaxed">
                      {/* Header */}
                      <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">República de Colombia — Registraduría Nacional del Estado Civil</p>
                        <h1 className="text-xl font-black uppercase tracking-wide">Acta de Cierre de Mesa de Votación</h1>
                        <p className="text-xs text-slate-500">Documento generado digitalmente por el Sistema de Campaña Electoral</p>
                      </div>

                      {/* Mesa info */}
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">Puesto de Votación</p>
                          <p className="font-bold">{puestoAsignado.nombre}</p>
                          <p className="text-slate-500">{puestoAsignado.direccion}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">Mesa / Zona</p>
                          <p className="font-bold">{puestoAsignado.mesa}</p>
                          <p className="text-slate-500">{puestoAsignado.zona}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">Hora de Cierre</p>
                          <p className="font-black text-lg">{horaCierre}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">Total Sufragantes (Padrón)</p>
                          <p className="font-black text-lg">{totalSufragantes}</p>
                        </div>
                      </div>

                      {/* Vote results table */}
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resultado del Conteo de Votos</p>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 border border-slate-300">
                              <th className="text-left px-3 py-2 font-bold">Candidato / Opción</th>
                              <th className="text-left px-3 py-2 font-bold">Partido / Aval</th>
                              <th className="text-right px-3 py-2 font-bold">Votos</th>
                              <th className="text-right px-3 py-2 font-bold">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...candidatosCuenta].sort((a, b) => b.votos - a.votos).map((c, idx) => (
                              <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-3 py-1.5 border border-slate-200 font-medium">{c.nombre}</td>
                                <td className="px-3 py-1.5 border border-slate-200 text-slate-500">{c.partido || '—'}</td>
                                <td className="px-3 py-1.5 border border-slate-200 text-right font-black font-mono">{c.votos}</td>
                                <td className="px-3 py-1.5 border border-slate-200 text-right text-slate-600">
                                  {totalVotosCuenta > 0 ? ((c.votos / totalVotosCuenta) * 100).toFixed(2) : '0.00'}%
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-900 text-white">
                              <td className="px-3 py-2 font-black" colSpan={2}>TOTAL VOTOS ESCRUTADOS</td>
                              <td className="px-3 py-2 text-right font-black font-mono">{totalVotosCuenta}</td>
                              <td className="px-3 py-2 text-right font-bold">100%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Observations */}
                      {observacionesCierre && (
                        <div className="border border-slate-300 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observaciones del Cierre</p>
                          <p className="text-slate-700">{observacionesCierre}</p>
                        </div>
                      )}

                      {/* Signatures */}
                      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                        {/* Testigo */}
                        <div className="flex flex-col items-center justify-end space-y-2 h-32">
                          {firmaTestigoCierre ? (
                            <img src={firmaTestigoCierre} alt="Firma Testigo" className="max-h-16 object-contain" />
                          ) : (
                            <div className="h-16" />
                          )}
                          <div className="border-b border-slate-900 w-full" />
                          <div className="text-center w-full">
                            <p className="font-bold">{authUser?.name || nombrePresidenteMesa || 'Testigo Electoral'}</p>
                            <p className="text-slate-500 text-[9px]">Testigo Acreditado de Campaña</p>
                          </div>
                        </div>
                        {/* Presidente */}
                        <div className="flex flex-col items-center justify-end space-y-2 h-32">
                          <div className="h-16" />
                          <div className="border-b border-slate-900 w-full" />
                          <div className="text-center w-full">
                            <p className="font-bold">{nombrePresidenteMesa}</p>
                            <p className="text-slate-500 text-[9px]">Presidente de Mesa {cedulaPresidenteMesa ? `· C.C. ${cedulaPresidenteMesa}` : ''}</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-100">
                        Generado el {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las {new Date().toLocaleTimeString('es-CO')} · {puestoAsignado.mesa} · {puestoAsignado.nombre}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};
