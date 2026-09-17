import React, { useState, useRef, useEffect } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { motion, AnimatePresence } from 'motion/react';
import { ViewMode, AuthUser } from '../../types';
import { ElectionLocationCheckIn } from '../common/ElectionLocationCheckIn';
import { supabase } from '../../lib/supabase';
import {
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  Camera,
  Plus,
  Minus,
  UserCheck,
  Lock,
  Search,
  Check,
  FileSpreadsheet,
  ShieldAlert,
  BookOpen,
  ClipboardCheck,
  Printer
} from 'lucide-react';

interface JuradoCampoViewProps {
  onSelectView: (view: ViewMode) => void;
  authUser: AuthUser | null;
}

interface VotantePadron {
  cedula: string;
  nombre: string;
  orden: number;
  haVotado: boolean;
  horaVoto?: string;
  firmaRegistrada?: boolean;
}

interface IncidenteMesa {
  id: string;
  hora: string;
  tipo: string;
  descripcion: string;
  gravedad: 'Baja' | 'Media' | 'Alta';
}

export const JuradoCampoView: React.FC<JuradoCampoViewProps> = ({ onSelectView, authUser }) => {
  const [activeTab, setActiveTab] = useState<'instalacion' | 'padron' | 'conteo' | 'cierre_e14' | 'novedades'>('instalacion');
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

  const [mesaAsignada, setMesaAsignada] = useState({
    id: '', puesto: 'Sin puesto asignado', direccion: 'Sin dirección registrada', comuna: 'Sin zona asignada',
    mesa: 'Sin mesa', censoTotal: 0,
    juradosAsignados: [] as Array<{ id: string; nombre: string; cargo: string; estado: string }>,
    observaciones: '' as string | null,
  });
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState('');

  // 1. Estado Instalación
  const [instalacionCompleta, setInstalacionCompleta] = useState(false);
  const [horaInstalacion, setHoraInstalacion] = useState('');
  const [kitElectoralRecibido, setKitElectoralRecibido] = useState({
    urnasVacias: false,
    tarjetines350: false,
    padronOficial: false,
    huesoTintaYEsferos: false,
    formulariosE14yE11: false
  });

  // 2. Estado Padrón E-11 (Control de Votantes)
  const [padronVotantes, setPadronVotantes] = useState<VotantePadron[]>([]);
  const [busquedaCedula, setBusquedaCedula] = useState('');
  const [votanteSeleccionado, setVotanteSeleccionado] = useState<VotantePadron | null>(null);

  // Canvas de firma digital para jurado en E-11
  const [firmaDigitalVotante, setFirmaDigitalVotante] = useState<string | null>(null);
  const canvasVotanteRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingVotante, setIsDrawingVotante] = useState(false);

  const startDrawingVotante = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasVotanteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
    setIsDrawingVotante(true);
  };

  const drawVotante = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingVotante) return;
    const canvas = canvasVotanteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
  };

  const stopDrawingVotante = () => {
    if (!isDrawingVotante) return;
    setIsDrawingVotante(false);
    if (canvasVotanteRef.current) setFirmaDigitalVotante(canvasVotanteRef.current.toDataURL());
  };

  const clearCanvasVotante = () => {
    const canvas = canvasVotanteRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaDigitalVotante(null);
  };

  const handleRegistrarVotoE11 = async () => {
    if (!votanteSeleccionado) return;
    const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const next = padronVotantes.map(v =>
      v.cedula === votanteSeleccionado.cedula
        ? { ...v, haVotado: true, horaVoto: horaActual, firmaRegistrada: !!firmaDigitalVotante }
        : v
    );
    try { await persistFieldOperations({ padronVotantes: next }); } catch (error: any) { return alert(error.message); }
    setPadronVotantes(next);
    setVotanteSeleccionado(null);
    clearCanvasVotante();
  };

  // 3. Estado Conteo de Votos de la Mesa
  const [conteoMesas, setConteoMesas] = useState([
    { id: 'c4', candidato: 'Voto en Blanco', partido: 'Oficial Registraduría', votos: 0, color: 'slate' },
    { id: 'c5', candidato: 'Votos Nulos', partido: 'Tarjetas Ilegibles / Marca Múltiple', votos: 0, color: 'red' },
    { id: 'c6', candidato: 'Tarjetas No Marcadas', partido: 'Depositados sin marcar', votos: 0, color: 'orange' },
  ]);

  const totalVotosMesas = conteoMesas.reduce((sum, item) => sum + item.votos, 0);

  const handleSumarVotoJurado = (id: string, delta: 1 | -1) => {
    setConteoMesas(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, votos: Math.max(0, item.votos + delta) };
    }));
  };

  // 4. Estado Cierre y Transmisión E-14
  const [cierreOficialTransmitido, setCierreOficialTransmitido] = useState(false);
  const [fotoE14Subida, setFotoE14Subida] = useState(false);
  const [juradosFirmantes, setJuradosFirmantes] = useState({
    presidente: false,
    vocal: false,
    secretario: false
  });

  // 4b. Formalización de Cierre
  const [cierreFormalizado, setCierreFormalizado] = useState(false);
  const [horaCierre, setHoraCierre] = useState('');
  const [totalSufragantes, setTotalSufragantes] = useState('');
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [mostrarActaCierre, setMostrarActaCierre] = useState(false);

  const handleFormalizarCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await persistFieldOperations({ cierreFormalizado: true, horaCierre, totalSufragantes, observacionesCierre, conteoMesas }); } catch (error: any) { return alert(error.message); }
    setCierreFormalizado(true);
  };

  // 5. Estado Novedades e Incidentes
  const [novedadesMesa, setNovedadesMesa] = useState<IncidenteMesa[]>([]);
  const [tipoNovedad, setTipoNovedad] = useState('Impugnación de Testigo');
  const [detallesNovedad, setDetallesNovedad] = useState('');
  const [gravedadNovedad, setGravedadNovedad] = useState<'Baja' | 'Media' | 'Alta'>('Media');

  useEffect(() => {
    let mounted = true;
    const loadRealAssignment = async () => {
      setAssignmentLoading(true); setAssignmentError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId || !authUser?.email) throw new Error('Inicie sesión con el correo registrado para el jurado.');
        const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id) throw new Error('Su usuario no tiene una campaña asignada.');
        const { data: rows, error } = await supabase.from('jurors').select('id,nombre,municipio,puesto,mesa,cargo,observaciones').eq('client_id', profile.client_id);
        if (error) throw error;
        const readMeta = (value: string | null) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
        const email = authUser.email.trim().toLowerCase();
        const assigned = (rows || []).find((row: any) => String(readMeta(row.observaciones)?.jurorMeta?.email || '').trim().toLowerCase() === email);
        if (!assigned) throw new Error('No existe una asignación real de puesto y mesa vinculada a este correo.');
        const metadata = readMeta(assigned.observaciones);
        const ops = metadata.fieldOperations || {};
        const sameTable = (rows || []).filter((row: any) => row.puesto === assigned.puesto && row.mesa === assigned.mesa);
        const roleLabels: Record<string, string> = { PRESIDENTE: 'Presidente de Mesa', VICEPRESIDENTE: 'Vicepresidente de Mesa', VOCAL: 'Vocal', REMANENTE: 'Jurado Remanente' };
        if (!mounted) return;
        setMesaAsignada({
          id: String(assigned.id), puesto: assigned.puesto || 'Sin puesto asignado',
          direccion: ops.direccionPuesto || metadata.direccionPuesto || 'Dirección no registrada',
          comuna: assigned.municipio || 'Zona no registrada', mesa: assigned.mesa || 'Sin mesa',
          censoTotal: Number(ops.censoTotal || metadata.censoTotal || 0), observaciones: assigned.observaciones,
          juradosAsignados: sameTable.map((row: any) => ({ id: String(row.id), nombre: row.nombre, cargo: roleLabels[row.cargo] || row.cargo, estado: readMeta(row.observaciones)?.fieldOperations?.locationCheckIn?.checkedInAt ? 'Presente' : 'Sin confirmar' })),
        });
        setInstalacionCompleta(Boolean(ops.instalacionCompleta)); setHoraInstalacion(String(ops.horaInstalacion || ''));
        if (ops.kitElectoralRecibido) setKitElectoralRecibido(ops.kitElectoralRecibido);
        setPadronVotantes(Array.isArray(ops.padronVotantes) ? ops.padronVotantes : []);
        if (Array.isArray(ops.conteoMesas) && ops.conteoMesas.length) setConteoMesas(ops.conteoMesas);
        setNovedadesMesa(Array.isArray(ops.novedadesMesa) ? ops.novedadesMesa : []);
        setCierreFormalizado(Boolean(ops.cierreFormalizado)); setCierreOficialTransmitido(Boolean(ops.cierreOficialTransmitido));
      } catch (loadError: any) {
        const message = loadError?.message || 'No fue posible cargar la asignación real.';
        if (mounted) setAssignmentError(/no tiene una campaña asignada/i.test(message) ? '' : message);
      } finally { if (mounted) setAssignmentLoading(false); }
    };
    void loadRealAssignment();
    return () => { mounted = false; };
  }, [authUser?.email]);

  const persistFieldOperations = async (patch: Record<string, unknown>) => {
    if (!mesaAsignada.id) throw new Error('No hay una mesa real asignada para guardar esta operación.');
    let metadata: any = {};
    try { metadata = JSON.parse(mesaAsignada.observaciones || '{}'); } catch { metadata = {}; }
    const nextMetadata = { ...metadata, fieldOperations: { ...(metadata.fieldOperations || {}), ...patch } };
    const serialized = JSON.stringify(nextMetadata);
    const { error } = await supabase.from('jurors').update({ observaciones: serialized, updated_at: new Date().toISOString() }).eq('id', mesaAsignada.id);
    if (error) throw error;
    setMesaAsignada(prev => ({ ...prev, observaciones: serialized }));
  };

  const handleReportarNovedad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detallesNovedad.trim()) return;
    const nueva: IncidenteMesa = {
      id: `nov_${Date.now()}`,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipo: tipoNovedad,
      descripcion: detallesNovedad.trim(),
      gravedad: gravedadNovedad
    };
    const next = [nueva, ...novedadesMesa];
    try { await persistFieldOperations({ novedadesMesa: next }); } catch (error: any) { return alert(error.message); }
    setNovedadesMesa(next);
    setDetallesNovedad('');
  };

  // Votantes que ya han ejercido el voto
  const totalVotaronPadron = padronVotantes.filter(v => v.haVotado).length;

  const handleCompleteInstallation = async () => {
    const now = horaInstalacion || new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    try { await persistFieldOperations({ instalacionCompleta: true, horaInstalacion: now, kitElectoralRecibido }); } catch (error: any) { return alert(error.message); }
    setHoraInstalacion(now); setInstalacionCompleta(true);
  };

  return (
    <div className="responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-slate-50/50 text-slate-900 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto overflow-x-hidden">
      {assignmentError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{assignmentError}</span>
        </div>
      )}

      {/* Banner Principal del Jurado de Mesa */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 rounded-3xl p-5 md:p-6 text-white shadow-sm border border-blue-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <ShieldCheck className="w-48 h-48 text-blue-200" />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-xs text-blue-100 font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>Panel Oficial para Jurados de Mesa de Votación</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">{mesaAsignada.puesto}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-100/90 font-medium">
              <span>{mesaAsignada.direccion}</span>
              <span className="text-blue-300/60">•</span>
              <span>{mesaAsignada.comuna}</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-row items-center gap-4 shrink-0 shadow-sm">
            <div className="p-3 bg-white/20 border border-white/30 rounded-xl text-white">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">Asignación Oficial</div>
              <div className="text-xl font-black text-white">{mesaAsignada.mesa}</div>
              <div className="text-[10px] text-blue-200 font-bold font-mono">Censo: {mesaAsignada.censoTotal} sufragantes</div>
            </div>
          </div>
        </div>
      </div>

      <ElectionLocationCheckIn authUser={authUser} personType="juror" />

      {/* Navegación por pestañas del Jurado */}
      <div 
        ref={tabsContainerRef}
        className="bg-white p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none shadow-sm scroll-smooth"
      >
        {[
          { id: 'instalacion', step: '1', label: 'Instalación de Mesa', icon: <Clock className="w-4 h-4" /> },
          { id: 'padron', step: '2', label: 'Padrón & Firma Votante (E-11)', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'conteo', step: '3', label: 'Escrutinio Mesa', icon: <FileSpreadsheet className="w-4 h-4" /> },
          { id: 'cierre_e14', step: '4', label: 'Cierre & Acta E-14', icon: <FileText className="w-4 h-4" /> },
          { id: 'novedades', step: '5', label: 'Protocolo de Incidentes', icon: <ShieldAlert className="w-4 h-4" /> }
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
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-sm font-black' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.step}
              </span>
              <span className="shrink-0">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido principal de Pestañas */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-sm min-h-[420px]">
        <AnimatePresence mode="wait">

          {/* PESTAÑA 1: INSTALACIÓN DE MESA */}
          {activeTab === 'instalacion' && (
            <motion.div
              key="instalacion"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 max-w-4xl"
            >
              <div>
                <h3 className="text-base font-black text-slate-900">Instalación y Verificación de la Mesa (07:30 AM - 08:00 AM)</h3>
              </div>

              {/* Estado de jurados */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Jurados de Mesa Acreditados</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mesaAsignada.juradosAsignados.map(j => (
                    <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{j.nombre}</p>
                        <p className="text-[10px] text-slate-500">{j.cargo}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md flex items-center gap-1 shadow-sm">
                        <Check className="w-3 h-3 text-emerald-600" /> Presente
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de chequeo del Kit Electoral */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Verificación del Kit Electoral</h4>
                <div className="space-y-3">
                  {[
                    { key: 'urnasVacias', label: 'Urna transparente verificada y vacía a las 07:45 AM en presencia de testigos' },
                    { key: 'tarjetines350', label: `Paquete con ${mesaAsignada.censoTotal} tarjetines oficiales sellados` },
                    { key: 'padronOficial', label: 'Padrón de votantes E-11 original foliado' },
                    { key: 'huesoTintaYEsferos', label: 'Huellero de tinta indeleble y esferos negros de ley' },
                    { key: 'formulariosE14yE11', label: 'Formularios E-14 (Claveros, Delegados y Traslado) limpios' }
                  ].map(item => {
                    const checked = kitElectoralRecibido[item.key as keyof typeof kitElectoralRecibido];
                    return (
                      <label key={item.key} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all shadow-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setKitElectoralRecibido(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs text-slate-700 font-medium">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Confirmación final de apertura */}
              {instalacionCompleta ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 text-emerald-900 shadow-sm">
                  <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">Apertura Oficial Registrada</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">La mesa quedó abierta formalmente a las {horaInstalacion}. El padrón de votantes está activo para firmas.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">Hora Oficial de Apertura</p>
                    <input
                      type="time"
                      value={horaInstalacion}
                      onChange={e => setHoraInstalacion(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>
                  <button
                    onClick={() => void handleCompleteInstallation()}
                    disabled={!mesaAsignada.id}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    Formalizar Apertura de Mesa 08:00 AM
                  </button>
                </div>
              )}

            </motion.div>
          )}

          {/* PESTAÑA 2: PADRÓN E-11 Y FIRMA DE VOTANTES */}
          {activeTab === 'padron' && (
            <motion.div
              key="padron"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Padrón de Votantes (Formulario E-11)</h3>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Avance de Sufragantes</span>
                  <span className="text-lg font-black text-blue-700 font-mono">{totalVotaronPadron} / {mesaAsignada.censoTotal || 0} ({mesaAsignada.censoTotal > 0 ? Math.round((totalVotaronPadron / mesaAsignada.censoTotal) * 100) : 0}%)</span>
                </div>
              </div>

              {/* Buscador de Padrón */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cédula o nombre del sufragante..."
                  value={busquedaCedula}
                  onChange={e => setBusquedaCedula(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-sm placeholder:text-slate-400"
                />
              </div>

              {/* Modal / Panel de Firma para Votante Seleccionado */}
              {votanteSeleccionado && (
                <div className="bg-slate-50 border-2 border-blue-500/40 rounded-2xl p-5 space-y-4 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Registrar Sufragio N° {votanteSeleccionado.orden}</span>
                      <h4 className="text-sm font-black text-slate-900">{votanteSeleccionado.nombre}</h4>
                      <p className="text-xs text-slate-500 font-mono">C.C. {votanteSeleccionado.cedula}</p>
                    </div>
                    <button onClick={() => setVotanteSeleccionado(null)} className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer">Cancelar</button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                      <span>Firma / Captura Digital de Huella del Elector</span>
                      {firmaDigitalVotante && (
                        <button onClick={clearCanvasVotante} className="text-[10px] text-rose-600 hover:underline cursor-pointer">Borrar Firma</button>
                      )}
                    </div>
                    <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-white shadow-inner">
                      <canvas
                        ref={canvasVotanteRef}
                        width={500}
                        height={100}
                        onMouseDown={startDrawingVotante}
                        onMouseMove={drawVotante}
                        onMouseUp={stopDrawingVotante}
                        onMouseLeave={stopDrawingVotante}
                        onTouchStart={startDrawingVotante}
                        onTouchMove={drawVotante}
                        onTouchEnd={stopDrawingVotante}
                        className="w-full h-24 cursor-crosshair touch-none"
                      />
                      {!firmaDigitalVotante && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs">
                          ✍️ Firma manual en pantalla táctil o mouse
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleRegistrarVotoE11}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Sufragio y Entregar Tarjetón
                  </button>
                </div>
              )}

              {/* Tabla de Votantes */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">N° Orden</th>
                      <th className="p-3">Cédula</th>
                      <th className="p-3">Nombre Completo</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {padronVotantes
                      .filter(v => v.cedula.includes(busquedaCedula) || v.nombre.toLowerCase().includes(busquedaCedula.toLowerCase()))
                      .map(v => (
                        <tr key={v.orden} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-500">{v.orden}</td>
                          <td className="p-3 font-mono text-blue-700 font-bold">CC: {v.cedula}</td>
                          <td className="p-3 font-bold text-slate-900">{v.nombre}</td>
                          <td className="p-3">
                            {v.haVotado ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 shadow-sm">
                                <Check className="w-3 h-3 text-emerald-600" /> Votó a las {v.horaVoto}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium rounded-full">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!v.haVotado && (
                              <button
                                onClick={() => setVotanteSeleccionado(v)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-bold text-[11px] cursor-pointer transition-all shadow-sm"
                              >
                                Registrar Voto
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* PESTAÑA 3: ESCRUTINIO DE LA MESA */}
          {activeTab === 'conteo' && (
            <motion.div
              key="conteo"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900">Escrutinio Mesa de Votación (Conteo Físico 04:00 PM)</h3>
              </div>

              {/* Total de Votos */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Votos Escrutados en Urna</span>
                  <div className="text-2xl font-black text-slate-900 font-mono">{totalVotosMesas} / {totalVotaronPadron} sufragantes</div>
                </div>
                {totalVotosMesas > totalVotaronPadron && (
                  <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Alerta: Votos exceden sufragantes
                  </span>
                )}
              </div>

              {/* Rejilla de Conteo por Opción */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {conteoMesas.map(item => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-slate-300 transition-colors">
                    <div>
                      <p className="text-xs font-black text-slate-900">{item.candidato}</p>
                      <p className="text-[10px] text-slate-500">{item.partido}</p>
                    </div>
                    <div className="text-3xl font-black text-center font-mono text-blue-700 py-1">
                      {item.votos.toString().padStart(3, '0')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSumarVotoJurado(item.id, -1)}
                        className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-lg transition-all cursor-pointer flex items-center justify-center shadow-sm"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSumarVotoJurado(item.id, 1)}
                        className="flex-[2] py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Sumar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PESTAÑA 4: CIERRE Y ACTA E-14 */}
          {activeTab === 'cierre_e14' && (
            <motion.div
              key="cierre_e14"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 max-w-4xl"
            >
              <div>
                <h3 className="text-base font-black text-slate-900">Diligenciamiento y Firma del Formulario E-14</h3>
              </div>

              {/* ======== CIERRE DE MESA ======== */}
              {cierreFormalizado ? (
                /* Cierre ya formalizado - Estado final */
                <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl p-6 space-y-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0">
                    <div className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl flex items-center gap-1.5 shadow-sm">
                      <Lock className="w-3 h-3" /> MESA CERRADA OFICIALMENTE
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                      <ClipboardCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-emerald-950">Cierre de Mesa Formalizado</h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {mesaAsignada.mesa} · {mesaAsignada.puesto} · Hora de cierre: <strong>{horaCierre}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Sufragantes', value: totalSufragantes, color: 'text-emerald-700' },
                      { label: 'Total Votos Contados', value: String(totalVotosMesas), color: 'text-blue-700' },
                      { label: 'Hora de Cierre', value: horaCierre, color: 'text-amber-700' },
                    ].map(item => (
                      <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</p>
                        <p className={`text-sm font-black mt-1 font-mono ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b border-emerald-200">
                    <button
                      type="button"
                      onClick={() => setMostrarActaCierre(true)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Ver e Imprimir Acta de Cierre
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('¿Reabrir el proceso de cierre? Esto desbloqueará el conteo.')) { setCierreFormalizado(false); } }}
                      className="px-5 py-3 bg-white hover:bg-slate-50 text-amber-700 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      Reabrir Cierre
                    </button>
                  </div>

                  {/* TRANSMISION E14 DESPUES DEL CIERRE */}
                  {cierreOficialTransmitido ? (
                    <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Acta E-14 Transmitida a Registraduría</h4>
                        <p className="text-[10px] text-slate-500">La mesa completó exitosamente todos los protocolos.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-2">Captura Fotográfica del Acta E-14 Física</h4>
                      <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 bg-white shadow-inner">
                        <Camera className="w-8 h-8 text-blue-600 mx-auto" />
                        <p className="text-xs text-slate-600 font-medium">Cargue la fotografía del formulario E-14 firmado por los jurados</p>
                        <button
                          type="button"
                          onClick={() => setFotoE14Subida(true)}
                          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          {fotoE14Subida ? '✓ Imagen E-14 Adjuntada con éxito' : 'Tomar / Subir Foto E-14'}
                        </button>
                      </div>
                      <button
                        onClick={() => setCierreOficialTransmitido(true)}
                        disabled={!fotoE14Subida}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        Transmitir E-14 Oficial a la Registraduría
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Formulario de cierre */
                <div className="bg-slate-50 border-2 border-amber-200 rounded-3xl p-6 space-y-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-amber-700">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">Formalizar Cierre de Mesa</h3>
                    </div>
                  </div>

                  <form onSubmit={handleFormalizarCierre} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Hora Oficial de Cierre <span className="text-rose-500">*</span></label>
                        <input
                          type="time"
                          value={horaCierre}
                          onChange={(e) => setHoraCierre(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Total Sufragantes (Padrón E-11) <span className="text-rose-500">*</span></label>
                        <input
                          type="number"
                          placeholder="Ej. 230"
                          value={totalSufragantes}
                          onChange={(e) => setTotalSufragantes(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700">Total Votos Contados</label>
                        <div className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-black font-mono shadow-sm">
                          {totalVotosMesas} votos
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-2 border-t border-slate-200 block">Firma de los 3 Jurados de Mesa en E-14 Físico</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'presidente', cargo: 'Presidente de Mesa' },
                          { key: 'vocal', cargo: 'Vocal / Vicepresidente' },
                          { key: 'secretario', cargo: 'Secretario' }
                        ].map(j => (
                          <label key={j.key} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={juradosFirmantes[j.key as keyof typeof juradosFirmantes]}
                              onChange={e => setJuradosFirmantes(prev => ({ ...prev, [j.key]: e.target.checked }))}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-900">{j.cargo}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-bold text-slate-700">Observaciones del Cierre</label>
                      <textarea
                        placeholder="Registre cualquier novedad ocurrida al momento del cierre"
                        value={observacionesCierre}
                        onChange={(e) => setObservacionesCierre(e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-sm placeholder:text-slate-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!juradosFirmantes.presidente || !juradosFirmantes.secretario || !juradosFirmantes.vocal}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-4"
                    >
                      <Lock className="w-4 h-4" />
                      Formalizar Cierre Oficial de la Mesa
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {/* PESTAÑA 5: PROTOCOLO DE INCIDENTES */}
          {activeTab === 'novedades' && (
            <motion.div
              key="novedades"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-black text-slate-900">Registro Oficial de Novedades e Incidentes de Mesa</h3>
              </div>

              {/* Formulario */}
              <form onSubmit={handleReportarNovedad} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Tipo de Incidente</label>
                    <select
                      value={tipoNovedad}
                      onChange={e => setTipoNovedad(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                    >
                      <option value="Impugnación de Testigo">Impugnación Presentada por Testigo</option>
                      <option value="Cédula No Encontrada">Cédula No Encontrada en Padrón</option>
                      <option value="Suplantación Intento">Intento de Suplantación / Voto Doble</option>
                      <option value="Alteración en Urna">Inconveniente Físico en Urna</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Nivel de Gravedad</label>
                    <select
                      value={gravedadNovedad}
                      onChange={e => setGravedadNovedad(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                    >
                      <option value="Baja">Baja - Menor</option>
                      <option value="Media">Media - Requiere constancia en acta</option>
                      <option value="Alta">Alta - Requiere intervención del delegado</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Detalles del Incidente</label>
                  <textarea
                    rows={3}
                    placeholder="Describa claramente los hechos..."
                    value={detallesNovedad}
                    onChange={e => setDetallesNovedad(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-sm placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                >
                  Registrar en Acta de Novedades
                </button>
              </form>

              {/* Bitácora de incidentes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Novedades en Mesa ({novedadesMesa.length})</h4>
                <div className="space-y-2">
                  {novedadesMesa.map(nov => (
                    <div key={nov.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{nov.tipo}</span>
                          <span className="text-[10px] font-mono text-slate-400">{nov.hora}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{nov.descripcion}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-md shrink-0">
                        {nov.gravedad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ===== MODAL: ACTA DE CIERRE IMPRIMIBLE ===== */}
      {mostrarActaCierre && (
        <motion.div
          key="actaCierre"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4"
        >
          <div className="w-full max-w-2xl my-8">
            {/* Close/Print controls */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-base flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                Acta Oficial de Cierre de Mesa (Para Jurados)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
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
            <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl space-y-5 text-[11px] leading-relaxed border border-slate-200">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">República de Colombia — Registraduría Nacional del Estado Civil</p>
                <h1 className="text-xl font-black uppercase tracking-wide">Acta de Cierre de Mesa de Votación</h1>
                <p className="text-xs text-slate-500">Documento generado digitalmente por el Sistema Jurado en Campo</p>
              </div>

              {/* Mesa info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Puesto de Votación</p>
                  <p className="font-bold text-slate-900">{mesaAsignada.puesto}</p>
                  <p className="text-slate-500">{mesaAsignada.direccion}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Mesa Asignada</p>
                  <p className="font-bold text-slate-900">{mesaAsignada.mesa}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Hora de Cierre</p>
                  <p className="font-black text-lg text-slate-900">{horaCierre}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total Sufragantes (E-11)</p>
                  <p className="font-black text-lg text-slate-900">{totalSufragantes}</p>
                </div>
              </div>

              {/* Vote results table */}
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resultado del Conteo de Votos (Borrador E-14)</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border border-slate-300 text-slate-700">
                      <th className="text-left px-3 py-2 font-bold">Candidato / Opción</th>
                      <th className="text-left px-3 py-2 font-bold">Partido / Aval</th>
                      <th className="text-right px-3 py-2 font-bold">Votos</th>
                      <th className="text-right px-3 py-2 font-bold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...conteoMesas].sort((a, b) => b.votos - a.votos).map((c, idx) => (
                      <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-1.5 border border-slate-200 font-medium text-slate-900">{c.candidato}</td>
                        <td className="px-3 py-1.5 border border-slate-200 text-slate-500">{c.partido || '—'}</td>
                        <td className="px-3 py-1.5 border border-slate-200 text-right font-black font-mono text-slate-900">{c.votos}</td>
                        <td className="px-3 py-1.5 border border-slate-200 text-right text-slate-600">
                          {totalVotosMesas > 0 ? ((c.votos / totalVotosMesas) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 text-white">
                      <td className="px-3 py-2 font-black" colSpan={2}>TOTAL VOTOS ESCRUTADOS EN URNA</td>
                      <td className="px-3 py-2 text-right font-black font-mono">{totalVotosMesas}</td>
                      <td className="px-3 py-2 text-right font-bold">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Observations */}
              {observacionesCierre && (
                <div className="border border-slate-300 rounded-lg p-3 mt-4">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observaciones del Cierre</p>
                  <p className="text-slate-700">{observacionesCierre}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 mt-4 border-t border-slate-200">
                {mesaAsignada.juradosAsignados.map(jurado => (
                  <div key={jurado.id} className="flex flex-col items-center justify-end space-y-2 h-32">
                    <div className="h-16" />
                    <div className="border-b border-slate-900 w-full" />
                    <div className="text-center w-full">
                      <p className="font-bold text-slate-900">{jurado.nombre}</p>
                      <p className="text-slate-500 text-[9px]">{jurado.cargo}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-100 mt-6">
                Generado el {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las {new Date().toLocaleTimeString('es-CO')} · {mesaAsignada.mesa} · {mesaAsignada.puesto}
              </p>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
};
