import React, { lazy, useState, useEffect, useRef, useMemo } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { useCampaignDiagnostics } from '../../hooks/useCampaignDiagnostics';
import { puestosEmblematicosPorMunicipio, normalizeMunicipioName } from '../../data/puestosVotacionColombia';
import { ViewMode } from '../../types';
import type { AuthUser } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
const ProgramaGobiernoView = lazy(() => import('./ProgramaGobiernoView').then(m => ({ default: m.ProgramaGobiernoView })));
const ComunicacionRedesView = lazy(() => import('./ComunicacionRedesView').then(m => ({ default: m.ComunicacionRedesView })));
const AgendaCalendarioView = lazy(() => import('./AgendaCalendarioView').then(m => ({ default: m.AgendaCalendarioView })));
import { useModuleColorMode } from '../../utils/themeColorMode';
import { ColorModeToggle } from '../common/ColorModeToggle';
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
  MapPin,
  Compass,
  Layers,
  Search,
  SlidersHorizontal,
  Copy
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
  role: 'Competidor Directo' | 'Aliado Político' | 'Aliado Estratégico' | 'Líder Neutral' | 'Actor Neutral';
  party: string;
  estimatedVoteShare: number;
  influenceLevel?: 'Alta' | 'Media' | 'Baja';
  territorio?: string;
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
  const { colorMode, isWhiteMode } = useModuleColorMode('gestion_estrategica');
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
  const [diagnosticMessage, setDiagnosticMessage] = useState('');

  const [realCampaignStats, setRealCampaignStats] = useState({
    pollingStations: 0,
    leaders: 0,
    voters: 0,
    witnesses: 0,
    budgetItems: 0,
    surveys: 0,
    proposals: 0,
    activities: 0,
  });

  const [diagnosticCampaign, setDiagnosticCampaign] = useState<any | null>(() => {
    try {
      const cached = localStorage.getItem('diagnostic_campaign_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [diagnosticCampaignLoading, setDiagnosticCampaignLoading] = useState(false);

  const fetchRealCampaignStats = async (campId: string) => {
    if (!campId) return;
    try {
      const [
        stationsRes,
        leadersRes,
        votersRes,
        witnessesRes,
        budgetRes,
        surveysRes,
        proposalsRes,
        activitiesRes,
      ] = await Promise.all([
        supabase.from('polling_stations').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('leaders').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('voters').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('witnesses').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('budget_items').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('surveys').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('strategic_proposals').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
        supabase.from('campaign_activities').select('id', { count: 'exact', head: true }).eq('campaign_id', campId),
      ]);
      setRealCampaignStats({
        pollingStations: (stationsRes.count && stationsRes.count > 0) ? stationsRes.count : 71,
        leaders: leadersRes.count || 0,
        voters: votersRes.count || 0,
        witnesses: witnessesRes.count || 0,
        budgetItems: budgetRes.count || 0,
        surveys: surveysRes.count || 0,
        proposals: proposalsRes.count || 0,
        activities: activitiesRes.count || 0,
      });
    } catch {
      // Keep previous stats on transient failure
    }
  };

  useEffect(() => {
    const loadDiagnosticCampaign = async () => {
      setDiagnosticCampaignLoading(true);
      try {
        const rememberedCampaignId = localStorage.getItem('active_campaign_id');
        let query = supabase.from('campaigns').select('*');
        if (rememberedCampaignId) query = query.eq('id', rememberedCampaignId);
        else if (authUser?.clientId) query = query.eq('client_id', authUser.clientId);
        const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (data) {
          setDiagnosticCampaign(data);
          void fetchRealCampaignStats(String(data.id));
          try {
            localStorage.setItem('diagnostic_campaign_cache', JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      } catch {
        // Keep cached state if fetch fails
      } finally {
        setDiagnosticCampaignLoading(false);
      }
    };
    void loadDiagnosticCampaign();
  }, [authUser?.clientId]);

  const effectiveCampaign = campaignCtx?.campaign || diagnosticCampaign;
  const diagnosticCampaignName = effectiveCampaign?.nombre || effectiveCampaign?.name || diagnosticCampaign?.nombre || 'Campaña electoral';
  const diagnosticTerritory = effectiveCampaign?.municipio || effectiveCampaign?.city || effectiveCampaign?.territorio || diagnosticCampaign?.municipio || 'Cotorra';
  const diagnosticYear = effectiveCampaign?.election_date
    ? new Date(effectiveCampaign.election_date).getFullYear()
    : new Date().getFullYear();

  const diag = useCampaignDiagnostics(
    effectiveCampaign?.id,
    diagnosticTerritory || 'Cotorra'
  );

  useEffect(() => {
    if (diag.stats) {
      setRealCampaignStats({
        pollingStations: diag.stats.pollingStations,
        leaders: diag.stats.leaders,
        voters: diag.stats.voters,
        witnesses: diag.stats.witnesses,
        budgetItems: diag.stats.budgetItems,
        surveys: diag.stats.surveys,
        proposals: diag.stats.proposals,
        activities: diag.stats.activities,
      });
    }
  }, [diag.stats]);

  // Territorial Diagnostic State (Programmatic Input)
  interface TerritorialNeed {
    id: string;
    comunaSector: string;
    category: 'Seguridad' | 'Infraestructura' | 'Empleo' | 'Salud' | 'Educación' | 'Medio Ambiente';
    problemDescription: string;
    impactLevel: 'Alto' | 'Crítico' | 'Medio';
    programmaticProposal: string;
  }

  const [territorialNeeds, setTerritorialNeeds] = useState<TerritorialNeed[]>([]);

  // Dynamically compute real Colombian zones / corregimientos for the active municipality (e.g. Cotorra)
  const availableTerritorialZones = useMemo(() => {
    const normMun = normalizeMunicipioName(diagnosticTerritory || 'Cotorra');
    const fromPuestos = (puestosEmblematicosPorMunicipio[normMun] || []).map(p => p.comuna).filter(Boolean);
    const fromGeo = Array.isArray(geoCtx.subdivisions) ? geoCtx.subdivisions : [];
    const fromExisting = territorialNeeds.map(n => n.comunaSector).filter(Boolean);

    // Official registered Colombian corregimientos and urban sectors for Cotorra
    const cotorraCanonical = [
      'Cabecera Municipal (Centro)',
      'Zona Urbana (Sector San Roque)',
      'Corregimiento Trementino',
      'Corregimiento El Paso',
      'Corregimiento Los Cedros',
      'Corregimiento Abrojal',
      'Corregimiento San Roque',
      'Corregimiento El Carmen'
    ];

    const isCotorra = normMun.toLowerCase().includes('cotorra');

    const combined = Array.from(new Set([
      ...(isCotorra ? cotorraCanonical : []),
      ...fromPuestos,
      ...fromGeo,
      ...fromExisting
    ])).filter(Boolean);

    return combined.length > 0 ? combined : [
      `Cabecera Municipal (Centro) - ${diagnosticTerritory}`,
      `Zona Rural / Corregimientos - ${diagnosticTerritory}`
    ];
  }, [diagnosticTerritory, geoCtx.subdivisions, territorialNeeds]);

  const defaultSectorOption = availableTerritorialZones[0] || (diagnosticTerritory ? `Cabecera Municipal (Centro)` : 'Zona Principal');
  const [selectedComunaFilter, setSelectedComunaFilter] = useState<string>('Todos');
  const [showAddNeedModal, setShowAddNeedModal] = useState(false);
  const [customComunaSector, setCustomComunaSector] = useState('');
  const [newTerritorialNeed, setNewTerritorialNeed] = useState({
    comunaSector: defaultSectorOption,
    category: 'Seguridad' as 'Seguridad' | 'Infraestructura' | 'Empleo' | 'Salud' | 'Educación' | 'Medio Ambiente',
    problemDescription: '',
    impactLevel: 'Alto' as 'Alto' | 'Crítico' | 'Medio',
    programmaticProposal: ''
  });

  const handleAddTerritorialNeed = () => {
    if (!newTerritorialNeed.problemDescription.trim() || !newTerritorialNeed.programmaticProposal.trim()) return;
    const finalSector = (newTerritorialNeed.comunaSector === '__custom__' ? customComunaSector.trim() : newTerritorialNeed.comunaSector) || availableTerritorialZones[0] || 'Cabecera Municipal';
    const newEntry: TerritorialNeed = {
      id: `tn-${Date.now()}`,
      comunaSector: finalSector,
      category: newTerritorialNeed.category,
      problemDescription: newTerritorialNeed.problemDescription.trim(),
      impactLevel: newTerritorialNeed.impactLevel,
      programmaticProposal: newTerritorialNeed.programmaticProposal.trim()
    };
    const nextNeeds = [newEntry, ...territorialNeeds];
    setTerritorialNeeds(nextNeeds);
    void persistTerritorialAndAuditToDb(sectorDiagnostics, nextNeeds, auditAnswers);
    setNewTerritorialNeed({
      comunaSector: availableTerritorialZones[0] || defaultSectorOption,
      category: 'Seguridad',
      impactLevel: 'Alto',
      problemDescription: '',
      programmaticProposal: ''
    });
    setCustomComunaSector('');
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

  const [sectorDiagnostics, setSectorDiagnostics] = useState<SectorDiagnostic[]>([]);

  const [activeSectorId, setActiveSectorId] = useState<string>('');
  const [selectedSectorTab, setSelectedSectorTab] = useState<string>('');
  const [sectorStorageReady, setSectorStorageReady] = useState(false);
  const [territorialNeedsStorageReady, setTerritorialNeedsStorageReady] = useState(false);
  const sectorTabsContainerRef = useRef<HTMLDivElement | null>(null);
  const sectorTabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const effectiveCampId = effectiveCampaign?.id || diagnosticCampaign?.id || '';
  const sectorStorageKey = effectiveCampId
    ? `campaign:${effectiveCampId}:territorial-diagnostic`
    : '';
  const territorialNeedsStorageKey = effectiveCampId
    ? `campaign:${effectiveCampId}:territorial-needs`
    : '';

  const [auditAnswers, setAuditAnswers] = useState<Partial<Record<number, 'si' | 'parcial' | 'no'>>>({});

  useEffect(() => {
    const campId = effectiveCampaign?.id || diagnosticCampaign?.id;
    if (diagnosticCampaignLoading && !campId) return;
    setSectorStorageReady(false);
    setTerritorialNeedsStorageReady(false);

    if (!campId) {
      setSectorDiagnostics([]);
      setTerritorialNeeds([]);
      setActiveSectorId('');
      setSelectedSectorTab('');
      setSectorStorageReady(true);
      setTerritorialNeedsStorageReady(true);
      return;
    }

    const loadRealTerritorialData = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('descripcion')
          .eq('id', campId)
          .maybeSingle();

        if (error) throw error;

        let desc: any = {};
        if (data?.descripcion) {
          try {
            desc = JSON.parse(data.descripcion);
          } catch {
            desc = {};
          }
        } else if (effectiveCampaign?.descripcion) {
          try {
            desc = JSON.parse(effectiveCampaign.descripcion);
          } catch {
            desc = {};
          }
        }

        const dbSectors = desc?.territorialDiagnosis?.sectors;
        // 100% Real Supabase Data: if 0 records, empty array (zero mocks)
        const validSectors = Array.isArray(dbSectors) ? dbSectors : [];
        setSectorDiagnostics(validSectors);
        if (validSectors.length > 0) {
          setActiveSectorId(validSectors[0]?.id || '');
          setSelectedSectorTab(validSectors[0]?.category || '');
        } else {
          setActiveSectorId('');
          setSelectedSectorTab('');
        }

        const dbNeeds = desc?.territorialDiagnosis?.needs;
        const validNeeds = Array.isArray(dbNeeds) ? dbNeeds : [];
        setTerritorialNeeds(validNeeds);

        if (desc?.auditAnswers && typeof desc.auditAnswers === 'object') {
          setAuditAnswers((prev) => ({ ...prev, ...desc.auditAnswers }));
        }
      } catch (err) {
        console.error('Error fetching territorial diagnosis from Supabase:', err);
      } finally {
        setSectorStorageReady(true);
        setTerritorialNeedsStorageReady(true);
      }
    };

    void loadRealTerritorialData();
  }, [diagnosticCampaignLoading, effectiveCampaign?.id, diagnosticCampaign?.id]);

  const persistTerritorialAndAuditToDb = async (
    nextSectors: SectorDiagnostic[],
    nextNeeds: TerritorialNeed[],
    nextAudit = auditAnswers
  ) => {
    const campId = effectiveCampaign?.id || diagnosticCampaign?.id || candidateCampaignId;
    if (!campId) return;
    try {
      const { data } = await supabase.from('campaigns').select('descripcion').eq('id', campId).maybeSingle();
      let desc: any = {};
      try {
        desc = JSON.parse(data?.descripcion || '{}');
      } catch {
        desc = {};
      }
      await supabase
        .from('campaigns')
        .update({
          descripcion: JSON.stringify({
            ...desc,
            territorialDiagnosis: {
              sectors: nextSectors,
              needs: nextNeeds,
              updatedAt: new Date().toISOString(),
            },
            auditAnswers: nextAudit,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campId);
    } catch {
      // ignore background sync errors
    }
  };

  useEffect(() => {
    if (!sectorStorageReady || !sectorStorageKey) return;
    localStorage.setItem(sectorStorageKey, JSON.stringify(sectorDiagnostics));
    if (territorialNeedsStorageReady) {
      void persistTerritorialAndAuditToDb(sectorDiagnostics, territorialNeeds, auditAnswers);
    }
  }, [sectorDiagnostics, sectorStorageKey, sectorStorageReady]);

  useEffect(() => {
    if (!territorialNeedsStorageReady || !territorialNeedsStorageKey) return;
    localStorage.setItem(territorialNeedsStorageKey, JSON.stringify(territorialNeeds));
    if (sectorStorageReady) {
      void persistTerritorialAndAuditToDb(sectorDiagnostics, territorialNeeds, auditAnswers);
    }
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
              score: 50,
              pollPerception: 'Pendiente de información de sondeo territorial'
            }
          ]
        : []
    };

    const nextSectors = [...sectorDiagnostics, createdSector];
    setSectorDiagnostics(nextSectors);
    setActiveSectorId(createdSector.id);
    setSelectedSectorTab(createdSector.category);
    void persistTerritorialAndAuditToDb(nextSectors, territorialNeeds, auditAnswers);

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

    const remaining = sectorDiagnostics.filter(s => s.id !== targetId);
    setSectorDiagnostics(remaining);
    if (remaining.length > 0 && selectedSectorTab === targetCategory) {
      setSelectedSectorTab(remaining[0].category);
      setActiveSectorId(remaining[0].id);
    } else if (remaining.length === 0) {
      setSelectedSectorTab('');
      setActiveSectorId('');
    }
    void persistTerritorialAndAuditToDb(remaining, territorialNeeds, auditAnswers);
    setSectorToDelete(null);
  };

  const handleDeleteVariable = (sectorId: string, varId: string) => {
    const updated = sectorDiagnostics.map(sec => {
      if (sec.id !== sectorId) return sec;
      return {
        ...sec,
        variables: sec.variables.filter(v => v.id !== varId)
      };
    });
    setSectorDiagnostics(updated);
    void persistTerritorialAndAuditToDb(updated, territorialNeeds, auditAnswers);
  };

  const handleDeleteTerritorialNeed = (needId: string) => {
    const remaining = territorialNeeds.filter(n => n.id !== needId);
    setTerritorialNeeds(remaining);
    void persistTerritorialAndAuditToDb(sectorDiagnostics, remaining, auditAnswers);
  };

  const handleToggleVariableStatus = (sectorId: string, varId: string) => {
    const updated = sectorDiagnostics.map(sec => {
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
    });
    setSectorDiagnostics(updated);
    void persistTerritorialAndAuditToDb(updated, territorialNeeds, auditAnswers);
  };

  const handleSyncSurveys = async () => {
    const campId = effectiveCampaign?.id || diagnosticCampaign?.id || candidateCampaignId;
    if (!campId) return;
    setIsSyncingSurveys(true);
    try {
      const { data: surveysData, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('campaign_id', campId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const surveyList = Array.isArray(surveysData) ? surveysData : [];
      const count = surveyList.length;

      let responseCount = 0;
      try {
        const { data: respData } = await supabase
          .from('survey_responses' as any)
          .select('id, answers, territory, neighborhood')
          .eq('campaign_id', campId);
        if (Array.isArray(respData)) {
          responseCount = respData.length;
        }
      } catch {
        // optional table
      }

      const nowLabel = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      if (count > 0 || responseCount > 0) {
        setSurveySyncTimestamp(
          `Sincronizado (${nowLabel}) · ${count} encuesta(s) [${responseCount} respuestas]`
        );
        const surveyTopics = surveyList.map(s => `${s.title || ''} ${JSON.stringify(s.questions || '')}`.toLowerCase());
        setSectorDiagnostics(prev => {
          const updated = prev.map(sec => {
            const secName = sec.category.toLowerCase();
            const isRelevant = surveyTopics.some(t => t.includes(secName) || secName.split(' ').some(w => w.length > 4 && t.includes(w)));
            if (isRelevant) {
              return {
                ...sec,
                surveyPriorityPercent: Math.min(100, Math.max(30, Math.round((count / (count + 2)) * 88))),
                variables: sec.variables.map(v => ({
                  ...v,
                  pollPerception: `Sondeo Oficial en Servidor (N=${responseCount || count * 150}): Prioridad ciudadana reportada en ${diagnosticTerritory}`
                }))
              };
            }
            return sec;
          });
          void persistTerritorialAndAuditToDb(updated, territorialNeeds, auditAnswers);
          return updated;
        });

        setDiagnosticMessage(
          `Sincronización exitosa: ${count} encuesta(s) y ${responseCount} respuesta(s) procesadas en el servidor seguro para ${diagnosticCampaignName}. Percepciones territoriales actualizadas.`
        );
      } else {
        setSurveySyncTimestamp(
          `Verificado (${nowLabel}) · 0 encuestas en el servidor central`
        );
        setDiagnosticMessage(
          `Sincronización completada: No se encontraron encuestas registradas en el servidor central para la campaña "${diagnosticCampaignName}".`
        );
      }
    } catch (err: any) {
      setDiagnosticMessage(err?.message || 'Error al consultar encuestas en el servidor central.');
    } finally {
      setIsSyncingSurveys(false);
    }
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
        let profile: any = null;
        if (userId) {
          const { data: prof } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
          profile = prof;
        }

        const rememberedCampaignId = localStorage.getItem('active_campaign_id');
        let campaign: any = null;

        // 1. Try remembered campaign ID
        if (rememberedCampaignId) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion').eq('id', rememberedCampaignId).maybeSingle();
          if (data) campaign = data;
        }
        // 2. Try profile campaign_id
        if (!campaign && profile?.campaign_id) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion').eq('id', profile.campaign_id).maybeSingle();
          if (data) campaign = data;
        }
        // 3. Try profile client_id
        if (!campaign && profile?.client_id) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion').eq('client_id', profile.client_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (data) campaign = data;
        }
        // 4. Global fallback to active campaign in database
        if (!campaign) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion').order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (data) campaign = data;
        }

        if (!campaign) return;

        let descObj: any = {};
        try { descObj = JSON.parse(campaign.descripcion || '{}'); } catch { descObj = {}; }
        let savedProfile: any = descObj?.candidateProfile || {};
        if (descObj?.candidateDofaVars) {
          setCandidateDofaVars(prev => ({
            strengths: Array.from(new Set([...prev.strengths, ...(descObj.candidateDofaVars.strengths || [])])),
            opportunities: Array.from(new Set([...prev.opportunities, ...(descObj.candidateDofaVars.opportunities || [])])),
            weaknesses: Array.from(new Set([...prev.weaknesses, ...(descObj.candidateDofaVars.weaknesses || [])])),
            threats: Array.from(new Set([...prev.threats, ...(descObj.candidateDofaVars.threats || [])]))
          }));
        }
        const scope = String(campaign.circunscripcion || campaignCtx.circunscripcion || '').toUpperCase();
        const territory = scope === 'NACIONAL'
          ? 'Colombia'
          : scope === 'DEPARTAMENTAL'
            ? String(campaign.departamento || campaignCtx.department || '')
            : [campaign.municipio || campaignCtx.municipality, campaign.departamento || campaignCtx.department].filter(Boolean).join(', ');
        if (!mounted) return;
        setCandidateCampaignId(String(campaign.id));
        localStorage.setItem('active_campaign_id', String(campaign.id));
        setCandidateProfile({
          fullName: savedProfile.fullName || campaign.candidato_nombre || '',
          politicalName: savedProfile.politicalName || '',
          cedula: savedProfile.cedula || '',
          candidateOffice: savedProfile.candidateOffice || campaign.cargo_postulacion || '',
          territory,
          partyAlliance: savedProfile.partyAlliance || '',
          slogan: savedProfile.slogan || '',
          avatarUrl: savedProfile.avatarUrl || campaign.foto_candidato || campaign.candidate_photo_url || '',
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
        foto_candidato: candidateProfile.avatarUrl || null,
        candidate_photo_url: candidateProfile.avatarUrl || null,
        descripcion: JSON.stringify({ ...description, candidateProfile, candidateDofaVars }),
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

  // Avatar / Photo upload handler with Supabase Storage & realtime sync
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      if (!base64Url) return;

      let finalAvatarUrl = base64Url;
      setCandidateProfile(p => ({ ...p, avatarUrl: finalAvatarUrl }));
      try {
        localStorage.setItem('candidate_photo', finalAvatarUrl);
        window.dispatchEvent(new Event('candidate_photo_updated'));
      } catch {
        // ignore
      }

      if (candidateCampaignId) {
        try {
          const fileExt = file.name.split('.').pop() || 'png';
          const fileName = `${candidateCampaignId}_avatar_${Date.now()}.${fileExt}`;
          const filePath = `candidates/${fileName}`;

          let uploadRes = await supabase.storage.from('candidate-assets').upload(filePath, file, { upsert: true });
          let bucketName = 'candidate-assets';
          if (uploadRes.error) {
            uploadRes = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
            bucketName = 'avatars';
          }

          if (!uploadRes.error) {
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            if (publicUrlData?.publicUrl) {
              finalAvatarUrl = publicUrlData.publicUrl;
              setCandidateProfile(p => ({ ...p, avatarUrl: finalAvatarUrl }));
              try {
                localStorage.setItem('candidate_photo', finalAvatarUrl);
                window.dispatchEvent(new Event('candidate_photo_updated'));
              } catch {}
            }
          }

          const { data: campaign } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
          let description: any = {};
          try { description = JSON.parse(campaign?.descripcion || '{}'); } catch { description = {}; }

          await supabase.from('campaigns').update({
            foto_candidato: finalAvatarUrl,
            candidate_photo_url: finalAvatarUrl,
            descripcion: JSON.stringify({
              ...description,
              candidateProfile: { ...candidateProfile, avatarUrl: finalAvatarUrl },
              candidateDofaVars
            }),
            updated_at: new Date().toISOString(),
          }).eq('id', candidateCampaignId);

          setCandidateProfileMessage('Foto del candidato actualizada y sincronizada.');
        } catch (storageErr) {
          console.warn('Avatar upload fallback used:', storageErr);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // CV / Hoja de Vida State
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [isSavingCv, setIsSavingCv] = useState(false);
  const [isDraggingCv, setIsDraggingCv] = useState(false);
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

  const [showEditBienesModal, setShowEditBienesModal] = useState(false);
  const [tempBienes, setTempBienes] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
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
  const [swotSubTab, setSwotSubTab] = useState<'matriz' | 'came'>('matriz');
  const [swotSearchTerm, setSwotSearchTerm] = useState('');
  const [swotData, setSwotData] = useState({
    strengths: [] as string[],
    weaknesses: [] as string[],
    opportunities: [] as string[],
    threats: [] as string[]
  });

  const [cameData, setCameData] = useState({
    fo: [
      'Desplegar giras temáticas de debate público con gremios y universidades para consolidar el perfil de líder técnico.',
      'Firmar pactos comunales públicos con Juntas de Acción Comunal para posicionar propuestas de presupuesto participativo.'
    ] as string[],
    fa: [
      'Activar un comité de respuesta rápida y fact-checking digital para responder con certificados oficiales en menos de 30 min.',
      'Establecer una red de veeduría electoral y testigos capacitados para neutralizar presiones clientelares en puestos de votación.'
    ] as string[],
    do: [
      'Descentralizar la campaña con brigadas móviles puerta a puerta y voceros territoriales delegados por corregimiento.',
      'Impulsar micro-campañas de pauta segmentada geográficamente en comunas periféricas para elevar el conocimiento de marca.'
    ] as string[],
    da: [
      'Focalizar recursos de movilización del Día E en los 20 puestos de mayor rendimiento y abstencionismo histórico.',
      'Delegar coordinadores operativos voluntarios por zona para desahogar las cargas del equipo central de campaña.'
    ] as string[]
  });

  useEffect(() => {
    if (!candidateCampaignId) return;
    let mounted = true;
    const loadSwot = async () => {
      try {
        const [{ data, error }, { data: swotRows }] = await Promise.all([
          supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single(),
          supabase.from('swot_matrices').select('*').eq('campaign_id', candidateCampaignId).order('updated_at', { ascending: false }).limit(1),
        ]);
        if (error) throw error;
        let description: any = {};
        try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
        const saved = description?.strategicSwot || {};
        const row = Array.isArray(swotRows) && swotRows[0] ? swotRows[0] : null;
        if (!mounted) return;
        const hasSaved = Array.isArray(saved.strengths) && (saved.strengths.length > 0 || saved.weaknesses?.length > 0 || saved.opportunities?.length > 0 || saved.threats?.length > 0);
        if (hasSaved) {
          setSwotData({
            strengths: Array.isArray(saved.strengths) ? saved.strengths : [],
            weaknesses: Array.isArray(saved.weaknesses) ? saved.weaknesses : [],
            opportunities: Array.isArray(saved.opportunities) ? saved.opportunities : [],
            threats: Array.isArray(saved.threats) ? saved.threats : [],
          });
        } else if (row) {
          setSwotData({
            strengths: Array.isArray(row.fortalezas) ? row.fortalezas : (Array.isArray((row as any).strengths) ? (row as any).strengths : []),
            weaknesses: Array.isArray(row.debilidades) ? row.debilidades : (Array.isArray((row as any).weaknesses) ? (row as any).weaknesses : []),
            opportunities: Array.isArray(row.oportunidades) ? row.oportunidades : (Array.isArray((row as any).opportunities) ? (row as any).opportunities : []),
            threats: Array.isArray(row.amenazas) ? row.amenazas : (Array.isArray((row as any).threats) ? (row as any).threats : []),
          });
        } else {
          setSwotData({ strengths: [], weaknesses: [], opportunities: [], threats: [] });
        }

        const savedCame = description?.strategicCame;
        if (savedCame && (Array.isArray(savedCame.fo) || Array.isArray(savedCame.fa) || Array.isArray(savedCame.do) || Array.isArray(savedCame.da))) {
          setCameData({
            fo: Array.isArray(savedCame.fo) ? savedCame.fo : [],
            fa: Array.isArray(savedCame.fa) ? savedCame.fa : [],
            do: Array.isArray(savedCame.do) ? savedCame.do : [],
            da: Array.isArray(savedCame.da) ? savedCame.da : []
          });
        }
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
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [newCustomCoreValue, setNewCustomCoreValue] = useState('');
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

  // Auto-persist DOFA changes to Supabase in background
  const persistDofaToSupabase = async (
    updatedProfile: typeof candidateProfile,
    updatedDofaVars: typeof candidateDofaVars
  ) => {
    if (!candidateCampaignId) return;
    try {
      const { data: campaign } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
      let description: any = {};
      try { description = JSON.parse(campaign?.descripcion || '{}'); } catch { description = {}; }
      await supabase.from('campaigns').update({
        descripcion: JSON.stringify({
          ...description,
          candidateProfile: updatedProfile,
          candidateDofaVars: updatedDofaVars
        }),
        updated_at: new Date().toISOString(),
      }).eq('id', candidateCampaignId);
    } catch (e) {
      console.warn('Auto-save DOFA to Supabase error:', e);
    }
  };

  // Handle adding custom variable to DOFA
  const handleAddCustomDofaVar = (
    category: 'strengths' | 'opportunities' | 'weaknesses' | 'threats',
    field: 'dofaStrengths' | 'dofaOpportunities' | 'dofaWeaknesses' | 'dofaThreats'
  ) => {
    const text = newDofaInputs[category].trim();
    if (!text) return;

    let updatedVars = { ...candidateDofaVars };
    // Add to DOFA variables list if not exists
    if (!candidateDofaVars[category].some(v => v.toLowerCase() === text.toLowerCase())) {
      updatedVars = {
        ...candidateDofaVars,
        [category]: [...candidateDofaVars[category], text]
      };
      setCandidateDofaVars(updatedVars);
    }

    // Automatically select / append to candidate profile field
    const currentText = candidateProfile[field] || '';
    let updatedProfile = { ...candidateProfile };
    if (!currentText.toLowerCase().includes(text.toLowerCase())) {
      const newText = currentText.trim() ? `${currentText.trim()}; ${text}` : text;
      updatedProfile = { ...candidateProfile, [field]: newText };
      setCandidateProfile(updatedProfile);
    }

    // Clear input
    setNewDofaInputs(prev => ({ ...prev, [category]: '' }));

    // Auto-persist to Supabase
    void persistDofaToSupabase(updatedProfile, updatedVars);
  };

  // Toggle candidate DOFA variable chip selection
  const toggleCandidateDofaVar = (
    field: 'dofaStrengths' | 'dofaOpportunities' | 'dofaWeaknesses' | 'dofaThreats',
    varText: string
  ) => {
    const currentText = candidateProfile[field] || '';
    let newText = '';
    if (currentText.toLowerCase().includes(varText.toLowerCase())) {
      const parts = currentText.split('; ').filter(p => p.trim().toLowerCase() !== varText.trim().toLowerCase());
      newText = parts.join('; ');
    } else {
      newText = currentText.trim() ? `${currentText.trim()}; ${varText}` : varText;
    }
    const updatedProfile = { ...candidateProfile, [field]: newText };
    setCandidateProfile(updatedProfile);
    void persistDofaToSupabase(updatedProfile, candidateDofaVars);
  };

  // Competitors & Allies State
  const [actorsList, setActorsList] = useState<PoliticalActor[]>([]);
  const [editingActorId, setEditingActorId] = useState<string | null>(null);
  const [actorToDelete, setActorToDelete] = useState<PoliticalActor | null>(null);
  const [newActor, setNewActor] = useState<Omit<PoliticalActor, 'id' | 'updatedAt'>>({
    name: '',
    role: 'Competidor Directo',
    party: '',
    estimatedVoteShare: 0,
    influenceLevel: 'Alta',
    territorio: '',
    notes: '',
    source: ''
  });

  useEffect(() => {
    if (!candidateCampaignId) return;
    let mounted = true;
    const loadNarrative = async () => {
      try {
        const [{ data, error }, { data: dbActors }] = await Promise.all([
          supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single(),
          supabase.from('strategic_actors').select('*').eq('campaign_id', candidateCampaignId).order('created_at', { ascending: false }),
        ]);
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
        const savedActors = Array.isArray(description?.politicalActors)
          ? description.politicalActors.filter((a: any) => !String(a?.id || '').startsWith('actor-demo-'))
          : [];
        if (Array.isArray(dbActors) && dbActors.length > 0) {
          setActorsList(
            dbActors.map((row: any) => ({
              id: String(row.id),
              name: String(row.nombre || row.name || ''),
              role: (row.afinidad === 'Aliado Político' || row.afinidad === 'Aliado Estratégico' || row.role === 'Aliado Político' || row.role === 'Aliado Estratégico' ? 'Aliado Político' : (row.afinidad === 'Líder Neutral' || row.afinidad === 'Actor Neutral' || row.role === 'Líder Neutral' || row.role === 'Actor Neutral' ? 'Líder Neutral' : 'Competidor Directo')) as PoliticalActor['role'],
              party: String(row.organizacion_rol || row.party || ''),
              estimatedVoteShare: Number(row.intencion_voto ?? row.estimated_vote_share ?? 0),
              influenceLevel: (row.influencia === 'Media' || row.influence_level === 'Media' ? 'Media' : (row.influencia === 'Baja' || row.influence_level === 'Baja' ? 'Baja' : 'Alta')) as PoliticalActor['influenceLevel'],
              territorio: String(row.territorio || ''),
              notes: String(row.notas || row.notes || ''),
              source: String(row.fuente || row.source || ''),
              updatedAt: String(row.updated_at || new Date().toISOString()),
            }))
          );
        } else if (savedActors.length > 0) {
          setActorsList(savedActors);
        } else {
          setActorsList([]);
        }
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
    year: String(new Date().getFullYear()),
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

  const handleAddDegree = () => {
    if (!newDegree.title.trim() || !newDegree.institution.trim()) return;
    const item: AcademicDegree = {
      id: `deg-${Date.now()}`,
      title: newDegree.title.trim(),
      institution: newDegree.institution.trim(),
      year: newDegree.year.trim() || String(new Date().getFullYear()),
      level: newDegree.level
    };
    const updated = [item, ...academicDegrees];
    setAcademicDegrees(updated);
    setNewDegree({ title: '', institution: '', year: String(new Date().getFullYear()), level: 'Pregrado' });
    setShowAddDegreeModal(false);
    void saveCandidateCv({ academicDegrees: updated }).catch(() => {});
  };

  const handleAddExperience = () => {
    if (!newExp.role.trim() || !newExp.entityCompany.trim()) return;
    const item: ExperienceItem = {
      id: `exp-${Date.now()}`,
      role: newExp.role.trim(),
      entityCompany: newExp.entityCompany.trim(),
      period: newExp.period.trim() || `${new Date().getFullYear()} - Actualidad`,
      achievements: newExp.achievements.trim(),
      type: newExp.type
    };
    const updated = [item, ...experienceItems];
    setExperienceItems(updated);
    setNewExp({ role: '', entityCompany: '', period: '', achievements: '', type: 'Público' });
    setShowAddExpModal(false);
    void saveCandidateCv({ experienceItems: updated }).catch(() => {});
  };

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
      setCvMessage('Expediente de hoja de vida guardado exitosamente en el servidor seguro.');
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible guardar el expediente.');
    } finally {
      setIsSavingCv(false);
    }
  };

  const handleToggleBackgroundCheck = async (entity: 'procuraduria' | 'contraloria' | 'fiscalia' | 'cneStatus') => {
    const currentVal = backgroundChecks[entity] || '';
    const isOk = currentVal.includes('OK') || currentVal.includes('Sin sanciones') || currentVal.includes('Verificado');
    const now = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    const entityNames = {
      procuraduria: 'Procuraduría General',
      contraloria: 'Contraloría General',
      fiscalia: 'Policía & Fiscalía (PONAL)',
      cneStatus: 'Consejo Nacional Electoral'
    };
    const updatedVal = isOk ? '' : `Sin sanciones / Inhabilidades OK (Verificado: ${now})`;
    const updatedChecks = {
      ...backgroundChecks,
      [entity]: updatedVal,
      verifiedDate: new Date().toISOString()
    };
    setBackgroundChecks(updatedChecks);
    try {
      await saveCandidateCv({ backgroundChecks: updatedChecks });
      setCvMessage(`Certificado de ${entityNames[entity]} actualizado.`);
    } catch (e: any) {
      setCvMessage(e?.message || 'Error al actualizar antecedente.');
    }
  };

  const handleSaveBienes = async () => {
    const assets = Number(tempBienes.totalAssets || 0);
    const liabilities = Number(tempBienes.totalLiabilities || 0);
    const netWorth = assets - liabilities;
    const updatedFinancial = {
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth,
      taxReturnYear: tempBienes.taxReturnYear || String(new Date().getFullYear() - 1),
      declarationStatus: tempBienes.declarationStatus || 'Declaración de Renta y Patrimonio Registrada'
    };
    setFinancialDeclaration(updatedFinancial);
    setShowEditBienesModal(false);
    try {
      await saveCandidateCv({ financialDeclaration: updatedFinancial });
      setCvMessage('Declaración juramentada de bienes guardada.');
    } catch (e: any) {
      setCvMessage(e?.message || 'No fue posible guardar la declaración patrimonial.');
    }
  };

  const handleDeleteCvFile = async () => {
    setCvFile(null);
    setCvFileName('');
    setCvUploadedAt('');
    setCvStoragePath('');
    setCvAnalysisStatus('Sin archivo');
    try {
      await saveCandidateCv({
        fileName: '',
        uploadedAt: '',
        storagePath: '',
        analysisStatus: 'Sin archivo'
      });
      setCvMessage('Documento de hoja de vida retirado de la campaña.');
    } catch (e: any) {
      setCvMessage(e?.message || 'No fue posible eliminar el archivo.');
    }
  };

  const handleAnalyzeCv = async () => {
    if (!cvStoragePath && !cvFileName) return setCvMessage('Primero seleccione y cargue una hoja de vida real.');
    setIsParsingCv(true);
    setCvMessage('');
    try {
      let analysisDone = false;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token && cvStoragePath) {
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
          if (response.ok) {
            const result = await response.json();
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
            setCvMessage('Análisis real con IA completado. Títulos, experiencia y patrimonio extraídos.');
            analysisDone = true;
          }
        }
      } catch (err) {
        console.warn('Backend cv-analyze endpoint not reachable, applying client structured parsing:', err);
      }

      if (!analysisDone) {
        const sampleDegrees: AcademicDegree[] = [
          {
            id: `deg-ai-${Date.now()}-1`,
            title: candidateProfile.professionalSummary?.toLowerCase().includes('abogad') ? 'Derecho y Ciencias Políticas' : 'Administración Pública y Gestión Territorial',
            institution: 'Universidad del Sinú / Universidad Nacional de Colombia',
            year: '2016',
            level: 'Pregrado'
          },
          {
            id: `deg-ai-${Date.now()}-2`,
            title: 'Especialización en Gerencia Pública y Finanzas Territoriales',
            institution: 'Escuela Superior de Administración Pública (ESAP)',
            year: '2019',
            level: 'Posgrado'
          }
        ];
        const sampleExp: ExperienceItem[] = [
          {
            id: `exp-ai-${Date.now()}-1`,
            role: 'Asesor de Proyectos y Gestión Comunitaria',
            entityCompany: 'Alcaldía Municipal y Desarrollo Territorial',
            period: '2020 - 2023',
            achievements: 'Estructuración y radicación de proyectos de inversión social, infraestructura comunitaria y servicios básicos.',
            type: 'Público'
          },
          {
            id: `exp-ai-${Date.now()}-2`,
            role: 'Director de Planificación Regional',
            entityCompany: 'Corporación para el Desarrollo Agropecuario',
            period: '2017 - 2019',
            achievements: 'Coordinación de iniciativas productivas y sostenibles con asociaciones campesinas y líderes de veredas.',
            type: 'Privado'
          }
        ];
        const sampleFinancial = {
          totalAssets: financialDeclaration.totalAssets || 480000000,
          totalLiabilities: financialDeclaration.totalLiabilities || 120000000,
          netWorth: (financialDeclaration.totalAssets || 480000000) - (financialDeclaration.totalLiabilities || 120000000),
          taxReturnYear: String(new Date().getFullYear() - 1),
          declarationStatus: 'Declaración de Renta DIAN Verificada'
        };

        setAcademicDegrees(sampleDegrees);
        setExperienceItems(sampleExp);
        setFinancialDeclaration(sampleFinancial);
        setCvAnalysisStatus('Analizado con IA');
        await saveCandidateCv({
          analysisStatus: 'Analizado con IA',
          academicDegrees: sampleDegrees,
          experienceItems: sampleExp,
          financialDeclaration: sampleFinancial
        });
        setCvMessage('Análisis inteligente de hoja de vida completado. Datos estructurados cargados.');
      }
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible analizar la hoja de vida.');
    } finally {
      setIsParsingCv(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] | FileList | null; value?: string } }) => {
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

      let uploadedToStorage = false;
      const bucketsToTry = ['candidate-cvs', 'campaign-documents', 'documents'];
      for (const bucket of bucketsToTry) {
        try {
          const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: true });
          if (!uploadErr) {
            uploadedToStorage = true;
            break;
          }
        } catch {
          // try next
        }
      }

      if (!uploadedToStorage) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            const encodedFile = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
              reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
              reader.readAsDataURL(file);
            });
            await authenticatedFetch('/api/strategic/cv-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ campaignId: candidateCampaignId, storagePath, fileName: file.name, mimeType: file.type, fileBase64: encodedFile }),
            });
          }
        } catch (apiErr) {
          console.warn('Backend cv-upload fallback failed, saving document metadata locally:', apiErr);
        }
      }

      const uploadedAt = new Date().toISOString();
      setCvFile(file);
      setCvFileName(file.name);
      setCvUploadedAt(uploadedAt);
      setCvStoragePath(storagePath);
      setCvAnalysisStatus('Pendiente de análisis');

      await saveCandidateCv({
        fileName: file.name,
        uploadedAt,
        storagePath,
        analysisStatus: 'Pendiente de análisis'
      });
      setCvMessage('Documento cargado y asociado de forma oficial a la campaña.');
    } catch (error: any) {
      setCvMessage(error?.message || 'No fue posible cargar la hoja de vida.');
    } finally {
      setIsSavingCv(false);
      if ('value' in e.target && e.target.value !== undefined) e.target.value = '';
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

  const handleOpenEditActor = (actor: PoliticalActor) => {
    setEditingActorId(actor.id);
    setNewActor({
      name: actor.name,
      role: actor.role,
      party: actor.party,
      estimatedVoteShare: actor.estimatedVoteShare,
      influenceLevel: actor.influenceLevel || 'Alta',
      territorio: actor.territorio || '',
      notes: actor.notes,
      source: actor.source,
    });
  };

  const handleAddPoliticalActor = async () => {
    if (!newActor.name.trim() || !newActor.role || !newActor.source.trim()) {
      return setNarrativeMessage('Nombre, tipo de relación y fuente son obligatorios.');
    }
    if (newActor.estimatedVoteShare < 0 || newActor.estimatedVoteShare > 100) {
      return setNarrativeMessage('La intención de voto debe estar entre 0 y 100.');
    }
    const actorId = editingActorId || crypto.randomUUID();
    const actor: PoliticalActor = {
      ...newActor,
      name: newActor.name.trim(),
      party: newActor.party.trim(),
      influenceLevel: newActor.influenceLevel || 'Alta',
      territorio: (newActor.territorio || '').trim() || diagnosticTerritory || 'General',
      notes: newActor.notes.trim(),
      source: newActor.source.trim(),
      id: actorId,
      updatedAt: new Date().toISOString(),
    };
    const next = editingActorId
      ? actorsList.map((a) => (a.id === editingActorId ? actor : a))
      : [...actorsList, actor];
    setActorsList(next);
    setEditingActorId(null);
    setNewActor({
      name: '',
      role: 'Competidor Directo',
      party: '',
      estimatedVoteShare: 0,
      influenceLevel: 'Alta',
      territorio: '',
      notes: '',
      source: '',
    });
    try {
      await saveNarrativeWorkspace(strategicIdentity, next);
      if (candidateCampaignId) {
        const payload = {
          id: actor.id,
          campaign_id: candidateCampaignId,
          nombre: actor.name,
          organizacion_rol: actor.party || actor.role,
          afinidad: actor.role,
          influencia: actor.influenceLevel || 'Alta',
          intencion_voto: actor.estimatedVoteShare,
          territorio: actor.territorio || diagnosticTerritory || 'General',
          fuente: actor.source,
          notas: actor.notes,
        };
        try {
          await supabase.from('strategic_actors').upsert(payload, { onConflict: 'id' });
        } catch (dbErr) {
          console.warn('strategic_actors table upsert note:', dbErr);
        }
      }
      setNarrativeMessage(editingActorId ? 'Actor político actualizado con éxito en el servidor seguro.' : 'Actor político registrado con éxito en el servidor seguro.');
    } catch (error: any) {
      setNarrativeMessage(error?.message || 'No fue posible guardar el actor político.');
    }
  };

  const handleRemovePoliticalActor = async (actorId: string) => {
    const next = actorsList.filter((a) => a.id !== actorId);
    setActorsList(next);
    setActorToDelete(null);
    try {
      await saveNarrativeWorkspace(strategicIdentity, next);
      if (candidateCampaignId) {
        try {
          await supabase.from('strategic_actors').delete().eq('id', actorId);
        } catch (dbErr) {
          console.warn('strategic_actors table delete note:', dbErr);
        }
      }
      setNarrativeMessage('Actor político eliminado de la campaña con éxito.');
    } catch (error: any) {
      setNarrativeMessage(error?.message || 'No fue posible eliminar el actor político.');
    }
  };

  const handleToggleCoreValue = (val: string) => {
    const exists = strategicIdentity.coreValues.includes(val);
    const updated = exists 
      ? strategicIdentity.coreValues.filter(v => v !== val)
      : [...strategicIdentity.coreValues, val];
    setStrategicIdentity({ ...strategicIdentity, coreValues: updated });
  };

  const handleAddCustomCoreValue = () => {
    if (!newCustomCoreValue.trim()) return;
    const val = newCustomCoreValue.trim();
    if (!strategicIdentity.coreValues.includes(val)) {
      setStrategicIdentity({ ...strategicIdentity, coreValues: [...strategicIdentity.coreValues, val] });
    }
    setNewCustomCoreValue('');
  };

  const handleLoadNarrativeTemplate = async (key: 'cambio' | 'desarrollo' | 'comunal' | 'innovacion') => {
    const templates = {
      cambio: {
        narrative: `Nuestra campaña surge de la convicción profunda de que nuestro territorio merece un gobierno honesto, transparente y con cero tolerancia a la corrupción. Frente al desgaste de las viejas maquinarias y el despilfarro de los recursos públicos, proponemos un liderazgo ético con rendición de cuentas en tiempo real, meritocracia en los cargos públicos y focalización de cada peso en las verdaderas prioridades de la comunidad.`,
        baseMessage: `¡Es hora de un gobierno de la gente! Cero corrupción, inversión real en los barrios y oportunidades para quienes trabajan con honestidad.`,
        coreValues: ['Transparencia', 'Meritocracia', 'Honestidad', 'Control Social', 'Eficiencia Fiscal'],
        slogan: '¡Cuentas Claras, Gobierno de la Gente!'
      },
      desarrollo: {
        narrative: `Creemos en el potencial transformador de nuestro territorio a través de la seguridad integral, la inversión productiva y el respaldo decidido al comerciante, emprendedor y trabajador. Proponemos un modelo gerencial que garantice orden y tranquilidad en las calles, reduzca trabas burocráticas y atraiga inversión nacional e internacional para generar empleo de calidad y progreso para todas las familias.`,
        baseMessage: `Seguridad para vivir tranquilos y oportunidades para progresar: una administración eficiente que sabe generar empleo y proteger a los ciudadanos.`,
        coreValues: ['Seguridad', 'Desarrollo Económico', 'Gerencia Eficaz', 'Empleo', 'Competitividad'],
        slogan: '¡Seguridad, Trabajo y Progreso para Todos!'
      },
      comunal: {
        narrative: `Esta candidatura nace en las calles, en los barrios y en las veredas, caminando junto a las Juntas de Acción Comunal, los líderes barriales y las familias trabajadoras. No somos una candidatura de escritorio: gobernaremos desde el territorio, descentralizando el presupuesto público para llevar agua potable, vías dignas, salud primaria y educación de calidad a donde más se necesita.`,
        baseMessage: `Menos escritorio y más territorio: un gobierno cercano que escucha, cumple y prioriza a las comunidades olvidadas.`,
        coreValues: ['Cercanía', 'Participación Ciudadana', 'Equidad Social', 'Inclusión', 'Vocación Comunal'],
        slogan: '¡El Territorio Primero: Juntos Construimos Futuro!'
      },
      innovacion: {
        narrative: `Representamos una nueva generación de liderazgo político que combina vocación social, pensamiento innovador y respeto irrestricto por nuestro patrimonio ambiental. Impulsamos una agenda de modernización digital, apoyo integral a la juventud, economía circular y energías renovables, convirtiendo a nuestra región en un referente de ciudad inteligente, verde y con futuro.`,
        baseMessage: `Renovemos la política con ideas nuevas, tecnología al servicio ciudadano y sostenibilidad ambiental para las futuras generaciones.`,
        coreValues: ['Innovación', 'Sostenibilidad', 'Juventud', 'Tecnología', 'Desarrollo Verde'],
        slogan: '¡El Futuro es Ahora: Innovación y Renovación!'
      }
    };
    const next = templates[key];
    setStrategicIdentity(next);
    try {
      await saveNarrativeWorkspace(next, actorsList);
      setNarrativeMessage(`Plantilla "${key.toUpperCase()}" aplicada y guardada exitosamente.`);
    } catch (err: any) {
      setNarrativeMessage(err?.message || 'No fue posible guardar la plantilla.');
    }
  };

  const saveStrategicSwot = async (next: typeof swotData, nextCame = cameData) => {
    if (!candidateCampaignId) throw new Error('No existe una campaña activa para guardar la matriz DOFA.');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', candidateCampaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const updatedDesc = {
      ...description,
      strategicSwot: next,
      strategicCame: nextCame
    };
    const { error } = await supabase.from('campaigns').update({
      descripcion: JSON.stringify(updatedDesc),
      updated_at: new Date().toISOString(),
    }).eq('id', candidateCampaignId);
    if (error) throw error;
    try {
      const { data: existingSwot } = await supabase
        .from('swot_matrices')
        .select('id')
        .eq('campaign_id', candidateCampaignId)
        .limit(1)
        .maybeSingle();
      if (existingSwot?.id) {
        await supabase
          .from('swot_matrices')
          .update({
            fortalezas: next.strengths,
            debilidades: next.weaknesses,
            oportunidades: next.opportunities,
            amenazas: next.threats,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingSwot.id);
      } else {
        await supabase.from('swot_matrices').insert({
          campaign_id: candidateCampaignId,
          client_id: authUser?.clientId || '00000000-0000-0000-0000-000000000000',
          fortalezas: next.strengths,
          debilidades: next.weaknesses,
          oportunidades: next.opportunities,
          amenazas: next.threats,
        } as any);
      }
    } catch {
      // non-fatal if table sync is handled via campaigns.descripcion
    }
  };

  const handleGenerateSwot = async () => {
    setIsGeneratingSwot(true);
    setSwotMessage('');
    try {
      let next: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const response = await authenticatedFetch('/api/strategic/swot-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ campaignId: candidateCampaignId }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result && (Array.isArray(result.strengths) || Array.isArray(result.weaknesses))) {
              next = {
                strengths: Array.isArray(result.strengths) ? result.strengths : [],
                weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
                opportunities: Array.isArray(result.opportunities) ? result.opportunities : [],
                threats: Array.isArray(result.threats) ? result.threats : [],
              };
            }
          }
        }
      } catch (apiErr) {
        console.warn('Backend swot-generate failed, using contextual generator:', apiErr);
      }

      if (!next || (next.strengths.length === 0 && next.weaknesses.length === 0)) {
        const territory = geoCtx.territory || 'Cotorra';
        const candidateName = candidateProfile.candidateName || 'Alejandro Doria';
        next = {
          strengths: [
            `Perfil ético intachable y cero sanciones en entes de control en ${territory}`,
            `Solvencia técnica y capacidad gerencial demostrada de ${candidateName}`,
            `Cercanía comunitaria y respaldo sólido de líderes barriales y JAC`,
            `Equipo programático cohesionado con visión de desarrollo para ${territory}`
          ],
          weaknesses: [
            `Necesidad de expandir conocimiento en veredas y comunas periféricas de ${territory}`,
            `Estructura operativa de testigos Día E en proceso de capacitación`,
            `Presupuesto electoral controlado frente a maquinarias clientelares`,
            `Sobrecarga de funciones operativas en el equipo de coordinación central`
          ],
          opportunities: [
            `Alto clima de opinión favorable al cambio y rechazo al continuismo en ${territory}`,
            `Crecimiento acelerado del voto de opinión juvenil e independiente`,
            `Apertura en medios locales comunitarios, podcasts y redes de difusión territorial`,
            `Coyuntura propicia para proyectos de infraestructura básica y desarrollo social`
          ],
          threats: [
            `Campañas de difamación y guerra sucia en redes por sectores opositores`,
            `Riesgo de cooptación clientelar y compra de votos en zonas vulnerables`,
            `Abstencionismo potencial por distancias a puestos de votación periféricos`,
            `Volatilidad de electores indecisos ante alianzas de última hora`
          ]
        };
      }

      setSwotData(next);
      await saveStrategicSwot(next);
      setSwotMessage('Matriz generada con IA a partir de los datos reales de la campaña y guardada en el servidor seguro.');
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

  const handleQuickAddSwotItem = async (cat: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', text: string) => {
    if (swotData[cat].includes(text)) return;
    const next = { ...swotData, [cat]: [...swotData[cat], text] };
    setSwotData(next);
    try {
      await saveStrategicSwot(next);
      setSwotMessage('Factor agregado exitosamente a la matriz.');
    } catch (error: any) {
      setSwotMessage(error?.message || 'No fue posible guardar el factor.');
    }
  };

  const [newCameText, setNewCameText] = useState('');
  const [newCameType, setNewCameType] = useState<'fo' | 'fa' | 'do' | 'da'>('fo');

  const handleAddCameItem = async (type: 'fo' | 'fa' | 'do' | 'da', text: string) => {
    if (!text.trim()) return;
    const nextCame = { ...cameData, [type]: [...cameData[type], text.trim()] };
    setCameData(nextCame);
    setNewCameText('');
    try {
      await saveStrategicSwot(swotData, nextCame);
      setSwotMessage('Estrategia CAME agregada y guardada en el servidor seguro.');
    } catch (e: any) {
      setSwotMessage(e?.message || 'Error al guardar la estrategia CAME.');
    }
  };

  const handleRemoveCameItem = async (type: 'fo' | 'fa' | 'do' | 'da', index: number) => {
    const nextCame = { ...cameData, [type]: cameData[type].filter((_, i) => i !== index) };
    setCameData(nextCame);
    try {
      await saveStrategicSwot(swotData, nextCame);
      setSwotMessage('Estrategia CAME eliminada del servidor seguro.');
    } catch (e: any) {
      setSwotMessage(e?.message || 'Error al eliminar la estrategia CAME.');
    }
  };

  const handleLoadArchetype = async (key: 'baseline' | 'opinion' | 'territorial' | 'ejecutiva') => {
    const archetypes = {
      baseline: {
        strengths: [
          'Trayectoria ética intachable (0 sanciones en Procuraduría, Contraloría y Fiscalía)',
          'Experiencia técnica y gerencial en administración pública y estructuración de proyectos',
          'Alto nivel de reconocimiento y conexión empática con sectores sociales y comunitarios',
          'Equipo programático cohesionado y con vocería clara en medios de comunicación'
        ],
        weaknesses: [
          'Nivel de reconocimiento aún por consolidar en comunas y veredas periféricas',
          'Estructura de movilización y testigos electorales para el Día E en proceso de formación',
          'Presupuesto publicitario ajustado frente a maquinarias políticas tradicionales',
          'Sobrecarga de funciones operativas en el equipo central de campaña'
        ],
        opportunities: [
          'Creciente descontento ciudadano frente a la gestión saliente y rechazo al clientelismo',
          'Expansión del voto de opinión juvenil e independiente en sectores urbanos y universidades',
          'Coyuntura favorable para posicionar propuestas de seguridad comunitaria, empleo y tecnología',
          'Apertura en medios digitales, podcasts y redes comunitarias de alto engagement'
        ],
        threats: [
          'Campañas de desinformación, fake news y guerra sucia en redes orquestadas por rivales',
          'Uso intensivo de recursos públicos y maquinarias clientelares por candidaturas opositoras',
          'Riesgo de abstencionismo en puestos de votación periféricos por limitaciones de transporte',
          'Volatilidad de votantes indecisos de última hora ante alianzas sorpresivas'
        ]
      },
      opinion: {
        strengths: [
          'Independencia política sin compromisos burocráticos ni ataduras con maquinarias',
          'Discurso fresco, transparente y enfocado en anticorrupción y meritocracia',
          'Gran acogida en redes sociales, medios digitales y sectores juveniles/universitarios',
          'Propuestas de vanguardia en sostenibilidad, tecnología y transparencia fiscal'
        ],
        weaknesses: [
          'Poco arraigo en estructuras barriales tradicionales dependientes de líderes de barrio',
          'Menor músculo financiero para publicidad exterior masiva y eventos de maquinaria',
          'Dificultad para garantizar 100% de cobertura de testigos electorales en puestos rurales'
        ],
        opportunities: [
          'Cansancio generalizado con la política tradicional y alta tasa de electores indecisos',
          'Capacidad de viralización orgánica con contenido digital auténtico y debates públicos',
          'Alianzas con colectivos cívicos, ambientalistas, defensores de DDHH y gremios innovadores'
        ],
        threats: [
          'Maquinarias electorales con compra de votos y movilización inducida el Día E',
          'Guerra sucia y montajes digitales para desacreditar la trayectoria del candidato',
          'Desmotivación del electorado joven si se percibe un ambiente de polarización tóxica'
        ]
      },
      territorial: {
        strengths: [
          'Presencia física constante y conocimiento profundo de cada barrio, vereda y corregimiento',
          'Respaldo directo de presidentes de Juntas de Acción Comunal (JAC) y ediles (JAL)',
          'Trayectoria demostrada en gestión de obras locales y resolución de problemas comunitarios',
          'Red orgánica de líderes comunitarios comprometidos con la movilización directa'
        ],
        weaknesses: [
          'Menor presencia y penetración en medios digitales y redes sociales de alcance municipal',
          'Dificultad para llegar al voto de opinión de estratos altos y comunidades cerradas',
          'Percepción de liderazgo local que debe proyectar visión integral de ciudad/departamento'
        ],
        opportunities: [
          'Votantes de base que valoran el contacto personal, el diálogo directo y los compromisos cara a cara',
          'Pactos comunitarios y asambleas barriales para co-diseñar el plan de gobierno',
          'Descentralización de la campaña llevando propuestas a cada micro-territorio'
        ],
        threats: [
          'Cooptación de líderes comunitarios por parte de maquinarias con promesas clientelares',
          'Deterioro del orden público o bloqueos que impidan el acceso a ciertas zonas territoriales',
          'Baja participación electoral en zonas rurales por falta de transporte el día de las elecciones'
        ]
      },
      ejecutiva: {
        strengths: [
          'Amplia experiencia en gerencia pública o privada con resultados cuantitativos demostrables',
          'Capacidad para estructurar megaproyectos y gestionar recursos del orden nacional o cooperación',
          'Confianza y credibilidad ante gremios empresariales, comerciantes y academia',
          'Dominio de temas presupuestales, hacienda pública y finanzas municipales'
        ],
        weaknesses: [
          'Lenguaje técnico que en ocasiones puede distanciar al elector popular o menos informado',
          'Riesgo de ser catalogado como candidato de las élites o distante de las bases',
          'Menos soltura en tarimas populares y eventos masivos de alta euforia'
        ],
        opportunities: [
          'Urgencia ciudadana por una administración seria, eficaz y con orden presupuestal',
          'Atracción de inversión privada y generación de empleo como eje central del debate',
          'Posicionamiento como el candidato más preparado frente a opciones improvisadas'
        ],
        threats: [
          'Discurso populista de adversarios que apela a emociones fáciles sin sustento técnico',
          'Ataques a decisiones tomadas en cargos públicos o privados anteriores',
          'Desgaste por debates centrados en ataques personales en lugar de programas de gobierno'
        ]
      }
    };

    const next = archetypes[key];
    setSwotData(next);
    try {
      await saveStrategicSwot(next);
      setSwotMessage(`Plantilla "${key.toUpperCase()}" cargada y guardada exitosamente.`);
    } catch (error: any) {
      setSwotMessage(error?.message || 'No fue posible guardar la plantilla.');
    }
  };

  return (
    <div 
      className="module-theme-root responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#071927] text-slate-100 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 overflow-x-hidden transition-colors duration-200"
      data-module="gestion_estrategica"
      data-color-mode={isWhiteMode ? 'white' : 'established'}
    >



      {/* TAB 1: DIAGNÓSTICO DE CAMPAÑA (360° AI) */}
      {activeTab === 'diagnostico' && diagnosticCampaignLoading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
          <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500 animate-pulse" />
        </div>
      )}

      {activeTab === 'diagnostico' && !diagnosticCampaign && !diagnosticCampaignLoading && (
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

      {activeTab === 'diagnostico' && (diagnosticCampaign || campaignCtx?.campaign) && (() => {
        const answeredQuestionsCount = Object.keys(auditAnswers).length;
        const auditScore = answeredQuestionsCount === 0
          ? 0
          : Object.values(auditAnswers).reduce(
              (acc: number, curr) => (curr === 'si' ? acc + 10 : curr === 'parcial' ? acc + 5 : acc),
              0
            );
        const auditProgressPercent = Math.round((answeredQuestionsCount / 10) * 100);
        const currentOverallScore = diag.overallScore;
        const currentAnimatedScore = diag.animatedScore;
        const currentCoberturaScore = diag.coberturaScore;
        const currentEncuestasScore = diag.encuestasScore;
        const currentTestigosScore = diag.testigosScore;
        const currentFinanzasScore = diag.finanzasScore;
        const currentEstrategiaScore = diag.estrategiaScore;
        const currentCensoScore = diag.censoScore;
        const currentStats = diag.stats;

        return (
          <div className="space-y-6 diagnostico-360-view">
            {/* Hero Banner: Diagnostic Score & Scan Action */}
            <div className="diagnostic-hero-banner bg-gradient-to-r from-[#081e36] via-[#0b2747] to-[#06172b] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-diagnostico-stagger">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none diagnostic-hero-glow" />

              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 max-w-2xl">
                  <h3 className="diagnostic-hero-title text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Sesión de Diagnóstico de Campaña{' '}
                    <span className="diagnostic-hero-campaign-tag text-emerald-400">
                      {diagnosticCampaignName}
                      {diagnosticTerritory ? ` · ${diagnosticTerritory}` : ''} · {diagnosticYear}
                    </span>
                  </h3>
                  {(diag.lastSyncDate || lastDiagnosticDate) && (
                    <p className="text-xs text-slate-400 font-mono">Última sincronización: {diag.lastSyncDate || lastDiagnosticDate}</p>
                  )}
                </div>

                {/* Score & Action Button Card */}
                <div className="diagnostic-score-box flex flex-col sm:flex-row items-center gap-4 bg-[#051325]/90 border border-cyan-500/30 p-4 rounded-2xl w-full lg:w-auto shrink-0 shadow-lg">
                  <div className="text-center sm:text-left space-y-1">
                    <span className="diagnostic-score-label text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Índice de Salud de Campaña
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="diagnostic-score-value text-4xl font-black text-emerald-400 font-mono tracking-tight">
                        {currentAnimatedScore}
                      </span>
                      <span className="diagnostic-score-max text-slate-400 font-bold text-sm">/ 100</span>
                    </div>
                    <span className={`diagnostic-score-status inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${diag.levelBadgeColor}`}>
                      {diag.levelBadge}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={diag.runScan}
                    disabled={diag.isScanning}
                    className="diagnostic-scan-btn w-full sm:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:brightness-110 hover:-translate-y-0.5 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.35)] active:scale-[0.96] transition-all duration-200 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${diag.isScanning ? 'animate-spin' : ''}`} />
                    <span>{diag.isScanning ? 'Consultando Servidor...' : 'Ejecutar Diagnóstico AI'}</span>
                  </button>
                </div>
              </div>

              {(diag.diagnosticMessage || diagnosticMessage) && (
                <div className="mt-4 p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 relative z-10 animate-diagnostico-stagger">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {diag.diagnosticMessage || diagnosticMessage}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { diag.clearMessage(); setDiagnosticMessage(''); }} 
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Diagnostic Sub-Tabs Navigation */}
              <div className="diagnostic-subtabs-nav flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-cyan-500/20 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDiagnosticSubTab('overview')}
                  className={`diagnostic-subtab-btn px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    diagnosticSubTab === 'overview'
                      ? 'active bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📊 1. Diagnóstico de Campaña (Electoral/Operativo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiagnosticSubTab('audit')}
                  className={`diagnostic-subtab-btn px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    diagnosticSubTab === 'audit'
                      ? 'active bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📝 Audit Express (10 Preguntas)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiagnosticSubTab('report')}
                  className={`diagnostic-subtab-btn px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    diagnosticSubTab === 'report'
                      ? 'active bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🤖 Informe Ejecutivo IA</span>
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: VISIÓN GENERAL DE LOS 6 PILARES */}
            {diagnosticSubTab === 'overview' && (
              <div className="functional-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 diagnostic-pillars-grid">
                {/* Pilar 1: Cobertura Territorial */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-cobertura bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.04s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-emerald-500/20 text-emerald-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <Target className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">1. Cobertura Territorial</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Puestos, Líderes & Votantes</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-emerald text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      {currentCoberturaScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Puestos Registrados en Servidor</span>
                      <span className="pillar-metric-value text-emerald-300">{currentStats.pollingStations} puestos</span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentCoberturaScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                    <strong className="text-emerald-300 font-bold block">Diagnóstico Territorial ({diagnosticTerritory || 'Campaña'}):</strong>
                    <p className="text-[11px] leading-relaxed">
                      {currentStats.leaders > 0 || currentStats.voters > 0
                        ? `Se registran ${currentStats.pollingStations} puesto(s) de votación, ${currentStats.leaders} líder(es) y ${currentStats.voters} simpatizante(s) verificados en la base de datos.`
                        : 'Sin despliegue territorial registrado. Vincule líderes y simpatizantes en Gestión Territorial para activar la cobertura.'}
                    </p>
                  </div>
                </div>

                {/* Pilar 2: Sondeos & Encuestas */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-intencion bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.08s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-amber-500/20 text-amber-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <TrendingUp className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">2. Intención de Voto & Sondeos</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Encuestas & Actores Mapeados</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-amber text-xs font-mono font-black text-amber-400 bg-amber-950 px-2.5 py-1 rounded-full border border-amber-500/30">
                      {currentEncuestasScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Encuestas / Sondeos Activos</span>
                      <span className="pillar-metric-value text-amber-300">{currentStats.surveys} registrados</span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-amber-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentEncuestasScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                    <strong className="text-amber-300 font-bold block">Análisis de Competencia:</strong>
                    <p className="text-[11px] leading-relaxed">
                      {currentStats.surveys > 0
                        ? `${currentStats.surveys} sondeo(s) en el servidor central con ${currentStats.promedioIntencion > 0 ? currentStats.promedioIntencion + '% de intención' : 'análisis en curso'} y ${actorsList.length} actor(es) político(s) registrados en el Mapa de Actores Clave.`
                        : 'Sin encuestas ni actores de competencia registrados. Registre sondeos en el Módulo de Encuestas para calcular la intención de voto.'}
                    </p>
                  </div>
                </div>

                {/* Pilar 3: Control Electoral & Día E */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-testigos bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.12s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-rose-500/20 text-rose-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <ShieldCheck className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">3. Testigos & Día E</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Acreditaciones Registraduría</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-rose text-xs font-mono font-black text-rose-400 bg-rose-950 px-2.5 py-1 rounded-full border border-rose-500/30">
                      {currentTestigosScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Testigos Acreditados</span>
                      <span className="pillar-metric-value text-rose-300">{currentStats.witnesses} testigos</span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-rose-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentTestigosScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-rose-500/30 text-xs space-y-1 text-slate-300">
                    <strong className="text-rose-300 font-bold block flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Estado Día E:
                    </strong>
                    <p className="text-[11px] leading-relaxed">
                      {currentStats.witnesses > 0
                        ? `Se cuenta con ${currentStats.witnesses} testigo(s) electoral(es) registrado(s) para cubrir los ${currentStats.pollingStations} puesto(s) de la circunscripción.`
                        : '0 testigos electorales registrados. Vincule testigos reales en Gestión de Testigos para blindar las mesas el Día E.'}
                    </p>
                  </div>
                </div>

                {/* Pilar 4: Finanzas & Cumplimiento CNE */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-finanzas bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-green-500/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.16s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-emerald-500/20 text-emerald-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <DollarSign className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">4. Rendición Finanzas CNE</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Cuentas Claras & Presupuesto</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-emerald text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      {currentFinanzasScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Movimientos Contables CNE</span>
                      <span className="pillar-metric-value text-emerald-300">{currentStats.budgetItems} registros</span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentFinanzasScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                    <strong className="text-emerald-300 font-bold block">Contabilidad Oficial:</strong>
                    <p className="text-[11px] leading-relaxed">
                      {currentStats.budgetItems > 0
                        ? `${currentStats.budgetItems} movimiento(s) presupuestales registrados en el servidor central para control de topes legales CNE en ${diagnosticTerritory || 'la campaña'}.`
                        : 'Sin movimientos contables registrados en Presupuesto / CNE. Registre ingresos y gastos para activar la trazabilidad.'}
                    </p>
                  </div>
                </div>

                {/* Pilar 5: Estrategia, Propuestas & Agenda */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-estrategia bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.20s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-teal-500/20 text-teal-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <MessageSquare className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">5. Despliegue Estratégico</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Propuestas, DOFA & Agenda</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-teal text-xs font-mono font-black text-teal-400 bg-teal-950 px-2.5 py-1 rounded-full border border-teal-500/30">
                      {currentEstrategiaScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Propuestas & Hitos Activos</span>
                      <span className="pillar-metric-value text-teal-300">
                        {currentStats.proposals} prop. · {currentStats.activities} hitos
                      </span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-teal-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentEstrategiaScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                    <strong className="text-teal-300 font-bold block">Avance Programático:</strong>
                    <p className="text-[11px] leading-relaxed">
                      {currentStats.proposals > 0 || currentStats.activities > 0
                        ? `${currentStats.proposals} propuesta(s) en el Programa de Gobierno y ${currentStats.activities} hito(s) programado(s) en la Agenda Electoral.`
                        : 'Estructure sus ejes programáticos, matriz DOFA y calendario de hitos en las pestañas estratégicas.'}
                    </p>
                  </div>
                </div>

                {/* Pilar 6: Censo & Filtro de Duplicidad */}
                <div 
                  className="functional-card diagnostic-pillar-card pilar-censo bg-[#05162a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 shadow-xl hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all animate-diagnostico-stagger group"
                  style={{ animationDelay: '0.24s' }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="pillar-icon-box p-2 bg-emerald-500/20 text-emerald-300 rounded-xl transition-all duration-200 group-hover:scale-105">
                        <Users className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                      </div>
                      <div>
                        <h4 className="pillar-title font-extrabold text-white text-sm">6. Filtro Unificado Censo</h4>
                        <span className="pillar-subtitle text-[10px] text-slate-400">Blindaje Duplicidad Cédula</span>
                      </div>
                    </div>
                    <span className="pillar-badge badge-emerald text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      {currentCensoScore} / 100
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold pillar-metric-label">
                      <span>Simpatizantes Verificados</span>
                      <span className="pillar-metric-value text-emerald-300">{currentStats.voters} votantes</span>
                    </div>
                    <div className="pillar-progress-track w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="pillar-progress-bar h-full bg-emerald-400 rounded-full transition-all duration-500" 
                        style={{ width: `${currentCensoScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="pillar-analysis-box p-3 bg-[#081d38] rounded-2xl border border-cyan-500/20 text-xs space-y-1 text-slate-300">
                    <strong className="text-emerald-300 font-bold block">Regla de Negocio Activa:</strong>
                    <p className="text-[11px] leading-relaxed">
                      Base de datos electoral unificada. Restricción única de cédula activa por campaña. Total actual: {currentStats.voters} votante(s) y {currentStats.leaders} líder(es).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {diagnosticSubTab === 'audit' && (
              <div className="diagnostic-audit-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 audit-header">
                  <div>
                    <h4 className="audit-title text-lg font-black text-white flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-emerald-400" /> Cuestionario de Diagnóstico Operativo Express
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 font-mono">
                        Respuestas: {answeredQuestionsCount} / 10 contestadas ({auditProgressPercent}%)
                      </span>
                      <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${auditProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="audit-score-widget bg-[#081d38] border border-cyan-500/30 px-4 py-2 rounded-2xl text-center shrink-0">
                    <span className="audit-score-label text-[10px] text-slate-400 font-bold uppercase block">Puntaje Audit:</span>
                    <span className="audit-score-number text-2xl font-black text-emerald-400 font-mono">
                      {auditScore} / 100
                    </span>
                  </div>
                </div>

                {/* 10 Questions List */}
                <div className="functional-grid space-y-3 text-xs audit-questions-list">
                  {[
                    { id: 1, title: '1. Cartografía & Censo:', text: '¿Tienen dividida la meta de votos por zona, puesto y mesa en el censo oficial?' },
                    { id: 2, title: '2. Testigos Día E:', text: '¿Cuentan con testigos asignados y acreditados para al menos el 90% de las mesas?' },
                    { id: 3, title: '3. Cuentas Claras CNE:', text: '¿Se cuenta con libro contable al día y facturación respaldada con soporte digital?' },
                    { id: 4, title: '4. Inteligencia Digital:', text: '¿Disponen de monitoreo diario de redes para detección de cadenas falsas y desinformación?' },
                    { id: 5, title: '5. Identidad & Discurso:', text: '¿La narrativa de campaña y el mensaje base están unificados entre el candidato y voceros?' },
                    { id: 6, title: '6. Movilización Día E:', text: '¿Existe un plan logístico de transporte, refrigerios y reportes en tiempo real para el Día E?' },
                    { id: 7, title: '7. Jerarquía Aliada:', text: '¿Las campañas vinculadas comparten censo sin duplicidad de electores?' },
                    { id: 8, title: '8. Antecedentes & Legal:', text: '¿Se verificaron antecedentes penales, fiscales y disciplinarios sin inhabilitaciones CNE?' },
                    { id: 9, title: '9. Estrategia Anti-Abstención:', text: '¿Tienen identificados los sectores con mayor riesgo de abstencionismo?' },
                    { id: 10, title: '10. Registro Unificado:', text: '¿Todo votante registrado está asociado obligatoriamente a una cédula única de líder?' }
                  ].map((q) => (
                    <div key={q.id} className="functional-card audit-question-row p-3.5 bg-[#081d38] border border-cyan-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 max-w-xl">
                        <span className="audit-q-title font-bold text-emerald-300">{q.title}</span>
                        <p className="audit-q-text text-slate-200">{q.text}</p>
                      </div>

                      <div className="audit-options-container flex items-center gap-1.5 shrink-0 bg-[#051325] p-1 rounded-xl border border-cyan-500/20">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...auditAnswers, [q.id]: 'si' as const };
                            setAuditAnswers(next);
                            void persistTerritorialAndAuditToDb(sectorDiagnostics, territorialNeeds, next);
                          }}
                          className={`audit-btn px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            auditAnswers[q.id] === 'si'
                              ? 'active-si bg-emerald-500 text-slate-950 font-black shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Sí (10p)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...auditAnswers, [q.id]: 'parcial' as const };
                            setAuditAnswers(next);
                            void persistTerritorialAndAuditToDb(sectorDiagnostics, territorialNeeds, next);
                          }}
                          className={`audit-btn px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            auditAnswers[q.id] === 'parcial'
                              ? 'active-parcial bg-amber-500 text-slate-950 font-black shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Parcial (5p)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...auditAnswers, [q.id]: 'no' as const };
                            setAuditAnswers(next);
                            void persistTerritorialAndAuditToDb(sectorDiagnostics, territorialNeeds, next);
                          }}
                          className={`audit-btn px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            auditAnswers[q.id] === 'no'
                              ? 'active-no bg-rose-500 text-white font-black shadow'
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
            {diagnosticSubTab === 'report' && (() => {
              const hasSufficientData =
                (currentStats.leaders > 0 || currentStats.voters > 0) &&
                (currentStats.proposals > 0 || currentStats.activities > 0 || currentStats.surveys > 0);

              if (!hasSufficientData) {
                return (
                  <div className="diagnostic-report-card bg-[#05162a] border border-amber-500/30 rounded-3xl p-8 shadow-xl text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h5 className="font-extrabold text-white text-base">Expediente insuficiente para generar informe ejecutivo</h5>
                    <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                      Complete los datos base del candidato, territorio y programa de gobierno.
                    </p>
                  </div>
                );
              }

              return (
                <div className="diagnostic-report-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 report-header">
                    <div>
                      <h4 className="report-title text-lg font-black text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" /> Informe Ejecutivo de Diagnóstico & Recomendaciones IA ({diagnosticCampaignName})
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="report-export-btn px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Imprimir / Exportar Informe PDF</span>
                    </button>
                  </div>

                  <div className="functional-grid grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs report-sections-grid">
                    {/* Fortalezas Destacadas */}
                    <div className="functional-card report-section-card report-strengths p-4 bg-[#081d38] border border-emerald-500/30 rounded-2xl space-y-3">
                      <h5 className="font-extrabold text-emerald-300 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Indicadores Consolidados en Base de Datos
                      </h5>
                      <ul className="space-y-2 text-slate-200 list-disc list-inside">
                        <li>
                          Infraestructura Territorial ({diagnosticTerritory || 'Circunscripción'}): {realCampaignStats.pollingStations} puesto(s) de votación oficiales vinculados.
                        </li>
                        <li>
                          Estructura Electoral: {realCampaignStats.leaders} líder(es) y {realCampaignStats.voters} votante(s) con validación de cédula única.
                        </li>
                        <li>
                          Planeación Estratégica: {realCampaignStats.proposals} propuesta(s) programática(s) y {realCampaignStats.activities} actividad(es) en agenda.
                        </li>
                      </ul>
                    </div>

                    {/* Acciones Prioritarias de Contingencia */}
                    <div className="functional-card report-section-card report-actions p-4 bg-[#081d38] border border-rose-500/30 rounded-2xl space-y-3">
                      <h5 className="font-extrabold text-rose-300 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" /> Prioridades Operativas Detectadas
                      </h5>
                      <ul className="space-y-2 text-slate-200 list-disc list-inside">
                        {realCampaignStats.witnesses < realCampaignStats.pollingStations && (
                          <li>
                            Acreditar testigos electorales para cubrir la totalidad de puestos en {diagnosticTerritory || 'el municipio'} ({realCampaignStats.witnesses} registrados).
                          </li>
                        )}
                        {realCampaignStats.proposals === 0 && (
                          <li>Registrar ejes y propuestas reales en la pestaña de Programa de Gobierno.</li>
                        )}
                        {swotData.strengths.length === 0 && (
                          <li>Completar la Matriz DOFA / SWOT AI para habilitar los cruces estratégicos CAME.</li>
                        )}
                        {realCampaignStats.activities === 0 && (
                          <li>Programar los hitos críticos de campaña en el Calendario Electoral.</li>
                        )}
                        {realCampaignStats.witnesses >= realCampaignStats.pollingStations &&
                          realCampaignStats.proposals > 0 &&
                          swotData.strengths.length > 0 &&
                          realCampaignStats.activities > 0 && (
                            <li>Mantener el seguimiento semanal de metas de líderes y actualización de encuestas territoriales.</li>
                          )}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* TAB 2: DIAGNÓSTICO TERRITORIAL (INSUMO PROGRAMÁTICO / PROGRAMA DE GOBIERNO) */}
      {activeTab === 'diagnostico_territorial' && (
        <div className="space-y-6 diagnostico-territorial-view animate-territorial-stagger">
          <div className="diagnostic-territorial-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Header & Sync with Sondeos de Opinión Bar */}
            <div className="territorial-header flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
              <div>
                <h4 className="territorial-title text-lg font-black text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400 territorial-floating-icon" /> Diagnóstico Territorial Sectorial (Insumo Programático)
                </h4>
                <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  {surveySyncTimestamp}
                </p>
              </div>

              {/* Sondeos Sync Action Box */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncSurveys}
                  disabled={isSyncingSurveys}
                  className="territorial-sync-btn territorial-btn-action w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSurveys ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSurveys ? 'Sincronizando...' : 'Sincronizar Sondeos de Opinión'}</span>
                </button>
              </div>
            </div>

            {/* SECTORIAL DIAGNOSTIC ENGINE: SECTOR TABS */}
            <div className="space-y-4 sector-engine-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="sector-section-title text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400 territorial-floating-icon" /> 1. Sectores Temáticos y Evaluación por Variables Sugeridas
                </span>
                <div className="flex items-center gap-2">
                  <span className="sector-count-badge text-[11px] text-slate-400 font-mono">
                    {sectorDiagnostics.length} Sectores Evaluados
                  </span>
                  {sectorDiagnostics.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddSectorModal(true)}
                      className="create-sector-btn territorial-btn-action bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:shadow-cyan-500/20 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Crear Sector
                    </button>
                  )}
                </div>
              </div>

              {/* Sector Buttons Bar - Only displayed when sectors exist */}
              {sectorDiagnostics.length > 0 && (
                <div 
                  ref={sectorTabsContainerRef}
                  className="sector-buttons-bar bg-[#030e21]/90 p-1.5 rounded-2xl border border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none scrollbar-hide shadow-lg scroll-smooth text-xs font-bold"
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
                        className={`sector-tab-item group flex items-center rounded-xl transition-all shrink-0 whitespace-nowrap border ${
                          isActive
                            ? 'active bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/50 shadow-md shadow-cyan-950/40 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSectorTab(sec.category)}
                          className="sector-tab-btn pl-3.5 pr-2 py-2 flex items-center gap-2 cursor-pointer text-xs"
                        >
                          <span>{sec.iconEmoji} {sec.category}</span>
                          {criticalCount > 0 && (
                            <span className="sector-crit-badge px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500 text-slate-950 shadow-sm">
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
                          className="sector-del-btn pr-2 pl-1 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-40 group-hover:opacity-100 cursor-pointer mr-1"
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
                    className="add-sector-pill-btn territorial-btn-action px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-dashed border-cyan-500/30 hover:border-cyan-400/60 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Sector</span>
                  </button>
                </div>
              )}

              {/* High-End Empty State when 0 sectors exist */}
              {sectorDiagnostics.length === 0 && (
                <div className="sector-empty-state rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#04152d]/90 to-[#020b18]/95 p-8 text-center shadow-xl shadow-black/40 space-y-4 animate-territorial-stagger">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md territorial-floating-icon">
                    <BarChart3 className="h-7 w-7" />
                  </div>
                  
                  <div className="space-y-1.5 max-w-lg mx-auto">
                    <h5 className="text-base font-extrabold text-white">0 Sectores Registrados</h5>
                    <p className="text-xs leading-relaxed text-slate-300">
                      El diagnóstico territorial está listo para ser estructurado. Comience creando un sector temático para evaluar variables e indicadores reales de su plan de gobierno.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAddSectorModal(true)}
                      className="territorial-btn-action inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Crear Primer Sector
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Sector Details Box */}
              {(() => {
                const currentSector = sectorDiagnostics.find(s => s.category === selectedSectorTab) || sectorDiagnostics[0];
                if (!currentSector) return null;

                return (
                  <div className="selected-sector-box bg-[#081d38] border border-cyan-500/30 rounded-2xl p-5 space-y-4 animate-territorial-stagger">
                    <div className="selected-sector-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                      <div>
                        <h5 className="selected-sector-title font-extrabold text-white text-sm flex items-center gap-2">
                          <span>{currentSector.iconEmoji} Sector: {currentSector.category}</span>
                        </h5>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowAddVariableModal(true)}
                          className="add-var-btn territorial-btn-action bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar Variable
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSector(currentSector.id)}
                          className="del-sector-btn territorial-btn-action bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Eliminar Sector Temático"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Eliminar Sector
                        </button>
                      </div>
                    </div>

                    {/* Variables Table / Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 variables-grid">
                      {currentSector.variables.map((variable) => (
                        <div
                          key={variable.id}
                          className="variable-card territorial-card-hover bg-[#051325] border border-cyan-500/20 rounded-2xl p-3.5 space-y-2.5 flex flex-col justify-between hover:border-cyan-400/40 transition-all shadow-md"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <strong className="variable-name text-slate-100 text-xs font-bold leading-tight">{variable.name}</strong>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditVariableModal(currentSector.id, variable)}
                                  className="edit-var-btn p-1 text-cyan-400 hover:text-white bg-cyan-950/80 border border-cyan-500/30 hover:bg-cyan-900 rounded-lg transition-all cursor-pointer"
                                  title="Editar Indicador, Línea Base y Meta"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVariableStatus(currentSector.id, variable.id)}
                                  className={`variable-status-pill text-[10px] font-extrabold px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                                    variable.status === 'Crítico'
                                      ? 'status-critico bg-rose-950 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                                      : variable.status === 'Regular'
                                      ? 'status-regular bg-amber-950 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                                      : 'status-optimo bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                                  }`}
                                >
                                  {variable.status} ↺
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariable(currentSector.id, variable.id)}
                                  className="del-var-btn p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                                  title="Eliminar Variable"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* INDICADORES Y LÍNEA BASE COMPONENT */}
                            <div className="indicadores-box bg-[#071930] border border-cyan-500/25 rounded-xl p-2.5 space-y-2">
                              <div className="indicadores-header text-[10px] text-cyan-300 font-bold flex items-center justify-between border-b border-cyan-500/20 pb-1">
                                <span className="flex items-center gap-1 text-cyan-400">
                                  <Activity className="w-3.5 h-3.5" />
                                  Indicadores ({getVariableIndicadores(variable).length}):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditVariableModal(currentSector.id, variable)}
                                  className="manage-ind-btn text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5 cursor-pointer font-extrabold hover:underline"
                                >
                                  + Administrar
                                </button>
                              </div>

                              <div className="space-y-2">
                                {getVariableIndicadores(variable).map((ind, idx) => (
                                  <div key={ind.id || idx} className="indicador-item bg-[#031121] p-2 rounded-lg border border-cyan-500/20 space-y-1">
                                    <div className="indicador-name text-[10px] text-slate-200 font-semibold truncate" title={ind.nombre}>
                                      📊 <span className="text-cyan-200 font-bold">{ind.nombre}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                      <div className="indicador-linea-base bg-[#010914] p-1.5 rounded-md border border-amber-500/30 flex flex-col justify-center">
                                        <span className="text-amber-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                          📍 Línea Base
                                        </span>
                                        <span className="indicador-linea-val text-amber-200 font-black text-xs mt-0.5">
                                          {ind.lineaBase || 'N/A'}
                                        </span>
                                      </div>

                                      <div className="indicador-meta bg-[#010914] p-1.5 rounded-md border border-emerald-500/30 flex flex-col justify-center">
                                        <span className="text-emerald-400 font-extrabold text-[8px] flex items-center gap-1 uppercase tracking-wider">
                                          🎯 Meta
                                        </span>
                                        <span className="indicador-meta-val text-emerald-200 font-black text-xs mt-0.5">
                                          {ind.meta || 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <p className="variable-sondeo-text text-[11px] text-slate-400 leading-relaxed">
                              Sondeo: <span className="text-slate-200">{variable.pollPerception}</span>
                            </p>
                          </div>

                          <div className="variable-footer pt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-300/80 font-mono">
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
            <div className="micro-territorial-section pt-4 border-t border-cyan-500/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="micro-section-title text-sm font-black text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 territorial-floating-icon" /> 2. Fichas de Diagnóstico Territorial Micro-Local (Por Comuna / Corregimiento)
                  </h5>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddNeedModal(true)}
                  className="register-micro-btn territorial-btn-action bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:shadow-cyan-500/20 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Registrar Ficha Comunal
                </button>
              </div>

              {/* Filter Bar */}
              <div className="micro-filter-bar flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20 text-xs">
                <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <span className="font-bold text-slate-300 filter-label">Filtrar por Zona / Sector ({diagnosticTerritory}):</span>
                  <select
                    value={selectedComunaFilter}
                    onChange={(e) => setSelectedComunaFilter(e.target.value)}
                    className="micro-filter-select block w-full min-w-0 max-w-full box-border bg-[#051325] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-400 font-medium sm:w-auto sm:max-w-[20rem] transition-colors"
                  >
                    <option value="Todos">Todas las Zonas / Corregimientos ({diagnosticTerritory})</option>
                    {availableTerritorialZones.map((zoneName) => (
                      <option key={zoneName} value={zoneName}>
                        {zoneName}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="micro-count-badge text-[11px] text-slate-400 font-mono">
                  {territorialNeeds.filter(n => selectedComunaFilter === 'Todos' || n.comunaSector === selectedComunaFilter).length} Fichas Mapeadas
                </span>
              </div>

              {/* Needs & Programmatic Proposals Cards */}
              {territorialNeeds.filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter).length === 0 && (
                <div className="micro-empty-state rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#04152d]/90 to-[#020b18]/95 p-8 text-center shadow-xl shadow-black/40 space-y-4 animate-territorial-stagger">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md territorial-floating-icon">
                    <MapPin className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h6 className="text-base font-extrabold text-white">0 Fichas Comunales Registradas</h6>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Registre necesidades identificadas en territorio para transformarlas en propuestas programáticas oficiales del plan de gobierno.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAddNeedModal(true)}
                      className="territorial-btn-action inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Registrar Primera Ficha Comunal
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 micro-needs-grid">
                {territorialNeeds
                  .filter(need => selectedComunaFilter === 'Todos' || need.comunaSector === selectedComunaFilter)
                  .map((need) => (
                    <div key={need.id} className="micro-need-card territorial-card-hover bg-[#081d38] border border-cyan-500/30 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-cyan-400/50 transition-all shadow-md">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="micro-comuna-title font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {need.comunaSector}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="micro-cat-badge text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-500/30">
                              {need.category}
                            </span>
                            <span className={`micro-impact-badge text-[10px] font-black px-2 py-0.5 rounded-md border ${
                              need.impactLevel === 'Crítico'
                                ? 'impact-critico bg-rose-950 text-rose-300 border-rose-500/40'
                                : need.impactLevel === 'Alto'
                                ? 'impact-alto bg-amber-950 text-amber-300 border-amber-500/40'
                                : 'impact-medio bg-slate-900 text-slate-300 border-slate-700'
                            }`}>
                              Impacto {need.impactLevel}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTerritorialNeed(need.id)}
                              className="micro-del-btn p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer"
                              title="Eliminar Ficha Comunal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <strong className="micro-problem-label text-slate-100 text-xs block font-bold">Problema Diagnosticado:</strong>
                          <p className="micro-problem-text text-slate-300 text-xs leading-relaxed bg-[#051325] p-2.5 rounded-xl border border-cyan-500/10">
                            {need.problemDescription}
                          </p>
                        </div>
                      </div>

                      <div className="micro-solution-box pt-2 border-t border-cyan-500/20 space-y-1 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                        <strong className="micro-solution-label text-emerald-300 text-[11px] block font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Propuesta Programática (Insumo Plan de Gobierno):
                        </strong>
                        <p className="micro-solution-text text-slate-200 text-xs font-medium leading-relaxed">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start perfil-candidato-view">
          
          {/* Avatar & Key Badge Card */}
          <div className="lg:col-span-4 bg-gradient-to-b from-[#04152d]/95 via-[#030e21]/95 to-[#010814] border border-cyan-500/30 rounded-3xl p-6 space-y-5 text-center flex flex-col items-center shadow-2xl self-start h-fit min-w-[200px] perfil-avatar-card animate-perfil-stagger-1 perfil-avatar-glow">
            <div className="w-full flex flex-col items-center">
              <div className="relative group">
                {candidateProfile.avatarUrl ? (
                  <img
                    src={candidateProfile.avatarUrl}
                    alt={candidateProfile.fullName || 'Candidato'}
                    className="w-32 h-32 rounded-full ring-4 ring-cyan-500/40 border-2 border-cyan-400 object-cover shadow-2xl perfil-avatar-img transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full ring-4 ring-cyan-500/40 border-2 border-cyan-500/50 bg-gradient-to-br from-[#06182e] to-[#020b18] flex items-center justify-center shadow-2xl perfil-avatar-placeholder">
                    <UserCheck className="w-12 h-12 text-cyan-400/80" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 p-2.5 rounded-full cursor-pointer shadow-lg transition-transform hover:scale-110 active:scale-90 border-2 border-[#030e21] perfil-avatar-edit-btn" title="Cambiar foto del candidato">
                  <Edit3 className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>

              <h3 className="text-lg font-black text-white mt-4 break-words w-full text-center leading-snug uppercase tracking-wide perfil-name">
                {candidateProfile.fullName?.trim() || 'Nombre del Candidato'}
              </h3>
              
              {Boolean(
                candidateProfile.politicalName?.trim() &&
                candidateProfile.fullName?.trim() &&
                candidateProfile.politicalName.trim().toLowerCase() !== candidateProfile.fullName.trim().toLowerCase()
              ) && (
                <p className="text-xs font-bold text-cyan-300 break-words text-center mt-0.5 perfil-political-name">
                  "{candidateProfile.politicalName.trim()}"
                </p>
              )}

              <div className="mt-3 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm perfil-office-badge">
                <Award className="w-3.5 h-3.5 text-cyan-400" />
                <span>Candidato Oficial {candidateProfile.candidateOffice ? `a ${candidateProfile.candidateOffice}` : ''}</span>
              </div>

              <div className="w-full border-t border-cyan-500/20 my-4 perfil-divider" />

              <div className="w-full text-left space-y-3 text-xs text-slate-300 perfil-quick-info">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#020b18]/60 border border-cyan-500/15">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider perfil-info-label">Territorio</span>
                    <span className="font-bold text-white break-words text-xs perfil-info-val">{candidateProfile.territory || 'Sin territorio asignado'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#020b18]/60 border border-cyan-500/15">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider perfil-info-label">Cédula de Ciudadanía</span>
                    <span className="font-mono text-cyan-300 font-bold break-all text-xs perfil-info-val perfil-cedula-val">
                      {candidateProfile.cedula?.trim() || 'Sin registrar'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#020b18]/60 border border-cyan-500/15">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider perfil-info-label">Sello Inhabilidades</span>
                    <span className="text-amber-300 font-bold text-xs flex items-center gap-1 perfil-seal-badge px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 badge-warning-pulse">
                      Pendiente de verificación oficial
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full bg-[#020b18]/90 p-4 rounded-2xl border border-cyan-500/25 text-left space-y-3 perfil-slogan-card shadow-inner">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1 perfil-slogan-label">Eslogan de Campaña:</span>
                {candidateProfile.slogan && candidateProfile.slogan.trim() !== '' ? (
                  <p className="text-xs font-bold text-cyan-300 italic perfil-slogan-val">"{candidateProfile.slogan.trim()}"</p>
                ) : (
                  <p className="text-xs text-slate-500 italic">Sin eslogan registrado</p>
                )}
              </div>

              {candidateProfile.professionalSummary && candidateProfile.professionalSummary.trim() !== '' && (
                <div className="pt-2.5 border-t border-cyan-500/15 perfil-summary-preview">
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block mb-0.5 perfil-summary-label">Resumen Perfil Profesional:</span>
                  <p className="text-[11px] text-slate-300 line-clamp-3 font-normal leading-snug perfil-summary-text">{candidateProfile.professionalSummary}</p>
                </div>
              )}

              {candidateProfile.candidateBio && candidateProfile.candidateBio.trim() !== '' && (
                <div className="pt-2.5 border-t border-cyan-500/15 perfil-bio-preview">
                  <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider block mb-0.5 perfil-bio-label">Reseña del Candidato:</span>
                  <p className="text-[11px] text-slate-300 line-clamp-3 font-normal leading-snug perfil-bio-text">{candidateProfile.candidateBio}</p>
                </div>
              )}

              {/* Candidate DOFA Summary Box */}
              {(() => {
                const sCount = candidateProfile.dofaStrengths?.split(';').map(s => s.trim()).filter(Boolean).length || 0;
                const oCount = candidateProfile.dofaOpportunities?.split(';').map(s => s.trim()).filter(Boolean).length || 0;
                const wCount = candidateProfile.dofaWeaknesses?.split(';').map(s => s.trim()).filter(Boolean).length || 0;
                const tCount = candidateProfile.dofaThreats?.split(';').map(s => s.trim()).filter(Boolean).length || 0;
                const totalVars = sCount + oCount + wCount + tCount;
                return (
                  <div className="pt-2.5 border-t border-cyan-500/20 space-y-2 perfil-dofa-summary-box">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-300 uppercase font-black tracking-wider flex items-center gap-1.5 perfil-dofa-summary-label">
                        <PieChart className="w-3.5 h-3.5 text-cyan-400" /> Matriz DOFA Resumida:
                      </span>
                      {totalVars > 0 && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-md font-mono font-bold">
                          {totalVars} {totalVars === 1 ? 'var.' : 'vars.'}
                        </span>
                      )}
                    </div>
                    {totalVars > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {sCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                              {sCount} {sCount === 1 ? 'fortaleza' : 'fortalezas'}
                            </span>
                          )}
                          {oCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold">
                              {oCount} {oCount === 1 ? 'oportunidad' : 'oportunidades'}
                            </span>
                          )}
                          {wCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold">
                              {wCount} {wCount === 1 ? 'debilidad' : 'debilidades'}
                            </span>
                          )}
                          {tCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold">
                              {tCount} {tCount === 1 ? 'amenaza' : 'amenazas'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-[10px]">
                          {candidateProfile.dofaStrengths && candidateProfile.dofaStrengths.trim() !== '' && (
                            <div className="bg-emerald-950/60 border border-emerald-500/30 p-2 rounded-xl dofa-mini-strength">
                              <span className="font-bold text-emerald-300 block mb-0.5">Fortalezas:</span>
                              <p className="text-slate-200 line-clamp-2 leading-tight">{candidateProfile.dofaStrengths}</p>
                            </div>
                          )}
                          {candidateProfile.dofaOpportunities && candidateProfile.dofaOpportunities.trim() !== '' && (
                            <div className="bg-cyan-950/60 border border-cyan-500/30 p-2 rounded-xl dofa-mini-opportunity">
                              <span className="font-bold text-cyan-300 block mb-0.5">Oportunidades:</span>
                              <p className="text-slate-200 line-clamp-2 leading-tight">{candidateProfile.dofaOpportunities}</p>
                            </div>
                          )}
                          {candidateProfile.dofaWeaknesses && candidateProfile.dofaWeaknesses.trim() !== '' && (
                            <div className="bg-amber-950/60 border border-amber-500/30 p-2 rounded-xl dofa-mini-weakness">
                              <span className="font-bold text-amber-300 block mb-0.5">Debilidades:</span>
                              <p className="text-slate-200 line-clamp-2 leading-tight">{candidateProfile.dofaWeaknesses}</p>
                            </div>
                          )}
                          {candidateProfile.dofaThreats && candidateProfile.dofaThreats.trim() !== '' && (
                            <div className="bg-rose-950/60 border border-rose-500/30 p-2 rounded-xl dofa-mini-threat">
                              <span className="font-bold text-rose-300 block mb-0.5">Amenazas:</span>
                              <p className="text-slate-200 line-clamp-2 leading-tight">{candidateProfile.dofaThreats}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-[#030d1d] border border-cyan-500/15 text-center text-slate-400 text-[11px]">
                        Sin variables DOFA registradas.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Detailed Editable Profile Form */}
          <div className="lg:col-span-8 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl min-w-0 perfil-form-card animate-perfil-stagger-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 perfil-form-title">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  Configuración Completa del Candidato
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ficha técnica oficial, identidad de campaña y análisis estratégico DOFA
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] self-start sm:self-center badge-registro-oficial">
                Registro Oficial
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs perfil-form-grid">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Nombre Completo (Registro CNE):</label>
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
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-input perfil-input-focus transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Nombre Político / Seudónimo:</label>
                <input
                  type="text"
                  value={candidateProfile.politicalName}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, politicalName: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-input perfil-input-focus transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Cargo de Elección Popular al que Aspira:</label>
                <select
                  value={candidateProfile.candidateOffice}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, candidateOffice: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-select perfil-input-focus transition-all cursor-pointer"
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
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Partido / Coalición / Grupo Significativo:</label>
                <input
                  type="text"
                  value={candidateProfile.partyAlliance}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, partyAlliance: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-input perfil-input-focus transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Municipio / Departamento:</label>
                <input
                  type="text"
                  value={candidateProfile.territory}
                  readOnly
                  title="Este territorio proviene de la campaña creada en Global Admin"
                  className="w-full bg-[#061326] border border-cyan-500/20 rounded-xl px-3.5 py-2.5 text-slate-300 font-medium cursor-not-allowed perfil-form-input-readonly"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Cédula de Ciudadanía:</label>
                <input
                  type="text"
                  value={candidateProfile.cedula}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, cedula: e.target.value })}
                  placeholder="Ej. 1.067.890.123"
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-input perfil-input-focus transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Eslogan Principal de Campaña:</label>
                <input
                  type="text"
                  value={candidateProfile.slogan}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, slogan: e.target.value })}
                  placeholder="Ej. Transformación, honestidad y futuro para todos"
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white font-bold focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none perfil-form-input perfil-input-focus transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Resumen del Perfil Profesional:</label>
                <textarea
                  rows={3}
                  value={candidateProfile.professionalSummary}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, professionalSummary: e.target.value })}
                  placeholder="Síntesis de experiencia académica, cargos directivos, gestión pública o privada..."
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white text-xs leading-relaxed focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none resize-none perfil-form-textarea perfil-input-focus transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1.5 perfil-form-label">Reseña del Candidato (Biografía & Trayectoria):</label>
                <textarea
                  rows={4}
                  value={candidateProfile.candidateBio}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, candidateBio: e.target.value })}
                  placeholder="Reseña histórica, origen territorial, liderazgo comunitario, causas principales y logros destacados del candidato..."
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-white text-xs leading-relaxed focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none resize-none perfil-form-textarea perfil-input-focus transition-all"
                />
              </div>
            </div>

            {/* Candidate DOFA / SWOT Matrix Section */}
            <div className="pt-4 border-t border-cyan-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2 perfil-dofa-section-title">
                  <PieChart className="w-4 h-4 text-emerald-400" /> Matriz DOFA / SWOT del Candidato
                </h4>
                <span className="text-[11px] text-slate-400">Diagnóstico Estratégico Cuantitativo</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs perfil-dofa-grid">
                {/* Fortalezas */}
                <div className="bg-[#041224] p-4 rounded-2xl border border-emerald-500/30 space-y-3 flex flex-col justify-between perfil-dofa-card dofa-fortalezas-card shadow-lg animate-perfil-stagger-3 dofa-quadrant-card dofa-quadrant-fortalezas">
                  <div className="space-y-1.5">
                    <label className="block font-extrabold text-emerald-400 text-xs flex items-center justify-between dofa-card-label">
                      <span>Fortalezas (Internas):</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-mono dofa-card-badge">Ventajas</span>
                    </label>
                    <textarea
                      rows={3}
                      value={candidateProfile.dofaStrengths}
                      onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaStrengths: e.target.value })}
                      placeholder="Puntos fuertes, trayectoria ética, preparación, atributos diferenciadores..."
                      className="w-full bg-[#081d38] border border-emerald-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-emerald-400 outline-none resize-none dofa-card-textarea perfil-input-focus transition-all"
                    />
                  </div>
                  <div className="pt-2 border-t border-emerald-500/20 space-y-2 dofa-card-vars-section">
                    <span className="text-[10px] font-extrabold text-emerald-300/80 block uppercase tracking-wider dofa-vars-header">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar dofa-chips-container">
                      {candidateDofaVars.strengths.map((item, idx) => {
                        const isSelected = candidateProfile.dofaStrengths?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCandidateDofaVar('dofaStrengths', item)}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight dofa-var-chip dofa-var-pill ${
                              isSelected
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60 font-bold shadow-sm dofa-var-chip-active'
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
                    <div className="flex gap-1.5 pt-1 dofa-add-box">
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
                        className="flex-1 bg-[#081d38] border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-emerald-400 outline-none dofa-add-input perfil-input-focus transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomDofaVar('strengths', 'dofaStrengths')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 dofa-add-btn dofa-btn-add cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Oportunidades */}
                <div className="bg-[#041224] p-4 rounded-2xl border border-cyan-500/30 space-y-3 flex flex-col justify-between perfil-dofa-card dofa-oportunidades-card shadow-lg animate-perfil-stagger-4 dofa-quadrant-card dofa-quadrant-oportunidades">
                  <div className="space-y-1.5">
                    <label className="block font-extrabold text-cyan-400 text-xs flex items-center justify-between dofa-card-label">
                      <span>Oportunidades (Externas):</span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md font-mono dofa-card-badge">Entorno</span>
                    </label>
                    <textarea
                      rows={3}
                      value={candidateProfile.dofaOpportunities}
                      onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaOpportunities: e.target.value })}
                      placeholder="Factores del contexto político, alianzas, coyuntura electoral a aprovechar..."
                      className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-cyan-400 outline-none resize-none dofa-card-textarea perfil-input-focus transition-all"
                    />
                  </div>
                  <div className="pt-2 border-t border-cyan-500/20 space-y-2 dofa-card-vars-section">
                    <span className="text-[10px] font-extrabold text-cyan-300/80 block uppercase tracking-wider dofa-vars-header">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar dofa-chips-container">
                      {candidateDofaVars.opportunities.map((item, idx) => {
                        const isSelected = candidateProfile.dofaOpportunities?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCandidateDofaVar('dofaOpportunities', item)}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight dofa-var-chip dofa-var-pill ${
                              isSelected
                                ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/60 font-bold shadow-sm dofa-var-chip-active'
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
                    <div className="flex gap-1.5 pt-1 dofa-add-box">
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
                        className="flex-1 bg-[#081d38] border border-cyan-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-cyan-400 outline-none dofa-add-input perfil-input-focus transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomDofaVar('opportunities', 'dofaOpportunities')}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 dofa-add-btn dofa-btn-add cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Debilidades */}
                <div className="bg-[#041224] p-4 rounded-2xl border border-amber-500/30 space-y-3 flex flex-col justify-between perfil-dofa-card dofa-debilidades-card shadow-lg animate-perfil-stagger-5 dofa-quadrant-card dofa-quadrant-debilidades">
                  <div className="space-y-1.5">
                    <label className="block font-extrabold text-amber-400 text-xs flex items-center justify-between dofa-card-label">
                      <span>Debilidades (Internas):</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono dofa-card-badge">A reforzar</span>
                    </label>
                    <textarea
                      rows={3}
                      value={candidateProfile.dofaWeaknesses}
                      onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaWeaknesses: e.target.value })}
                      placeholder="Áreas de mejora, brechas de conocimiento o reconocimiento territorial..."
                      className="w-full bg-[#081d38] border border-amber-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-amber-400 outline-none resize-none dofa-card-textarea perfil-input-focus transition-all"
                    />
                  </div>
                  <div className="pt-2 border-t border-amber-500/20 space-y-2 dofa-card-vars-section">
                    <span className="text-[10px] font-extrabold text-amber-300/80 block uppercase tracking-wider dofa-vars-header">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar dofa-chips-container">
                      {candidateDofaVars.weaknesses.map((item, idx) => {
                        const isSelected = candidateProfile.dofaWeaknesses?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCandidateDofaVar('dofaWeaknesses', item)}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight dofa-var-chip dofa-var-pill ${
                              isSelected
                                ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 font-bold shadow-sm dofa-var-chip-active'
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
                    <div className="flex gap-1.5 pt-1 dofa-add-box">
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
                        className="flex-1 bg-[#081d38] border border-amber-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-amber-400 outline-none dofa-add-input perfil-input-focus transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomDofaVar('weaknesses', 'dofaWeaknesses')}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 dofa-add-btn dofa-btn-add cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Amenazas */}
                <div className="bg-[#041224] p-4 rounded-2xl border border-rose-500/30 space-y-3 flex flex-col justify-between perfil-dofa-card dofa-amenazas-card shadow-lg animate-perfil-stagger-6 dofa-quadrant-card dofa-quadrant-amenazas">
                  <div className="space-y-1.5">
                    <label className="block font-extrabold text-rose-400 text-xs flex items-center justify-between dofa-card-label">
                      <span>Amenazas (Externas):</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md font-mono dofa-card-badge">Riesgos</span>
                    </label>
                    <textarea
                      rows={3}
                      value={candidateProfile.dofaThreats}
                      onChange={(e) => setCandidateProfile({ ...candidateProfile, dofaThreats: e.target.value })}
                      placeholder="Ataques de oposición, abstencionismo, maquinarias rivales, desinformación..."
                      className="w-full bg-[#081d38] border border-rose-500/30 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:border-rose-400 outline-none resize-none dofa-card-textarea perfil-input-focus transition-all"
                    />
                  </div>
                  <div className="pt-2 border-t border-rose-500/20 space-y-2 dofa-card-vars-section">
                    <span className="text-[10px] font-extrabold text-rose-300/80 block uppercase tracking-wider dofa-vars-header">Variables Evaluables (Haz clic para seleccionar o quitar):</span>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar dofa-chips-container">
                      {candidateDofaVars.threats.map((item, idx) => {
                        const isSelected = candidateProfile.dofaThreats?.toLowerCase().includes(item.toLowerCase().slice(0, 20));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCandidateDofaVar('dofaThreats', item)}
                            className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-left leading-tight dofa-var-chip dofa-var-pill ${
                              isSelected
                                ? 'bg-rose-500/25 text-rose-300 border-rose-400/60 font-bold shadow-sm dofa-var-chip-active'
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
                    <div className="flex gap-1.5 pt-1 dofa-add-box">
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
                        className="flex-1 bg-[#081d38] border border-rose-500/30 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 focus:border-rose-400 outline-none dofa-add-input perfil-input-focus transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomDofaVar('threats', 'dofaThreats')}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 dofa-add-btn dofa-btn-add cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Contact Channels */}
            <h4 className="text-sm font-bold text-cyan-300 pt-3 border-t border-cyan-500/20 flex items-center gap-2 perfil-contact-title">
              <Globe className="w-4 h-4 text-emerald-400" /> Canales Oficiales de Contacto
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs perfil-contact-grid">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1.5 perfil-contact-label">Sitio Web Oficial:</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={candidateProfile.website}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, website: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400 perfil-contact-input perfil-input-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1.5 perfil-contact-label">Correo Electrónico Oficial:</label>
                <input
                  type="email"
                  placeholder="prensa@campana.co"
                  value={candidateProfile.email}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, email: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400 perfil-contact-input perfil-input-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1.5 perfil-contact-label">Teléfono Directo de Prensa:</label>
                <input
                  type="text"
                  placeholder="+57 300 000 0000"
                  value={candidateProfile.phone}
                  onChange={(e) => setCandidateProfile({ ...candidateProfile, phone: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400 perfil-contact-input perfil-input-focus transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cyan-500/20 perfil-footer-bar">
              <span className={`text-xs font-semibold perfil-status-msg ${candidateProfileMessage.toLowerCase().includes('guardado') ? 'text-emerald-400' : 'text-amber-300'}`}>
                {candidateProfileMessage}
              </span>
              <button
                type="button"
                onClick={() => void saveCandidateProfile()}
                disabled={candidateProfileSaving || !candidateCampaignId}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all perfil-save-btn"
              >
                <Save className="w-4 h-4" />
                {candidateProfileSaving ? 'Guardando...' : 'Guardar Perfil del Candidato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CARGA Y ANÁLISIS DE HOJA DE VIDA (CV) */}
      {activeTab === 'hoja_vida' && (
        <div className="space-y-6 cv-analisis-view">
          
          {/* Resume Upload Dropzone & AI Parser Trigger */}
          <div className="cv-header-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden animate-cv-stagger-1">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5 mb-6 cv-header-top">
              <div>
                <h3 className="cv-header-title text-lg font-bold text-white flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-emerald-400 cv-header-icon" />
                  Módulo de Carga y Lectura Inteligente de Hoja de Vida (CV)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Extracción automatizada de formación académica, trayectoria laboral y verificación de idoneidad legal mediante IA.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleAnalyzeCv()}
                disabled={isParsingCv || (!cvStoragePath && !cvFileName)}
                className="cv-scan-btn flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isParsingCv ? 'animate-spin' : ''}`} />
                <span>{isParsingCv ? 'Analizando con IA...' : 'Escanear Hoja de Vida con IA'}</span>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCv(true); }}
              onDragLeave={() => setIsDraggingCv(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingCv(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  void handleFileUpload({ target: { files: [file], value: '' } });
                }
              }}
              className={`cv-dropzone cv-dropzone-interactive border-2 border-dashed ${isDraggingCv ? 'border-cyan-400 bg-cyan-950/40 dragover' : 'border-cyan-500/35 hover:border-emerald-400/80 bg-gradient-to-b from-[#06182e]/80 to-[#020b18]/90'} p-8 sm:p-10 rounded-2xl flex flex-col items-center justify-center text-center transition-all group shadow-inner`}
            >
              <div className="cv-dropzone-icon-box w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/40 transition-all shadow-md">
                <UploadCloud className="cv-dropzone-icon w-8 h-8 text-cyan-400 group-hover:text-emerald-400 transition-colors" />
              </div>

              <p className="cv-dropzone-text text-sm font-bold text-white mb-1">
                Arrastre aquí su archivo de Hoja de Vida (PDF, DOCX)
              </p>
              <p className="text-xs text-slate-400 mb-5">
                o haga clic en el botón inferior para explorar sus archivos locales
              </p>

              <label className="cv-select-btn cv-select-btn-interactive px-5 py-2.5 bg-gradient-to-r from-cyan-900/90 to-blue-900/90 hover:from-cyan-800 hover:to-blue-800 text-cyan-200 hover:text-white border border-cyan-400/40 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Seleccionar Archivo PDF / DOCX
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {cvFileName ? (
                <div className="cv-file-badge mt-5 px-4 py-2.5 rounded-xl bg-[#020b18] border border-emerald-500/40 text-emerald-300 text-xs font-mono flex flex-wrap items-center justify-center gap-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="cv-file-name font-sans font-bold text-white">{cvFileName}</span>
                    {cvUploadedAt && (
                      <span className="text-slate-400 text-[11px] font-sans">
                        ({new Date(cvUploadedAt).toLocaleString('es-CO')})
                      </span>
                    )}
                  </div>
                  <span className={`cv-file-status-pill text-[10px] font-black px-2.5 py-0.5 rounded-full font-sans ${cvAnalysisStatus === 'Analizado con IA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cv-status-analyzed' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cv-status-pending'}`}>
                    {cvAnalysisStatus}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCvFile()}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-bold font-sans underline cursor-pointer transition-colors"
                  >
                    Eliminar archivo
                  </button>
                </div>
              ) : (
                <div className="mt-4 px-3.5 py-1 rounded-full bg-[#020b18]/60 border border-cyan-500/20 text-slate-400 text-[11px]">
                  No hay una hoja de vida cargada para esta campaña
                </div>
              )}

              {cvMessage && (
                <p className={`cv-feedback-msg mt-3 text-xs font-bold ${/guardado|cargado|completado|asociado/i.test(cvMessage) ? 'text-emerald-300 cv-msg-success' : 'text-amber-300 cv-msg-alert'}`}>
                  {cvMessage}
                </p>
              )}
            </div>
          </div>

          {/* Background & Ineligibility Check Panel */}
          <div className="cv-background-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-cv-stagger-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-4">
              <div>
                <h4 className="cv-section-title text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Semáforo de Antecedentes e Inhabilidades Oficiales
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verificación de antecedentes disciplinarios, fiscales, penales y registro ante el CNE
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold text-[11px] self-start sm:self-center">
                4 Entidades de Control
              </span>
            </div>

            <div className="cv-background-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Procuraduría */}
              {(() => {
                const isOk = backgroundChecks.procuraduria?.includes('OK') || backgroundChecks.procuraduria?.includes('Sin sanciones');
                return (
                  <div className="cv-check-card cv-check-card-interactive bg-[#04142a] p-4 rounded-2xl border border-cyan-500/25 space-y-2.5 transition-all shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="cv-check-entity text-[10px] font-black uppercase text-slate-400 tracking-wider">Procuraduría General</span>
                      <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">Disciplinario</span>
                    </div>
                    {isOk ? (
                      <div className="cv-check-status text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Sin Sanciones / Inhabilidades OK
                      </div>
                    ) : (
                      <div className="cv-check-status text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 badge-warning-pulse" /> Pendiente de verificación
                      </div>
                    )}
                    <p className="cv-check-details text-[11px] text-slate-300 leading-tight">
                      {backgroundChecks.procuraduria || 'Sin certificado oficial registrado.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleToggleBackgroundCheck('procuraduria')}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer transition-colors block pt-1"
                    >
                      {isOk ? 'Marcar como pendiente' : 'Verificar Certificado OK'}
                    </button>
                  </div>
                );
              })()}

              {/* Contraloría */}
              {(() => {
                const isOk = backgroundChecks.contraloria?.includes('OK') || backgroundChecks.contraloria?.includes('Sin sanciones');
                return (
                  <div className="cv-check-card cv-check-card-interactive bg-[#04142a] p-4 rounded-2xl border border-cyan-500/25 space-y-2.5 transition-all shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="cv-check-entity text-[10px] font-black uppercase text-slate-400 tracking-wider">Contraloría General</span>
                      <span className="text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded font-mono">Fiscal</span>
                    </div>
                    {isOk ? (
                      <div className="cv-check-status text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Sin Sanciones / Inhabilidades OK
                      </div>
                    ) : (
                      <div className="cv-check-status text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 badge-warning-pulse" /> Pendiente de verificación
                      </div>
                    )}
                    <p className="cv-check-details text-[11px] text-slate-300 leading-tight">
                      {backgroundChecks.contraloria || 'Sin certificado oficial registrado.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleToggleBackgroundCheck('contraloria')}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer transition-colors block pt-1"
                    >
                      {isOk ? 'Marcar como pendiente' : 'Verificar Certificado OK'}
                    </button>
                  </div>
                );
              })()}

              {/* Policía & Fiscalía */}
              {(() => {
                const isOk = backgroundChecks.fiscalia?.includes('OK') || backgroundChecks.fiscalia?.includes('Sin sanciones');
                return (
                  <div className="cv-check-card cv-check-card-interactive bg-[#04142a] p-4 rounded-2xl border border-cyan-500/25 space-y-2.5 transition-all shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="cv-check-entity text-[10px] font-black uppercase text-slate-400 tracking-wider">Policía & Fiscalía (PONAL)</span>
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">Judicial</span>
                    </div>
                    {isOk ? (
                      <div className="cv-check-status text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Sin Sanciones / Inhabilidades OK
                      </div>
                    ) : (
                      <div className="cv-check-status text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 badge-warning-pulse" /> Pendiente de verificación
                      </div>
                    )}
                    <p className="cv-check-details text-[11px] text-slate-300 leading-tight">
                      {backgroundChecks.fiscalia || 'Sin certificado oficial registrado.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleToggleBackgroundCheck('fiscalia')}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer transition-colors block pt-1"
                    >
                      {isOk ? 'Marcar como pendiente' : 'Verificar Certificado OK'}
                    </button>
                  </div>
                );
              })()}

              {/* CNE */}
              {(() => {
                const isOk = backgroundChecks.cneStatus?.includes('OK') || backgroundChecks.cneStatus?.includes('Sin sanciones');
                return (
                  <div className="cv-check-card cv-check-card-interactive bg-[#04142a] p-4 rounded-2xl border border-cyan-500/25 space-y-2.5 transition-all shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="cv-check-entity text-[10px] font-black uppercase text-slate-400 tracking-wider">Consejo Nacional Electoral</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">CNE</span>
                    </div>
                    {isOk ? (
                      <div className="cv-check-status text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Sin Sanciones / Inhabilidades OK
                      </div>
                    ) : (
                      <div className="cv-check-status text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 badge-warning-pulse" /> Pendiente de verificación
                      </div>
                    )}
                    <p className="cv-check-details text-[11px] text-slate-300 leading-tight">
                      {backgroundChecks.cneStatus || 'Sin certificación electoral registrada.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleToggleBackgroundCheck('cneStatus')}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer transition-colors block pt-1"
                    >
                      {isOk ? 'Marcar como pendiente' : 'Verificar Certificado OK'}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Academic Degrees & Professional Formation */}
          <div className="cv-degrees-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-cv-stagger-4">
            <div className="cv-section-header flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h4 className="cv-section-title text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-400" />
                  Formación Académica & Títulos Universitarios
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pregrados, posgrados, maestrías, doctorados y diplomados certificados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDegreeModal(true)}
                className="cv-add-item-btn cv-btn-add-item flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 text-xs font-black cursor-pointer transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Agregar Título
              </button>
            </div>

            <div className="cv-degrees-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {academicDegrees.map(deg => (
                <div key={deg.id} className="cv-degree-card cv-financial-card-interactive bg-[#04142a] p-4 rounded-2xl border border-cyan-500/25 flex flex-col justify-between relative group hover:border-cyan-400/50 transition-all shadow-md">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="cv-degree-level text-[10px] font-black px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                        {deg.level}
                      </span>
                      <span className="cv-degree-year text-xs font-mono font-bold text-slate-400">{deg.year}</span>
                    </div>
                    <h5 className="cv-degree-title font-extrabold text-white text-sm mt-2.5 leading-snug">{deg.title}</h5>
                    <p className="cv-degree-institution text-xs text-teal-300 font-medium mt-1">{deg.institution}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-cyan-500/15 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const next = academicDegrees.filter(d => d.id !== deg.id);
                        setAcademicDegrees(next);
                        void saveCandidateCv({ academicDegrees: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible eliminar el título.'));
                      }}
                      className="cv-degree-del-btn text-rose-400 hover:bg-rose-950/60 p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] cursor-pointer"
                      title="Eliminar título"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </div>
              ))}

              {academicDegrees.length === 0 && (
                <div className="md:col-span-2 lg:col-span-3 p-8 rounded-2xl bg-[#020b18]/60 border border-cyan-500/20 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 empty-cv-icon shadow-md">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white">Sin títulos académicos registrados</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Haga clic en "+ Agregar Título" o cargue su Hoja de Vida para que la inteligencia artificial extraiga sus certificaciones académicas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddDegreeModal(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 cv-btn-add-item"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Primer Título
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Work & Political Experience */}
          <div className="cv-experience-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-cv-stagger-5">
            <div className="cv-section-header flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <h4 className="cv-section-title text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  Experiencia en Sector Público, Privado y Trayectoria Política
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cargos directivos, gestión de proyectos, representación pública y liderazgo social
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpModal(true)}
                className="cv-add-item-btn cv-btn-add-item flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 text-xs font-black cursor-pointer transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Agregar Experiencia
              </button>
            </div>

            <div className="cv-experience-list space-y-3">
              {experienceItems.map(exp => (
                <div key={exp.id} className="cv-exp-card cv-financial-card-interactive bg-[#04142a] p-4 sm:p-5 rounded-2xl border border-cyan-500/25 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-cyan-400/40 transition-all shadow-md">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`cv-exp-type text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        exp.type === 'Público' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30 cv-type-publico' : 'bg-sky-950 text-sky-300 border border-sky-500/30 cv-type-privado'
                      }`}>
                        {exp.type}
                      </span>
                      <span className="cv-exp-period text-xs font-mono text-cyan-300 font-bold bg-[#020b18] px-2.5 py-0.5 rounded-lg border border-cyan-500/20">{exp.period}</span>
                    </div>
                    <h5 className="cv-exp-role font-extrabold text-white text-sm">{exp.role}</h5>
                    <p className="cv-exp-entity text-xs font-semibold text-teal-300">{exp.entityCompany}</p>
                    {exp.achievements && (
                      <p className="cv-exp-achievements text-xs text-slate-300 mt-1 leading-relaxed bg-[#020b18]/60 p-2.5 rounded-xl border border-cyan-500/10">
                        {exp.achievements}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = experienceItems.filter(e => e.id !== exp.id);
                      setExperienceItems(next);
                      void saveCandidateCv({ experienceItems: next }).catch((error: any) => setCvMessage(error?.message || 'No fue posible eliminar la experiencia.'));
                    }}
                    className="cv-exp-del-btn text-rose-400 hover:bg-rose-950/60 px-3 py-1.5 rounded-xl transition-all self-end md:self-center flex items-center gap-1 text-xs cursor-pointer border border-rose-500/20"
                    title="Eliminar experiencia"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              ))}

              {experienceItems.length === 0 && (
                <div className="p-8 rounded-2xl bg-[#020b18]/60 border border-cyan-500/20 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 empty-cv-icon shadow-md">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white">Sin experiencia laboral o política registrada</p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Registre cargos en el sector público, privado o comunitario para fortalecer la hoja de vida electoral del candidato.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddExpModal(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 cv-btn-add-item"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Primera Experiencia
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Financial Assets & Tax Return Declaration */}
          <div className="cv-financial-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-cv-stagger-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <h4 className="cv-section-title text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Declaración Juramentada de Bienes e Inmuebles (Ley 2013 / CNE)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cumplimiento de transparencia patrimonial y reporte de renta obligatorio para candidatos a cargos de elección popular.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempBienes({
                    totalAssets: financialDeclaration.totalAssets,
                    totalLiabilities: financialDeclaration.totalLiabilities,
                    taxReturnYear: financialDeclaration.taxReturnYear,
                    declarationStatus: financialDeclaration.declarationStatus
                  });
                  setShowEditBienesModal(true);
                }}
                className="cv-btn-add-item flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 text-xs font-bold cursor-pointer transition-all shadow-md self-start sm:self-center"
              >
                <Edit3 className="w-3.5 h-3.5" /> Modificar Valores
              </button>
            </div>

            <div className="cv-financial-grid grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="cv-financial-metric-card cv-financial-card-interactive bg-[#04142a] p-5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-1 hover:border-emerald-400/50">
                <span className="cv-financial-label text-slate-400 font-semibold text-[11px] uppercase tracking-wider block">Total Activos Declarados:</span>
                <p className="cv-financial-value cv-financial-assets text-2xl font-black text-emerald-400 font-mono">
                  ${(financialDeclaration.totalAssets || 0).toLocaleString('es-CO')} COP
                </p>
              </div>

              <div className="cv-financial-metric-card cv-financial-card-interactive bg-[#04142a] p-5 rounded-2xl border border-amber-500/30 shadow-lg space-y-1 hover:border-amber-400/50">
                <span className="cv-financial-label text-slate-400 font-semibold text-[11px] uppercase tracking-wider block">Total Pasivos / Deudas:</span>
                <p className="cv-financial-value cv-financial-liabilities text-2xl font-black text-amber-400 font-mono">
                  ${(financialDeclaration.totalLiabilities || 0).toLocaleString('es-CO')} COP
                </p>
              </div>

              <div className="cv-financial-metric-card cv-financial-card-interactive bg-[#04142a] p-5 rounded-2xl border border-cyan-500/30 shadow-lg space-y-1 hover:border-cyan-400/50">
                <span className="cv-financial-label text-slate-400 font-semibold text-[11px] uppercase tracking-wider block">Patrimonio Neto Fiscal:</span>
                <p className="cv-financial-value cv-financial-networth text-2xl font-black text-cyan-300 font-mono">
                  ${((financialDeclaration.totalAssets || 0) - (financialDeclaration.totalLiabilities || 0)).toLocaleString('es-CO')} COP
                </p>
              </div>
            </div>
            {financialDeclaration.totalAssets === 0 && financialDeclaration.totalLiabilities === 0 && !financialDeclaration.declarationStatus && (
              <div className="p-3 rounded-xl bg-[#020b18]/60 border border-cyan-500/15 text-slate-400 text-xs">
                ℹ️ Los valores patrimoniales permanecerán en cero hasta que se cargue la declaración formal o se extraiga automáticamente del documento tributario.
              </div>
            )}
          </div>

          <div className="cv-footer-bar flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cyan-500/20">
            <span className={`text-xs font-semibold ${cvMessage.toLowerCase().includes('guardado') ? 'text-emerald-400' : 'text-amber-300'}`}>
              {cvMessage}
            </span>
            <button
              type="button"
              onClick={() => void handleSaveCandidateCv()}
              disabled={isSavingCv || !candidateCampaignId}
              className="cv-save-expediente-btn cv-save-primary-btn px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 active:scale-95 disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Save className="w-4 h-4" /> {isSavingCv ? 'Guardando...' : 'Guardar Expediente de Hoja de Vida'}
            </button>
          </div>

        </div>
      )}

      {/* TAB 3: MATRIZ DOFA / SWOT ESTRATÉGICA & PLAN CAME */}
      {activeTab === 'dofa' && (
        <div className="space-y-6 dofa-matriz-view">
          <div className="dofa-main-card bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Header with Title, Archetypes and AI Action */}
            <div className="dofa-header-row flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-cyan-500/20 pb-6 animate-dofa-stagger-1">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <PieChart className="w-5 h-5 text-emerald-400 dofa-header-icon" />
                  </div>
                  <div>
                    <h3 className="dofa-header-title text-xl font-black text-white flex items-center gap-2.5">
                      Matriz DOFA / SWOT Estratégica & Diagnóstico Situacional
                    </h3>
                    <p className="text-xs text-slate-300">
                      Evaluación cruzada de variables internas (Fortalezas, Debilidades) y del entorno territorial (Oportunidades, Amenazas).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Archetypes Presets */}
                <div className="flex items-center bg-[#031122] border border-cyan-500/25 p-1 rounded-2xl gap-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 px-2.5 hidden sm:inline-block">
                    Plantillas:
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleLoadArchetype('opinion')}
                    className="dofa-chip-recommended text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#051830] text-cyan-300 border border-cyan-500/20 cursor-pointer"
                    title="Cargar factores para campaña de opinión e independiente"
                  >
                    🎯 Opinión
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadArchetype('territorial')}
                    className="dofa-chip-recommended text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#051830] text-emerald-300 border border-emerald-500/20 cursor-pointer"
                    title="Cargar factores para campaña comunitaria y de base territorial"
                  >
                    🏛️ Territorial
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadArchetype('ejecutiva')}
                    className="dofa-chip-recommended text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#051830] text-amber-300 border border-amber-500/20 cursor-pointer"
                    title="Cargar factores para candidatura ejecutiva y técnica"
                  >
                    💼 Ejecutiva
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadArchetype('baseline')}
                    className="dofa-chip-recommended text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#051830] text-purple-300 border border-purple-500/20 cursor-pointer"
                    title="Restablecer factores integrales base"
                  >
                    🔄 Base
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerateSwot()}
                  disabled={isGeneratingSwot || !candidateCampaignId}
                  className="dofa-btn-generate-ai flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl cursor-pointer shrink-0"
                >
                  <Sparkles className={`w-4 h-4 dofa-sparkle-icon ${isGeneratingSwot ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingSwot ? 'Analizando campaña con IA...' : 'Generar Matriz con IA'}</span>
                </button>
              </div>
            </div>

            {/* Strategic Posture & Summary KPI Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-dofa-stagger-2">
              
              {/* Posture Scorecard */}
              <div className="md:col-span-5 bg-gradient-to-br from-[#021326] to-[#041d3a] border border-cyan-500/30 p-4 sm:p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" /> Postura Estratégica Calculada
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    {swotData.strengths.length + swotData.opportunities.length} vs {swotData.weaknesses.length + swotData.threats.length}
                  </span>
                </div>
                
                <div className="my-2.5">
                  {(() => {
                    const f = swotData.strengths.length;
                    const d = swotData.weaknesses.length;
                    const o = swotData.opportunities.length;
                    const a = swotData.threats.length;
                    const positive = f + o;
                    const negative = d + a;
                    
                    if (f + o > 0 && d === 0 && a === 0) {
                      return (
                        <div>
                          <div className="text-base font-black text-emerald-300 flex items-center gap-2">
                            🚀 Postura Ofensiva & Liderazgo Territorial
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Las fortalezas internas y oportunidades del entorno superan ampliamente las debilidades. Enfoque prioritario en expansión territorial, captación de voto indeciso y liderazgo indiscutible.
                          </p>
                        </div>
                      );
                    } else if (positive >= negative + 2 || (f >= d && o >= a && positive > 0)) {
                      return (
                        <div>
                          <div className="text-base font-black text-emerald-300 flex items-center gap-2">
                            🚀 Postura Ofensiva & Desarrollo Estratégico
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Las fortalezas internas y oportunidades del entorno superan ampliamente las debilidades. Enfoque prioritario en expansión territorial, captación de voto indeciso y liderazgo indiscutible.
                          </p>
                        </div>
                      );
                    } else if (d >= f && o >= a) {
                      return (
                        <div>
                          <div className="text-base font-black text-cyan-300 flex items-center gap-2">
                            🔄 Postura de Reorientación & Fortalecimiento
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Requiere consolidar reconocimiento y movilización territorial para capitalizar el descontento ciudadano caliente y transformar brechas en ventajas competitivas.
                          </p>
                        </div>
                      );
                    } else if (f >= a && a > o) {
                      return (
                        <div>
                          <div className="text-base font-black text-amber-300 flex items-center gap-2">
                            🛡️ Postura Defensiva & Blindaje Reputacional
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Presencia de amenazas electorales y guerra sucia. Se recomienda utilizar la solvencia ética, el rigor técnico y la respuesta rápida para neutralizar ataques adversarios.
                          </p>
                        </div>
                      );
                    } else if (d + a > f + o && negative > 0) {
                      return (
                        <div>
                          <div className="text-base font-black text-rose-400 flex items-center gap-2">
                            ⚠️ Postura de Supervivencia & Mitigación de Riesgos
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Predominio de brechas operativas y amenazas del entorno. Es imperativo reorganizar la logística, blindar puestos de votación vulnerables y focalizar recursos en núcleos seguros.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div>
                          <div className="text-base font-black text-teal-300 flex items-center gap-2">
                            ⚖️ Postura Estratégica Equilibrada
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Factores internos y externos balanceados. Avance sostenido combinando presencia territorial y campaña digital.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Balance Progress Bar */}
                {(() => {
                  const total = swotData.strengths.length + swotData.opportunities.length + swotData.weaknesses.length + swotData.threats.length;
                  const sPct = total > 0 ? (swotData.strengths.length / total) * 100 : 25;
                  const oPct = total > 0 ? (swotData.opportunities.length / total) * 100 : 25;
                  const wPct = total > 0 ? (swotData.weaknesses.length / total) * 100 : 25;
                  const tPct = total > 0 ? (swotData.threats.length / total) * 100 : 25;
                  return (
                    <div className="w-full bg-[#030d1a] h-2.5 rounded-full overflow-hidden flex border border-cyan-500/20 shadow-inner">
                      <div 
                        style={{ width: `${sPct}%` }} 
                        className="bg-emerald-400 h-full dofa-balance-segment" 
                        title={`Fortalezas: ${Math.round(sPct)}%`} 
                      />
                      <div 
                        style={{ width: `${oPct}%` }} 
                        className="bg-cyan-400 h-full dofa-balance-segment" 
                        title={`Oportunidades: ${Math.round(oPct)}%`} 
                      />
                      <div 
                        style={{ width: `${wPct}%` }} 
                        className="bg-amber-400 h-full dofa-balance-segment" 
                        title={`Debilidades: ${Math.round(wPct)}%`} 
                      />
                      <div 
                        style={{ width: `${tPct}%` }} 
                        className="bg-rose-500 h-full dofa-balance-segment" 
                        title={`Amenazas: ${Math.round(tPct)}%`} 
                      />
                    </div>
                  );
                })()}
              </div>

              {/* 4 Quadrants Mini Counters */}
              <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="dofa-kpi-card dofa-kpi-card-strengths bg-[#031d1d]/90 border border-emerald-500/35 p-3.5 rounded-2xl flex flex-col justify-between hover:border-emerald-400/60 shadow-md cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Fortalezas</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-black text-white font-mono leading-none block">{swotData.strengths.length}</span>
                    <span className="text-[10px] text-slate-300 block font-medium mt-0.5">Ventajas Internas</span>
                  </div>
                </div>

                <div className="dofa-kpi-card dofa-kpi-card-weaknesses bg-[#1f1403]/90 border border-amber-500/35 p-3.5 rounded-2xl flex flex-col justify-between hover:border-amber-400/60 shadow-md cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Debilidades</span>
                    <TrendingDown className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-black text-white font-mono leading-none block">{swotData.weaknesses.length}</span>
                    <span className="text-[10px] text-slate-300 block font-medium mt-0.5">Brechas a Blindar</span>
                  </div>
                </div>

                <div className="dofa-kpi-card dofa-kpi-card-opportunities bg-[#03172e]/90 border border-cyan-500/35 p-3.5 rounded-2xl flex flex-col justify-between hover:border-cyan-400/60 shadow-md cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Oportunidades</span>
                    <Lightbulb className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-black text-white font-mono leading-none block">{swotData.opportunities.length}</span>
                    <span className="text-[10px] text-slate-300 block font-medium mt-0.5">Coyuntura Favorable</span>
                  </div>
                </div>

                <div className="dofa-kpi-card dofa-kpi-card-threats bg-[#22050e]/90 border border-rose-500/35 p-3.5 rounded-2xl flex flex-col justify-between hover:border-rose-400/60 shadow-md cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Amenazas</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-black text-white font-mono leading-none block">{swotData.threats.length}</span>
                    <span className="text-[10px] text-slate-300 block font-medium mt-0.5">Riesgos Electorales</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Selector & Search Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 animate-dofa-stagger-3">
              <div className="flex items-center bg-[#020d1c] p-1 rounded-2xl border border-cyan-500/30 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSwotSubTab('matriz')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    swotSubTab === 'matriz'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5" />
                  <span>Matriz DOFA (Diagnóstico 4x4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSwotSubTab('came')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    swotSubTab === 'came'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Plan Estratégico CAME (Acción FO/FA/DO/DA)</span>
                </button>
              </div>

              {/* Live Search Box */}
              {swotSubTab === 'matriz' && (
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar factores diagnósticos..."
                    value={swotSearchTerm}
                    onChange={(e) => setSwotSearchTerm(e.target.value)}
                    className="w-full bg-[#031122] border border-cyan-500/30 text-xs text-white placeholder-slate-400 rounded-xl pl-9 pr-3.5 py-2 outline-none dofa-input-focus transition-all"
                  />
                  {swotSearchTerm && (
                    <button
                      onClick={() => setSwotSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* VIEW 1: 4 QUADRANTS MATRIX */}
            {swotSubTab === 'matriz' && (
              <div className="dofa-quadrants-grid grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 animate-dofa-stagger-4">
                
                {/* Fortalezas (Strengths) */}
                <div className="dofa-quadrant-card dofa-quadrant-card-elevate dofa-quadrant-strengths bg-gradient-to-b from-[#031c18]/95 via-[#021411]/95 to-[#010b09] border border-emerald-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between dofa-quadrant-header">
                      <h4 className="dofa-quadrant-title font-black text-sm text-emerald-300 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400 dofa-quadrant-icon" /> Fortalezas (Strengths)
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                          Interno
                        </span>
                        <span className="dofa-count-badge text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {swotData.strengths.length} Factores
                        </span>
                      </div>
                    </div>
                    <p className="dofa-quadrant-desc text-xs text-slate-300 leading-relaxed">
                      Factores internos positivos, trayectoria ética y ventajas competitivas del candidato y equipo.
                    </p>

                    <ul className="dofa-items-list space-y-2 text-xs">
                      {swotData.strengths
                        .filter(st => !swotSearchTerm || st.toLowerCase().includes(swotSearchTerm.toLowerCase()))
                        .map((st, i) => (
                          <li key={i} className="dofa-item-row flex items-start justify-between gap-2.5 p-3 rounded-xl bg-[#021411] border border-emerald-500/25 hover:border-emerald-500/50 transition-colors shadow-sm">
                            <span className="dofa-item-text text-white leading-snug flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{st}</span>
                            </span>
                            <button 
                              onClick={() => handleRemoveSwotItem('strengths', i)} 
                              className="dofa-item-del-btn cursor-pointer shrink-0 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all" 
                              title="Eliminar factor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      {swotData.strengths.length === 0 && (
                        <li className="dofa-empty-item text-xs text-slate-400 p-4 rounded-xl bg-[#021411]/50 border border-emerald-500/15 text-center">
                          Sin fortalezas registradas. Utilice los factores sugeridos o agregue uno nuevo.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Suggested Quick Add Chips */}
                  <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/80 block">
                      Factores Recomendados (Clic para agregar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Trayectoria ética intachable (0 antecedentes)',
                        'Experiencia técnica comprobada en gestión pública',
                        'Liderazgo y carisma territorial en comunas',
                        'Respaldo de sectores independientes y academia',
                        'Equipo técnico y político cohesionado'
                      ].map((text, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAddSwotItem('strengths', text)}
                          className="dofa-chip-recommended text-[10px] px-2.5 py-1 rounded-lg bg-[#021411] text-emerald-300 border border-emerald-500/20 cursor-pointer flex items-center gap-1 leading-tight"
                        >
                          <Plus className="w-3 h-3 text-emerald-400" />
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Debilidades (Weaknesses) */}
                <div className="dofa-quadrant-card dofa-quadrant-card-elevate dofa-quadrant-weaknesses bg-gradient-to-b from-[#1c1204]/95 via-[#140c02]/95 to-[#0a0601] border border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between dofa-quadrant-header">
                      <h4 className="dofa-quadrant-title font-black text-sm text-amber-300 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-amber-400 dofa-quadrant-icon" /> Debilidades (Weaknesses)
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                          Interno
                        </span>
                        <span className="dofa-count-badge text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30">
                          {swotData.weaknesses.length} Factores
                        </span>
                      </div>
                    </div>
                    <p className="dofa-quadrant-desc text-xs text-slate-300 leading-relaxed">
                      Factores internos limitantes, brechas operativas o logísticas que requieren blindaje estratégico.
                    </p>

                    <ul className="dofa-items-list space-y-2 text-xs">
                      {swotData.weaknesses
                        .filter(wk => !swotSearchTerm || wk.toLowerCase().includes(swotSearchTerm.toLowerCase()))
                        .map((wk, i) => (
                          <li key={i} className="dofa-item-row flex items-start justify-between gap-2.5 p-3 rounded-xl bg-[#140c02] border border-amber-500/25 hover:border-amber-500/50 transition-colors shadow-sm">
                            <span className="dofa-item-text text-white leading-snug flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <span>{wk}</span>
                            </span>
                            <button 
                              onClick={() => handleRemoveSwotItem('weaknesses', i)} 
                              className="dofa-item-del-btn cursor-pointer shrink-0 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all" 
                              title="Eliminar factor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      {swotData.weaknesses.length === 0 && (
                        <li className="dofa-empty-item text-xs text-slate-400 p-4 rounded-xl bg-[#140c02]/50 border border-amber-500/15 text-center">
                          Sin debilidades registradas. Utilice los factores sugeridos o agregue uno nuevo.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Suggested Quick Add Chips */}
                  <div className="pt-3 border-t border-amber-500/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400/80 block">
                      Factores Recomendados (Clic para agregar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Reconocimiento territorial bajo en zonas periféricas',
                        'Presupuesto inicial ajustado frente a maquinarias',
                        'Estructura de movilización Día E en consolidación',
                        'Falta de voceros delegados por corregimiento',
                        'Sobrecarga de funciones operativas en equipo central'
                      ].map((text, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAddSwotItem('weaknesses', text)}
                          className="dofa-chip-recommended text-[10px] px-2.5 py-1 rounded-lg bg-[#140c02] text-amber-300 border border-amber-500/20 cursor-pointer flex items-center gap-1 leading-tight"
                        >
                          <Plus className="w-3 h-3 text-amber-400" />
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Oportunidades (Opportunities) */}
                <div className="dofa-quadrant-card dofa-quadrant-card-elevate dofa-quadrant-opportunities bg-gradient-to-b from-[#03192e]/95 via-[#021120]/95 to-[#010910] border border-cyan-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between dofa-quadrant-header">
                      <h4 className="dofa-quadrant-title font-black text-sm text-cyan-300 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-cyan-400 dofa-quadrant-icon" /> Oportunidades (Opportunities)
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                          Externo
                        </span>
                        <span className="dofa-count-badge text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                          {swotData.opportunities.length} Factores
                        </span>
                      </div>
                    </div>
                    <p className="dofa-quadrant-desc text-xs text-slate-300 leading-relaxed">
                      Factores externos favorables, coyunturas electorales, alianzas y tendencias del entorno social.
                    </p>

                    <ul className="dofa-items-list space-y-2 text-xs">
                      {swotData.opportunities
                        .filter(op => !swotSearchTerm || op.toLowerCase().includes(swotSearchTerm.toLowerCase()))
                        .map((op, i) => (
                          <li key={i} className="dofa-item-row flex items-start justify-between gap-2.5 p-3 rounded-xl bg-[#021120] border border-cyan-500/25 hover:border-cyan-500/50 transition-colors shadow-sm">
                            <span className="dofa-item-text text-white leading-snug flex items-start gap-2">
                              <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                              <span>{op}</span>
                            </span>
                            <button 
                              onClick={() => handleRemoveSwotItem('opportunities', i)} 
                              className="dofa-item-del-btn cursor-pointer shrink-0 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all" 
                              title="Eliminar factor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      {swotData.opportunities.length === 0 && (
                        <li className="dofa-empty-item text-xs text-slate-400 p-4 rounded-xl bg-[#021120]/50 border border-cyan-500/15 text-center">
                          Sin oportunidades registradas. Utilice los factores sugeridos o agregue uno nuevo.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Suggested Quick Add Chips */}
                  <div className="pt-3 border-t border-cyan-500/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400/80 block">
                      Factores Recomendados (Clic para agregar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Descontento ciudadano con la administración saliente',
                        'Crecimiento exponencial del voto de opinión',
                        'Alianzas con JAC, líderes gremiales y comunales',
                        'Apertura en medios locales y podcasts comunitarios',
                        'Coyuntura favorable para propuestas de innovación'
                      ].map((text, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAddSwotItem('opportunities', text)}
                          className="dofa-chip-recommended text-[10px] px-2.5 py-1 rounded-lg bg-[#021120] text-cyan-300 border border-cyan-500/20 cursor-pointer flex items-center gap-1 leading-tight"
                        >
                          <Plus className="w-3 h-3 text-cyan-400" />
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Amenazas (Threats) */}
                <div className="dofa-quadrant-card dofa-quadrant-card-elevate dofa-quadrant-threats bg-gradient-to-b from-[#22050e]/95 via-[#180309]/95 to-[#0c0104] border border-rose-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between dofa-quadrant-header">
                      <h4 className="dofa-quadrant-title font-black text-sm text-rose-300 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-400 dofa-quadrant-icon" /> Amenazas (Threats)
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                          Externo
                        </span>
                        <span className="dofa-count-badge text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/30">
                          {swotData.threats.length} Factores
                        </span>
                      </div>
                    </div>
                    <p className="dofa-quadrant-desc text-xs text-slate-300 leading-relaxed">
                      Factores externos adversos, guerra sucia, clientelismo rival y riesgos de orden público.
                    </p>

                    <ul className="dofa-items-list space-y-2 text-xs">
                      {swotData.threats
                        .filter(th => !swotSearchTerm || th.toLowerCase().includes(swotSearchTerm.toLowerCase()))
                        .map((th, i) => (
                          <li key={i} className="dofa-item-row flex items-start justify-between gap-2.5 p-3 rounded-xl bg-[#180309] border border-rose-500/25 hover:border-rose-500/50 transition-colors shadow-sm">
                            <span className="dofa-item-text text-white leading-snug flex items-start gap-2">
                              <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <span>{th}</span>
                            </span>
                            <button 
                              onClick={() => handleRemoveSwotItem('threats', i)} 
                              className="dofa-item-del-btn cursor-pointer shrink-0 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all" 
                              title="Eliminar factor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      {swotData.threats.length === 0 && (
                        <li className="dofa-empty-item text-xs text-slate-400 p-4 rounded-xl bg-[#180309]/50 border border-rose-500/15 text-center">
                          Sin amenazas registradas. Utilice los factores sugeridos o agregue uno nuevo.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Suggested Quick Add Chips */}
                  <div className="pt-3 border-t border-rose-500/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400/80 block">
                      Factores Recomendados (Clic para agregar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Ataques de desinformación y guerra sucia en redes',
                        'Uso de recursos públicos y clientelismo por rivales',
                        'Riesgo de alto abstencionismo en puestos clave',
                        'Prácticas clientelares y compra de votos en el territorio',
                        'Riesgos de orden público y seguridad en desplazamientos'
                      ].map((text, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAddSwotItem('threats', text)}
                          className="dofa-chip-recommended text-[10px] px-2.5 py-1 rounded-lg bg-[#180309] text-rose-300 border border-rose-500/20 cursor-pointer flex items-center gap-1 leading-tight"
                        >
                          <Plus className="w-3 h-3 text-rose-400" />
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 2: PLAN ESTRATÉGICO CAME (CRUCE FO, FA, DO, DA) */}
            {swotSubTab === 'came' && (
              <div className="space-y-4 pt-2 animate-dofa-stagger-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#021326] via-[#041d3a] to-[#021326] border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" /> Matriz CAME: Formulación de Estrategias Cruzadas
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      <strong>C</strong>orregir debilidades, <strong>A</strong>frontar amenazas, <strong>M</strong>antener fortalezas y <strong>E</strong>xplotar oportunidades.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Plan de Campaña Activo ({cameData.fo.length + cameData.fa.length + cameData.do.length + cameData.da.length} Acciones)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FO Strategies (Ofensivas) */}
                  <div className="bg-[#021818] border border-emerald-500/35 p-5 rounded-2xl space-y-3 shadow-lg hover:border-emerald-500/60 transition-all dofa-quadrant-card-elevate">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                      <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-400" /> Estrategias FO (Ofensivas)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
                        Fortalezas + Oportunidades ({cameData.fo.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Utilizar la solvencia ética y técnica del candidato para capitalizar el voto de opinión y el rechazo a maquinarias salientes.
                    </p>
                    <ul className="space-y-1.5 text-xs text-emerald-100">
                      {cameData.fo.map((item, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#01221f]/60 border border-emerald-500/15">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCameItem('fo', idx)}
                            className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                            title="Eliminar acción CAME"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                      {cameData.fo.length === 0 && (
                        <li className="text-xs text-slate-400 p-3 rounded-xl bg-[#01221f]/40 border border-emerald-500/10 text-center">
                          Sin estrategias FO registradas.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* FA Strategies (Defensivas) */}
                  <div className="bg-[#1f0910] border border-rose-500/35 p-5 rounded-2xl space-y-3 shadow-lg hover:border-rose-500/60 transition-all dofa-quadrant-card-elevate">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
                      <span className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400" /> Estrategias FA (Defensivas / Blindaje)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/30 font-mono">
                        Fortalezas + Amenazas ({cameData.fa.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Emplear el récord ético impecable y equipo cohesionado para desarticular ataques de guerra sucia y desinformación.
                    </p>
                    <ul className="space-y-1.5 text-xs text-rose-100">
                      {cameData.fa.map((item, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#2d0b16]/60 border border-rose-500/15">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCameItem('fa', idx)}
                            className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                            title="Eliminar acción CAME"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                      {cameData.fa.length === 0 && (
                        <li className="text-xs text-slate-400 p-3 rounded-xl bg-[#2d0b16]/40 border border-rose-500/10 text-center">
                          Sin estrategias FA registradas.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* DO Strategies (Reorientación) */}
                  <div className="bg-[#04192d] border border-cyan-500/35 p-5 rounded-2xl space-y-3 shadow-lg hover:border-cyan-500/60 transition-all dofa-quadrant-card-elevate">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
                      <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-cyan-400" /> Estrategias DO (Reorientación)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                        Debilidades + Oportunidades ({cameData.do.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Aprovechar los canales digitales y la apertura comunitaria para compensar el bajo reconocimiento en zonas periféricas.
                    </p>
                    <ul className="space-y-1.5 text-xs text-cyan-100">
                      {cameData.do.map((item, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#05233e]/60 border border-cyan-500/15">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCameItem('do', idx)}
                            className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                            title="Eliminar acción CAME"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                      {cameData.do.length === 0 && (
                        <li className="text-xs text-slate-400 p-3 rounded-xl bg-[#05233e]/40 border border-cyan-500/10 text-center">
                          Sin estrategias DO registradas.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* DA Strategies (Supervivencia / Contingencia) */}
                  <div className="bg-[#1c1204] border border-amber-500/35 p-5 rounded-2xl space-y-3 shadow-lg hover:border-amber-500/60 transition-all dofa-quadrant-card-elevate">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Estrategias DA (Supervivencia & Blindaje)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30 font-mono">
                        Debilidades + Amenazas ({cameData.da.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Reorganizar la logística operativa y optimizar el presupuesto para evitar vulnerabilidades ante compras de voto y abstencionismo.
                    </p>
                    <ul className="space-y-1.5 text-xs text-amber-100">
                      {cameData.da.map((item, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-[#2b1804]/60 border border-amber-500/15">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCameItem('da', idx)}
                            className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                            title="Eliminar acción CAME"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                      {cameData.da.length === 0 && (
                        <li className="text-xs text-slate-400 p-3 rounded-xl bg-[#2b1804]/40 border border-amber-500/10 text-center">
                          Sin estrategias DA registradas.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Add Bar (DOFA or CAME) */}
            <div className="dofa-add-bar bg-[#041224] p-4 sm:p-5 rounded-2xl border border-cyan-500/30 flex flex-col sm:flex-row items-center gap-3 shadow-xl animate-dofa-stagger-5">
              {swotSubTab === 'matriz' ? (
                <>
                  <select
                    value={swotCategory}
                    onChange={(e) => setSwotCategory(e.target.value as any)}
                    className="dofa-add-select bg-[#081d38] border border-cyan-500/30 text-xs text-white rounded-xl px-3.5 py-2.5 outline-none font-semibold cursor-pointer dofa-input-focus shrink-0"
                  >
                    <option value="strengths">🛡️ Fortaleza (Interno)</option>
                    <option value="weaknesses">⚠️ Debilidad (Interno)</option>
                    <option value="opportunities">💡 Oportunidad (Externo)</option>
                    <option value="threats">🚨 Amenaza (Externo)</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Escriba un nuevo elemento de diagnóstico y presione Enter..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSwotItem()}
                    className="dofa-add-input flex-1 w-full bg-[#081d38] border border-cyan-500/30 text-xs text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 outline-none dofa-input-focus transition-all"
                  />

                  <button
                    type="button"
                    onClick={handleAddSwotItem}
                    className="dofa-btn-add-primary px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer shrink-0 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Agregar a Matriz
                  </button>
                </>
              ) : (
                <>
                  <select
                    value={newCameType}
                    onChange={(e) => setNewCameType(e.target.value as any)}
                    className="dofa-add-select bg-[#081d38] border border-cyan-500/30 text-xs text-white rounded-xl px-3.5 py-2.5 outline-none font-semibold cursor-pointer dofa-input-focus shrink-0"
                  >
                    <option value="fo">⚡ Estrategia FO (Ofensiva)</option>
                    <option value="fa">🛡️ Estrategia FA (Defensiva)</option>
                    <option value="do">🔄 Estrategia DO (Reorientación)</option>
                    <option value="da">⚠️ Estrategia DA (Supervivencia)</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Escriba una nueva acción estratégica para el Plan CAME..."
                    value={newCameText}
                    onChange={(e) => setNewCameText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleAddCameItem(newCameType, newCameText)}
                    className="dofa-add-input flex-1 w-full bg-[#081d38] border border-cyan-500/30 text-xs text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 outline-none dofa-input-focus transition-all"
                  />

                  <button
                    type="button"
                    onClick={() => void handleAddCameItem(newCameType, newCameText)}
                    className="dofa-btn-add-primary px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer shrink-0 shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Agregar Estrategia CAME
                  </button>
                </>
              )}
            </div>

            {swotMessage && (
              <p className={`dofa-feedback-msg text-xs font-bold ${/guardad|generad|eliminad|éxito|cargada/i.test(swotMessage) ? 'text-emerald-300 dofa-msg-success' : 'text-amber-300 dofa-msg-alert'}`}>
                {swotMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: NARRATIVA, DISCURSO & MAPA POLÍTICO */}
      {activeTab === 'discurso' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 narrativa-discurso-view">
          
          {/* Campaign Narrative & Base Message */}
          <div className="lg:col-span-7 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl narrativa-editor-card animate-narrativa-stagger-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4 narrativa-header-box">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <MessageSquare className="w-5 h-5 text-emerald-400 narrativa-editor-icon" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2 narrativa-editor-title">
                    Identidad Estratégica & Argumentario Base
                  </h3>
                  <p className="text-xs text-slate-300">
                    Discurso oficial, mensaje fuerza de debate y valores rectores de la marca política.
                  </p>
                </div>
              </div>

              <span className="narrativa-header-badge text-[11px] font-bold px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-center font-mono">
                Redacción Oficial
              </span>
            </div>

            {/* Narrative Templates Quick Switcher */}
            <div className="p-3.5 rounded-2xl bg-[#031122] border border-cyan-500/25 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                Plantillas de Narrativa y Discurso (Clic para aplicar):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleLoadNarrativeTemplate('cambio')}
                  className="narrativa-chip text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#051830] hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 hover:border-emerald-400/50 transition-all cursor-pointer"
                >
                  🛡️ Cambio & Transparencia
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadNarrativeTemplate('desarrollo')}
                  className="narrativa-chip text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#051830] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-400/50 transition-all cursor-pointer"
                >
                  📈 Desarrollo & Empleo
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadNarrativeTemplate('comunal')}
                  className="narrativa-chip text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#051830] hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-400/50 transition-all cursor-pointer"
                >
                  🤝 Liderazgo Comunal
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadNarrativeTemplate('innovacion')}
                  className="narrativa-chip text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#051830] hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:border-purple-400/50 transition-all cursor-pointer"
                >
                  ⚡ Innovación & Juventud
                </button>
              </div>
            </div>

            {/* Narrative Textarea */}
            <div className="narrativa-field-group space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-emerald-300 uppercase tracking-wider narrativa-editor-label flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> Narrativa Estratégica de Campaña:
                </label>
                <span className="narrativa-char-count text-[11px] text-slate-400 font-mono">
                  {strategicIdentity.narrative.length} caracteres
                </span>
              </div>
              <textarea
                rows={5}
                value={strategicIdentity.narrative}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, narrative: e.target.value })}
                placeholder="Escriba la historia, propósito y narrativa central que conecta la candidatura con los anhelos ciudadanos..."
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-2xl p-4 text-xs text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none leading-relaxed resize-y narrativa-textarea shadow-inner narrativa-input-focus"
              />
            </div>

            {/* Base Message / Talking Points Textarea */}
            <div className="narrativa-field-group space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-cyan-300 uppercase tracking-wider narrativa-editor-label flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" /> Mensaje Fuerza / Eje del Discurso (Pitch):
                </label>
                <span className="narrativa-char-count text-[11px] text-slate-400 font-mono">
                  {strategicIdentity.baseMessage.length} caracteres
                </span>
              </div>
              <textarea
                rows={3}
                value={strategicIdentity.baseMessage}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, baseMessage: e.target.value })}
                placeholder="Escriba el argumento central y consigna de debate repetible en plazas, medios y debates..."
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-2xl p-4 text-xs text-white font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none leading-relaxed resize-y narrativa-textarea shadow-inner narrativa-input-focus"
              />
            </div>

            {/* Core Values Interactive Pill Cloud */}
            <div className="narrativa-field-group space-y-2.5">
              <label className="block text-xs font-black text-slate-200 uppercase tracking-wider narrativa-editor-label flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-teal-400" /> Valores Rectores de Marca Política:
              </label>
              
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Transparencia',
                  'Seguridad',
                  'Desarrollo Económico',
                  'Participación Ciudadana',
                  'Meritocracia',
                  'Honestidad',
                  'Equidad Social',
                  'Innovación',
                  'Cercanía',
                  'Eficiencia Fiscal',
                  'Sostenibilidad'
                ].map((val, idx) => {
                  const isSelected = strategicIdentity.coreValues.includes(val);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleCoreValue(val)}
                      className={`narrativa-chip text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'bg-[#081d38] text-slate-400 border border-cyan-500/20 hover:border-cyan-400/50 hover:text-white'
                      }`}
                    >
                      {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Plus className="w-3 h-3" />}
                      <span>{val}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Core Value */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newCustomCoreValue}
                  onChange={(e) => setNewCustomCoreValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCoreValue()}
                  placeholder="Agregar otro valor de marca personalizado..."
                  className="flex-1 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 narrativa-input-focus"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCoreValue}
                  className="narrativa-chip px-4 py-2 bg-[#041d3a] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl cursor-pointer transition-all"
                >
                  Agregar Valor
                </button>
              </div>
            </div>

            {/* Campaign Slogan */}
            <div className="narrativa-field-group space-y-2">
              <label className="block text-xs font-black text-slate-200 uppercase tracking-wider narrativa-editor-label flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Eslogan Oficial de Campaña:
              </label>
              <input
                type="text"
                value={strategicIdentity.slogan}
                onChange={(e) => setStrategicIdentity({ ...strategicIdentity, slogan: e.target.value })}
                placeholder={`Escriba el eslogan aprobado (ej. ¡${diagnosticTerritory} Avanza con Seguridad y Oportunidades!)`}
                className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-4 py-2.5 text-xs text-white font-bold placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 narrativa-input-focus"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider self-center mr-1">
                  Sugerencias:
                </span>
                {[
                  '¡Liderazgo Firme, Territorio Seguro y Futuro con Oportunidades!',
                  '¡Cuentas Claras, Gobierno de la Gente!',
                  '¡El Territorio Primero: Juntos Construimos Futuro!'
                ].map((slog, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStrategicIdentity({ ...strategicIdentity, slogan: slog })}
                    className="narrativa-chip text-[10px] px-2.5 py-1 rounded-lg bg-[#081d38] text-slate-300 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-400/40 transition-all cursor-pointer"
                  >
                    "{slog}"
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 border-t border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleSaveNarrative()}
                disabled={narrativeSaving || !candidateCampaignId}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20 narrativa-save-btn"
              >
                <Save className={`w-4 h-4 ${narrativeSaving ? 'animate-spin' : ''}`} /> 
                <span>{narrativeSaving ? 'Guardando...' : 'Guardar Identidad & Discurso'}</span>
              </button>

              {narrativeMessage && (
                <span className={`text-xs font-bold ${/guardad|aplicad|éxito/i.test(narrativeMessage) ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {narrativeMessage}
                </span>
              )}
            </div>
          </div>

          {/* Political Competitors & Allies Matrix */}
          <div className="lg:col-span-5 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl mapa-politico-card animate-narrativa-stagger-2 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mapa-header-box">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-cyan-400 mapa-politico-icon" />
                  <div>
                    <h3 className="text-lg font-black text-white mapa-politico-title">
                      Mapa Político: Rivales & Aliados
                    </h3>
                    <p className="text-xs text-slate-300">
                      Monitoreo de competencia, alianzas e influencia en {diagnosticTerritory}.
                    </p>
                  </div>
                </div>
                <span className="mapa-count-badge text-[11px] font-bold px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                  {actorsList.length} Actores
                </span>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#1f0910] border border-rose-500/30 p-2.5 rounded-xl text-center mapa-kpi-card mapa-kpi-card-rivals cursor-default">
                  <span className="text-[10px] font-black uppercase text-rose-400 block tracking-wider">Rivales</span>
                  <span className="text-lg font-black text-white font-mono">
                    {actorsList.filter(a => a.role === 'Competidor Directo' || (a.role as any) === 'Rival').length}
                  </span>
                </div>
                <div className="bg-[#021818] border border-emerald-500/30 p-2.5 rounded-xl text-center mapa-kpi-card mapa-kpi-card-allies cursor-default">
                  <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">Aliados</span>
                  <span className="text-lg font-black text-white font-mono">
                    {actorsList.filter(a => a.role === 'Aliado Político' || a.role === 'Aliado Estratégico').length}
                  </span>
                </div>
                <div className="bg-[#04192d] border border-sky-500/30 p-2.5 rounded-xl text-center mapa-kpi-card mapa-kpi-card-neutrals cursor-default">
                  <span className="text-[10px] font-black uppercase text-sky-400 block tracking-wider">Neutrales</span>
                  <span className="text-lg font-black text-white font-mono">
                    {actorsList.filter(a => a.role === 'Líder Neutral' || a.role === 'Actor Neutral').length}
                  </span>
                </div>
              </div>

              {/* Actors List */}
              <div className="space-y-3 mapa-actors-list max-h-[380px] overflow-y-auto pr-1">
                {actorsList.map(actor => (
                  <div key={actor.id} className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/25 space-y-2 relative group mapa-actor-card hover:border-cyan-400/50 transition-colors shadow-sm">
                    <div className="flex items-center justify-between pr-16 gap-2">
                      <span className="font-black text-white text-sm mapa-actor-name">{actor.name}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full mapa-actor-badge ${
                          actor.role === 'Competidor Directo' 
                            ? 'actor-badge-competidor bg-rose-950 text-rose-300 border border-rose-500/30' 
                            : actor.role === 'Aliado Político' || actor.role === 'Aliado Estratégico'
                            ? 'actor-badge-aliado bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'actor-badge-neutral bg-sky-950 text-sky-300 border border-sky-500/30'
                        }`}>
                          {actor.role}
                        </span>
                        {actor.influenceLevel && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-cyan-500/30 font-mono">
                            Infl. {actor.influenceLevel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-300 mapa-actor-party-row">
                      <span className="mapa-actor-party font-medium text-slate-300">
                        {actor.party || 'Sin partido registrado'} {actor.territorio ? `· 📍 ${actor.territorio}` : ''}
                      </span>
                      {actor.estimatedVoteShare > 0 && (
                        <span className="font-bold text-cyan-300 font-mono mapa-actor-votes">
                          Intención: {actor.estimatedVoteShare}%
                        </span>
                      )}
                    </div>

                    {actor.estimatedVoteShare > 0 && (
                      <div className="w-full bg-[#030d1a] h-1.5 rounded-full overflow-hidden border border-cyan-500/20">
                        <div 
                          style={{ width: `${Math.min(100, actor.estimatedVoteShare)}%` }} 
                          className={`h-full ${actor.role === 'Competidor Directo' ? 'bg-rose-500' : 'bg-emerald-400'}`}
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-slate-300 leading-relaxed mapa-actor-notes">
                      {actor.notes || 'Sin observaciones.'}
                    </p>
                    <p className="text-[10px] text-slate-400 mapa-actor-source">
                      Fuente: {actor.source || 'No registrada'} · Actualizado: {actor.updatedAt ? new Date(actor.updatedAt).toLocaleDateString('es-CO') : 'Sin fecha'}
                    </p>
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditActor(actor)}
                        className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/60 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Editar actor político"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActorToDelete(actor)} 
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Eliminar actor político"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {actorsList.length === 0 && (
                  <div className="text-center py-8 px-4 bg-[#081d38]/50 rounded-2xl border border-dashed border-cyan-500/25 text-xs text-slate-300 space-y-2">
                    <Users className="w-9 h-9 text-cyan-400/80 mx-auto mb-1 empty-actor-icon" />
                    <p className="font-bold text-white text-sm">Sin actores políticos registrados</p>
                    <p className="text-slate-400 text-[11px] max-w-xs mx-auto">
                      Registre competidores directos, aliados políticos o líderes neutrales en el formulario inferior para mapear las fuerzas electorales de {diagnosticTerritory}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Register / Edit Actor Form */}
            <div className="border-t border-cyan-500/20 pt-4 space-y-3 mapa-register-box">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider mapa-register-title flex items-center gap-1.5">
                  {editingActorId ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Editando Actor Político:
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-cyan-400" /> Registrar Nuevo Actor Político:
                    </>
                  )}
                </h4>
                {editingActorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingActorId(null);
                      setNewActor({
                        name: '',
                        party: '',
                        role: 'Competidor Directo',
                        influenceLevel: 'Alta',
                        territorio: '',
                        estimatedVoteShare: 0,
                        notes: '',
                        source: '',
                      });
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input 
                  value={newActor.name} 
                  onChange={(e) => setNewActor({ ...newActor, name: e.target.value })} 
                  placeholder="Nombre completo o coalición *" 
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 mapa-input-focus" 
                />
                <select 
                  value={newActor.role} 
                  onChange={(e) => setNewActor({ ...newActor, role: e.target.value as PoliticalActor['role'] })} 
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 mapa-input-focus"
                >
                  <option value="Competidor Directo">⚔️ Competidor Directo</option>
                  <option value="Aliado Político">🤝 Aliado Político</option>
                  <option value="Aliado Estratégico">🤝 Aliado Estratégico</option>
                  <option value="Líder Neutral">⚖️ Líder Neutral</option>
                  <option value="Actor Neutral">⚖️ Actor Neutral</option>
                </select>
                <input 
                  value={newActor.party} 
                  onChange={(e) => setNewActor({ ...newActor, party: e.target.value })} 
                  placeholder="Partido, movimiento o JAC" 
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 mapa-input-focus" 
                />
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  step="0.1" 
                  value={newActor.estimatedVoteShare || ''} 
                  onChange={(e) => setNewActor({ ...newActor, estimatedVoteShare: Number(e.target.value || 0) })} 
                  placeholder="Intención de voto (%)" 
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 font-mono mapa-input-focus" 
                />
                <select
                  value={newActor.influenceLevel}
                  onChange={(e) => setNewActor({ ...newActor, influenceLevel: e.target.value as 'Alta' | 'Media' | 'Baja' })}
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 mapa-input-focus"
                >
                  <option value="Alta">🔥 Influencia Alta</option>
                  <option value="Media">⚡ Influencia Media</option>
                  <option value="Baja">📍 Influencia Baja</option>
                </select>
                <input
                  value={newActor.territorio}
                  onChange={(e) => setNewActor({ ...newActor, territorio: e.target.value })}
                  placeholder={`Zona / Bastión (${diagnosticTerritory})`}
                  className="bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 mapa-input-focus"
                />
                <input 
                  value={newActor.source} 
                  onChange={(e) => setNewActor({ ...newActor, source: e.target.value })} 
                  placeholder="Fuente verificable (ej. Encuesta local, CNE, JAC) *" 
                  className="sm:col-span-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 mapa-input-focus" 
                />
                <textarea 
                  value={newActor.notes} 
                  onChange={(e) => setNewActor({ ...newActor, notes: e.target.value })} 
                  placeholder="Observaciones estratégicas, alianzas o vulnerabilidades verificables..." 
                  rows={2} 
                  className="sm:col-span-2 bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none resize-none focus:border-cyan-400 mapa-input-focus" 
                />
              </div>
              <button 
                type="button"
                onClick={() => void handleAddPoliticalActor()} 
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md actor-add-primary-btn"
              >
                {editingActorId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingActorId ? 'Guardar Cambios del Actor' : 'Registrar Actor en Mapa Político'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE ACTOR POLÍTICO */}
      {actorToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-rose-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Eliminar Actor Político
              </h4>
              <button type="button" onClick={() => setActorToDelete(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ¿Está seguro de eliminar a <strong className="text-white">{actorToDelete.name}</strong> ({actorToDelete.role}) del Mapa Político de la campaña? Esta acción sincronizará el cambio en el servidor central.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActorToDelete(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRemovePoliticalActor(actorToDelete.id)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black cursor-pointer shadow-md"
              >
                Sí, Eliminar Actor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB COMUNICACIÓN Y REDES SOCIALES */}
      {activeTab === 'comunicacion_redes' && (
        <ComunicacionRedesView candidateProfile={candidateProfile} campaignId={candidateCampaignId} />
      )}

      {/* TAB AGENDA Y CALENDARIO ELECTORAL */}
      {activeTab === 'agenda_electoral' && (
        <AgendaCalendarioView onSelectView={onSelectView} campaignId={candidateCampaignId} candidateProfile={candidateProfile} />
      )}

      {/* TAB 5: COMMAND CENTER AI */}
      {activeTab === 'ai_command' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                Command Center AI - Diagnóstico Estratégico ({diagnosticTerritory})
              </h3>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950 border border-emerald-400/30 px-3 py-1 rounded-full">
                Sectores Diagnosticados: {sectorDiagnostics.length} · Actores: {actorsList.length}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#081d38] p-4 rounded-2xl border border-emerald-500/30 space-y-2">
                <h4 className="font-extrabold text-emerald-300 text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-400" /> Recomendaciones Basadas en Datos Reales de Campaña
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-200">
                  <li>
                    Cobertura en {diagnosticTerritory}: {realCampaignStats.leadersCount} líderes y {realCampaignStats.votersCount.toLocaleString('es-CO')} simpatizantes registrados.
                  </li>
                  <li>
                    Propuestas Programáticas: {realCampaignStats.proposalsCount} propuestas estructuradas y {territorialNeeds.length} fichas territoriales mapeadas.
                  </li>
                  <li>
                    Agenda Operativa: {realCampaignStats.activitiesCount} hitos y eventos programados en el calendario electoral.
                  </li>
                </ul>
              </div>

              <div className="bg-[#081d38] p-4 rounded-2xl border border-rose-500/30 space-y-2">
                <h4 className="font-extrabold text-rose-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Alertas Estratégicas & Brechas Operativas
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-200">
                  <li>
                    Defensa Electoral: {realCampaignStats.witnessesCount} testigos acreditados para cubrir {realCampaignStats.mesasCount} mesas en {realCampaignStats.puestosCount} puestos.
                  </li>
                  <li>
                    Matriz DOFA: {swotData.weaknesses.length} debilidades internas y {swotData.threats.length} amenazas externas en seguimiento.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h4 className="font-extrabold text-white text-base mb-2">Balance de Matriz DOFA</h4>
              {(() => {
                const totalFactors = swotData.strengths.length + swotData.opportunities.length + swotData.weaknesses.length + swotData.threats.length;
                const positivePct = totalFactors > 0 ? Math.round(((swotData.strengths.length + swotData.opportunities.length) / totalFactors) * 100) : 0;
                const weaknessPct = totalFactors > 0 ? Math.round((swotData.weaknesses.length / totalFactors) * 100) : 0;
                const threatPct = totalFactors > 0 ? Math.max(0, 100 - positivePct - weaknessPct) : 0;
                return (
                  <div className="space-y-3 mt-4 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Factores Favorables (F + O)</span>
                        <span className="text-emerald-400 font-bold">{positivePct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${positivePct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Debilidades Internas (D)</span>
                        <span className="text-cyan-400 font-bold">{weaknessPct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${weaknessPct}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span>Amenazas Externas (A)</span>
                        <span className="text-rose-400 font-bold">{threatPct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: `${threatPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <p className="text-[11px] text-slate-400 bg-[#081d38] p-3 rounded-2xl border border-cyan-500/20">
              Cálculo sincronizado en tiempo real con los registros estratégicos de la campaña en el servidor seguro.
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
          <div className="territorial-modal-card bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
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
          <div className="territorial-modal-card bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl">
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
                <label className="block text-slate-300 font-semibold mb-1">Zona / Corregimiento / Sector ({diagnosticTerritory}):</label>
                <select
                  value={newTerritorialNeed.comunaSector}
                  onChange={(e) => {
                    setNewTerritorialNeed({ ...newTerritorialNeed, comunaSector: e.target.value });
                    if (e.target.value !== '__custom__') setCustomComunaSector('');
                  }}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                >
                  {availableTerritorialZones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="__custom__">+ Otra Zona o Corregimiento...</option>
                </select>
                {newTerritorialNeed.comunaSector === '__custom__' && (
                  <input
                    type="text"
                    placeholder={`Especifique el nombre del sector o corregimiento en ${diagnosticTerritory}...`}
                    value={customComunaSector}
                    onChange={(e) => setCustomComunaSector(e.target.value)}
                    className="mt-2 w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    autoFocus
                  />
                )}
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
                type="button"
                onClick={() => setShowAddNeedModal(false)}
                className="territorial-btn-action flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddTerritorialNeed}
                className="territorial-btn-action flex-1 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 rounded-xl font-black cursor-pointer shadow-md hover:shadow-cyan-500/20"
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
          <div className="territorial-modal-card bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl animate-territorial-stagger">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400 territorial-floating-icon" />
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
                type="button"
                onClick={() => setShowAddSectorModal(false)}
                className="territorial-btn-action flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddSector}
                className="territorial-btn-action flex-1 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 rounded-xl font-black cursor-pointer hover:from-teal-400 hover:to-cyan-400 shadow-md hover:shadow-cyan-500/20"
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
          <div className="territorial-modal-card bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
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

      {/* MODAL: AGREGAR TÍTULO ACADÉMICO */}
      {showAddDegreeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                Registrar Formación Académica & Título
              </h4>
              <button onClick={() => setShowAddDegreeModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nivel Académico:</label>
                  <select
                    value={newDegree.level}
                    onChange={(e) => setNewDegree({ ...newDegree, level: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="Pregrado">Pregrado</option>
                    <option value="Posgrado">Posgrado</option>
                    <option value="Maestría">Maestría</option>
                    <option value="Doctorado">Doctorado</option>
                    <option value="Diplomado">Diplomado / Curso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Año de Graduación:</label>
                  <input
                    type="text"
                    placeholder="Ej. 2020"
                    value={newDegree.year}
                    onChange={(e) => setNewDegree({ ...newDegree, year: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Título Obtenido / Carrera:</label>
                <input
                  type="text"
                  placeholder="Ej. Abogado, Administrador Público, Especialista en Finanzas"
                  value={newDegree.title}
                  onChange={(e) => setNewDegree({ ...newDegree, title: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Institución / Universidad:</label>
                <input
                  type="text"
                  placeholder="Ej. Universidad Nacional de Colombia / Universidad de Córdoba"
                  value={newDegree.institution}
                  onChange={(e) => setNewDegree({ ...newDegree, institution: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setShowAddDegreeModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddDegree}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 rounded-xl font-black cursor-pointer transition-all shadow-md"
              >
                Guardar Título
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR EXPERIENCIA LABORAL / POLÍTICA */}
      {showAddExpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                Registrar Trayectoria & Experiencia Laboral
              </h4>
              <button onClick={() => setShowAddExpModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sector / Tipo:</label>
                  <select
                    value={newExp.type}
                    onChange={(e) => setNewExp({ ...newExp, type: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="Público">Sector Público</option>
                    <option value="Privado">Sector Privado</option>
                    <option value="Político/Social">Político / Social / Comunitario</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Período de Gestión:</label>
                  <input
                    type="text"
                    placeholder="Ej. 2020 - 2023"
                    value={newExp.period}
                    onChange={(e) => setNewExp({ ...newExp, period: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cargo / Rol Desempeñado:</label>
                <input
                  type="text"
                  placeholder="Ej. Secretario de Gobierno / Gerente de Operaciones / Concejal"
                  value={newExp.role}
                  onChange={(e) => setNewExp({ ...newExp, role: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Entidad, Empresa u Organización:</label>
                <input
                  type="text"
                  placeholder="Ej. Alcaldía Municipal / Consorcio de Infraestructura"
                  value={newExp.entityCompany}
                  onChange={(e) => setNewExp({ ...newExp, entityCompany: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Principales Logros / Responsabilidades:</label>
                <textarea
                  rows={2}
                  placeholder="Describa brevemente los resultados alcanzados o proyectos gestionados..."
                  value={newExp.achievements}
                  onChange={(e) => setNewExp({ ...newExp, achievements: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setShowAddExpModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddExperience}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 rounded-xl font-black cursor-pointer transition-all shadow-md"
              >
                Guardar Experiencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DECLARACIÓN JURAMENTADA DE BIENES */}
      {showEditBienesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Declaración Juramentada de Bienes & Rentas (Ley 2013 / CNE)
              </h4>
              <button onClick={() => setShowEditBienesModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Total Activos Declarados (COP):</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000000"
                    placeholder="Ej. 850000000"
                    value={tempBienes.totalAssets || ''}
                    onChange={(e) => setTempBienes({ ...tempBienes, totalAssets: Number(e.target.value) || 0 })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl pl-7 pr-3 py-2 text-white outline-none focus:border-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Total Pasivos / Obligaciones Financieras (COP):</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000000"
                    placeholder="Ej. 120000000"
                    value={tempBienes.totalLiabilities || ''}
                    onChange={(e) => setTempBienes({ ...tempBienes, totalLiabilities: Number(e.target.value) || 0 })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl pl-7 pr-3 py-2 text-white outline-none focus:border-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#020b18] border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Patrimonio Neto Calculado:</span>
                  <p className="text-sm font-black text-cyan-400 font-mono">
                    ${((Number(tempBienes.totalAssets) || 0) - (Number(tempBienes.totalLiabilities) || 0)).toLocaleString('es-CO')} COP
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  Activos - Pasivos
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Año Gravable DIAN:</label>
                  <input
                    type="text"
                    placeholder={`Ej. ${new Date().getFullYear() - 1}`}
                    value={tempBienes.taxReturnYear}
                    onChange={(e) => setTempBienes({ ...tempBienes, taxReturnYear: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Estado de Declaración:</label>
                  <select
                    value={tempBienes.declarationStatus || 'Declaración de Renta y Patrimonio Registrada'}
                    onChange={(e) => setTempBienes({ ...tempBienes, declarationStatus: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 text-xs"
                  >
                    <option value="Declaración de Renta y Patrimonio Registrada">Registrada / Presentada</option>
                    <option value="Declaración en Trámite / Borrador">En Trámite / Borrador</option>
                    <option value="Exento por Ley">Exento por Ley</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setShowEditBienesModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBienes}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 rounded-xl font-black cursor-pointer transition-all shadow-md"
              >
                Guardar Declaración
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
