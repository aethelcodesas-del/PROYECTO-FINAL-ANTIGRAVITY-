/**
 * CampaignContext — Contexto global de campaña + métricas en vivo
 *
 * Carga los datos de la campaña activa del usuario al iniciar sesión
 * y suscribe canales Supabase Realtime para que TODO el sistema refleje
 * cambios en tiempo real:
 *   - Presupuesto (límite CNE y ejecutado actual)
 *   - Conteo de líderes
 *   - Conteo de votantes registrados
 *   - Conteo de testigos acreditados
 *   - Conteo de jurados asignados
 *
 * Cualquier módulo llama useCampaignData() o useCampaignLive() sin
 * necesitar su propia suscripción a Supabase.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CampaignData {
  /** ID interno de la campaña en Supabase */
  campaignId: string;
  /** ID del cliente (tenant) */
  clientId: string;
  /** Nombre completo del candidato */
  candidateName: string;
  /** Nombre de la campaña / cliente */
  campaignName: string;
  /** Tipo de cargo al que se aspira (Alcaldía, Senado, Gobernación…) */
  officeType: string;
  /** Departamento de la circunscripción */
  department: string;
  /** Municipio / ciudad principal */
  municipality: string;
  /**
   * Tipo de circunscripción definida en Global Admin:
   * MUNICIPAL | DEPARTAMENTAL | NACIONAL | CIRCUNSCRIPCION_ESPECIAL
   */
  circunscripcion: string;
  /** Etiqueta corta legible para la UI: "Cotorra, Córdoba" */
  territory: string;
  /** Slogan de campaña */
  slogan: string;
  /** Partido o coalición */
  partyAlliance: string;
  /** Color principal de la campaña en hex (#RRGGBB) */
  primaryColor: string;
}

/** Métricas operativas en vivo — se actualizan automáticamente vía Realtime */
export interface CampaignLiveMetrics {
  /** Tope máximo CNE (en COP) definido en la campaña */
  budgetLimitCop: number;
  /** Total ejecutado / comprometido (sum de budget_items tipo Gasto) */
  budgetExecutedCop: number;
  /** Total de ingresos registrados (sum de budget_items tipo Ingreso) */
  budgetIncomeCop: number;
  /** Porcentaje de ejecución (0-100) */
  budgetExecutionPct: number;
  /** Número de líderes/coordinadores registrados */
  leaderCount: number;
  /** Número de votantes en el censo */
  voterCount: number;
  /** Número de testigos asignados */
  witnessCount: number;
  /** Número de jurados de mesa */
  jurorCount: number;
  /** Última actualización de métricas */
  lastUpdatedAt: number;
}

export interface CampaignContextValue {
  campaign: CampaignData | null;
  live: CampaignLiveMetrics;
  isLoading: boolean;
  isLiveLoading: boolean;
  error: string;
  /** Forzar recarga completa desde Supabase */
  reload: () => void;
}

// ─── Valores por defecto ──────────────────────────────────────────────────────

const EMPTY_CAMPAIGN: CampaignData = {
  campaignId: '',
  clientId: '',
  candidateName: '',
  campaignName: '',
  officeType: '',
  department: '',
  municipality: '',
  circunscripcion: '',
  territory: '',
  slogan: '',
  partyAlliance: '',
  primaryColor: '#06b6d4',
};

const EMPTY_LIVE: CampaignLiveMetrics = {
  budgetLimitCop: 0,
  budgetExecutedCop: 0,
  budgetIncomeCop: 0,
  budgetExecutionPct: 0,
  leaderCount: 0,
  voterCount: 0,
  witnessCount: 0,
  jurorCount: 0,
  lastUpdatedAt: 0,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CampaignContext = createContext<CampaignContextValue>({
  campaign: null,
  live: EMPTY_LIVE,
  isLoading: false,
  isLiveLoading: false,
  error: '',
  reload: () => undefined,
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function countTable(
  table: string,
  field: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(field, value);
  if (error) return 0;
  return count ?? 0;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CampaignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [live, setLive] = useState<CampaignLiveMetrics>(EMPTY_LIVE);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const reload = useCallback(() => setRevision(r => r + 1), []);

  // ── Carga métricas en vivo ─────────────────────────────────────────────────
  const isUUID = (val: any): val is string => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const loadLiveMetrics = useCallback(async (campaignId: string, clientId: string) => {
    if (!campaignId || !isUUID(campaignId)) return;
    setIsLiveLoading(true);
    try {
      // Presupuesto: suma de budget_items agrupado por tipo
      const { data: budgetRows } = await supabase
        .from('budget_items')
        .select('tipo, monto, observaciones, estado')
        .eq('campaign_id', campaignId);

      let executed = 0;
      let income = 0;
      (budgetRows || []).forEach((row: any) => {
        if (row.estado === 'ANULADO') return;
        let amount = Number(row.monto ?? 0);
        try {
          const meta = JSON.parse(row.observaciones || '{}')?.budgetMeta;
          if (meta?.montoEjecutado !== undefined) amount = Number(meta.montoEjecutado);
        } catch {}
        if (String(row.tipo).toUpperCase() === 'GASTO') executed += amount;
        if (String(row.tipo).toUpperCase() === 'INGRESO') income += amount;
      });

      // Tope CNE desde la campaña
      const { data: campRow } = await supabase
        .from('campaigns')
        .select('presupuesto_total')
        .eq('id', campaignId)
        .maybeSingle();
      const limit = Number(campRow?.presupuesto_total ?? 0);

      // Conteos de personas por client_id
      const validClientId = isUUID(clientId) ? clientId : null;
      const [leaders, voters, witnesses, jurors] = validClientId ? await Promise.all([
        countTable('leaders',   'client_id', validClientId),
        countTable('voters',    'client_id', validClientId),
        countTable('witnesses', 'client_id', validClientId),
        countTable('jurors',    'client_id', validClientId),
      ]) : [0, 0, 0, 0];

      setLive({
        budgetLimitCop:     limit,
        budgetExecutedCop:  executed,
        budgetIncomeCop:    income,
        budgetExecutionPct: limit > 0 ? Math.min(100, Math.round((executed / limit) * 100)) : 0,
        leaderCount:        leaders,
        voterCount:         voters,
        witnessCount:       witnesses,
        jurorCount:         jurors,
        lastUpdatedAt:      Date.now(),
      });
    } catch {
      // Métricas fallan silenciosamente — no bloquean la UI
    } finally {
      setIsLiveLoading(false);
    }
  }, []);

  // ── Suscripciones Realtime ─────────────────────────────────────────────────
  const setupRealtimeSubscriptions = useCallback((campaignId: string, clientId: string) => {
    // Limpiar canales anteriores
    channelsRef.current.forEach(ch => void supabase.removeChannel(ch));
    channelsRef.current = [];

    const refresh = () => void loadLiveMetrics(campaignId, clientId);

    // campaigns → presupuesto_total cambia
    const chCampaign = supabase
      .channel(`ctx-campaign-${campaignId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'campaigns',
        filter: `id=eq.${campaignId}`
      }, refresh)
      .subscribe();

    // budget_items → gastos e ingresos cambian
    const chBudget = supabase
      .channel(`ctx-budget-${campaignId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'budget_items',
        filter: `campaign_id=eq.${campaignId}`
      }, refresh)
      .subscribe();

    // leaders
    const chLeaders = supabase
      .channel(`ctx-leaders-${clientId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'leaders',
        filter: `client_id=eq.${clientId}`
      }, refresh)
      .subscribe();

    // voters
    const chVoters = supabase
      .channel(`ctx-voters-${clientId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'voters',
        filter: `client_id=eq.${clientId}`
      }, refresh)
      .subscribe();

    // witnesses
    const chWitnesses = supabase
      .channel(`ctx-witnesses-${clientId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'witnesses',
        filter: `client_id=eq.${clientId}`
      }, refresh)
      .subscribe();

    // jurors
    const chJurors = supabase
      .channel(`ctx-jurors-${clientId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jurors',
        filter: `client_id=eq.${clientId}`
      }, refresh)
      .subscribe();

    channelsRef.current = [chCampaign, chBudget, chLeaders, chVoters, chWitnesses, chJurors];
  }, [loadLiveMetrics]);

  // ── Carga datos de la campaña ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadCampaign = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          userId = refreshed.session?.user?.id;
        }
        if (!userId) { if (!cancelled) setCampaign(null); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('client_id, campaign_id')
          .eq('id', userId)
          .maybeSingle();

        const rawRemembered = profile?.campaign_id || localStorage.getItem('active_campaign_id');
        const rememberedId = isUUID(rawRemembered) ? rawRemembered : null;
        const profileClientId = isUUID(profile?.client_id) ? profile.client_id : null;
        const profileCampaignId = isUUID(profile?.campaign_id) ? profile.campaign_id : null;

        let rows: any[] | null = null;
        let dbError: any = null;

        // 1. Si hay ID de campaña, buscar directamente
        const targetId = rememberedId || profileCampaignId;
        if (targetId) {
          const result = await supabase.from('campaigns').select(
            'id, nombre, candidato_nombre, cargo_postulacion, departamento, municipio, circunscripcion, client_id, descripcion, presupuesto_total, estado'
          ).eq('id', targetId).limit(1);
          rows = result.data;
          dbError = result.error;
        }

        // 2. Si no hay resultado y hay client_id, buscar por client_id
        if (!rows?.length && profileClientId) {
          const result = await supabase.from('campaigns').select(
            'id, nombre, candidato_nombre, cargo_postulacion, departamento, municipio, circunscripcion, client_id, descripcion, presupuesto_total, estado'
          ).eq('client_id', profileClientId).order('updated_at', { ascending: false }).limit(1);
          rows = result.data;
          dbError = result.error;
        }

        if (dbError) throw dbError;

        if (!rows?.length) { if (!cancelled) setCampaign(null); return; }
        const row = rows[0];

        let desc: Record<string, any> = {};
        try { desc = typeof row.descripcion === 'string' ? JSON.parse(row.descripcion) : (row.descripcion || {}); } catch { desc = {}; }

        const mun = String(row.municipio || desc.municipality || '').replace(/\s*\(Capital\)\s*/gi, '').trim();
        const dep = String(row.departamento || desc.department || '');
        const circScope = String(row.circunscripcion || desc.circunscripcion || 'MUNICIPAL').toUpperCase();
        const territory = circScope === 'NACIONAL'
          ? 'Colombia'
          : circScope === 'DEPARTAMENTAL'
            ? dep
            : [mun, dep].filter(Boolean).join(', ') || 'Circunscripción';

        const clientId = String(row.client_id || profile?.client_id || profile?.campaign_id || '');
        const campaignId = String(row.id || '');

        const data: CampaignData = {
          campaignId,
          clientId,
          campaignName:  String(row.nombre            || desc.campaignName  || ''),
          candidateName: String(row.candidato_nombre  || desc.candidateName || desc.fullName || ''),
          officeType:    String(row.cargo_postulacion || desc.candidateOffice || ''),
          department:    dep,
          municipality:  mun,
          circunscripcion: circScope,
          territory,
          slogan:        String(desc.slogan           || ''),
          partyAlliance: String(desc.partyAlliance    || ''),
          primaryColor:  String(desc.primaryColor     || '#06b6d4'),
        };

        if (!cancelled) {
          setCampaign(data);
          // Cargar métricas y activar suscripciones Realtime
          void loadLiveMetrics(campaignId, clientId);
          setupRealtimeSubscriptions(campaignId, clientId);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'No fue posible cargar los datos de la campaña.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadCampaign();
    return () => { cancelled = true; };
  }, [revision, loadLiveMetrics, setupRealtimeSubscriptions]);

  // Recargar al cambiar sesión
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setRevision(r => r + 1);
      if (event === 'SIGNED_OUT') {
        setCampaign(null);
        setLive(EMPTY_LIVE);
        channelsRef.current.forEach(ch => void supabase.removeChannel(ch));
        channelsRef.current = [];
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      channelsRef.current.forEach(ch => void supabase.removeChannel(ch));
    };
  }, []);

  return (
    <CampaignContext.Provider value={{ campaign, live, isLoading, isLiveLoading, error, reload }}>
      {children}
    </CampaignContext.Provider>
  );
};

// ─── Hooks públicos ───────────────────────────────────────────────────────────

/** Retorna el contexto completo de campaña + métricas en vivo */
export const useCampaign = (): CampaignContextValue => useContext(CampaignContext);

/**
 * Retorna los datos estáticos de la campaña (territorio, candidato, cargo…)
 * con valores por defecto seguros cuando todavía no hay datos.
 */
export const useCampaignData = (): CampaignData => {
  const { campaign } = useContext(CampaignContext);
  return campaign ?? EMPTY_CAMPAIGN;
};

/**
 * Retorna las métricas en vivo (presupuesto, líderes, votantes…).
 * Se actualiza automáticamente sin necesidad de código adicional en el módulo.
 *
 * @example
 * const { budgetExecutedCop, leaderCount, voterCount } = useCampaignLive();
 */
export const useCampaignLive = (): CampaignLiveMetrics => {
  const { live } = useContext(CampaignContext);
  return live;
};
