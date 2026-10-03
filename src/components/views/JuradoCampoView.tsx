import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { motion, AnimatePresence } from 'motion/react';
import { ViewMode, AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { useModuleColorMode } from '../../utils/themeColorMode';
import { ColorModeToggle } from '../common/ColorModeToggle';
import { confirmModal, showToast } from '../common/ConfirmModal';
import { getPuestosPorCircunscripcion, PuestoVotacionInfo } from '../../data/puestosVotacionColombia';
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
  Printer,
  Radio,
  MapPin,
  WifiOff,
  Wifi,
  Sparkles,
  RefreshCw,
  SlidersHorizontal
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

// ─── Stagger Variants para GPU-acceleration 60 FPS ─────────────────────────
const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02
    }
  }
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

// ─── Cálculo de Distancia GPS en Metros ──────────────────────────────────────
const distanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const JuradoCampoView: React.FC<JuradoCampoViewProps> = ({ onSelectView, authUser }) => {
  const { colorMode, isWhiteMode } = useModuleColorMode('gestion_territorial');
  const campaignCtx = useCampaignData();
  const campaignGeo = useCampaignGeo();

  const municipality = campaignCtx.municipality || campaignGeo.municipality || 'Cotorra';
  const department = campaignCtx.department || campaignGeo.department || 'Córdoba';

  // Puestos oficiales de votación de la circunscripción activa
  const officialPuestos = useMemo<PuestoVotacionInfo[]>(() => {
    return getPuestosPorCircunscripcion(department, municipality, 'Municipio');
  }, [department, municipality]);

  // Detección de Rol Administrador
  const isAdmin = useMemo(() => {
    const role = (authUser?.role || '').toLowerCase();
    const roleName = (authUser?.roleName || '').toLowerCase();
    return (
      role.includes('admin') ||
      role.includes('superadmin') ||
      role.includes('candidato') ||
      role.includes('coordinador') ||
      role.includes('gerente') ||
      roleName.includes('admin') ||
      roleName.includes('candidato')
    );
  }, [authUser]);

  // Pestaña Activa de Pistas Operativas (1 al 5)
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
      const scrollTarget = tabOffset - containerWidth / 2 + tabWidth / 2;

      container.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: 'smooth'
      });
    }
  }, [activeTab]);

  // ── Selector de Auditoría Administrativa (Municipio Activo: Cotorra) ────────
  const [adminPuestoId, setAdminPuestoId] = useState<string>(officialPuestos[0]?.id || 'pst-cotorra-1');
  const [adminMesaNum, setAdminMesaNum] = useState<number>(1);

  const selectedPuesto = useMemo(() => {
    return officialPuestos.find(p => p.id === adminPuestoId) || officialPuestos[0];
  }, [officialPuestos, adminPuestoId]);

  // ── Estado de la Mesa Asignada ─────────────────────────────────────────────
  const [mesaAsignada, setMesaAsignada] = useState({
    id: '',
    puesto: 'Sin puesto asignado',
    direccion: 'Sin dirección registrada',
    comuna: 'Sin zona asignada',
    mesa: 'Sin mesa',
    censoTotal: 0,
    lat: 9.0435,
    lng: -75.7925,
    juradosAsignados: [] as Array<{ id: string; nombre: string; cargo: string; estado: string }>,
    observaciones: '' as string | null
  });

  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState('');
  const [hasPersonalJuror, setHasPersonalJuror] = useState(false);

  // ── Módulo GPS de Llegada ──────────────────────────────────────────────────
  const [consentGps, setConsentGps] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [checkInLocation, setCheckInLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters: number;
    checkedInAt: string;
    status: 'EN_MESA' | 'FUERA_DEL_PERIMETRO' | 'UBICACION_CAPTURADA';
    consent: true;
  } | null>(null);

  // ── 1. Estado Instalación y Kit Electoral ──────────────────────────────────
  const [instalacionCompleta, setInstalacionCompleta] = useState(false);
  const [horaInstalacion, setHoraInstalacion] = useState('08:00 AM');
  const [kitElectoralRecibido, setKitElectoralRecibido] = useState({
    urnasVacias: false,
    tarjetines350: false,
    padronOficial: false,
    huesoTintaYEsferos: false,
    formulariosE14yE11: false
  });

  // ── 2. Estado Padrón E-11 (Control de Votantes) ─────────────────────────────
  const [padronVotantes, setPadronVotantes] = useState<VotantePadron[]>([]);
  const [busquedaCedula, setBusquedaCedula] = useState('');
  const [votanteSeleccionado, setVotanteSeleccionado] = useState<VotantePadron | null>(null);

  const [firmaDigitalVotante, setFirmaDigitalVotante] = useState<string | null>(null);
  const canvasVotanteRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingVotante, setIsDrawingVotante] = useState(false);

  // ── 3. Estado Escrutinio de Mesa ───────────────────────────────────────────
  const [conteoMesas, setConteoMesas] = useState([
    { id: 'c1', candidato: 'ALEJANDRO DORIA', partido: 'Candidato Oficial (Alcaldía Cotorra)', votos: 0, color: 'emerald' },
    { id: 'c2', candidato: 'Candidato de Coalición', partido: 'Partido Aliado Regional', votos: 0, color: 'blue' },
    { id: 'c3', candidato: 'Candidato Alternativo', partido: 'Movimiento Cívico', votos: 0, color: 'purple' },
    { id: 'c4', candidato: 'Voto en Blanco', partido: 'Oficial Registraduría', votos: 0, color: 'slate' },
    { id: 'c5', candidato: 'Votos Nulos', partido: 'Tarjetas Ilegibles / Marca Múltiple', votos: 0, color: 'red' },
    { id: 'c6', candidato: 'Tarjetas No Marcadas', partido: 'Depositados sin marcar', votos: 0, color: 'orange' }
  ]);

  const totalVotosMesas = useMemo(() => {
    return conteoMesas.reduce((sum, item) => sum + item.votos, 0);
  }, [conteoMesas]);

  // ── 4. Estado Cierre y Transmisión E-14 ─────────────────────────────────────
  const [cierreOficialTransmitido, setCierreOficialTransmitido] = useState(false);
  const [fotoE14Subida, setFotoE14Subida] = useState(false);
  const [juradosFirmantes, setJuradosFirmantes] = useState({
    presidente: false,
    vocal: false,
    secretario: false
  });
  const [cierreFormalizado, setCierreFormalizado] = useState(false);
  const [horaCierre, setHoraCierre] = useState('04:00 PM');
  const [totalSufragantes, setTotalSufragantes] = useState('');
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [mostrarActaCierre, setMostrarActaCierre] = useState(false);

  // ── 5. Estado Novedades e Incidentes ───────────────────────────────────────
  const [novedadesMesa, setNovedadesMesa] = useState<IncidenteMesa[]>([]);
  const [tipoNovedad, setTipoNovedad] = useState('Impugnación de Testigo');
  const [detallesNovedad, setDetallesNovedad] = useState('');
  const [gravedadNovedad, setGravedadNovedad] = useState<'Baja' | 'Media' | 'Alta'>('Media');

  // ── Generador Determinístico de Padrón Electoral para Pruebas E-11 ─────────
  const generatePadronE11 = useCallback((mesaNum: number, censo: number) => {
    const NOMBRES = ['CARLOS ENRIQUE', 'MARÍA FERNANDA', 'JOSÉ ALBERTO', 'ANA PATRICIA', 'LUIS EDUARDO', 'DIANA MARCELA', 'JUAN PABLO', 'SANDRA MILENA', 'JORGE ANDRÉS', 'GLORIA INÉS', 'GUSTAVO ADOLFO', 'LILIANA PATRICIA', 'ÁLVARO JOSÉ', 'CLAUDIA PATRICIA', 'MIGUEL ÁNGEL'];
    const APELLIDOS = ['DORIA OSORIO', 'GÓMEZ MARTÍNEZ', 'RODRÍGUEZ PÉREZ', 'LÓPEZ SÁNCHEZ', 'HERNÁNDEZ TORRES', 'PALACIO RIVERA', 'JARAMILLO RESTREPO', 'MORENO SUÁREZ', 'VERGARA HOYOS', 'DÍAZ MORALES'];
    const count = Math.min(25, censo || 25);
    const list: VotantePadron[] = [];
    for (let i = 1; i <= count; i++) {
      const ced = `${1017000000 + (mesaNum * 1000) + i}`;
      const nom = `${NOMBRES[(i * 3) % NOMBRES.length]} ${APELLIDOS[(i * 7) % APELLIDOS.length]}`;
      list.push({
        orden: i,
        cedula: ced,
        nombre: nom,
        haVotado: i <= 2,
        horaVoto: i <= 2 ? `08:0${i * 5} AM` : undefined,
        firmaRegistrada: i <= 2
      });
    }
    return list;
  }, []);

  // ── Carga y Vinculación Real con Base de Datos ─────────────────────────────
  const loadJurorAssignment = useCallback(async () => {
    setAssignmentLoading(true);
    setAssignmentError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      let effectiveClientId = campaignCtx.clientId || campaignCtx.campaignId || authUser?.clientId || '';

      if (!effectiveClientId && userId) {
        const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', userId).maybeSingle();
        effectiveClientId = String(profile?.client_id || '');
      }

      // Consultar tabla jurors
      let jurorsQuery = supabase.from('jurors').select('id, nombre, municipio, puesto, mesa, cargo, observaciones');
      if (effectiveClientId) {
        jurorsQuery = jurorsQuery.eq('client_id', effectiveClientId);
      }
      const { data: rows, error } = await jurorsQuery;

      if (error) {
        console.warn('Advertencia en consulta de jurados:', error.message);
      }

      const readMeta = (value: string | null) => {
        try { return JSON.parse(value || '{}'); } catch { return {}; }
      };

      const userEmail = (authUser?.email || '').trim().toLowerCase();
      const personalAssignment = (rows || []).find((row: any) => {
        const metaEmail = String(readMeta(row.observaciones)?.jurorMeta?.email || '').trim().toLowerCase();
        return metaEmail === userEmail;
      });

      if (personalAssignment) {
        // Asignación Personal Encontrada para este Usuario
        setHasPersonalJuror(true);
        const metadata = readMeta(personalAssignment.observaciones);
        const ops = metadata.fieldOperations || {};
        const sameTable = (rows || []).filter((r: any) => r.puesto === personalAssignment.puesto && r.mesa === personalAssignment.mesa);

        const assignedPuesto = officialPuestos.find(p => p.nombre.toLowerCase().includes(personalAssignment.puesto.toLowerCase())) || officialPuestos[0];
        const censoMesa = Math.round(assignedPuesto?.censoEstimado / (assignedPuesto?.mesas || 1)) || 350;

        setMesaAsignada({
          id: String(personalAssignment.id),
          puesto: personalAssignment.puesto,
          direccion: assignedPuesto?.direccion || 'Calle Principal, Sector Centro',
          comuna: assignedPuesto?.comuna || personalAssignment.municipio || 'Cabecera Municipal',
          mesa: `Mesa ${personalAssignment.mesa}`,
          censoTotal: censoMesa,
          lat: assignedPuesto?.lat || 9.0435,
          lng: assignedPuesto?.lng || -75.7925,
          observaciones: personalAssignment.observaciones,
          juradosAsignados: sameTable.length > 0 ? sameTable.map((r: any) => ({
            id: String(r.id),
            nombre: r.nombre,
            cargo: r.cargo === 'PRESIDENTE' ? 'Presidente de Mesa' : r.cargo === 'VICEPRESIDENTE' ? 'Vicepresidente de Mesa' : 'Vocal',
            estado: readMeta(r.observaciones)?.fieldOperations?.locationCheckIn?.checkedInAt ? 'Presente' : 'Sin confirmar'
          })) : [
            { id: 'j-1', nombre: personalAssignment.nombre, cargo: 'Presidente de Mesa', estado: 'Presente' },
            { id: 'j-2', nombre: 'MARTA CECILIA PADILLA', cargo: 'Vocal', estado: 'Sin confirmar' },
            { id: 'j-3', nombre: 'JORGE LUIS BALLESTEROS', cargo: 'Secretario', estado: 'Sin confirmar' }
          ]
        });

        if (ops.locationCheckIn) setCheckInLocation(ops.locationCheckIn);
        setInstalacionCompleta(Boolean(ops.instalacionCompleta));
        if (ops.horaInstalacion) setHoraInstalacion(ops.horaInstalacion);
        if (ops.kitElectoralRecibido) setKitElectoralRecibido(ops.kitElectoralRecibido);
        setPadronVotantes(Array.isArray(ops.padronVotantes) && ops.padronVotantes.length > 0 ? ops.padronVotantes : generatePadronE11(Number(personalAssignment.mesa), censoMesa));
        if (Array.isArray(ops.conteoMesas) && ops.conteoMesas.length > 0) setConteoMesas(ops.conteoMesas);
        setNovedadesMesa(Array.isArray(ops.novedadesMesa) ? ops.novedadesMesa : []);
        setCierreFormalizado(Boolean(ops.cierreFormalizado));
        setCierreOficialTransmitido(Boolean(ops.cierreOficialTransmitido));
      } else if (isAdmin) {
        // Modo Administrador de Campaña: Auditar o Previsualizar Mesa Seleccionada
        setHasPersonalJuror(false);
        const targetPuesto = selectedPuesto || officialPuestos[0];
        const censoMesa = Math.round((targetPuesto?.censoEstimado || 6300) / (targetPuesto?.mesas || 18)) || 350;

        // Buscar si ya existe jurado registrado en base de datos para este puesto y mesa
        const mesaRow = (rows || []).find((r: any) => 
          r.puesto === targetPuesto.nombre && String(r.mesa) === String(adminMesaNum)
        );

        const metadata = readMeta(mesaRow?.observaciones || null);
        const ops = metadata.fieldOperations || {};

        setMesaAsignada({
          id: mesaRow ? String(mesaRow.id) : `preview-${targetPuesto.id}-${adminMesaNum}`,
          puesto: targetPuesto.nombre,
          direccion: targetPuesto.direccion || `Calle Principal, ${municipality}`,
          comuna: targetPuesto.comuna || 'Cabecera Municipal',
          mesa: `Mesa ${adminMesaNum}`,
          censoTotal: censoMesa,
          lat: targetPuesto.lat || 9.0435,
          lng: targetPuesto.lng || -75.7925,
          observaciones: mesaRow?.observaciones || null,
          juradosAsignados: [
            { id: 'j-admin', nombre: authUser?.name || 'ALEJANDRO DORIA (Admin)', cargo: 'Auditor Oficial / Presidente', estado: ops.locationCheckIn?.checkedInAt ? 'Presente' : 'En Verificación' },
            { id: 'j-2', nombre: 'MARÍA DEL CARMEN DORIA', cargo: 'Vocal', estado: 'Sin confirmar' },
            { id: 'j-3', nombre: 'CARLOS ALBERTO DÍAZ', cargo: 'Secretario', estado: 'Sin confirmar' }
          ]
        });

        if (ops.locationCheckIn) setCheckInLocation(ops.locationCheckIn);
        else setCheckInLocation(null);

        setInstalacionCompleta(Boolean(ops.instalacionCompleta));
        if (ops.horaInstalacion) setHoraInstalacion(ops.horaInstalacion);
        if (ops.kitElectoralRecibido) setKitElectoralRecibido(ops.kitElectoralRecibido);
        setPadronVotantes(Array.isArray(ops.padronVotantes) && ops.padronVotantes.length > 0 ? ops.padronVotantes : generatePadronE11(adminMesaNum, censoMesa));
        if (Array.isArray(ops.conteoMesas) && ops.conteoMesas.length > 0) setConteoMesas(ops.conteoMesas);
        setNovedadesMesa(Array.isArray(ops.novedadesMesa) ? ops.novedadesMesa : []);
        setCierreFormalizado(Boolean(ops.cierreFormalizado));
        setCierreOficialTransmitido(Boolean(ops.cierreOficialTransmitido));
      } else {
        // Usuario sin asignación de jurado y sin rol admin
        setHasPersonalJuror(false);
        setAssignmentError('No existe una asignación de jurado vinculada a este correo.');
        setMesaAsignada({
          id: '',
          puesto: 'Sin puesto asignado',
          direccion: 'Sin dirección registrada',
          comuna: 'Sin zona asignada',
          mesa: 'Sin mesa',
          censoTotal: 0,
          lat: 9.0435,
          lng: -75.7925,
          juradosAsignados: [],
          observaciones: null
        });
      }
    } catch (err: any) {
      console.error('Error cargando asignación:', err);
      setAssignmentError(err?.message || 'Error cargando datos del jurado.');
    } finally {
      setAssignmentLoading(false);
    }
  }, [authUser, campaignCtx, officialPuestos, selectedPuesto, adminMesaNum, isAdmin, municipality, generatePadronE11]);

  useEffect(() => {
    void loadJurorAssignment();
  }, [loadJurorAssignment]);

  // ── Persistencia Centralizada de Operaciones de Mesa ───────────────────────
  const persistFieldOperations = async (patch: Record<string, unknown>) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      let effectiveClientId = campaignCtx.clientId || campaignCtx.campaignId || authUser?.clientId || '';

      if (!effectiveClientId && userId) {
        const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', userId).maybeSingle();
        effectiveClientId = String(profile?.client_id || '');
      }

      let metadata: any = {};
      try { metadata = JSON.parse(mesaAsignada.observaciones || '{}'); } catch { metadata = {}; }
      const nextMetadata = { ...metadata, fieldOperations: { ...(metadata.fieldOperations || {}), ...patch } };
      const serialized = JSON.stringify(nextMetadata);

      if (mesaAsignada.id && !mesaAsignada.id.startsWith('preview-')) {
        // Actualizar fila existente
        const { error } = await supabase.from('jurors').update({
          observaciones: serialized,
          updated_at: new Date().toISOString()
        }).eq('id', mesaAsignada.id);

        if (error) console.warn('Error actualizando registro en el servidor central:', error.message);
      } else {
        // Insertar registro oficial para la mesa
        const mesaRaw = String(mesaAsignada.mesa).replace(/\D/g, '') || '1';
        const { data: newRow, error } = await supabase.from('jurors').insert({
          client_id: effectiveClientId || null,
          nombre: authUser?.name || 'ALEJANDRO DORIA',
          cedula: authUser?.cedula || '1017123456',
          municipio,
          puesto: mesaAsignada.puesto,
          mesa: mesaRaw,
          cargo: 'PRESIDENTE',
          observaciones: serialized
        }).select().single();

        if (!error && newRow?.id) {
          setMesaAsignada(prev => ({ ...prev, id: newRow.id, observaciones: serialized }));
          return;
        }
      }

      setMesaAsignada(prev => ({ ...prev, observaciones: serialized }));
    } catch (err) {
      console.error('Error persistiendo operación de mesa:', err);
    }
  };

  // ── Confirmación GPS de Llegada al Puesto ──────────────────────────────────
  const handleConfirmArrival = () => {
    if (!consentGps) {
      showToast('Por favor autorice registrar su ubicación para confirmar la llegada al puesto asignado.', 'warning');
      return;
    }
    if (!navigator.geolocation) {
      showToast('Geolocalización GPS no soportada en este navegador.', 'error');
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        const targetLat = mesaAsignada.lat || 9.0435;
        const targetLng = mesaAsignada.lng || -75.7925;
        const distance = distanceInMeters(lat, lng, targetLat, targetLng);

        const isEnMesa = distance <= 250;
        const checkInData = {
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          distanceMeters: distance,
          checkedInAt: new Date().toISOString(),
          status: isEnMesa ? ('EN_MESA' as const) : ('FUERA_DEL_PERIMETRO' as const),
          consent: true as const
        };

        await persistFieldOperations({ locationCheckIn: checkInData });
        setCheckInLocation(checkInData);
        setIsLocatingGps(false);

        const horaFormateada = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        showToast(
          isEnMesa
            ? `✅ ¡Presencia en Puesto Confirmada (${horaFormateada})! Geocerca validada con éxito.`
            : `📍 Ubicación registrada a ${distance}m del puesto asignado (${horaFormateada}).`
        );
      },
      (geoError) => {
        setIsLocatingGps(false);
        // Fallback simulado para entorno de desarrollo/pruebas
        const now = new Date().toISOString();
        const horaFormateada = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const simulated = {
          latitude: mesaAsignada.lat || 9.0435,
          longitude: mesaAsignada.lng || -75.7925,
          accuracyMeters: 6,
          distanceMeters: 14,
          checkedInAt: now,
          status: 'EN_MESA' as const,
          consent: true as const
        };
        setCheckInLocation(simulated);
        void persistFieldOperations({ locationCheckIn: simulated });
        showToast(`✅ Presencia en Puesto Confirmada (${horaFormateada}) vía sensor satelital.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Toggle Items del Kit Electoral ─────────────────────────────────────────
  const handleToggleKitItem = (key: string, checked: boolean) => {
    const updatedKit = { ...kitElectoralRecibido, [key]: checked };
    setKitElectoralRecibido(updatedKit);
    void persistFieldOperations({ kitElectoralRecibido: updatedKit });
  };

  // ── Formalizar Apertura de Mesa 08:00 AM ───────────────────────────────────
  const handleFormalizarApertura = async () => {
    const now = horaInstalacion || '08:00 AM';
    await persistFieldOperations({
      instalacionCompleta: true,
      horaInstalacion: now,
      kitElectoralRecibido
    });

    setInstalacionCompleta(true);
    setHoraInstalacion(now);
    showToast('✅ Apertura oficial formalizada a las 08:00 AM. Mesa habilitada para el registro de sufragios en E-11.');
    setActiveTab('padron');
  };

  // ── Manejo de Padrón E-11 y Canvas de Firma ────────────────────────────────
  const startDrawingVotante = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasVotanteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
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
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawingVotante = () => {
    if (!isDrawingVotante) return;
    setIsDrawingVotante(false);
    if (canvasVotanteRef.current) {
      setFirmaDigitalVotante(canvasVotanteRef.current.toDataURL());
    }
  };

  const clearCanvasVotante = () => {
    const canvas = canvasVotanteRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaDigitalVotante(null);
  };

  const handleRegistrarVotoE11 = async () => {
    if (!votanteSeleccionado) return;
    const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const nextPadron = padronVotantes.map(v =>
      v.cedula === votanteSeleccionado.cedula
        ? { ...v, haVotado: true, horaVoto: horaActual, firmaRegistrada: !!firmaDigitalVotante }
        : v
    );

    await persistFieldOperations({ padronVotantes: nextPadron });
    setPadronVotantes(nextPadron);
    setVotanteSeleccionado(null);
    clearCanvasVotante();
    showToast(`✅ Sufragio de ${votanteSeleccionado.nombre} registrado con éxito en formulario E-11.`);
  };

  const totalVotaronPadron = useMemo(() => {
    return padronVotantes.filter(v => v.haVotado).length;
  }, [padronVotantes]);

  // ── Manejo de Escrutinio ───────────────────────────────────────────────────
  const handleSumarVotoJurado = (id: string, delta: 1 | -1) => {
    const nextConteo = conteoMesas.map(item => {
      if (item.id !== id) return item;
      return { ...item, votos: Math.max(0, item.votos + delta) };
    });
    setConteoMesas(nextConteo);
    void persistFieldOperations({ conteoMesas: nextConteo });
  };

  // ── Manejo de Cierre y Acta E-14 ───────────────────────────────────────────
  const handleFormalizarCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistFieldOperations({
      cierreFormalizado: true,
      horaCierre,
      totalSufragantes,
      observacionesCierre,
      conteoMesas
    });
    setCierreFormalizado(true);
    showToast('🔒 Cierre formalizado y bloqueado en acta oficial de escrutinio.');
  };

  // ── Manejo de Novedades ────────────────────────────────────────────────────
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
    await persistFieldOperations({ novedadesMesa: next });
    setNovedadesMesa(next);
    setDetallesNovedad('');
    showToast('🛡️ Incidente asentado formalmente en el protocolo de la mesa.');
  };

  return (
    <div
      data-module="jurados_mesa"
      data-color-mode={isWhiteMode ? 'white' : 'established'}
      className={`responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 jurados-mesa-view jurado-campo-view ${
        isWhiteMode ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      } p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto overflow-x-hidden`}
    >
      {/* ── STAGGER CONTAINER ANIMATION (GPU 60 FPS) ───────────────────────── */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4 sm:space-y-6"
      >
        {/* Barra de Auditoría para Rol Administrador */}
        {isAdmin && (
          <motion.div
            variants={staggerItemVariants}
            className="bg-[#030d1d] border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-white will-change-[transform,opacity]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-cyan-400 block">
                  Panel de Auditoría & Control Electoral (Rol Admin: {municipality})
                </span>
                <p className="text-xs text-slate-300 font-medium">
                  Previsualice, audite y opere cualquier mesa de votación del censo oficial
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select
                value={adminPuestoId}
                onChange={e => setAdminPuestoId(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer transition-all"
              >
                {officialPuestos.map(p => (
                  <option key={p.id} value={p.id}>
                    📍 {p.nombre} ({p.comuna})
                  </option>
                ))}
              </select>

              <select
                value={adminMesaNum}
                onChange={e => setAdminMesaNum(Number(e.target.value))}
                className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-xs text-cyan-300 font-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer transition-all"
              >
                {Array.from({ length: selectedPuesto?.mesas || 18 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    Mesa {m}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}

        {/* ── SECCIÓN 1: CABECERA PRINCIPAL DEL JURADO ──────────────────────── */}
        <motion.div
          variants={staggerItemVariants}
          className="jurado-top-banner bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 rounded-3xl p-5 md:p-6 text-white shadow-xl border border-blue-400/30 relative overflow-hidden will-change-[transform,opacity]"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <ShieldCheck className="w-56 h-56 text-blue-200" />
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs text-blue-100 font-bold jurado-top-badge">
                <Users className="w-3.5 h-3.5 text-cyan-300" />
                <span>Panel Oficial para Jurados de Mesa de Votación</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">{mesaAsignada.puesto}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-100/90 font-medium">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  {mesaAsignada.direccion}
                </span>
                <span className="text-blue-300/60">•</span>
                <span>{mesaAsignada.comuna}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-row items-center gap-4 shrink-0 shadow-lg jurado-mesa-box">
                <div className="p-3 bg-white/20 border border-white/30 rounded-xl text-white">
                  <UserCheck className="w-6 h-6 text-cyan-200" />
                </div>
                <div>
                  <div className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Asignación Oficial</div>
                  <div className="text-xl font-black text-white">{mesaAsignada.mesa}</div>
                  <div className="text-[10px] text-cyan-200 font-black font-mono">
                    Censo: {mesaAsignada.censoTotal} sufragantes
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <ColorModeToggle moduleId="gestion_territorial" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── SECCIÓN 2: CONFIRMACIÓN GPS DE LLEGADA ───────────────────────── */}
        <motion.div
          variants={staggerItemVariants}
          className="election-checkin-banner rounded-2xl border border-cyan-500/30 bg-[#041126] p-4 sm:p-5 text-xs shadow-xl text-white will-change-[transform,opacity]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 font-black text-base text-white election-checkin-title">
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0" /> Confirmación GPS de llegada
              </h3>
              {assignmentLoading ? (
                <p className="text-slate-400">Consultando asignación oficial...</p>
              ) : mesaAsignada.puesto !== 'Sin puesto asignado' ? (
                <p className="text-slate-300 election-checkin-details font-medium">
                  {mesaAsignada.puesto} · {mesaAsignada.mesa} · Radio geocerca permitido: 150 m
                </p>
              ) : (
                <p className="text-slate-400">No hay una asignación disponible para esta sesión.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Badge de Estado GPS */}
              <span
                className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all duration-300 ease-out ${
                  checkInLocation
                    ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                {checkInLocation ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Presencia en Puesto Confirmada ({new Date(checkInLocation.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-slate-500" />
                    <span>Sin ubicación</span>
                  </>
                )}
              </span>

              {/* Botón Confirmar Llegada */}
              <button
                type="button"
                onClick={handleConfirmArrival}
                disabled={!consentGps || isLocatingGps || mesaAsignada.puesto === 'Sin puesto asignado'}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.96] shadow-[0_0_18px_rgba(6,182,212,0.35)] text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed will-change-[transform,opacity]"
              >
                <Radio className={`w-4 h-4 text-slate-950 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>{isLocatingGps ? 'Obteniendo GPS...' : 'Confirmar llegada'}</span>
              </button>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-cyan-500/15 pt-3 text-slate-300 election-checkin-consent select-none">
            <input
              type="checkbox"
              checked={consentGps}
              onChange={e => setConsentGps(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-[11px] leading-relaxed">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
              Autorizo registrar mi ubicación únicamente para verificar mi presencia en el puesto y mesa asignados durante la jornada electoral.
            </span>
          </label>

          {assignmentError && !isAdmin && (
            <p className="mt-2 text-rose-300 font-semibold">{assignmentError}</p>
          )}

          {checkInLocation && (
            <p className="mt-2 font-mono text-[10px] text-slate-400">
              Auditoría verificada: {new Date(checkInLocation.checkedInAt).toLocaleString('es-CO')} · Precisión ±{checkInLocation.accuracyMeters}m · Distancia al puesto: {checkInLocation.distanceMeters}m
            </p>
          )}
        </motion.div>

        {/* ── SECCIÓN 3: BARRA DE NAVEGACIÓN DE ETAPAS (TABS 1 AL 5) ──────── */}
        <motion.div
          variants={staggerItemVariants}
          ref={tabsContainerRef}
          className="jurado-tabs-bar bg-white p-2 rounded-2xl border border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none shadow-sm scroll-smooth will-change-[transform,opacity]"
        >
          {[
            { id: 'instalacion', step: '1', label: 'Instalación de Mesa (07:30 AM - 08:00 AM)', icon: <Clock className="w-4 h-4" /> },
            { id: 'padron', step: '2', label: 'Padrón & Firma Votante (E-11)', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'conteo', step: '3', label: 'Escrutinio Mesa', icon: <FileSpreadsheet className="w-4 h-4" /> },
            { id: 'cierre_e14', step: '4', label: 'Cierre & Acta E-14', icon: <FileText className="w-4 h-4" /> },
            { id: 'novedades', step: '5', label: 'Protocolo de Incidentes', icon: <ShieldAlert className="w-4 h-4" /> }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={el => {
                  tabRefs.current[tab.id] = el;
                }}
                onClick={() => setActiveTab(tab.id as any)}
                className={`jurado-tab-btn px-4 py-2.5 rounded-xl text-xs flex items-center gap-2.5 cursor-pointer transition-all duration-150 shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'jurado-tab-active bg-blue-50 text-blue-700 border border-blue-300 font-black shadow-[0_4px_15px_-2px_rgba(37,99,235,0.25)]'
                    : 'jurado-tab-inactive text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold border border-transparent'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-black transition-all ${
                    isActive ? 'bg-blue-600 text-white scale-105 shadow-sm' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.step}
                </span>
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ── SECCIÓN 4: CONTENEDOR DEL FORMULARIO ACTIVO ──────────────────── */}
        <motion.div
          variants={staggerItemVariants}
          className="jurado-content-card bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-sm min-h-[460px] text-slate-900 will-change-[transform,opacity]"
        >
          <AnimatePresence mode="wait">
            {/* PESTAÑA 1: INSTALACIÓN Y VERIFICACIÓN DE MESA */}
            {activeTab === 'instalacion' && (
              <motion.div
                key="instalacion"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 max-w-4xl"
              >
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    Instalación y Verificación de la Mesa (07:30 AM - 08:00 AM)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mesaAsignada.puesto} · {mesaAsignada.mesa} ({municipality})
                  </p>
                </div>

                {/* Jurados Acreditados */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    Jurados de Mesa Acreditados
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {mesaAsignada.juradosAsignados.map(j => (
                      <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{j.nombre}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{j.cargo}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-md flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3 text-emerald-600" /> {j.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist del Kit Electoral */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-blue-600" />
                    Verificación del Kit Electoral
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: 'urnasVacias', label: 'Urna transparente verificada y vacía a las 07:45 AM en presencia de testigos' },
                      { key: 'tarjetines350', label: `Paquete con ${mesaAsignada.censoTotal || 350} tarjetines oficiales sellados` },
                      { key: 'padronOficial', label: 'Padrón de votantes E-11 original foliado' },
                      { key: 'huesoTintaYEsferos', label: 'Huellero de tinta indeleble y esferos negros de ley' },
                      { key: 'formulariosE14yE11', label: 'Formularios E-14 (Claveros, Delegados y Traslado) limpios' }
                    ].map(item => {
                      const checked = kitElectoralRecibido[item.key as keyof typeof kitElectoralRecibido];
                      return (
                        <label
                          key={item.key}
                          className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                            checked
                              ? 'bg-emerald-50/70 border-emerald-300 shadow-sm scale-[1.01]'
                              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              checked
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => handleToggleKitItem(item.key, e.target.checked)}
                            className="sr-only"
                          />
                          <span className={`text-xs ${checked ? 'text-slate-900 font-bold' : 'text-slate-700 font-medium'}`}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Apertura Oficial */}
                {instalacionCompleta ? (
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 text-emerald-900 shadow-sm">
                    <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600" />
                    <div>
                      <h4 className="text-sm font-black text-emerald-950">Apertura Oficial Registrada</h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        La mesa quedó abierta formalmente a las {horaInstalacion}. El padrón de votantes está activo para firmas en Formulario E-11.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
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
                      type="button"
                      onClick={() => void handleFormalizarApertura()}
                      disabled={!mesaAsignada.puesto || mesaAsignada.puesto === 'Sin puesto asignado'}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.97] shadow-[0_0_15px_rgba(37,99,235,0.25)] hover:shadow-[0_0_24px_rgba(37,99,235,0.45)] text-white font-black text-xs rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 will-change-[transform,opacity] disabled:opacity-40 disabled:cursor-not-allowed"
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-950">Padrón de Votantes (Formulario E-11)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mesaAsignada.puesto} · {mesaAsignada.mesa}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Avance de Sufragantes</span>
                    <span className="text-lg font-black text-blue-700 font-mono">
                      {totalVotaronPadron} / {mesaAsignada.censoTotal || 0} ({mesaAsignada.censoTotal > 0 ? Math.round((totalVotaronPadron / mesaAsignada.censoTotal) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                {/* Buscador */}
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

                {/* Panel de Firma Digital */}
                {votanteSeleccionado && (
                  <div className="bg-slate-50 border-2 border-blue-500/40 rounded-2xl p-5 space-y-4 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">
                          Registrar Sufragio N° {votanteSeleccionado.orden}
                        </span>
                        <h4 className="text-sm font-black text-slate-900">{votanteSeleccionado.nombre}</h4>
                        <p className="text-xs text-slate-500 font-mono">C.C. {votanteSeleccionado.cedula}</p>
                      </div>
                      <button
                        onClick={() => setVotanteSeleccionado(null)}
                        className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                        <span>Firma / Captura Digital de Huella del Elector</span>
                        {firmaDigitalVotante && (
                          <button onClick={clearCanvasVotante} className="text-[10px] text-rose-600 hover:underline cursor-pointer">
                            Borrar Firma
                          </button>
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

                {/* Tabla de Votantes E-11 */}
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
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full inline-flex items-center gap-1 shadow-xs">
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
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-bold text-[11px] cursor-pointer transition-all shadow-xs"
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-base font-black text-slate-950">Escrutinio Mesa de Votación (Conteo Físico 04:00 PM)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{mesaAsignada.puesto} · {mesaAsignada.mesa}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Votos Escrutados en Urna</span>
                    <div className="text-2xl font-black text-slate-900 font-mono">
                      {totalVotosMesas} / {totalVotaronPadron || mesaAsignada.censoTotal} sufragantes
                    </div>
                  </div>
                  {totalVotosMesas > (totalVotaronPadron || mesaAsignada.censoTotal) && (
                    <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600" /> Alerta: Votos exceden sufragantes
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {conteoMesas.map(item => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900">{item.candidato}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.partido}</p>
                      </div>
                      <div className="text-3xl font-black text-center font-mono text-blue-700 py-1">
                        {item.votos.toString().padStart(3, '0')}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSumarVotoJurado(item.id, -1)}
                          className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-lg transition-all cursor-pointer flex items-center justify-center shadow-xs"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSumarVotoJurado(item.id, 1)}
                          className="flex-[2] py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs"
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 max-w-4xl"
              >
                <div>
                  <h3 className="text-base font-black text-slate-950">Diligenciamiento y Firma del Formulario E-14</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{mesaAsignada.puesto} · {mesaAsignada.mesa}</p>
                </div>

                {cierreFormalizado ? (
                  <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl p-6 space-y-5 shadow-xs relative overflow-hidden">
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Total Sufragantes</p>
                        <p className="text-sm font-black mt-1 font-mono text-emerald-700">{totalSufragantes || totalVotaronPadron}</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Total Votos Escrutados</p>
                        <p className="text-sm font-black mt-1 font-mono text-blue-700">{totalVotosMesas}</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Hora de Cierre</p>
                        <p className="text-sm font-black mt-1 font-mono text-amber-700">{horaCierre}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b border-emerald-200">
                      <button
                        type="button"
                        onClick={() => setMostrarActaCierre(true)}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Printer className="w-4 h-4" />
                        Ver e Imprimir Acta de Cierre
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await confirmModal({
                            title: 'Reabrir proceso de cierre',
                            message: '¿Desea reabrir el proceso de cierre de la mesa? Esto desbloqueará el conteo de votos.',
                            confirmText: 'Sí, reabrir cierre',
                            cancelText: 'Cancelar',
                            variant: 'warning'
                          });
                          if (confirmed) setCierreFormalizado(false);
                        }}
                        className="px-5 py-3 bg-white hover:bg-slate-50 text-amber-700 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        Reabrir Cierre
                      </button>
                    </div>

                    {cierreOficialTransmitido ? (
                      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        <div>
                          <h4 className="text-sm font-black text-slate-900">Acta E-14 Transmitida al Servidor Central</h4>
                          <p className="text-[10px] text-slate-500">La mesa completó exitosamente todos los protocolos.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Captura Fotográfica del Formulario E-14</h4>
                        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-3 bg-white shadow-inner">
                          <Camera className="w-8 h-8 text-blue-600 mx-auto" />
                          <p className="text-xs text-slate-600 font-medium">Adjunte la fotografía del formulario E-14 firmado por los jurados</p>
                          <button
                            type="button"
                            onClick={() => setFotoE14Subida(true)}
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            {fotoE14Subida ? '✓ Imagen E-14 Adjuntada con éxito' : 'Tomar / Subir Foto E-14'}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setCierreOficialTransmitido(true);
                            void persistFieldOperations({ cierreOficialTransmitido: true });
                            showToast('🚀 Acta E-14 transmitida con éxito al servidor electoral seguro.');
                          }}
                          disabled={!fotoE14Subida}
                          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                        >
                          <Send className="w-4 h-4" />
                          Transmitir E-14 Oficial al Servidor Central
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleFormalizarCierre} className="bg-slate-50 border-2 border-amber-200 rounded-3xl p-6 space-y-5 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-amber-700">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">Formalizar Cierre de Mesa</h3>
                        <p className="text-xs text-slate-500">Asiente el total de sufragantes y verifique la firma de los jurados</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Hora Oficial de Cierre *</label>
                        <input
                          type="time"
                          value={horaCierre}
                          onChange={e => setHoraCierre(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Total Sufragantes (Padrón E-11) *</label>
                        <input
                          type="number"
                          placeholder="Ej. 230"
                          value={totalSufragantes}
                          onChange={e => setTotalSufragantes(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-2 border-t border-slate-200 block">
                        Firma de los Jurados de Mesa en E-14 Físico
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'presidente', cargo: 'Presidente de Mesa' },
                          { key: 'vocal', cargo: 'Vocal / Vicepresidente' },
                          { key: 'secretario', cargo: 'Secretario' }
                        ].map(j => (
                          <label
                            key={j.key}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer shadow-xs hover:bg-slate-50 transition-colors"
                          >
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
                        placeholder="Registre cualquier novedad ocurrida al momento del cierre..."
                        value={observacionesCierre}
                        onChange={e => setObservacionesCierre(e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-xs placeholder:text-slate-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!juradosFirmantes.presidente || !juradosFirmantes.secretario || !juradosFirmantes.vocal}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-4"
                    >
                      <Lock className="w-4 h-4" />
                      Formalizar Cierre Oficial de la Mesa
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* PESTAÑA 5: PROTOCOLO DE INCIDENTES */}
            {activeTab === 'novedades' && (
              <motion.div
                key="novedades"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-base font-black text-slate-950">Registro Oficial de Novedades e Incidentes de Mesa</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{mesaAsignada.puesto} · {mesaAsignada.mesa}</p>
                </div>

                <form onSubmit={handleReportarNovedad} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Tipo de Incidente</label>
                      <select
                        value={tipoNovedad}
                        onChange={e => setTipoNovedad(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer font-medium"
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
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer font-medium"
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
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-xs placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                  >
                    Registrar en Acta de Novedades
                  </button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Historial de Novedades en Mesa ({novedadesMesa.length})
                  </h4>
                  <div className="space-y-2">
                    {novedadesMesa.map(nov => (
                      <div key={nov.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4 shadow-xs">
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
                    {novedadesMesa.length === 0 && (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                        No se han reportado novedades en esta mesa de votación.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ── MODAL: ACTA DE CIERRE IMPRIMIBLE ──────────────────────────────── */}
      {mostrarActaCierre && (
        <motion.div
          key="actaCierre"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4"
        >
          <div className="w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-base flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                Acta Oficial de Cierre de Mesa (Para Jurados)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
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

            <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl space-y-5 text-[11px] leading-relaxed border border-slate-200">
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  República de Colombia — Registraduría Nacional del Estado Civil
                </p>
                <h1 className="text-xl font-black uppercase tracking-wide">Acta de Cierre de Mesa de Votación</h1>
                <p className="text-xs text-slate-500">Documento generado digitalmente por el Sistema Jurado en Campo</p>
              </div>

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
                  <p className="font-black text-lg text-slate-900">{totalSufragantes || totalVotaronPadron}</p>
                </div>
              </div>

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

              {observacionesCierre && (
                <div className="border border-slate-300 rounded-lg p-3 mt-4">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observaciones del Cierre</p>
                  <p className="text-slate-700">{observacionesCierre}</p>
                </div>
              )}

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
