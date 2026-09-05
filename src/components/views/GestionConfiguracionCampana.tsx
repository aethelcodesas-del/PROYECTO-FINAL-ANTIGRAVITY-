import React, { useState, useEffect } from 'react';
import { useCampaignLive } from '../../contexts/CampaignContext';
import { ViewMode } from '../../types';
import { CampanaDossier, CampanaAliada, CandidatoListaAliada, EquipoOficialCampana } from '../../types/campana';
import { defaultCampanaDossier, campanaPlantillasPresets } from '../../data/campanaPresets';
import { colombiaTerritorialData, partidosPoliticosColombia } from '../../data/colombiaTerritorialData';
import { EquipoCampanaSection } from '../campana/EquipoCampanaSection';
import { ChecklistCNEModal } from '../campana/ChecklistCNEModal';
import { ExpedienteImprimibleModal } from '../campana/ExpedienteImprimibleModal';
import { supabase } from '../../lib/supabase';
import { isExpectedEmptyCampaignState } from '../../lib/campaignSetupState';
import { 
  Building2, 
  MapPin, 
  User, 
  Calendar, 
  Award, 
  CheckCircle2, 
  ShieldCheck, 
  Save, 
  Users, 
  FileText, 
  Sparkles, 
  Upload, 
  Phone, 
  Mail, 
  IdCard, 
  CheckSquare, 
  Briefcase, 
  Vote, 
  Globe, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Printer, 
  Download, 
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

export { colombiaTerritorialData, partidosPoliticosColombia };

interface GestionConfiguracionCampanaProps {
  onSelectView?: (view: ViewMode) => void;
  standalone?: boolean;
}

const STORAGE_CAMPAIGNS_KEY = 'elecciones_campanas_guardadas_v2';
const STORAGE_ACTIVE_ID_KEY = 'elecciones_campana_activa_id_v2';
const STORAGE_CAMPAIGN_DOSSIER_KEY = 'elecciones_campana_principal_dossier_v2';

export const GestionConfiguracionCampana: React.FC<GestionConfiguracionCampanaProps> = ({
  onSelectView,
  standalone = false
}) => {
  // ==========================================
  // CANDIDATO PRINCIPAL CAMPAIGN DOSSIER STATE
  // ==========================================
  const [dossier, setDossier] = useState<CampanaDossier>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CAMPAIGN_DOSSIER_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      // Backward compatibility if user had previous campaigns list
      const savedList = localStorage.getItem(STORAGE_CAMPAIGNS_KEY);
      const activeId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
      if (savedList) {
        const parsed = JSON.parse(savedList);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const found = parsed.find((c: CampanaDossier) => c.id === activeId) || parsed[0];
          if (found) return found;
        }
      }
    } catch (e) {
      console.error('Error loading campaign dossier from storage', e);
    }
    return defaultCampanaDossier;
  });

  const activeDossier = dossier;

  // Active navigation tab inside Campaign Management
  type TabType = 'territorio' | 'candidato' | 'aval' | 'calendario' | 'equipo' | 'aliadas';
  const [activeTab, setActiveTab] = useState<TabType>('territorio');

  // Modals state
  const [showChecklistModal, setShowChecklistModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [activeSaveToast, setActiveSaveToast] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignBudgetLimit, setCampaignBudgetLimit] = useState<number | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignSyncError, setCampaignSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // ── Tope CNE en tiempo real desde el contexto global ──────────────────────────────
  const liveMetrics = useCampaignLive();
  useEffect(() => {
    if (liveMetrics.budgetLimitCop > 0) {
      setCampaignBudgetLimit(liveMetrics.budgetLimitCop);
    }
  }, [liveMetrics.budgetLimitCop]);

  // Allied List Creation Modal State
  const [showAddAliadaModal, setShowAddAliadaModal] = useState<boolean>(false);
  const [selectedAliadaId, setSelectedAliadaId] = useState<string | null>(
    activeDossier.campanasAliadas && activeDossier.campanasAliadas.length > 0 ? activeDossier.campanasAliadas[0].id : null
  );
  const [newAliadaCorp, setNewAliadaCorp] = useState<'Asamblea' | 'Concejo' | 'JAL'>('Concejo');
  const [newAliadaPartido, setNewAliadaPartido] = useState<string>('Partido Liberal Colombiano');
  const [newAliadaNombre, setNewAliadaNombre] = useState<string>('');
  const [newAliadaModalidad, setNewAliadaModalidad] = useState<'Lista Abierta' | 'Lista Cerrada'>('Lista Abierta');
  const [newAliadaComuna, setNewAliadaComuna] = useState<string>('Comuna 10 - La Candelaria / Centro');
  const [newAliadaMetaVotos, setNewAliadaMetaVotos] = useState<number>(25000);

  // Candidate Inside Selected List Form State
  const [candNombre, setCandNombre] = useState<string>('');
  const [candCedula, setCandCedula] = useState<string>('');
  const [candTelefono, setCandTelefono] = useState<string>('');
  const [candEmail, setCandEmail] = useState<string>('');
  const [candEsCabeza, setCandEsCabeza] = useState<boolean>(false);
  const [candRenglon, setCandRenglon] = useState<number>(1);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);

  // Edit Allied List Header Info State
  const [editingListInfoId, setEditingListInfoId] = useState<string | null>(null);
  const [editListNombre, setEditListNombre] = useState<string>('');
  const [editListPartido, setEditListPartido] = useState<string>('');
  const [editListModalidad, setEditListModalidad] = useState<'Lista Abierta' | 'Lista Cerrada'>('Lista Abierta');
  const [editListMetaVotos, setEditListMetaVotos] = useState<number>(15000);

  // Synchronize localStorage whenever campaign dossier changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CAMPAIGN_DOSSIER_KEY, JSON.stringify(dossier));
    } catch (e) {
      console.error('Error syncing campaign dossier to localStorage', e);
    }
  }, [dossier]);

  useEffect(() => {
    let mounted = true;

    const loadCampaignDossier = async () => {
      setCampaignLoading(true);
      setCampaignSyncError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          userId = refreshed.session?.user?.id;
        }
        if (!userId) throw new Error('Debes iniciar sesión para consultar la campaña asignada.');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('client_id,campaign_id')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;

        const rememberedId = profile?.campaign_id || localStorage.getItem('active_campaign_id');
        let campaignQuery = supabase.from('campaigns').select('*');
        if (rememberedId) campaignQuery = campaignQuery.eq('id', rememberedId);
        else if (profile?.client_id) campaignQuery = campaignQuery.eq('client_id', profile.client_id);
        else throw new Error('Tu usuario no tiene una organización electoral asignada.');

        const { data: campaigns, error: campaignError } = await campaignQuery
          .order('updated_at', { ascending: false })
          .limit(1);
        if (campaignError) throw campaignError;
        const campaign = campaigns?.[0];
        if (!campaign) throw new Error('No existe una campaña accesible para este usuario.');

        let storedDossier: Partial<CampanaDossier> = {};
        if (campaign.descripcion) {
          try {
            const parsed = JSON.parse(campaign.descripcion);
            storedDossier = parsed?.dossier || parsed?.campaignDossier || {};
          } catch {
            storedDossier = {};
          }
        }

        const hydrated: CampanaDossier = {
          ...defaultCampanaDossier,
          ...storedDossier,
          id: campaign.id,
          nombreCandidato: storedDossier.nombreCandidato || campaign.candidato_nombre || '',
          corporacion: (storedDossier.corporacion || campaign.cargo_postulacion || defaultCampanaDossier.corporacion) as CampanaDossier['corporacion'],
          departamento: storedDossier.departamento || campaign.departamento || defaultCampanaDossier.departamento,
          municipio: storedDossier.municipio || campaign.municipio || defaultCampanaDossier.municipio,
          circunscripcionTerritorial: (storedDossier.circunscripcionTerritorial || campaign.circunscripcion || defaultCampanaDossier.circunscripcionTerritorial) as CampanaDossier['circunscripcionTerritorial'],
          fechaEleccion: storedDossier.fechaEleccion || campaign.fecha_eleccion || '',
          updatedAt: campaign.updated_at || new Date().toISOString()
        };

        if (!mounted) return;
        setActiveCampaignId(campaign.id);
        setCampaignBudgetLimit(Number(campaign.presupuesto_total ?? 0));
        localStorage.setItem('active_campaign_id', campaign.id);
        setDossier(hydrated);
        setLastSyncedAt(campaign.updated_at || new Date().toISOString());
      } catch (error: any) {
        if (mounted) {
          setActiveCampaignId(null);
          setCampaignBudgetLimit(null);
          setCampaignSyncError(isExpectedEmptyCampaignState(error) ? '' : (error?.message || 'No fue posible cargar la campaña desde Supabase.'));
        }
      } finally {
        if (mounted) setCampaignLoading(false);
      }
    };

    void loadCampaignDossier();
    return () => { mounted = false; };
  }, []);

  // Sync selected allied list when dossier changes
  useEffect(() => {
    if (activeDossier.campanasAliadas && activeDossier.campanasAliadas.length > 0) {
      const exists = activeDossier.campanasAliadas.some(a => a.id === selectedAliadaId);
      if (!exists) {
        setSelectedAliadaId(activeDossier.campanasAliadas[0].id);
      }
    } else {
      setSelectedAliadaId(null);
    }
  }, [activeDossier]);

  // Helper to trigger save toast
  const showToast = (sectionName: string) => {
    setActiveSaveToast(sectionName);
    setTimeout(() => {
      setActiveSaveToast(null);
    }, 4000);
  };

  const saveCampaignDossier = async (sectionName: string, targetDossier: CampanaDossier = dossier) => {
    if (!activeCampaignId) {
      setCampaignSyncError('No hay una campaña activa vinculada a esta sesión.');
      return false;
    }
    setCampaignSaving(true);
    setCampaignSyncError('');
    try {
      const syncedAt = new Date().toISOString();
      const normalizedDossier = { ...targetDossier, id: activeCampaignId, updatedAt: syncedAt };
      const { data: currentCampaign, error: readError } = await supabase
        .from('campaigns')
        .select('descripcion')
        .eq('id', activeCampaignId)
        .maybeSingle();
      if (readError) throw readError;
      let currentDescription: any = {};
      try { currentDescription = JSON.parse(currentCampaign?.descripcion || '{}'); } catch { currentDescription = {}; }
      const { error } = await supabase.from('campaigns').update({
        candidato_nombre: normalizedDossier.nombreCandidato || null,
        cargo_postulacion: normalizedDossier.corporacion,
        departamento: normalizedDossier.departamento,
        municipio: normalizedDossier.municipio,
        circunscripcion: normalizedDossier.circunscripcionTerritorial,
        fecha_eleccion: normalizedDossier.fechaEleccion || null,
        descripcion: JSON.stringify({ ...currentDescription, version: 1, dossier: normalizedDossier }),
        updated_at: syncedAt
      }).eq('id', activeCampaignId);
      if (error) throw error;

      setDossier(normalizedDossier);
      setLastSyncedAt(syncedAt);
      showToast(sectionName);
      return true;
    } catch (error: any) {
      setCampaignSyncError(error?.message || 'No fue posible guardar la campaña en Supabase.');
      return false;
    } finally {
      setCampaignSaving(false);
    }
  };

  // Master Factory Reset: Wipe all campaign data and start completely from zero
  const handleResetEverythingToZero = async () => {
    try {
      localStorage.removeItem(STORAGE_CAMPAIGN_DOSSIER_KEY);
      localStorage.removeItem(STORAGE_CAMPAIGNS_KEY);
      localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
      localStorage.removeItem('candidate_name');
      localStorage.removeItem('candidate_photo');
      localStorage.removeItem('presupuesto_items_master_v2');
      localStorage.removeItem('elecciones_testigos_lista_v2');
      localStorage.removeItem('presupuesto_cne_signed');
      localStorage.removeItem('presupuesto_cne_hash');
      localStorage.removeItem('campaign_users_list');
      localStorage.removeItem('campaign_user_permissions');
      localStorage.removeItem('custom_polling_stations_v1');
      localStorage.removeItem('elecciones_estrategia_dofa_v1');
    } catch (e) {
      console.error('Error resetting storage', e);
    }

    const clearedDossier = {
      ...defaultCampanaDossier,
      id: activeCampaignId || defaultCampanaDossier.id,
      updatedAt: new Date().toISOString()
    };
    setDossier(clearedDossier);
    setShowResetModal(false);

    window.dispatchEvent(new Event('candidate_photo_updated'));
    window.dispatchEvent(new Event('candidate_name_updated'));
    window.dispatchEvent(new Event('storage'));

    await saveCampaignDossier('Software inicializado desde cero. El expediente de campaña quedó limpio para comenzar.', clearedDossier);
  };

  // Helper to update active dossier field
  const updateDossier = (fields: Partial<CampanaDossier>) => {
    setDossier(prev => ({
      ...prev,
      ...fields,
      updatedAt: new Date().toISOString()
    }));
  };

  // Department change in active dossier
  const handleDepartmentChange = (dep: string) => {
    const muns = colombiaTerritorialData[dep] || [];
    updateDossier({
      departamento: dep,
      municipio: muns.length > 0 ? muns[0] : ''
    });
  };

  // Circunscripción change in active dossier
  const handleCircunscripcionChange = (circ: 'Municipio' | 'Departamento') => {
    if (circ === 'Departamento') {
      const newCorp = (activeDossier.corporacion === 'Alcaldía' || activeDossier.corporacion === 'Concejo' || activeDossier.corporacion === 'JAL')
        ? 'Gobernación'
        : activeDossier.corporacion;
      updateDossier({
        circunscripcionTerritorial: circ,
        corporacion: newCorp
      });
    } else {
      const newCorp = (activeDossier.corporacion === 'Gobernación' || activeDossier.corporacion === 'Asamblea')
        ? 'Alcaldía'
        : activeDossier.corporacion;
      updateDossier({
        circunscripcionTerritorial: circ,
        corporacion: newCorp
      });
    }
  };

  // Toggle coalition party
  const togglePartyCoalition = (party: string) => {
    const current = activeDossier.partidosCoalicion || [];
    if (current.includes(party)) {
      if (current.length > 1) {
        updateDossier({ partidosCoalicion: current.filter(p => p !== party) });
      } else {
        alert('Una coalición requiere al menos 1 partido registrado.');
      }
    } else {
      updateDossier({ partidosCoalicion: [...current, party] });
    }
  };

  // Allied List Management Handlers
  const handleCreateAliada = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `aliada-${Date.now()}`;
    const generatedName = newAliadaNombre.trim() || `Lista a ${newAliadaCorp} - ${newAliadaPartido}`;
    const newCampana: CampanaAliada = {
      id: newId,
      corporacion: newAliadaCorp,
      partidoOLista: newAliadaPartido,
      nombreLista: generatedName,
      modalidad: newAliadaModalidad,
      departamento: activeDossier.departamento,
      municipio: activeDossier.municipio,
      localidadComuna: newAliadaCorp === 'JAL' ? newAliadaComuna : undefined,
      metaVotosEsperada: newAliadaMetaVotos || 15000,
      candidatos: []
    };

    const updated = [...(activeDossier.campanasAliadas || []), newCampana];
    updateDossier({ campanasAliadas: updated });
    setSelectedAliadaId(newId);
    setShowAddAliadaModal(false);
    setNewAliadaNombre('');
    showToast(`Nueva Lista Creada: ${generatedName}`);
  };

  const handleDeleteAliada = (id: string, nombre: string) => {
    if (confirm(`¿Está seguro de eliminar la lista "${nombre}" y todos sus candidatos inscritos?`)) {
      const updated = (activeDossier.campanasAliadas || []).filter(c => c.id !== id);
      updateDossier({ campanasAliadas: updated });
      if (selectedAliadaId === id) {
        setSelectedAliadaId(updated.length > 0 ? updated[0].id : null);
      }
      showToast(`Lista Eliminada: ${nombre}`);
    }
  };

  const handleStartEditListInfo = (camp: CampanaAliada) => {
    setEditingListInfoId(camp.id);
    setEditListNombre(camp.nombreLista);
    setEditListPartido(camp.partidoOLista);
    setEditListModalidad(camp.modalidad);
    setEditListMetaVotos(camp.metaVotosEsperada);
  };

  const handleSaveListInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListInfoId) return;

    const updated = (activeDossier.campanasAliadas || []).map(c => {
      if (c.id === editingListInfoId) {
        return {
          ...c,
          nombreLista: editListNombre.trim() || c.nombreLista,
          partidoOLista: editListPartido,
          modalidad: editListModalidad,
          metaVotosEsperada: editListMetaVotos
        };
      }
      return c;
    });

    updateDossier({ campanasAliadas: updated });
    setEditingListInfoId(null);
    showToast('Información de la lista actualizada correctamente');
  };

  const handleStartEditCandidate = (cand: CandidatoListaAliada) => {
    setEditingCandidateId(cand.id);
    setCandNombre(cand.nombre);
    setCandCedula(cand.cedula);
    setCandTelefono(cand.telefono || '');
    setCandEmail(cand.email || '');
    setCandEsCabeza(cand.esCabeza);
    setCandRenglon(cand.numeroRenglon);
  };

  const handleCancelCandidateEdit = () => {
    setEditingCandidateId(null);
    setCandNombre('');
    setCandCedula('');
    setCandTelefono('');
    setCandEmail('');
    setCandEsCabeza(false);
    setCandRenglon(1);
  };

  const handleAddOrUpdateCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAliadaId) return;
    if (!candNombre.trim() || !candCedula.trim()) {
      alert('Por favor complete al menos el Nombre y la Cédula del candidato.');
      return;
    }

    const updatedAliadas = (activeDossier.campanasAliadas || []).map(camp => {
      if (camp.id === selectedAliadaId) {
        let updatedCands = [...camp.candidatos];

        if (candEsCabeza) {
          updatedCands = updatedCands.map(c => ({ ...c, esCabeza: false }));
        }

        if (editingCandidateId) {
          updatedCands = updatedCands.map(c => {
            if (c.id === editingCandidateId) {
              return {
                ...c,
                numeroRenglon: candRenglon,
                nombre: candNombre.trim(),
                cedula: candCedula.trim(),
                telefono: candTelefono.trim(),
                email: candEmail.trim(),
                esCabeza: candEsCabeza
              };
            }
            return c;
          });
        } else {
          const nextRenglon = candRenglon || (updatedCands.length + 1);
          const newCand: CandidatoListaAliada = {
            id: `cand-${Date.now()}`,
            numeroRenglon: nextRenglon,
            nombre: candNombre.trim(),
            cedula: candCedula.trim(),
            telefono: candTelefono.trim(),
            email: candEmail.trim(),
            esCabeza: candEsCabeza
          };
          updatedCands.push(newCand);
        }

        return {
          ...camp,
          candidatos: updatedCands.sort((a, b) => a.numeroRenglon - b.numeroRenglon)
        };
      }
      return camp;
    });

    updateDossier({ campanasAliadas: updatedAliadas });
    handleCancelCandidateEdit();
    showToast(editingCandidateId ? 'Candidato actualizado con éxito' : 'Candidato agregado con éxito');
  };

  const handleDeleteCandidate = (candId: string) => {
    if (!selectedAliadaId) return;
    const updatedAliadas = (activeDossier.campanasAliadas || []).map(camp => {
      if (camp.id === selectedAliadaId) {
        return {
          ...camp,
          candidatos: camp.candidatos.filter(c => c.id !== candId)
        };
      }
      return camp;
    });
    updateDossier({ campanasAliadas: updatedAliadas });
  };

  const handleToggleCabeza = (candId: string) => {
    if (!selectedAliadaId) return;
    const updatedAliadas = (activeDossier.campanasAliadas || []).map(camp => {
      if (camp.id === selectedAliadaId) {
        return {
          ...camp,
          candidatos: camp.candidatos.map(c => ({
            ...c,
            esCabeza: c.id === candId ? !c.esCabeza : false
          }))
        };
      }
      return camp;
    });
    updateDossier({ campanasAliadas: updatedAliadas });
  };

  const entidadTerritorialTexto = activeDossier.circunscripcionTerritorial === 'Departamento' 
    ? `Departamento de ${activeDossier.departamento}`
    : `Municipio de ${activeDossier.municipio.split(' ')[0]} (${activeDossier.departamento})`;

  const selectedAliada = (activeDossier.campanasAliadas || []).find(a => a.id === selectedAliadaId);

  return (
    <div className={`space-y-6 ${standalone ? 'min-h-[calc(100vh-60px)] bg-slate-100 p-4 md:p-8' : ''}`}>
      
      {/* ========================================================================= */}
      {/* HEADER BANNER - CANDIDATO PRINCIPAL */}
      {/* ========================================================================= */}
      <div className="bg-[#040e21] rounded-2xl p-5 shadow-xl border border-cyan-500/20 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Gestión & Expediente de Campaña Oficial
                </h2>
                <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/30 rounded-md text-[10px] font-bold text-cyan-300 shrink-0">
                  CNE Colombia • Registraduría
                </span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Limpiar y restablecer todos los datos del software para comenzar desde cero"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>Empezar Desde Cero</span>
            </button>

            <button
              type="button"
              onClick={() => setShowChecklistModal(true)}
              className="px-3 py-2 bg-[#051833] hover:bg-[#09254d] text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Auditoría de requisitos legales CNE"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Auditoría CNE</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-2 bg-[#051833] hover:bg-[#09254d] text-cyan-300 text-xs font-bold rounded-xl border border-cyan-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Generar informe ejecutivo del expediente oficial en PDF"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Expediente PDF</span>
            </button>

            <button
              type="button"
              onClick={() => void saveCampaignDossier('Toda la Configuración Completa de Campaña')}
              disabled={campaignLoading || campaignSaving || !activeCampaignId}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{campaignSaving ? 'Sincronizando...' : 'Guardar Expediente'}</span>
            </button>
          </div>
        </div>

        {/* Only show campaign data after a real campaign has been loaded. */}
        {activeCampaignId && !campaignLoading && (
        <div className="bg-[#020712] p-3 rounded-xl border border-slate-800/80 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Elección & Territorio</span>
            <span className="font-extrabold text-amber-300 block truncate" title={`${activeDossier.tipoProcesoEleccion} - ${activeDossier.corporacion} (${entidadTerritorialTexto})`}>
              {activeDossier.corporacion} • {entidadTerritorialTexto}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Candidato Oficial</span>
            <span className="font-extrabold text-white block truncate" title={activeDossier.nombreCandidato}>
              {activeDossier.nombreCandidato || 'Por definir'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Respaldo Político</span>
            <span className="font-extrabold text-emerald-400 block truncate">
              {activeDossier.modalidadAval === 'Partido' ? activeDossier.partidoUnico : activeDossier.modalidadAval === 'Firmas' ? activeDossier.nombreGrupoFirmas : activeDossier.nombreCoalicion}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Tope Legal CNE</span>
            <span className="font-extrabold text-cyan-300 block font-mono">
              {campaignBudgetLimit && campaignBudgetLimit > 0
                ? `$${campaignBudgetLimit.toLocaleString('es-CO')} COP`
                : 'Sin definir'}
            </span>
          </div>
        </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-cyan-500/15 pt-3 text-xs" style={{scrollbarWidth:'thin', scrollbarColor:'#164e63 transparent'}}>
          {[
            { id: 'territorio', label: '1. Territorio & Elección', icon: MapPin },
            { id: 'candidato', label: '2. Candidato', icon: User },
            { id: 'aval', label: '3. Aval & Respaldo', icon: Award },
            { id: 'calendario', label: '4. Calendario & Póliza', icon: Calendar },
            { id: 'equipo', label: '5. Equipo CNE', icon: Briefcase },
            { id: 'aliadas', label: `6. Listas Aliadas (${activeDossier.campanasAliadas?.length || 0})`, icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isCurrent
                    ? 'bg-[#092244] text-emerald-300 border border-emerald-400 shadow-sm'
                    : 'bg-[#030d1f] text-slate-400 hover:text-white hover:bg-[#051833] border border-cyan-500/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(campaignLoading || campaignSyncError || lastSyncedAt) && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
          campaignSyncError
            ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
        }`}>
          <span>
            {campaignLoading
              ? 'Cargando expediente real desde Supabase...'
              : campaignSyncError
                ? `Sincronización pendiente: ${campaignSyncError}`
                : 'Expediente conectado a la campaña activa en Supabase.'}
          </span>
          {!campaignLoading && !campaignSyncError && lastSyncedAt && (
            <span className="text-cyan-400 font-mono">
              Última sincronización: {new Date(lastSyncedAt).toLocaleString('es-CO')}
            </span>
          )}
        </div>
      )}

      {/* Floating Save Toast Notification */}
      {activeSaveToast && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl border border-emerald-400 flex items-center justify-between animate-fadeIn sticky top-4 z-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            <div>
              <h4 className="font-bold text-xs">¡Cambios Guardados Satisfactoriamente!</h4>
              <p className="text-[11px] text-emerald-100">
                Se guardaron los datos de: <strong>{activeSaveToast}</strong>. Sincronizado en la base de datos de campaña.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTIONS RENDERING ACCORDING TO ACTIVE TAB */}
      {/* ========================================================================= */}
      <div className="space-y-6">

        {/* SECTION 1: ELECCIÓN, CORPORACIÓN Y TERRITORIO */}
        {activeTab === 'territorio' && (
          <div className="bg-[#041733]/90 rounded-2xl p-6 border border-cyan-500/30 shadow-xl space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-md text-[10px] font-extrabold uppercase mb-1">
                  Paso 1 Principal
                </div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Vote className="w-5 h-5 text-emerald-400" />
                  1. Parámetros de la Elección & Jurisdicción Territorial
                </h3>
              </div>

              <button
                type="button"
                onClick={() => void saveCampaignDossier('Sección 1: Parámetros de Elección y Territorio')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Sección 1</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              
              {/* 1.1 Tipo de Elección */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Tipo de Elección *</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => updateDossier({ tipoProcesoEleccion: 'Ordinaria' })}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      activeDossier.tipoProcesoEleccion === 'Ordinaria'
                        ? 'bg-[#092244] text-white border-emerald-400 shadow-sm'
                        : 'bg-[#051833] text-slate-300 border-cyan-500/30 hover:bg-cyan-500/20'
                    }`}
                  >
                    Ordinaria
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDossier({ tipoProcesoEleccion: 'Atípica' })}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      activeDossier.tipoProcesoEleccion === 'Atípica'
                        ? 'bg-[#092244] text-white border-emerald-400 shadow-sm'
                        : 'bg-[#051833] text-slate-300 border-cyan-500/30 hover:bg-cyan-500/20'
                    }`}
                  >
                    Atípica
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Elección regional o complementaria programada.</p>
              </div>

              {/* 1.2 Fecha Elección */}
              <div className="min-w-0 overflow-hidden p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Fecha de las Elecciones (Día E) *</label>
                <div className="relative min-w-0 overflow-hidden pt-1">
                  <Calendar className="w-4 h-4 text-emerald-400 absolute left-3 top-3.5" />
                  <input
                    type="date"
                    required
                    value={activeDossier.fechaEleccion}
                    onChange={(e) => updateDossier({ fechaEleccion: e.target.value })}
                    className="block w-full min-w-0 max-w-full box-border bg-[#051833] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Fecha oficial fijada por la Registraduría / CNE.</p>
              </div>

              {/* 1.3 Corporación */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Corporación / Cargo *</label>
                <select
                  value={activeDossier.corporacion}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    if (val === 'Gobernación' || val === 'Asamblea') {
                      updateDossier({ corporacion: val, circunscripcionTerritorial: 'Departamento' });
                    } else {
                      updateDossier({ corporacion: val, circunscripcionTerritorial: 'Municipio' });
                    }
                  }}
                  className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400 mt-1"
                >
                  <option value="Gobernación">Gobernación Departamental</option>
                  <option value="Asamblea">Asamblea Departamental</option>
                  <option value="Alcaldía">Alcaldía Municipal / Distrital</option>
                  <option value="Concejo">Concejo Municipal / Distrital</option>
                  <option value="JAL">JAL (Junta Administradora Local / Ediles)</option>
                </select>
                <p className="text-[10px] text-slate-400">Cargo unipersonal o cuerpo colegiado a aspirar.</p>
              </div>

              {/* 1.4 Circunscripción Territorial */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Circunscripción Territorial *</label>
                <select
                  value={activeDossier.circunscripcionTerritorial}
                  onChange={(e) => handleCircunscripcionChange(e.target.value as any)}
                  className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400 mt-1"
                >
                  <option value="Municipio">Municipio / Distrito</option>
                  <option value="Departamento">Departamento</option>
                </select>
                <p className="text-[10px] text-slate-400">Nivel territorial de la contienda electoral.</p>
              </div>

              {/* 1.5 Entidad Territorial Dynamic Cascade */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/30 space-y-1.5 md:col-span-2 lg:col-span-2">
                <label className="block font-extrabold text-cyan-200 flex items-center justify-between">
                  <span>Entidad Territorial (Base Completa Oficial de Colombia) *</span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded">
                    Circunscripción: {activeDossier.circunscripcionTerritorial}
                  </span>
                </label>

                {activeDossier.circunscripcionTerritorial === 'Departamento' ? (
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-bold text-cyan-300">Seleccione el Departamento de Colombia:</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                      <select
                        value={activeDossier.departamento}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400"
                      >
                        {Object.keys(colombiaTerritorialData).sort().map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-emerald-300 font-semibold">
                      Entidad Territorial Seleccionada: <strong>Gobernación / Asamblea de {activeDossier.departamento}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                        1. Departamento ({Object.keys(colombiaTerritorialData).length} Departamentos):
                      </label>
                      <select
                        value={activeDossier.departamento}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400"
                      >
                        {Object.keys(colombiaTerritorialData).sort().map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                        2. Municipio / Distrito ({colombiaTerritorialData[activeDossier.departamento]?.length || 0} en {activeDossier.departamento}):
                      </label>
                      <select
                        value={activeDossier.municipio}
                        onChange={(e) => updateDossier({ municipio: e.target.value })}
                        className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400"
                      >
                        {(colombiaTerritorialData[activeDossier.departamento] || []).map(mun => (
                          <option key={mun} value={mun}>{mun}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 1.6 Modalidad Candidatura */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Modalidad de Candidatura *</label>
                <select
                  value={activeDossier.modalidadCandidatura}
                  onChange={(e) => updateDossier({ modalidadCandidatura: e.target.value as any })}
                  className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400 mt-1"
                >
                  <option value="Uninominal">Uninominal (Candidato Único a Alcaldía/Gobernación)</option>
                  <option value="Lista Abierta">Lista Abierta (Voto Preferente)</option>
                  <option value="Lista Cerrada">Lista Cerrada (Voto No Preferente)</option>
                </select>
              </div>

              {/* 1.7 Posición en Tarjetón */}
              <div className="p-3 bg-[#030d1f] rounded-xl border border-cyan-500/20 space-y-1.5">
                <label className="block font-extrabold text-cyan-200">Número / Posición en Tarjetón</label>
                <input
                  type="text"
                  value={activeDossier.posicionTarjeton}
                  onChange={(e) => updateDossier({ posicionTarjeton: e.target.value })}
                  placeholder="Ej. 01 / Casilla Principal"
                  className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-emerald-400 mt-1"
                />
              </div>

            </div>
          </div>
        )}

        {/* SECTION 2: CANDIDATE INFORMATION */}
        {activeTab === 'candidato' && (
          <div className="bg-[#051325]/90 rounded-2xl p-6 border border-cyan-500/30 shadow-xl space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-md text-[10px] font-extrabold uppercase mb-1">
                  Paso 2 Candidato
                </div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  2. Información Básica & Expediente del Candidato
                </h3>
              </div>

              <button
                type="button"
                onClick={() => void saveCampaignDossier('Sección 2: Expediente del Candidato')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Sección 2</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Photo Card */}
              <div className="bg-[#030d1f] p-4 rounded-2xl border border-cyan-500/20 flex flex-col items-center justify-center space-y-3">
                <div className="relative group">
                  <img
                    src={activeDossier.fotoUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80'}
                    alt={activeDossier.nombreCandidato}
                    className="w-32 h-32 rounded-2xl object-cover border-2 border-cyan-400/40 shadow-md"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Upload className="w-6 h-6 text-cyan-300 pointer-events-none" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="tarjeton-photo-upload"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64Url = event.target?.result as string;
                          if (base64Url) {
                            updateDossier({ fotoUrl: base64Url });
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
                </div>
                <div className="text-center">
                  <label htmlFor="tarjeton-photo-upload" className="text-xs font-bold text-slate-200 block cursor-pointer hover:text-cyan-300 transition-colors">
                    Fotografía Oficial para Tarjetón
                  </label>
                  <span className="text-[10px] text-slate-400">Clic en la foto para subir archivo o ingresa URL</span>
                </div>
                <input
                  type="text"
                  value={activeDossier.fotoUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    updateDossier({ fotoUrl: url });
                    try {
                      localStorage.setItem('candidate_photo', url);
                      window.dispatchEvent(new Event('candidate_photo_updated'));
                    } catch {
                      // ignore
                    }
                  }}
                  placeholder="URL de la fotografía del candidato..."
                  className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-1.5 text-[11px] text-cyan-200 font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Basic Fields */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Nombre Completo del Candidato *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={activeDossier.nombreCandidato}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDossier({ nombreCandidato: val });
                        try {
                          localStorage.setItem('candidate_name', val);
                          window.dispatchEvent(new Event('candidate_name_updated'));
                        } catch {
                          // ignore
                        }
                      }}
                      className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Cédula de Ciudadanía (CC) *</label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={activeDossier.cedulaCandidato}
                      onChange={(e) => updateDossier({ cedulaCandidato: e.target.value })}
                      className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold font-mono focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Nombre Político / Seudónimo en Tarjetón</label>
                  <input
                    type="text"
                    value={activeDossier.seudonimoPolitico}
                    onChange={(e) => updateDossier({ seudonimoPolitico: e.target.value })}
                    className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Profesión / Formación Académica</label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={activeDossier.profesionCandidato}
                      onChange={(e) => updateDossier({ profesionCandidato: e.target.value })}
                      className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Teléfono Directo / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={activeDossier.telefonoCandidato}
                      onChange={(e) => updateDossier({ telefonoCandidato: e.target.value })}
                      className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold font-mono focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Correo Electrónico de Contacto</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={activeDossier.emailCandidato}
                      onChange={(e) => updateDossier({ emailCandidato: e.target.value })}
                      className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-white font-bold focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-bold text-cyan-200 mb-1">Resumen de Hoja de Vida & Perfil Político</label>
                  <textarea
                    rows={2}
                    value={activeDossier.resumenVida}
                    onChange={(e) => updateDossier({ resumenVida: e.target.value })}
                    className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl p-3 text-white text-xs focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                  ></textarea>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SECTION 3: POLITICAL ENDORSEMENT */}
        {activeTab === 'aval' && (
          <div className="bg-[#051325]/90 rounded-2xl p-6 border border-cyan-500/30 shadow-xl space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md text-[10px] font-extrabold uppercase mb-1">
                  Paso 3 Respaldo
                </div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  3. Modalidad de Respaldo Político & Aval Oficial
                </h3>
              </div>

              <button
                type="button"
                onClick={() => void saveCampaignDossier('Sección 3: Respaldo Político y Aval Oficial')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Sección 3</span>
              </button>
            </div>

            {/* Selector of Endorsement Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: 'Partido', label: '1. Partido Político con Personería', desc: 'Aval único de un partido registrado CNE' },
                { id: 'Firmas', label: '2. Grupo Significativo (Firmas)', desc: 'Movimiento de ciudadanos por firmas' },
                { id: 'Coalición', label: '3. Coalición Político-Electoral', desc: 'Unión de múltiples partidos y movimientos' }
              ].map(mod => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => updateDossier({ modalidadAval: mod.id as any })}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeDossier.modalidadAval === mod.id
                      ? 'bg-[#081f3d] text-white border-emerald-400 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-[#030d1f] text-slate-300 border-cyan-500/20 hover:bg-[#051833] hover:text-white'
                  }`}
                >
                  <div className="font-extrabold text-xs">{mod.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{mod.desc}</div>
                </button>
              ))}
            </div>

            {/* CASE A: SINGLE POLITICAL PARTY */}
            {activeDossier.modalidadAval === 'Partido' && (
              <div className="bg-[#030d1f] p-4 rounded-2xl border border-cyan-500/20 space-y-4 animate-fadeIn">
                <h4 className="font-extrabold text-emerald-400 text-xs uppercase tracking-wider">
                  Selección de Partido Político Oficial (CNE Colombia)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-cyan-200 mb-1">Partido Político Avalista *</label>
                    <select
                      value={activeDossier.partidoUnico}
                      onChange={(e) => updateDossier({ partidoUnico: e.target.value })}
                      className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-extrabold text-white focus:outline-none focus:border-emerald-400"
                    >
                      {partidosPoliticosColombia.map(partido => (
                        <option key={partido} value={partido} className="bg-[#051833] text-white">{partido}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-cyan-200 mb-1">Número de Radicado / Aval CNE *</label>
                    <input
                      type="text"
                      value={activeDossier.numeroAvalCNE}
                      onChange={(e) => updateDossier({ numeroAvalCNE: e.target.value })}
                      className="w-full bg-[#051833] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold font-mono text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CASE B: FIRMAS (GSC) */}
            {activeDossier.modalidadAval === 'Firmas' && (
              <div className="bg-[#030d1f] p-4 rounded-2xl border border-purple-500/30 space-y-4 animate-fadeIn">
                <h4 className="font-extrabold text-purple-300 text-xs uppercase tracking-wider">
                  Grupo Significativo de Ciudadanos (Recolección de Firmas)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-purple-200 mb-1">Nombre Oficial del Movimiento por Firmas *</label>
                    <input
                      type="text"
                      value={activeDossier.nombreGrupoFirmas}
                      onChange={(e) => updateDossier({ nombreGrupoFirmas: e.target.value })}
                      className="w-full bg-[#051833] border border-purple-500/30 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-purple-200 mb-1">Meta Operativa de Firmas Validadas *</label>
                    <input
                      type="number"
                      value={activeDossier.metaFirmas}
                      onChange={(e) => updateDossier({ metaFirmas: Number(e.target.value) })}
                      className="w-full bg-[#051833] border border-purple-500/30 rounded-xl px-3 py-2 font-bold font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-purple-200 mb-1">Radicado de Inscripción Registraduría *</label>
                    <input
                      type="text"
                      value={activeDossier.radicadoRegistraduria}
                      onChange={(e) => updateDossier({ radicadoRegistraduria: e.target.value })}
                      className="w-full bg-[#051833] border border-purple-500/30 rounded-xl px-3 py-2 font-bold font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <label className="block font-bold text-purple-200 mb-1">Comité Inscriptor (3 Promotores Principales por Ley)</label>
                    <input
                      type="text"
                      value={activeDossier.promotoresFirmas}
                      onChange={(e) => updateDossier({ promotoresFirmas: e.target.value })}
                      className="w-full bg-[#051833] border border-purple-500/30 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CASE C: COALICIÓN */}
            {activeDossier.modalidadAval === 'Coalición' && (
              <div className="bg-[#030d1f] p-4 rounded-2xl border border-emerald-500/30 space-y-4 animate-fadeIn">
                <h4 className="font-extrabold text-emerald-300 text-xs uppercase tracking-wider">
                  Configuración de Coalición Político-Electoral Multi-Partido
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-emerald-200 mb-1">Nombre Oficial de la Coalición *</label>
                    <input
                      type="text"
                      value={activeDossier.nombreCoalicion}
                      onChange={(e) => updateDossier({ nombreCoalicion: e.target.value })}
                      className="w-full bg-[#051833] border border-emerald-500/40 rounded-xl px-3 py-2 font-black text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-200 mb-1">Partido Principal Responsable CNE *</label>
                    <select
                      value={activeDossier.partidoResponsableCNE}
                      onChange={(e) => updateDossier({ partidoResponsableCNE: e.target.value })}
                      className="w-full bg-[#051833] border border-emerald-500/40 rounded-xl px-3 py-2 font-extrabold text-white focus:outline-none focus:border-emerald-400"
                    >
                      {(activeDossier.partidosCoalicion || []).map(p => (
                        <option key={p} value={p} className="bg-[#051833] text-white">{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-emerald-200 text-xs mb-2">
                    Partidos y Movimientos Integrantes de la Coalición (Marque los participantes):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-[#051833] p-3 rounded-xl border border-emerald-500/30 max-h-44 overflow-y-auto">
                    {partidosPoliticosColombia.map(party => {
                      const isSelected = (activeDossier.partidosCoalicion || []).includes(party);
                      return (
                        <button
                          key={party}
                          type="button"
                          onClick={() => togglePartyCoalition(party)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400' 
                              : 'bg-[#030d1f] text-slate-300 hover:bg-[#081f3d] border border-cyan-500/20'
                          }`}
                        >
                          <CheckSquare className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className="truncate">{party}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* SECTION 4: CALENDARIO & PÓLIZA */}
        {activeTab === 'calendario' && (
          <div className="bg-[#051325]/90 rounded-2xl p-6 border border-cyan-500/30 shadow-xl space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-md text-[10px] font-extrabold uppercase mb-1">
                  Paso 4 Horarios & Póliza
                </div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  4. Fechas Clave, Horarios del Día E & Póliza de Seriedad
                </h3>
              </div>

              <button
                type="button"
                onClick={() => void saveCampaignDossier('Sección 4: Horarios y Póliza')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Sección 4</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-cyan-200 mb-1">Hora de Apertura de Urnas</label>
                <input
                  type="time"
                  value={activeDossier.horaApertura}
                  onChange={(e) => updateDossier({ horaApertura: e.target.value })}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Hora de Cierre & Inicio Escrutinio</label>
                <input
                  type="time"
                  value={activeDossier.horaCierre}
                  onChange={(e) => updateDossier({ horaCierre: e.target.value })}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Proceso Electoral Seleccionado</label>
                <div className="px-3 py-2 bg-[#030d1f] rounded-xl font-bold text-slate-200 border border-cyan-500/30 flex items-center justify-between">
                  <span>Elección {activeDossier.tipoProcesoEleccion}</span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">{activeDossier.fechaEleccion}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-cyan-500/20 text-xs">
              <div>
                <label className="block font-bold text-cyan-200 mb-1">Número de Póliza de Seriedad de Candidatura (GSC / Coalición)</label>
                <input
                  type="text"
                  value={activeDossier.polizaNumero}
                  onChange={(e) => updateDossier({ polizaNumero: e.target.value })}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Compañía Aseguradora Emisora</label>
                <input
                  type="text"
                  value={activeDossier.aseguradora}
                  onChange={(e) => updateDossier({ aseguradora: e.target.value })}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: EQUIPO OFICIAL CNE & CUENTA BANCARIA */}
        {activeTab === 'equipo' && (
          <EquipoCampanaSection
            equipo={activeDossier.equipo || defaultCampanaDossier.equipo}
            onChangeEquipo={(updated) => updateDossier({ equipo: updated })}
            onSaveSection={() => void saveCampaignDossier('Sección 5: Equipo Oficial de Campaña y Cuenta Bancaria')}
          />
        )}

        {/* SECTION 6: CAMPAÑAS ALIADAS & LISTAS */}
        {activeTab === 'aliadas' && (
          <div className="bg-[#051325]/90 rounded-2xl p-6 border border-cyan-500/30 shadow-xl space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px] font-extrabold uppercase mb-1">
                  Paso 6 Campañas Aliadas
                </div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  6. Gestión y Configuración de Campañas Aliadas & Listas de Candidatos
                </h3>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddAliadaModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-cyan-400/30"
                >
                  <Plus className="w-4 h-4 text-cyan-200" />
                  <span>Crear Nueva Lista Aliada</span>
                </button>

                <button
                  type="button"
                  onClick={() => void saveCampaignDossier('Sección 6: Campañas Aliadas y Listas de Candidatos')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Sección 6</span>
                </button>
              </div>
            </div>

            {/* Cards Grid: Allied Campaigns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(activeDossier.campanasAliadas || []).map(camp => {
                const isSelected = camp.id === selectedAliadaId;
                const headCandidate = camp.candidatos.find(c => c.esCabeza) || camp.candidatos[0];

                return (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedAliadaId(camp.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative ${
                      isSelected
                        ? 'bg-[#081f3d] border-emerald-400 shadow-xl ring-2 ring-emerald-500/40'
                        : 'bg-[#030d1f] border-cyan-500/20 hover:border-cyan-500/50 hover:bg-[#051833]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        camp.corporacion === 'Asamblea' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        camp.corporacion === 'Concejo' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {camp.corporacion}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditListInfo(camp);
                          }}
                          className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors"
                          title="Editar información de la lista"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAliada(camp.id, camp.nombreLista);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors"
                          title="Eliminar lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-white text-xs leading-snug line-clamp-2">
                        {camp.nombreLista}
                      </h4>
                      <p className="text-[10px] text-cyan-300/80 mt-0.5 truncate">{camp.partidoOLista}</p>
                    </div>

                    <div className="bg-[#020712] p-2 rounded-xl border border-cyan-500/20 space-y-1 text-[10px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Modalidad:</span>
                        <strong className="text-white">{camp.modalidad}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Candidatos:</span>
                        <strong className="text-emerald-400">{camp.candidatos.length}</strong>
                      </div>
                      {headCandidate && (
                        <div className="pt-1 border-t border-slate-800 text-slate-300 truncate">
                          <span className="text-slate-500">Cabeza: </span>
                          <strong className="text-white">{headCandidate.nombre}</strong>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Meta Votos:</span>
                      <span className="font-mono font-black text-cyan-300">
                        {camp.metaVotosEsperada.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Allied List Candidates Editor */}
            {selectedAliada && (
              <div className="bg-[#030d1f] p-5 rounded-2xl border border-cyan-500/30 space-y-5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                      Lista Seleccionada para Gestión de Candidatos
                    </span>
                    <h4 className="font-black text-white text-sm">
                      {selectedAliada.nombreLista} ({selectedAliada.corporacion} - {selectedAliada.modalidad})
                    </h4>
                  </div>

                  <span className="text-xs text-slate-300 font-bold bg-[#051833] px-3 py-1.5 rounded-xl border border-cyan-500/30">
                    {selectedAliada.candidatos.length} Candidatos Inscritos
                  </span>
                </div>

                {/* Candidate Add / Edit Form */}
                <form onSubmit={handleAddOrUpdateCandidate} className="bg-[#051833] p-4 rounded-xl border border-cyan-500/30 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-cyan-200">
                      {editingCandidateId ? '✏️ Editar Candidato de la Lista' : '➕ Agregar Candidato al Renglón'}
                    </span>
                    {editingCandidateId && (
                      <button
                        type="button"
                        onClick={handleCancelCandidateEdit}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">Renglón / No. Tarjetón *</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={candRenglon}
                        onChange={(e) => setCandRenglon(Number(e.target.value))}
                        className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        placeholder="Ej. Dr. Andrés Felipe Restrepo"
                        value={candNombre}
                        onChange={(e) => setCandNombre(e.target.value)}
                        className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">Cédula de Ciudadanía *</label>
                      <input
                        type="text"
                        placeholder="Ej. 1.017.234.567"
                        value={candCedula}
                        onChange={(e) => setCandCedula(e.target.value)}
                        className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-cyan-300 mb-1">Teléfono / WhatsApp</label>
                      <input
                        type="text"
                        placeholder="Ej. +57 311 234 5678"
                        value={candTelefono}
                        onChange={(e) => setCandTelefono(e.target.value)}
                        className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-bold font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={candEsCabeza}
                        onChange={(e) => setCandEsCabeza(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                      />
                      <span className="font-bold text-amber-300 text-xs">Marcar como Cabeza de Lista (Renglón 1 / Principal)</span>
                    </label>

                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingCandidateId ? 'Guardar Cambios Candidato' : 'Inscribir Candidato a Lista'}</span>
                    </button>
                  </div>
                </form>

                {/* Table of Candidates */}
                <div className="space-y-2">
                  <div className="font-extrabold text-white text-xs">Renglones y Candidatos en la Lista:</div>
                  <div className="overflow-x-auto w-full max-w-full rounded-xl border border-cyan-500/30">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#051833] text-cyan-300 font-bold border-b border-cyan-500/30">
                        <tr>
                          <th className="p-3 text-center w-16">Renglón</th>
                          <th className="p-3">Nombre Candidato</th>
                          <th className="p-3">Cédula</th>
                          <th className="p-3">Contacto</th>
                          <th className="p-3 text-center">Cabeza de Lista</th>
                          <th className="p-3 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-500/15">
                        {selectedAliada.candidatos.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              No hay candidatos registrados en esta lista todavía. Utilice el formulario superior para agregarlos.
                            </td>
                          </tr>
                        ) : (
                          selectedAliada.candidatos.map(cand => (
                            <tr key={cand.id} className="hover:bg-[#051833]/50 transition-colors">
                              <td className="p-3 text-center font-black font-mono text-cyan-300 bg-[#020712]/40">
                                #{cand.numeroRenglon}
                              </td>
                              <td className="p-3 font-bold text-white">
                                <div className="flex items-center gap-2">
                                  <span>{cand.nombre}</span>
                                  {cand.esCabeza && (
                                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-black">
                                      CABEZA
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 font-mono text-slate-300">{cand.cedula}</td>
                              <td className="p-3 text-slate-300">
                                <div>{cand.telefono || 'Sin teléfono'}</div>
                                <div className="text-[10px] text-slate-500">{cand.email}</div>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCabeza(cand.id)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                    cand.esCabeza 
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400' 
                                      : 'bg-[#020712] text-slate-400 hover:text-white border border-slate-700'
                                  }`}
                                >
                                  {cand.esCabeza ? 'Sí (Cabeza)' : 'Hacer Cabeza'}
                                </button>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCandidate(cand)}
                                    className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors cursor-pointer"
                                    title="Editar candidato"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCandidate(cand.id)}
                                    className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar candidato"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW ALLIED LIST */}
      {/* ========================================================================= */}
      {showAddAliadaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#051325] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-cyan-500/40 space-y-5 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-white text-base">Crear / Vincular Nueva Lista Aliada</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAliadaModal(false)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAliada} className="space-y-4 text-xs">
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Normativa Electoral (CNE/Registraduría):</span>
                </div>
                <p className="text-amber-200/90 leading-snug">
                  Como la campaña principal es <strong className="text-white">{activeDossier.corporacion}</strong> ({entidadTerritorialTexto}), las campañas aliadas se configuran como listas a corporaciones públicas colegiadas (<strong className="text-white">Concejo, Asamblea o JAL</strong>).
                </p>
              </div>

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Corporación Aliada *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Concejo', label: 'Concejo Municipal' },
                    { id: 'Asamblea', label: 'Asamblea Departamental' },
                    { id: 'JAL', label: 'JAL (Ediles)' }
                  ].map(corp => (
                    <button
                      key={corp.id}
                      type="button"
                      onClick={() => setNewAliadaCorp(corp.id as any)}
                      className={`p-2.5 rounded-xl border text-center font-extrabold transition-all cursor-pointer ${
                        newAliadaCorp === corp.id 
                          ? 'bg-[#081f3d] text-emerald-300 border-emerald-400 shadow-sm ring-1 ring-emerald-500/50' 
                          : 'bg-[#030d1f] text-slate-300 border-cyan-500/20 hover:bg-[#051833]'
                      }`}
                    >
                      {corp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Partido / Movimiento Avalista *</label>
                  <select
                    value={newAliadaPartido}
                    onChange={(e) => setNewAliadaPartido(e.target.value)}
                    className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                  >
                    {partidosPoliticosColombia.map(partido => (
                      <option key={partido} value={partido} className="bg-[#030d1f] text-white">{partido}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Modalidad de Lista *</label>
                  <select
                    value={newAliadaModalidad}
                    onChange={(e) => setNewAliadaModalidad(e.target.value as any)}
                    className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Lista Abierta" className="bg-[#030d1f] text-white">Lista Abierta (Voto Preferente)</option>
                    <option value="Lista Cerrada" className="bg-[#030d1f] text-white">Lista Cerrada (Voto No Preferente)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Nombre Descriptivo de la Lista *</label>
                <input
                  type="text"
                  placeholder={`Ej. Lista al ${newAliadaCorp} - ${newAliadaPartido}`}
                  value={newAliadaNombre}
                  onChange={(e) => setNewAliadaNombre(e.target.value)}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>

              {newAliadaCorp === 'JAL' && (
                <div>
                  <label className="block font-bold text-cyan-200 mb-1">Comuna / Localidad para JAL *</label>
                  <input
                    type="text"
                    placeholder="Ej. Comuna 10 - La Candelaria / Centro"
                    value={newAliadaComuna}
                    onChange={(e) => setNewAliadaComuna(e.target.value)}
                    className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold text-white focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-cyan-200 mb-1">Meta Esperada de Votos para la Lista</label>
                <input
                  type="number"
                  value={newAliadaMetaVotos}
                  onChange={(e) => setNewAliadaMetaVotos(Number(e.target.value))}
                  className="w-full bg-[#030d1f] border border-cyan-500/30 rounded-xl px-3 py-2 font-bold font-mono text-white focus:bg-[#051833] focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={() => setShowAddAliadaModal(false)}
                  className="px-4 py-2 bg-[#030d1f] text-slate-300 hover:bg-[#081f3d] font-bold rounded-xl transition-all cursor-pointer border border-cyan-500/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Crear Lista Aliada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESET TO ZERO CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#030e21] border border-rose-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">
                  ¿Reiniciar Software Desde Cero?
                </h3>
                <p className="text-xs text-rose-300/80">
                  Esta acción restablece la plataforma a un estado completamente limpio.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-[#020712] p-4 rounded-2xl border border-slate-800">
              <p className="font-semibold text-white">Se restablecerán a valores iniciales:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Expediente y configuración del candidato principal.</li>
                <li>Listas y candidaturas aliadas registradas.</li>
                <li>Libro de contabilidad, ingresos y gastos CNE.</li>
                <li>Padrón y acreditación de testigos electorales.</li>
                <li>Fotografía oficial y parámetros de campaña.</li>
              </ul>
              <p className="text-[11px] text-amber-300 font-medium pt-1">
                El software quedará listo para ingresar los datos reales de la nueva contienda electoral.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetEverythingToZero}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirmar y Empezar Desde Cero</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT CHECKLIST MODAL */}
      {/* ========================================================================= */}
      <ChecklistCNEModal
        dossier={activeDossier}
        isOpen={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
      />

      {/* ========================================================================= */}
      {/* PRINTABLE DOSSIER REPORT MODAL */}
      {/* ========================================================================= */}
      <ExpedienteImprimibleModal
        dossier={activeDossier}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
      />

    </div>
  );
};
