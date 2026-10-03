import React, { useEffect, useState } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { supabase } from '../../lib/supabaseClient';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Download,
  Scale,
  DollarSign,
  Target,
  MapPin,
  BarChart3,
  BookOpen,
  Award,
  Layers,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  CheckSquare,
  Globe,
  X,
  Eye,
  Save,
  RefreshCw
} from 'lucide-react';

export interface PropuestaGobierno {
  id: string;
  titulo: string;
  problemaDiagnostico: string;
  solucionProgramatica: string;
  metaCuantificable: string;
  indicadorODS: string;
  presupuestoEstimado: string;
  plazoEjecucion: 'Corto Plazo (100 Días)' | 'Mediano Plazo (Año 1-2)' | 'Largo Plazo (Cuatrienio)';
  comunaFocalizada: string;
  fuenteFinanciacion: 'Presupuesto Municipal' | 'Cofinanciación Nacional' | 'Alianza Público-Privada (APP)' | 'Regalías / Cooperación';
  prioridad: 'Crítica' | 'Alta' | 'Media';
}

export interface EjeEstrategico {
  id: string;
  titulo: string;
  icono: string;
  color: string;
  descripcion: string;
  presupuestoPorcentaje: number;
  propuestas: PropuestaGobierno[];
}

interface ProgramaGobiernoViewProps {
  candidateName?: string;
  territory?: string;
  slogan?: string;
  office?: string;
  candidateProfile?: any;
  sectorDiagnostics?: any[];
  territorialNeeds?: any[];
  onUpdateCandidateProfile?: (updated: any) => void;
}

const DEFAULT_CHECKLIST = [
  { id: 1, rule: 'Articulación con el Plan Nacional de Desarrollo (PND)', ok: false },
  { id: 2, rule: 'Viabilidad Financiera según Marco Fiscal de Mediano Plazo (Ley 819)', ok: false },
  { id: 3, rule: 'Inclusión de Metas Cuantificables e Indicadores de Resultado', ok: false },
  { id: 4, rule: 'Enfoque Diferencial (Jóvenes, Mujeres, Víctimas y Adulto Mayor)', ok: false },
  { id: 5, rule: 'Alineación con los Objetivos de Desarrollo Sostenible (Agenda 2030 ONU)', ok: false },
  { id: 6, rule: 'Formato Oficial para Radicación en Registraduría al Inscribir Candidatura', ok: false }
];

export const ProgramaGobiernoView: React.FC<ProgramaGobiernoViewProps> = ({
  candidateName: propCandidateName,
  territory: propTerritory,
  slogan: propSlogan,
  office: propOffice,
  sectorDiagnostics,
  territorialNeeds,
  candidateProfile,
  onUpdateCandidateProfile
}) => {
  const campaignCtx = useCampaignData();
  const geoCtx = useCampaignGeo();

  const candidateName = propCandidateName || campaignCtx.candidateName || '';
  const territory = propTerritory || geoCtx.territory || '';
  const slogan = propSlogan || campaignCtx.slogan || '';
  const office = propOffice || geoCtx.officeLabel || '';

  const [campaignId, setCampaignId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'ejes' | 'presupuesto' | 'cumplimiento' | 'vista_previa'>('ejes');
  const [selectedEjeId, setSelectedEjeId] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [showAddPropuestaModal, setShowAddPropuestaModal] = useState<boolean>(false);
  const [editingPropuestaId, setEditingPropuestaId] = useState<string | null>(null);
  const [viewingPropuesta, setViewingPropuesta] = useState<PropuestaGobierno | null>(null);
  const [propuestaToDelete, setPropuestaToDelete] = useState<{ ejeId: string; propuesta: PropuestaGobierno } | null>(null);

  const [showAddEjeModal, setShowAddEjeModal] = useState<boolean>(false);
  const [editingEjeId, setEditingEjeId] = useState<string | null>(null);
  const [ejeToDelete, setEjeToDelete] = useState<EjeEstrategico | null>(null);

  const [newEje, setNewEje] = useState({
    titulo: '',
    icono: '📌',
    descripcion: '',
    presupuestoPorcentaje: 25
  });

  const [programMeta, setProgramMeta] = useState({
    visionTitle: '',
    visionStatement: '',
    totalInvestmentPlan: '',
    period: '2026 - 2030',
    legalFramework: 'Ley 131 de 1994 (Voto Programático) & Ley 152 de 1994 (Ley Orgánica del Plan de Desarrollo)',
    odsAlignmentScore: 0,
    citizenConsultations: 0
  });

  // 100% Real Ejes State (Zero Mock Data)
  const [ejes, setEjes] = useState<EjeEstrategico[]>([]);

  const emptyPropuestaForm: Omit<PropuestaGobierno, 'id'> = {
    titulo: '',
    problemaDiagnostico: '',
    solucionProgramatica: '',
    metaCuantificable: '',
    indicadorODS: 'ODS 16: Paz, Justicia e Instituciones Sólidas',
    presupuestoEstimado: '',
    plazoEjecucion: 'Mediano Plazo (Año 1-2)',
    comunaFocalizada: 'Todo el Territorio',
    fuenteFinanciacion: 'Presupuesto Municipal',
    prioridad: 'Alta'
  };

  const [newPropuesta, setNewPropuesta] = useState<Omit<PropuestaGobierno, 'id'>>(emptyPropuestaForm);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load real government program from Supabase
  useEffect(() => {
    let mounted = true;
    const loadProgramFromSupabase = async () => {
      setIsLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const userId = sessionData.session?.user?.id;

        let campaign: any = null;
        if (token) {
          try {
            const resp = await authenticatedFetch('/api/supabase-admin/active-campaign', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (resp.ok) {
              const body = await resp.json();
              if (body?.campaign) campaign = body.campaign;
            }
          } catch {
            // fallback
          }
        }

        if (!campaign) {
          const rememberedId = localStorage.getItem('active_campaign_id');
          if (rememberedId) {
            const { data } = await supabase
              .from('campaigns')
              .select('id,client_id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,descripcion')
              .eq('id', rememberedId)
              .maybeSingle();
            if (data) campaign = data;
          }
        }

        if (!campaign && userId) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('client_id,campaign_id')
            .eq('id', userId)
            .maybeSingle();
          if (prof?.campaign_id) {
            const { data } = await supabase
              .from('campaigns')
              .select('id,client_id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,descripcion')
              .eq('id', prof.campaign_id)
              .maybeSingle();
            if (data) campaign = data;
          }
        }

        if (!campaign) {
          const { data } = await supabase
            .from('campaigns')
            .select('id,client_id,nombre,candidato_nombre,cargo_postulacion,departamento,municipio,circunscripcion,descripcion')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) campaign = data;
        }

        if (!campaign || !mounted) {
          setIsLoading(false);
          return;
        }

        const activeCampId = String(campaign.id);
        const activeClientId = String(campaign.client_id || campaign.id);
        setCampaignId(activeCampId);
        setClientId(activeClientId);
        localStorage.setItem('active_campaign_id', activeCampId);

        let desc: any = {};
        try {
          desc = JSON.parse(campaign.descripcion || '{}');
        } catch {
          desc = {};
        }

        const savedGov = desc.governmentProgram || {};
        const loadedEjes: EjeEstrategico[] = Array.isArray(savedGov.ejes) ? savedGov.ejes : [];

        // Also check dedicated table strategic_proposals if ejes is empty
        if (loadedEjes.length === 0) {
          const { data: propRows } = await supabase
            .from('strategic_proposals')
            .select('*')
            .eq('campaign_id', activeCampId)
            .order('created_at', { ascending: true });

          if (Array.isArray(propRows) && propRows.length > 0) {
            const mapByEje = new Map<string, EjeEstrategico>();
            for (const row of propRows) {
              const eId = String(row.eje_id || 'eje-general');
              if (!mapByEje.has(eId)) {
                mapByEje.set(eId, {
                  id: eId,
                  titulo: String(row.eje_titulo || 'Eje Programático'),
                  icono: String(row.eje_icono || '📌'),
                  color: 'cyan',
                  descripcion: '',
                  presupuestoPorcentaje: Number(row.eje_presupuesto || 25),
                  propuestas: []
                });
              }
              mapByEje.get(eId)!.propuestas.push({
                id: String(row.id),
                titulo: String(row.titulo || ''),
                problemaDiagnostico: String(row.problema_diagnostico || ''),
                solucionProgramatica: String(row.solucion_programatica || ''),
                metaCuantificable: String(row.meta_cuantificable || ''),
                indicadorODS: String(row.indicador_ods || 'ODS 16: Paz, Justicia e Instituciones Sólidas'),
                presupuestoEstimado: String(row.presupuesto_estimado || ''),
                plazoEjecucion: (row.plazo_ejecucion as any) || 'Mediano Plazo (Año 1-2)',
                comunaFocalizada: String(row.comuna_focalizada || 'Todo el Territorio'),
                fuenteFinanciacion: (row.fuente_financiacion as any) || 'Presupuesto Municipal',
                prioridad: (row.prioridad as any) || 'Alta'
              });
            }
            loadedEjes.push(...Array.from(mapByEje.values()));
          }
        }

        if (!mounted) return;
        setEjes(loadedEjes);
        setSelectedEjeId(loadedEjes[0]?.id || '');

        if (savedGov.programMeta) {
          setProgramMeta(prev => ({ ...prev, ...savedGov.programMeta }));
        }
        if (Array.isArray(savedGov.checklist) && savedGov.checklist.length > 0) {
          setChecklist(savedGov.checklist);
        }
      } catch (err: any) {
        console.warn('Error loading government program from Supabase:', err?.message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadProgramFromSupabase();
    return () => {
      mounted = false;
    };
  }, []);

  const persistGovernmentProgram = async (
    nextEjes: EjeEstrategico[] = ejes,
    nextMeta = programMeta,
    nextChecklist = checklist
  ) => {
    const targetCampId = campaignId || localStorage.getItem('active_campaign_id') || '';
    if (!targetCampId) {
      showToast('No existe una campaña activa para guardar el Programa de Gobierno.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data: campRow, error: readErr } = await supabase
        .from('campaigns')
        .select('descripcion')
        .eq('id', targetCampId)
        .single();
      if (readErr) throw readErr;

      let desc: any = {};
      try {
        desc = JSON.parse(campRow?.descripcion || '{}');
      } catch {
        desc = {};
      }

      const updatedDesc = JSON.stringify({
        ...desc,
        governmentProgram: {
          ejes: nextEjes,
          programMeta: nextMeta,
          checklist: nextChecklist,
          updatedAt: new Date().toISOString()
        }
      });

      let savedOk = false;
      if (token) {
        const resp = await authenticatedFetch('/api/supabase-admin/political-crm', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            table: 'campaigns',
            id: targetCampId,
            data: { descripcion: updatedDesc, updated_at: new Date().toISOString() }
          })
        });
        savedOk = resp.ok;
      }

      if (!savedOk) {
        const { error: upErr } = await supabase
          .from('campaigns')
          .update({ descripcion: updatedDesc, updated_at: new Date().toISOString() })
          .eq('id', targetCampId);
        if (upErr) throw upErr;
      }

      // Sync flat proposals to public.strategic_proposals
      if (token) {
        await authenticatedFetch('/api/supabase-admin/political-crm', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table: 'strategic_proposals', campaign_id: targetCampId })
        }).catch(() => undefined);

        const flatProposals = nextEjes.flatMap(eje =>
          eje.propuestas.map(prop => ({
            campaign_id: targetCampId,
            client_id: clientId || null,
            eje_id: eje.id,
            eje_titulo: eje.titulo,
            eje_icono: eje.icono,
            eje_presupuesto: Number(eje.presupuestoPorcentaje || 0),
            titulo: prop.titulo,
            problema_diagnostico: prop.problemaDiagnostico,
            solucion_programatica: prop.solucionProgramatica,
            meta_cuantificable: prop.metaCuantificable,
            indicador_ods: prop.indicadorODS,
            presupuesto_estimado: prop.presupuestoEstimado,
            plazo_ejecucion: prop.plazoEjecucion,
            comuna_focalizada: prop.comunaFocalizada,
            fuente_financiacion: prop.fuenteFinanciacion,
            prioridad: prop.prioridad
          }))
        );

        if (flatProposals.length > 0) {
          await authenticatedFetch('/api/supabase-admin/political-crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ table: 'strategic_proposals', data: flatProposals })
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al sincronizar el Programa de Gobierno con Supabase.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const activeEje = ejes.find(e => e.id === selectedEjeId) || ejes[0] || null;
  const totalProposalsCount = ejes.reduce((acc, curr) => acc + curr.propuestas.length, 0);

  const handleOpenAddPropuesta = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeEje) {
      setShowAddEjeModal(true);
      showToast('Primero cree un Eje Estratégico para asociar la propuesta.');
      return;
    }
    setEditingPropuestaId(null);
    setNewPropuesta(emptyPropuestaForm);
    setShowAddPropuestaModal(true);
  };

  const handleOpenEditPropuesta = (e: React.MouseEvent, prop: PropuestaGobierno) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingPropuestaId(prop.id);
    setNewPropuesta({
      titulo: prop.titulo,
      problemaDiagnostico: prop.problemaDiagnostico,
      solucionProgramatica: prop.solucionProgramatica,
      metaCuantificable: prop.metaCuantificable,
      indicadorODS: prop.indicadorODS,
      presupuestoEstimado: prop.presupuestoEstimado,
      plazoEjecucion: prop.plazoEjecucion,
      comunaFocalizada: prop.comunaFocalizada,
      fuenteFinanciacion: prop.fuenteFinanciacion,
      prioridad: prop.prioridad
    });
    setViewingPropuesta(null);
    setShowAddPropuestaModal(true);
  };

  const handleSavePropuesta = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeEje) return;
    if (!newPropuesta.titulo.trim() || !newPropuesta.solucionProgramatica.trim()) {
      showToast('Complete el Título y la Solución Programática de la propuesta.');
      return;
    }

    let nextEjes: EjeEstrategico[];
    if (editingPropuestaId) {
      nextEjes = ejes.map(eje => {
        if (eje.id !== activeEje.id) return eje;
        return {
          ...eje,
          propuestas: eje.propuestas.map(p =>
            p.id === editingPropuestaId
              ? {
                  id: editingPropuestaId,
                  titulo: newPropuesta.titulo.trim(),
                  problemaDiagnostico: newPropuesta.problemaDiagnostico.trim() || 'Identificado en diagnóstico territorial.',
                  solucionProgramatica: newPropuesta.solucionProgramatica.trim(),
                  metaCuantificable: newPropuesta.metaCuantificable.trim() || 'Meta en estructuración técnica.',
                  indicadorODS: newPropuesta.indicadorODS,
                  presupuestoEstimado: newPropuesta.presupuestoEstimado.trim() || 'Según Marco Fiscal Municipal',
                  plazoEjecucion: newPropuesta.plazoEjecucion,
                  comunaFocalizada: newPropuesta.comunaFocalizada,
                  fuenteFinanciacion: newPropuesta.fuenteFinanciacion,
                  prioridad: newPropuesta.prioridad
                }
              : p
          )
        };
      });
    } else {
      const createdProp: PropuestaGobierno = {
        id: crypto.randomUUID(),
        titulo: newPropuesta.titulo.trim(),
        problemaDiagnostico: newPropuesta.problemaDiagnostico.trim() || 'Identificado en diagnóstico territorial.',
        solucionProgramatica: newPropuesta.solucionProgramatica.trim(),
        metaCuantificable: newPropuesta.metaCuantificable.trim() || 'Meta en estructuración técnica.',
        indicadorODS: newPropuesta.indicadorODS,
        presupuestoEstimado: newPropuesta.presupuestoEstimado.trim() || 'Según Marco Fiscal Municipal',
        plazoEjecucion: newPropuesta.plazoEjecucion,
        comunaFocalizada: newPropuesta.comunaFocalizada,
        fuenteFinanciacion: newPropuesta.fuenteFinanciacion,
        prioridad: newPropuesta.prioridad
      };
      nextEjes = ejes.map(eje =>
        eje.id === activeEje.id ? { ...eje, propuestas: [...eje.propuestas, createdProp] } : eje
      );
    }

    setEjes(nextEjes);
    setShowAddPropuestaModal(false);
    setEditingPropuestaId(null);
    setNewPropuesta(emptyPropuestaForm);
    await persistGovernmentProgram(nextEjes);
    showToast(
      editingPropuestaId
        ? 'Propuesta programática actualizada en Supabase.'
        : 'Nueva propuesta registrada en el Programa de Gobierno.'
    );
  };

  const confirmDeletePropuesta = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!propuestaToDelete) return;
    const { ejeId, propuesta } = propuestaToDelete;
    const nextEjes = ejes.map(eje => {
      if (eje.id !== ejeId) return eje;
      return { ...eje, propuestas: eje.propuestas.filter(p => p.id !== propuesta.id) };
    });
    setEjes(nextEjes);
    setPropuestaToDelete(null);
    if (viewingPropuesta?.id === propuesta.id) setViewingPropuesta(null);
    await persistGovernmentProgram(nextEjes);
    showToast('Propuesta eliminada del Programa de Gobierno.');
  };

  const handleSaveEje = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newEje.titulo.trim()) {
      showToast('Escriba el nombre del Eje Estratégico.');
      return;
    }

    let nextEjes: EjeEstrategico[];
    if (editingEjeId) {
      nextEjes = ejes.map(ej =>
        ej.id === editingEjeId
          ? {
              ...ej,
              titulo: newEje.titulo.trim(),
              icono: newEje.icono.trim() || '📌',
              descripcion: newEje.descripcion.trim(),
              presupuestoPorcentaje: Number(newEje.presupuestoPorcentaje) || 0
            }
          : ej
      );
    } else {
      const createdEje: EjeEstrategico = {
        id: `eje-${Date.now()}`,
        titulo: newEje.titulo.trim(),
        icono: newEje.icono.trim() || '📌',
        color: 'cyan',
        descripcion:
          newEje.descripcion.trim() ||
          'Eje estratégico estructurado por el comité programático de la campaña.',
        presupuestoPorcentaje: Number(newEje.presupuestoPorcentaje) || 20,
        propuestas: []
      };
      nextEjes = [...ejes, createdEje];
      setSelectedEjeId(createdEje.id);
    }

    setEjes(nextEjes);
    setNewEje({ titulo: '', icono: '📌', descripcion: '', presupuestoPorcentaje: 25 });
    setEditingEjeId(null);
    setShowAddEjeModal(false);
    await persistGovernmentProgram(nextEjes);
    showToast(editingEjeId ? 'Eje estratégico actualizado.' : 'Eje estratégico creado y guardado en Supabase.');
  };

  const confirmDeleteEje = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ejeToDelete) return;
    const remaining = ejes.filter(ej => ej.id !== ejeToDelete.id);
    setEjes(remaining);
    if (selectedEjeId === ejeToDelete.id) {
      setSelectedEjeId(remaining[0]?.id || '');
    }
    setEjeToDelete(null);
    await persistGovernmentProgram(remaining);
    showToast('Eje estratégico eliminado.');
  };

  const handleToggleChecklist = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextChecklist = checklist.map(item => (item.id === id ? { ...item, ok: !item.ok } : item));
    setChecklist(nextChecklist);
    await persistGovernmentProgram(ejes, programMeta, nextChecklist);
    showToast('Requisito de cumplimiento actualizado.');
  };

  const handleSaveMeta = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await persistGovernmentProgram(ejes, programMeta, checklist);
    showToast('Metadatos del Programa de Gobierno guardados en Supabase.');
  };

  // Synthesize proposals from real territorial diagnosis stored in Supabase
  const handleGenerateAIProposals = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetCampId = campaignId || localStorage.getItem('active_campaign_id') || '';
    if (!targetCampId) {
      showToast('No existe una campaña activa.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data: campRow } = await supabase
        .from('campaigns')
        .select('descripcion,municipio,departamento')
        .eq('id', targetCampId)
        .maybeSingle();

      let desc: any = {};
      try {
        desc = JSON.parse(campRow?.descripcion || '{}');
      } catch {
        desc = {};
      }

      const rawSectors = (sectorDiagnostics && sectorDiagnostics.length > 0)
        ? sectorDiagnostics
        : (Array.isArray(desc?.territorialDiagnosis?.sectors) && desc.territorialDiagnosis.sectors.length > 0)
          ? desc.territorialDiagnosis.sectors
          : (Array.isArray(desc?.territorialDiagnosis?.sectorDiagnostics) ? desc.territorialDiagnosis.sectorDiagnostics : []);

      const rawNeeds = (territorialNeeds && territorialNeeds.length > 0)
        ? territorialNeeds
        : (Array.isArray(desc?.territorialDiagnosis?.needs) && desc.territorialDiagnosis.needs.length > 0)
          ? desc.territorialDiagnosis.needs
          : (Array.isArray(desc?.territorialDiagnosis?.territorialNeeds) ? desc.territorialDiagnosis.territorialNeeds : []);

      if (rawSectors.length === 0 && rawNeeds.length === 0) {
        showToast(
          'Primero registre sectores o fichas en la pestaña "Diagnóstico Territorial" para sincronizarlos como Ejes y Propuestas.'
        );
        return;
      }

      const nextEjes: EjeEstrategico[] = [...ejes];

      for (const sec of rawSectors) {
        const categoryName = String(sec.category || sec.name || sec.title || 'Desarrollo Territorial').trim();
        let targetEje = nextEjes.find(
          ej => ej.titulo.toLowerCase() === categoryName.toLowerCase()
        );
        if (!targetEje) {
          targetEje = {
            id: `eje-${sec.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            titulo: categoryName,
            icono: String(sec.iconEmoji || sec.icon || '📌'),
            color: 'cyan',
            descripcion: String(sec.problemSummary || sec.problem || sec.diagnostico || 'Diagnóstico territorial sectorial evaluado.'),
            presupuestoPorcentaje: Math.max(15, Number(sec.surveyPriorityPercent || sec.priorityPercent || 20)),
            propuestas: []
          };
          nextEjes.push(targetEje);
        }

        const solutionText = String(sec.programmaticSolution || sec.solution || sec.solucion || '').trim();
        if (solutionText && targetEje.propuestas.length === 0) {
          targetEje.propuestas.push({
            id: crypto.randomUUID(),
            titulo: `Plan Sectorial de ${categoryName}`,
            problemaDiagnostico: String(sec.problemSummary || sec.problem || sec.diagnostico || 'Diagnóstico sectorial registrado.'),
            solucionProgramatica: solutionText,
            metaCuantificable:
              Array.isArray(sec.variables) && sec.variables[0]?.meta
                ? `${sec.variables[0].indicador || sec.variables[0].name}: Meta ${sec.variables[0].meta}`
                : 'Ejecución del 100% del plan sectorial en el cuatrienio',
            indicadorODS: 'ODS 11: Ciudades y Comunidades Sostenibles',
            presupuestoEstimado: 'Según Marco Fiscal de Mediano Plazo',
            plazoEjecucion: 'Mediano Plazo (Año 1-2)',
            comunaFocalizada: territory || 'Todo el Territorio',
            fuenteFinanciacion: 'Presupuesto Municipal',
            prioridad: 'Alta'
          });
        }
      }

      for (const need of rawNeeds) {
        const proposalText = String(need.programmaticProposal || need.proposal || need.solucion || need.solucionProgramatica || '').trim();
        if (!proposalText) continue;

        const needCategory = String(need.category || need.sector || 'Gestión Comunitaria').trim();
        let targetEje = nextEjes.find(
          ej => ej.titulo.toLowerCase().includes(needCategory.toLowerCase()) || needCategory.toLowerCase().includes(ej.titulo.toLowerCase())
        );
        if (!targetEje) {
          targetEje = {
            id: `eje-need-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            titulo: needCategory,
            icono: '📍',
            color: 'emerald',
            descripcion: `Atención prioritaria para ${need.comunaSector || need.comuna || territory}`,
            presupuestoPorcentaje: 20,
            propuestas: []
          };
          nextEjes.push(targetEje);
        }
        const alreadyExists = targetEje.propuestas.some(
          p => p.solucionProgramatica === proposalText
        );
        if (!alreadyExists) {
          targetEje.propuestas.push({
            id: crypto.randomUUID(),
            titulo: `Intervención en ${need.comunaSector || need.comuna || 'Sector Priorizado'} (${needCategory})`,
            problemaDiagnostico: String(need.problemDescription || need.problem || need.necesidad || 'Necesidad comunal diagnosticada.'),
            solucionProgramatica: proposalText,
            metaCuantificable: 'Cobertura del 100% de la comunidad priorizada',
            indicadorODS: 'ODS 10: Reducción de las Desigualdades',
            presupuestoEstimado: 'Cofinanciación Municipal y Departamental',
            plazoEjecucion: (need.impactLevel === 'Crítico' || need.prioridad === 'Crítico') ? 'Corto Plazo (100 Días)' : 'Mediano Plazo (Año 1-2)',
            comunaFocalizada: String(need.comunaSector || need.comuna || 'Todo el Territorio'),
            fuenteFinanciacion: 'Presupuesto Municipal',
            prioridad: (need.impactLevel === 'Crítico' || need.prioridad === 'Crítico') ? 'Crítica' : 'Alta'
          });
        }
      }

      setEjes(nextEjes);
      if (!selectedEjeId && nextEjes[0]) setSelectedEjeId(nextEjes[0].id);
      await persistGovernmentProgram(nextEjes);
      showToast('Ejes y propuestas sincronizados desde el Diagnóstico Territorial real.');
    } catch (err: any) {
      showToast(err?.message || 'No fue posible sincronizar las propuestas.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleExportDocument = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ejes.length === 0) {
      showToast('Registre al menos un eje estratégico antes de exportar el documento.');
      return;
    }
    setActiveSubTab('vista_previa');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const territorialZones = Array.from(
    new Set(
      [
        'Todo el Territorio',
        ...(geoCtx.subdivisions || []),
        'Casco Urbano Central',
        'Zona Rural y Veredas'
      ].filter(Boolean)
    )
  );

  return (
    <div className="space-y-6 animate-fadeIn programa-gobierno-view">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-[100] bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 text-xs font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER: PROGRAMA DE GOBIERNO (LEY 131 DE 1994) */}
      <div className="bg-gradient-to-r from-[#061a30] via-[#0a2546] to-[#051527] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden prog-header-banner animate-prog-stagger-1">
        <div className="absolute -right-12 -top-12 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight prog-header-title">
              Estructuración del Programa de Gobierno{' '}
              <span className="text-cyan-400 prog-header-period">{programMeta.period}</span>
            </h3>
            <p className="text-xs text-slate-300">
              Expediente programático vinculado en tiempo real a{' '}
              <strong className="text-emerald-300">{territory || 'la campaña activa'}</strong> ({programMeta.legalFramework}).
            </p>
          </div>

          {/* Quick KPIs & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-[#041223]/90 border border-cyan-500/30 px-4 py-3 rounded-2xl text-center prog-kpi-box">
              <span className="text-[10px] font-black uppercase text-slate-400 block prog-kpi-label">
                Propuestas Registradas
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono prog-kpi-value">
                {totalProposalsCount}
              </span>
              <span className="text-[10px] text-cyan-300 block font-semibold prog-kpi-sub">
                en {ejes.length} Ejes Estratégicos
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGenerateAIProposals}
                disabled={isGeneratingAI}
                className="btn-import-territorial group px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 prog-ai-btn"
              >
                <Sparkles className={`w-4 h-4 transition-transform duration-200 group-hover:rotate-12 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                <span>
                  {isGeneratingAI
                    ? 'Sincronizando Diagnóstico...'
                    : 'Importar desde Diagnóstico Territorial'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportDocument}
                className="btn-export-pdf px-4 py-2 rounded-xl bg-[#081d38] hover:bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all prog-export-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar PDF (Registraduría)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-cyan-500/20 text-xs font-bold prog-subtabs-nav animate-prog-stagger-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setActiveSubTab('ejes');
            }}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 prog-subtab-btn ${
              activeSubTab === 'ejes'
                ? 'active prog-subtab-active bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-extrabold shadow'
                : 'prog-subtab-inactive text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Ejes Estratégicos & Propuestas ({totalProposalsCount})</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setActiveSubTab('presupuesto');
            }}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 prog-subtab-btn ${
              activeSubTab === 'presupuesto'
                ? 'active prog-subtab-active bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-extrabold shadow'
                : 'prog-subtab-inactive text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>2. Plurianual de Inversiones & Fuentes</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setActiveSubTab('cumplimiento');
            }}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 prog-subtab-btn ${
              activeSubTab === 'cumplimiento'
                ? 'active prog-subtab-active bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-extrabold shadow'
                : 'prog-subtab-inactive text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              3. Validador de Voto Programático ({checklist.filter(c => c.ok).length}/{checklist.length})
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setActiveSubTab('vista_previa');
            }}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 prog-subtab-btn ${
              activeSubTab === 'vista_previa'
                ? 'active prog-subtab-active bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow'
                : 'prog-subtab-inactive text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>4. Documento Oficial Radicable</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: EJES ESTRATÉGICOS Y MATRIZ DE PROPUESTAS */}
      {activeSubTab === 'ejes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 prog-tab-ejes">
          {/* Left Column: Strategic Axes Selector */}
          <div className="lg:col-span-4 space-y-3 prog-ejes-sidebar animate-prog-stagger-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase text-cyan-400 tracking-wider">
                Pilares / Ejes del Programa ({ejes.length})
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setEditingEjeId(null);
                  setNewEje({ titulo: '', icono: '📌', descripcion: '', presupuestoPorcentaje: 25 });
                  setShowAddEjeModal(true);
                }}
                className="btn-cta-eje px-2.5 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Eje</span>
              </button>
            </div>

            {isLoading ? (
              <div className="bg-[#05162a] border border-cyan-500/20 rounded-2xl p-6 text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Cargando pilares desde Supabase...</p>
              </div>
            ) : ejes.length === 0 ? (
              <div className="empty-plan-card bg-[#05162a] border border-dashed border-cyan-500/30 rounded-2xl p-6 text-center space-y-3">
                <Layers className="empty-plan-icon w-8 h-8 text-cyan-400 mx-auto opacity-80" />
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-white">Sin ejes estratégicos creados</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Cree el primer pilar programático o importe los sectores diagnosticados en el territorio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingEjeId(null);
                    setNewEje({ titulo: '', icono: '📌', descripcion: '', presupuestoPorcentaje: 25 });
                    setShowAddEjeModal(true);
                  }}
                  className="btn-cta-eje px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear Primer Eje
                </button>
              </div>
            ) : (
              ejes.map((eje) => {
                const isSelected = activeEje?.id === eje.id;
                return (
                  <div
                    key={eje.id}
                    onClick={() => setSelectedEjeId(eje.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 relative group prog-eje-card hover:-translate-y-0.5 hover:shadow-lg ${
                      isSelected
                        ? 'active bg-gradient-to-r from-[#0a2748] to-[#071c36] border-cyan-400 shadow-lg shadow-cyan-950/50'
                        : 'bg-[#05162a] border-cyan-500/20 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 pr-12">
                        <span className="text-2xl p-2 bg-[#041223] rounded-xl border border-cyan-500/20 prog-eje-icon">
                          {eje.icono}
                        </span>
                        <div>
                          <h4 className="font-extrabold text-white text-xs sm:text-sm leading-snug prog-eje-title">
                            {eje.titulo}
                          </h4>
                          <span className="text-[10px] text-cyan-300 font-mono font-bold prog-eje-weight">
                            Peso Presupuestal: {eje.presupuestoPorcentaje}%
                          </span>
                        </div>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setEditingEjeId(eje.id);
                            setNewEje({
                              titulo: eje.titulo,
                              icono: eje.icono,
                              descripcion: eje.descripcion,
                              presupuestoPorcentaje: eje.presupuestoPorcentaje
                            });
                            setShowAddEjeModal(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/60 transition-all cursor-pointer"
                          title="Editar este eje estratégico"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setEjeToDelete(eje);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition-all cursor-pointer"
                          title="Eliminar este eje estratégico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed prog-eje-desc">
                      {eje.descripcion}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-cyan-500/15 text-[10px] text-slate-300">
                      <span className="font-semibold text-emerald-300 prog-eje-count">
                        {eje.propuestas.length} Propuesta(s)
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400 font-bold">
                        Ver propuestas <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Proposals inside Selected Axis */}
          <div className="lg:col-span-8 space-y-4 prog-propuestas-panel animate-prog-stagger-4">
            {!activeEje ? (
              <div className="empty-plan-card bg-[#05162a] border border-dashed border-cyan-500/30 rounded-3xl p-12 text-center space-y-4">
                <BookOpen className="empty-plan-icon w-12 h-12 text-cyan-400 mx-auto opacity-80" />
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-base font-black text-white">
                    Estructure su Programa de Gobierno Oficial
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No hay ejes ni propuestas registradas todavía. Cree el primer pilar estratégico o importe el diagnóstico territorial de la campaña.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAddEjeModal(true);
                    }}
                    className="btn-cta-eje px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Crear Primer Eje Estratégico
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-5 prog-propuestas-container">
                {/* Active Axis Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 prog-active-eje-header">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-3 bg-[#081d38] rounded-2xl border border-cyan-500/30">
                      {activeEje.icono}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-black text-white prog-active-eje-title">
                          {activeEje.titulo}
                        </h4>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {activeEje.presupuestoPorcentaje}% del Plan Plurianual
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{activeEje.descripcion}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddPropuesta}
                    className="btn-cta-eje px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md prog-add-propuesta-btn"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nueva Propuesta</span>
                  </button>
                </div>

                {/* Proposals List */}
                <div className="space-y-4 prog-propuestas-list">
                  {activeEje.propuestas.length === 0 ? (
                    <div className="empty-plan-card p-8 text-center bg-[#081d38]/50 rounded-2xl border border-dashed border-cyan-500/30 text-xs text-slate-400 space-y-3">
                      <p className="font-bold text-white text-sm">
                        Sin propuestas registradas en "{activeEje.titulo}"
                      </p>
                      <p>
                        Agregue compromisos programáticos con metas cuantificables, plazo de ejecución y fuente de financiación.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddPropuesta}
                        className="btn-cta-eje px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar Primera Propuesta
                      </button>
                    </div>
                  ) : (
                    activeEje.propuestas.map((prop, index) => (
                      <div
                        key={prop.id}
                        className="bg-[#081d38] border border-cyan-500/25 rounded-2xl p-5 space-y-4 hover:border-cyan-400/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-md prog-propuesta-item"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 font-mono font-black text-xs border border-cyan-500/30">
                              P-{index + 1}
                            </span>
                            <h5 className="font-extrabold text-white text-sm sm:text-base prog-propuesta-title">
                              {prop.titulo}
                            </h5>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                prop.prioridad === 'Crítica'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                  : prop.prioridad === 'Alta'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                  : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                              }`}
                            >
                              Prioridad {prop.prioridad}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setViewingPropuesta(prop);
                              }}
                              className="p-1.5 text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Ver ficha técnica completa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditPropuesta(e, prop)}
                              className="p-1.5 text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                              title="Editar propuesta"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setPropuestaToDelete({ ejeId: activeEje.id, propuesta: prop });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar propuesta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Problem vs Solution Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-[#051325] p-3.5 rounded-xl border border-rose-500/20 space-y-1">
                            <span className="text-[10px] font-black uppercase text-rose-300 block">
                              Diagnóstico / Problema Base:
                            </span>
                            <p className="text-slate-300 leading-relaxed text-[11px] prog-propuesta-problema">
                              {prop.problemaDiagnostico}
                            </p>
                          </div>

                          <div className="bg-[#051325] p-3.5 rounded-xl border border-emerald-500/25 space-y-1">
                            <span className="text-[10px] font-black uppercase text-emerald-300 block">
                              Solución Programática (Compromiso):
                            </span>
                            <p className="text-slate-200 leading-relaxed text-[11px] font-medium prog-propuesta-solucion">
                              {prop.solucionProgramatica}
                            </p>
                          </div>
                        </div>

                        {/* Quantitative Goal & Technical Metadata */}
                        <div className="bg-[#041020] p-3.5 rounded-xl border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5 text-amber-400" /> Meta Cuantificable (Voto Programático):
                            </span>
                            <p className="text-white font-bold text-xs prog-propuesta-meta">
                              {prop.metaCuantificable}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-[11px]">
                              💰 {prop.presupuestoEstimado}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-[11px]">
                              ⏱️ {prop.plazoEjecucion}
                            </span>
                          </div>
                        </div>

                        {/* Footer Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/15 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-teal-300 font-semibold">
                            <Globe className="w-3.5 h-3.5" /> {prop.indicadorODS}
                          </span>
                          <span className="flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Focalización: {prop.comunaFocalizada}
                          </span>
                          <span className="text-slate-400">
                            Fuente: <strong className="text-slate-200">{prop.fuenteFinanciacion}</strong>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PLAN PLURIANUAL DE INVERSIONES */}
      {activeSubTab === 'presupuesto' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-6 prog-tab-presupuesto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
            <div>
              <h4 className="text-lg font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Plan Plurianual de Inversiones Estimado ({programMeta.period})
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Distribución porcentual y financiera de los recursos por eje programático según el Marco Fiscal de Mediano Plazo.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-[#081d38] px-4 py-2.5 rounded-2xl border border-emerald-500/30">
                <label className="text-[10px] uppercase font-black text-slate-400 block">
                  Techo Presupuestal Proyectado:
                </label>
                <input
                  type="text"
                  placeholder="Ej: $48.000 Millones COP"
                  value={programMeta.totalInvestmentPlan}
                  onChange={(e) => setProgramMeta({ ...programMeta, totalInvestmentPlan: e.target.value })}
                  className="bg-transparent text-base font-black text-emerald-400 font-mono outline-none border-b border-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveMeta}
                disabled={isSaving}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>

          {ejes.length === 0 ? (
            <div className="p-8 text-center bg-[#081d38]/40 rounded-2xl border border-dashed border-cyan-500/20 text-xs text-slate-400">
              No hay ejes estratégicos registrados para calcular la distribución plurianual.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ejes.map((eje) => (
                <div key={eje.id} className="bg-[#081d38] p-5 rounded-2xl border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{eje.icono}</span>
                      <span className="font-extrabold text-white text-sm">{eje.titulo}</span>
                    </div>
                    <span className="text-sm font-mono font-black text-cyan-300">
                      {eje.presupuestoPorcentaje}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, eje.presupuestoPorcentaje)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{eje.propuestas.length} proyectos estratégicos</span>
                    <span className="text-emerald-300 font-semibold">Fuente: SGP + Recursos Propios + Regalías</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: VALIDADOR DE CUMPLIMIENTO LEY 131 DE 1994 */}
      {activeSubTab === 'cumplimiento' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl space-y-5 prog-tab-cumplimiento">
          <div className="border-b border-cyan-500/20 pb-4">
            <h4 className="text-lg font-black text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
              Lista de Chequeo Legal y Metodológica (DNP / Registraduría)
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Haga clic en cada requisito para certificar su validación antes de radicar el Programa de Gobierno.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={(e) => void handleToggleChecklist(item.id, e)}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  item.ok
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-[#081d38] border-amber-500/30 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${item.ok ? 'text-emerald-400' : 'text-slate-500'}`}
                  />
                  <span className="text-xs font-bold">{item.rule}</span>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-950/70">
                  {item.ok ? 'Validado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: VISTA PREVIA DOCUMENTO RADICABLE */}
      {activeSubTab === 'vista_previa' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 prog-tab-preview">
          <div className="border-b border-cyan-500/20 pb-6 text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest">
              República de Colombia · Registraduría Nacional del Estado Civil
            </span>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight pt-2">
              PROGRAMA DE GOBIERNO OFICIAL ({programMeta.period})
            </h2>
            <p className="text-sm font-extrabold text-emerald-400">
              {candidateName || 'Candidato Oficial'} — Aspirante a {office || 'Cargo de Elección Popular'} por{' '}
              {territory || 'Circunscripción Territorial'}
            </p>
            {slogan && <p className="text-xs italic text-slate-300">"{slogan}"</p>}
          </div>

          <div className="bg-[#081d38] p-5 rounded-2xl border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-cyan-300">1. Visión Estratégica del Territorio</h4>
              <button
                type="button"
                onClick={handleSaveMeta}
                className="text-[11px] font-bold text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Guardar Visión
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Escriba la declaración de visión estratégica del Programa de Gobierno para el cuatrienio..."
              value={programMeta.visionStatement}
              onChange={(e) => setProgramMeta({ ...programMeta, visionStatement: e.target.value })}
              className="w-full bg-[#051325] border border-cyan-500/20 rounded-xl p-3 text-xs text-slate-200 leading-relaxed outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-cyan-300">
              2. Resumen de Ejes y Compromisos Programáticos ({totalProposalsCount} Propuestas)
            </h4>
            {ejes.length === 0 ? (
              <p className="text-xs text-slate-400">No hay ejes registrados todavía.</p>
            ) : (
              ejes.map((eje, idx) => (
                <div key={eje.id} className="bg-[#081d38] p-4 rounded-2xl border border-cyan-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-extrabold text-white text-sm">
                      Eje {idx + 1}: {eje.icono} {eje.titulo}
                    </h5>
                    <span className="text-xs font-mono text-emerald-300 font-bold">
                      Ponderación: {eje.presupuestoPorcentaje}%
                    </span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-2">
                    {eje.propuestas.map((p) => (
                      <li key={p.id}>
                        <strong className="text-white">{p.titulo}:</strong> {p.solucionProgramatica} —{' '}
                        <span className="text-amber-300 font-semibold">[Meta: {p.metaCuantificable}]</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE PROPUESTA */}
      {viewingPropuesta && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-animate">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl modal-container-animate">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Ficha Técnica de Propuesta Programática
              </h4>
              <button
                type="button"
                onClick={() => setViewingPropuesta(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-slate-300">
              <div>
                <span className="text-[10px] font-black uppercase text-cyan-400 block">Título del Proyecto:</span>
                <p className="text-sm font-black text-white">{viewingPropuesta.titulo}</p>
              </div>
              <div className="bg-[#081d38] p-3 rounded-xl border border-rose-500/20">
                <span className="text-[10px] font-black uppercase text-rose-300 block">Problema Diagnosticado:</span>
                <p className="mt-1">{viewingPropuesta.problemaDiagnostico}</p>
              </div>
              <div className="bg-[#081d38] p-3 rounded-xl border border-emerald-500/20">
                <span className="text-[10px] font-black uppercase text-emerald-300 block">Solución Programática:</span>
                <p className="mt-1 text-white font-medium">{viewingPropuesta.solucionProgramatica}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-[#081d38] p-3 rounded-xl border border-cyan-500/20">
                <div>
                  <span className="text-[10px] text-slate-400 block">Meta Cuantificable:</span>
                  <strong className="text-amber-300">{viewingPropuesta.metaCuantificable}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Presupuesto Estimado:</span>
                  <strong className="text-cyan-300">{viewingPropuesta.presupuestoEstimado}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Plazo de Ejecución:</span>
                  <strong className="text-white">{viewingPropuesta.plazoEjecucion}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Focalización Territorial:</span>
                  <strong className="text-emerald-300">{viewingPropuesta.comunaFocalizada}</strong>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={(e) => handleOpenEditPropuesta(e, viewingPropuesta)}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar Propuesta
              </button>
              <button
                type="button"
                onClick={() => setViewingPropuesta(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR / EDITAR PROPUESTA AL EJE ACTIVO */}
      {showAddPropuestaModal && activeEje && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 prog-modal-overlay modal-backdrop-animate">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl prog-modal-card max-h-[90vh] overflow-y-auto modal-container-animate">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                {editingPropuestaId ? (
                  <>
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                    Editar Propuesta en: {activeEje.titulo}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-cyan-400" />
                    Agregar Propuesta a: {activeEje.titulo}
                  </>
                )}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddPropuestaModal(false);
                  setEditingPropuestaId(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePropuesta} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Título de la Propuesta / Proyecto *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mejoramiento Integral de Vías Terciarias y Caminos Veredales"
                  value={newPropuesta.titulo}
                  onChange={(e) => setNewPropuesta({ ...newPropuesta, titulo: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 prog-input-titulo"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Problema que Resuelve:</label>
                <textarea
                  rows={2}
                  placeholder="Describa la necesidad diagnosticada en las comunidades..."
                  value={newPropuesta.problemaDiagnostico}
                  onChange={(e) => setNewPropuesta({ ...newPropuesta, problemaDiagnostico: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 prog-input-problema"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Solución Programática (Qué se hará) *:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Detalle técnico de la intervención gubernamental..."
                  value={newPropuesta.solucionProgramatica}
                  onChange={(e) => setNewPropuesta({ ...newPropuesta, solucionProgramatica: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 prog-input-solucion"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Meta Cuantificable (Ley 131):</label>
                  <input
                    type="text"
                    placeholder="Ej: 40 km de placa huella construidos"
                    value={newPropuesta.metaCuantificable}
                    onChange={(e) => setNewPropuesta({ ...newPropuesta, metaCuantificable: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 prog-input-meta"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Presupuesto Estimado:</label>
                  <input
                    type="text"
                    placeholder="Ej: $3.500 Millones COP"
                    value={newPropuesta.presupuestoEstimado}
                    onChange={(e) => setNewPropuesta({ ...newPropuesta, presupuestoEstimado: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 prog-input-presupuesto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Plazo de Ejecución:</label>
                  <select
                    value={newPropuesta.plazoEjecucion}
                    onChange={(e) => setNewPropuesta({ ...newPropuesta, plazoEjecucion: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Corto Plazo (100 Días)">Corto Plazo (100 Días)</option>
                    <option value="Mediano Plazo (Año 1-2)">Mediano Plazo (Año 1-2)</option>
                    <option value="Largo Plazo (Cuatrienio)">Largo Plazo (Cuatrienio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prioridad:</label>
                  <select
                    value={newPropuesta.prioridad}
                    onChange={(e) => setNewPropuesta({ ...newPropuesta, prioridad: e.target.value as any })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Focalización Territorial:</label>
                  <input
                    type="text"
                    list="programa-zones-datalist"
                    value={newPropuesta.comunaFocalizada}
                    onChange={(e) => setNewPropuesta({ ...newPropuesta, comunaFocalizada: e.target.value })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none"
                  />
                  <datalist id="programa-zones-datalist">
                    {territorialZones.map(z => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPropuestaModal(false);
                    setEditingPropuestaId(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 rounded-xl font-black cursor-pointer prog-save-propuesta-btn"
                >
                  {isSaving ? 'Guardando...' : editingPropuestaId ? 'Guardar Cambios' : 'Guardar Propuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR EJE ESTRATÉGICO */}
      {showAddEjeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 prog-modal-overlay modal-backdrop-animate">
          <div className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl prog-modal-card modal-container-animate">
            <div className="flex justify-between items-center border-b border-cyan-500/20 pb-3">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                {editingEjeId ? 'Editar Eje Estratégico' : 'Crear Nuevo Eje Estratégico'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddEjeModal(false);
                  setEditingEjeId(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEje} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Eje / Pilar *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Transformación Agropecuaria y Vías Rurales"
                  value={newEje.titulo}
                  onChange={(e) => setNewEje({ ...newEje, titulo: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Icono / Emoji:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newEje.icono}
                      onChange={(e) => setNewEje({ ...newEje, icono: e.target.value })}
                      className="w-12 bg-[#081d38] border border-cyan-500/30 rounded-xl px-2 py-2 text-white text-center text-sm outline-none"
                    />
                    <div className="flex gap-1">
                      {['🌾', '🛡️', '💧', '🏗️', '🏥', '🎓'].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setNewEje({ ...newEje, icono: em })}
                          className="p-1.5 bg-[#081d38] hover:bg-cyan-500/20 rounded-lg border border-cyan-500/20 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Peso Presupuestal (%):</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newEje.presupuestoPorcentaje}
                    onChange={(e) => setNewEje({ ...newEje, presupuestoPorcentaje: Number(e.target.value) })}
                    className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descripción General del Eje:</label>
                <textarea
                  rows={2}
                  placeholder="Describa el enfoque estratégico de este pilar..."
                  value={newEje.descripcion}
                  onChange={(e) => setNewEje({ ...newEje, descripcion: e.target.value })}
                  className="w-full bg-[#081d38] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEjeModal(false);
                    setEditingEjeId(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 rounded-xl font-black cursor-pointer hover:from-teal-400 hover:to-cyan-400"
                >
                  {isSaving ? 'Guardando...' : editingEjeId ? 'Guardar Cambios' : 'Crear Eje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE PROPUESTA */}
      {propuestaToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-animate">
          <div className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl modal-container-animate">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Eliminar Propuesta Programática
            </h4>
            <p className="text-slate-300">
              ¿Está seguro de eliminar la propuesta{' '}
              <strong className="text-white">"{propuestaToDelete.propuesta.titulo}"</strong> del Programa de Gobierno?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPropuestaToDelete(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePropuesta}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE EJE */}
      {ejeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-animate">
          <div className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl modal-container-animate">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Eliminar Eje Estratégico
            </h4>
            <p className="text-slate-300">
              ¿Está seguro de eliminar el eje{' '}
              <strong className="text-white">
                {ejeToDelete.icono} {ejeToDelete.titulo}
              </strong>{' '}
              y sus {ejeToDelete.propuestas.length} propuestas asociadas?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEjeToDelete(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteEje}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black cursor-pointer"
              >
                Sí, Eliminar Eje
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
