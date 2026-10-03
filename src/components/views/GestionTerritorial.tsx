import React, { lazy, Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { motion, AnimatePresence } from 'motion/react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { ViewMode, TerritorialZone, AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { useModuleColorMode } from '../../utils/themeColorMode';
import { ColorModeToggle } from '../common/ColorModeToggle';
import { confirmModal, showToast } from '../common/ConfirmModal';
import { getPuestosPorCircunscripcion, PuestoVotacionInfo } from '../../data/puestosVotacionColombia';
import { 
  Search, 
  Filter, 
  MapPin, 
  Plus, 
  Users, 
  WifiOff, 
  Wifi, 
  Globe, 
  Edit3, 
  Target, 
  Award, 
  X, 
  Trash2, 
  Radio, 
  Sparkles, 
  RefreshCw, 
  Navigation, 
  Save,
  CheckCircle2,
  Clock,
  UserCheck
} from 'lucide-react';

const RegistroVotantesView = lazy(() => import('./RegistroVotantesView').then(module => ({ default: module.RegistroVotantesView })));

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

// ─── CountUp Component (0.4s via requestAnimationFrame) ────────────────────
const CountUp: React.FC<{ end: number; duration?: number; suffix?: string; prefix?: string }> = ({
  end,
  duration = 400,
  suffix = '',
  prefix = ''
}) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * end));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <>{prefix}{val.toLocaleString('es-CO')}{suffix}</>;
};

// ─── Mapa Leaflet: Centrado Territorial & Redimensionamiento Automático ──────
const MapController: React.FC<{
  center: [number, number];
  points: Array<{ lat: number; lng: number }>;
}> = ({ center, points }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate size una sola vez al montar para asegurar renderizado nítido de tiles sin parpadeo
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(
        points.map(p => [p.lat, p.lng] as [number, number]),
        { padding: [36, 36], maxZoom: 15 }
      );
    } else {
      map.setView(center, 13);
    }
  }, [map, center, points]);

  return null;
};

// ─── Controles de Zoom Personalizados Estilo SaaS Dark ──────────────────────
const CustomZoomControls: React.FC = () => {
  const map = useMap();
  return (
    <div className="absolute top-4 left-4 z-[400] flex flex-col gap-1.5 shadow-xl">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-8 h-8 rounded-lg bg-[#020712]/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 font-bold text-lg flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-md shadow-md"
        title="Acercar mapa"
        aria-label="Acercar mapa"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-8 h-8 rounded-lg bg-[#020712]/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 font-bold text-lg flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-md shadow-md"
        title="Alejar mapa"
        aria-label="Alejar mapa"
      >
        −
      </button>
    </div>
  );
};

// ─── Coordenadas Oficiales de Centros Municipales ────────────────────────────
const MUNICIPAL_COORDINATES: Record<string, [number, number]> = {
  'cotorra': [9.0433, -75.7958],
  'montería': [8.7479, -75.8814],
  'monteria': [8.7479, -75.8814],
  'cereté': [8.8844, -75.7911],
  'cerete': [8.8844, -75.7911],
  'lorica': [9.2392, -75.8139],
  'sahagún': [8.9472, -75.4431],
  'sahagun': [8.9472, -75.4431],
  'medellín': [6.2442, -75.5812],
  'medellin': [6.2442, -75.5812],
  'bogotá': [4.6097, -74.0817],
  'bogotá d.c.': [4.6097, -74.0817],
  'bogota': [4.6097, -74.0817],
  'cali': [3.4516, -76.5320],
  'barranquilla': [10.9685, -74.7813],
  'cartagena': [10.3910, -75.4794],
  'bucaramanga': [7.1193, -73.1227],
  'cúcuta': [7.8939, -72.5078],
  'cucuta': [7.8939, -72.5078],
  'pereira': [4.8133, -75.6961],
  'manizales': [5.0689, -75.5174],
  'ibagué': [4.4389, -75.2322],
  'santa marta': [11.2408, -74.1990],
  'valledupar': [10.4631, -73.2532],
  'villavicencio': [4.1420, -73.6266],
  'pasto': [1.2136, -77.2811],
  'sincelejo': [9.3047, -75.3978]
};

const STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY = 'offline_field_registrations_queue';

interface RealMapPoint {
  id: string;
  lat: number;
  lng: number;
  nombre?: string;
  tipo: 'votante' | 'lider' | 'encuesta' | 'campo';
  intencion?: string;
  puesto?: string;
  barrio?: string;
}

interface GestionTerritorialProps {
  onSelectView: (view: ViewMode) => void;
  zones: TerritorialZone[];
  onOpenFieldRegistrationModal?: () => void;
  initialSubTab?: 'registro' | 'mapa';
  onSubTabChange?: (subTab: 'registro' | 'mapa') => void;
  authUser?: AuthUser | null;
}

export const GestionTerritorial: React.FC<GestionTerritorialProps> = ({
  onSelectView,
  zones,
  onOpenFieldRegistrationModal,
  initialSubTab = 'registro',
  onSubTabChange,
  authUser
}) => {
  // ── Datos de campaña y territorio activo ──────────────────────────────────
  const campaignCtx = useCampaignData();
  const campaignGeo = useCampaignGeo();
  const { colorMode, isWhiteMode } = useModuleColorMode('gestion_territorial');

  const municipality = campaignCtx.municipality || campaignGeo.municipality || 'Cotorra';
  const department = campaignCtx.department || campaignGeo.department || 'Córdoba';

  // Coordenadas centrales por defecto para el municipio activo (Cotorra: 9.0433, -75.7958)
  const defaultMunicipalCenter: [number, number] = useMemo(() => {
    const key = municipality.trim().toLowerCase();
    if (MUNICIPAL_COORDINATES[key]) return MUNICIPAL_COORDINATES[key];
    const puestos = getPuestosPorCircunscripcion(department, municipality, 'Municipio');
    if (puestos.length > 0 && puestos[0].lat && puestos[0].lng) {
      return [puestos[0].lat, puestos[0].lng];
    }
    return [9.0433, -75.7958];
  }, [municipality, department]);

  // Puestos oficiales de votación del municipio activo
  const officialPuestos = useMemo<PuestoVotacionInfo[]>(() => {
    return getPuestosPorCircunscripcion(department, municipality, 'Municipio');
  }, [department, municipality]);

  // Total oficial de mesas del municipio
  const totalMesasOficiales = useMemo(() => {
    const count = officialPuestos.reduce((acc, p) => acc + (p.mesas || 0), 0);
    return count > 0 ? count : 32;
  }, [officialPuestos]);

  // Censo electoral meta estimado para el municipio
  const censoMetaOficial = useMemo(() => {
    const sumCenso = officialPuestos.reduce((acc, p) => acc + (p.censoEstimado || 0), 0);
    return sumCenso > 0 ? sumCenso : 11200;
  }, [officialPuestos]);

  // ── Estados Locales ───────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'registro' | 'mapa'>(initialSubTab);
  const [sectorList, setSectorList] = useState<TerritorialZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<TerritorialZone | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estadísticas operativas en tiempo real
  const [realStats, setRealStats] = useState({
    leaders: 0,
    voters: 0,
    voteGoal: 0,
    witnesses: 0,
    accreditedWitnesses: 0,
    completedSurveys: 0,
    surveysInProcess: 0
  });

  const [realMapPoints, setRealMapPoints] = useState<RealMapPoint[]>([]);

  // ── Modal y Estado Offline para Registro en Campo ──────────────────────────
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Formulario de Captura Rápida
  const [fieldTipo, setFieldTipo] = useState<'votante' | 'lider'>('votante');
  const [fieldNombre, setFieldNombre] = useState('');
  const [fieldCedula, setFieldCedula] = useState('');
  const [fieldTelefono, setFieldTelefono] = useState('');
  const [fieldBarrio, setFieldBarrio] = useState('');
  const [fieldPuesto, setFieldPuesto] = useState('');
  const [fieldMesa, setFieldMesa] = useState('1');
  const [fieldIntencion, setFieldIntencion] = useState('Voto Seguro');
  const [fieldNotas, setFieldNotas] = useState('');
  const [fieldGps, setFieldGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [isSubmittingField, setIsSubmittingField] = useState(false);

  // Modales de Sector
  const [editingSector, setEditingSector] = useState<TerritorialZone | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editMetaVotos, setEditMetaVotos] = useState<number | string>('');
  const [editLideres, setEditLideres] = useState<number | string>('');
  const [editVotantes, setEditVotantes] = useState<number | string>('');
  const [showAddSectorModal, setShowAddSectorModal] = useState<boolean>(false);
  const [newSectorName, setNewSectorName] = useState<string>('');
  const [newSectorMetaVotos, setNewSectorMetaVotos] = useState<number | string>(5000);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabSelect = (tab: 'registro' | 'mapa') => {
    setActiveSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  // ── Sincronización Automática de Cola Offline ──────────────────────────────
  const syncOfflineQueue = useCallback(async () => {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY);
    if (!raw) return;

    try {
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: any[] = [];
      let syncedCount = 0;

      for (const item of queue) {
        try {
          const table = item.tipo === 'lider' ? 'leaders' : 'voters';
          const payload: any = {
            client_id: item.client_id || null,
            nombre: item.nombre,
            cedula: item.cedula,
            telefono: item.telefono,
            comuna: item.comuna || item.barrio,
            barrio: item.barrio,
            puesto: item.puesto,
            mesa: String(item.mesa || '1'),
            status: 'ACTIVE'
          };

          if (table === 'voters') {
            payload.municipio = item.municipio || municipality;
            payload.departamento = item.departamento || department;
            payload.intencion = item.intencion || 'Voto Seguro';
          }

          const { error } = await supabase.from(table).insert(payload);
          if (!error) {
            syncedCount++;
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY, JSON.stringify(remaining));
        setPendingOfflineCount(remaining.length);
      } else {
        localStorage.removeItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY);
        setPendingOfflineCount(0);
      }

      if (syncedCount > 0) {
        showToast(`✅ Se sincronizaron ${syncedCount} registro(s) capturados en campo con el servidor central seguro.`);
        void loadRealTerritorialData();
      }
    } catch (e) {
      console.error('Error sincronizando cola offline:', e);
    }
  }, [municipality, department]);

  // Monitoreo de Conectividad de Red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Leer registros offline pendientes iniciales
    try {
      const raw = localStorage.getItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY);
      if (raw) {
        const q = JSON.parse(raw);
        if (Array.isArray(q)) setPendingOfflineCount(q.length);
      }
    } catch {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineQueue]);

  // ── Carga de Datos Reales desde la Base de Datos Central ───────────────────
  const loadRealTerritorialData = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      let effectiveClientId = campaignCtx.clientId || campaignCtx.campaignId || authUser?.clientId || '';

      if (!effectiveClientId && userId) {
        const { data: profile } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
        effectiveClientId = String(profile?.client_id || '');
      }

      // 1. Consulta de Campaña activa y Meta de Votos
      let campaignQuery = supabase.from('campaigns').select('id, meta_votos');
      if (effectiveClientId) {
        campaignQuery = campaignQuery.eq('client_id', effectiveClientId);
      }
      const { data: campaignsData } = await campaignQuery.order('updated_at', { ascending: false }).limit(1);
      const voteGoalFromDb = Number(campaignsData?.[0]?.meta_votos || 0);
      const effectiveVoteGoal = voteGoalFromDb > 0 ? voteGoalFromDb : censoMetaOficial;

      // 2. Consulta de Líderes
      let leadersQuery = supabase.from('leaders').select('id, nombre, comuna, barrio, status').eq('status', 'ACTIVE');
      if (effectiveClientId) {
        leadersQuery = leadersQuery.eq('client_id', effectiveClientId);
      }
      const { data: leadersData } = await leadersQuery;
      const leaders = leadersData || [];

      // 3. Consulta de Votantes
      let votersQuery = supabase.from('voters').select('id, nombre, cedula, telefono, comuna, barrio, puesto, mesa, intencion, status').eq('status', 'ACTIVE');
      if (effectiveClientId) {
        votersQuery = votersQuery.eq('client_id', effectiveClientId);
      }
      const { data: votersData } = await votersQuery;
      const voters = votersData || [];

      // 4. Consulta de Testigos Electorales
      let witnessesQuery = supabase.from('witnesses').select('id, nombre, estado, zona, puesto, mesa, municipio').neq('estado', 'INACTIVO');
      if (effectiveClientId) {
        witnessesQuery = witnessesQuery.eq('client_id', effectiveClientId);
      }
      const { data: witnessesData } = await witnessesQuery;
      const witnesses = witnessesData || [];

      const accreditedWitnesses = witnesses.filter((item: any) => 
        ['ACREDITADO', 'EN_MESA', 'CAPACITADO'].includes(String(item.estado).toUpperCase())
      ).length;

      // 5. Consulta de Encuestas e Investigación
      let surveyQuery = supabase.from('surveys').select('id, estado');
      if (effectiveClientId) {
        surveyQuery = surveyQuery.eq('client_id', effectiveClientId);
      }
      const { data: surveysData } = await surveyQuery;
      const surveys = surveysData || [];
      const surveysInProcess = surveys.filter((s: any) => String(s.estado).toUpperCase() === 'ACTIVA').length;

      let responsesQuery = supabase.from('survey_responses').select('id, latitude, longitude, created_at');
      if (effectiveClientId) {
        responsesQuery = responsesQuery.eq('client_id', effectiveClientId);
      }
      const { data: responsesData } = await responsesQuery;
      const surveyResponses = responsesData || [];

      // Actualizar Estadísticas Operativas
      setRealStats({
        leaders: leaders.length,
        voters: voters.length,
        voteGoal: effectiveVoteGoal,
        witnesses: witnesses.length,
        accreditedWitnesses,
        completedSurveys: surveyResponses.length,
        surveysInProcess
      });

      // 6. Extracción de Puntos GPS Reales para el Mapa
      const gpsPoints: RealMapPoint[] = [];

      // Puntos de encuestas georreferenciadas
      surveyResponses.forEach((item: any) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
          gpsPoints.push({
            id: `surv-${item.id}`,
            lat,
            lng,
            nombre: 'Encuesta Georreferenciada',
            tipo: 'encuesta'
          });
        }
      });

      // Puntos de registros de campo locales pendientes con GPS
      try {
        const rawLocal = localStorage.getItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            parsed.forEach((localItem: any, idx: number) => {
              if (localItem.gps?.lat && localItem.gps?.lng) {
                gpsPoints.push({
                  id: `local-field-${idx}`,
                  lat: localItem.gps.lat,
                  lng: localItem.gps.lng,
                  nombre: localItem.nombre,
                  tipo: 'campo',
                  intencion: localItem.intencion,
                  puesto: localItem.puesto,
                  barrio: localItem.barrio
                });
              }
            });
          }
        }
      } catch {}

      setRealMapPoints(gpsPoints);

      // 7. Agrupación Dinámica de Sectores por Comuna / Zona
      const grouped = new Map<string, { leaders: number; voters: number; witnesses: number }>();
      const ensure = (name: string) => {
        const key = name.trim() || 'Cabecera Municipal';
        if (!grouped.has(key)) grouped.set(key, { leaders: 0, voters: 0, witnesses: 0 });
        return grouped.get(key)!;
      };

      leaders.forEach((item: any) => { ensure(String(item.comuna || item.barrio || '')).leaders += 1; });
      voters.forEach((item: any) => { ensure(String(item.comuna || item.barrio || '')).voters += 1; });
      witnesses.forEach((item: any) => { ensure(String(item.zona || item.puesto || '')).witnesses += 1; });

      const entries = [...grouped.entries()];
      if (entries.length > 0) {
        setSectorList(entries.map(([nombre, value], index) => {
          const metaVotos = effectiveVoteGoal ? Math.round(effectiveVoteGoal / entries.length) : 5000;
          return {
            id: `real-${index}-${nombre}`,
            nombre,
            lideres: value.leaders,
            votantes: value.voters,
            cobertura: metaVotos ? Math.min(100, Math.round((value.voters * 100) / metaVotos)) : 0,
            heatValue: value.voters,
            coordenadas: { x: 20 + (index % 4) * 20, y: 25 + Math.floor(index / 4) * 25 },
            testigosActivos: value.witnesses,
            testigosFaltantes: 0,
            metaVotos
          };
        }));
      } else {
        setSectorList([]);
      }
    } catch (err) {
      console.error('Error cargando métricas territoriales:', err);
    }
  }, [campaignCtx, authUser, censoMetaOficial]);

  // Suscripción Realtime para actualización automática de 60 FPS sin parpadeos
  useEffect(() => {
    if (activeSubTab !== 'mapa') return;
    let isSubscribed = true;

    void loadRealTerritorialData();

    const channel = supabase.channel('realtime-gestion-territorial')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaders' }, () => {
        if (isSubscribed) void loadRealTerritorialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => {
        if (isSubscribed) void loadRealTerritorialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'witnesses' }, () => {
        if (isSubscribed) void loadRealTerritorialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surveys' }, () => {
        if (isSubscribed) void loadRealTerritorialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_responses' }, () => {
        if (isSubscribed) void loadRealTerritorialData();
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      void supabase.removeChannel(channel);
    };
  }, [activeSubTab, loadRealTerritorialData]);

  // ── Cálculos Matemáticos de Indicadores ────────────────────────────────────
  const coveragePercent = realStats.voteGoal > 0
    ? Math.min(100, Math.round((realStats.voters * 100) / realStats.voteGoal))
    : 0;

  const witnessTrainingPercent = realStats.witnesses > 0
    ? Math.min(100, Math.round((realStats.accreditedWitnesses * 100) / realStats.witnesses))
    : 0;

  const faltantesTestigos = Math.max(0, totalMesasOficiales - realStats.witnesses);

  const filteredSectorList = useMemo(() => {
    return sectorList.filter(z => z.nombre.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [sectorList, searchQuery]);

  // ── Manejo de Captura GPS en Tiempo Real ───────────────────────────────────
  const handleCaptureDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatusMsg('Geolocalización no soportada por el navegador.');
      return;
    }

    setIsLocatingGps(true);
    setGpsStatusMsg('Detectando posición GPS satelital...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        setFieldGps({ lat, lng, accuracy });
        setIsLocatingGps(false);
        setGpsStatusMsg(`GPS Satelital Fijado: ${lat}, ${lng} (Precisión: ±${accuracy}m)`);
      },
      (err) => {
        setIsLocatingGps(false);
        console.warn('Acceso GPS denegado o no disponible:', err);
        // Fallback a coordenadas del municipio activo
        setFieldGps({ lat: defaultMunicipalCenter[0], lng: defaultMunicipalCenter[1], accuracy: 50 });
        setGpsStatusMsg(`Ubicación aproximada en cabecera municipal: ${defaultMunicipalCenter[0]}, ${defaultMunicipalCenter[1]}`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // ── Envío del Formulario de Registro en Campo (Offline Ready) ──────────────
  const handleSubmitFieldRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fieldNombre.trim() || !fieldCedula.trim()) {
      showToast('Por favor ingrese el Nombre Completo y la Cédula.', 'warning');
      return;
    }

    setIsSubmittingField(true);

    const recordPayload: any = {
      client_id: campaignCtx.clientId || campaignCtx.campaignId || authUser?.clientId || null,
      nombre: fieldNombre.trim(),
      cedula: fieldCedula.trim(),
      telefono: fieldTelefono.trim(),
      comuna: fieldBarrio.trim() || 'Cabecera Municipal',
      barrio: fieldBarrio.trim() || 'Sector Centro',
      puesto: fieldPuesto.trim() || `I.E. Central de ${municipality}`,
      mesa: fieldMesa.trim() || '1',
      tipo: fieldTipo,
      gps: fieldGps,
      intencion: fieldIntencion,
      notas: fieldNotas.trim(),
      fecha: new Date().toISOString()
    };

    if (fieldTipo === 'votante') {
      recordPayload.municipio = municipality;
      recordPayload.departamento = department;
    }

    // Modo Online: intentar persistir en la base de datos central segura
    if (isOnline && navigator.onLine) {
      try {
        const table = fieldTipo === 'lider' ? 'leaders' : 'voters';
        const dbPayload: any = {
          client_id: recordPayload.client_id,
          nombre: recordPayload.nombre,
          cedula: recordPayload.cedula,
          telefono: recordPayload.telefono,
          comuna: recordPayload.comuna,
          barrio: recordPayload.barrio,
          puesto: recordPayload.puesto,
          mesa: recordPayload.mesa,
          status: 'ACTIVE'
        };

        if (table === 'voters') {
          dbPayload.municipio = municipality;
          dbPayload.departamento = department;
          dbPayload.intencion = fieldIntencion;
        }

        const { error } = await supabase.from(table).insert(dbPayload);

        if (!error) {
          showToast(`✅ ${fieldTipo === 'lider' ? 'Líder' : 'Votante'} ${fieldNombre} registrado y georreferenciado con éxito.`);
          
          // Agregar punto en tiempo real al mapa
          if (fieldGps) {
            setRealMapPoints(prev => [
              {
                id: `field-${Date.now()}`,
                lat: fieldGps.lat,
                lng: fieldGps.lng,
                nombre: fieldNombre,
                tipo: 'campo',
                intencion: fieldIntencion,
                puesto: fieldPuesto,
                barrio: fieldBarrio
              },
              ...prev
            ]);
          }

          resetFieldForm();
          setIsFieldModalOpen(false);
          setIsSubmittingField(false);
          void loadRealTerritorialData();
          return;
        }
      } catch (err) {
        console.warn('Fallo guardando en servidor central seguro, derivando a cola offline:', err);
      }
    }

    // Modo Offline o fallo de red: persistir en almacenamiento local del dispositivo
    try {
      const currentQueue = JSON.parse(localStorage.getItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY) || '[]');
      currentQueue.push(recordPayload);
      localStorage.setItem(STORAGE_OFFLINE_FIELD_REGISTRATIONS_KEY, JSON.stringify(currentQueue));
      setPendingOfflineCount(currentQueue.length);

      // Si tiene GPS, reflejar de inmediato en el mapa localmente
      if (fieldGps) {
        setRealMapPoints(prev => [
          {
            id: `field-local-${Date.now()}`,
            lat: fieldGps.lat,
            lng: fieldGps.lng,
            nombre: fieldNombre,
            tipo: 'campo',
            intencion: fieldIntencion,
            puesto: fieldPuesto,
            barrio: fieldBarrio
          },
          ...prev
        ]);
      }

      showToast(`💾 Modo Offline: Registro de ${fieldNombre} almacenado localmente en el dispositivo. Se sincronizará automáticamente al recuperar señal.`);
      resetFieldForm();
      setIsFieldModalOpen(false);
    } catch (e) {
      console.error('Error guardando en almacenamiento offline:', e);
      showToast('No fue posible guardar el registro offline.', 'error');
    } finally {
      setIsSubmittingField(false);
    }
  };

  const resetFieldForm = () => {
    setFieldNombre('');
    setFieldCedula('');
    setFieldTelefono('');
    setFieldBarrio('');
    setFieldPuesto('');
    setFieldMesa('1');
    setFieldNotas('');
    setFieldGps(null);
    setGpsStatusMsg(null);
  };

  // ── Manejadores de Sector Territorial ──────────────────────────────────────
  const handleSaveSector = () => {
    if (!editingSector) return;
    const numMeta = typeof editMetaVotos === 'number' ? editMetaVotos : parseInt(editMetaVotos as string) || 0;
    const numLideres = typeof editLideres === 'number' ? editLideres : parseInt(editLideres as string) || 0;
    const numVotantes = typeof editVotantes === 'number' ? editVotantes : parseInt(editVotantes as string) || 0;

    const newNombre = editName.trim() || editingSector.nombre;
    const newCobertura = numMeta > 0 ? Math.min(100, Math.round((numVotantes / numMeta) * 100)) : editingSector.cobertura;

    setSectorList(prev => prev.map(s => {
      if (s.id !== editingSector.id) return s;
      return {
        ...s,
        nombre: newNombre,
        metaVotos: numMeta,
        lideres: numLideres,
        votantes: numVotantes,
        cobertura: newCobertura
      };
    }));

    setEditingSector(null);
    showToast(`Sector "${newNombre}" actualizado correctamente.`);
  };

  const handleDeleteSector = async (sectorId: string) => {
    const target = sectorList.find(s => s.id === sectorId);
    if (!target) return;
    const confirmed = await confirmModal({
      title: 'Eliminar sector territorial',
      message: `¿Está seguro de eliminar el sector "${target.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar sector',
      cancelText: 'Cancelar',
      variant: 'danger'
    });
    if (!confirmed) return;

    setSectorList(prev => prev.filter(s => s.id !== sectorId));
    if (selectedZone?.id === sectorId) setSelectedZone(null);
    setEditingSector(null);
    showToast(`Sector "${target.nombre}" eliminado.`);
  };

  const handleAddSectorSubmit = () => {
    if (!newSectorName.trim()) return;
    const numMeta = typeof newSectorMetaVotos === 'number' ? newSectorMetaVotos : parseInt(newSectorMetaVotos as string) || 5000;

    const newZone: TerritorialZone = {
      id: `z_${Date.now()}`,
      nombre: newSectorName.trim(),
      lideres: 0,
      votantes: 0,
      cobertura: 0,
      heatValue: 0,
      coordenadas: { x: 50, y: 50 },
      testigosActivos: 0,
      testigosFaltantes: 0,
      metaVotos: numMeta
    };

    setSectorList(prev => [...prev, newZone]);
    setSelectedZone(newZone);
    setShowAddSectorModal(false);
    setNewSectorName('');
    setNewSectorMetaVotos(5000);
    showToast(`Nuevo sector "${newZone.nombre}" creado exitosamente.`);
  };

  return (
    <div 
      className="module-theme-root responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#020712] text-white p-3 sm:p-4 md:p-6 space-y-5 overflow-x-hidden transition-colors duration-200"
      data-module="gestion_territorial"
      data-color-mode={isWhiteMode ? 'white' : 'established'}
    >
      {/* Estilos CSS Inyectados para Tiles Leaflet y Glassmorphism Flotante */}
      <style>{`
        .leaflet-tile {
          transition: opacity 0.3s ease-in-out !important;
        }
        .leaflet-container {
          background: #020712 !important;
          font-family: inherit !important;
        }
        @keyframes mapBannerFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .map-notice-banner {
          animation: mapBannerFloat 4s ease-in-out infinite;
        }
      `}</style>

      {/* ── BARRA SUPERIOR: TÍTULO, SUBTABS & COLOR MODE ────────────────── */}
      <motion.div 
        variants={staggerItemVariants}
        initial="hidden"
        animate="show"
        className="gestion-territorial-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyan-500/20"
      >
        <div className="flex items-center gap-3">
          <div className="gestion-territorial-icon-box w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/40">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="gestion-territorial-title font-extrabold text-lg sm:text-xl text-white tracking-tight">
                Gestión Territorial & Censo
              </h2>
              <span className="gestion-territorial-badge text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                Módulo 3
              </span>
            </div>
            <p className="gestion-territorial-subtitle text-xs text-slate-400 mt-0.5">
              Despliegue en territorio, líderes, mapa de calor y testigos electorales ({municipality}, {department})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="gestion-territorial-subtabs flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-md">
            <button
              onClick={() => handleSubTabSelect('registro')}
              className={`gestion-territorial-subtab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'registro'
                  ? 'gestion-territorial-subtab-active bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow'
                  : 'gestion-territorial-subtab-inactive text-slate-400 hover:text-white'
              }`}
            >
              Registro de Votantes
            </button>
            <button
              onClick={() => handleSubTabSelect('mapa')}
              className={`gestion-territorial-subtab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'mapa'
                  ? 'gestion-territorial-subtab-active bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow'
                  : 'gestion-territorial-subtab-inactive text-slate-400 hover:text-white'
              }`}
            >
              Mapa & Cobertura
            </button>
          </div>
          <ColorModeToggle moduleId="gestion_territorial" />
        </div>
      </motion.div>

      {/* ── CONTENIDO PRINCIPAL: SUBTAB REGISTRO O MAPA ─────────────────── */}
      {activeSubTab === 'registro' ? (
        <Suspense fallback={
          <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
            <div className="h-[2px] w-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500 animate-pulse" />
          </div>
        }>
          <RegistroVotantesView 
            onSelectView={onSelectView} 
            authUser={authUser} 
            onSwitchToMap={() => handleSubTabSelect('mapa')}
            onSelectSubTab={handleSubTabSelect}
          />
        </Suspense>
      ) : (
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Main Grid: Panel Lateral Izquierdo + Mapa Central GIS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* ── PANEL LATERAL IZQUIERDO: KPI CARDS & BOTÓN OFFLINE ─────── */}
            <motion.div 
              variants={staggerItemVariants}
              className="gestion-territorial-sidebar lg:col-span-4 space-y-4"
            >
              
              {/* Tarjeta 1: Líderes y Votantes */}
              <div className="gestion-territorial-kpi-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]">
                <h3 className="gestion-territorial-kpi-title text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2 flex items-center justify-between">
                  <span>Líderes y Votantes</span>
                  <Users className="w-4 h-4 text-teal-400" />
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Total Líderes:</span>
                    <span className="font-extrabold text-white text-sm">
                      <CountUp end={realStats.leaders} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Total Votantes:</span>
                    <span className="font-extrabold text-white text-sm">
                      <CountUp end={realStats.voters} />
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-300 mb-1">
                    <span>Porcentaje de Cobertura:</span>
                    <span className="text-teal-400 font-bold">
                      <CountUp end={coveragePercent} suffix="%" />
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${coveragePercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Meta: {realStats.voteGoal.toLocaleString('es-CO')} votos proyectados en {municipality}
                  </p>
                </div>
              </div>

              {/* Tarjeta 2: Operación Electoral */}
              <div className="gestion-territorial-kpi-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]">
                <h3 className="gestion-territorial-kpi-title text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2">
                  Operación Electoral
                </h3>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="space-y-1.5 text-xs">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Estado de Testigos</p>
                    <div>
                      <p className="text-[11px] text-slate-300">Testigos Registrados:</p>
                      <p className="text-base font-black text-white">
                        <CountUp end={realStats.witnesses} />
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-300">Faltantes ({totalMesasOficiales} mesas):</p>
                      <p className="text-sm font-bold text-rose-400">
                        <CountUp end={faltantesTestigos} />
                      </p>
                    </div>
                  </div>

                  {/* Anillo Radial de Capacitación */}
                  <div className="flex flex-col items-center justify-center p-1">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="3.5"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3.5"
                          strokeDasharray="100, 100"
                          strokeDashoffset={100 - witnessTrainingPercent}
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <span className="absolute font-extrabold text-xs text-white">
                        <CountUp end={witnessTrainingPercent} suffix="%" />
                      </span>
                    </div>
                    <span className="text-[10px] text-teal-300 mt-1 font-medium">Capacitación</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta 3: Investigación Electoral */}
              <div className="gestion-territorial-kpi-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity]">
                <h3 className="gestion-territorial-kpi-title text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2">
                  Investigación Electoral
                </h3>

                <div className="space-y-1.5 text-xs">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Progreso de Encuestas</p>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Encuestas Completadas:</span>
                    <span className="font-bold text-white">
                      <CountUp end={realStats.completedSurveys} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Encuestas en Proceso:</span>
                    <span className="font-bold text-amber-400">
                      <CountUp end={realStats.surveysInProcess} />
                    </span>
                  </div>
                </div>

                {/* Gráfico de Avance Semanal */}
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-1">Avance Semanal</p>
                  <div className="h-10 flex items-end justify-between gap-1 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
                    {[20, 35, 45, 60, 75, realStats.completedSurveys > 0 ? 100 : 25].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-teal-600 to-emerald-400 rounded-t transition-all duration-300"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón Primario: + Registro en Campo (Offline Ready) */}
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(true)}
                className="w-full bg-emerald-400 hover:bg-emerald-300 hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.96] text-slate-950 font-black px-4 py-3.5 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_24px_rgba(16,185,129,0.45)] flex items-center justify-between transition-all duration-200 cursor-pointer will-change-[transform,opacity] group"
                title="Capturar votante o líder en territorio con geolocalización GPS"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                  <span className="text-xs font-black tracking-wide">Registro en Campo (Offline Ready)</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {pendingOfflineCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-slate-950 text-emerald-300 text-[10px] font-mono font-bold rounded-full border border-emerald-400/50">
                      {pendingOfflineCount}
                    </span>
                  )}
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-40"></span>
                    <Radio className="w-3.5 h-3.5 text-slate-950 relative inline-flex" />
                  </span>
                </div>
              </button>

              {/* Indicador de Estado de Conectividad & Sincronización */}
              <div className="px-3 py-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300 font-semibold">Servidor Central Conectado</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-300 font-bold">Modo Offline Activo</span>
                    </>
                  )}
                </div>

                {pendingOfflineCount > 0 && (
                  <button
                    type="button"
                    onClick={syncOfflineQueue}
                    className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Sincronizar ({pendingOfflineCount})</span>
                  </button>
                )}
              </div>

            </motion.div>

            {/* ── MAPA CENTRAL LEAFLET GIS & COBERTURA ─────────────────────── */}
            <motion.div 
              variants={staggerItemVariants}
              className="gestion-territorial-map-card lg:col-span-8 bg-[#030d1d] rounded-3xl border border-cyan-500/20 p-4 shadow-xl relative flex flex-col justify-between min-h-[540px] overflow-hidden"
            >
              
              {/* Header del Mapa */}
              <div className="gestion-territorial-map-header flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2 z-10">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-teal-400" />
                  Mapa de Calor de Intención de Voto – Cobertura Territorial
                </h3>
                
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-teal-950/80 border border-teal-500/30 text-teal-300 font-bold text-[10px]">
                    📍 {municipality}, {department}
                  </span>
                  {realMapPoints.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">
                      {realMapPoints.length} Puntos GPS
                    </span>
                  )}
                </div>
              </div>

              {/* Contenedor del Mapa Leaflet */}
              <div className="gestion-territorial-map-box relative flex-1 my-3 min-h-[440px] rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                <MapContainer
                  center={defaultMunicipalCenter}
                  zoom={13}
                  zoomControl={false}
                  className="h-full min-h-[440px] w-full"
                  preferCanvas
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <CustomZoomControls />
                  <MapController center={defaultMunicipalCenter} points={realMapPoints} />

                  {/* Renderizado de Puntos GPS Registrados */}
                  {realMapPoints.map(point => {
                    const fillColor = 
                      point.intencion === 'Voto Seguro' ? '#10b981' :
                      point.intencion === 'Probable' || point.intencion === 'Simpatizante' ? '#06b6d4' :
                      point.intencion === 'Indeciso' ? '#f59e0b' : '#14b8a6';

                    return (
                      <CircleMarker
                        key={point.id}
                        center={[point.lat, point.lng]}
                        radius={9}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor,
                          fillOpacity: 0.75,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <div className="p-1 space-y-1 text-xs font-sans text-slate-900 min-w-[160px]">
                            <p className="font-extrabold text-sm text-slate-950">{point.nombre || 'Registro Territorial'}</p>
                            <p className="text-[11px] text-slate-600 font-semibold">{point.tipo.toUpperCase()} • {point.barrio || 'Zona Urbana'}</p>
                            {point.puesto && <p className="text-[10px] text-slate-500">Puesto: {point.puesto}</p>}
                            {point.intencion && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                {point.intencion}
                              </span>
                            )}
                            <p className="text-[9px] text-slate-400 font-mono mt-1">
                              GPS: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                            </p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>

                {/* Banner Flotante Inferior de Aviso cuando no hay GPS */}
                {realMapPoints.length === 0 && (
                  <div className="map-notice-banner absolute inset-x-4 sm:inset-x-8 bottom-4 z-[400] rounded-2xl bg-[#020712]/90 backdrop-blur-md border border-cyan-500/30 px-4 py-3 text-center text-xs text-slate-200 shadow-2xl pointer-events-none select-none">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      Aún no existen registros reales con coordenadas GPS para generar el mapa de calor.
                    </span>
                  </div>
                )}
              </div>

              {/* Barra Inferior del Sector Seleccionado */}
              {selectedZone && (
                <div className="gestion-territorial-selected-zone-bar bg-slate-900 text-white rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md z-10 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{selectedZone.nombre}</h4>
                      <p className="text-[11px] text-slate-400">
                        Líderes: <span className="text-teal-300 font-semibold">{selectedZone.lideres}</span> • Votantes: <span className="text-teal-300 font-semibold">{selectedZone.votantes.toLocaleString('es-CO')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-teal-950 text-teal-300 border border-teal-500/40 px-3 py-1 rounded-full font-bold">
                      Cobertura {selectedZone.cobertura}%
                    </span>
                  </div>
                </div>
              )}

            </motion.div>

          </div>

          {/* ── SECCIÓN INFERIOR: SECTORES TERRITORIALES Y METAS DE VOTOS ── */}
          <motion.div 
            variants={staggerItemVariants}
            className="gestion-territorial-sectors-card bg-[#0b1b36] border border-slate-800/90 text-white rounded-3xl p-5 md:p-6 shadow-xl space-y-5"
          >
            <div className="gestion-territorial-sectors-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <Target className="w-5 h-5 text-teal-400" />
                  Sectores Territoriales y Metas de Votos ({municipality})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supervisión de votos comprometidos por corregimientos, comunas y zonas del censo oficial
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Sector</span>
                </button>
              </div>
            </div>

            {/* Grid de Tarjetas de Sector */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSectorList.map((sector) => {
                const meta = sector.metaVotos ?? 0;
                const porcentajeMeta = meta > 0 ? Math.min(100, Math.round((sector.votantes / meta) * 100)) : 0;
                const isSelected = selectedZone?.id === sector.id;

                return (
                  <div
                    key={sector.id}
                    className={`gestion-territorial-sector-card bg-[#051325] border ${
                      isSelected ? 'border-teal-500/70 ring-1 ring-teal-500/30' : 'border-slate-800 hover:border-slate-700'
                    } rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all shadow-md group hover:-translate-y-0.5`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-500/30 px-2 py-0.5 rounded-md inline-block">
                          Sector / Zona
                        </span>
                        <h4 className="font-extrabold text-sm text-white leading-tight group-hover:text-teal-300 transition-colors">
                          {sector.nombre}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSector(sector);
                          setEditName(sector.nombre);
                          setEditMetaVotos(sector.metaVotos || Math.round(sector.votantes * 1.25));
                          setEditLideres(sector.lideres);
                          setEditVotantes(sector.votantes);
                        }}
                        className="p-1.5 text-slate-400 hover:text-teal-300 rounded-lg transition-colors cursor-pointer"
                        title="Editar Sector"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Barra de Progreso de Meta */}
                    <div className="bg-[#081b33] border border-slate-800/80 p-3 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-amber-400" /> Meta de Votos:
                        </span>
                        <strong className="text-amber-300 font-black text-xs">
                          {meta.toLocaleString('es-CO')}
                        </strong>
                      </div>

                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            porcentajeMeta >= 80
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                              : porcentajeMeta >= 50
                              ? 'bg-gradient-to-r from-amber-500 to-teal-400'
                              : 'bg-gradient-to-r from-rose-500 to-amber-400'
                          }`}
                          style={{ width: `${porcentajeMeta}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>Votantes: <strong className="text-white">{sector.votantes.toLocaleString('es-CO')}</strong></span>
                        <span className="font-extrabold text-teal-400">{porcentajeMeta}% de la meta</span>
                      </div>
                    </div>

                    {/* Métricas Secundarias */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#08192e] p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                        <Users className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400">Líderes</p>
                          <p className="font-bold text-white">{sector.lideres}</p>
                        </div>
                      </div>

                      <div className="bg-[#08192e] p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400">Cobertura</p>
                          <p className="font-bold text-emerald-300">{sector.cobertura}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Botón para enfocar en mapa */}
                    <button
                      type="button"
                      onClick={() => setSelectedZone(sector)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-[#081d38] hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {isSelected ? '✓ Seleccionado en Mapa' : 'Ver en Mapa de Calor'}
                    </button>
                  </div>
                );
              })}

              {filteredSectorList.length === 0 && (
                <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-700 bg-[#051325] p-8 text-center text-sm text-slate-400">
                  Aún no existen sectores registrados con datos. Se añadirán automáticamente conforme se registren líderes y votantes en {municipality}.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── MODAL: + REGISTRO EN CAMPO (OFFLINE READY) ───────────────────── */}
      <AnimatePresence>
        {isFieldModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#030d1d] border border-cyan-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl text-white my-auto"
            >
              {/* Header del Modal */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-base">Registro Rápido en Campo (Offline Ready)</h4>
                    <p className="text-[11px] text-slate-400">Captura territorial con geolocalización GPS automática</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Indicador de Conectividad de Red */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                isOnline 
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  <span>{isOnline ? 'Conexión Activa: Sincronización en Tiempo Real' : 'Modo Offline: Se Guardará en Memoria Local'}</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {municipality}
                </span>
              </div>

              {/* Botón de Detección GPS */}
              <div className="bg-[#020712] p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-cyan-400" /> Coordenadas GPS del Dispositivo:
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureDeviceGps}
                    disabled={isLocatingGps}
                    className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-[11px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGps ? 'Localizando...' : '📍 Fijar Mi GPS'}</span>
                  </button>
                </div>

                {gpsStatusMsg ? (
                  <p className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 p-2 rounded-lg border border-cyan-500/30">
                    {gpsStatusMsg}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    Haga clic en "Fijar Mi GPS" para capturar la posición satelital exacta del dispositivo en campo.
                  </p>
                )}
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmitFieldRegistration} className="space-y-3">
                {/* Selector Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFieldTipo('votante')}
                    className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                      fieldTipo === 'votante'
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    👤 Votante Territorial
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldTipo('lider')}
                    className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                      fieldTipo === 'lider'
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    👥 Líder Territorial
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Cédula de Ciudadanía *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={fieldCedula}
                      onChange={(e) => setFieldCedula(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej: 1017123456"
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={fieldNombre}
                      onChange={(e) => setFieldNombre(e.target.value)}
                      placeholder="Nombre y Apellidos"
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="tel"
                      value={fieldTelefono}
                      onChange={(e) => setFieldTelefono(e.target.value)}
                      placeholder="Ej: 3001234567"
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Barrio / Corregimiento</label>
                    <input
                      type="text"
                      value={fieldBarrio}
                      onChange={(e) => setFieldBarrio(e.target.value)}
                      placeholder="Ej: Centro / San Roque"
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-bold mb-1">Puesto de Votación</label>
                    <select
                      value={fieldPuesto}
                      onChange={(e) => setFieldPuesto(e.target.value)}
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-teal-400 cursor-pointer"
                    >
                      <option value="">Seleccione Puesto Oficial...</option>
                      {officialPuestos.map(p => (
                        <option key={p.id} value={p.nombre}>
                          {p.nombre} ({p.comuna})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Mesa</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={fieldMesa}
                      onChange={(e) => setFieldMesa(e.target.value)}
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                {fieldTipo === 'votante' && (
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Intención de Voto</label>
                    <select
                      value={fieldIntencion}
                      onChange={(e) => setFieldIntencion(e.target.value)}
                      className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-teal-400 cursor-pointer font-bold"
                    >
                      <option value="Voto Seguro">💚 Voto Seguro</option>
                      <option value="Probable">💙 Probable / Simpatizante</option>
                      <option value="Indeciso">💛 Indeciso</option>
                      <option value="En Contra">❤️ En Contra</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Observaciones de Campo</label>
                  <input
                    type="text"
                    value={fieldNotas}
                    onChange={(e) => setFieldNotas(e.target.value)}
                    placeholder="Notas relevantes del contacto en territorio..."
                    className="w-full bg-[#020712] border border-slate-750 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400"
                  />
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFieldModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingField}
                    className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmittingField ? 'Guardando...' : 'Confirmar Registro'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: EDITAR SECTOR TERRITORIAL ─────────────────────────────── */}
      <AnimatePresence>
        {editingSector && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#05162a] border border-teal-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 text-xs shadow-2xl text-white"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-300">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm">Editar Sector Territorial</h4>
                    <p className="text-[11px] text-slate-400">Modifique el nombre o ajuste la meta de votos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSector(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nombre del Sector / Zona:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ej: Zona Norte / Santa Ana"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Meta de Votos Objetivo:</span>
                    <span className="text-[11px] text-teal-400 font-semibold">
                      {typeof editMetaVotos === 'number' ? editMetaVotos.toLocaleString('es-CO') : editMetaVotos} votos
                    </span>
                  </label>
                  <input
                    type="number"
                    value={editMetaVotos}
                    onChange={(e) => setEditMetaVotos(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Líderes Asignados:</label>
                    <input
                      type="number"
                      value={editLideres}
                      onChange={(e) => setEditLideres(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Votantes Registrados:</label>
                    <input
                      type="number"
                      value={editVotantes}
                      onChange={(e) => setEditVotantes(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteSector(editingSector.id)}
                  className="py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Eliminar Sector"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSector(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSector}
                    className="py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CREAR SECTOR TERRITORIAL ──────────────────────────────── */}
      <AnimatePresence>
        {showAddSectorModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#05162a] border border-teal-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 text-xs shadow-2xl text-white"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-300">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm">Crear Nuevo Sector Territorial</h4>
                    <p className="text-[11px] text-slate-400">Registre un nuevo sector para supervisar su meta en {municipality}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nombre del Sector:</label>
                  <input
                    type="text"
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    placeholder="Ej: Corregimiento El Cedro / Sector La Cruz"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Meta de Votos Objetivo:</label>
                  <input
                    type="number"
                    value={newSectorMetaVotos}
                    onChange={(e) => setNewSectorMetaVotos(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 5000"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddSectorSubmit}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  Crear Sector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
