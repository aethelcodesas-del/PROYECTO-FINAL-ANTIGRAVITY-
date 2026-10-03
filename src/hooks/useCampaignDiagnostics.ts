import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPuestosPorCircunscripcion } from '../data/puestosVotacionColombia';

export interface CampaignStats {
  pollingStations: number;
  totalMesas: number;
  mesasCubiertas: number;
  leaders: number;
  voters: number;
  witnesses: number;
  budgetItems: number;
  totalIngresos: number;
  totalGastos: number;
  surveys: number;
  promedioIntencion: number;
  proposals: number;
  activities: number;
}

export interface UseCampaignDiagnosticsResult {
  stats: CampaignStats;
  loading: boolean;
  isScanning: boolean;
  lastSyncDate: string;
  diagnosticMessage: string;
  coberturaScore: number;
  encuestasScore: number;
  testigosScore: number;
  finanzasScore: number;
  estrategiaScore: number;
  censoScore: number;
  overallScore: number;
  animatedScore: number;
  levelBadge: string;
  levelBadgeColor: string;
  runScan: () => Promise<void>;
  clearMessage: () => void;
}

export function useCampaignDiagnostics(
  campaignId?: string | null,
  municipality: string = 'Cotorra'
): UseCampaignDiagnosticsResult {
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<string>('');
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>('');
  const [animatedScore, setAnimatedScore] = useState<number>(0);

  const [stats, setStats] = useState<CampaignStats>({
    pollingStations: 71,
    totalMesas: 71,
    mesasCubiertas: 0,
    leaders: 0,
    voters: 0,
    witnesses: 0,
    budgetItems: 0,
    totalIngresos: 0,
    totalGastos: 0,
    surveys: 0,
    promedioIntencion: 0,
    proposals: 0,
    activities: 0,
  });

  // Calculate official total tables for municipality from DIVIPOLE catalog if needed
  const getCatalogMesas = useCallback((mun: string): number => {
    try {
      const list = getPuestosPorCircunscripcion('Municipal', 'Córdoba', mun || 'Cotorra');
      return list.reduce((acc, curr) => acc + (curr.mesas || 1), 0) || 71;
    } catch {
      return 71;
    }
  }, []);

  const fetchDiagnosticsData = useCallback(async (activeId?: string | null) => {
    const campId = activeId || campaignId;
    if (!campId) {
      setLoading(false);
      return;
    }

    try {
      const catalogMesas = getCatalogMesas(municipality);

      // 1. Polling Stations / Mesas
      let pollingCount = 0;
      let totalMesasCount = catalogMesas;
      try {
        const { count, error } = await supabase
          .from('polling_stations')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!error && typeof count === 'number' && count > 0) {
          pollingCount = count;
          totalMesasCount = count;
        } else {
          // Fallback to DIVIPOLE official Cotorra census
          pollingCount = catalogMesas;
          totalMesasCount = catalogMesas;
        }
      } catch {
        pollingCount = catalogMesas;
        totalMesasCount = catalogMesas;
      }

      // 2. Líderes (leaders o lideres)
      let leadersCount = 0;
      try {
        const { count, error } = await supabase
          .from('leaders')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!error && typeof count === 'number') {
          leadersCount = count;
        }
      } catch {
        // Safe query
      }

      // 3. Simpatizantes / Votantes (voters o votantes)
      let votersCount = 0;
      try {
        const { count, error } = await supabase
          .from('voters')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!error && typeof count === 'number') {
          votersCount = count;
        }
      } catch {
        // Safe query
      }

      // 4. Testigos Electorales (witnesses o testigos_electorales)
      let witnessesCount = 0;
      try {
        const { count, error } = await supabase
          .from('witnesses')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!error && typeof count === 'number') {
          witnessesCount = count;
        }
      } catch {
        // Safe query
      }

      // 5. Presupuesto / Rendición Finanzas CNE (budget_items)
      let budgetCount = 0;
      let ingresos = 0;
      let gastos = 0;
      try {
        const { data: bData, error } = await supabase
          .from('budget_items')
          .select('id, monto, tipo')
          .eq('campaign_id', campId);
        if (!error && Array.isArray(bData)) {
          budgetCount = bData.length;
          bData.forEach((item: any) => {
            const amount = Number(item.monto || item.amount || 0);
            const type = String(item.tipo || item.type || '').toUpperCase();
            if (type.includes('INGRESO')) {
              ingresos += amount;
            } else {
              gastos += amount;
            }
          });
        }
      } catch {
        // Safe query
      }

      // 6. Encuestas & Sondeos (surveys)
      let surveysCount = 0;
      let promedioIntencion = 0;
      try {
        const { data: sData, error } = await supabase
          .from('surveys')
          .select('id, title, status')
          .eq('campaign_id', campId);
        if (!error && Array.isArray(sData)) {
          surveysCount = sData.length;
          if (surveysCount > 0) {
            // Check responses if available
            try {
              const { data: rData } = await supabase
                .from('survey_responses')
                .select('id, answers')
                .eq('campaign_id', campId)
                .limit(50);
              if (Array.isArray(rData) && rData.length > 0) {
                let sumIntencion = 0;
                let countResponses = 0;
                rData.forEach((r: any) => {
                  const ans = r.answers;
                  if (ans && typeof ans === 'object') {
                    const intVal = Number(ans.intencion || ans.voto || ans.porcentaje || 0);
                    if (intVal > 0) {
                      sumIntencion += intVal;
                      countResponses++;
                    }
                  }
                });
                if (countResponses > 0) {
                  promedioIntencion = Math.round(sumIntencion / countResponses);
                }
              }
            } catch {
              // ignore response parse
            }
          }
        }
      } catch {
        // Safe query
      }

      // 7. Despliegue Estratégico (strategic_proposals & campaign_activities)
      let proposalsCount = 0;
      let activitiesCount = 0;
      try {
        const { count: prCount, error: prErr } = await supabase
          .from('strategic_proposals')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!prErr && typeof prCount === 'number') {
          proposalsCount = prCount;
        }
      } catch {
        // Safe query
      }

      try {
        const { count: actCount, error: actErr } = await supabase
          .from('campaign_activities')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campId);
        if (!actErr && typeof actCount === 'number') {
          activitiesCount = actCount;
        }
      } catch {
        // Safe query
      }

      // Cobertura real de mesas (por líderes o testigos asignados)
      const mesasCubiertas = Math.min(totalMesasCount, witnessesCount + Math.min(totalMesasCount - witnessesCount, leadersCount));

      setStats({
        pollingStations: pollingCount,
        totalMesas: totalMesasCount,
        mesasCubiertas,
        leaders: leadersCount,
        voters: votersCount,
        witnesses: witnessesCount,
        budgetItems: budgetCount,
        totalIngresos: ingresos,
        totalGastos: gastos,
        surveys: surveysCount,
        promedioIntencion,
        proposals: proposalsCount,
        activities: activitiesCount,
      });

      const now = new Date();
      const nowFormatted =
        now.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      setLastSyncDate(nowFormatted);
    } finally {
      setLoading(false);
    }
  }, [campaignId, municipality, getCatalogMesas]);

  useEffect(() => {
    fetchDiagnosticsData();
  }, [fetchDiagnosticsData]);

  // Pillar 1: Cobertura Territorial (Máximo 100)
  // Base 40 si tiene puestos oficiales cargados en Supabase, + proporción de mesas y estructura
  const coberturaScore = Math.min(
    100,
    (stats.pollingStations > 0 ? 40 : 0) +
      Math.min(
        60,
        (stats.totalMesas > 0 ? Math.round((stats.mesasCubiertas / stats.totalMesas) * 30) : 0) +
          stats.leaders * 10 +
          Math.min(20, stats.voters)
      )
  );

  // Pillar 2: Intención de Voto & Sondeos (0 si no hay encuestas)
  const encuestasScore = stats.surveys > 0 
    ? Math.min(100, stats.promedioIntencion > 0 ? stats.promedioIntencion : 50 + stats.surveys * 10) 
    : 0;

  // Pillar 3: Testigos & Día E (proporción sobre total de mesas)
  const testigosScore = stats.totalMesas > 0
    ? Math.min(100, Math.round((stats.witnesses / stats.totalMesas) * 100))
    : stats.witnesses > 0 ? 100 : 0;

  // Pillar 4: Rendición Finanzas CNE (0 si no hay movimientos contables)
  const finanzasScore = stats.budgetItems > 0 
    ? Math.min(100, 70 + stats.budgetItems * 5) 
    : 0;

  // Pillar 5: Despliegue Estratégico (propuestas programáticas + hitos en agenda)
  const estrategiaScore = Math.min(
    100,
    (stats.proposals > 0 ? 50 : 0) + (stats.activities > 0 ? 50 : 0)
  );

  // Pillar 6: Filtro Unificado Censo (votantes y simpatizantes verificados)
  const censoScore = stats.voters > 0 || stats.leaders > 0 
    ? Math.min(100, 60 + Math.min(40, stats.voters * 2 + stats.leaders * 5)) 
    : 0;

  // Índice de Salud Global: Promedio ponderado de los 6 pilares
  // Si solo Cobertura Territorial está activa con 40 puntos y las demás en 0:
  // 40 / 6 = 6.67 ≈ 6 (o ponderado con balance exacto)
  const overallScore = Math.round(
    (coberturaScore + encuestasScore + testigosScore + finanzasScore + estrategiaScore + censoScore) / 6
  );

  // Smooth Count-Up Animation (0 to overallScore over 500ms)
  const animRef = useRef<number | null>(null);
  useEffect(() => {
    const duration = 500;
    const startVal = animatedScore;
    const endVal = overallScore;
    const startTime = performance.now();

    const animateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeProgress);
      setAnimatedScore(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateCount);
      }
    };

    animRef.current = requestAnimationFrame(animateCount);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [overallScore]);

  // Nivel y Badge
  let levelBadge = 'Nivel: Configuración Inicial';
  let levelBadgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/30';
  if (overallScore >= 75) {
    levelBadge = 'Nivel: Operativa';
    levelBadgeColor = 'bg-emerald-900/80 text-emerald-300 border-emerald-400/50';
  } else if (overallScore >= 40) {
    levelBadge = 'Nivel: En Crecimiento';
    levelBadgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-500/30';
  }

  // Ejecutar Diagnóstico AI
  const runScan = async () => {
    setIsScanning(true);
    setDiagnosticMessage('');
    try {
      await fetchDiagnosticsData();
      const nowStr =
        new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' +
        new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      setDiagnosticMessage(
        `Diagnóstico 360° actualizado desde el servidor central (${nowStr}): ${stats.pollingStations} puesto(s), ${stats.leaders} líder(es), ${stats.voters} simpatizante(s), ${stats.witnesses} testigo(s).`
      );
    } finally {
      setIsScanning(false);
    }
  };

  const clearMessage = () => setDiagnosticMessage('');

  return {
    stats,
    loading,
    isScanning,
    lastSyncDate,
    diagnosticMessage,
    coberturaScore,
    encuestasScore,
    testigosScore,
    finanzasScore,
    estrategiaScore,
    censoScore,
    overallScore,
    animatedScore,
    levelBadge,
    levelBadgeColor,
    runScan,
    clearMessage,
  };
}
