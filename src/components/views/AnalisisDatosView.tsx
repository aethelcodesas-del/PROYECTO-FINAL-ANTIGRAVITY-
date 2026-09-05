import React, { useState, useEffect } from 'react';
import { useCampaignLive } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { supabase } from '../../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  RefreshCw, 
  Download, 
  Share2, 
  Filter, 
  ShieldCheck, 
  DollarSign, 
  PieChart as PieIcon, 
  Layers, 
  Plus, 
  X, 
  Check, 
  Activity, 
  MessageSquare, 
  Zap, 
  Sliders, 
  Flame, 
  Clock,
  FileCheck2,
  Award,
  Vote,
  Compass
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart
} from 'recharts';

export interface AIRecommendation {
  id: string;
  title: string;
  category: 'Territorial' | 'Digital & Mensaje' | 'Día E & Testigos' | 'Finanzas & CNE' | 'Estrategia General';
  priority: 'Crítica' | 'Alta' | 'Media' | 'Baja';
  estimatedImpact: string;
  description: string;
  actionRequired: string;
  assignedTeam: string;
  status: 'Pendiente' | 'En Proceso' | 'Implementada';
  createdDate: string;
}

export interface ComunaMetric {
  id: string;
  name: string;
  targetVotes: number;
  securedVotes: number;
  coveragePercent: number;
  status: 'Excelente' | 'Normal' | 'Requiere Refuerzo' | 'Crítico';
  topIssue: string;
}

// Custom Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label, unit = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#030e1c] border border-cyan-500/40 p-3 rounded-xl shadow-2xl text-xs space-y-1">
        <p className="font-extrabold text-cyan-300 border-b border-cyan-500/20 pb-1 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 font-mono">
            <span style={{ color: entry.color }} className="font-bold">
              {entry.name}:
            </span>
            <span className="text-white font-extrabold">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AnalisisDatosView: React.FC<{
  onSelectView?: (view: any) => void;
}> = ({ onSelectView }) => {
  // Active internal tab
  const [activeTab, setActiveTab] = useState<'overview' | 'growth_polls' | 'electoral_territorial' | 'recommendations'>('overview');
  
  // Filter States
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'campaign'>('30d');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Contexto global en tiempo real ───────────────────────────────────────────────
  const liveMetrics = useCampaignLive();
  const geoCtx      = useCampaignGeo();

  // 1. DATA: Crecimiento Electoral Histórico vs Metas
  const demoGrowthData = [
    { mes: 'Ene 2026', metaVotos: 15000, votosFirmes: 12200, votosIdentificados: 18000 },
    { mes: 'Feb 2026', metaVotos: 28000, votosFirmes: 24500, votosIdentificados: 33100 },
    { mes: 'Mar 2026', metaVotos: 42000, votosFirmes: 38100, votosIdentificados: 49200 },
    { mes: 'Abr 2026', metaVotos: 58000, votosFirmes: 51200, votosIdentificados: 64800 },
    { mes: 'May 2026', metaVotos: 72000, votosFirmes: 62400, votosIdentificados: 78500 },
    { mes: 'Jun (Proy.)', metaVotos: 85000, votosFirmes: 78000, votosIdentificados: 92000 },
  ];

  // 2. DATA: Tracking Histórico de Intención de Voto (Encuestas Nivel Ciudad)
  const demoPollTrackingData = [
    { mes: 'Ene', santiagoPerez: 18.2, carlosRendon: 35.1, elenaRestrepo: 23.4, indecisos: 23.3 },
    { mes: 'Feb', santiagoPerez: 21.0, carlosRendon: 34.2, elenaRestrepo: 22.8, indecisos: 22.0 },
    { mes: 'Mar', santiagoPerez: 23.8, carlosRendon: 33.5, elenaRestrepo: 22.1, indecisos: 20.6 },
    { mes: 'Abr', santiagoPerez: 25.3, carlosRendon: 33.0, elenaRestrepo: 21.5, indecisos: 20.2 },
    { mes: 'May', santiagoPerez: 28.5, carlosRendon: 32.5, elenaRestrepo: 21.0, indecisos: 18.0 },
  ];

  // 3. DATA: Sondeo de Percepción Ciudadana por Temática Priority
  const demoCitizenPerceptionData = [
    { aspecto: 'Seguridad y Convivencia', preocupacion: 78, evaluacionGestionPositiva: 28, resonanciaPropuesta: 82 },
    { aspecto: 'Empleo & Emprendimiento', preocupacion: 65, evaluacionGestionPositiva: 35, resonanciaPropuesta: 79 },
    { aspecto: 'Movilidad & Metro', preocupacion: 62, evaluacionGestionPositiva: 41, resonanciaPropuesta: 74 },
    { aspecto: 'Transparencia & Anti-Corrupción', preocupacion: 71, evaluacionGestionPositiva: 22, resonanciaPropuesta: 88 },
    { aspecto: 'Salud & Red Hospitalaria', preocupacion: 54, evaluacionGestionPositiva: 48, resonanciaPropuesta: 69 },
    { aspecto: 'Educación & Juventud', preocupacion: 59, evaluacionGestionPositiva: 52, resonanciaPropuesta: 85 },
  ];

  // 4. DATA: Atributos de Percepción e Imagen del Candidato vs Rival Principal
  const demoCandidateAttributesData = [
    { atributo: 'Honestidad', SantiagoPerez: 88, CarlosRendon: 52 },
    { atributo: 'Capacidad de Gestión', SantiagoPerez: 82, CarlosRendon: 85 },
    { atributo: 'Cercanía Ciudadana', SantiagoPerez: 90, CarlosRendon: 60 },
    { atributo: 'Innovación & Visión', SantiagoPerez: 94, CarlosRendon: 62 },
    { atributo: 'Conocimiento Territorial', SantiagoPerez: 85, CarlosRendon: 88 },
    { atributo: 'Independencia Política', SantiagoPerez: 92, CarlosRendon: 48 },
  ];

  // 5. DATA: Aspectos Electorales (Cobertura de Mesas y Testigos por Comuna)
  const demoElectoralWitnessesData = [
    { comuna: 'Belén (C16)', mesas: 320, testigosAcreditados: 298, porcentaje: 93 },
    { comuna: 'El Poblado (C14)', mesas: 280, testigosAcreditados: 266, porcentaje: 95 },
    { comuna: 'Laureles (C11)', mesas: 260, testigosAcreditados: 247, porcentaje: 95 },
    { comuna: 'Centro (C10)', mesas: 240, testigosAcreditados: 204, porcentaje: 85 },
    { comuna: 'Comuna 13', mesas: 210, testigosAcreditados: 168, porcentaje: 80 },
    { comuna: 'Manrique (C3)', mesas: 220, testigosAcreditados: 165, porcentaje: 75 },
    { comuna: 'Popular (C1)', mesas: 190, testigosAcreditados: 133, porcentaje: 70 },
    { comuna: 'San Cristóbal', mesas: 150, testigosAcreditados: 105, porcentaje: 70 },
  ];

  // 6. DATA: Aspectos Administrativos (Presupuesto CNE por Rubro vs Facturación Legalizada)
  const demoFinancialAdminData = [
    { rubro: 'Publicidad & Digital', asignado: 800, ejecutado: 540, facturadoCNE: 490 },
    { rubro: 'Eventos & Movilización', asignado: 600, ejecutado: 380, facturadoCNE: 320 },
    { rubro: 'Operación Territorial', asignado: 450, ejecutado: 260, facturadoCNE: 210 },
    { rubro: 'Material Impreso & Kits', asignado: 350, ejecutado: 180, facturadoCNE: 160 },
    { rubro: 'Sedes & Logística Día E', asignado: 300, ejecutado: 60, facturadoCNE: 55 },
  ];

  // Pie Data for Expense Category Breakdown
  const demoExpensePieData = [
    { name: 'Publicidad Digital & Medios', value: 540, color: '#38bdf8' },
    { name: 'Eventos & Micro-mítines', value: 380, color: '#34d399' },
    { name: 'Operación Territorial', value: 260, color: '#fbbf24' },
    { name: 'Material Impreso', value: 180, color: '#c084fc' },
    { name: 'Logística & Sedes', value: 60, color: '#f87171' },
  ];

  const [campaignId, setCampaignId] = useState('');
  const [clientId, setClientId] = useState('');
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [pollTrackingData] = useState<any[]>([]);
  const [citizenPerceptionData] = useState<any[]>([]);
  const [candidateAttributesData] = useState<any[]>([]);
  const [electoralWitnessesData, setElectoralWitnessesData] = useState<any[]>([]);
  const [financialAdminData, setFinancialAdminData] = useState<any[]>([]);
  const [expensePieData, setExpensePieData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    voteGoal: 0, firmVotes: 0, totalWitnesses: 0, accreditedWitnesses: 0,
    budgetCeiling: 0, executedExpenses: 0, verifiedExpenses: 0,
    surveyResponses: 0,
  });

  // Recommendations State
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(false ? [
    {
      id: 'rec-1',
      title: 'Reforzar Presencia Territorial en Comuna 1 (Popular) y Comuna 3 (Manrique)',
      category: 'Territorial',
      priority: 'Crítica',
      estimatedImpact: '+3,500 a +5,000 Votos Estimados',
      description: 'El análisis de datos territoriales muestra un rezago del 22% en la consecución de votos asegurados en el nororiente frente al promedio de la ciudad. El candidato rival tiene alta presencia con líderes tradicionales.',
      actionRequired: 'Organizar 3 caminatas barriales con el candidato esta semana y desplegar 50 líderes juveniles para visitas puerta a puerta.',
      assignedTeam: 'Equipo de Operaciones Territoriales',
      status: 'Pendiente',
      createdDate: 'Hace 2 horas'
    },
    {
      id: 'rec-2',
      title: 'Acreditar Testigos Electorales Faltantes en Puestos Periféricos',
      category: 'Día E & Testigos',
      priority: 'Crítica',
      estimatedImpact: 'Blindaje de hasta 8,000 Votos en Escrutinio',
      description: 'Hay 300 mesas de votación en puestos alejados (corregimientos y Comunas 1, 3, 8) que no tienen testigo asignado ni capacitado en diligenciamiento del Formulario E-14.',
      actionRequired: 'Activar campaña urgente de reclutamiento de jurados/testigos con la red universitaria y ofrecer estímulo logístico para el Día E.',
      assignedTeam: 'Coordinación de Control Electoral',
      status: 'En Proceso',
      createdDate: 'Hoy 08:30 AM'
    },
    {
      id: 'rec-3',
      title: 'Ajustar Mensaje Digital a Segmento Joven (18 - 28 años) sobre Empleo e Innovación',
      category: 'Digital & Mensaje',
      priority: 'Alta',
      estimatedImpact: '+4.2% Aumento en Intención de Voto Joven',
      description: 'Los datos de sondeos digitales revelan que el 64% de los jóvenes indecisos consideran la falta de empleo formal como su principal preocupación y no identifican la propuesta del candidato.',
      actionRequired: 'Lanzar micro-pauta digital en TikTok/Instagram enfocada en la propuesta de "Ciudadela Tecnológica y Nodos de Emprendimiento Digital".',
      assignedTeam: 'Comité de Comunicaciones',
      status: 'Pendiente',
      createdDate: 'Ayer'
    },
    {
      id: 'rec-4',
      title: 'Acelerar Legalización de Soportes Financieros para Informe CNE No. 2',
      category: 'Finanzas & CNE',
      priority: 'Alta',
      estimatedImpact: 'Evita Sanciones Administrativas CNE',
      description: 'Se registran $185 millones COP en gastos operativos pendientes de digitalizar con factura electrónica para la plataforma Cuentas Claras.',
      actionRequired: 'Solicitar a proveedores de pauta e imprentas las facturas definitivas con RUT actualizado.',
      assignedTeam: 'Dirección Administrativa y Financiera',
      status: 'Implementada',
      createdDate: 'Hace 3 días'
    },
    {
      id: 'rec-5',
      title: 'Aprovechar Debates Televisados para Cuestionar Propuesta Contractual del Competidor Puntero',
      category: 'Estrategia General',
      priority: 'Media',
      estimatedImpact: 'Captación del 15% de Votantes Indecisos de Opinión',
      description: 'Los sondeos muestran que el puntero (Carlos Rendón) tiene un 42% de percepción negativa por cuestionamientos contractuales pasados. El candidato debe posicionarse como la alternativa ética sin odios.',
      actionRequired: 'Preparar ficha técnica de contraste para el debate de Telemedellín con datos oficiales de contratación.',
      assignedTeam: 'Comité Estratégico de Narrativa',
      status: 'En Proceso',
      createdDate: 'Hace 4 días'
    }
  ] : []);

  // Modal Add state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newRec, setNewRec] = useState<{
    title: string;
    category: 'Territorial' | 'Digital & Mensaje' | 'Día E & Testigos' | 'Finanzas & CNE' | 'Estrategia General';
    priority: 'Crítica' | 'Alta' | 'Media' | 'Baja';
    estimatedImpact: string;
    description: string;
    actionRequired: string;
    assignedTeam: string;
  }>({
    title: '',
    category: 'Territorial',
    priority: 'Alta',
    estimatedImpact: '',
    description: '',
    actionRequired: '',
    assignedTeam: 'Equipo de Operaciones'
  });

  const loadRealAnalytics = async () => {
    setIsRefreshing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Inicie sesión para consultar el análisis real.');
      const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      const isUuid = (value: unknown): value is string =>
        typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      const rememberedCampaignId = localStorage.getItem('active_campaign_id');
      const activeCampaignId = isUuid(rememberedCampaignId)
        ? rememberedCampaignId
        : isUuid(profile?.campaign_id)
          ? profile.campaign_id
          : null;
      const activeClientId = isUuid(profile?.client_id) ? profile.client_id : null;
      if (!activeCampaignId && !activeClientId) {
        throw new Error('NO_ACTIVE_CAMPAIGN');
      }
      let campaignQuery = supabase.from('campaigns').select('id,client_id,meta_votos,presupuesto_total,descripcion');
      campaignQuery = activeCampaignId
        ? campaignQuery.eq('id', activeCampaignId)
        : campaignQuery.eq('client_id', activeClientId!);
      const { data: campaigns, error: campaignError } = await campaignQuery.order('updated_at', { ascending: false }).limit(1);
      if (campaignError) throw campaignError;
      const campaign = campaigns?.[0];
      if (!campaign) throw new Error('No existe una campaña activa para analizar.');
      const resolvedClientId = String(campaign.client_id || profile?.client_id || '');
      if (!isUuid(campaign.id) || !isUuid(resolvedClientId)) {
        throw new Error('NO_ACTIVE_CAMPAIGN');
      }
      const [votersResult, witnessesResult, budgetResult, surveyCountResult] = await Promise.all([
        supabase.from('voters').select('id,intencion,comuna,created_at').eq('client_id', resolvedClientId).neq('status', 'INACTIVE'),
        supabase.from('witnesses').select('id,estado,zona,municipio,created_at').eq('client_id', resolvedClientId).neq('estado', 'INACTIVO'),
        supabase.from('budget_items').select('id,tipo,categoria_cne,monto,estado,fecha').eq('campaign_id', campaign.id).neq('estado', 'ANULADO'),
        supabase.from('survey_responses').select('id', { count: 'exact', head: true }).eq('client_id', resolvedClientId),
      ]);
      if (votersResult.error) throw votersResult.error;
      if (witnessesResult.error) throw witnessesResult.error;
      if (budgetResult.error) throw budgetResult.error;
      if (surveyCountResult.error) throw surveyCountResult.error;
      const voters = votersResult.data || [];
      const witnesses = witnessesResult.data || [];
      const budget = budgetResult.data || [];
      const firmVotes = voters.filter((voter: any) => voter.intencion === 'Voto Seguro').length;
      const accreditedWitnesses = witnesses.filter((witness: any) => ['ACREDITADO', 'EN_MESA'].includes(String(witness.estado))).length;
      const expenses = budget.filter((item: any) => item.tipo === 'GASTO');
      const executedExpenses = expenses.reduce((sum: number, item: any) => sum + Number(item.monto || 0), 0);
      const verifiedExpenses = expenses.filter((item: any) => item.estado === 'VERIFICADO').reduce((sum: number, item: any) => sum + Number(item.monto || 0), 0);
      const monthMap = new Map<string, { identified: number; firm: number }>();
      voters.forEach((voter: any) => {
        const month = String(voter.created_at || '').slice(0, 7);
        if (!month) return;
        const current = monthMap.get(month) || { identified: 0, firm: 0 };
        current.identified += 1;
        if (voter.intencion === 'Voto Seguro') current.firm += 1;
        monthMap.set(month, current);
      });
      let cumulativeIdentified = 0;
      let cumulativeFirm = 0;
      const growth = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => {
        cumulativeIdentified += value.identified;
        cumulativeFirm += value.firm;
        return { mes: month, metaVotos: Number(campaign.meta_votos || 0), votosFirmes: cumulativeFirm, votosIdentificados: cumulativeIdentified };
      });
      const witnessGroups = new Map<string, { total: number; accredited: number }>();
      witnesses.forEach((witness: any) => {
        const area = String(witness.zona || witness.municipio || 'Sin zona');
        const current = witnessGroups.get(area) || { total: 0, accredited: 0 };
        current.total += 1;
        if (['ACREDITADO', 'EN_MESA'].includes(String(witness.estado))) current.accredited += 1;
        witnessGroups.set(area, current);
      });
      const witnessData = [...witnessGroups.entries()].map(([comuna, value]) => ({ comuna, mesas: value.total, testigosAcreditados: value.accredited, porcentaje: value.total ? Math.round(value.accredited * 100 / value.total) : 0 }));
      const categoryMap = new Map<string, { executed: number; verified: number }>();
      expenses.forEach((item: any) => {
        const category = String(item.categoria_cne || 'Sin categoría');
        const current = categoryMap.get(category) || { executed: 0, verified: 0 };
        current.executed += Number(item.monto || 0);
        if (item.estado === 'VERIFICADO') current.verified += Number(item.monto || 0);
        categoryMap.set(category, current);
      });
      const financeData = [...categoryMap.entries()].map(([rubro, value]) => ({ rubro, asignado: 0, ejecutado: value.executed / 1000000, facturadoCNE: value.verified / 1000000 }));
      let description: any = {};
      try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }
      setCampaignId(String(campaign.id));
      setClientId(resolvedClientId);
      setGrowthData(growth);
      setElectoralWitnessesData(witnessData);
      setFinancialAdminData(financeData);
      setExpensePieData(financeData.map((item, index) => ({ name: item.rubro, value: item.ejecutado, color: ['#38bdf8','#34d399','#fbbf24','#c084fc','#f87171'][index % 5] })));
      setRecommendations(Array.isArray(description.analyticsRecommendations) ? description.analyticsRecommendations : []);
      setMetrics({
        voteGoal: Number(campaign.meta_votos || 0), firmVotes,
        totalWitnesses: witnesses.length, accreditedWitnesses,
        budgetCeiling: Number(campaign.presupuesto_total || 0), executedExpenses, verifiedExpenses,
        surveyResponses: surveyCountResult.count || 0,
      });
      showToast('Datos reales actualizados desde la campaña.');
    } catch (error: any) {
      console.error('No fue posible cargar el análisis de campaña.', error);
      if (error?.message !== 'NO_ACTIVE_CAMPAIGN') {
        showToast('No fue posible actualizar los datos de la campaña.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadRealAnalytics();
  }, []);

  // ── Sincronización en vivo: cada vez que el CampaignProvider recibe un evento
  //    Realtime (budget_items, campaigns, leaders, voters…), actualiza instantáneamente
  //    las métricas críticas sin relanzar loadRealAnalytics.
  useEffect(() => {
    if (liveMetrics.lastUpdatedAt === 0) return;
    setMetrics(prev => ({
      ...prev,
      // Presupuesto — tope CNE y ejecutado en tiempo real
      budgetCeiling:    liveMetrics.budgetLimitCop    || prev.budgetCeiling,
      executedExpenses: liveMetrics.budgetExecutedCop || prev.executedExpenses,
      // Personas
      firmVotes:        liveMetrics.voterCount  || prev.firmVotes,
      totalWitnesses:   liveMetrics.witnessCount || prev.totalWitnesses,
      accreditedWitnesses: liveMetrics.witnessCount || prev.accreditedWitnesses,
    }));
  }, [liveMetrics.lastUpdatedAt]);

  const showToast = (msg: string) => {
    if (/invalid input syntax for type uuid/i.test(msg)) return;
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRefreshMetrics = () => {
    void loadRealAnalytics();
  };

  const saveRecommendations = async (next: AIRecommendation[]) => {
    const validCampaignId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId);
    if (!validCampaignId) throw new Error('NO_ACTIVE_CAMPAIGN');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', campaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const { error } = await supabase.from('campaigns').update({ descripcion: JSON.stringify({ ...description, analyticsRecommendations: next }), updated_at: new Date().toISOString() }).eq('id', campaignId);
    if (error) throw error;
  };

  const handleStatusChange = async (id: string, newStatus: 'Pendiente' | 'En Proceso' | 'Implementada') => {
    const next = recommendations.map(item => item.id === id ? { ...item, status: newStatus } : item);
    try {
      await saveRecommendations(next);
      setRecommendations(next);
      showToast(`Estado guardado: ${newStatus}`);
    } catch (error: any) {
      console.error('No fue posible actualizar la recomendación.', error);
      if (error?.message !== 'NO_ACTIVE_CAMPAIGN') {
        showToast('No fue posible actualizar la recomendación.');
      }
    }
  };

  const handleAddRecommendation = async () => {
    if (!newRec.title.trim() || !newRec.description.trim()) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }
    const createdItem: AIRecommendation = {
      id: `rec-${Date.now()}`,
      ...newRec,
      status: 'Pendiente',
      createdDate: 'Justo ahora'
    };
    const next = [createdItem, ...recommendations];
    try {
      await saveRecommendations(next);
      setRecommendations(next);
      setShowAddModal(false);
    setNewRec({
      title: '',
      category: 'Territorial',
      priority: 'Alta',
      estimatedImpact: '',
      description: '',
      actionRequired: '',
      assignedTeam: 'Equipo de Operaciones'
    });
      showToast('Recomendación guardada en la campaña activa.');
    } catch (error: any) {
      console.error('No fue posible guardar la recomendación.', error);
      if (error?.message !== 'NO_ACTIVE_CAMPAIGN') {
        showToast('No fue posible guardar la recomendación.');
      }
    }
  };

  const handleExportData = () => {
    const rows = [
      ['Indicador', 'Valor'],
      ['Votos firmes', metrics.firmVotes], ['Meta de votos', metrics.voteGoal],
      ['Testigos acreditados', metrics.accreditedWitnesses], ['Testigos registrados', metrics.totalWitnesses],
      ['Gastos ejecutados COP', metrics.executedExpenses], ['Gastos verificados COP', metrics.verifiedExpenses],
      ['Respuestas de encuestas', metrics.surveyResponses],
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analisis-campana-${campaignId || 'sin-campana'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Datos reales exportados en CSV.');
  };

  const pendingCount = recommendations.filter(r => r.status === 'Pendiente').length;
  const inProgressCount = recommendations.filter(r => r.status === 'En Proceso').length;
  const doneCount = recommendations.filter(r => r.status === 'Implementada').length;
  const firmVotePercent = metrics.voteGoal ? Math.min(100, metrics.firmVotes * 100 / metrics.voteGoal) : 0;
  const witnessPercent = metrics.totalWitnesses ? metrics.accreditedWitnesses * 100 / metrics.totalWitnesses : 0;
  const executedPercent = metrics.budgetCeiling ? Math.min(100, metrics.executedExpenses * 100 / metrics.budgetCeiling) : 0;
  const verifiedPercent = metrics.executedExpenses ? Math.min(100, metrics.verifiedExpenses * 100 / metrics.executedExpenses) : 0;
  const pendingLegalization = Math.max(0, metrics.executedExpenses - metrics.verifiedExpenses);
  const formatCop = (value: number) => `$${Math.round(value).toLocaleString('es-CO')} COP`;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-[100] bg-blue-900/90 border border-blue-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#05162a] border border-cyan-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Análisis de Datos de Campaña &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">Recomendaciones IA</span>
          </h1>
          {geoCtx.territory && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-300">{geoCtx.territory}</span>
              {geoCtx.officeLabel && <span className="text-slate-500">• {geoCtx.officeLabel}</span>}
              {liveMetrics.lastUpdatedAt > 0 && (
                <span className="ml-1 text-emerald-400 font-bold">• DATOS EN VIVO</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Consultando Supabase...' : 'Actualizar datos reales'}</span>
          </button>

          <button
            onClick={handleExportData}
            className="px-3.5 py-2.5 bg-[#030e1c] hover:bg-slate-800 text-slate-200 border border-cyan-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Exportar datos</span>
          </button>
        </div>
      </div>

      {/* TOP METRICS / KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* KPI 1: Intención de Voto */}
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-4 space-y-2 shadow-lg hover:border-cyan-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Intención de Voto</span>
            <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black text-amber-400 font-mono">Sin datos</span>
          </div>
          <p className="text-[10px] text-slate-400">Requiere respuestas de encuestas configuradas</p>
        </div>

        {/* KPI 2: Votos Asegurados */}
        <div className="bg-[#05162a] border border-emerald-500/30 rounded-2xl p-4 space-y-2 shadow-lg hover:border-emerald-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Votos Firmes</span>
            <div className="flex items-center gap-1.5">
              {liveMetrics.lastUpdatedAt > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Dato en vivo" />}
              <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg"><Target className="w-4 h-4" /></div>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400 font-mono">{metrics.firmVotes.toLocaleString('es-CO')}</span>
            <span className="text-[10px] font-bold text-slate-300 font-mono">{firmVotePercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${firmVotePercent}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">Meta: {metrics.voteGoal.toLocaleString('es-CO')} votos</p>
        </div>

        {/* KPI 3: Cobertura Testigos */}
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-4 space-y-2 shadow-lg hover:border-cyan-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Testigos Día E</span>
            <div className="flex items-center gap-1.5">
              {liveMetrics.lastUpdatedAt > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="Dato en vivo" />}
              <div className="p-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg"><ShieldCheck className="w-4 h-4" /></div>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-300 font-mono">{metrics.accreditedWitnesses} / {metrics.totalWitnesses}</span>
            <span className="text-[10px] font-bold text-cyan-400 font-mono">{witnessPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full transition-all duration-700" style={{ width: `${witnessPercent}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">{Math.max(0, metrics.totalWitnesses - metrics.accreditedWitnesses)} registros pendientes de acreditación</p>
        </div>




      </div>

      {/* MAIN NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-cyan-600 to-teal-700 text-white shadow-lg border border-cyan-400/50'
                : 'bg-[#051325] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-300" />
            <span>Dashboard 360°</span>
          </button>

          <button
            onClick={() => setActiveTab('growth_polls')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'growth_polls'
                ? 'bg-gradient-to-r from-cyan-600 to-teal-700 text-white shadow-lg border border-cyan-400/50'
                : 'bg-[#051325] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-300" />
            <span>Crecimiento Electoral &amp; Encuestas</span>
          </button>

          <button
            onClick={() => setActiveTab('electoral_territorial')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'electoral_territorial'
                ? 'bg-gradient-to-r from-cyan-600 to-teal-700 text-white shadow-lg border border-cyan-400/50'
                : 'bg-[#051325] text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Vote className="w-4 h-4 text-emerald-300" />
            <span>Datos Electorales &amp; Testigos</span>
          </button>

          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'recommendations'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-indigo-400/50'
                : 'bg-[#051325] text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
            <span>Recomendaciones IA</span>
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
              {pendingCount} Pendientes
            </span>
          </button>


        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1.5 bg-[#030e1c] p-1 rounded-2xl border border-cyan-500/20 text-xs">
          <span className="text-[10px] font-extrabold text-slate-400 px-2">Período:</span>
          {(['7d', '30d', 'campaign'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                timeframe === tf
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf === '7d' ? '7 Días' : tf === '30d' ? '30 Días' : 'Campaña Total'}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT 1: OVERVIEW 360 DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* AREA CHART: CRECIMIENTO ELECTORAL HISTÓRICO VS METAS */}
            <div className="lg:col-span-7 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Crecimiento Electoral Histórico vs Metas Planteadas
                  </h3>
                </div>
              </div>

              {/* Recharts AreaChart */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorFirmes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorIdentificados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip content={<CustomChartTooltip unit="Votos" />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="metaVotos" name="Meta Planeada" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorMeta)" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="votosFirmes" name="Votos Firmes Confirmados" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorFirmes)" />
                    <Area type="monotone" dataKey="votosIdentificados" name="Total Identificados" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#colorIdentificados)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* RADAR CHART: CANDIDATE IMAGE ATTRIBUTES VS RIVAL */}
            <div className="lg:col-span-5 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="border-b border-cyan-500/20 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Compass className="w-5 h-5 text-indigo-400" />
                  Percepción de Atributos de Imagen
                </h3>
              </div>

              {/* Recharts RadarChart */}
              <div className="h-72 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={candidateAttributesData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="atributo" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                    <Radar name="Santiago Pérez (Nuestro)" dataKey="SantiagoPerez" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
                    <Radar name="Carlos Rendón (Rival)" dataKey="CarlosRendon" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.3} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                    <Tooltip content={<CustomChartTooltip unit="Pts" />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

            </div>

          </div>

          {/* SECOND ROW: POLLS TREND & CNE EXPENSES CHART */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LINE CHART: INTENCIÓN DE VOTO HISTÓRICA */}
            <div className="lg:col-span-7 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    Evolución de Encuestas de Intención de Voto (%)
                  </h3>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pollTrackingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 40]} />
                    <Tooltip content={<CustomChartTooltip unit="%" />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="santiagoPerez" name="Santiago Pérez (Nuestro)" stroke="#34d399" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="carlosRendon" name="Carlos Rendón (Rival Puntero)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="elenaRestrepo" name="Elena Restrepo" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="indecisos" name="Indecisos / Voto Blanco" stroke="#fbbf24" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PIE CHART: EJECUCIÓN PRESUPUESTAL POR RUBRO */}
            <div className="lg:col-span-5 bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="border-b border-cyan-500/20 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-purple-400" />
                  Distribución del Gasto de Campaña CNE
                </h3>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip unit="M COP" />} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" align="center" verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT 2: CRECIMIENTO ELECTORAL & ENCUESTAS DE PERCEPCIÓN */}
      {activeTab === 'growth_polls' && (
        <div className="space-y-6">
          
          {/* SECTION A: CRECIMIENTO HISTÓRICO FULL CHART */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
              <div>
                <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Comparativa Histórica de Crecimiento Electoral vs Metas Planteadas
                </h3>
              </div>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={growthData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomChartTooltip unit="Votos" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="votosFirmes" name="Votos Firmes Confirmados" fill="#34d399" radius={[6, 6, 0, 0]} barSize={28} />
                  <Line type="monotone" dataKey="metaVotos" name="Meta Planeada" stroke="#38bdf8" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 6 }} />
                  <Line type="monotone" dataKey="votosIdentificados" name="Votos Identificados Totales" stroke="#a78bfa" strokeWidth={3} dot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION B: ENCUESTAS Y SONDEOS DE PERCEPCIÓN CIUDADANA */}
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-cyan-500/20 pb-3">
              <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Sondeos de Percepción Ciudadana por Temática Priority
              </h3>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={citizenPerceptionData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="aspecto" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip content={<CustomChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                  <Bar dataKey="preocupacion" name="% Preocupación Ciudadana" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="evaluacionGestionPositiva" name="% Evaluación Gestión Actual (Positiva)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resonanciaPropuesta" name="% Resonancia Propuesta Candidato" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT 3: DATOS ELECTORALES & TESTIGOS DE MESA */}
      {activeTab === 'electoral_territorial' && (
        <div className="space-y-6">
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Aspectos Electorales: Cobertura de Testigos por Comuna (Día E)
                </h3>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={electoralWitnessesData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="comuna" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<CustomChartTooltip unit="Mesas/Testigos" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="mesas" name="Total Mesas de Votación" fill="#475569" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="testigosAcreditados" name="Testigos Acreditados" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {electoralWitnessesData.map((d, i) => (
                <div key={i} className="p-3 bg-[#030e1c] rounded-2xl border border-cyan-500/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-white block">{d.comuna}</span>
                    <span className="text-[10px] text-slate-400">{d.testigosAcreditados} de {d.mesas} mesas cubiertas</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-extrabold text-sm ${d.porcentaje >= 90 ? 'text-emerald-400' : d.porcentaje >= 80 ? 'text-cyan-300' : 'text-rose-400'}`}>
                      {d.porcentaje}%
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Blindaje</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* TAB CONTENT 5: AI RECOMMENDATIONS CENTER */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#05162a] border border-indigo-500/40 p-6 rounded-3xl shadow-2xl">
            <div>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                Recomendaciones Esenciales IA para Mejoras de Campaña
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Recomendación Manual</span>
              </button>
            </div>
          </div>

          {/* RECOMMENDATIONS STATUS COUNTERS */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold border-b border-indigo-500/20 pb-2">
            <span className="w-full text-slate-400 font-extrabold text-[11px] uppercase sm:w-auto">Resumen de Recomendaciones:</span>
            <span className="max-w-full whitespace-nowrap px-3 py-1 bg-amber-950 text-amber-300 border border-amber-500/40 rounded-full">
              {pendingCount} Pendientes
            </span>
            <span className="max-w-full whitespace-nowrap px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-full">
              {inProgressCount} En Proceso
            </span>
            <span className="max-w-full whitespace-nowrap px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full">
              {doneCount} Implementadas
            </span>
          </div>

          {/* LIST OF RECOMMENDATIONS */}
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl hover:border-cyan-400/60 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-cyan-500/20 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        rec.priority === 'Crítica' ? 'bg-rose-950 text-rose-300 border-rose-500/50' :
                        rec.priority === 'Alta' ? 'bg-amber-950 text-amber-300 border-amber-500/50' :
                        'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                      }`}>
                        Prioridad {rec.priority}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-white">{rec.title}</h4>
                  </div>

                  {/* STATUS SWITCHER */}
                  <div className="flex items-center gap-1.5 bg-[#030e1c] p-1 rounded-xl border border-cyan-500/30 shrink-0">
                    {(['Pendiente', 'En Proceso', 'Implementada'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(rec.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                          rec.status === st
                            ? st === 'Implementada'
                              ? 'bg-emerald-600 text-white shadow'
                              : st === 'En Proceso'
                              ? 'bg-cyan-600 text-white shadow'
                              : 'bg-amber-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-[#030e1c] rounded-2xl border border-cyan-500/20 space-y-1">
                    <strong className="text-cyan-300 font-extrabold block">📌 Diagnóstico del Problema:</strong>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{rec.description}</p>
                  </div>

                  <div className="p-3.5 bg-[#030e1c] rounded-2xl border border-indigo-500/20 space-y-1">
                    <strong className="text-indigo-300 font-extrabold block">⚡ Acción Requerida:</strong>
                    <p className="text-slate-200 leading-relaxed text-[11px]">{rec.actionRequired}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs border-t border-cyan-500/10 text-slate-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Asignado a: <strong className="text-slate-200">{rec.assignedTeam}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono font-extrabold">Impacto Estimado: {rec.estimatedImpact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* MODAL: ADD RECOMMENDATION MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-indigo-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-indigo-500/20 pb-3">
              <h4 className="font-extrabold text-white text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Agregar Recomendación Estratégica
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Título de la Recomendación *</label>
                <input
                  type="text"
                  placeholder="Ej: Reforzar presencia en Comuna 8 durante fines de semana"
                  value={newRec.title}
                  onChange={e => setNewRec({ ...newRec, title: e.target.value })}
                  className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Categoría</label>
                  <select
                    value={newRec.category}
                    onChange={e => setNewRec({ ...newRec, category: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Territorial">Territorial</option>
                    <option value="Digital & Mensaje">Digital & Mensaje</option>
                    <option value="Día E & Testigos">Día E & Testigos</option>
                    <option value="Finanzas & CNE">Finanzas & CNE</option>
                    <option value="Estrategia General">Estrategia General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prioridad</label>
                  <select
                    value={newRec.priority}
                    onChange={e => setNewRec({ ...newRec, priority: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Diagnóstico / Descripción *</label>
                <textarea
                  rows={2}
                  placeholder="Describa el problema o hallazgo detectado en los datos..."
                  value={newRec.description}
                  onChange={e => setNewRec({ ...newRec, description: e.target.value })}
                  className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Acción Requerida</label>
                <textarea
                  rows={2}
                  placeholder="Instrucción concreta para el equipo responsable..."
                  value={newRec.actionRequired}
                  onChange={e => setNewRec({ ...newRec, actionRequired: e.target.value })}
                  className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Equipo Asignado</label>
                  <input
                    type="text"
                    placeholder="Ej: Operaciones Territoriales"
                    value={newRec.assignedTeam}
                    onChange={e => setNewRec({ ...newRec, assignedTeam: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Impacto Estimado</label>
                  <input
                    type="text"
                    placeholder="Ej: +2,000 Votos"
                    value={newRec.estimatedImpact}
                    onChange={e => setNewRec({ ...newRec, estimatedImpact: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-indigo-500/20">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddRecommendation}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-extrabold cursor-pointer"
              >
                Guardar Recomendación
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
