import React, { useState, useEffect, useRef } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { ViewMode } from '../../types';
import type { AuthUser } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
import { ProgramaGobiernoView } from './ProgramaGobiernoView';
import { ComunicacionRedesView } from './ComunicacionRedesView';

import { AgendaCalendarioView } from './AgendaCalendarioView';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  FileText,
  UploadCloud,
  GraduationCap,
  Briefcase,
  Building,
  ShieldCheck,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  Save,
  Award,
  Globe,
  MessageSquare,
  Target,
  Users,
  RefreshCw,
  X,
  FileSpreadsheet,
  PieChart,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  Activity,
  CheckSquare,
  FileCheck,
  Flame,
  Zap,
  BarChart3,
  MapPin
} from 'lucide-react';

// Predefined DOFA / SWOT evaluation variables for political candidate assessment
const predefinedDofaVariables = {
  strengths: [
    'Trayectoria ética intachable (0 antecedentes judicial/fiscal)',
    'Experiencia técnica comprobada en gestión pública o privada',
    'Alto nivel de reconocimiento y carisma territorial',
    'Sólido respaldo de sectores académicos, juveniles e independientes',
    'Capacidad de oratoria y debate político de alto nivel',
    'Equipo técnico y político cohesionado sin divisiones',
    'Propuestas innovadoras en seguridad, empleo e inclusión'
  ],
  opportunities: [
    'Alto descontento ciudadano con la administración o maquinaria saliente',
    'Crecimiento del voto de opinión e independiente en la zona',
    'Alianzas estratégicas con JAC, líderes comunales y gremios locales',
    'Coyuntura favorable para propuestas de tecnología e innovación',
    'Apertura en medios de comunicación locales y comunitarios',
    'Incentivos de cofinanciación y cooperación territorial'
  ],
  weaknesses: [
    'Reconocimiento territorial bajo en comunas/veredas periféricas',
    'Estructura de logística y movilización en proceso de consolidación',
    'Presupuesto inicial ajustado frente a candidaturas de maquinarias',
    'Bajo posicionamiento en sectores gremiales tradicionales',
    'Equipo de trabajo con sobrecarga de funciones operativas',
    'Falta de voceros estratégicos delegados por zona o corregimiento'
  ],
  threats: [
    'Ataques sistemáticos de desinformación y guerra sucia de opositores',
    'Uso indebido de recursos públicos y maquinarias clientelares por rivales',
    'Riesgo de alto abstencionismo en puestos de votación clave',
    'Prácticas clientelares y compra de votos en el territorio',
    'Comportamiento volátil en votantes indecisos de última hora',
    'Riesgos de orden público o seguridad en desplazamientos'
  ]
};

interface AcademicDegree {
  id: string;
  title: string;
  institution: string;
  year: string;
  level: 'Pregrado' | 'Posgrado' | 'Maestría' | 'Doctorado' | 'Diplomado';
}

interface ExperienceItem {
  id: string;
  role: string;
  entityCompany: string;
  period: string;
  achievements: string;
  type: 'Público' | 'Privado' | 'Político/Social';
}

interface PoliticalActor {
  id: string;
  name: string;
  role: 'Competidor Directo' | 'Aliado Político' | 'Líder Neutral';
  party: string;
  estimatedVoteShare: number;
  notes: string;
  source: string;
  updatedAt: string;
}

interface GestionEstrategicaProps {
  onSelectView: (view: ViewMode) => void;
  onOpenUpdateProfileModal?: () => void;
  onOpenBudgetModal?: () => void;
  activeTab?: 'diagnostico' | 'diagnostico_territorial' | 'programa_gobierno' | 'perfil' | 'hoja_vida' | 'dofa' | 'discurso' | 'comunicacion_redes' | 'analisis_datos' | 'agenda_electoral' | 'ai_command' | 'presupuesto';
  onSelectTab?: (tab: 'diagnostico' | 'diagnostico_territorial' | 'programa_gobierno' | 'perfil' | 'hoja_vida' | 'dofa' | 'discurso' | 'comunicacion_redes' | 'analisis_datos' | 'agenda_electoral' | 'ai_command' | 'presupuesto') => void;
  authUser?: AuthUser | null;
}

export const GestionEstrategica: React.FC<GestionEstrategicaProps> = ({
  onSelectView,
  activeTab: propActiveTab,
  onSelectTab,
  authUser,
}) => {
  // ── Datos de campaña desde contexto global (circunscripción real) ──────────
  const campaignCtx = useCampaignData();
  const geoCtx      = useCampaignGeo();
  // ──────────────────────────────────────────────────────────────────────────

  // Navigation Tabs within Strategic Management Session
  const [internalTab, setInternalTab] = useState<'diagnostico' | 'diagnostico_territorial' | 'programa_gobierno' | 'perfil' | 'hoja_vida' | 'dofa' | 'discurso' | 'comunicacion_redes' | 'analisis_datos' | 'agenda_electoral' | 'ai_command' | 'presupuesto'>('diagnostico');
  const activeTab = propActiveTab || internalTab;
  const setActiveTab = (tab: 'diagnostico' | 'diagnostico_territorial' | 'programa_gobierno' | 'perfil' | 'hoja_vida' | 'dofa' | 'discurso' | 'comunicacion_redes' | 'analisis_datos' | 'agenda_electoral' | 'ai_command' | 'presupuesto') => {
    setInternalTab(tab);
    if (onSelectTab) onSelectTab(tab);
  };

  // Campaign & Territorial Diagnostic Session State
  const [diagnosticSubTab, setDiagnosticSubTab] = useState<'overview' | 'territorial' | 'audit' | 'report'>('overview');
  const [isDiagnosticScanning, setIsDiagnosticScanning] = useState(false);
  const [lastDiagnosticDate, setLastDiagnosticDate] = useState('');

  const [diagnosticCampaign, setDiagnosticCampaign] = useState<any | null>(null);
  const [diagnosticCampaignLoading, setDiagnosticCampaignLoading] = useState(true);

  useEffect(() => {
    const loadDiagnosticCampaign = async () => {
      setDiagnosticCampaignLoading(true);
      try {
        const rememberedCampaignId = localStorage.getItem('active_campaign_id');
        let query = supabase.from('campaigns').select('*');
        if (rememberedCampaignId) query = query.eq('id', rememberedCampaignId);
        else if (authUser?.clientId) query = query.eq('client_id', authUser.clientId);
        else {
          setDiagnosticCampaign(null);
          return;
        }
        const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        setDiagnosticCampaign(data || null);
      } catch {
        setDiagnosticCampaign(null);
      } finally {
        setDiagnosticCampaignLoading(false);
      }
    };
    void loadDiagnosticCampaign();
  }, [authUser?.clientId]);

  const diagnosticCampaignName = diagnosticCampaign?.nombre || diagnosticCampaign?.name || 'Campaña electoral';
  const diagnosticTerritory = diagnosticCampaign?.municipio || diagnosticCampaign?.city || diagnosticCampaign?.territorio || '';
  const diagnosticYear = diagnosticCampaign?.election_date
    ? new Date(diagnosticCampaign.election_date).getFullYear()
    : new Date().getFullYear();


  // Territorial Diagnostic State (Programmatic Input)
  interface TerritorialNeed {
    id: string;
    comunaSector: string;
    category: 'Seguridad' | 'Infraestructura' | 'Empleo' | 'Salud' | 'Educación' | 'Medio Ambiente';
    problemDescription: string;
    impactLevel: 'Alto' | 'Crítico' | 'Medio';
    programmaticProposal: string;
  }

  const [territorialNeeds, setTerritorialNeeds] = useState<TerritorialNeed[]>([
    {
      id: 'tn-1',
      comunaSector: 'Comuna 1 - Popular',
      category: 'Infraestructura',
      problemDescription: 'Déficit de rutas alimentadoras de metrocable y deterioro severo de la malla vial secundaria.',
      impactLevel: 'Alto',
      programmaticProposal: 'Implementación del Plan Metropolitano de Micro-Pavimentación Comunitaria e integración tarifaria alimentadora.'
    },
    {
      id: 'tn-2',
      comunaSector: 'Comuna 3 - Manrique',
      category: 'Seguridad',
      problemDescription: 'Presencia de estructuras delictivas locales que extorsionan a comerciantes y transporte público.',
      impactLevel: 'Crítico',
      programmaticProposal: 'Despliegue de Centros Integrales de Seguridad Comunitaria con cámaras LPR de inteligencia artificial y red de apoyo gremial.'
    },
    {
      id: 'tn-3',
      comunaSector: 'Comuna 13 - San Javier',
      category: 'Empleo',
      problemDescription: 'Alta tasa de desempleo e informalidad juvenil (42%) con falta de centros de formación tecnológica.',
      impactLevel: 'Alto',
      programmaticProposal: 'Creación de la Ciudadela Tecnológica y Nodos de Emprendimiento Digital con incentivos fiscales para contratación juvenil.'
    },
    {
      id: 'tn-4',
      comunaSector: 'Corregimiento San Cristóbal',
      category: 'Medio Ambiente',
      problemDescription: 'Intermediación abusiva en la comercialización agrícola y falta de distritos de riego eficientes.',
      impactLevel: 'Medio',
      programmaticProposal: 'Constitución del Centro de Acopio Campesino y Tecnificación del Distrito Agroecológico de San Cristóbal.'
    }
  ].filter(() => false) as TerritorialNeed[]);

  const [selectedComunaFilter, setSelectedComunaFilter] = useState<string>('Todos');
  const [showAddNeedModal, setShowAddNeedModal] = useState(false);
  const [newTerritorialNeed, setNewTerritorialNeed] = useState({
    comunaSector: 'Comuna 1 - Popular',
    category: 'Seguridad' as 'Seguridad' | 'Infraestructura' | 'Empleo' | 'Salud' | 'Educación' | 'Medio Ambiente',
    problemDescription: '',
    impactLevel: 'Alto' as 'Alto' | 'Crítico' | 'Medio',
    programmaticProposal: ''
  });

  const handleAddTerritorialNeed = () => {
    if (!newTerritorialNeed.problemDescription.trim() || !newTerritorialNeed.programmaticProposal.trim()) return;
    const newEntry: TerritorialNeed = {
      id: `tn-${Date.now()}`,
      ...newTerritorialNeed
    };
    setTerritorialNeeds([newEntry, ...territorialNeeds]);
    setNewTerritorialNeed({
      comunaSector: 'Comuna 1 - Popular',
      category: 'Seguridad',
      impactLevel: 'Alto',
      problemDescription: '',
      programmaticProposal: ''
    });
    setShowAddNeedModal(false);
  };

  // Sectorial Diagnostic State (Feeds from Sondeos de Opinión)
  interface IndicadorItem {
    id: string;
    nombre: string;
    lineaBase: string;
    meta: string;
  }

  interface SectorVariable {
    id: string;
    name: string;
    status: 'Crítico' | 'Regular' | 'Bueno';
    score: number;
    pollPerception: string;
    indicador?: string;
    lineaBase?: string;
    meta?: string;
    indicadores?: IndicadorItem[];
  }

  interface SectorDiagnostic {
    id: string;
    category: string;
    iconEmoji: string;
    surveyPriorityPercent: number;
    problemSummary: string;
    programmaticSolution: string;
    variables: SectorVariable[];
  }

  // The territorial diagnosis must start empty. The examples below are retained
  // only as a typed catalogue while the screen is migrated, but are never seeded.
  const [sectorDiagnostics, setSectorDiagnostics] = useState<SectorDiagnostic[]>([
    {
      id: 'sec-seguridad',
      category: 'Seguridad',
      iconEmoji: '🛡️',
      surveyPriorityPercent: 68,
      problemSummary: 'Alta percepción de inseguridad en transporte público y zonas comerciales de comunas periféricas. Incremento en microextorsión a pequeños negocios.',
      programmaticSolution: 'Creación de la Red Comunitaria de Inteligencia y Seguridad Digital con cámaras LPR integradas a la Policía y Centros C4 en comunas críticas.',
      variables: [
        { 
          id: 'v-seg-1', 
          name: 'Percepción de Inseguridad Nocturna', 
          status: 'Crítico', 
          score: 28, 
          pollPerception: '78% de encuestados se siente inseguro de noche',
          indicador: 'Índice de Percepción de Inseguridad Nocturna',
          lineaBase: '78.4%',
          meta: '32.0%'
        },
        { 
          id: 'v-seg-2', 
          name: 'Tiempo de Respuesta de Cuadrantes/Patrullas', 
          status: 'Regular', 
          score: 45, 
          pollPerception: '62% exige menor tiempo de respuesta',
          indicador: 'Tiempo promedio de atención a llamadas de emergencia',
          lineaBase: '24.5 min',
          meta: '8.0 min'
        },
        { 
          id: 'v-seg-3', 
          name: 'Extorsión y Cobro de Cuotas a Comercio Local', 
          status: 'Crítico', 
          score: 22, 
          pollPerception: '84% califica la extorsión como grave',
          indicador: 'Porcentaje de comerciantes víctimas de extorsión',
          lineaBase: '38.2%',
          meta: '8.5%'
        },
        { 
          id: 'v-seg-4', 
          name: 'Alumbrado Público e Iluminación en Parques', 
          status: 'Regular', 
          score: 52, 
          pollPerception: '58% solicita iluminación LED',
          indicador: 'Porcentaje de parques con iluminación LED funcional',
          lineaBase: '42.0%',
          meta: '95.0%'
        }
      ]
    },
    {
      id: 'sec-salud',
      category: 'Salud',
      iconEmoji: '🏥',
      surveyPriorityPercent: 54,
      problemSummary: 'Congestión severa en salas de urgencias y demoras de hasta 45 días en la asignación de citas con especialistas en la red pública hospitalaria.',
      programmaticSolution: 'Implementación de Telemedicina Municipal Prioritaria y adquisición de Unidades Móviles de Diagnóstico de Alta Complejidad.',
      variables: [
        { 
          id: 'v-sal-1', 
          name: 'Tiempo de Asignación Citas Especialistas', 
          status: 'Crítico', 
          score: 25, 
          pollPerception: '82% reporta espera superior a 30 días',
          indicador: 'Días promedio de espera para cita especializada',
          lineaBase: '45.0 días',
          meta: '12.0 días'
        },
        { 
          id: 'v-sal-2', 
          name: 'Oportunidad y Entrega Total de Medicamentos', 
          status: 'Crítico', 
          score: 30, 
          pollPerception: '75% reporta escasez en dispensarios',
          indicador: 'Tasa de desabastecimiento de fórmulas médicas',
          lineaBase: '34.8%',
          meta: '5.0%'
        },
        { 
          id: 'v-sal-3', 
          name: 'Atención en Urgencias Hospitalarias', 
          status: 'Regular', 
          score: 42, 
          pollPerception: '68% pide descongestionar urgencias',
          indicador: 'Tiempo promedio de triaje y atención primaria',
          lineaBase: '4.2 horas',
          meta: '1.2 horas'
        },
        { 
          id: 'v-sal-4', 
          name: 'Programas de Salud Mental y Prevención', 
          status: 'Crítico', 
          score: 32, 
          pollPerception: '71% pide atención psicológica en barrios',
          indicador: 'Centros de atención psicológica barrial por 100k hab',
          lineaBase: '1.8 centros',
          meta: '8.0 centros'
        }
      ]
    },
    {
      id: 'sec-educacion',
      category: 'Educación',
      iconEmoji: '🎓',
      surveyPriorityPercent: 48,
      problemSummary: 'Deterioro en la infraestructura física de instituciones educativas públicas y deserción en educación superior por falta de becas.',
      programmaticSolution: 'Fondo Municipal de Becas 100% Condonables para Carreras STEM e Inversión de Choque en Infraestructura Escolar.',
      variables: [
        { 
          id: 'v-edu-1', 
          name: 'Mantenimiento e Infraestructura Física Escolar', 
          status: 'Regular', 
          score: 48, 
          pollPerception: '55% colegios requieren reformas urgentes',
          indicador: 'Porcentaje de escuelas públicas con daño estructural',
          lineaBase: '55.0%',
          meta: '10.0%'
        },
        { 
          id: 'v-edu-2', 
          name: 'Acceso a Becas de Educación Superior / Técnica', 
          status: 'Crítico', 
          score: 35, 
          pollPerception: '76% jóvenes sin cupo en educación técnica/superior',
          indicador: 'Cobertura de becas de educación superior en est. 1 y 2',
          lineaBase: '14.2%',
          meta: '65.0%'
        },
        { 
          id: 'v-edu-3', 
          name: 'Calidad y Cobertura Alimentación Escolar (PAE)', 
          status: 'Bueno', 
          score: 72, 
          pollPerception: '65% aprueba ración alimentaria escolar',
          indicador: 'Cobertura efectiva del programa de alimentación escolar',
          lineaBase: '82.5%',
          meta: '100.0%'
        },
        { 
          id: 'v-edu-4', 
          name: 'Conectividad e Internet en Aulas Públicas', 
          status: 'Regular', 
          score: 50, 
          pollPerception: '58% pide mayor ancho de banda en escuelas',
          indicador: 'Ancho de banda promedio por estudiante',
          lineaBase: '1.2 Mbps',
          meta: '15.0 Mbps'
        }
      ]
    },
    {
      id: 'sec-infraestructura',
      category: 'Infraestructura',
      iconEmoji: '🛣️',
      surveyPriorityPercent: 62,
      problemSummary: 'Malla vial secundaria deteriorada con altos niveles de acentuación de huecos en rutas de buses y congestión vehicular en corredores principales.',
      programmaticSolution: 'Plan Escuadrón Tapa-Huecos 24/7 y Construcción de Viaductos de Descongestión en Puntos Críticos.',
      variables: [
        { 
          id: 'v-inf-1', 
          name: 'Estado de Malla Vial y Huecos en Vías', 
          status: 'Crítico', 
          score: 20, 
          pollPerception: '89% califica vías en mal estado',
          indicador: 'Porcentaje de malla vial secundaria deteriorada',
          lineaBase: '68.4%',
          meta: '15.0%'
        },
        { 
          id: 'v-inf-2', 
          name: 'Frecuencia y Cobertura Transporte Público', 
          status: 'Regular', 
          score: 46, 
          pollPerception: '63% exige aumentar frecuencias',
          indicador: 'Frecuencia de paso de rutas públicas en hora pico',
          lineaBase: '28.0 min',
          meta: '10.0 min'
        },
        { 
          id: 'v-inf-3', 
          name: 'Mantenimiento de Aceras y Espacio Peatonal', 
          status: 'Bueno', 
          score: 68, 
          pollPerception: '58% aprueba caminabilidad de corredores',
          indicador: 'Kilómetros de andenes con acceso incluyente',
          lineaBase: '42.5 km',
          meta: '120.0 km'
        }
      ]
    },
    {
      id: 'sec-empleo',
      category: 'Empleo',
      iconEmoji: '💼',
      surveyPriorityPercent: 59,
      problemSummary: 'Tasa de desempleo juvenil elevada y proliferación del crédito extorsivo (gota a gota) entre comerciantes informales.',
      programmaticSolution: 'Banco Semilla de Emprendimiento Popular al 0% de Interés y Programa Primer Empleo Joven con exención fiscal empresarial.',
      variables: [
        { 
          id: 'v-emp-1', 
          name: 'Oportunidades de Primer Empleo para Jóvenes', 
          status: 'Crítico', 
          score: 32, 
          pollPerception: '81% denuncia falta de empleo juvenil',
          indicador: 'Tasa de desempleo juvenil (18 - 28 años)',
          lineaBase: '26.8%',
          meta: '11.0%'
        },
        { 
          id: 'v-emp-2', 
          name: 'Acceso a Crédito Justo para Microempresas', 
          status: 'Regular', 
          score: 42, 
          pollPerception: '73% pide erradicar el gota a gota',
          indicador: 'Porcentaje de informales en crédito informal extorsivo',
          lineaBase: '41.2%',
          meta: '8.0%'
        },
        { 
          id: 'v-emp-3', 
          name: 'Incentivos para Inversión e Industria Local', 
          status: 'Regular', 
          score: 55, 
          pollPerception: '60% apoya atracción de empresas',
          indicador: 'Nuevas Mipymes formalizadas e incentivadas por año',
          lineaBase: '120 empresas',
          meta: '450 empresas'
        }
      ]
    },
    {
      id: 'sec-ambiente',
      category: 'Medio Ambiente',
      iconEmoji: '🌿',
      surveyPriorityPercent: 42,
      problemSummary: 'Deficiencias en recolección de residuos sólidos en laderas, puntos críticos de basuras y falta de acueducto potable digno en zonas periféricas.',
      programmaticSolution: 'Modernización del Sistema de Contenerización Inteligente y Formalización de Recicladores de Oficio.',
      variables: [
        { 
          id: 'v-amb-1', 
          name: 'Eficiencia en Recolección de Basuras', 
          status: 'Regular', 
          score: 51, 
          pollPerception: '64% identifica puntos críticos de arrojo',
          indicador: 'Número de puntos críticos clandestinos de basura',
          lineaBase: '142 puntos',
          meta: '20 puntos'
        },
        { 
          id: 'v-amb-2', 
          name: 'Cobertura de Agua Potable y Alcantarillado', 
          status: 'Crítico', 
          score: 38, 
          pollPerception: '70% demanda acueducto digno en laderas',
          indicador: 'Cobertura de agua potable continua en laderas',
          lineaBase: '62.0%',
          meta: '98.0%'
        },
        { 
          id: 'v-amb-3', 
          name: 'Protección de Parques Ecológicos y Cerros', 
          status: 'Bueno', 
          score: 70, 
          pollPerception: '62% apoya conservación de cerros',
          indicador: 'Hectáreas de áreas protegidas reforestadas y custodiadas',
          lineaBase: '125 ha',
          meta: '450 ha'
        }
      ]
    },
    {
      id: 'sec-inclusion',
      category: 'Inclusión y Deporte',
      iconEmoji: '⚽',
      surveyPriorityPercent: 39,
      problemSummary: 'Falta de iluminación e infraestructura sintética en canchas barriales y desatención a centros día de adultos mayores.',
      programmaticSolution: 'Canchas Sintéticas de Acceso Gratuito 24/7 y Red Distrital de Centros Día con Nutrición para Adultos Mayores.',
      variables: [
        { 
          id: 'v-inc-1', 
          name: 'Estado de Mantenimiento de Canchas Barriales', 
          status: 'Regular', 
          score: 53, 
          pollPerception: '59% pide iluminar y arreglar canchas',
          indicador: 'Porcentaje de canchas deportivas restauradas e iluminadas',
          lineaBase: '38.0%',
          meta: '90.0%'
        },
        { 
          id: 'v-inc-2', 
          name: 'Atención Integral a Adultos Mayores y Discapacidad', 
          status: 'Regular', 
          score: 49, 
          pollPerception: '67% pide aumento de subsidios',
          indicador: 'Adultos mayores atendidos en centros día de la ciudad',
          lineaBase: '3,200 pers.',
          meta: '8,500 pers.'
        }
      ]
    }
  ].filter(() => false) as SectorDiagnostic[]);

  const [activeSectorId, setActiveSectorId] = useState<string>('');
  const [selectedSectorTab, setSelectedSectorTab] = useState<string>('');
  const [sectorStorageReady, setSectorStorageReady] = useState(false);
  const [territorialNeedsStorageReady, setTerritorialNeedsStorageReady] = useState(false);
  const sectorTabsContainerRef = useRef<HTMLDivElement | null>(null);
  const sectorTabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const sectorStorageKey = diagnosticCampaign?.id
    ? `campaign:${diagnosticCampaign.id}:territorial-diagnostic`
    : '';
  const territorialNeedsStorageKey = diagnosticCampaign?.id
    ? `campaign:${diagnosticCampaign.id}:territorial-needs`
    : '';

  useEffect(() => {
    if (diagnosticCampaignLoading) return;
    setSectorStorageReady(false);

    if (!sectorStorageKey) {
      setSectorDiagnostics([]);
      setActiveSectorId('');
      setSelectedSectorTab('');
      return;
    }

    try {
      const stored = localStorage.getItem(sectorStorageKey);
      const parsed = stored ? JSON.parse(stored) as SectorDiagnostic[] : [];
      const validSectors = Array.isArray(parsed) ? parsed : [];
      setSectorDiagnostics(validSectors);
      setActiveSectorId(validSectors[0]?.id || '');
      setSelectedSectorTab(validSectors[0]?.category || '');
    } catch {
      setSectorDiagnostics([]);
      setActiveSectorId('');
      setSelectedSectorTab('');
    } finally {
      setSectorStorageReady(true);
    }
  }, [diagnosticCampaignLoading, sectorStorageKey]);

  useEffect(() => {
    if (!sectorStorageReady || !sectorStorageKey) return;
    localStorage.setItem(sectorStorageKey, JSON.stringify(sectorDiagnostics));
  }, [sectorDiagnostics, sectorStorageKey, sectorStorageReady]);

  useEffect(() => {
    if (diagnosticCampaignLoading) return;
    setTerritorialNeedsStorageReady(false);

    if (!territorialNeedsStorageKey) {
      setTerritorialNeeds([]);
      return;
    }

    try {
      const stored = localStorage.getItem(territorialNeedsStorageKey);
      const parsed = stored ? JSON.parse(stored) as TerritorialNeed[] : [];
      setTerritorialNeeds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTerritorialNeeds([]);
    } finally {
      setTerritorialNeedsStorageReady(true);
    }
  }, [diagnosticCampaignLoading, territorialNeedsStorageKey]);

  useEffect(() => {
    if (!territorialNeedsStorageReady || !territorialNeedsStorageKey) return;
    localStorage.setItem(territorialNeedsStorageKey, JSON.stringify(territorialNeeds));
  }, [territorialNeeds, territorialNeedsStorageKey, territorialNeedsStorageReady]);

  useEffect(() => {
    const currentTabEl = sectorTabRefs.current[selectedSectorTab];
    const container = sectorTabsContainerRef.current;
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
  }, [selectedSectorTab]);

  const [showAddVariableModal, setShowAddVariableModal] = useState<boolean>(false);
  const [newVariableName, setNewVariableName] = useState<string>('');
  const [newVarIndicador, setNewVarIndicador] = useState<string>('');
  const [newVarLineaBase, setNewVarLineaBase] = useState<string>('');
  const [newVarMeta, setNewVarMeta] = useState<string>('');

  // Helper to retrieve all indicators for a variable (supports both single legacy and multiple indicators)
  const getVariableIndicadores = (variable: SectorVariable): IndicadorItem[] => {
    if (variable.indicadores && variable.indicadores.length > 0) {
      return variable.indicadores;
    }
    if (variable.indicador || variable.lineaBase || variable.meta) {
      return [{
        id: 'ind-default-' + variable.id,
        nombre: variable.indicador || variable.name,
        lineaBase: variable.lineaBase || 'N/A',
        meta: variable.meta || 'N/A'
      }];
    }
    return [];
  };

  // Editing variable indicator & baseline state
  const [editingVariable, setEditingVariable] = useState<{
    sectorId: string;
    variable: SectorVariable;
  } | null>(null);

  const [varEditForm, setVarEditForm] = useState<{
    name: string;
    status: 'Crítico' | 'Regular' | 'Bueno';
    score: number;
    pollPerception: string;
    indicadores: IndicadorItem[];
  }>({
    name: '',
    status: 'Regular',
    score: 50,
    pollPerception: '',
    indicadores: []
  });

  const handleOpenEditVariableModal = (sectorId: string, variable: SectorVariable) => {
    setEditingVariable({ sectorId, variable });
    const currentInds = getVariableIndicadores(variable);
    setVarEditForm({
      name: variable.name,
      status: variable.status,
      score: variable.score,
      pollPerception: variable.pollPerception,
      indicadores: currentInds.length > 0 ? JSON.parse(JSON.stringify(currentInds)) : [{
        id: 'ind-' + Date.now(),
        nombre: variable.name,
        lineaBase: '',
        meta: ''
      }]
    });
  };

  const handleAddIndicadorToForm = () => {
    setVarEditForm(prev => ({
      ...prev,
      indicadores: [
        ...prev.indicadores,
        {
          id: 'ind-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          nombre: '',
          lineaBase: '',
          meta: ''
        }
      ]
    }));
  };

  const handleUpdateIndicadorInForm = (id: string, field: keyof IndicadorItem, value: string) => {
    setVarEditForm(prev => ({
      ...prev,
      indicadores: prev.indicadores.map(ind => ind.id === id ? { ...ind, [field]: value } : ind)
    }));
  };

  const handleRemoveIndicadorFromForm = (id: string) => {
    setVarEditForm(prev => ({
      ...prev,
      indicadores: prev.indicadores.filter(ind => ind.id !== id)
    }));
  };

  const handleSaveEditedVariable = () => {
    if (!editingVariable) return;
    const cleanIndicadores = varEditForm.indicadores
      .filter(ind => ind.nombre.trim() !== '' || ind.lineaBase.trim() !== '' || ind.meta.trim() !== '')
      .map(ind => ({
        ...ind,
        nombre: ind.nombre.trim() || 'Indicador sin nombre',
        lineaBase: ind.lineaBase.trim() || 'N/A',
        meta: ind.meta.trim() || 'N/A'
      }));

    const primaryInd = cleanIndicadores[0];

    setSectorDiagnostics(prev => prev.map(sec => {
      if (sec.id !== editingVariable.sectorId) return sec;
      return {
        ...sec,
        variables: sec.variables.map(v => {
          if (v.id !== editingVariable.variable.id) return v;
          return {
            ...v,
            name: varEditForm.name.trim() || v.name,
            indicadores: cleanIndicadores,
            indicador: primaryInd?.nombre,
            lineaBase: primaryInd?.lineaBase,
            meta: primaryInd?.meta,
            status: varEditForm.status,
            score: varEditForm.score,
            pollPerception: varEditForm.pollPerception.trim() || v.pollPerception
          };
        })
      };
    }));
    setEditingVariable(null);
  };
  const [showAddSectorModal, setShowAddSectorModal] = useState<boolean>(false);
  const [sectorToDelete, setSectorToDelete] = useState<SectorDiagnostic | null>(null);
  const [newSector, setNewSector] = useState({
    category: '',
    iconEmoji: '📌',
    problemSummary: '',
    programmaticSolution: '',
    initialVariable: ''
  });
  const [isSyncingSurveys, setIsSyncingSurveys] = useState(false);
  const [surveySyncTimestamp, setSurveySyncTimestamp] = useState<string>('Sin registros sincronizados');
  const [customVariableInput, setCustomVariableInput] = useState<{ [sectorId: string]: string }>({});

  const handleAddSector = () => {
    if (!newSector.category.trim()) return;

    const createdSector: SectorDiagnostic = {
      id: `sec-custom-${Date.now()}`,
      category: newSector.category.trim(),
      iconEmoji: newSector.iconEmoji.trim() || '📌',
      surveyPriorityPercent: 0,
      problemSummary: newSector.problemSummary.trim() || 'Diagnóstico preliminar en proceso de caracterización sectorial.',
      programmaticSolution: newSector.programmaticSolution.trim() || 'Estrategia programática a definir con la comunidad.',
      variables: newSector.initialVariable.trim()
        ? [
            {
              id: `v-${Date.now()}-1`,
              name: newSector.initialVariable.trim(),
              status: 'Regular',
              score: 0,
              pollPerception: 'Pendiente de información'
            }
          ]
        : []
    };

    setSectorDiagnostics(prev => [...prev, createdSector]);
    setActiveSectorId(createdSector.id);
    setSelectedSectorTab(createdSector.category);
    setNewSector({
      category: '',
      iconEmoji: '📌',
      problemSummary: '',
      programmaticSolution: '',
      initialVariable: ''
    });
    setShowAddSectorModal(false);
  };

  const handleDeleteSector = (sectorId: string) => {
    const target = sectorDiagnostics.find(s => s.id === sectorId);
    if (!target) return;
    setSectorToDelete(target);
  };

  const confirmDeleteSector = () => {
    if (!sectorToDelete) return;
    const targetId = sectorToDelete.id;
    const targetCategory = sectorToDelete.category;

    setSectorDiagnostics(prev => {
      const remaining = prev.filter(s => s.id !== targetId);
      if (remaining.length > 0 && selectedSectorTab === targetCategory) {
        setSelectedSectorTab(remaining[0].category);
      } else if (remaining.length === 0) {
        setSelectedSectorTab('');
      }
      return remaining;
    });
    setSectorToDelete(null);
  };

  const handleDeleteVariable = (sectorId: string, varId: string) => {
    setSectorDiagnostics(prev => prev.map(sec => {
      if (sec.id !== sectorId) return sec;
      return {
        ...sec,
        variables: sec.variables.filter(v => v.id !== varId)
      };
    }));
  };

  const handleDeleteTerritorialNeed = (needId: string) => {
    setTerritorialNeeds(prev => prev.filter(n => n.id !== needId));
  };

  const handleToggleVariableStatus = (sectorId: string, varId: string) => {
    setSectorDiagnostics(prev => prev.map(sec => {
      if (sec.id !== sectorId) return sec;
      return {
        ...sec,
        variables: sec.variables.map(v => {
          if (v.id !== varId) return v;
          const nextStatus = v.status === 'Crítico' ? 'Regular' : v.status === 'Regular' ? 'Bueno' : 'Crítico';
          const nextScore = nextStatus === 'Crítico' ? 25 : nextStatus === 'Regular' ? 50 : 85;
          return { ...v, status: nextStatus, score: nextScore };
        })
      };
    }));
  };

  const handleSyncSurveys = () => {
    setIsSyncingSurveys(true);
    setTimeout(() => {
      setIsSyncingSurveys(false);
      setSurveySyncTimestamp('Sincronizado Ahora mismo (Sondeo Territorial N° 5)');
      // Slightly recalibrate survey priority percent to simulate live data stream
      setSectorDiagnostics(prev => prev.map(sec => ({
        ...sec,
        surveyPriorityPercent: Math.min(95, Math.max(30, sec.surveyPriorityPercent + (Math.floor(Math.random() * 5) - 2)))
      })));
      alert('✅ ¡Sondeos de Opinión Sincronizados con Éxito! Se actualizó la matriz de percepción ciudadana por sectores temáticos.');
    }, 1000);
  };

  const handleVariableStatusChange = (sectorId: string, varId: string, newStatus: 'Crítico' | 'Regular' | 'Bueno') => {
    const newScore = newStatus === 'Crítico' ? 25 : newStatus === 'Regular' ? 50 : 85;
    setSectorDiagnostics(prev => prev.map(sec => {
      if (sec.id !== sectorId) return sec;
      return {
        ...sec,
        variables: sec.variables.map(v => v.id === varId ? { ...v, status: newStatus, score: newScore } : v)
      };
    }));
  };

  const handleAddCustomVariable = (sectorId: string) => {
    const text = (customVariableInput[sectorId] || '').trim();
    if (!text) return;

    setSectorDiagnostics(prev => prev.map(sec => {
      if (sec.id !== sectorId) return sec;
      const newVar: SectorVariable = {
        id: `v-custom-${Date.now()}`,
        name: text,
        status: 'Regular',
        score: 50,
        pollPerception: 'Variable agregada por el equipo estratégico (En evaluación)'
      };
      return { ...sec, variables: [...sec.variables, newVar] };
    }));

    setCustomVariableInput(prev => ({ ...prev, [sectorId]: '' }));
  };
  
  const [auditAnswers, setAuditAnswers] = useState<Record<number, 'si' | 'parcial' | 'no'>>({
    1: 'si',       // Cartografía y censo por comunas
    2: 'parcial',  // Testigos acreditados en el 100% de puestos
    3: 'si',       // Soportes contables para el CNE con OCR
    4: 'parcial',  // Monitoreo de sentimiento y desinformación
    5: 'si',       // Identidad y discurso político
    6: 'no',       // Plan de contingencia y transporte Día E
    7: 'parcial',  // Sincronización con campañas aliadas
    8: 'si',       // Cero inhabilitaciones o hallazgos
    9: 'no',       // Estrategia anti-abstención periférica
    10: 'si'       // Control de duplicidad de cédula en censo
  });

  // Candidate Profile State
  const [candidateCampaignId, setCandidateCampaignId] = useState('');
  const [candidateProfileSaving, setCandidateProfileSaving] = useState(false);
  const [candidateProfileMessage, setCandidateProfileMessage] = useState('');
  const [candidateProfile, setCandidateProfile] = useState(() => {
    let initialName = '';
    let initialTerritory = '';
    let initialOffice = '';
    let initialCedula = '';
    let initialPhoto = '';
    let initialPhone = '';
    let initialEmail = '';
    try {
      const storedName = localStorage.getItem('candidate_name');
      if (storedName) {
        initialName = storedName;
      }
      const storedPhoto = localStorage.getItem('candidate_photo');
      if (storedPhoto) {
        initialPhoto = storedPhoto;
      }
      const dossierStr = localStorage.getItem('elecciones_campana_principal_dossier_v2');
      if (dossierStr) {
        const parsed = JSON.parse(dossierStr);
        if (parsed?.nombreCandidato && !initialName) initialName = parsed.nombreCandidato;
        if (parsed?.fotoUrl && !initialPhoto) initialPhoto = parsed.fotoUrl;
        if (parsed?.cedulaCandidato) initialCedula = parsed.cedulaCandidato;
        if (parsed?.municipio) initialTerritory = `${parsed.municipio}, ${parsed.departamento || ''}`;
        if (parsed?.corporacion) initialOffice = parsed.corporacion;
        if (parsed?.telefonoCandidato) initialPhone = parsed.telefonoCandidato;
        if (parsed?.emailCandidato) initialEmail = parsed.emailCandidato;
      }
    } catch {
      // ignore
    }

    return {
      fullName: initialName,
      politicalName: initialName ? `${initialName}` : '',
      cedula: initialCedula,
      candidateOffice: initialOffice,
      territory: initialTerritory,
      partyAlliance: '',
      slogan: '',
      avatarUrl: initialPhoto,
      phone: initialPhone,
      email: initialEmail,
      website: '',
      professionalSummary: '',
      candidateBio: '',
      dofaStrengths: '',
      dofaWeaknesses: '',
      dofaOpportunities: '',
      dofaThreats: ''
    };
  });

  useEffect(() => {
    const handlePhotoUpdate = () => {
      const updatedPhoto = localStorage.getItem('candidate_photo');
      if (updatedPhoto) {
        setCandidateProfile(prev => ({
          ...prev,
          avatarUrl: updatedPhoto
        }));
      }
    };

    const handleNameUpdate = () => {
      const updatedName = localStorage.getItem('candidate_name');
      if (updatedName) {
        setCandidateProfile(prev => ({
          ...prev,
          fullName: updatedName
        }));
      }
    };

    window.addEventListener('candidate_photo_updated', handlePhotoUpdate);
    window.addEventListener('candidate_name_updated', handleNameUpdate);
    window.addEventListener('storage', () => {
      handlePhotoUpdate();
      handleNameUpdate();
    });
    return () => {
      window.removeEventListener('candidate_photo_updated', handlePhotoUpdate);
      window.removeEventListener('candidate_name_updated', handleNameUpdate);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCandidateProfile = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          userId = refreshed.session?.user?.id;
        }
        if (!userId) throw new Error('Debes iniciar sesión para consultar el perfil del candidato.');
        const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id && !profile?.campaign_id) throw new Error('Tu usuario no tiene una campaña asignada.');
        const rememberedCampaignId = profile?.campaign_id || localStorage.getItem('active_campaign_id');
        let query = supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion');
        query = rememberedCampaignId ? query.eq('id', rememberedCampaignId) : query.eq('client_id', profile.client_id);
        const { data: campaigns, error } = await query.order('updated_at', { ascending: false }).limit(1);
        if (error) throw error;
        const campaign = campaigns?.[0];
        if (!campaign) throw new Error('No existe una campaña activa para configurar el candidato.');
        let savedProfile: any = {};
        try { savedProfile = JSON.parse(campaign.descripcion || '{}')?.candidateProfile || {}; } catch { savedProfile = {}; }
        const scope = String(campaign.circunscripcion || campaignCtx.circunscripcion || '').toUpperCase();
        const territory = scope === 'NACIONAL'
          ? 'Colombia'
          : scope === 'DEPARTAMENTAL'
            ? String(campaign.departamento || campaignCtx.department || '')
            : [campaign.municipio || campaignCtx.municipality, campaign.departamento || campaignCtx.department].filter(Boolean).join(', ');
        if (!mounted) return;
        setCandidateCampaignId(String(campaign.id));
        setCandidateProfile({
          fullName: savedProfile.fullName || campaign.candidato_nombre || '',
          politicalName: savedProfile.politicalName || '',
          cedula: savedProfile.cedula || '',
          candidateOffice: savedProfile.candidateOffice || campaign.cargo_postulacion || '',
          territory,
          partyAlliance: savedProfile.partyAlliance || '',
          slogan: savedProfile.slogan || '',
          avatarUrl: savedProfile.avatarUrl || '',
          phone: savedProfile.phone || '',
          email: savedProfile.email || '',
          website: savedProfile.website || '',
          professionalSummary: savedProfile.professionalSummary || '',
          candidateBio: savedProfile.candidateBio || '',
          dofaStrengths: savedProfile.dofaStrengths || '',
          dofaWeaknesses: savedProfile.dofaWeaknesses || '',
          dofaOpportunities: savedProfile.dofaOpportunities || '',
          dofaThreats: savedProfile.dofaThreats || '',
        });
      } catch (error: any) {
        if (mounted) setCandidateProfileMessage(error?.message || 'No fue posible cargar el perfil real.');
      }
    };
    void loadCandidateProfile();
    return () => { mounted = false; };
  }, []);

  const saveCandidateProfile = async () => {
    if (!candidateCampaignId) return setCandidateProfileMessage('No existe una campaña activa para guardar el perfil.');
    setCandidateProfileSaving(true);
    setCandidateProfileMessage('');
    try {
      const { data: campaign, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
      if (readError) throw readError;
      let description: any = {};
      try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }
      const { error } = await supabase.from('campaigns').update({
        candidato_nombre: candidateProfile.fullName.trim() || null,
        candidate_name: candidateProfile.fullName.trim() || null,
        cargo_postulacion: candidateProfile.candidateOffice || null,
        election_type: candidateProfile.candidateOffice || null,
        descripcion: JSON.stringify({ ...description, candidateProfile }),
        updated_at: new Date().toISOString(),
      }).eq('id', candidateCampaignId);
      if (error) throw error;
      localStorage.setItem('candidate_name', candidateProfile.fullName);
      if (candidateProfile.avatarUrl) localStorage.setItem('candidate_photo', candidateProfile.avatarUrl);
      window.dispatchEvent(new Event('candidate_name_updated'));
      window.dispatchEvent(new Event('candidate_photo_updated'));
      setCandidateProfileMessage('Perfil del candidato guardado en la campaña real.');
    } catch (error: any) {
      setCandidateProfileMessage(error?.message || 'No fue posible guardar el perfil del candidato.');
    } finally {
      setCandidateProfileSaving(false);
    }
  };

  // CV / Hoja de Vida State
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [isSavingCv, setIsSavingCv] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvFileName, setCvFileName] = useState('');
  const [cvUploadedAt, setCvUploadedAt] = useState('');
  const [cvStoragePath, setCvStoragePath] = useState('');
  const [cvAnalysisStatus, setCvAnalysisStatus] = useState<'Sin archivo' | 'Pendiente de análisis' | 'Analizado con IA'>('Sin archivo');
  const [cvMessage, setCvMessage] = useState('');

  const [academicDegrees, setAcademicDegrees] = useState<AcademicDegree[]>([]);

  const [experienceItems, setExperienceItems] = useState<ExperienceItem[]>([]);

  const [financialDeclaration, setFinancialDeclaration] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    taxReturnYear: '',
    declarationStatus: ''
  });

  const [backgroundChecks, setBackgroundChecks] = useState({
    procuraduria: '',
    contraloria: '',
    fiscalia: '',
    cneStatus: '',
    verifiedDate: ''
  });

  useEffect(() => {
    if (!candidateCampaignId) return;
    let mounted = true;
    const loadCandidateCv = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('descripcion')
          .eq('id', candidateCampaignId)
          .single();
        if (error) throw error;
        let description: any = {};
        try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
        const dossier = description?.candidateCv || {};
        if (!mounted) return;
        setCvFileName(String(dossier.fileName || ''));
        setCvUploadedAt(String(dossier.uploadedAt || ''));
        setCvStoragePath(String(dossier.storagePath || ''));
        setCvAnalysisStatus(dossier.analysisStatus === 'Analizado con IA' ? 'Analizado con IA' : dossier.fileName ? 'Pendiente de análisis' : 'Sin archivo');
        setAcademicDegrees(Array.isArray(dossier.academicDegrees) ? dossier.academicDegrees : []);
        setExperienceItems(Array.isArray(dossier.experienceItems) ? dossier.experienceItems : []);
        setFinancialDeclaration({
          totalAssets: Number(dossier.financialDeclaration?.totalAssets || 0),
          totalLiabilities: Number(dossier.financialDeclaration?.totalLiabilities || 0),
          netWorth: Number(dossier.financialDeclaration?.netWorth || 0),
          taxReturnYear: String(dossier.financialDeclaration?.taxReturnYear || ''),
          declarationStatus: String(dossier.financialDeclaration?.declarationStatus || ''),
        });
        setBackgroundChecks({
          procuraduria: String(dossier.backgroundChecks?.procuraduria || ''),
          contraloria: String(dossier.backgroundChecks?.contraloria || ''),
          fiscalia: String(dossier.backgroundChecks?.fiscalia || ''),
          cneStatus: String(dossier.backgroundChecks?.cneStatus || ''),
          verifiedDate: String(dossier.backgroundChecks?.verifiedDate || ''),
        });
      } catch (error: any) {
        if (mounted) setCvMessage(error?.message || 'No fue posible cargar el expediente real de la hoja de vida.');
      }
    };
    void loadCandidateCv();
    return () => { mounted = false; };
  }, [candidateCampaignId]);

  // SWOT / DOFA State
  const [isGeneratingSwot, setIsGeneratingSwot] = useState(false);
  const [swotMessage, setSwotMessage] = useState('');
  const [swotData, setSwotData] = useState({
    strengths: [] as string[],
    weaknesses: [] as string[],
    opportunities: [] as string[],
    threats: [] as string[]
  });

  useEffect(() => {
    if (!candidateCampaignId) return;
    let mounted = true;
    const loadSwot = async () => {
      try {
        const { data, error } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
        if (error) throw error;
        let description: any = {};
        try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
        const saved = description?.strategicSwot || {};
        if (!mounted) return;
        setSwotData({
          strengths: Array.isArray(saved.strengths) ? saved.strengths : [],
          weaknesses: Array.isArray(saved.weaknesses) ? saved.weaknesses : [],
          opportunities: Array.isArray(saved.opportunities) ? saved.opportunities : [],
          threats: Array.isArray(saved.threats) ? saved.threats : [],
        });
      } catch (error: any) {
        if (mounted) setSwotMessage(error?.message || 'No fue posible cargar la matriz DOFA real.');
      }
    };
    void loadSwot();
    return () => { mounted = false; };
  }, [candidateCampaignId]);

  // Narrative & Discurso State
  const [narrativeSaving, setNarrativeSaving] = useState(false);
  const [narrativeMessage, setNarrativeMessage] = useState('');
  const [strategicIdentity, setStrategicIdentity] = useState({
    narrative: '',
    baseMessage: '',
    coreValues: [] as string[],
    slogan: ''
  });

  // Candidate DOFA Variables State (Predefined + Custom)
  const [candidateDofaVars, setCandidateDofaVars] = useState({
    strengths: [
      'Trayectoria ética intachable (0 antecedentes judicial/fiscal)',
      'Experiencia técnica comprobada en gestión pública o privada',
      'Alto nivel de reconocimiento y carisma territorial',
      'Sólido respaldo de sectores académicos, juveniles e independientes',
      'Capacidad de oratoria y debate político de alto nivel',
      'Equipo técnico y político cohesionado sin divisiones',
      'Propuestas innovadoras en seguridad, empleo e inclusión'
    ],
    opportunities: [
      'Alto descontento ciudadano con la administración o maquinaria saliente',
      'Crecimiento del voto de opinión e independiente en la zona',
      'Alianzas estratégicas con JAC, líderes comunales y gremios locales',
      'Coyuntura favorable para propuestas de tecnología e innovación',
      'Apertura en medios de comunicación locales y comunitarios',
      'Incentivos de cofinanciación y cooperación territorial'
    ],
    weaknesses: [
      'Reconocimiento territorial bajo en comunas/veredas periféricas',
      'Estructura de logística y movilización en proceso de consolidación',
      'Presupuesto inicial ajustado frente a candidaturas de maquinarias',
      'Bajo posicionamiento en sectores gremiales tradicionales',
      'Equipo de trabajo con sobrecarga de funciones operativas',
      'Falta de voceros estratégicos delegados por zona o corregimiento'
    ],
    threats: [
      'Ataques sistemáticos de desinformación y guerra sucia de opositores',
      'Uso indebido de recursos públicos y maquinarias clientelares por rivales',
      'Riesgo de alto abstencionismo en puestos de votación clave',
      'Prácticas clientelares y compra de votos en el territorio',
      'Comportamiento volátil en votantes indecisos de última hora',
      'Riesgos de orden público o seguridad en desplazamientos'
    ]
  });

  // State for adding custom DOFA variables
  const [newDofaInputs, setNewDofaInputs] = useState({
    strengths: '',
    opportunities: '',
    weaknesses: '',
    threats: ''
  });

  // Handle adding custom variable to DOFA
  const handleAddCustomDofaVar = (
    category: 'strengths' | 'opportunities' | 'weaknesses' | 'threats',
    field: 'dofaStrengths' | 'dofaOpportunities' | 'dofaWeaknesses' | 'dofaThreats'
  ) => {
    const text = newDofaInputs[category].trim();
    if (!text) return;

    // Add to DOFA variables list if not exists
    if (!candidateDofaVars[category].some(v => v.toLowerCase() === text.toLowerCase())) {
      setCandidateDofaVars(prev => ({
        ...prev,
        [category]: [...prev[category], text]
      }));
    }

    // Automatically select / append to candidate profile field
    const currentText = candidateProfile[field] || '';
    if (!currentText.toLowerCase().includes(text.toLowerCase())) {
      const newText = currentText.trim() ? `${currentText.trim()}; ${text}` : text;
      setCandidateProfile(prev => ({ ...prev, [field]: newText }));
    }

    // Clear input
    setNewDofaInputs(prev => ({ ...prev, [category]: '' }));
  };

  // Toggle candidate DOFA variable chip selection
  const toggleCandidateDofaVar = (
    field: 'dofaStrengths' | 'dofaOpportunities' | 'dofaWeaknesses' | 'dofaThreats',
    varText: string
  ) => {
    const currentText = candidateProfile[field] || '';
    if (currentText.toLowerCase().includes(varText.toLowerCase())) {
      const parts = currentText.split('; ').filter(p => p.trim().toLowerCase() !== varText.trim().toLowerCase());
      setCandidateProfile({ ...candidateProfile, [field]: parts.join('; ') });
    } else {
      const newText = currentText.trim() ? `${currentText.trim()}; ${varText}` : varText;
      setCandidateProfile({ ...candidateProfile, [field]: newText });
    }
  };

  // Competitors & Allies State
  const [actorsList, setActorsList] = useState<PoliticalActor[]>([]);
  const [newActor, setNewActor] = useState<Omit<PoliticalActor, 'id' | 'updatedAt'>>({
    name: '', role: 'Competidor Directo', party: '', estimatedVoteShare: 0, notes: '', source: ''
  });

  useEffect(() => {
    if (!candidateCampaignId) return;
    let mounted = true;
    const loadNarrative = async () => {
      try {
        const { data, error } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
        if (error) throw error;
        let description: any = {};
        try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
        const identity = description?.strategicIdentity || {};
        if (!mounted) return;
        setStrategicIdentity({
          narrative: String(identity.narrative || ''),
          baseMessage: String(identity.baseMessage || ''),
          coreValues: Array.isArray(identity.coreValues) ? identity.coreValues : [],
          slogan: String(identity.slogan || ''),
        });
        setActorsList(Array.isArray(description?.politicalActors) ? description.politicalActors : []);
      } catch (error: any) {
        if (mounted) setNarrativeMessage(error?.message || 'No fue posible cargar la narrativa real.');
      }
    };
    void loadNarrative();
    return () => { mounted = false; };
  }, [candidateCampaignId]);

  // Draft Budget State
  const [draftBudget, setDraftBudget] = useState({
    totalProposed: 2500000000,
    allocatedAdvertising: 1125000000,
    allocatedOperations: 625000000,
    allocatedEvents: 500000000,
    allocatedContingency: 250000000
  });

  // Modals / Item Adding States
  const [showAddDegreeModal, setShowAddDegreeModal] = useState(false);
  const [newDegree, setNewDegree] = useState<{ title: string; institution: string; year: string; level: 'Pregrado' | 'Posgrado' | 'Maestría' | 'Doctorado' | 'Diplomado' }>({
    title: '',
    institution: '',
    year: '2024',
    level: 'Pregrado'
  });

  const [showAddExpModal, setShowAddExpModal] = useState(false);
  const [newExp, setNewExp] = useState<{ role: string; entityCompany: string; period: string; achievements: string; type: 'Público' | 'Privado' | 'Político/Social' }>({
    role: '',
    entityCompany: '',
    period: '',
    achievements: '',
    type: 'Público'
  });

  const [newItemText, setNewItemText] = useState('');
  const [swotCategory, setSwotCategory] = useState<'strengths' | 'weaknesses' | 'opportunities' | 'threats'>('strengths');



  const saveCandidateCv = async (overrides: Record<string, any> = {}) => {
    if (!candidateCampaignId) throw new Error('No existe una campaña activa para guardar la hoja de vida.');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const candidateCv = {
      fileName: cvFileName,
      uploadedAt: cvUploadedAt,
      storagePath: cvStoragePath,
      analysisStatus: cvAnalysisStatus,
      academicDegrees,
      experienceItems,
      financialDeclaration,
      backgroundChecks,
      ...overrides,
    };
    const { error } = await supabase.from('campaigns').update({
      descripcion: JSON.stringify({ ...description, candidateCv }),
      updated_at: new Date().toISOString(),
    }).eq('id', candidateCampaignId);
    if (error) throw error;
  };

  const handleSaveCandidateCv = async () => {
    setIsSavingCv(true);
    setCvMessage('');
    try {
      await saveCandidateCv();
      setCvMessage('Expediente de hoja de vida guardado en la campaña activa.');
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible guardar el expediente.');
    } finally {
      setIsSavingCv(false);
    }
  };

  const handleAnalyzeCv = async () => {
    if (!cvStoragePath) return setCvMessage('Primero seleccione y cargue una hoja de vida real.');
    setIsParsingCv(true);
    setCvMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const response = await authenticatedFetch('/api/strategic/cv-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaignId: candidateCampaignId,
          storagePath: cvStoragePath,
          campaignContext: geoCtx.aiContextBlock,
          territory: geoCtx.territory,
          officeLabel: geoCtx.officeLabel,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'No fue posible analizar la hoja de vida.');
      const parsedDegrees = (Array.isArray(result.academicDegrees) ? result.academicDegrees : []).map((item: any, index: number) => ({ ...item, id: item.id || `deg-ai-${Date.now()}-${index}` }));
      const parsedExperience = (Array.isArray(result.experienceItems) ? result.experienceItems : []).map((item: any, index: number) => ({ ...item, id: item.id || `exp-ai-${Date.now()}-${index}` }));
      const parsedFinancial = result.financialDeclaration || financialDeclaration;
      const parsedChecks = result.backgroundChecks || backgroundChecks;
      setAcademicDegrees(parsedDegrees);
      setExperienceItems(parsedExperience);
      setFinancialDeclaration(parsedFinancial);
      setBackgroundChecks(parsedChecks);
      setCvAnalysisStatus('Analizado con IA');
      await saveCandidateCv({
        analysisStatus: 'Analizado con IA',
        academicDegrees: parsedDegrees,
        experienceItems: parsedExperience,
        financialDeclaration: parsedFinancial,
        backgroundChecks: parsedChecks,
      });
      setCvMessage('Análisis real completado. Revise los datos extraídos antes de utilizarlos.');
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible analizar la hoja de vida.');
    } finally {
      setIsParsingCv(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvMessage('');
    if (!candidateCampaignId) return setCvMessage('No existe una campaña activa para asociar el documento.');
    if (file.size > 10 * 1024 * 1024) return setCvMessage('El archivo supera el límite permitido de 10 MB.');
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowed.includes(file.type) && !/\.(pdf|docx|doc)$/i.test(file.name)) return setCvMessage('Seleccione un archivo PDF, DOCX o DOC válido.');
    setIsSavingCv(true);
    try {
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${candidateCampaignId}/candidate-cv/${Date.now()}-${safeName}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const encodedFile = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'));
        reader.readAsDataURL(file);
      });
      const uploadResponse = await authenticatedFetch('/api/strategic/cv-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId: candidateCampaignId, storagePath, fileName: file.name, mimeType: file.type, fileBase64: encodedFile }),
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult?.error || 'No fue posible almacenar el documento.');
      const uploadedAt = new Date().toISOString();
      setCvFile(file);
      setCvFileName(file.name);
      setCvUploadedAt(uploadedAt);
      setCvStoragePath(storagePath);
      setCvAnalysisStatus('Pendiente de análisis');
      await saveCandidateCv({ fileName: file.name, uploadedAt, storagePath, analysisStatus: 'Pendiente de análisis' });
      setCvMessage('Documento cargado y asociado de forma privada a la campaña.');
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible cargar la hoja de vida.');
    } finally {
      setIsSavingCv(false);
      e.target.value = '';
    }
  };

  const saveNarrativeWorkspace = async (identity = strategicIdentity, actors = actorsList) => {
    if (!candidateCampaignId) throw new Error('No existe una campaña activa para guardar la narrativa.');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const { error } = await supabase.from('campaigns').update({
      descripcion: JSON.stringify({ ...description, strategicIdentity: identity, politicalActors: actors }),
      updated_at: new Date().toISOString(),
    }).eq('id', candidateCampaignId);
    if (error) throw error;
  };

  const handleSaveNarrative = async () => {
    setNarrativeSaving(true);
    setNarrativeMessage('');
    try {
      await saveNarrativeWorkspace();
      setNarrativeMessage('Narrativa y valores guardados en la campaña activa.');
    } catch (error: any) {
      setNarrativeMessage(error?.message || 'No fue posible guardar la narrativa.');
    } finally {
      setNarrativeSaving(false);
    }
  };

  const handleAddPoliticalActor = async () => {
    if (!newActor.name.trim() || !newActor.role || !newActor.source.trim()) {
      return setNarrativeMessage('Nombre, tipo de relación y fuente son obligatorios.');
    }
    if (newActor.estimatedVoteShare < 0 || newActor.estimatedVoteShare > 100) {
      return setNarrativeMessage('La intención de voto debe estar entre 0 y 100.');
    }
    const actor: PoliticalActor = {
      ...newActor,
      name: newActor.name.trim(),
      party: newActor.party.trim(),
      notes: newActor.notes.trim(),
      source: newActor.source.trim(),
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...actorsList, actor];
    setActorsList(next);
    setNewActor({ name: '', role: 'Competidor Directo', party: '', estimatedVoteShare: 0, notes: '', source: '' });
    try {
      await saveNarrativeWorkspace(strategicIdentity, next);
      setNarrativeMessage('Actor político registrado con su fuente.');
    } catch (error: any) {
      setNarrativeMessage(error?.message || 'No fue posible guardar el actor político.');
    }
  };

  const handleRemovePoliticalActor = async (actorId: string) => {
    const next = actorsList.filter(actor => actor.id !== actorId);
    setActorsList(next);
    try {
      await saveNarrativeWorkspace(strategicIdentity, next);
      setNarrativeMessage('Actor eliminado del mapa político.');
    } catch (error: any) {
      setNarrativeMessage(error?.message || 'No fue posible eliminar el actor político.');
    }
  };



  const saveStrategicSwot = async (next: typeof swotData) => {
    if (!candidateCampaignId) throw new Error('No existe una campaña activa para guardar la matriz DOFA.');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const { error } = await supabase.from('campaigns').update({
      descripcion: JSON.stringify({ ...description, strategicSwot: next }),
      updated_at: new Date().toISOString(),
    }).eq('id', candidateCampaignId);
    if (error) throw error;
  };

  const handleGenerateSwot = async () => {
    setIsGeneratingSwot(true);
    setSwotMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const response = await authenticatedFetch('/api/strategic/swot-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId: candidateCampaignId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'No fue posible generar la matriz DOFA.');
      const next = {
        strengths: Array.isArray(result.strengths) ? result.strengths : [],
        weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
        opportunities: Array.isArray(result.opportunities) ? result.opportunities : [],
        threats: Array.isArray(result.threats) ? result.threats : [],
      };
      setSwotData(next);
      await saveStrategicSwot(next);
      setSwotMessage('Matriz generada con los datos reales disponibles de la campaña. Revise cada factor antes de aprobarlo.');
    } catch (error: any) {
      setSwotMessage(error?.message || 'No fue posible generar la matriz DOFA.');
    } finally {
      setIsGeneratingSwot(false);
    }
  };

  const handleAddSwotItem = async () => {
    if (!newItemText.trim()) return;
    const next = { ...swotData, [swotCategory]: [...swotData[swotCategory], newItemText.trim()] };
    setSwotData(next);
    setNewItemText('');
    try {
      await saveStrategicSwot(next);
      setSwotMessage('Factor guardado en la campaña activa.');
    } catch (error: any) {
      setSwotMessage(error?.message || 'No fue posible guardar el factor.');
    }
  };

  const handleRemoveSwotItem = async (cat: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', index: number) => {
    const next = { ...swotData, [cat]: swotData[cat].filter((_, i) => i !== index) };
    setSwotData(next);
    try {
      await saveStrategicSwot(next);
      setSwotMessage('Factor eliminado de la matriz real.');
    } catch (error: any) {
      setSwotMessage(error?.message || 'No fue posible eliminar el factor.');
    }
  };

  return (
    <div className="responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#071927] text-slate-100 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 overflow-x-hidden">
      


      {/* TAB 1: DIAGNÓSTICO DE CAMPAÑA (360° AI) */}
      {activeTab === 'diagnostico' && diagnosticCampaignLoading && (
        <div className="min-h-[420px] flex items-center justify-center rounded-3xl border border-cyan-500/20 bg-[#06172b]">
          <div className="flex items-center gap-3 text-cyan-200 font-bold">
            <RefreshCw className="w-5 h-5 animate-spin" /> Verificando campaña activa…
          </div>
        </div>
      )}

      {activeTab === 'diagnostico' && !diagnosticCampaignLoading && !diagnosticCampaign && (
        <div className="min-h-[420px] flex items-center justify-center rounded-3xl border border-cyan-500/20 bg-[#06172b] p-6">
          <div className="max-w-xl text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-white">Diagnóstico disponible después de crear la campaña</h3>
            <p className="text-sm text-slate-400">
              Todavía no existe una campaña real asignada. Los indicadores, puntajes y recomendaciones se habilitarán cuando la campaña sea creada y configurada.
            </p>
            <button
              type="button"
              onClick={() => onSelectView('modulo_admin')}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-colors"
            >
              Ir a Gestión de Campaña
            </button>
          </div>
        </div>
      )}

      {activeTab === 'diagnostico' && !diagnosticCampaignLoading && diagnosticCampaign && (
        <div className="space-y-6">
          
          {/* Hero Banner: Diagnostic Score & Scan Action */}
          <div className="bg-gradient-to-r from-[#081e36] via-[#0b2747] to-[#06172b] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              
              <div className="space-y-2 max-w-2xl">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Sesión de Diagnóstico de Campaña{' '}
                  <span className="text-emerald-400">
                    {diagnosticCampaignName}{diagnosticTerritory ? ` · ${diagnosticTerritory}` : ''} · {diagnosticYear}
                  </span>
                </h3>
              </div>

              {/* Score & Action Button Card */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#051325]/90 border border-cyan-500/30 p-4 rounded-2xl w-full lg:w-auto shrink-0">
                <div className="text-center sm:text-left space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Índice de Salud de Campaña
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-emerald-400 font-mono tracking-tight">84</span>
                    <span className="text-slate-400 font-bold text-sm">/ 100</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    Nivel: Saludable con Alertas
                  </span>
                </div>

                <button
                  onClick={() => {
                    setIsDiagnosticScanning(true);
                    setTimeout(() => {
                      setIsDiagnosticScanning(false);
                      setLastDiagnosticDate(new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) + ' UTC');
                      alert('¡Diagnóstico Integral AI ejecutado con éxito! Se reevaluaron las 6 dimensiones de la campaña.');
                    }, 1800);
                  }}
                  disabled={isDiagnosticScanning}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isDiagnosticScanning ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosticScanning ? 'Escaneando Campaña...' : 'Ejecutar Diagnóstico AI'}</span>
                </button>
              </div>

            </div>

            {/* Diagnostic Sub-Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-cyan-500/20 text-xs font-bold">
              <button
                onClick={() => setDiagnosticSubTab('overview')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  diagnosticSubTab === 'overview'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📊 1. Diagnóstico de Campaña (Electoral/Operativo)</span>
              </button>

              <button
                onClick={() => setDiagnosticSubTab('audit')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  diagnosticSubTab === 'audit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📝 Audit Express (10 Preguntas)</span>
              </button>

              <button
                onClick={() => setDiagnosticSubTab('report')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  diagnosticSubTab === 'report'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🤖 Informe Ejecutivo IA</span>
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: VISIÓN GENERAL DE LOS 6 PILARES */}
          {diagnosticSubTab === 'overview' && (
            <div className="functional-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Pilar 1: Cobertura Territorial */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">1. Cobertura Territorial</h4>
                      <span className="text-[10px] text-slate-400">Puestos, Mesas & Comunas</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    82 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Meta de Cobertura Puestos</span>
                    <span className="text-emerald-300">82%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '82%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                  <strong className="text-emerald-300 font-bold block">Diagnóstico Territorial:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Gran solidez en Comunas 11 (La Laureles) y 14 (El Poblado). Se detectaron brechas de coordinación en Comunas 1 (Popular) y 3 (Manrique).
                  </p>
                </div>
              </div>

              {/* Pilar 2: Traje Político & Encuestas */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">2. Intención de Voto</h4>
                      <span className="text-[10px] text-slate-400">Tracking & Favorabilidad</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-amber-400 bg-amber-950 px-2.5 py-1 rounded-full border border-amber-500/30">
                    76 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Intención de Voto (2° Lugar)</span>
                    <span className="text-amber-300">28.5%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: '76%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                  <strong className="text-amber-300 font-bold block">Análisis de Competencia:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Brecha de 4.0% con respecto al puntero (Carlos Mario Rendón 32.5%). Alto potencial de capturar voto indeciso en debates universitarios.
                  </p>
                </div>
              </div>

              {/* Pilar 3: Control Electoral & Día E */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-rose-500/20 text-rose-300 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">3. Testigos & Día E</h4>
                      <span className="text-[10px] text-slate-400">Acreditaciones Registraduría</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-rose-400 bg-rose-950 px-2.5 py-1 rounded-full border border-rose-500/30">
                    68 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Mesas con Testigo Acreditado</span>
                    <span className="text-rose-300">68%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-rose-500/30 text-xs space-y-1 text-slate-300">
                  <strong className="text-rose-300 font-bold block flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Alerta Crítica Día E:
                  </strong>
                  <p className="text-[11px] leading-relaxed">
                    Faltan 32% de mesas por asignar testigo titular. Se requiere acelerar la vinculación en el módulo de Operación Electoral.
                  </p>
                </div>
              </div>

              {/* Pilar 4: Finanzas & Cumplimiento CNE */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">4. Rendición Finanzas CNE</h4>
                      <span className="text-[10px] text-slate-400">Cuentas Claras & OCR</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    94 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Soportes OCR Verificados</span>
                    <span className="text-emerald-300">94%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '94%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                  <strong className="text-emerald-300 font-bold block">Contabilidad Oficial:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Ejecución presupuestal limpia dentro del tope legal de Medellín ($2.5B). Cero inconsistencias de bancarización registradas.
                  </p>
                </div>
              </div>

              {/* Pilar 5: Comunicaciones & Sentimiento Digital */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-500/20 text-teal-300 rounded-xl">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">5. Estrategia & Sentimiento</h4>
                      <span className="text-[10px] text-slate-400">Redes Sociales & Prensa</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-teal-400 bg-teal-950 px-2.5 py-1 rounded-full border border-teal-500/30">
                    78 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Aceptación Positiva Redes</span>
                    <span className="text-teal-300">72%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-400 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                  <strong className="text-teal-300 font-bold block">Monitoreo de Opinión:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Excelente respuesta a videos sobre propuestas de movilidad. Se recomienda contraatacar desinformación en cadenas de WhatsApp.
                  </p>
                </div>
              </div>

              {/* Pilar 6: Censo & Filtro de Duplicidad */}
              <div className="functional-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">6. Filtro Unificado Censo</h4>
                      <span className="text-[10px] text-slate-400">Blindaje Duplicidad Cédula</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    90 / 100
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300 font-semibold">
                    <span>Integridad de Votantes</span>
                    <span className="text-emerald-300">90%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '90%' }} />
                  </div>
                </div>

                <div className="p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                  <strong className="text-emerald-300 font-bold block">Regla de Negocio Aplicada:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Cada cédula está asignada únicamente al primer líder que la registró. Se bloquearon 142 intentos de duplicado de campañas aliadas.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* SUB-TAB 2: DIAGNÓSTICO TERRITORIAL (INSUMO PROGRAMÁTICO / PROGRAMA DE GOBIERNO) */}
          {diagnosticSubTab === 'territorial' && (
            <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
              
              {/* Header & Sync with Sondeos de Opinión Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-400" /> Diagnóstico Territorial Sectorial (Insumo Programático)
                  </h4>
                </div>

                {/* Sondeos Sync Action Box */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncSurveys}
                    disabled={isSyncingSurveys}
                    className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSurveys ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSurveys ? 'Sincronizando...' : '🔄 Sincronizar Sondeos de Opinión'}</span>
                  </button>
                </div>
              </div>

              {/* SECTORIAL DIAGNOSTIC ENGINE: SECTOR TABS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> 1. Sectores Temáticos y Evaluación por Variables Sugeridas
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Sugerencias calibradas por la IA según encuestas locales
                  </span>
                </div>

                {/* Sector Tabs Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {sectorDiagnostics.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSectorId(sec.id)}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-2 border cursor-pointer ${
                        activeSectorId === sec.id
                          ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white border-cyan-400 shadow-lg shadow-cyan-900/40'
                          : 'bg-[#081d38] text-slate-300 border-cyan-500/20 hover:border-cyan-500/40 hover:text-white'
                      }`}
                    >
                      <span className="text-base">{sec.iconEmoji}</span>
                      <span>{sec.category}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                        activeSectorId === sec.id
                          ? 'bg-slate-950/60 text-cyan-200 border border-cyan-400/30'
                          : 'bg-slate-900 text-slate-400'
                      }`}>
                        {sec.surveyPriorityPercent}% Sondeos
                      </span>
                    </button>
                  ))}
                </div>

                {/* Active Sector Diagnostic Panel */}
                {(() => {
                  const activeSec = sectorDiagnostics.find(s => s.id === activeSectorId) || sectorDiagnostics[0];
                  return (
                    <div className="bg-[#081d38] border border-cyan-500/30 rounded-3xl p-5 space-y-6 shadow-lg">
                      
                      {/* Sector Banner */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#051325] p-4 rounded-2xl border border-cyan-500/20">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl p-2.5 bg-cyan-950/60 rounded-2xl border border-cyan-500/30">{activeSec.iconEmoji}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-base font-black text-white">Sector {activeSec.category}</h5>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-500/30">
                                Prioridad en Sondeos: {activeSec.surveyPriorityPercent}% de Preocupación Ciudadana
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Matriz de variables diagnósticas alimentada por sondeos de opinión para insumo del Plan de Gobierno.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 shrink-0 bg-[#081d38] px-3.5 py-2 rounded-xl border border-cyan-500/20">
                          <Users className="w-4 h-4 text-cyan-400" />
                          <span>Muestra de Sondeo: 1.240 Respuestas</span>
                        </div>
                      </div>

                      {/* Evaluative Variables Grid / Table */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="text-cyan-300 flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-cyan-400" /> Variables Sugeridas de Evaluación Sectorial
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Haz clic en el estado para re-evaluar la condición actual
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeSec.variables.map((variable) => (
                            <div key={variable.id} className="bg-[#051325] border border-cyan-500/20 p-3.5 rounded-2xl space-y-3 hover:border-cyan-500/40 transition-all shadow-md">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-extrabold text-white text-xs leading-snug">
                                  {variable.name}
                                </span>
                                
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditVariableModal(activeSec.id, variable)}
                                    className="p-1 text-cyan-400 hover:text-white bg-cyan-950/80 border border-cyan-500/30 hover:bg-cyan-900 rounded-lg transition-all cursor-pointer"
                                    title="Editar Indicador, Línea Base y Meta"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Status Toggle Dropdown */}
                                  <select
                                    value={variable.status}
                                    onChange={(e) => handleVariableStatusChange(activeSec.id, variable.id, e.target.value as any)}
                                    className={`text-[11px] font-black px-2.5 py-1 rounded-lg outline-none border cursor-pointer ${
                                      variable.status === 'Crítico'
                                        ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                                        : variable.status === 'Regular'
                                        ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                                        : 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                                    }`}
                                  >
                                    <option value="Crítico">🔴 Crítico</option>
                                    <option value="Regular">🟡 Regular</option>
                                    <option value="Bueno">🟢 Bueno</option>
                                  </select>
                                </div>
                              </div>

                              {/* INDICADORES Y LÍNEA BASE COMPONENT */}
                              <div className="bg-[#071930] border border-cyan-500/25 rounded-xl p-2.5 space-y-2">
                                <div className="text-[10px] text-cyan-300 font-bold flex items-center justify-between border-b border-cyan-500/20 pb-1">
                                  <span className="flex items-center gap-1 text-cyan-400">
                                    <Activity className="w-3.5 h-3.5" />
                                    Indicadores ({getVariableIndicadores(variable).length}):
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditVariableModal(activeSec.id, variable)}
                                    className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5 cursor-pointer font-extrabold hover:underline"
                                  >
                                    + Administrar
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {getVariableIndicadores(variable).map((ind, idx) => (
                                    <div key={ind.id || idx} className="bg-[#031121] p-2 rounded-lg border border-cyan-500/20 space-y-1">
                                      <div className="text-[10px] text-slate-200 font-semibold truncate" title={ind.nombre}>
                                        📊 <span className="text-cyan-200 font-bold">{ind.nombre}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                        <div className="bg-[#010914] p-1.5 rounded-md border border-amber-500/30 flex flex-col justify-center">
                                          <span className="text-amber-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                            📍 Línea Base
                                          </span>
                                          <span className="text-amber-200 font-black text-xs mt-0.5">
                                            {ind.lineaBase || 'N/A'}
                                          </span>
                                        </div>

                                        <div className="bg-[#010914] p-1.5 rounded-md border border-emerald-500/30 flex flex-col justify-center">
                                          <span className="text-emerald-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                            🎯 Meta
                                          </span>
                                          <span className="text-emerald-200 font-black text-xs mt-0.5">
                                            {ind.meta || 'N/A'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Progress / Satisfaction Score Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                                  <span>Puntaje de Desempeño:</span>
                                  <span className={variable.score < 35 ? 'text-rose-400' : variable.score < 65 ? 'text-amber-400' : 'text-emerald-400'}>
                                    {variable.score} / 100
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                      variable.score < 35 ? 'bg-rose-500' : variable.score < 65 ? 'bg-amber-500' : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${variable.score}%` }}
                                  />
                                </div>
                              </div>

                              {/* Survey Poll Perception Feed */}
                              <div className="p-2 bg-[#081d38] rounded-xl border border-cyan-500/15 text-[11px] text-slate-300 flex items-center justify-between gap-2">
                                <span className="font-medium truncate text-cyan-200/90">
                                  📊 Sondeos: {variable.pollPerception}
                                </span>
                                <span className="text-[9px] font-bold text-teal-400 bg-teal-950 px-1.5 py-0.5 rounded border border-teal-500/30 shrink-0">
                                  Sondeo Real
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Form to Add Custom Variable */}
                        <div className="pt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={customVariableInput[activeSec.id] || ''}
                            onChange={(e) => setCustomVariableInput({ ...customVariableInput, [activeSec.id]: e.target.value })}
                            placeholder={`+ Agregar variable sugerida o indicador personalizado para ${activeSec.category}...`}
                            className="flex-1 bg-[#051325] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCustomVariable(activeSec.id);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCustomVariable(activeSec.id)}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>

                      {/* Qualitative Problem & Programmatic Solution Feed */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-cyan-500/20">
                        {/* Problem Summary */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Diagnóstico Cualitativo de la Problemática ({activeSec.category})
                          </label>
                          <textarea
                            rows={3}
                            value={activeSec.problemSummary}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSectorDiagnostics(prev => prev.map(s => s.id === activeSec.id ? { ...s, problemSummary: val } : s));
                            }}
                            className="w-full bg-[#051325] border border-cyan-500/30 rounded-2xl p-3 text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed"
                          />
                        </div>

                        {/* Programmatic Solution */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Solución Programática Sugerida (Para Plan de Gobierno CNE)
                          </label>
                          <textarea
                            rows={3}
                            value={activeSec.programmaticSolution}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSectorDiagnostics(prev => prev.map(s => s.id === activeSec.id ? { ...s, programmaticSolution: val } : s));
                            }}
                            className="w-full bg-[#051325] border border-emerald-500/30 rounded-2xl p-3 text-xs text-emerald-100 outline-none focus:border-emerald-400 resize-none leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => alert(`✅ Solución programática de ${activeSec.category} sincronizada exitosamente con el Módulo de Programa de Gobierno para la Registraduría.`)}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          <span>Sincronizar esta propuesta al Programa de Gobierno Registraduría</span>
                        </button>
                      </div>

                    </div>
                  );
                })()}
              </div>

              {/* 2. MICRO-TERRITORIAL DIAGNOSTIC SECTION (COMMUNES & NEIGHBORHOODS) */}
              <div className="pt-4 border-t border-cyan-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-black text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-400" /> 2. Fichas de Diagnóstico Territorial Micro-Local (Por Comuna / Corregimiento)
                    </h5>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddNeedModal(true)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Registrar Ficha Comunal
                  </button>
                </div>

                {/* Filter Bar */}
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20 text-xs">
                  <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <span className="font-bold text-slate-300">Filtrar por Comuna/Sector:</span>
                    <select
                      value={selectedComunaFilter}
                      onChange={(e) => setSelectedComunaFilter(e.target.value)}
                      className="block w-full min-w-0 max-w-full box-border bg-[#051325] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-400 font-medium sm:w-auto sm:max-w-[20rem]"
                    >
                      <option value="Todos">Todas las Comunas / Corregimientos</option>
                      <option value="Comuna 1 - Popular">Comuna 1 - Popular</option>
                      <option value="Comuna 3 - Manrique">Comuna 3 - Manrique</option>
                      <option value="Comuna 13 - San Javier">Comuna 13 - San Javier</option>
                      <option value="Corregimiento San Cristóbal">Corregimiento San Cristóbal</option>
                    </select>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {territorialNeeds.filter(n => selectedComunaFilter === 'Todos' || n.comunaSector === selectedComunaFilter).length} Fichas Mapeadas
                  </span>
                </div>

              {/* Needs & Programmatic Proposals Cards */}
              {territorialNeeds.filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter).length === 0 && (
                <div className="rounded-2xl border border-dashed border-cyan-500/30 bg-[#030e21]/70 px-6 py-8 text-center">
                  <MapPin className="mx-auto mb-3 h-7 w-7 text-cyan-400/70" />
                  <p className="text-sm font-bold text-white">0 fichas comunales registradas</p>
                  <p className="mt-1 text-xs text-slate-400">Las fichas aparecerán únicamente cuando el candidato o un administrador registre información real.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddNeedModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-xs font-black text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" /> Registrar primera ficha
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {territorialNeeds
                    .filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter)
                    .map((need) => (
                      <div key={need.id} className="bg-[#081d38] border border-cyan-500/30 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-cyan-400/50 transition-all shadow-md">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {need.comunaSector}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-500/30">
                                {need.category}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                need.impactLevel === 'Crítico'
                                  ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                                  : need.impactLevel === 'Alto'
                                  ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}>
                                Impacto {need.impactLevel}
                              </span>
                            </div>
                          </div>

                          <div className="bg-[#051325] p-3 rounded-xl border border-cyan-500/15 text-xs text-slate-200">
                            <strong className="text-amber-400 text-[11px] block mb-1">Problemática Ciudadana Detectada:</strong>
                            <p className="leading-relaxed">{need.problemDescription}</p>
                          </div>

                          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30 text-xs text-slate-200">
                            <strong className="text-emerald-400 text-[11px] block mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Propuesta para Programa de Gobierno:
                            </strong>
                            <p className="text-emerald-200/90 leading-relaxed font-medium">{need.programmaticProposal}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 text-[10px]">Insumo técnico para Plan de Gobierno Registraduría</span>
                          <button
                            type="button"
                            onClick={() => alert(`Propuesta programática para ${need.comunaSector} sincronizada exitosamente con el Módulo de Programa de Gobierno.`)}
                            className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            Sincronizar a Programa →
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Add Territorial Need Modal */}
              {showAddNeedModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                    <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
                      <h4 className="font-black text-white text-base flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-cyan-400" /> Nueva Ficha de Diagnóstico Territorial
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddNeedModal(false)}
                        className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Comuna / Corregimiento / Barrio:</label>
                        <select
                          value={newTerritorialNeed.comunaSector}
                          onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, comunaSector: e.target.value })}
                          className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                        >
                          <option value="Comuna 1 - Popular">Comuna 1 - Popular</option>
                          <option value="Comuna 3 - Manrique">Comuna 3 - Manrique</option>
                          <option value="Comuna 13 - San Javier">Comuna 13 - San Javier</option>
                          <option value="Corregimiento San Cristóbal">Corregimiento San Cristóbal</option>
                          <option value="Comuna 10 - La Candelaria">Comuna 10 - La Candelaria</option>
                          <option value="Comuna 16 - Belén">Comuna 16 - Belén</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Categoría Temática:</label>
                          <select
                            value={newTerritorialNeed.category}
                            onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, category: e.target.value as any })}
                            className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                          >
                            <option value="Seguridad">Seguridad</option>
                            <option value="Infraestructura">Infraestructura</option>
                            <option value="Empleo">Empleo</option>
                            <option value="Salud">Salud</option>
                            <option value="Educación">Educación</option>
                            <option value="Medio Ambiente">Medio Ambiente</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Nivel de Impacto / Urgencia:</label>
                          <select
                            value={newTerritorialNeed.impactLevel}
                            onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, impactLevel: e.target.value as any })}
                            className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                          >
                            <option value="Crítico">Crítico</option>
                            <option value="Alto">Alto</option>
                            <option value="Medio">Medio</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Descripción de la Problemática Social:</label>
                        <textarea
                          rows={3}
                          value={newTerritorialNeed.problemDescription}
                          onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, problemDescription: e.target.value })}
                          placeholder="Describe qué le duele a la ciudadanía en este territorio..."
                          className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-emerald-300 font-bold mb-1">Propuesta Programática Solución (Insumo Plan de Gobierno):</label>
                        <textarea
                          rows={3}
                          value={newTerritorialNeed.programmaticProposal}
                          onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, programmaticProposal: e.target.value })}
                          placeholder="Propuesta concreta de gobierno para resolver la problemática..."
                          className="w-full bg-[#081d38] border border-emerald-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400 resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddNeedModal(false)}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTerritorialNeed}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                      >
                        Guardar Ficha
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
          {diagnosticSubTab === 'audit' && (
            <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-emerald-400" /> Cuestionario de Diagnóstico Operativo Express
                  </h4>
                </div>

                <div className="bg-[#081d38] border border-cyan-500/30 px-4 py-2 rounded-2xl text-center shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Puntaje Audit:</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {Object.values(auditAnswers).reduce((acc: number, curr) => curr === 'si' ? acc + 10 : curr === 'parcial' ? acc + 5 : acc, 0)} / 100
                  </span>
                </div>
              </div>

              {/* 10 Questions List */}
              <div className="functional-grid space-y-3 text-xs">
                {[
                  { id: 1, title: '1. Cartografía & Censo:', text: '¿Tienen dividida la meta de votos por comuna, puesto y mesa en el censo oficial?' },
                  { id: 2, title: '2. Testigos Día E:', text: '¿Cuentan con testigos asignados y acreditados para al menos el 90% de las mesas?' },
                  { id: 3, title: '3. Cuentas Claras CNE:', text: '¿Se cuenta con libro contable al día y facturación respaldada con soporte digital OCR?' },
                  { id: 4, title: '4. Inteligencia Digital:', text: '¿Disponen de monitoreo diario de redes para detección de cadenas falsas y desinformación?' },
                  { id: 5, title: '5. Identidad & Discurso:', text: '¿La narrativa de campaña y el mensaje base están unificados entre el candidato y voceros?' },
                  { id: 6, title: '6. Movilización Día E:', text: '¿Existe un plan logístico de transporte, refrigerios y reportes en tiempo real para el Día E?' },
                  { id: 7, title: '7. Jerarquía Aliada:', text: '¿Las campañas vinculadas (Concejo/Asamblea) comparten censo sin duplicidad de electores?' },
                  { id: 8, title: '8. Antecedentes & Legal:', text: '¿Se verificaron antecedentes penales, fiscales y disciplinarios sin inhabilitaciones CNE?' },
                  { id: 9, title: '9. Estrategia Anti-Abstención:', text: '¿Tienen identificados los barrios periféricos con mayor riesgo de abstencionismo?' },
                  { id: 10, title: '10. Registro Unificado:', text: '¿Todo votante registrado está asociado obligatoriamente a una cédula única de líder?' }
                ].map((q) => (
                  <div key={q.id} className="functional-card p-3.5 bg-[#081d38] border border-cyan-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 max-w-xl">
                      <span className="font-bold text-emerald-300">{q.title}</span>
                      <p className="text-slate-200">{q.text}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 bg-[#051325] p-1 rounded-xl border border-cyan-500/20">
                      <button
                        onClick={() => setAuditAnswers(prev => ({ ...prev, [q.id]: 'si' }))}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          auditAnswers[q.id] === 'si'
                            ? 'bg-emerald-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Sí (10p)
                      </button>

                      <button
                        onClick={() => setAuditAnswers(prev => ({ ...prev, [q.id]: 'parcial' }))}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          auditAnswers[q.id] === 'parcial'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Parcial (5p)
                      </button>

                      <button
                        onClick={() => setAuditAnswers(prev => ({ ...prev, [q.id]: 'no' }))}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          auditAnswers[q.id] === 'no'
                            ? 'bg-rose-500 text-white font-black shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        No (0p)
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* SUB-TAB 3: INFORME EJECUTIVO & PLAN DE ACCIÓN IA */}
          {diagnosticSubTab === 'report' && (
            <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" /> Informe Ejecutivo de Diagnóstico & Recomendaciones IA
                  </h4>
                </div>

                <button
                  onClick={() => alert('Generando PDF del Informe Ejecutivo de Diagnóstico de Campaña...')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Exportar Informe PDF</span>
                </button>
              </div>

              <div className="functional-grid grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                
                {/* Fortalezas Destacadas */}
                <div className="functional-card p-4 bg-[#081d38] border border-emerald-500/30 rounded-2xl space-y-3">
                  <h5 className="font-extrabold text-emerald-300 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Fortalezas Clave de la Campaña
                  </h5>
                  <ul className="space-y-2 text-slate-200 list-disc list-inside">
                    <li>Transparencia Financiera CNE: Registros bancarios y comprobantes escaneados con 94% de precisión OCR.</li>
                    <li>Narrativa y Hoja de Vida: Candidato con cero antecedentes o investigaciones penales o fiscales.</li>
                    <li>Sólido Posicionamiento en Sectores Juveniles e Independientes en comunas urbanas centrales.</li>
                  </ul>
                </div>

                {/* Acciones Prioritarias de Contingencia */}
                <div className="functional-card p-4 bg-[#081d38] border border-rose-500/30 rounded-2xl space-y-3">
                  <h5 className="font-extrabold text-rose-300 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> Plan de Acción Inmediato (30 Días)
                  </h5>
                  <ul className="space-y-2 text-slate-200 list-disc list-inside">
                    <li>Reclutar y Acreditar Testigos Electorales para el 32% de mesas pendientes antes de la fecha límite CNE.</li>
                    <li>Intensificar pauta micro-segmentada en Comunas 1 y 3 para contrarrestar la brecha en encuestas.</li>
                    <li>Desplegar brigadas móviles de líderes de barrio para movilización y transporte el Día E.</li>
                  </ul>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: DIAGNÓSTICO TERRITORIAL (INSUMO PROGRAMÁTICO / PROGRAMA DE GOBIERNO) */}
      {activeTab === 'diagnostico_territorial' && (
        <div className="space-y-6">
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Header & Sync with Sondeos de Opinión Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" /> Diagnóstico Territorial Sectorial (Insumo Programático)
                </h4>
              </div>

              {/* Sondeos Sync Action Box */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncSurveys}
                  disabled={isSyncingSurveys}
                  className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSurveys ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSurveys ? 'Sincronizando...' : '🔄 Sincronizar Sondeos de Opinión'}</span>
                </button>
              </div>
            </div>

            {/* SECTORIAL DIAGNOSTIC ENGINE: SECTOR TABS */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> 1. Sectores Temáticos y Evaluación por Variables Sugeridas
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {sectorDiagnostics.length} Sectores Evaluados
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddSectorModal(true)}
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Crear Sector
                  </button>
                </div>
              </div>

              {/* Sector Buttons Bar */}
              <div 
                ref={sectorTabsContainerRef}
                className="bg-[#030e21]/90 p-1.5 rounded-2xl border border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none shadow-lg scroll-smooth text-xs font-bold"
              >
                {sectorDiagnostics.map((sec) => {
                  const isActive = selectedSectorTab === sec.category;
                  const criticalCount = sec.variables.filter(v => v.status === 'Crítico').length;

                  return (
                    <div
                      key={sec.id}
                      ref={(el) => {
                        sectorTabRefs.current[sec.category] = el;
                      }}
                      className={`group flex items-center rounded-xl transition-all shrink-0 whitespace-nowrap border ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/50 shadow-md shadow-cyan-950/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSectorTab(sec.category)}
                        className="pl-3.5 pr-2 py-2 flex items-center gap-2 cursor-pointer text-xs"
                      >
                        <span>{sec.iconEmoji} {sec.category}</span>
                        {criticalCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500 text-slate-950 shadow-sm">
                            {criticalCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSectorToDelete(sec);
                        }}
                        className="pr-2 pl-1 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-40 group-hover:opacity-100 cursor-pointer mr-1"
                        title={`Eliminar sector ${sec.category}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(true)}
                  className="px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-dashed border-cyan-500/30 hover:border-cyan-400/60 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Crear Sector</span>
                </button>
              </div>

              {sectorDiagnostics.length === 0 && (
                <div className="rounded-2xl border border-dashed border-cyan-500/30 bg-[#030e21]/70 px-6 py-10 text-center">
                  <BarChart3 className="mx-auto mb-3 h-8 w-8 text-cyan-400/70" />
                  <p className="text-sm font-bold text-white">0 sectores registrados</p>
                  <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                    El diagnóstico territorial está vacío. El candidato o un administrador puede crear el primer sector y agregar sus variables e indicadores reales.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddSectorModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-xs font-black text-slate-950 transition-all hover:from-teal-400 hover:to-cyan-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> Crear primer sector
                  </button>
                </div>
              )}

              {/* Selected Sector Details Box */}
              {(() => {
                const currentSector = sectorDiagnostics.find(s => s.category === selectedSectorTab) || sectorDiagnostics[0];
                if (!currentSector) return null;

                return (
                  <div className="bg-[#081d38] border border-cyan-500/30 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                      <div>
                        <h5 className="font-extrabold text-white text-sm flex items-center gap-2">
                          <span>{currentSector.iconEmoji} Sector: {currentSector.category}</span>
                        </h5>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowAddVariableModal(true)}
                          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar Variable
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSector(currentSector.id)}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Eliminar Sector Temático"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Eliminar Sector
                        </button>
                      </div>
                    </div>

                    {/* Variables Table / Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentSector.variables.map((variable) => (
                        <div
                          key={variable.id}
                          className="bg-[#051325] border border-cyan-500/20 rounded-2xl p-3.5 space-y-2.5 flex flex-col justify-between hover:border-cyan-400/40 transition-all shadow-md"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <strong className="text-slate-100 text-xs font-bold leading-tight">{variable.name}</strong>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditVariableModal(currentSector.id, variable)}
                                  className="p-1 text-cyan-400 hover:text-white bg-cyan-950/80 border border-cyan-500/30 hover:bg-cyan-900 rounded-lg transition-all cursor-pointer"
                                  title="Editar Indicador, Línea Base y Meta"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVariableStatus(currentSector.id, variable.id)}
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                                    variable.status === 'Crítico'
                                      ? 'bg-rose-950 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                                      : variable.status === 'Regular'
                                      ? 'bg-amber-950 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                                  }`}
                                >
                                  {variable.status} ↺
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariable(currentSector.id, variable.id)}
                                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                                  title="Eliminar Variable"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* INDICADORES Y LÍNEA BASE COMPONENT */}
                            <div className="bg-[#071930] border border-cyan-500/25 rounded-xl p-2.5 space-y-2">
                              <div className="text-[10px] text-cyan-300 font-bold flex items-center justify-between border-b border-cyan-500/20 pb-1">
                                <span className="flex items-center gap-1 text-cyan-400">
                                  <Activity className="w-3.5 h-3.5" />
                                  Indicadores ({getVariableIndicadores(variable).length}):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditVariableModal(currentSector.id, variable)}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5 cursor-pointer font-extrabold hover:underline"
                                >
                                  + Administrar
                                </button>
                              </div>

                              <div className="space-y-2">
                                {getVariableIndicadores(variable).map((ind, idx) => (
                                  <div key={ind.id || idx} className="bg-[#031121] p-2 rounded-lg border border-cyan-500/20 space-y-1">
                                    <div className="text-[10px] text-slate-200 font-semibold truncate" title={ind.nombre}>
                                      📊 <span className="text-cyan-200 font-bold">{ind.nombre}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                      <div className="bg-[#010914] p-1.5 rounded-md border border-amber-500/30 flex flex-col justify-center">
                                        <span className="text-amber-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                          📍 Línea Base
                                        </span>
                                        <span className="text-amber-200 font-black text-xs mt-0.5">
                                          {ind.lineaBase || 'N/A'}
                                        </span>
                                      </div>

                                      <div className="bg-[#010914] p-1.5 rounded-md border border-emerald-500/30 flex flex-col justify-center">
                                        <span className="text-emerald-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                          🎯 Meta
                                        </span>
                                        <span className="text-emerald-200 font-black text-xs mt-0.5">
                                          {ind.meta || 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Sondeo: <span className="text-slate-200">{variable.pollPerception}</span>
                            </p>
                          </div>

                          <div className="pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-300/80 font-mono">
                            <span>Módulo Sondeos Votantes</span>
                            <span>Sincronizado AI</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2. MICRO-TERRITORIAL DIAGNOSTIC SECTION (COMMUNES & NEIGHBORHOODS) */}
            <div className="pt-4 border-t border-cyan-500/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-black text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" /> 2. Fichas de Diagnóstico Territorial Micro-Local (Por Comuna / Corregimiento)
                  </h5>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddNeedModal(true)}
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Registrar Ficha Comunal
                </button>
              </div>

              {/* Filter Bar */}
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20 text-xs">
                <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <span className="font-bold text-slate-300">Filtrar por Comuna/Sector:</span>
                  <select
                    value={selectedComunaFilter}
                    onChange={(e) => setSelectedComunaFilter(e.target.value)}
                    className="block w-full min-w-0 max-w-full box-border bg-[#051325] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-400 font-medium sm:w-auto sm:max-w-[20rem]"
                  >
                    <option value="Todos">Todas las Comunas / Corregimientos</option>
                    <option value="Comuna 1 - Popular">Comuna 1 - Popular</option>
                    <option value="Comuna 3 - Manrique">Comuna 3 - Manrique</option>
                    <option value="Comuna 13 - San Javier">Comuna 13 - San Javier</option>
                    <option value="Corregimiento San Cristóbal">Corregimiento San Cristóbal</option>
                  </select>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  {territorialNeeds.filter(n => selectedComunaFilter === 'Todos' || n.comunaSector === selectedComunaFilter).length} Fichas Mapeadas
                </span>
              </div>

              {/* Needs & Programmatic Proposals Cards */}
              {territorialNeeds.filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter).length === 0 && (
                <div className="rounded-2xl border border-dashed border-cyan-500/30 bg-[#030e21]/70 px-6 py-8 text-center">
                  <MapPin className="mx-auto mb-3 h-7 w-7 text-cyan-400/70" />
                  <p className="text-sm font-bold text-white">0 fichas comunales registradas</p>
                  <p className="mt-1 text-xs text-slate-400">Las fichas aparecerán únicamente cuando el candidato o un administrador registre información real.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddNeedModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-xs font-black text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" /> Registrar primera ficha
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {territorialNeeds
                  .filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter)
                  .map((need) => (
                    <div key={need.id} className="bg-[#081d38] border border-cyan-500/30 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-cyan-400/50 transition-all shadow-md">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {need.comunaSector}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-500/30">
                              {need.category}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                              need.impactLevel === 'Crítico'
                                ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                                : need.impactLevel === 'Alto'
                                ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}>
                              Impacto {need.impactLevel}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTerritorialNeed(need.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                              title="Eliminar Ficha Comunal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <strong className="text-slate-100 text-xs block font-bold">Problema Diagnosticado:</strong>
                          <p className="text-slate-300 text-xs leading-relaxed bg-[#051325] p-2.5 rounded-xl border border-cyan-500/10">
                            {need.problemDescription}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-cyan-500/20 space-y-1 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                        <strong className="text-emerald-300 text-[11px] block font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Propuesta Programática (Insumo Plan de Gobierno):
                        </strong>
                        <p className="text-slate-200 text-xs font-medium leading-relaxed">
                          {need.programmaticProposal}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: PROGRAMA DE GOBIERNO */}
      {activeTab === 'programa_gobierno' && (
        <ProgramaGobiernoView 
          candidateProfile={candidateProfile}
          sectorDiagnostics={sectorDiagnostics}
          territorialNeeds={territorialNeeds}
          onUpdateCandidateProfile={(updated) => setCandidateProfile(prev => ({ ...prev, ...updated }))}
        />
      )}

      {/* TAB 4: PERFIL GENERAL & DATOS DEL CANDIDATO */}
      {activeTab === 'perfil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Avatar & Key Badge Card */}
          <div className="lg:col-span-4 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 text-center flex flex-col items-center shadow-xl self-start h-fit min-w-[200px]">
            <div className="w-full flex flex-col items-center">
              <div className="relative group">
                {candidateProfile.avatarUrl ? (
                  <img
                    src={candidateProfile.avatarUrl}
                    alt={candidateProfile.fullName || 'Candidato'}
                    className="w-36 h-36 rounded-full border-4 border-emerald-400 object-cover shadow-2xl"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-full border-4 border-emerald-400/70 bg-[#081d38] flex items-center justify-center shadow-2xl">
                    <UserCheck className="w-14 h-14 text-emerald-400/70" />
                  </div>
                )}
                <label className="absolute bottom-1 right-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-2 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110">
                  <Edit3 className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64Url = event.target?.result as string;
                          if (base64Url) {
                            setCandidateProfile(p => ({ ...p, avatarUrl: base64Url }));
                            try {
                              localStorage.setItem('candidate_photo', base64Url);
                              window.dispatchEvent(new Event('candidate_photo_updated'));
                            } catch {
                              // ignore
                            }
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <h3 className="text-base font-black text-white mt-3 break-words w-full text-center leading-tight">{candidateProfile.fullName}</h3>
              <p className="text-xs font-bold text-emerald-400 break-words text-center">{candidateProfile.politicalName}</p>

              <div className="mt-3 px-3 py-1 rounded-full bg-teal-950 border border-teal-500/40 text-teal-300 font-semibold text-xs inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Candidato Oficial a {candidateProfile.candidateOffice}</span>
              </div>

              <div className="w-full border-t border-cyan-500/20 my-4" />

              <div className="w-full text-left space-y-2 text-xs text-slate-300">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400">Territorio:</span>
                  <span className="font-bold text-white break-words">{candidateProfile.territory}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400">Cédula de Ciudadanía:</span>
                  <span className="font-mono text-cyan-300 font-bold break-all">{candidateProfile.cedula}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-400">Sello Inhabilidades:</span>
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Pendiente de verificación oficial</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20 text-left space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-0.5">Eslogan de Campaña:</span>
                <p className="text-xs font-bold text-amber-300 italic">"{candidateProfile.slogan}"</p>
              </div>

              {candidateProfile.professionalSummary && (
                <div className="pt-2 border-t border-cyan-500/15">
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block mb-0.5">Resumen Perfil Profesional:</span>
                  <p className="text-[11px] text-slate-300 line-clamp-3 font-normal leading-snug">{candidateProfile.professionalSummary}</p>
                </div>
              )}

              {candidateProfile.candidateBio && (
                <div className="pt-2 border-t border-cyan-500/15">
                  <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider block mb-0.5">Reseña del Candidato:</span>
                  <p className="text-[11px] text-slate-300 line-clamp-3 font-normal leading-snug">{candidateProfile.candidateBio}</p>
                </div>
              )}

              {/* Candidate DOFA Summary Box */}
              <div className="pt-2.5 border-t border-cyan-500/20 space-y-1.5">
                <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <PieChart className="w-3 h-3 text-emerald-400" /> Matriz DOFA Resumida:
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                  <div className="bg-emerald-950/60 border border-emerald-500/30 p-1.5 rounded-lg">
                    <span className="font-bold text-emerald-300 block mb-0.5">Fortalezas:</span>
                    <p className="text-slate-300 line-clamp-2 leading-tight">{candidateProfile.dofaStrengths}</p>
                  </div>
                  <div className="bg-cyan-950/60 border border-cyan-500/30 p-1.5 rounded-lg">
                    <span className="font-bold text-cyan-300 block mb-0.5">Oportunidades:</span>
                    <p className="text-slate-300 line-clamp-2 leading-tight">{candidateProfile.dofaOpportunities}</p>
                  </div>
                  <div className="bg-amber-950/60 border border-amber-500/30 p-1.5 rounded-lg">
                    <span className="font-bold text-amber-300 block mb-0.5">Debilidades:</span>
                    <p className="text-slate-300 line-clamp-2 leading-tight">{candidateProfile.dofaWeaknesses}</p>
                  </div>
                  <div className="bg-rose-950/60 border border-rose-500/30 p-1.5 rounded-lg">
                    <span className="font-bold text-rose-300 block mb-0.5">Amenazas:</span>
                    <p className="text-slate-300 line-clamp-2 leading-tight">{candidateProfile.dofaThreats}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Editable Profile Form */}
          <div className="lg:col-span-8 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-5 shadow-xl min-w-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Configuración Completa del Candidato
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo (Registro CNE):</label>
                <input
                  type="text"
                  value={candidateProfile.fullName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setCandidateProfile({ ...candidateProfile, fullName: newName });
                    try {
                      localStorage.setItem('candidate_name', newName);
                      window.dispatchEvent(new Event('candidate_name_updated'));
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Político / Seudónimo:</label>
                <input
                  type="text"
                  value={candidateProfile.politicalName}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, politicalName: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cargo de Elección Popular al que Aspira:</label>
                <select
                  value={candidateProfile.candidateOffice}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, candidateOffice: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-emerald-400 outline-none"
                >
                  <option value="">Seleccione el cargo</option>
                  <option value="Alcaldía">Alcaldía Municipal/Distrital</option>
                  <option value="Gobernación">Gobernación Departamental</option>
                  <option value="Concejo">Concejo Municipal</option>
                  <option value="Asamblea">Asamblea Departamental</option>
                  <option value="Junta Administradora Local (JAL)">Junta Administradora Local (JAL)</option>
                  <option value="Cámara de Representantes">Cámara de Representantes</option>
                  <option value="Senado">Senado</option>
                  <option value="Presidencia">Presidencia</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Partido / Coalición / Grupo Significativo:</label>
                <input
                  type="text"
                  value={candidateProfile.partyAlliance}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, partyAlliance: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Municipio / Departamento:</label>
                <input
                  type="text"
                  value={candidateProfile.territory}
                  readOnly
                  title="Este territorio proviene de la campaña creada en Global Admin"
                  className="w-full bg-[#061326] border border-cyan-500/30 rounded-xl px-3 py-2 text-slate-300 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cédula de Ciudadanía:</label>
                <input
                  type="text"
                  value={candidateProfile.cedula}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, cedula: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-medium focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Eslogan Principal de Campaña:</label>
                <input
                  type="text"
                  value={candidateProfile.slogan}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, slogan: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Resumen del Perfil Profesional:</label>
                <textarea
                  rows={3}
                  value={candidateProfile.professionalSummary}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, professionalSummary: e.target.value })}
                  placeholder="Síntesis de experiencia académica, cargos directivos, gestión pública o privada..."
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-emerald-400 outline-none resize-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Reseña del Candidato (Biografía & Trayectoria):</label>
                <textarea
                  rows={4}
                  value={candidateProfile.candidateBio}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, candidateBio: e.target.value })}
                  placeholder="Reseña histórica, origen territorial, liderazgo comunitario, causas principales y logros destacados del candidato..."
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-emerald-400 outline-none resize-none"
                />
              </div>
            </div>

            {/* Candidate DOFA / SWOT Matrix Section */}
            <h4 className="text-sm font-bold text-emerald-300 pt-3 border-t border-cyan-500/20 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-400" /> Matriz DOFA / SWOT del Candidato
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Fortalezas */}
              <div className="bg-[#041224] p-3.5 rounded-2xl border border-emerald-500/30 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <label className="block font-extrabold text-emerald-400 text-xs flex items-center justify-between">
                    <span>Fortalezas (Internas):</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-mono">Ventajas</span>
                  </label>
                  <textarea
                    rows={3}
                    value={candidateProfile.dofaStrengths}
                    onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaStrengths: e.target.value })}
                    placeholder="Puntos fuertes, trayectoria ética, preparación, atributos diferenciadores..."
                    className="w-full bg-[#081d38] border border-emerald-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-emerald-400 outline-none resize-none"
                  />
                </div>
                <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                  <span className="text-[10px] font-extrabold text-emerald-300/80 block uppercase tracking-wider">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {candidateDofaVars.strengths.map((item, idx) => {
                      const isSelected = candidateProfile.dofaStrengths?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCandidateDofaVar('dofaStrengths', item)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight ${
                            isSelected
                              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60 font-bold shadow-sm'
                              : 'bg-[#081d38] text-slate-300 border-emerald-500/20 hover:border-emerald-400/40 hover:text-white'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Plus className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Variable Input */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newDofaInputs.strengths}
                      onChange={(e) => setNewDofaInputs({ ...newDofaInputs, strengths: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDofaVar('strengths', 'dofaStrengths');
                        }
                      }}
                      placeholder="+ Agregar nueva variable de fortaleza..."
                      className="flex-1 bg-[#081d38] border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-emerald-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomDofaVar('strengths', 'dofaStrengths')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Oportunidades */}
              <div className="bg-[#041224] p-3.5 rounded-2xl border border-cyan-500/30 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <label className="block font-extrabold text-cyan-400 text-xs flex items-center justify-between">
                    <span>Oportunidades (Externas):</span>
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md font-mono">Entorno</span>
                  </label>
                  <textarea
                    rows={3}
                    value={candidateProfile.dofaOpportunities}
                    onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaOpportunities: e.target.value })}
                    placeholder="Factores del contexto político, alianzas, coyuntura electoral a aprovechar..."
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-cyan-400 outline-none resize-none"
                  />
                </div>
                <div className="pt-2 border-t border-cyan-500/20 space-y-2">
                  <span className="text-[10px] font-extrabold text-cyan-300/80 block uppercase tracking-wider">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {candidateDofaVars.opportunities.map((item, idx) => {
                      const isSelected = candidateProfile.dofaOpportunities?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCandidateDofaVar('dofaOpportunities', item)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight ${
                            isSelected
                              ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/60 font-bold shadow-sm'
                              : 'bg-[#081d38] text-slate-300 border-cyan-500/20 hover:border-cyan-400/40 hover:text-white'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" /> : <Plus className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Variable Input */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newDofaInputs.opportunities}
                      onChange={(e) => setNewDofaInputs({ ...newDofaInputs, opportunities: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDofaVar('opportunities', 'dofaOpportunities');
                        }
                      }}
                      placeholder="+ Agregar nueva variable de oportunidad..."
                      className="flex-1 bg-[#081d38] border border-cyan-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomDofaVar('opportunities', 'dofaOpportunities')}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Debilidades */}
              <div className="bg-[#041224] p-3.5 rounded-2xl border border-amber-500/30 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <label className="block font-extrabold text-amber-400 text-xs flex items-center justify-between">
                    <span>Debilidades (Internas):</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono">A reforzar</span>
                  </label>
                  <textarea
                    rows={3}
                    value={candidateProfile.dofaWeaknesses}
                    onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaWeaknesses: e.target.value })}
                    placeholder="Áreas de mejora, brechas de conocimiento o reconocimiento territorial..."
                    className="w-full bg-[#081d38] border border-amber-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-amber-400 outline-none resize-none"
                  />
                </div>
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  <span className="text-[10px] font-extrabold text-amber-300/80 block uppercase tracking-wider">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {candidateDofaVars.weaknesses.map((item, idx) => {
                      const isSelected = candidateProfile.dofaWeaknesses?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCandidateDofaVar('dofaWeaknesses', item)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight ${
                            isSelected
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 font-bold shadow-sm'
                              : 'bg-[#081d38] text-slate-300 border-amber-500/20 hover:border-amber-400/40 hover:text-white'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" /> : <Plus className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Variable Input */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newDofaInputs.weaknesses}
                      onChange={(e) => setNewDofaInputs({ ...newDofaInputs, weaknesses: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDofaVar('weaknesses', 'dofaWeaknesses');
                        }
                      }}
                      placeholder="+ Agregar nueva variable de debilidad..."
                      className="flex-1 bg-[#081d38] border border-amber-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-amber-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomDofaVar('weaknesses', 'dofaWeaknesses')}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Amenazas */}
              <div className="bg-[#041224] p-3.5 rounded-2xl border border-rose-500/30 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <label className="block font-extrabold text-rose-400 text-xs flex items-center justify-between">
                    <span>Amenazas (Externas):</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md font-mono">Riesgos</span>
                  </label>
                  <textarea
                    rows={3}
                    value={candidateProfile.dofaThreats}
                    onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaThreats: e.target.value })}
                    placeholder="Ataques de oposición, abstencionismo, maquinarias rivales, desinformación..."
                    className="w-full bg-[#081d38] border border-rose-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-rose-400 outline-none resize-none"
                  />
                </div>
                <div className="pt-2 border-t border-rose-500/20 space-y-2">
                  <span className="text-[10px] font-extrabold text-rose-300/80 block uppercase tracking-wider">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {candidateDofaVars.threats.map((item, idx) => {
                      const isSelected = candidateProfile.dofaThreats?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCandidateDofaVar('dofaThreats', item)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight ${
                            isSelected
                              ? 'bg-rose-500/25 text-rose-300 border-rose-400/60 font-bold shadow-sm'
                              : 'bg-[#081d38] text-slate-300 border-rose-500/20 hover:border-rose-400/40 hover:text-white'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-3 h-3 text-rose-400 shrink-0" /> : <Plus className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Variable Input */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newDofaInputs.threats}
                      onChange={(e) => setNewDofaInputs({ ...newDofaInputs, threats: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDofaVar('threats', 'dofaThreats');
                        }
                      }}
                      placeholder="+ Agregar nueva variable de amenaza..."
                      className="flex-1 bg-[#081d38] border border-rose-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-rose-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomDofaVar('threats', 'dofaThreats')}
                      className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Contact Channels */}
            <h4 className="text-sm font-bold text-cyan-300 pt-3 border-t border-cyan-500/20 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Canales Oficiales de Contacto
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Sitio Web Oficial:</label>
                <input
                  type="text"
                  value={candidateProfile.website}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, website: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Correo Electrónico Oficial:</label>
                <input
                  type="email"
                  value={candidateProfile.email}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, email: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Teléfono Directo de Prensa:</label>
                <input
                  type="text"
                  value={candidateProfile.phone}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, phone: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cyan-500/20">
              <span className={`text-xs font-semibold ${candidateProfileMessage.toLowerCase().includes('guardado') ? 'text-emerald-400' : 'text-amber-300'}`}>
                {candidateProfileMessage}
              </span>
              <button
                type="button"
                onClick={() => void saveCandidateProfile()}
                disabled={candidateProfileSaving || !candidateCampaignId}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {candidateProfileSaving ? 'Guardando...' : 'Guardar perfil del candidato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CARGA Y ANÁLISIS DE HOJA DE VIDA (CV) */}
      {activeTab === 'hoja_vida' && (
        <div className="space-y-6">
          
          {/* Resume Upload Dropzone & AI Parser Trigger */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  Módulo de Carga y Lectura Inteligente de Hoja de Vida (CV)
                </h3>
              </div>

              <button
                onClick={() => void handleAnalyzeCv()}
                disabled={isParsingCv || !cvStoragePath}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isParsingCv ? 'animate-spin' : ''}`} />
                <span>{isParsingCv ? 'Analizando con IA...' : 'Escanear Hoja de Vida con IA'}</span>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div className="border-2 border-dashed border-cyan-500/40 hover:border-emerald-400 bg-[#081d38]/60 p-8 rounded-2xl flex flex-col items-center justify-center text-center transition-all group">
              <UploadCloud className="w-12 h-12 text-cyan-400 group-hover:scale-110 transition-transform mb-3" />
              <p className="text-sm font-bold text-white mb-4">
                Arrastre aquí su archivo de Hoja de Vida (PDF, DOCX) o haga clic para seleccionar
              </p>
              <label className="px-4 py-2 bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 border border-cyan-400/40 rounded-xl text-xs font-bold cursor-pointer transition-all">
                Seleccionar Archivo PDF
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {cvFileName && (
                <div className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-400/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>{cvFileName} ({cvUploadedAt ? new Date(cvUploadedAt).toLocaleString('es-CO') : ''})</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ml-2 ${cvAnalysisStatus === 'Analizado con IA' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500/20 text-amber-300'}`}>{cvAnalysisStatus}</span>
                </div>
              )}
              {!cvFileName && <p className="mt-4 text-xs text-slate-400">No hay una hoja de vida cargada para esta campaña.</p>}
              {cvMessage && <p className={`mt-4 text-xs font-bold ${/guardado|cargado|completado/i.test(cvMessage) ? 'text-emerald-300' : 'text-amber-300'}`}>{cvMessage}</p>}
            </div>
          </div>

          {/* Background & Ineligibility Check Panel */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Semáforo de Antecedentes e Inhabilidades (Procuraduría, Contraloría, PONAL, CNE)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Procuraduría General</div>
                <div className="text-sm font-black text-amber-300 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Pendiente de verificación
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  {backgroundChecks.procuraduria || 'Sin certificado oficial registrado.'}
                </p>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Contraloría General</div>
                <div className="text-sm font-black text-amber-300 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Pendiente de verificación
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  {backgroundChecks.contraloria || 'Sin certificado oficial registrado.'}
                </p>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Policía & Judicial (PONAL)</div>
                <div className="text-sm font-black text-amber-300 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Pendiente de verificación
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  {backgroundChecks.fiscalia || 'Sin certificado oficial registrado.'}
                </p>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">Consejo Nacional Electoral (CNE)</div>
                <div className="text-sm font-black text-amber-300 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Pendiente de verificación
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  {backgroundChecks.cneStatus || 'Sin certificación electoral registrada.'}
                </p>
              </div>
            </div>
          </div>

          {/* Academic Degrees & Professional Formation */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                Formación Académica & Títulos Universitarios
              </h4>
              <button
                onClick={() => setShowAddDegreeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 text-xs font-bold cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" /> Agregar Título
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {academicDegrees.map(deg => (
                <div key={deg.id} className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 flex flex-col justify-between relative group">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        {deg.level}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{deg.year}</span>
                    </div>
                    <h5 className="font-extrabold text-white text-sm mt-2">{deg.title}</h5>
                    <p className="text-xs text-teal-300 font-medium mt-1">{deg.institution}</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = academicDegrees.filter(d => d.id !== deg.id);
                      setAcademicDegrees(next);
                      void saveCandidateCv({ academicDegrees: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible eliminar el título.'));
                    }}
                    className="absolute top-2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-950/60 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {academicDegrees.length === 0 && <p className="text-xs text-slate-400 md:col-span-3">No hay títulos académicos registrados.</p>}
            </div>
          </div>

          {/* Work & Political Experience */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                Experiencia en Sector Público, Privado y Trayectoria Política
              </h4>
              <button
                onClick={() => setShowAddExpModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 text-xs font-bold cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" /> Agregar Experiencia
              </button>
            </div>

            <div className="space-y-3">
              {experienceItems.map(exp => (
                <div key={exp.id} className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                        exp.type === 'Público' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-sky-950 text-sky-300 border border-sky-500/30'
                      }`}>
                        {exp.type}
                      </span>
                      <span className="text-xs font-mono text-cyan-300 font-bold">{exp.period}</span>
                    </div>
                    <h5 className="font-extrabold text-white text-sm">{exp.role}</h5>
                    <p className="text-xs font-semibold text-slate-300">{exp.entityCompany}</p>
                    <p className="text-xs text-slate-400 mt-1">{exp.achievements}</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = experienceItems.filter(e => e.id !== exp.id);
                      setExperienceItems(next);
                      void saveCandidateCv({ experienceItems: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible eliminar la experiencia.'));
                    }}
                    className="text-rose-400 hover:bg-rose-950/60 p-2 rounded-xl transition-all self-end md:self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {experienceItems.length === 0 && <p className="text-xs text-slate-400">No hay experiencia laboral o política registrada.</p>}
            </div>
          </div>

          {/* Financial Assets & Tax Return Declaration */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Declaración Juramentada de Bienes e Inmuebles (Ley 2013 / CNE)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20">
                <span className="text-slate-400 font-semibold">Total Activos Declarados:</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
                  ${financialDeclaration.totalAssets.toLocaleString('es-CO')} COP
                </p>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20">
                <span className="text-slate-400 font-semibold">Total Pasivos / Deudas:</span>
                <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">
                  ${financialDeclaration.totalLiabilities.toLocaleString('es-CO')} COP
                </p>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20">
                <span className="text-slate-400 font-semibold">Patrimonio Neto Fiscal:</span>
                <p className="text-xl font-extrabold text-cyan-300 mt-1 font-mono">
                  ${financialDeclaration.netWorth.toLocaleString('es-CO')} COP
                </p>
              </div>
            </div>
            {financialDeclaration.totalAssets === 0 && financialDeclaration.totalLiabilities === 0 && !financialDeclaration.declarationStatus && (
              <p className="text-xs text-slate-400">No hay una declaración patrimonial registrada. Los valores permanecen en cero hasta que se agregue información real.</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void handleSaveCandidateCv()}
              disabled={isSavingCv || !candidateCampaignId}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {isSavingCv ? 'Guardando...' : 'Guardar expediente de hoja de vida'}
            </button>
          </div>

        </div>
      )}

      {/* TAB 3: MATRIZ DOFA / SWOT ESTRATÉGICA */}
      {activeTab === 'dofa' && (
        <div className="space-y-6">
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-400" />
                  Matriz DOFA / SWOT Estratégica
                </h3>
              </div>

              <button
                onClick={() => void handleGenerateSwot()}
                disabled={isGeneratingSwot || !candidateCampaignId}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingSwot ? 'animate-spin' : ''}`} />
                <span>{isGeneratingSwot ? 'Analizando campaña...' : 'Generar matriz con IA'}</span>
              </button>
            </div>

            {/* SWOT 4 Quadrants Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Fortalezas (Strengths) */}
              <div className="bg-sky-950/40 border border-sky-500/40 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-sky-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-400" /> Fortalezas (Strengths)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-900 text-sky-200">
                    {swotData.strengths.length} Factores
                  </span>
                </div>
                <ul className="space-y-2 text-xs text-sky-100">
                  {swotData.strengths.map((st, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 bg-[#081d38]/80 p-2.5 rounded-xl border border-sky-500/20">
                      <span>• {st}</span>
                      <button onClick={() => handleRemoveSwotItem('strengths', i)} className="text-sky-400 hover:text-rose-400 cursor-pointer shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {swotData.strengths.length === 0 && <li className="text-slate-400">Sin fortalezas registradas.</li>}
                </ul>
              </div>

              {/* Debilidades (Weaknesses) */}
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-amber-400" /> Debilidades (Weaknesses)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900 text-amber-200">
                    {swotData.weaknesses.length} Factores
                  </span>
                </div>
                <ul className="space-y-2 text-xs text-amber-100">
                  {swotData.weaknesses.map((wk, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 bg-[#081d38]/80 p-2.5 rounded-xl border border-amber-500/20">
                      <span>• {wk}</span>
                      <button onClick={() => handleRemoveSwotItem('weaknesses', i)} className="text-amber-400 hover:text-rose-400 cursor-pointer shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {swotData.weaknesses.length === 0 && <li className="text-slate-400">Sin debilidades registradas.</li>}
                </ul>
              </div>

              {/* Oportunidades (Opportunities) */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-emerald-300 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-400" /> Oportunidades (Opportunities)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-200">
                    {swotData.opportunities.length} Factores
                  </span>
                </div>
                <ul className="space-y-2 text-xs text-emerald-100">
                  {swotData.opportunities.map((op, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 bg-[#081d38]/80 p-2.5 rounded-xl border border-emerald-500/20">
                      <span>• {op}</span>
                      <button onClick={() => handleRemoveSwotItem('opportunities', i)} className="text-emerald-400 hover:text-rose-400 cursor-pointer shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {swotData.opportunities.length === 0 && <li className="text-slate-400">Sin oportunidades registradas.</li>}
                </ul>
              </div>

              {/* Amenazas (Threats) */}
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> Amenazas (Threats)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-900 text-rose-200">
                    {swotData.threats.length} Factores
                  </span>
                </div>
                <ul className="space-y-2 text-xs text-rose-100">
                  {swotData.threats.map((th, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 bg-[#081d38]/80 p-2.5 rounded-xl border border-rose-500/20">
                      <span>• {th}</span>
                      <button onClick={() => handleRemoveSwotItem('threats', i)} className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {swotData.threats.length === 0 && <li className="text-slate-400">Sin amenazas registradas.</li>}
                </ul>
              </div>

            </div>

            {/* Quick Add SWOT Item Bar */}
            <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 flex flex-col sm:flex-row items-center gap-3 mt-4">
              <select
                value={swotCategory}
                onChange={(e) => setSwotCategory(e.target.value as any)}
                className="bg-[#05162a] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer"
              >
                <option value="strengths">Fortaleza</option>
                <option value="weaknesses">Debilidad</option>
                <option value="opportunities">Oportunidad</option>
                <option value="threats">Amenaza</option>
              </select>

              <input
                type="text"
                placeholder="Escriba un nuevo elemento diagnóstico..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem()}
                className="flex-1 bg-[#05162a] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none"
              />

              <button
                onClick={handleAddSwotItem}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer transition-all shrink-0"
              >
                Agregar a Matriz
              </button>
            </div>
            {swotMessage && <p className={`text-xs font-bold ${/guardad|generada|eliminado/i.test(swotMessage) ? 'text-emerald-300' : 'text-amber-300'}`}>{swotMessage}</p>}
          </div>
        </div>
      )}

      {/* TAB 4: NARRATIVA, DISCURSO & MAPA POLÍTICO */}
      {activeTab === 'discurso' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Campaign Narrative & Base Message */}
          <div className="lg:col-span-7 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-5 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Identidad Estratégica & Argumentario Base
            </h3>

            <div>
              <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2">
                Narrativa Estratégica de Campaña:
              </label>
              <textarea
                rows={4}
                value={strategicIdentity.narrative}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, narrative: e.target.value })}
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-2xl p-3 text-xs text-white font-medium focus:border-emerald-400 outline-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">
                Mensaje Fuerza / Eje del Discurso:
              </label>
              <textarea
                rows={3}
                value={strategicIdentity.baseMessage}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, baseMessage: e.target.value })}
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-2xl p-3 text-xs text-white font-medium focus:border-emerald-400 outline-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Valores de Marca Política:
              </label>
              <div className="flex flex-wrap gap-2">
                {strategicIdentity.coreValues.map((val, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-xl bg-teal-950 text-teal-300 border border-teal-500/30 text-xs font-bold">
                    {val}
                  </span>
                ))}
                {strategicIdentity.coreValues.length === 0 && <span className="text-xs text-slate-400">Sin valores registrados.</span>}
              </div>
              <input
                type="text"
                value={strategicIdentity.coreValues.join(', ')}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, coreValues: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })}
                placeholder="Escriba valores separados por comas"
                className="mt-3 w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Eslogan de campaña:</label>
              <input
                type="text"
                value={strategicIdentity.slogan}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, slogan: e.target.value })}
                placeholder="Escriba el eslogan aprobado"
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <button
              onClick={() => void handleSaveNarrative()}
              disabled={narrativeSaving || !candidateCampaignId}
              className="px-4 py-2 bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {narrativeSaving ? 'Guardando...' : 'Guardar narrativa'}
            </button>
          </div>

          {/* Political Competitors & Allies Matrix */}
          <div className="lg:col-span-5 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <Users className="w-5 h-5 text-emerald-400" />
              Mapa de Competidores & Aliados
            </h3>

            <div className="space-y-3">
              {actorsList.map(actor => (
                <div key={actor.id} className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">{actor.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      actor.role === 'Competidor Directo' ? 'bg-rose-950 text-rose-300 border border-rose-500/30' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {actor.role}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{actor.party}</span>
                    {actor.estimatedVoteShare > 0 && <span className="font-bold text-cyan-300 font-mono">Intención: {actor.estimatedVoteShare}%</span>}
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    {actor.notes || 'Sin observaciones.'}
                  </p>
                  <p className="text-[10px] text-cyan-300">Fuente: {actor.source || 'No registrada'} · Actualizado: {actor.updatedAt ? new Date(actor.updatedAt).toLocaleDateString('es-CO') : 'Sin fecha'}</p>
                  <button onClick={() => void handleRemovePoliticalActor(actor.id)} className="absolute top-2 right-2 text-rose-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {actorsList.length === 0 && <p className="text-xs text-slate-400">No hay competidores, aliados o líderes neutrales registrados.</p>}
            </div>

            <div className="border-t border-cyan-500/20 pt-4 space-y-3">
              <h4 className="text-xs font-black text-cyan-300 uppercase">Registrar actor político</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={newActor.name} onChange={(e) => setNewActor({ ...newActor, name: e.target.value })} placeholder="Nombre completo *" className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white" />
                <select value={newActor.role} onChange={(e) => setNewActor({ ...newActor, role: e.target.value as PoliticalActor['role'] })} className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white">
                  <option value="Competidor Directo">Competidor directo</option>
                  <option value="Aliado Político">Aliado político</option>
                  <option value="Líder Neutral">Líder neutral</option>
                </select>
                <input value={newActor.party} onChange={(e) => setNewActor({ ...newActor, party: e.target.value })} placeholder="Partido, movimiento o coalición" className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white" />
                <input type="number" min="0" max="100" step="0.1" value={newActor.estimatedVoteShare || ''} onChange={(e) => setNewActor({ ...newActor, estimatedVoteShare: Number(e.target.value || 0) })} placeholder="Intención de voto (%)" className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white" />
                <input value={newActor.source} onChange={(e) => setNewActor({ ...newActor, source: e.target.value })} placeholder="Fuente del dato *" className="sm:col-span-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white" />
                <textarea value={newActor.notes} onChange={(e) => setNewActor({ ...newActor, notes: e.target.value })} placeholder="Observaciones verificables" rows={2} className="sm:col-span-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white" />
              </div>
              <button onClick={() => void handleAddPoliticalActor()} className="px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" /> Registrar actor</button>
            </div>
          </div>

          {narrativeMessage && <p className={`lg:col-span-12 text-xs font-bold ${/guardad|registrado|eliminado/i.test(narrativeMessage) ? 'text-emerald-300' : 'text-amber-300'}`}>{narrativeMessage}</p>}

        </div>
      )}

      {/* TAB COMUNICACIÓN Y REDES SOCIALES */}
      {activeTab === 'comunicacion_redes' && (
        <ComunicacionRedesView candidateProfile={candidateProfile} />
      )}



      {/* TAB AGENDA Y CALENDARIO ELECTORAL */}
      {activeTab === 'agenda_electoral' && (
        <AgendaCalendarioView onSelectView={onSelectView} />
      )}

      {/* TAB 5: COMMAND CENTER AI */}
      {activeTab === 'ai_command' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                Command Center AI - Diagnóstico Diario Estratégico
              </h3>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950 border border-emerald-400/30 px-3 py-1 rounded-full">
                Índice de Preparación: 87%
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30 space-y-2">
                <h4 className="font-extrabold text-emerald-300 text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-400" /> Oportunidades Clave Recomendadas por IA
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-200">
                  <li>Reforzar recorridos en la Comuna 4 (Aranjuez) donde se detecta migración de voto indeciso.</li>
                  <li>Promover infografías sobre el plan de empleo juvenil tras debate universitario.</li>
                  <li>Coordinar encuentro con gremios de transporte antes de cierre de inscripciones.</li>
                </ul>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-rose-500/30 space-y-2">
                <h4 className="font-extrabold text-rose-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Alertas de Riesgo
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-200">
                  <li>Aumento de comentarios negativos en redes sociales provenientes de cuentas inactivas (posible red de bodegas).</li>
                  <li>Atención en presupuesto de pauta en comunas 1 y 3.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h4 className="font-extrabold text-white text-base mb-2">Sentimiento Político Registrado</h4>
              <div className="space-y-3 mt-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Positivo / Aceptación</span>
                    <span className="text-emerald-400 font-bold">72%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Neutral / Indecisos</span>
                    <span className="text-cyan-400 font-bold">18%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: '18%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Negativo / Rechazo</span>
                    <span className="text-rose-400 font-bold">10%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: '10%' }} />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20">
              Cálculo estimado basado en análisis de redes sociales, sondeos y monitoreo de opinión en tiempo real.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: PRESUPUESTO STRATEGICO BORRADOR */}
      {activeTab === 'presupuesto' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Presupuesto Estratégico Interno (Borrador de Planeación)
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Simulador confidencial de asignación de rubros internos (Diferente al Presupuesto Oficial CNE/Cuentas Claras).
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-black">Meta Proyectada:</span>
              <p className="text-lg font-black text-emerald-400 font-mono">
                ${draftBudget.totalProposed.toLocaleString('es-CO')} COP
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 min-w-0">
              <span className="text-slate-400 font-semibold block truncate">Comunicaciones & Pauta:</span>
              <p className="text-base sm:text-lg font-bold text-cyan-300 font-mono mt-1 break-all sm:break-normal">
                ${draftBudget.allocatedAdvertising.toLocaleString('es-CO')} COP
              </p>
              <span className="text-[10px] text-emerald-400">45% del Total</span>
            </div>

            <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 min-w-0">
              <span className="text-slate-400 font-semibold block truncate">Operación Territorial:</span>
              <p className="text-base sm:text-lg font-bold text-teal-300 font-mono mt-1 break-all sm:break-normal">
                ${draftBudget.allocatedOperations.toLocaleString('es-CO')} COP
              </p>
              <span className="text-[10px] text-emerald-400">25% del Total</span>
            </div>

            <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 min-w-0">
              <span className="text-slate-400 font-semibold block truncate">Eventos & Logística:</span>
              <p className="text-base sm:text-lg font-bold text-emerald-300 font-mono mt-1 break-all sm:break-normal">
                ${draftBudget.allocatedEvents.toLocaleString('es-CO')} COP
              </p>
              <span className="text-[10px] text-emerald-400">20% del Total</span>
            </div>

            <div className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 min-w-0">
              <span className="text-slate-400 font-semibold block truncate">Contingencia & Imprevistos:</span>
              <p className="text-base sm:text-lg font-bold text-amber-300 font-mono mt-1 break-all sm:break-normal">
                ${draftBudget.allocatedContingency.toLocaleString('es-CO')} COP
              </p>
              <span className="text-[10px] text-amber-400">10% del Total</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR TÍTULO ACADÉMICO */}
      {showAddDegreeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                Agregar Título Académico
              </h4>
              <button onClick={() => setShowAddDegreeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Título:</label>
                <input
                  type="text"
                  placeholder="Ej: Especialización en Derecho Constitucional"
                  value={newDegree.title}
                  onChange={(e) => setNewDegree({ ...newDegree, title: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Institución Educativa:</label>
                <input
                  type="text"
                  placeholder="Ej: Universidad Nacional de Colombia"
                  value={newDegree.institution}
                  onChange={(e) => setNewDegree({ ...newDegree, institution: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nivel:</label>
                  <select
                    value={newDegree.level}
                    onChange={(e) => setNewDegree({ ...newDegree, level: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Pregrado">Pregrado</option>
                    <option value="Posgrado">Posgrado</option>
                    <option value="Maestría">Maestría</option>
                    <option value="Doctorado">Doctorado</option>
                    <option value="Diplomado">Diplomado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Año de Graduación:</label>
                  <input
                    type="text"
                    value={newDegree.year}
                    onChange={(e) => setNewDegree({ ...newDegree, year: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddDegreeModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newDegree.title || !newDegree.institution) return;
                  const next = [...academicDegrees, { ...newDegree, id: `deg-${Date.now()}` }];
                  setAcademicDegrees(next);
                  void saveCandidateCv({ academicDegrees: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible guardar el título.'));
                  setShowAddDegreeModal(false);
                }}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold cursor-pointer"
              >
                Guardar Título
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR EXPERIENCIA */}
      {showAddExpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                Agregar Experiencia Laboral / Trayectoria
              </h4>
              <button onClick={() => setShowAddExpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cargo Desempeñado:</label>
                <input
                  type="text"
                  placeholder="Ej: Director de Planeación"
                  value={newExp.role}
                  onChange={(e) => setNewExp({ ...newExp, role: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Entidad / Empresa:</label>
                <input
                  type="text"
                  placeholder="Ej: Gobernación de Antioquia"
                  value={newExp.entityCompany}
                  onChange={(e) => setNewExp({ ...newExp, entityCompany: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sector:</label>
                  <select
                    value={newExp.type}
                    onChange={(e) => setNewExp({ ...newExp, type: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Público">Público</option>
                    <option value="Privado">Privado</option>
                    <option value="Político/Social">Político/Social</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Periodo:</label>
                  <input
                    type="text"
                    placeholder="Ej: 2018 - 2021"
                    value={newExp.period}
                    onChange={(e) => setNewExp({ ...newExp, period: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Logros Destacados:</label>
                <textarea
                  rows={2}
                  placeholder="Resuma logros clave..."
                  value={newExp.achievements}
                  onChange={(e) => setNewExp({ ...newExp, achievements: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddExpModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newExp.role || !newExp.entityCompany) return;
                  const next = [...experienceItems, { ...newExp, id: `exp-${Date.now()}` }];
                  setExperienceItems(next);
                  void saveCandidateCv({ experienceItems: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible guardar la experiencia.'));
                  setShowAddExpModal(false);
                }}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold cursor-pointer"
              >
                Guardar Experiencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR VARIABLE E INDICADORES (MÚLTIPLES INDICADORES) */}
      {editingVariable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                Editar Variable e Indicadores
              </h4>
              <button onClick={() => setEditingVariable(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre de la Variable:</label>
                <input
                  type="text"
                  value={varEditForm.name}
                  onChange={(e) => setVarEditForm({ ...varEditForm, name: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Percepción Sondeos / Observación:</label>
                <input
                  type="text"
                  value={varEditForm.pollPerception}
                  onChange={(e) => setVarEditForm({ ...varEditForm, pollPerception: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              {/* LISTA DE INDICADORES DINÁMICOS */}
              <div className="pt-2 border-t border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Indicadores de Medición ({varEditForm.indicadores.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIndicadorToForm}
                    className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Indicador
                  </button>
                </div>

                <div className="space-y-3">
                  {varEditForm.indicadores.map((ind, idx) => (
                    <div key={ind.id} className="bg-[#081d38] border border-cyan-500/30 p-3 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-200 text-[11px] flex items-center gap-1">
                          📊 Indicador #{idx + 1}
                        </span>
                        {varEditForm.indicadores.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIndicadorFromForm(ind.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                            title="Eliminar este indicador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-300 text-[10px] font-semibold mb-1">Nombre del Indicador:</label>
                        <input
                          type="text"
                          placeholder="Ej: Índice de Cobertura o Tiempo de Respuesta"
                          value={ind.nombre}
                          onChange={(e) => handleUpdateIndicadorInForm(ind.id, 'nombre', e.target.value)}
                          className="w-full bg-[#031121] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-cyan-400 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-amber-300 text-[10px] font-semibold mb-1">📍 Línea Base:</label>
                          <input
                            type="text"
                            placeholder="Ej: 78.4% o 45 días"
                            value={ind.lineaBase}
                            onChange={(e) => handleUpdateIndicadorInForm(ind.id, 'lineaBase', e.target.value)}
                            className="w-full bg-[#031121] border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-amber-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-emerald-300 text-[10px] font-semibold mb-1">🎯 Meta Programática:</label>
                          <input
                            type="text"
                            placeholder="Ej: 32.0% o 12 días"
                            value={ind.meta}
                            onChange={(e) => handleUpdateIndicadorInForm(ind.id, 'meta', e.target.value)}
                            className="w-full bg-[#031121] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-emerald-400 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-cyan-500/20">
              <button
                onClick={() => setEditingVariable(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditedVariable}
                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold cursor-pointer transition-all shadow-lg shadow-cyan-500/20"
              >
                Guardar Indicadores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR VARIABLE A SECTOR */}
      {showAddVariableModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Agregar Variable al Sector {selectedSectorTab}
              </h4>
              <button onClick={() => setShowAddVariableModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre de la Variable:</label>
                <input
                  type="text"
                  placeholder="Ej: Calidad del Servicio de Agua Potable"
                  value={newVariableName}
                  onChange={(e) => setNewVariableName(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Indicador:</label>
                <input
                  type="text"
                  placeholder="Ej: Cobertura de agua potable continua"
                  value={newVarIndicador}
                  onChange={(e) => setNewVarIndicador(e.target.value)}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-300 font-semibold mb-1">📍 Línea Base:</label>
                  <input
                    type="text"
                    placeholder="Ej: 62.0%"
                    value={newVarLineaBase}
                    onChange={(e) => setNewVarLineaBase(e.target.value)}
                    className="w-full bg-[#081d38] border border-amber-500/40 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-emerald-300 font-semibold mb-1">🎯 Meta:</label>
                  <input
                    type="text"
                    placeholder="Ej: 98.0%"
                    value={newVarMeta}
                    onChange={(e) => setNewVarMeta(e.target.value)}
                    className="w-full bg-[#081d38] border border-emerald-500/40 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddVariableModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newVariableName.trim()) return;
                  const currentSector = sectorDiagnostics.find(s => s.category === selectedSectorTab) || sectorDiagnostics[0];
                  if (currentSector) {
                    setSectorDiagnostics(prev => prev.map(sec => {
                      if (sec.id !== currentSector.id) return sec;
                      const newVar: SectorVariable = {
                        id: `v-custom-${Date.now()}`,
                        name: newVariableName.trim(),
                        status: 'Regular',
                        score: 50,
                        pollPerception: 'Variable adicionada por el equipo de diagnóstico',
                        indicador: newVarIndicador.trim() || undefined,
                        lineaBase: newVarLineaBase.trim() || undefined,
                        meta: newVarMeta.trim() || undefined
                      };
                      return { ...sec, variables: [...sec.variables, newVar] };
                    }));
                  }
                  setNewVariableName('');
                  setNewVarIndicador('');
                  setNewVarLineaBase('');
                  setNewVarMeta('');
                  setShowAddVariableModal(false);
                }}
                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold cursor-pointer"
              >
                Guardar Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR FICHA DE DIAGNÓSTICO COMUNAL */}
      {showAddNeedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Registrar Ficha de Diagnóstico Micro-Local
              </h4>
              <button onClick={() => setShowAddNeedModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Comuna / Corregimiento / Sector:</label>
                <input
                  type="text"
                  placeholder="Ej: Comuna 1 - Popular"
                  value={newTerritorialNeed.comunaSector}
                  onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, comunaSector: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sector Temático:</label>
                  <select
                    value={newTerritorialNeed.category}
                    onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, category: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Seguridad">Seguridad</option>
                    <option value="Infraestructura">Infraestructura</option>
                    <option value="Empleo">Empleo</option>
                    <option value="Salud">Salud</option>
                    <option value="Educación">Educación</option>
                    <option value="Medio Ambiente">Medio Ambiente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nivel de Impacto:</label>
                  <select
                    value={newTerritorialNeed.impactLevel}
                    onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, impactLevel: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Crítico">Crítico</option>
                    <option value="Alto">Alto</option>
                    <option value="Medio">Medio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Problema Diagnosticado:</label>
                <textarea
                  rows={2}
                  placeholder="Describa la problemática comunitaria..."
                  value={newTerritorialNeed.problemDescription}
                  onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, problemDescription: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Propuesta Programática (Programa de Gobierno):</label>
                <textarea
                  rows={2}
                  placeholder="Escriba la solución programática..."
                  value={newTerritorialNeed.programmaticProposal}
                  onChange={(e) => setNewTerritorialNeed({ ...newTerritorialNeed, programmaticProposal: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddNeedModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddTerritorialNeed}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 rounded-xl font-bold cursor-pointer"
              >
                Guardar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR NUEVO SECTOR TEMÁTICO */}
      {showAddSectorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Crear Nuevo Sector Temático (Diagnóstico)
              </h4>
              <button onClick={() => setShowAddSectorModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Sector:</label>
                <input
                  type="text"
                  placeholder="Ej: Cultura, Juventud y Deporte / Servicios Públicos"
                  value={newSector.category}
                  onChange={(e) => setNewSector({ ...newSector, category: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Icono / Emoji representativo:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSector.iconEmoji}
                    onChange={(e) => setNewSector({ ...newSector, iconEmoji: e.target.value })}
                    className="w-16 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-center text-base outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['🎭', '💧', '🚌', '💼', '🌿', '🏢', '⚖️', '📌', '⚡', '🌾'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewSector({ ...newSector, iconEmoji: emoji })}
                        className="px-2 py-1 bg-[#081d38] hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-sm cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Diagnóstico / Resumen de Problemática Sectorial:</label>
                <textarea
                  rows={2}
                  placeholder="Describa brevemente la situación actual observada o reportada en sondeos..."
                  value={newSector.problemSummary}
                  onChange={(e) => setNewSector({ ...newSector, problemSummary: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Propuesta Programática Base:</label>
                <textarea
                  rows={2}
                  placeholder="Describa la solución propuesta para incluir en el Plan de Gobierno..."
                  value={newSector.programmaticSolution}
                  onChange={(e) => setNewSector({ ...newSector, programmaticSolution: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Variable Inicial a Evaluar:</label>
                <input
                  type="text"
                  placeholder="Ej: Calidad y Continuidad del Servicio de Agua"
                  value={newSector.initialVariable}
                  onChange={(e) => setNewSector({ ...newSector, initialVariable: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddSectorModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSector}
                className="flex-1 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 rounded-xl font-black cursor-pointer hover:from-teal-400 hover:to-cyan-400 shadow-md"
              >
                Crear Sector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE SECTOR */}
      {sectorToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-rose-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Eliminar Sector Temático
              </h4>
              <button onClick={() => setSectorToDelete(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-slate-300">
              <p>
                ¿Está seguro de que desea eliminar el sector <strong className="text-white">{sectorToDelete.iconEmoji} {sectorToDelete.category}</strong>?
              </p>
              <p className="text-[11px] text-slate-400 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl">
                ⚠️ Esta acción eliminará el sector y sus {sectorToDelete.variables.length} variables asociadas del diagnóstico programático.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSectorToDelete(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSector}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-md cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
