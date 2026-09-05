import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  PieChart, 
  BarChart3, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  Eye, 
  Download, 
  Calculator, 
  Sliders, 
  Sparkles, 
  Send, 
  PhoneCall, 
  Globe, 
  UserCheck,
  Percent,
  Layers,
  ChevronRight,
  Share2,
  Battery,
  Wifi,
  Compass,
  Crosshair,
  QrCode,
  Printer,
  Bot,
  X,
  Zap,
  AlertTriangle,
  Activity,
  UserPlus,
  Mail,
  CreditCard,
  Smartphone,
  Check,
  RefreshCw
} from 'lucide-react';
import { ViewMode } from '../../types';
import type { AuthUser } from '../../types';
import { supabase } from '../../lib/supabaseClient';

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'likert' | 'candidate_matrix' | 'open' | 'demographic';
  options?: string[];
  required: boolean;
}

export interface SurveyStudy {
  id: string;
  code: string;
  title: string;
  type: 'Línea Base' | 'Intención de Voto' | 'Tracking Poll' | 'Sondeo Flash' | 'Favorabilidad' | 'Clima Político';
  methodology: 'Presencial (CAPI)' | 'Telefónico (CATI)' | 'Digital / WhatsApp' | 'Mixto';
  status: 'En Campo' | 'Borrador' | 'Finalizado' | 'En Auditoría';
  targetSample: number;
  completedSample: number;
  marginOfError: number;
  confidenceLevel: number; // e.g. 95%
  startDate: string;
  endDate: string;
  pollstersCount: number;
  location: string;
  questionsCount: number;
}

export interface Pollster {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  email: string;
  surveyId: string;
  surveyTitle: string;
  assignedZone: string;
  dailyGoal: number;
  completedCount: number;
  status: 'Activo' | 'En Recorrido' | 'Meta Cumplida' | 'Pausado' | 'Inactivo';
  lastActivity: string;
  batteryLevel: number;
  gpsCoordinates: {
    lat: number;
    lng: number;
    address: string;
    inGeofence: boolean;
    accuracyMeters: number;
  };
  deviceImei: string;
  accreditationCode: string;
  aiAuditFlags?: {
    suspiciousSpeed?: boolean;
    outOfGeofence?: boolean;
    duplicatePattern?: boolean;
    notes?: string;
  };
}

// Leaflet Map Helpers & Data
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    name: 'Oscuro CARTO',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    name: 'Urbano (OSM)',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    name: 'Satélite HD',
  },
};

const createPollsterDivIcon = (pollster: Pollster, isSelected: boolean) => {
  const isOutOfZone = !pollster.gpsCoordinates.inGeofence;
  const isCompleted = pollster.status === 'Meta Cumplida';

  const bgColor = isOutOfZone ? '#f59e0b' : isCompleted ? '#10b981' : '#06b6d4';
  const textColor = '#030712';
  const borderStyle = isSelected ? '3px solid #ffffff' : '2px solid #000000';
  const glow = isSelected ? '0 0 16px rgba(6, 182, 212, 0.9)' : '0 4px 10px rgba(0,0,0,0.5)';

  const html = `
    <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: ${bgColor};
        color: ${textColor};
        border: ${borderStyle};
        box-shadow: ${glow};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 13px;
        transition: transform 0.2s ease;
      ">
        ${pollster.name[0]}
      </div>
      <div style="
        margin-top: 3px;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 6px;
        background-color: #05162a;
        color: #e2e8f0;
        border: 1px solid rgba(6,182,212,0.4);
        box-shadow: 0 4px 10px rgba(0,0,0,0.6);
      ">
        ${pollster.name.split(' ')[0]} (${pollster.completedCount}/${pollster.dailyGoal})
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'leaflet-pollster-marker',
    iconSize: [80, 55],
    iconAnchor: [40, 20],
  });
};

interface GestionEncuestasSondeosProps {
  onSelectView?: (view: ViewMode) => void;
  authUser?: AuthUser | null;
}

export const GestionEncuestasSondeos: React.FC<GestionEncuestasSondeosProps> = ({ authUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'estudios' | 'crear' | 'calculadora' | 'encuestadores' | 'georreferenciacion' | 'resultados'>('estudios');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [surveyFilter, setSurveyFilter] = useState<string>('todas');
  const [selectedStudy, setSelectedStudy] = useState<SurveyStudy | null>(null);
  const [tileStyle, setTileStyle] = useState<'dark' | 'street' | 'satellite'>('street');
  
  // Modals
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAddPollsterModal, setShowAddPollsterModal] = useState(false);
  const [showEditPollsterModal, setShowEditPollsterModal] = useState(false);
  const [showAccreditationModal, setShowAccreditationModal] = useState(false);
  const [selectedPollster, setSelectedPollster] = useState<Pollster | null>(null);

  // AI Generator States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiObjective, setAiObjective] = useState('');
  const [aiAuditRunning, setAiAuditRunning] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<string | null>(null);

  // Historical design samples are intentionally not rendered. Real records
  // are loaded from Supabase for the active campaign below.
  const _legacyStudySamples: SurveyStudy[] = [
    {
      id: 'enc-1',
      code: 'ENC-2026-001',
      title: 'Primer Tracking Semanal de Intención de Voto Alcaldía',
      type: 'Tracking Poll',
      methodology: 'Presencial (CAPI)',
      status: 'En Campo',
      targetSample: 1200,
      completedSample: 840,
      marginOfError: 2.8,
      confidenceLevel: 95,
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      pollstersCount: 18,
      location: 'Municipio Principal - 12 Comunas',
      questionsCount: 14
    },
    {
      id: 'enc-2',
      code: 'SND-2026-004',
      title: 'Sondeo Digital de Percepción sobre Propuestas de Movilidad',
      type: 'Sondeo Flash',
      methodology: 'Digital / WhatsApp',
      status: 'En Campo',
      targetSample: 2500,
      completedSample: 2150,
      marginOfError: 2.1,
      confidenceLevel: 95,
      startDate: '2026-08-04',
      endDate: '2026-08-08',
      pollstersCount: 4,
      location: 'Zonas Urbana y Metropolitana',
      questionsCount: 8
    },
    {
      id: 'enc-3',
      code: 'ENC-2026-002',
      title: 'Estudio de Línea Base Percepción de Imagen y Candidatos',
      type: 'Línea Base',
      methodology: 'Mixto',
      status: 'Finalizado',
      targetSample: 1800,
      completedSample: 1800,
      marginOfError: 2.3,
      confidenceLevel: 95,
      startDate: '2026-07-10',
      endDate: '2026-07-25',
      pollstersCount: 24,
      location: 'Departamento - 8 Subregiones',
      questionsCount: 22
    },
    {
      id: 'enc-4',
      code: 'ENC-2026-003',
      title: 'Evaluación de Impacto del Debate de Televisión Regional',
      type: 'Favorabilidad',
      methodology: 'Telefónico (CATI)',
      status: 'En Auditoría',
      targetSample: 600,
      completedSample: 600,
      marginOfError: 4.0,
      confidenceLevel: 95,
      startDate: '2026-08-05',
      endDate: '2026-08-06',
      pollstersCount: 10,
      location: 'Casco Urbano',
      questionsCount: 10
    }
  ];
  const [studies, setStudies] = useState<SurveyStudy[]>([]);

  // Pollsters State
  const _legacyPollsterSamples: Pollster[] = [
    {
      id: 'pol-101',
      name: 'Carlos Mario Mendoza',
      cedula: '1032448912',
      phone: '+57 312 458 9012',
      email: 'carlos.mendoza@campanaganadora.co',
      surveyId: 'enc-1',
      surveyTitle: 'Primer Tracking Semanal de Intención de Voto Alcaldía',
      assignedZone: 'Comuna 1 - Centro Histórico',
      dailyGoal: 40,
      completedCount: 38,
      status: 'Activo',
      lastActivity: 'Hace 3 min',
      batteryLevel: 88,
      gpsCoordinates: {
        lat: 6.2442,
        lng: -75.5812,
        address: 'Calle 50 # 45-12, Parque Berrio',
        inGeofence: true,
        accuracyMeters: 4.2
      },
      deviceImei: '864201049281023',
      accreditationCode: 'CNE-ENC-2026-0891'
    },
    {
      id: 'pol-102',
      name: 'Laura Restrepo Gómez',
      cedula: '1017234901',
      phone: '+57 300 892 1104',
      email: 'laura.restrepo@campanaganadora.co',
      surveyId: 'enc-1',
      surveyTitle: 'Primer Tracking Semanal de Intención de Voto Alcaldía',
      assignedZone: 'Comuna 3 - Manrique / Norte',
      dailyGoal: 40,
      completedCount: 40,
      status: 'Meta Cumplida',
      lastActivity: 'Hace 12 min',
      batteryLevel: 95,
      gpsCoordinates: {
        lat: 6.2621,
        lng: -75.5681,
        address: 'Carrera 45 # 72-18, Manrique Central',
        inGeofence: true,
        accuracyMeters: 3.8
      },
      deviceImei: '864201049281904',
      accreditationCode: 'CNE-ENC-2026-0892'
    },
    {
      id: 'pol-103',
      name: 'Andrés Felipe Silva',
      cedula: '1020412890',
      phone: '+57 314 670 4421',
      email: 'andres.silva@campanaganadora.co',
      surveyId: 'enc-1',
      surveyTitle: 'Primer Tracking Semanal de Intención de Voto Alcaldía',
      assignedZone: 'Comuna 5 - Castilla / Sur',
      dailyGoal: 40,
      completedCount: 29,
      status: 'En Recorrido',
      lastActivity: 'Hace 1 min',
      batteryLevel: 62,
      gpsCoordinates: {
        lat: 6.2189,
        lng: -75.5742,
        address: 'Carrera 68 # 94-05, Castilla Sector Terminal',
        inGeofence: false, // Out of zone alert!
        accuracyMeters: 12.5
      },
      deviceImei: '864201049281881',
      accreditationCode: 'CNE-ENC-2026-0893',
      aiAuditFlags: {
        outOfGeofence: true,
        notes: 'Ubicación reportada a 850m fuera de la geocerca de Comuna 5'
      }
    },
    {
      id: 'pol-104',
      name: 'Camila Rodríguez Toro',
      cedula: '1036782199',
      phone: '+57 318 901 3342',
      email: 'camila.rodriguez@campanaganadora.co',
      surveyId: 'enc-2',
      surveyTitle: 'Sondeo Digital de Percepción sobre Propuestas de Movilidad',
      assignedZone: 'Comuna 13 - San Javier / Occidente',
      dailyGoal: 50,
      completedCount: 44,
      status: 'En Recorrido',
      lastActivity: 'Hace 5 min',
      batteryLevel: 74,
      gpsCoordinates: {
        lat: 6.2511,
        lng: -75.6012,
        address: 'Calle 44 # 108-20, Estación San Javier',
        inGeofence: true,
        accuracyMeters: 5.0
      },
      deviceImei: '864201049281774',
      accreditationCode: 'CNE-ENC-2026-0894'
    },
    {
      id: 'pol-105',
      name: 'Jhon Jairo Arango',
      cedula: '98712344',
      phone: '+57 301 234 5599',
      email: 'jhon.arango@campanaganadora.co',
      surveyId: 'enc-1',
      surveyTitle: 'Primer Tracking Semanal de Intención de Voto Alcaldía',
      assignedZone: 'Comuna 4 - Aranjuez',
      dailyGoal: 40,
      completedCount: 35,
      status: 'Activo',
      lastActivity: 'Hace 8 min',
      batteryLevel: 41,
      gpsCoordinates: {
        lat: 6.2733,
        lng: -75.5521,
        address: 'Carrera 52 # 92-10, Aranjuez Parque',
        inGeofence: true,
        accuracyMeters: 4.8
      },
      deviceImei: '864201049281655',
      accreditationCode: 'CNE-ENC-2026-0895'
    },
    {
      id: 'pol-106',
      name: 'Valentina Morales Duque',
      cedula: '1045998210',
      phone: '+57 320 881 9023',
      email: 'valentina.morales@campanaganadora.co',
      surveyId: 'enc-2',
      surveyTitle: 'Sondeo Digital de Percepción sobre Propuestas de Movilidad',
      assignedZone: 'Corregimiento San Cristóbal',
      dailyGoal: 35,
      completedCount: 32,
      status: 'En Recorrido',
      lastActivity: 'Hace 2 min',
      batteryLevel: 91,
      gpsCoordinates: {
        lat: 6.2801,
        lng: -75.6311,
        address: 'Parque Principal San Cristóbal',
        inGeofence: true,
        accuracyMeters: 3.5
      },
      deviceImei: '864201049281112',
      accreditationCode: 'CNE-ENC-2026-0896'
    }
  ];
  const [pollsters, setPollsters] = useState<Pollster[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);

  // New Pollster Form State
  const [newPolName, setNewPolName] = useState('');
  const [newPolCedula, setNewPolCedula] = useState('');
  const [newPolPhone, setNewPolPhone] = useState('');
  const [newPolEmail, setNewPolEmail] = useState('');
  const [newPolSurveyId, setNewPolSurveyId] = useState(studies[0]?.id || 'enc-1');
  const [newPolZone, setNewPolZone] = useState('Comuna 1 - Centro Histórico');
  const [newPolGoal, setNewPolGoal] = useState(40);
  const [newPolDevice, setNewPolDevice] = useState('');

  // Calculator State
  const [calcUniverse, setCalcUniverse] = useState<number | ''>('');
  const [calcConfidence, setCalcConfidence] = useState<number | ''>('');
  const [calcMargin, setCalcMargin] = useState<number | ''>('');

  const calculateSampleSize = () => {
    if (!calcUniverse || !calcConfidence || !calcMargin) return null;
    const Z = calcConfidence === 99 ? 2.576 : calcConfidence === 90 ? 1.645 : 1.96;
    const p = 0.5;
    const q = 1 - p;
    const e = calcMargin / 100;
    const N = calcUniverse;

    const n0 = (Z * Z * p * q) / (e * e);
    const n = n0 / (1 + (n0 - 1) / N);
    return Math.round(n);
  };

  const calculatedSample = calculateSampleSize();

  // New Survey Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<SurveyStudy['type'] | ''>('');
  const [newMethodology, setNewMethodology] = useState<SurveyStudy['methodology'] | ''>('');
  const [newTargetSample, setNewTargetSample] = useState<number | ''>('');
  const [newLocation, setNewLocation] = useState('');
  const [newQuestions, setNewQuestions] = useState<SurveyQuestion[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Selected Pollster for Live Map Tracking
  const [activeGpsPollster, setActiveGpsPollster] = useState<Pollster | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [realDataLoading, setRealDataLoading] = useState(true);
  const [realDataError, setRealDataError] = useState('');
  const [savingRealData, setSavingRealData] = useState(false);

  const mapStudyRow = (row: any): SurveyStudy => ({
    id: String(row.id),
    code: row.code || row.id?.slice(0, 8).toUpperCase(),
    title: row.titulo || row.title || 'Sin título',
    type: row.study_type || row.descripcion?.split(' | ')[0] || '',
    methodology: row.methodology || row.descripcion?.split(' | ')[1] || '',
    status: row.estado || row.status || 'BORRADOR',
    targetSample: Number(row.muestra_objetivo || row.target_sample || 0),
    completedSample: Number(row.completed_sample || 0),
    marginOfError: Number(row.margin_error || 0),
    confidenceLevel: Number(row.confidence_level || 95),
    startDate: row.fecha_inicio || row.start_date,
    endDate: row.fecha_fin || row.end_date,
    pollstersCount: Number(row.pollsters_count || 0),
    location: row.descripcion?.split(' | ')[2] || row.location || '',
    questionsCount: Array.isArray(row.preguntas || row.questions) ? (row.preguntas || row.questions).length : 0
  });

  const mapPollsterRow = (row: any, studyById: Map<string, SurveyStudy>): Pollster => ({
    id: String(row.id),
    name: row.name,
    cedula: row.cedula,
    phone: row.phone || '',
    email: row.email || '',
    surveyId: String(row.survey_id),
    surveyTitle: studyById.get(String(row.survey_id))?.title || 'Encuesta asignada',
    assignedZone: row.assigned_zone || '',
    dailyGoal: Number(row.daily_goal || 0),
    completedCount: Number(row.completed_count || 0),
    status: row.status,
    lastActivity: row.last_activity_at ? new Date(row.last_activity_at).toLocaleString('es-CO') : 'Sin actividad',
    batteryLevel: Number(row.battery_level || 0),
    gpsCoordinates: {
      lat: Number(row.latitude || 0),
      lng: Number(row.longitude || 0),
      address: row.last_address || 'Ubicación aún no reportada',
      inGeofence: Boolean(row.in_geofence),
      accuracyMeters: Number(row.gps_accuracy_meters || 0)
    },
    deviceImei: row.device_imei || '',
    accreditationCode: row.accreditation_code || '',
    aiAuditFlags: row.audit_flags || undefined
  });

  const resolveActiveCampaignId = async () => {
    const rememberedCampaignId = localStorage.getItem('active_campaign_id');
    if (rememberedCampaignId) return rememberedCampaignId;
    if (!authUser?.clientId) return null;
    const { data, error } = await supabase
      .from('campaigns')
      .select('id')
      .eq('client_id', authUser.clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  };

  const loadRealSurveyData = async () => {
    setRealDataLoading(true);
    setRealDataError('');
    try {
      const campaignId = await resolveActiveCampaignId();
      setActiveCampaignId(campaignId);
      if (!campaignId) {
        setStudies([]);
        setPollsters([]);
        setSurveyResponses([]);
        return;
      }

      const [
        { data: studyRows, error: studiesError },
        { data: pollsterRows, error: pollstersError },
        { data: responseRows, error: responsesError },
      ] = await Promise.all([
        supabase.from('surveys').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        supabase.from('survey_pollsters').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        supabase.from('survey_responses').select('id,survey_id,answers,consent_confirmed,latitude,longitude,gps_accuracy_meters,duration_seconds,submitted_at').eq('campaign_id', campaignId).order('submitted_at', { ascending: false }),
      ]);
      if (studiesError) throw studiesError;
      if (pollstersError) throw pollstersError;
      if (responsesError) throw responsesError;

      const realStudies = (studyRows || []).map(mapStudyRow);
      const studyById = new Map(realStudies.map(study => [study.id, study]));
      const realPollsters = (pollsterRows || []).map(row => mapPollsterRow(row, studyById));
      setStudies(realStudies);
      setPollsters(realPollsters);
      setSurveyResponses(responseRows || []);
      setActiveGpsPollster(realPollsters.find(pollster =>
        pollster.gpsCoordinates.lat !== 0 && pollster.gpsCoordinates.lng !== 0
      ) || null);
      if (realStudies[0] && !realStudies.some(study => study.id === newPolSurveyId)) {
        setNewPolSurveyId(realStudies[0].id);
      }
    } catch (error: any) {
      setStudies([]);
      setPollsters([]);
      setSurveyResponses([]);
      setRealDataError(error?.message || 'No fue posible sincronizar las encuestas reales.');
    } finally {
      setRealDataLoading(false);
    }
  };

  useEffect(() => {
    void loadRealSurveyData();
  }, [authUser?.clientId]);

  // Handlers
  const openPollsterRegistration = () => {
    setRealDataError('');
    if (studies[0] && !studies.some(study => study.id === newPolSurveyId)) {
      setNewPolSurveyId(studies[0].id);
    }
    setShowAddPollsterModal(true);
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    setNewQuestions([
      ...newQuestions,
      {
        id: `q${Date.now()}`,
        text: newQuestionText,
        type: 'multiple_choice',
        options: ['Opción A', 'Opción B', 'Opción C', 'No Sabe / No Responde'],
        required: true
      }
    ]);
    setNewQuestionText('');
  };

  const handleGenerateQuestionsWithAI = () => {
    setAiGenerating(true);
    setTimeout(() => {
      const generated: SurveyQuestion[] = [
        {
          id: `ai-1-${Date.now()}`,
          text: 'En una escala de 1 a 5, ¿cómo evalúa la gestión actual del municipio en materia de seguridad ciudadana?',
          type: 'likert',
          options: ['1 - Pésima', '2 - Mala', '3 - Regular', '4 - Buena', '5 - Excelente', 'No Sabe'],
          required: true
        },
        {
          id: `ai-2-${Date.now()}`,
          text: '¿Cuál considera usted que es el principal problema que debe resolver el próximo Alcalde?',
          type: 'multiple_choice',
          options: ['Inseguridad y Atracos', 'Desempleo y Pobreza', 'Movilidad y Malla Vial', 'Corrupción Política', 'Salud y Salud Mental'],
          required: true
        },
        {
          id: `ai-3-${Date.now()}`,
          text: 'Si las elecciones fueran hoy, ¿por cuál candidato a la Alcaldía votaría?',
          type: 'candidate_matrix',
          options: ['Nuestro Candidato (Campaña Ganadora)', 'Candidato Oposición A', 'Candidato Oposición B', 'Voto en Blanco', 'Indeciso'],
          required: true
        },
        {
          id: `ai-4-${Date.now()}`,
          text: '¿Qué opinión o percepción de imagen tiene sobre Nuestro Candidato?',
          type: 'multiple_choice',
          options: ['Muy Favorable', 'Favorable', 'Desfavorable', 'Muy Desfavorable', 'No lo Conoce'],
          required: true
        }
      ];
      setNewQuestions([...newQuestions, ...generated]);
      setAiGenerating(false);
    }, 1200);
  };

  const handleAddPollsterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolName.trim() || !newPolCedula.trim() || !newPolPhone.trim() || !newPolEmail.trim()) {
      setRealDataError('Nombre, cédula, teléfono y correo electrónico son obligatorios.');
      return;
    }
    if (!activeCampaignId || !newPolSurveyId) {
      setRealDataError('Primero debe existir una campaña y una encuesta real para asignar encuestadores.');
      return;
    }
    const assignedSurvey = studies.find(s => s.id === newPolSurveyId);
    if (!assignedSurvey) return setRealDataError('La encuesta seleccionada ya no está disponible.');
    setSavingRealData(true);
    setRealDataError('');
    const accreditationCode = `ENC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from('survey_pollsters').insert({
      campaign_id: activeCampaignId,
      survey_id: newPolSurveyId,
      name: newPolName.trim(),
      cedula: newPolCedula.trim(),
      phone: newPolPhone.trim() || null,
      email: newPolEmail.trim() || null,
      assigned_zone: newPolZone,
      daily_goal: newPolGoal,
      completed_count: 0,
      status: 'Activo',
      device_imei: newPolDevice.trim() || null,
      accreditation_code: accreditationCode,
      created_by: authUser?.id || null
    });
    setSavingRealData(false);
    if (error) return setRealDataError(error.message);
    setShowAddPollsterModal(false);
    setNewPolName('');
    setNewPolCedula('');
    setNewPolPhone('');
    setNewPolEmail('');
    await loadRealSurveyData();
    alert(`Encuestador registrado en la base real. Acreditación: ${accreditationCode}`);
  };

  const handleDeletePollster = async (id: string, name: string) => {
    if (confirm(`¿Está seguro de eliminar al encuestador ${name}? Se desvinculará del dispositivo y de la ruta de campo.`)) {
      const { error } = await supabase.from('survey_pollsters').delete().eq('id', id).eq('campaign_id', activeCampaignId);
      if (error) return setRealDataError(error.message);
      await loadRealSurveyData();
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newType || !newMethodology || !newTargetSample || !newLocation.trim()) {
      setRealDataError('Completa los datos obligatorios de la encuesta antes de guardarla.');
      return;
    }
    if (!calcConfidence || !calcMargin) {
      setRealDataError('Define el nivel de confianza y el margen de error en la Calculadora Muestral.');
      return;
    }
    if (!activeCampaignId) return setRealDataError('Debe crear o seleccionar una campaña antes de registrar encuestas.');
    setSavingRealData(true);
    setRealDataError('');
    const year = new Date().getFullYear();
    const code = `ENC-${year}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { error } = await supabase.from('surveys').insert({
      campaign_id: activeCampaignId,
      titulo: newTitle.trim(),
      descripcion: [newType, newMethodology, newLocation.trim()].filter(Boolean).join(' | ') || null,
      estado: 'BORRADOR',
      muestra_objetivo: Number(newTargetSample) || 200,
      preguntas: newQuestions,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    });
    setSavingRealData(false);
    if (error) return setRealDataError(error.message);
    setNewTitle('');
    setNewType('');
    setNewMethodology('');
    setNewTargetSample('');
    setNewLocation('');
    setNewQuestions([]);
    setActiveSubTab('estudios');
    await loadRealSurveyData();
    alert(`Encuesta ${code} guardada en la base de datos real.`);
  };

  const handleDeleteSurvey = async (id: string, code: string) => {
    if (confirm(`¿Está seguro de eliminar la encuesta ${code}? Esta acción eliminará todas las respuestas y no se puede deshacer.`)) {
      setSavingRealData(true);
      const { error } = await supabase.from('surveys').delete().eq('id', id).eq('campaign_id', activeCampaignId);
      setSavingRealData(false);
      if (error) return setRealDataError(error.message);
      await loadRealSurveyData();
    }
  };

  const handleRunAiAudit = () => {
    if (surveyResponses.length === 0) {
      setAiAuditResult('No existen respuestas reales para auditar.');
      return;
    }
    setAiAuditRunning(true);
    const withConsent = surveyResponses.filter(response => response.consent_confirmed).length;
    const withGps = surveyResponses.filter(response => Number(response.latitude) !== 0 && Number(response.longitude) !== 0).length;
    setAiAuditResult(`Auditoría basada en registros reales:\n- Respuestas revisadas: ${surveyResponses.length}.\n- Consentimientos registrados: ${withConsent}.\n- Respuestas con evidencia GPS: ${withGps}.`);
    setAiAuditRunning(false);
  };

  // Filters
  const filteredStudies = studies.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase()) || s.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || s.status.toLowerCase().replace(' ', '_') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPollsters = pollsters.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cedula.includes(searchTerm) || p.assignedZone.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSurvey = surveyFilter === 'todas' || p.surveyId === surveyFilter;
    return matchesSearch && matchesSurvey;
  });
  const visibleGpsPollsters = filteredPollsters.filter(pollster =>
    pollster.gpsCoordinates.lat !== 0 && pollster.gpsCoordinates.lng !== 0
  );
  const hasGpsReports = visibleGpsPollsters.length > 0;
  const mapCenter: [number, number] = activeGpsPollster
    ? [activeGpsPollster.gpsCoordinates.lat, activeGpsPollster.gpsCoordinates.lng]
    : [4.5709, -74.2973];

  const studiesInField = studies.filter(study => study.status === 'En Campo').length;
  const pollstersWithGps = pollsters.filter(pollster => pollster.gpsCoordinates.lat !== 0 && pollster.gpsCoordinates.lng !== 0);
  const pollstersInsideGeofence = pollstersWithGps.filter(pollster => pollster.gpsCoordinates.inGeofence).length;
  const averageMargin = studies.length
    ? studies.reduce((sum, study) => sum + study.marginOfError, 0) / studies.length
    : 0;
  const filteredResponses = surveyResponses.filter(response =>
    surveyFilter === 'todas' || String(response.survey_id) === surveyFilter
  );
  const consentedResponses = filteredResponses.filter(response => response.consent_confirmed).length;
  const geolocatedResponses = filteredResponses.filter(response =>
    Number(response.latitude) !== 0 && Number(response.longitude) !== 0
  ).length;
  const averageResponseSeconds = filteredResponses.length
    ? Math.round(filteredResponses.reduce((sum, response) => sum + Number(response.duration_seconds || 0), 0) / filteredResponses.length)
    : 0;

  return (
    <div className="space-y-6">
      {realDataLoading && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando encuestas reales…
        </div>
      )}
      {realDataError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-3">
          <span>{realDataError}</span>
          <button type="button" onClick={() => void loadRealSurveyData()} className="font-bold text-cyan-300 hover:text-cyan-200">Reintentar</button>
        </div>
      )}
      
      {/* Module Title Header */}
      <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-6 text-slate-100 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 rounded-xl text-cyan-300">
                <PieChart className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Gestión y Configuración de Encuestas y Sondeos
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openPollsterRegistration}
              disabled={savingRealData}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer transform hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Registrar Encuestador</span>
            </button>

            <button
              onClick={() => setActiveSubTab('crear')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0a2342] hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Nueva Encuesta</span>
            </button>

            <button
              onClick={() => void loadRealSurveyData()}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0a2342] hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${realDataLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>

            <button
              onClick={() => setActiveSubTab('georreferenciacion')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0a2342] hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span>Mapa GPS en Vivo</span>
            </button>
          </div>
        </div>

        {/* Global Statistics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-5 border-t border-cyan-500/20">
          <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Estudios Activos</span>
            <div className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <span>{studies.length}</span>
              <span className="text-[10px] text-emerald-400 font-normal bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{studiesInField} en campo</span>
            </div>
          </div>
          
          <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Encuestadores Registrados</span>
            <div className="text-xl font-black text-cyan-300 mt-1 flex items-center gap-2">
              <span>{pollsters.length}</span>
              <span className="text-[10px] text-emerald-400 font-normal">100% CNE</span>
            </div>
          </div>

          <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Monitoreo GPS en Vivo</span>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-2">
              <span>{pollstersInsideGeofence} / {pollstersWithGps.length}</span>
              <span className="text-[10px] text-emerald-400 font-normal">En Perímetro</span>
            </div>
          </div>

          <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Margen Error Prom.</span>
            <div className="text-xl font-black text-amber-300 mt-1 flex items-center gap-2">
              <span>{studies.length ? `± ${averageMargin.toFixed(1)}%` : '—'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Conf. 95%</span>
            </div>
          </div>

          <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-3">
            <span className="text-[10px] text-cyan-300/80 font-bold uppercase tracking-wider block">Auditoría IA Muestral</span>
            <div className="text-xl font-black text-emerald-300 mt-1 flex items-center gap-2">
              <span>—</span>
              <span className="text-[10px] text-slate-400 font-normal">Sin auditoría real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('estudios')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'estudios'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Panel de Estudios y Sondeos ({studies.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('encuestadores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'encuestadores'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Gestión de Encuestadores ({pollsters.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('georreferenciacion')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'georreferenciacion'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>Monitoreo GPS y Geocercas en Vivo</span>
        </button>

        <button
          onClick={() => setActiveSubTab('crear')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'crear'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Diseñador con IA</span>
        </button>

        <button
          onClick={() => setActiveSubTab('calculadora')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'calculadora'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Calculadora Muestral</span>
        </button>

        <button
          onClick={() => setActiveSubTab('resultados')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'resultados'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'bg-[#06182c] text-cyan-200/80 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Inteligencia & IA</span>
        </button>
      </div>

      {/* SUB-TAB 1: ESTUDIOS Y SONDEOS LISTING */}
      {activeSubTab === 'estudios' && (
        <div className="space-y-4">
          
          {/* Filter & Search Bar */}
          <div className="bg-[#05162a] border border-cyan-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por título, código o municipio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={handleRunAiAudit}
                disabled={aiAuditRunning}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-400/40 hover:border-purple-400 rounded-xl text-xs font-bold text-purple-200 flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4 text-purple-300 animate-pulse" />
                <span>{aiAuditRunning ? 'Analizando con IA...' : 'Auditoría de Calidad IA'}</span>
              </button>

              <div className="flex items-center gap-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-200">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Estado:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  <option value="todos" className="bg-slate-900 text-white">Todos los estados</option>
                  <option value="en_campo" className="bg-slate-900 text-white">En Campo</option>
                  <option value="borrador" className="bg-slate-900 text-white">Borrador</option>
                  <option value="finalizado" className="bg-slate-900 text-white">Finalizado</option>
                  <option value="en_auditoría" className="bg-slate-900 text-white">En Auditoría</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Audit Result Alert */}
          {aiAuditResult && (
            <div className="bg-[#09223f] border border-purple-500/40 rounded-2xl p-4 text-xs text-slate-200 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Informe de Auditoría Anti-Fraude Asistido por IA</span>
                </span>
                <button onClick={() => setAiAuditResult(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 bg-[#05162a] p-3 rounded-xl border border-purple-500/20">
                {aiAuditResult}
              </pre>
            </div>
          )}

          {/* Studies Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudies.map((study) => {
              const progress = Math.min(100, Math.round((study.completedSample / study.targetSample) * 100));
              const assignedPollstersCount = pollsters.filter(p => p.surveyId === study.id).length;
              
              return (
                <div 
                  key={study.id} 
                  className="bg-[#05162a] border border-cyan-500/25 hover:border-cyan-400/50 rounded-2xl p-5 shadow-lg space-y-4 transition-all duration-200 hover:shadow-cyan-500/5 relative group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 rounded text-[10px] font-mono font-bold">
                          {study.code}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-semibold">
                          {study.type}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">
                        {study.title}
                      </h3>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                      study.status === 'En Campo' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                        : study.status === 'Finalizado'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : study.status === 'En Auditoría'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                    }`}>
                      {study.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 bg-[#081d38] p-3 rounded-xl border border-cyan-500/10">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Avance Muestral:</span>
                      <span className="text-cyan-300 font-bold">{study.completedSample} / {study.targetSample} ({progress}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                        }`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 text-cyan-200/80">
                      <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{study.methodology}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-200/80">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{study.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-200/80">
                      <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{assignedPollstersCount} Encuestadores Activos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-200/80">
                      <Percent className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Error ±{study.marginOfError}% (95%)</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-cyan-500/15 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>{study.startDate} al {study.endDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSurveyFilter(study.id);
                          setActiveSubTab('encuestadores');
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ver Encuestadores</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedStudy(study);
                          setShowResultsModal(true);
                        }}
                        className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Resultados</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteSurvey(study.id, study.code)}
                        className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-1"
                        title="Eliminar Encuesta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GESTIÓN DE ENCUESTADORES Y REGISTRO DE DATOS BÁSICOS */}
      {activeSubTab === 'encuestadores' && (
        <div className="space-y-5">
          
          {/* Header Controls for Pollsters */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 w-full md:w-auto">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>Gestión y Padrón de Encuestadores de Campo</span>
              </h3>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={openPollsterRegistration}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Registrar Nuevo Encuestador</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#05162a] border border-cyan-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o comuna..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-200">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Filtrar por Estudio:</span>
                <select
                  value={surveyFilter}
                  onChange={(e) => setSurveyFilter(e.target.value)}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  <option value="todas" className="bg-slate-900 text-white">Todos los estudios</option>
                  {studies.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.code} - {s.title.substring(0, 30)}...</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pollsters Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPollsters.map((pollster) => {
              const progress = Math.min(100, Math.round((pollster.completedCount / pollster.dailyGoal) * 100));

              return (
                <div 
                  key={pollster.id} 
                  className={`bg-[#05162a] border rounded-2xl p-5 shadow-lg space-y-4 transition-all duration-200 relative ${
                    pollster.aiAuditFlags?.outOfGeofence 
                      ? 'border-amber-500/60 shadow-amber-500/10'
                      : 'border-cyan-500/25 hover:border-cyan-400/50'
                  }`}
                >
                  {/* Top Pollster Info Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/40 border border-cyan-400/40 flex items-center justify-center font-black text-cyan-200 text-sm shrink-0">
                        {pollster.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{pollster.name}</span>
                        </h4>
                        <div className="text-[11px] text-cyan-300 font-mono">CC: {pollster.cedula}</div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      pollster.status === 'Meta Cumplida'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : pollster.status === 'Activo' || pollster.status === 'En Recorrido'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {pollster.status}
                    </span>
                  </div>

                  {/* Assigned Survey Tag */}
                  <div className="bg-[#081d38] p-2.5 rounded-xl border border-cyan-500/15 text-xs space-y-1">
                    <div className="text-[10px] text-cyan-400/80 uppercase font-bold tracking-wider">Estudio Asignado:</div>
                    <div className="text-white font-medium truncate">{pollster.surveyTitle}</div>
                  </div>

                  {/* Meta & Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Avance Diario de Meta:</span>
                      <span className="font-bold text-emerald-400">{pollster.completedCount} / {pollster.dailyGoal} ({progress}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Live Telemetry Data */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-[#081d38]/60 p-2.5 rounded-xl border border-cyan-500/10">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{pollster.assignedZone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Battery className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Batería: {pollster.batteryLevel}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{pollster.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{pollster.lastActivity}</span>
                    </div>
                  </div>

                  {/* Geofence Alert if any */}
                  {pollster.aiAuditFlags?.outOfGeofence && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{pollster.aiAuditFlags.notes}</span>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-cyan-500/15 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedPollster(pollster);
                        setShowAccreditationModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Carnet CNE</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        disabled={pollster.gpsCoordinates.lat === 0 || pollster.gpsCoordinates.lng === 0}
                        onClick={() => {
                          setActiveGpsPollster(pollster);
                          setActiveSubTab('georreferenciacion');
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:bg-slate-700/30 disabled:text-slate-500 disabled:border-slate-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>{pollster.gpsCoordinates.lat !== 0 && pollster.gpsCoordinates.lng !== 0 ? 'Ver GPS' : 'Sin ubicación'}</span>
                      </button>

                      <button
                        onClick={() => handleDeletePollster(pollster.id, pollster.name)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        title="Eliminar encuestador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MONITOREO GPS Y GEOCERCAS EN VIVO */}
      {activeSubTab === 'georreferenciacion' && (
        <div className="space-y-5">
          
          {/* Header Bar */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                <span>Centro de Monitoreo GPS y Geocercas en Tiempo Real</span>
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-200">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Monitorear Encuesta:</span>
                <select
                  value={surveyFilter}
                  onChange={(e) => setSurveyFilter(e.target.value)}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  <option value="todas" className="bg-slate-900 text-white">Todas las encuestas en campo</option>
                  {studies.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.code} - {s.title.substring(0, 30)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Interactive Real Leaflet Map Stage */}
            <div className="md:col-span-8 bg-[#041122] border border-cyan-500/40 rounded-2xl p-4 shadow-2xl relative min-h-[520px] flex flex-col justify-between overflow-hidden">
              
              {/* Map Top Overlay Controls */}
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 bg-[#05162a]/95 backdrop-blur border border-cyan-500/30 p-2.5 rounded-xl mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
                  <span className="font-bold text-white">Geoportal Territorial CNE</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${hasGpsReports ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/70 text-slate-300'}`}>
                    {hasGpsReports ? 'Reportes GPS recibidos' : 'Sin reportes GPS'}
                  </span>
                </div>

                {/* Layer Selector Buttons */}
                <div className="flex items-center gap-1.5 bg-[#081d38] p-1 rounded-lg border border-cyan-500/20">
                  <button
                    onClick={() => setTileStyle('dark')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      tileStyle === 'dark'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-cyan-200 hover:text-white'
                    }`}
                  >
                    Oscuro CARTO
                  </button>
                  <button
                    onClick={() => setTileStyle('street')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      tileStyle === 'street'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-cyan-200 hover:text-white'
                    }`}
                  >
                    Urbano OSM
                  </button>
                  <button
                    onClick={() => setTileStyle('satellite')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      tileStyle === 'satellite'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-cyan-200 hover:text-white'
                    }`}
                  >
                    Satélite HD
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>En Perímetro ({visibleGpsPollsters.filter(p => p.gpsCoordinates.inGeofence).length})</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>Fuera ({visibleGpsPollsters.filter(p => !p.gpsCoordinates.inGeofence).length})</span>
                  </span>
                </div>
              </div>

              {/* Real Leaflet Map Container */}
              <div className="relative z-10 w-full h-[390px] rounded-xl overflow-hidden border border-cyan-500/30 shadow-inner">
                <MapContainer
                  center={mapCenter}
                  zoom={hasGpsReports ? 13 : 5}
                  style={{ width: '100%', height: '100%', background: '#05162a' }}
                  scrollWheelZoom={true}
                >
                  <MapController
                    center={mapCenter}
                    zoom={activeGpsPollster ? 15 : 5}
                  />

                  <TileLayer
                    url={TILE_LAYERS[tileStyle].url}
                    attribution={TILE_LAYERS[tileStyle].attribution}
                  />

                  {/* Pollster Markers */}
                  {visibleGpsPollsters.map(pollster => {
                    const isSelected = activeGpsPollster?.id === pollster.id;

                    return (
                      <Marker
                        key={pollster.id}
                        position={[pollster.gpsCoordinates.lat, pollster.gpsCoordinates.lng]}
                        icon={createPollsterDivIcon(pollster, isSelected)}
                        eventHandlers={{
                          click: () => setActiveGpsPollster(pollster),
                        }}
                      >
                        <Popup className="custom-leaflet-popup">
                          <div className="p-1 space-y-1.5 font-sans min-w-[200px]">
                            <div className="flex items-center justify-between border-b pb-1">
                              <span className="font-extrabold text-slate-900 text-sm">{pollster.name}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                {pollster.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-0.5">
                              <div><strong>CC:</strong> {pollster.cedula}</div>
                              <div><strong>Zona:</strong> {pollster.assignedZone}</div>
                              <div><strong>Avance:</strong> {pollster.completedCount} / {pollster.dailyGoal} encuestas</div>
                              <div><strong>Ubicación:</strong> {pollster.gpsCoordinates.address}</div>
                              <div><strong>Batería:</strong> {pollster.batteryLevel}%</div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPollster(pollster);
                                setShowAccreditationModal(true);
                              }}
                              className="w-full mt-2 py-1 bg-cyan-600 text-white font-bold rounded text-xs cursor-pointer hover:bg-cyan-700"
                            >
                              Ver Carnet Digital CNE
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Map Footer Info */}
              <div className="relative z-10 pt-3 mt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>{hasGpsReports ? 'Mostrando ubicaciones reportadas por dispositivos registrados' : 'Aún no se han recibido ubicaciones GPS reales'}</span>
                </div>
                <div className="font-mono text-cyan-300 font-semibold">
                  {activeGpsPollster
                    ? `Última ubicación: ${activeGpsPollster.gpsCoordinates.lat.toFixed(4)} | ${activeGpsPollster.gpsCoordinates.lng.toFixed(4)}`
                    : 'Sin coordenadas registradas'}
                </div>
              </div>

            </div>

            {/* Selected Pollster GPS Detail Telemetry Card */}
            <div className="md:col-span-4 space-y-4">
              {activeGpsPollster ? (
                <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-5 text-slate-100 shadow-xl space-y-4">
                  
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
                        {activeGpsPollster.name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{activeGpsPollster.name}</h4>
                        <span className="text-[10px] text-cyan-300 font-mono">CC: {activeGpsPollster.cedula}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeGpsPollster.gpsCoordinates.inGeofence
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {activeGpsPollster.gpsCoordinates.inGeofence ? 'En Zona OK' : 'Alerta Geocerca'}
                    </span>
                  </div>

                  {/* Telemetry rows */}
                  <div className="space-y-2 text-xs">
                    <div className="bg-[#081d38] p-3 rounded-xl border border-cyan-500/15 space-y-1">
                      <div className="text-[10px] text-slate-400">Ubicación GPS Exacta:</div>
                      <div className="font-mono font-bold text-cyan-200">
                        {activeGpsPollster.gpsCoordinates.lat.toFixed(4)}, {activeGpsPollster.gpsCoordinates.lng.toFixed(4)}
                      </div>
                      <div className="text-[11px] text-slate-300">{activeGpsPollster.gpsCoordinates.address}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#081d38] p-2.5 rounded-xl border border-cyan-500/10">
                        <span className="text-[10px] text-slate-400 block">Precisión GPS:</span>
                        <span className="font-mono font-bold text-emerald-300">±{activeGpsPollster.gpsCoordinates.accuracyMeters}m</span>
                      </div>

                      <div className="bg-[#081d38] p-2.5 rounded-xl border border-cyan-500/10">
                        <span className="text-[10px] text-slate-400 block">Nivel de Batería:</span>
                        <span className="font-mono font-bold text-cyan-300">{activeGpsPollster.batteryLevel}%</span>
                      </div>
                    </div>

                    <div className="bg-[#081d38] p-3 rounded-xl border border-cyan-500/15 flex justify-between items-center">
                      <span className="text-slate-400">IMEI Dispositivo:</span>
                      <span className="font-mono font-bold text-white text-[11px]">{activeGpsPollster.deviceImei}</span>
                    </div>

                    <div className="bg-[#081d38] p-3 rounded-xl border border-cyan-500/15 flex justify-between items-center">
                      <span className="text-slate-400">Código Acreditación CNE:</span>
                      <span className="font-mono font-bold text-emerald-300 text-[11px]">{activeGpsPollster.accreditationCode}</span>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <button
                    onClick={() => {
                      setSelectedPollster(activeGpsPollster);
                      setShowAccreditationModal(true);
                    }}
                    className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-cyan-300" />
                    <span>Ver Carnet Digital CNE</span>
                  </button>

                </div>
              ) : (
                <div className="bg-[#05162a] border border-cyan-500/20 rounded-2xl p-6 text-center text-slate-400 text-xs">
                  Seleccione un encuestador en el mapa para ver la telemetría GPS
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 4: DESIGNER WITH AI */}
      {activeSubTab === 'crear' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
          <div className="border-b border-cyan-500/20 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Diseñador y Generador Asistido por IA</span>
              </h3>
            </div>
            
            <button
              onClick={handleGenerateQuestionsWithAI}
              disabled={aiGenerating}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Bot className="w-4 h-4 animate-spin" style={{ animationDuration: aiGenerating ? '2s' : '0s' }} />
              <span>{aiGenerating ? 'Generando Cuestionario...' : 'Generar Preguntas con IA'}</span>
            </button>
          </div>

          <form onSubmit={handleCreateSurvey} className="space-y-6">
            
            {/* General Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Título del Estudio / Sondeo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tracking Poll Semanal Comuna 4 y 5"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Tipo de Investigación *</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as SurveyStudy['type'])}
                  required
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="" disabled>Selecciona el tipo</option>
                  <option value="Intención de Voto">Intención de Voto</option>
                  <option value="Tracking Poll">Tracking Poll Diario/Semanal</option>
                  <option value="Línea Base">Estudio de Línea Base</option>
                  <option value="Sondeo Flash">Sondeo Flash de Temas</option>
                  <option value="Favorabilidad">Favorabilidad e Imagen</option>
                  <option value="Clima Político">Clima Político y Preocupaciones</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Metodología de Recolección *</label>
                <select
                  value={newMethodology}
                  onChange={(e) => setNewMethodology(e.target.value as SurveyStudy['methodology'])}
                  required
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="" disabled>Selecciona la metodología</option>
                  <option value="Presencial (CAPI)">Presencial / Domiciliaria (CAPI)</option>
                  <option value="Telefónico (CATI)">Telefónico Directo (CATI)</option>
                  <option value="Digital / WhatsApp">Digital Web / Bot WhatsApp</option>
                  <option value="Mixto">Metodología Mixta</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Muestra Objetivo (n) *</label>
                <input
                  type="number"
                  required
                  min={50}
                  value={newTargetSample}
                  placeholder="Ingrese el tamaño de la muestra"
                  onChange={(e) => setNewTargetSample(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Cobertura Territorial *</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  placeholder="Municipio, comunas, barrios o zonas incluidas"
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Parámetros Estadísticos</label>
                <div className="bg-[#081d38] border border-cyan-500/20 rounded-xl px-3.5 py-2 text-xs text-slate-400">
                  Configúralos en la Calculadora Muestral
                </div>
              </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-3 pt-4 border-t border-cyan-500/20">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Cuestionario y Banco de Preguntas ({newQuestions.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400">Solo aparecen preguntas agregadas en esta sesión</span>
              </div>

              <div className="space-y-3">
                {newQuestions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-cyan-500/30 p-6 text-center text-xs text-slate-400">
                    No hay preguntas registradas. Agrégalas manualmente o genera una propuesta para revisarla.
                  </div>
                )}
                {newQuestions.map((q, index) => (
                  <div key={q.id} className="bg-[#081d38] border border-cyan-500/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs font-bold">
                          P{index + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{q.text}</p>
                          <span className="text-[10px] text-cyan-400/80 uppercase font-mono">Tipo: {q.type}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewQuestions(newQuestions.filter(item => item.id !== q.id))}
                        className="text-rose-400 hover:text-rose-300 text-xs p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {q.options && (
                      <div className="pl-6 space-y-1">
                        {q.options.map((opt, idx) => (
                          <div key={idx} className="text-[11px] text-slate-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Question Row */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Escriba el enunciado de una nueva pregunta para el estudio..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="flex-1 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Pregunta</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveSubTab('estudios')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar Encuesta en Borrador</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* SUB-TAB 5: SAMPLE CALCULATOR & IA STRATIFICATION */}
      {activeSubTab === 'calculadora' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bg-[#05162a] border border-cyan-500/30 rounded-2xl p-6 text-slate-100 shadow-xl space-y-5">
            <div className="border-b border-cyan-500/20 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-cyan-400" />
                <span>Calculadora de Tamaño Muestral Electorales</span>
              </h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Población Total o Censo Electoral (N)</label>
                <input
                  type="number"
                  value={calcUniverse}
                  min={1}
                  placeholder="Ingrese el censo real"
                  onChange={(e) => setCalcUniverse(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Nivel de Confianza (Z)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[90, 95, 99].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCalcConfidence(val)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        calcConfidence === val
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                          : 'bg-[#081d38] text-slate-300 border-cyan-500/20 hover:border-cyan-400/40'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-cyan-300">Margen de Error Tolerado (e):</label>
                  <span className="font-mono text-emerald-400 font-bold">{calcMargin ? `± ${calcMargin}%` : 'Sin definir'}</span>
                </div>
                <input
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={calcMargin}
                  placeholder="Ingrese el margen de error"
                  onChange={(e) => setCalcMargin(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="md:col-span-6 bg-gradient-to-br from-[#081d38] to-[#041122] border border-cyan-500/40 rounded-2xl p-6 text-slate-100 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <span className={`px-3 py-1 border rounded-full text-[10px] font-extrabold uppercase tracking-wider ${calculatedSample ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}>
                {calculatedSample ? 'Resultado calculado' : 'Esperando parámetros reales'}
              </span>

              <div className="mt-4 space-y-1">
                <span className="text-xs text-slate-400 font-medium">Muestra Necesaria (n):</span>
                <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                  <span className="text-emerald-400">{calculatedSample ?? '—'}</span>
                  {calculatedSample && <span className="text-sm font-normal text-slate-300">encuestas completas</span>}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-purple-400/30 p-3 text-xs text-slate-400">
                La estratificación se habilitará cuando exista una distribución territorial real cargada para la campaña.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: RESULTS & AI INTELLIGENCE */}
      {activeSubTab === 'resultados' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
          <div className="border-b border-cyan-500/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-400" />
                <span>Panel de Inteligencia Electoral e Insights Estratégicos asistidos por IA</span>
              </h3>
            </div>

            <select
              value={surveyFilter}
              onChange={(event) => setSurveyFilter(event.target.value)}
              className="rounded-xl border border-cyan-500/30 bg-[#081d38] px-3 py-2 text-xs text-white"
            >
              <option value="todas">Todas las encuestas</option>
              {studies.map(study => <option key={study.id} value={study.id}>{study.code} - {study.title}</option>)}
            </select>
          </div>
          {filteredResponses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-cyan-500/30 px-6 py-16 text-center">
              <PieChart className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <h4 className="font-bold text-white">No hay respuestas reales registradas</h4>
              <p className="mt-2 text-sm text-slate-400">Los resultados e indicadores aparecerán cuando los encuestadores envíen formularios de esta campaña.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-cyan-500/30 bg-[#081d38] p-5">
                <span className="text-xs text-slate-400">Respuestas recibidas</span>
                <div className="mt-2 text-3xl font-black text-cyan-300">{filteredResponses.length}</div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-[#081d38] p-5">
                <span className="text-xs text-slate-400">Con consentimiento</span>
                <div className="mt-2 text-3xl font-black text-emerald-300">{consentedResponses}</div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-[#081d38] p-5">
                <span className="text-xs text-slate-400">Con ubicación GPS</span>
                <div className="mt-2 text-3xl font-black text-amber-300">{geolocatedResponses}</div>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-[#081d38] p-5 md:col-span-3">
                <span className="text-xs text-slate-400">Duración promedio observada</span>
                <div className="mt-2 text-2xl font-black text-white">{averageResponseSeconds} segundos</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR NUEVO ENCUESTADOR */}
      {showAddPollsterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Registrar Nuevo Encuestador de Campo</span>
              </h3>
              <button onClick={() => setShowAddPollsterModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {!activeCampaignId || studies.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {!activeCampaignId
                    ? 'Debes crear o seleccionar una campaña antes de registrar encuestadores.'
                    : 'Primero crea una encuesta real para poder asignársela al encuestador.'}
                </div>
                {activeCampaignId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPollsterModal(false);
                      setActiveSubTab('crear');
                    }}
                    className="w-full rounded-xl bg-cyan-500 px-5 py-3 font-black text-slate-950 hover:bg-cyan-400"
                  >
                    + Crear primera encuesta
                  </button>
                )}
              </div>
            ) : (
            <form onSubmit={handleAddPollsterSubmit} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="font-bold text-cyan-300 block">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Esteban Morales"
                  value={newPolName}
                  onChange={(e) => setNewPolName(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">Cédula de Ciudadanía *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 1032890123"
                    value={newPolCedula}
                    onChange={(e) => setNewPolCedula(e.target.value)}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">Teléfono Móvil *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: +57 312 450 9988"
                    value={newPolPhone}
                    onChange={(e) => setNewPolPhone(e.target.value)}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-cyan-300 block">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@campanaganadora.co"
                  value={newPolEmail}
                  onChange={(e) => setNewPolEmail(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">Estudio / Sondeo Asignado *</label>
                  <select
                    value={newPolSurveyId}
                    onChange={(e) => setNewPolSurveyId(e.target.value)}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {studies.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900">{s.code} - {s.title.substring(0, 25)}...</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">Zona / Comuna Asignada *</label>
                  <input
                    type="text"
                    required
                    value={newPolZone}
                    onChange={(e) => setNewPolZone(e.target.value)}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">Meta Diaria (Encuestas) *</label>
                  <input
                    type="number"
                    min={5}
                    max={150}
                    value={newPolGoal}
                    onChange={(e) => setNewPolGoal(Number(e.target.value))}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-cyan-300 block">IMEI / Dispositivo *</label>
                  <input
                    type="text"
                    value={newPolDevice}
                    onChange={(e) => setNewPolDevice(e.target.value)}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-cyan-500/20 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPollsterModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRealData}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Encuestador</span>
                </button>
              </div>

            </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CARNET DIGITAL DE ACREDITACIÓN CNE */}
      {showAccreditationModal && selectedPollster && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-2xl max-w-sm w-full p-6 space-y-4 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative">
            
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-widest">
                CNE - Acreditación Oficial
              </span>
              <button onClick={() => setShowAccreditationModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {/* Carnet Layout */}
            <div className="bg-gradient-to-br from-[#092842] to-[#041122] border-2 border-cyan-400/50 rounded-2xl p-4 shadow-xl text-center space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

              <div className="text-[9px] font-black uppercase text-cyan-300 tracking-wider">
                Campaña Ganadora - Investigación Electoral
              </div>

              {/* Avatar Photo Frame */}
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-lg">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-white text-2xl">
                  {selectedPollster.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-white">{selectedPollster.name}</h3>
                <p className="text-xs text-cyan-300 font-mono font-bold">C.C. {selectedPollster.cedula}</p>
                <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">CARGO: ENCUESTADOR OFICIAL DE CAMPO</p>
              </div>

              <div className="bg-[#05162a] p-2 rounded-xl border border-cyan-500/20 text-[10px] text-slate-300 space-y-1 text-left">
                <div><span className="text-slate-400">Estudio:</span> {selectedPollster.surveyTitle}</div>
                <div><span className="text-slate-400">Zona:</span> {selectedPollster.assignedZone}</div>
                <div><span className="text-slate-400">Código CNE:</span> <span className="text-cyan-300 font-mono font-bold">{selectedPollster.accreditationCode}</span></div>
              </div>

              {/* QR Code Simulation */}
              <div className="pt-1 flex flex-col items-center justify-center">
                <div className="p-2 bg-white rounded-xl shadow">
                  <QrCode className="w-16 h-16 text-slate-950" />
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-1">Escanee para verificar validez CNE</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  alert(`Imprimiendo acreditación CNE para ${selectedPollster.name}...`);
                  setShowAccreditationModal(false);
                }}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Descargar Carnet (PDF)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: VER RESULTADOS DE ESTUDIO */}
      {showResultsModal && selectedStudy && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-cyan-500/20 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">{selectedStudy.code}</span>
                <h3 className="text-base font-bold text-white">{selectedStudy.title}</h3>
              </div>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#081d38] p-3 rounded-xl">
                <div>Metodología: <span className="font-bold text-white">{selectedStudy.methodology}</span></div>
                <div>Lugar: <span className="font-bold text-white">{selectedStudy.location}</span></div>
                <div>Muestra: <span className="font-bold text-cyan-300">{selectedStudy.completedSample} de {selectedStudy.targetSample}</span></div>
                <div>Margen Error: <span className="font-bold text-amber-300">±{selectedStudy.marginOfError}%</span></div>
              </div>

              <div className="bg-[#081d38] p-4 rounded-xl space-y-2">
                <span className="font-bold text-cyan-300">Resumen de Pregunta Principal (Intención de Voto):</span>
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between">
                    <span>Nuestro Candidato:</span>
                    <span className="font-bold text-emerald-400">38.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Segundo Lugar:</span>
                    <span className="font-bold text-blue-300">27.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Indecisos:</span>
                    <span className="font-bold text-amber-300">11.5%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-cyan-500/20 flex justify-end gap-2">
              <button
                onClick={() => setShowResultsModal(false)}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
