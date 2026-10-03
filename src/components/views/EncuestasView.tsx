import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { motion, AnimatePresence } from 'motion/react';
import { ViewMode, AuthUser } from '../../types';
import { 
  BarChart3, 
  Users, 
  Check, 
  PlusCircle, 
  Activity, 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  ThumbsUp, 
  Filter, 
  Sparkles,
  MapPin,
  CheckCircle2,
  Trash2,
  Info,
  ChevronDown,
  RefreshCw,
  Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useModuleColorMode } from '../../utils/themeColorMode';
import { ColorModeToggle } from '../common/ColorModeToggle';
import { confirmModal, showToast } from '../common/ConfirmModal';
import { normalizeMunicipioName } from '../../data/puestosVotacionColombia';

interface EncuestasViewProps {
  onSelectView: (view: ViewMode) => void;
  authUser: AuthUser | null;
}

interface Encuesta {
  id: string;
  nombre: string;
  comuna: string;
  intencionVoto: string;
  preocupacion: string;
  calificacionGobierno: 'Excelente' | 'Aceptable' | 'Mala';
  dispuestoAVotar: 'Completamente Seguro' | 'Podría cambiar' | 'Indeciso' | 'No asistiré a votar';
  edad: string;
  sexo: 'Masculino' | 'Femenino' | 'Otro';
  participacionJornada: 'Sí participará' | 'No participará' | 'Indeciso';
  fecha: string;
  timestamp: string;
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

// ─── Zonas y Corregimientos Oficiales para Cotorra, Córdoba ────────────────
const COTORRA_ZONAS_DEFAULT = [
  'Cabecera Municipal (Centro)',
  'Zona Urbana (Sector San Roque)',
  'Corregimiento Trementino',
  'Corregimiento El Paso',
  'Corregimiento Los Cedros',
  'Corregimiento Abrojal',
  'Corregimiento San Roque',
  'Corregimiento El Carmen'
];

export const EncuestasView: React.FC<EncuestasViewProps> = ({ onSelectView, authUser }) => {
  const { colorMode, isWhiteMode } = useModuleColorMode('gestion_territorial');
  const campaignCtx = useCampaignData();
  const campaignGeo = useCampaignGeo();

  const [encuestas, setEncuestas] = useState<Encuesta[]>(() => {
    try {
      const cached = localStorage.getItem('encuestas_cache_v3');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [campaignId, setCampaignId] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [pollsterId, setPollsterId] = useState<string | null>(null);
  const [surveyTitle, setSurveyTitle] = useState('Sondeo Oficial de Clima Político & Intención de Voto');
  const [candidateOptions, setCandidateOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>(COTORRA_ZONAS_DEFAULT);
  const [metaDiaria, setMetaDiaria] = useState(30);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form states
  const [nombre, setNombre] = useState('');
  const [comuna, setComuna] = useState(COTORRA_ZONAS_DEFAULT[0]);
  const [intencionVoto, setIntencionVoto] = useState('');
  const [preocupacion, setPreocupacion] = useState('Seguridad ciudadana');
  const [calificacionGobierno, setCalificacionGobierno] = useState<Encuesta['calificacionGobierno']>('Aceptable');
  const [dispuestoAVotar, setDispuestoAVotar] = useState<Encuesta['dispuestoAVotar']>('Completamente Seguro');
  
  // Mandatory demographic and participation fields
  const [edad, setEdad] = useState('18 - 24 años');
  const [sexo, setSexo] = useState<Encuesta['sexo']>('Masculino');
  const [participacionJornada, setParticipacionJornada] = useState<Encuesta['participacionJornada']>('Sí participará');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Filters states
  const [filtroComuna, setFiltroComuna] = useState('Todas');
  const [filtroVoto, setFiltroVoto] = useState('Todas');

  // Helper para verificar UUID válido
  const isUUID = (val: any): val is string => 
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  // ─── Carga Real de Encuestas y Configuración Territorial ──────────────────
  const loadRealSurveys = useCallback(async () => {
    setLoading(true);
    setDataError('');
    try {
      // 1. Resolver campaña activa
      const remembered = localStorage.getItem('active_campaign_id') || localStorage.getItem('elecciones_campana_activa_id_v2');
      let resolvedCampaignId = campaignCtx.campaign?.campaignId || (isUUID(remembered) ? remembered : '');
      let resolvedClientId = campaignCtx.campaign?.clientId || authUser?.clientId || '';

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;

      if ((!resolvedCampaignId || !resolvedClientId) && currentUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('client_id, campaign_id')
          .eq('id', currentUserId)
          .maybeSingle();

        if (profile?.campaign_id && isUUID(profile.campaign_id)) resolvedCampaignId = profile.campaign_id;
        if (profile?.client_id && isUUID(profile.client_id)) resolvedClientId = profile.client_id;
      }

      // Si aún no está resuelta, obtener la última campaña registrada
      if (!resolvedCampaignId) {
        const { data: latestCamp } = await supabase
          .from('campaigns')
          .select('id, client_id, nombre, candidato_nombre, descripcion, municipio')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestCamp?.id) {
          resolvedCampaignId = latestCamp.id;
          if (latestCamp.client_id) resolvedClientId = latestCamp.client_id;
        }
      }

      setCampaignId(resolvedCampaignId);

      // 2. Determinar municipio y zonas territoriales reales
      const activeMunicipality = campaignCtx.campaign?.municipality || campaignGeo.municipality || 'Cotorra';
      const normMun = normalizeMunicipioName(activeMunicipality);
      
      const geoSubdivisions = Array.isArray(campaignGeo.subdivisions) ? campaignGeo.subdivisions : [];
      const computedZones = Array.from(new Set([
        ...COTORRA_ZONAS_DEFAULT,
        ...geoSubdivisions
      ])).filter(Boolean);

      setLocationOptions(computedZones);
      setComuna(prev => computedZones.includes(prev) ? prev : computedZones[0]);

      // 3. Determinar candidatos reales (propio, rivales, voto en blanco, NS/NR)
      const officialCandidateName = (
        campaignCtx.campaign?.candidateName || 
        campaignCtx.campaign?.campaignName || 
        'ALEJANDRO DORIA'
      ).trim();

      let dynamicRivals: string[] = [];
      if (resolvedCampaignId) {
        try {
          const { data: campRow } = await supabase
            .from('campaigns')
            .select('descripcion')
            .eq('id', resolvedCampaignId)
            .maybeSingle();

          if (campRow?.descripcion) {
            let descObj: any = {};
            try { descObj = JSON.parse(campRow.descripcion); } catch {}
            if (Array.isArray(descObj?.politicalActors)) {
              dynamicRivals = descObj.politicalActors
                .filter((a: any) => a?.name && (a.role === 'Competidor Directo' || a.role === 'Rival'))
                .map((a: any) => String(a.name).trim());
            }
          }
        } catch {
          // Ignorar fallo de lectura descriptiva
        }
      }

      if (dynamicRivals.length === 0) {
        dynamicRivals = [
          'GUILLERMO LLORENTE (Coalición Transformación)',
          'MARÍA PAULA VEGA (Movimiento Cívico Cotorra)',
          'CARLOS ANDRÉS MARTÍNEZ (Alianza Democrática)'
        ];
      }

      const allCandidateOptions = Array.from(new Set([
        officialCandidateName,
        ...dynamicRivals,
        'Voto en Blanco',
        'No Sabe / No Responde (NS/NR)'
      ]));

      setCandidateOptions(allCandidateOptions);
      setIntencionVoto(prev => allCandidateOptions.includes(prev) ? prev : allCandidateOptions[0]);

      // 4. Buscar o aprovisionar encuesta activa en el servidor central
      let activeStudy: any = null;
      if (resolvedCampaignId) {
        const { data: studies } = await supabase
          .from('surveys')
          .select('id, titulo, title, estado, status, muestra_objetivo, location')
          .eq('campaign_id', resolvedCampaignId)
          .order('created_at', { ascending: false })
          .limit(1);

        activeStudy = studies?.[0];
      }

      // Si no existe un estudio en el servidor, creamos el estudio oficial
      if (!activeStudy && resolvedCampaignId) {
        const { data: createdSurvey } = await supabase
          .from('surveys')
          .insert({
            campaign_id: resolvedCampaignId,
            client_id: resolvedClientId || null,
            titulo: `Sondeo de Clima Político & Intención de Voto - ${activeMunicipality} 2026`,
            descripcion: `Estudio cuantitativo de percepción ciudadana y tendencias de opinión en ${activeMunicipality}`,
            estado: 'ACTIVA',
            muestra_objetivo: 350,
            fecha_inicio: new Date().toISOString().split('T')[0],
            fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
          })
          .select('id, titulo, title, estado, status, muestra_objetivo, location')
          .maybeSingle();

        activeStudy = createdSurvey;
      }

      if (activeStudy) {
        setSurveyId(String(activeStudy.id));
        setSurveyTitle(activeStudy.titulo || activeStudy.title || `Sondeo Oficial - ${activeMunicipality}`);
      }

      // 5. Cargar meta del encuestador
      if (resolvedCampaignId && authUser?.email) {
        const { data: pollsters } = await supabase
          .from('survey_pollsters')
          .select('id, daily_goal')
          .eq('campaign_id', resolvedCampaignId)
          .eq('email', authUser.email.toLowerCase())
          .maybeSingle();

        if (pollsters) {
          setPollsterId(String(pollsters.id));
          if (pollsters.daily_goal && Number(pollsters.daily_goal) > 0) {
            setMetaDiaria(Number(pollsters.daily_goal));
          }
        }
      }

      // 6. Cargar respuestas históricas reales de encuestas
      let responseRows: any[] = [];
      if (resolvedCampaignId) {
        const { data: rows, error: rowsError } = await supabase
          .from('survey_responses')
          .select('id, answers, submitted_at, respondent_code')
          .eq('campaign_id', resolvedCampaignId)
          .order('submitted_at', { ascending: false })
          .limit(200);

        if (!rowsError && rows) {
          responseRows = rows;
        }
      }

      const todayStr = new Date().toDateString();
      const mapped: Encuesta[] = responseRows.map((row: any) => {
        const a = row.answers || {};
        const submitted = new Date(row.submitted_at);
        const isToday = submitted.toDateString() === todayStr;
        const timePart = submitted.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        return {
          id: String(row.id),
          nombre: a.nombre || 'Anónimo',
          comuna: a.comuna || COTORRA_ZONAS_DEFAULT[0],
          intencionVoto: a.intencionVoto || officialCandidateName,
          preocupacion: a.preocupacion || 'Seguridad ciudadana',
          calificacionGobierno: a.calificacionGobierno || 'Aceptable',
          dispuestoAVotar: a.dispuestoAVotar || 'Completamente Seguro',
          edad: a.edad || '18 - 24 años',
          sexo: a.sexo || 'Masculino',
          participacionJornada: a.participacionJornada || 'Sí participará',
          fecha: isToday ? `Hoy (${timePart})` : submitted.toLocaleDateString('es-CO'),
          timestamp: row.submitted_at
        };
      });

      setEncuestas(mapped);
      try {
        localStorage.setItem('encuestas_cache_v3', JSON.stringify(mapped));
      } catch {}

    } catch (error: any) {
      const message = error?.message || 'Error al conectar con el servidor central.';
      setDataError(message);
    } finally {
      setLoading(false);
    }
  }, [campaignCtx.campaign, campaignGeo, authUser]);

  useEffect(() => {
    void loadRealSurveys();
  }, [loadRealSurveys]);

  // Suscripción Realtime a nuevas encuestas en el servidor central
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`realtime-surveys-${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'survey_responses',
        filter: `campaign_id=eq.${campaignId}`
      }, () => {
        void loadRealSurveys();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, loadRealSurveys]);

  // Conteo de encuestas completadas hoy
  const completadasHoy = useMemo(() => {
    const todayStr = new Date().toDateString();
    return encuestas.filter(e => {
      try {
        return new Date(e.timestamp).toDateString() === todayStr;
      } catch {
        return e.fecha.startsWith('Hoy');
      }
    }).length;
  }, [encuestas]);

  // ─── Guardar Encuesta en la Base de Datos Real ─────────────────────────────
  const executeSaveSurvey = async () => {
    if (!campaignId) {
      showToast('No se detectó una campaña activa en el servidor central.', 'error');
      return;
    }
    if (!comuna || !intencionVoto) {
      showToast('Por favor seleccione la comuna y la intención de voto.', 'error');
      return;
    }

    setSaving(true);
    setDataError('');

    try {
      const resolvedCode = `ENC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const payloadAnswers = {
        nombre: nombre.trim() || 'Anónimo',
        comuna,
        intencionVoto,
        preocupacion,
        calificacionGobierno,
        dispuestoAVotar,
        edad,
        sexo,
        participacionJornada,
        encuestador_nombre: authUser?.name || 'Encuestador Oficial',
        encuestador_email: authUser?.email || '',
        municipio: campaignCtx.campaign?.municipality || 'Cotorra'
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('survey_responses')
        .insert({
          campaign_id: campaignId,
          survey_id: surveyId || null,
          pollster_id: pollsterId || null,
          respondent_code: resolvedCode,
          consent_confirmed: true,
          answers: payloadAnswers,
          submitted_by: authUser?.id || null,
          submitted_at: new Date().toISOString()
        })
        .select('id, answers, submitted_at, respondent_code')
        .single();

      if (insertError) throw insertError;

      // Actualizar estado local inmediatamente para 60 FPS
      const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      const newEncuesta: Encuesta = {
        id: String(insertedRow?.id || resolvedCode),
        nombre: payloadAnswers.nombre,
        comuna: payloadAnswers.comuna,
        intencionVoto: payloadAnswers.intencionVoto,
        preocupacion: payloadAnswers.preocupacion,
        calificacionGobierno: payloadAnswers.calificacionGobierno,
        dispuestoAVotar: payloadAnswers.dispuestoAVotar,
        edad: payloadAnswers.edad,
        sexo: payloadAnswers.sexo,
        participacionJornada: payloadAnswers.participacionJornada,
        fecha: `Hoy (${nowStr})`,
        timestamp: new Date().toISOString()
      };

      setEncuestas(prev => [newEncuesta, ...prev]);
      setNombre('');
      setShowConfirmModal(false);

      showToast('Encuesta registrada con éxito en el servidor central seguro.', 'success');
      void loadRealSurveys();

    } catch (err: any) {
      const msg = err?.message || 'Error al persistir la encuesta en la base de datos central.';
      setDataError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSurveySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleDeletEncuesta = async (id: string) => {
    if (authUser?.role === 'puntero_territorial' || authUser?.role === 'lider') {
      showToast('Los usuarios de campo no tienen permisos para eliminar encuestas.', 'error');
      return;
    }
    const target = encuestas.find(e => e.id === id);
    await confirmModal({
      title: 'Eliminar respuesta de encuesta',
      message: `¿Está seguro de eliminar el registro de "${target?.nombre || 'este ciudadano'}"? Esta acción se sincronizará de inmediato en el servidor central seguro.`,
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        const { error } = await supabase.from('survey_responses').delete().eq('id', id).eq('campaign_id', campaignId);
        if (error) {
          setDataError(error.message);
          showToast(error.message, 'error');
          return false;
        }
        setEncuestas(prev => prev.filter(e => e.id !== id));
        showToast('Registro de encuesta eliminado del servidor central.', 'success');
      }
    });
  };

  // ─── Métricas en Tiempo Real ──────────────────────────────────────────────
  const totalEncuestas = encuestas.length;

  const intencionVotoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    candidateOptions.forEach(opt => { counts[opt] = 0; });
    encuestas.forEach(e => {
      counts[e.intencionVoto] = (counts[e.intencionVoto] || 0) + 1;
    });
    return counts;
  }, [encuestas, candidateOptions]);

  const CATEGORIAS_PREOCUPACION = useMemo(() => [
    'Seguridad',
    'Economía',
    'Movilidad',
    'Salud',
    'Educación',
    'Infraestructura'
  ], []);

  const preocupacionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIAS_PREOCUPACION.forEach(cat => { counts[cat] = 0; });
    
    encuestas.forEach(e => {
      const p = e.preocupacion.toLowerCase();
      if (p.includes('seguridad')) counts['Seguridad'] = (counts['Seguridad'] || 0) + 1;
      else if (p.includes('econom') || p.includes('empleo')) counts['Economía'] = (counts['Economía'] || 0) + 1;
      else if (p.includes('movilidad') || p.includes('transporte')) counts['Movilidad'] = (counts['Movilidad'] || 0) + 1;
      else if (p.includes('salud')) counts['Salud'] = (counts['Salud'] || 0) + 1;
      else if (p.includes('educa')) counts['Educación'] = (counts['Educación'] || 0) + 1;
      else if (p.includes('vías') || p.includes('infraestructura')) counts['Infraestructura'] = (counts['Infraestructura'] || 0) + 1;
      else counts['Seguridad'] = (counts['Seguridad'] || 0) + 1;
    });
    return counts;
  }, [encuestas, CATEGORIAS_PREOCUPACION]);

  // Filtrado reactivo de encuestas
  const encuestasFiltradas = useMemo(() => {
    return encuestas.filter(e => {
      const matchComuna = filtroComuna === 'Todas' || e.comuna === filtroComuna;
      const matchVoto = filtroVoto === 'Todas' || e.intencionVoto === filtroVoto;
      return matchComuna && matchVoto;
    });
  }, [encuestas, filtroComuna, filtroVoto]);

  return (
    <motion.div 
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
      data-module="encuestas"
      data-color-mode={isWhiteMode ? 'white' : 'established'}
      className="responsive-view encuestas-campo-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#030712] text-slate-100 p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto overflow-x-hidden relative"
    >
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
          <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-pulse" />
        </div>
      )}

      {dataError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{dataError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => void loadRealSurveys()} 
            className="font-bold text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}
      
      {/* ─── 1. Cabecera Principal y Widget de Meta Diaria ─────────────────── */}
      <motion.div 
        variants={staggerItemVariants}
        className="encuestas-header-banner bg-gradient-to-r from-[#0b1d38] via-[#0d2a4a] to-[#2563eb] rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden border border-cyan-500/20"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.12),transparent)]" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black tracking-tight">Registro de Encuestas & Opinión</h2>
              <ColorModeToggle moduleId="gestion_territorial" />
            </div>
            <p className="text-xs text-cyan-200/80 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>{surveyTitle}</span>
              <span className="text-slate-400">·</span>
              <span className="text-blue-200 font-mono text-[11px]">{campaignCtx.campaign?.municipality || 'Cotorra, Córdoba'}</span>
            </p>
          </div>
          
          {/* Widget de Meta Diaria */}
          <div className="encuestas-goal-card bg-[#041733]/90 border border-cyan-500/30 rounded-2xl p-4 w-full md:w-auto md:min-w-[240px] shrink-0 shadow-lg space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Meta de Hoy</span>
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {completadasHoy} / {metaDiaria} encuestas
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full survey-progress-bar" 
                style={{ width: `${metaDiaria > 0 ? Math.min((completadasHoy / metaDiaria) * 100, 100) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              {completadasHoy >= metaDiaria 
                ? '🎉 ¡Meta diaria cumplida! Excelente trabajo en campo.' 
                : `Faltan ${metaDiaria - completadasHoy} encuestas para cumplir la meta de hoy (${completadasHoy} registradas hoy).`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── 2. Grid Principal: Formulario y Panel de Historial ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Formulario "Registrar Nueva Encuesta" */}
        <motion.div variants={staggerItemVariants} className="lg:col-span-2 space-y-6">
          <div className="encuestas-form-card bg-[#041733]/50 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <PlusCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-white tracking-wide">Registrar Nueva Encuesta</h3>
            </div>

            <form onSubmit={handleSurveySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre del Encuestado */}
                <div className="space-y-1.5 survey-input-focus rounded-xl">
                  <label className="text-xs font-bold text-slate-300">Nombre del Encuestado (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Anónimo o Nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Comuna / Barrio de Residencia */}
                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">Comuna / Barrio de Residencia</label>
                  <div className="relative">
                    <select
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      {locationOptions.map(zone => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>
              </div>

              {/* Preguntas Principales P1 y P2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">
                    P1: Si las elecciones a la Alcaldía fueran el día de hoy, ¿por cuál de los siguientes candidatos votaría usted? *
                  </label>
                  <div className="relative">
                    <select
                      value={intencionVoto}
                      onChange={(e) => setIntencionVoto(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors font-medium"
                    >
                      {candidateOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>

                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">
                    P2: ¿Qué tan seguro está de su voto para las próximas elecciones? *
                  </label>
                  <div className="relative">
                    <select
                      value={dispuestoAVotar}
                      onChange={(e) => setDispuestoAVotar(e.target.value as any)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      <option value="Completamente Seguro">Completamente Seguro</option>
                      <option value="Podría cambiar">Podría cambiar</option>
                      <option value="Indeciso">Indeciso</option>
                      <option value="No asistiré a votar">No asistiré a votar</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>
              </div>

              {/* Preguntas P3 y P4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">P3: Preocupación Principal del Ciudadano</label>
                  <div className="relative">
                    <select
                      value={preocupacion}
                      onChange={(e) => setPreocupacion(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      <option value="Seguridad ciudadana">Seguridad ciudadana</option>
                      <option value="Economía y Empleo">Economía y Empleo</option>
                      <option value="Movilidad y Transporte">Movilidad y Transporte</option>
                      <option value="Sistema de Salud">Sistema de Salud</option>
                      <option value="Educación pública">Educación pública</option>
                      <option value="Vías e infraestructura">Vías e infraestructura</option>
                      <option value="Medio Ambiente / Agua Potable">Medio Ambiente / Agua Potable</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">P4: Calificación de la Gestión Local Actual</label>
                  <div className="flex gap-2">
                    {(['Excelente', 'Aceptable', 'Mala'] as const).map((cal) => {
                      const isSelected = calificacionGobierno === cal;
                      const activeStyle = 
                        cal === 'Excelente' 
                          ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] scale-[1.02]' 
                          : cal === 'Aceptable' 
                          ? 'border-amber-500 text-amber-400 bg-amber-950/30 shadow-[0_0_12px_rgba(245,158,11,0.25)] scale-[1.02]' 
                          : 'border-rose-500 text-rose-400 bg-rose-950/30 shadow-[0_0_12px_rgba(244,63,94,0.25)] scale-[1.02]';

                      return (
                        <button
                          key={cal}
                          type="button"
                          onClick={() => setCalificacionGobierno(cal)}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all duration-150 will-change-transform ${
                            isSelected 
                              ? activeStyle 
                              : 'border-slate-800 text-slate-400 bg-[#020a17] hover:bg-slate-800/80 hover:border-slate-500 hover:text-white'
                          }`}
                        >
                          {cal}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Demográficos Obligatorios P5, P6, P7 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">P5: Rango de Edad *</label>
                  <div className="relative">
                    <select
                      value={edad}
                      onChange={(e) => setEdad(e.target.value)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      <option value="18 - 24 años">18 - 24 años</option>
                      <option value="25 - 34 años">25 - 34 años</option>
                      <option value="35 - 44 años">35 - 44 años</option>
                      <option value="45 - 54 años">45 - 54 años</option>
                      <option value="55 - 64 años">55 - 64 años</option>
                      <option value="65 años o más">65 años o más</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>

                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">P6: Sexo del Encuestado *</label>
                  <div className="relative">
                    <select
                      value={sexo}
                      onChange={(e) => setSexo(e.target.value as any)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro / Prefiere no decir</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>

                <div className="space-y-1.5 survey-input-focus rounded-xl relative">
                  <label className="text-xs font-bold text-slate-300">P7: Participación en Jornada Electoral *</label>
                  <div className="relative">
                    <select
                      value={participacionJornada}
                      onChange={(e) => setParticipacionJornada(e.target.value as any)}
                      className="w-full bg-[#020a17] border border-slate-700/60 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer appearance-none pr-8 transition-colors"
                    >
                      <option value="Sí participará">Sí participará</option>
                      <option value="No participará">No participará</option>
                      <option value="Indeciso">No sabe / Indeciso</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
                  </div>
                </div>
              </div>

              {/* Botón Primario "Guardar Encuesta" */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading || saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black cursor-pointer shadow-lg flex items-center justify-center gap-2 will-change-transform hover:brightness-110 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.96] transition-all duration-200"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Guardando en Servidor…' : 'Guardar Encuesta'}</span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>

        {/* Columna Derecha: HISTORIAL DE ENCUESTAS */}
        <motion.div variants={staggerItemVariants} className="space-y-6">
          <div className="encuestas-history-card bg-[#041733]/50 border border-slate-800/80 rounded-3xl p-5 shadow-xl space-y-4 min-h-[500px] flex flex-col">
            
            {/* Cabecera y Filtros */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Historial de Encuestas</span>
                  <span className="text-[10px] text-cyan-300 font-mono font-normal">({encuestasFiltradas.length})</span>
                </h4>
                <div 
                  className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-colors duration-150 cursor-pointer"
                  title="Filtros activos"
                >
                  <Filter className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Filtros Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Comuna</label>
                  <select
                    value={filtroComuna}
                    onChange={(e) => setFiltroComuna(e.target.value)}
                    className="w-full bg-[#020a17] border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
                  >
                    <option value="Todas">Todas</option>
                    {locationOptions.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Intención Voto</label>
                  <select
                    value={filtroVoto}
                    onChange={(e) => setFiltroVoto(e.target.value)}
                    className="w-full bg-[#020a17] border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
                  >
                    <option value="Todas">Todas</option>
                    {candidateOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista Scrollable de Encuestas */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mt-2 max-h-[440px]">
              <AnimatePresence>
                {encuestasFiltradas.length > 0 ? (
                  encuestasFiltradas.map((enc) => {
                    const isCandidatePropio = enc.intencionVoto === candidateOptions[0];
                    const isIndeciso = enc.intencionVoto.toLowerCase().includes('indeciso') || enc.intencionVoto.toLowerCase().includes('no sabe');
                    
                    const votoColor = isCandidatePropio 
                      ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-500/30' 
                      : isIndeciso 
                      ? 'text-amber-300 bg-amber-950/40 border border-amber-500/30' 
                      : 'text-slate-300 bg-slate-900 border border-slate-800';

                    return (
                      <motion.div
                        key={enc.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="encuestas-history-item bg-[#020a17] border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2 relative group transition-colors"
                      >
                        {/* Botón de eliminación para roles autorizados */}
                        {authUser?.role !== 'puntero_territorial' && authUser?.role !== 'lider' && (
                          <button
                            onClick={() => handleDeletEncuesta(enc.id)}
                            className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Eliminar encuesta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h5 className="text-xs font-bold text-white">{enc.nombre}</h5>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                              {enc.comuna}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">{enc.fecha}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                          <div className="bg-[#041733] border border-slate-800 rounded p-1.5">
                            <span className="text-slate-500 block uppercase font-medium">Alarma Principal</span>
                            <span className="font-semibold text-slate-300 truncate block">{enc.preocupacion}</span>
                          </div>
                          <div className="bg-[#041733] border border-slate-800 rounded p-1.5">
                            <span className="text-slate-500 block uppercase font-medium">Gestión Actual</span>
                            <span className="font-semibold text-slate-300 truncate block">{enc.calificacionGobierno}</span>
                          </div>
                        </div>

                        {/* Detalles demográficos */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-400 bg-slate-950/40 p-1.5 rounded border border-slate-850 mt-1">
                          <span>Edad: <strong className="text-slate-300">{enc.edad}</strong></span>
                          <span>•</span>
                          <span>Sexo: <strong className="text-slate-300">{enc.sexo}</strong></span>
                          <span>•</span>
                          <span>Participará: <strong className="text-slate-300">{enc.participacionJornada}</strong></span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${votoColor}`}>
                            Voto: {enc.intencionVoto}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Seguridad: <strong className="text-slate-300">{enc.dispuestoAVotar}</strong>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mx-auto empty-survey-icon">
                      <Info className="w-6 h-6 text-cyan-400" />
                    </div>
                    <p className="text-xs text-slate-400">No se encontraron encuestas registradas con este filtro.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </motion.div>

      </div>

      {/* ─── 3. Paneles Inferiores de Analítica en Tiempo Real ─────────────── */}
      <motion.div variants={staggerItemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel "INTENCIÓN DE VOTO" */}
        <div className="survey-metric-card bg-[#041733]/50 border border-slate-800/80 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Intención de Voto</h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Muestra del día</span>
          </div>
          <div className="space-y-3">
            {candidateOptions.map((candidate, index) => {
              const count = intencionVotoCounts[candidate] || 0;
              const percent = totalEncuestas > 0 ? Math.round((count / totalEncuestas) * 100) : 0;
              
              const isPropio = index === 0;
              const isIndeciso = candidate.toLowerCase().includes('indeciso') || candidate.toLowerCase().includes('no sabe');
              const isBlanco = candidate.toLowerCase().includes('blanco');

              const barColor = isPropio 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                : isIndeciso 
                ? 'bg-amber-500' 
                : isBlanco 
                ? 'bg-slate-600' 
                : 'bg-indigo-600';

              return (
                <div key={candidate} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className={isPropio ? 'text-cyan-300 font-bold' : 'text-slate-300'}>{candidate}</span>
                    <span className="font-mono text-slate-400">{count} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/60">
                    <div 
                      className={`h-full rounded-full survey-progress-bar ${barColor}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel "PREOCUPACIONES CIUDADANAS" */}
        <div className="survey-metric-card bg-[#041733]/50 border border-slate-800/80 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Preocupaciones Ciudadanas</h4>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Top de alarmas</span>
          </div>
          <div className="space-y-3">
            {CATEGORIAS_PREOCUPACION.map((pre, idx) => {
              const count = preocupacionCounts[pre] || 0;
              const percent = totalEncuestas > 0 ? Math.round((count / totalEncuestas) * 100) : 0;
              
              const barGradient = idx === 0 
                ? 'bg-gradient-to-r from-rose-500 to-amber-500' 
                : idx === 1 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-500';

              return (
                <div key={pre} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{pre}</span>
                    <span className="font-mono text-slate-400">{count} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/60">
                    <div 
                      className={`h-full rounded-full survey-progress-bar ${barGradient}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </motion.div>

      {/* ─── Modal de Confirmación Antes de Persistir ──────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#000]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="encuestas-modal-card bg-[#0b1329] border border-cyan-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Confirmar Datos de la Encuesta</h4>
                <p className="text-xs text-slate-400 mt-0.5">Valide la información antes de guardar en el servidor central seguro.</p>
              </div>
            </div>

            <div className="bg-[#020712]/60 rounded-2xl p-4 border border-slate-850 text-xs space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Ciudadano</span>
                  <span className="text-white font-bold">{nombre.trim() || 'Anónimo'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Ubicación / Comuna</span>
                  <span className="text-cyan-300 font-bold">{comuna}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P1: Intención de Voto</span>
                  <span className="text-cyan-300 font-bold">{intencionVoto}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P2: Seguridad de Voto</span>
                  <span className="text-white font-bold">{dispuestoAVotar}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P3: Preocupación Principal</span>
                  <span className="text-slate-300 font-semibold">{preocupacion}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P4: Gestión Local</span>
                  <span className="text-slate-300 font-semibold">{calificacionGobierno}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60 font-medium">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P5: Edad</span>
                  <span className="text-white font-bold">{edad}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P6: Sexo</span>
                  <span className="text-white font-bold">{sexo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">P7: Participará</span>
                  <span className="text-white font-bold">{participacionJornada}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2 [&>button]:w-full sm:[&>button]:w-auto">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar y Corregir
              </button>
              <button
                type="button"
                onClick={executeSaveSurvey}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
