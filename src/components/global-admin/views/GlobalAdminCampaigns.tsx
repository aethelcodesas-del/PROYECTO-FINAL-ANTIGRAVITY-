import React, { useState, useEffect, useRef } from 'react';
import { GlobalAdminCampaign } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import { colombiaTerritorialData } from '../../../data/colombiaTerritorialData';
import {
  Flag,
  Plus,
  Search,
  Building,
  Users,
  DollarSign,
  Calendar,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Vote,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Pencil,
  Trash2,
  LayoutList,
  LayoutGrid
} from 'lucide-react';

const NATIONAL_ELECTIONS: GlobalAdminCampaign['type'][] = ['Presidencia', 'Senado', 'Cámara'];
const DEPARTMENT_ELECTIONS: GlobalAdminCampaign['type'][] = ['Gobernación', 'Asamblea'];
const DEPARTMENTS = Object.keys(colombiaTerritorialData).sort((a, b) => a.localeCompare(b, 'es'));

const jurisdictionLevel = (type: GlobalAdminCampaign['type']) =>
  NATIONAL_ELECTIONS.includes(type) ? 'NACIONAL' : DEPARTMENT_ELECTIONS.includes(type) ? 'DEPARTAMENTAL' : 'MUNICIPAL';

const firstMunicipality = (department: string) => colombiaTerritorialData[department]?.[0] || '';

const formatCop = (value: number) => new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0
}).format(value || 0);

const territoryForType = (type: GlobalAdminCampaign['type'], department = 'Antioquia') => {
  const level = jurisdictionLevel(type);
  if (level === 'NACIONAL') return { department: 'Colombia', city: 'Cobertura nacional' };
  if (level === 'DEPARTAMENTAL') return { department, city: 'Todo el departamento' };
  return { department, city: firstMunicipality(department) };
};

export const GlobalAdminCampaigns: React.FC = () => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [campaigns, setCampaigns] = useState<GlobalAdminCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [editingCampaign, setEditingCampaign] = useState<GlobalAdminCampaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<GlobalAdminCampaign | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    candidateName: '',
    type: 'Alcaldía' as GlobalAdminCampaign['type'],
    department: 'Antioquia',
    city: firstMunicipality('Antioquia'),
    budgetLimitCop: 0,
    adminManager: '',
    accessEmail: '',
    accessPassword: '',
    accessPasswordConfirm: '',
    isDemo: false,
    demoDays: 5
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await GlobalAdminService.getCampaigns();
      setCampaigns(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar campañas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (campaignToDelete) {
          setCampaignToDelete(null);
          return;
        }
        if (showCreateModal && !creating) {
          setShowCreateModal(false);
          setEditingCampaign(null);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCreateModal(false);
        searchInputRef.current?.focus();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setEditingCampaign(null);
        setFormData({
          name: '', candidateName: '', type: 'Alcaldía', department: 'Antioquia',
          city: firstMunicipality('Antioquia'), budgetLimitCop: 0, adminManager: '',
          accessEmail: '', accessPassword: '', accessPasswordConfirm: '', isDemo: false, demoDays: 5
        });
        setShowCreateModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [campaignToDelete, showCreateModal, creating]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCampaign) {
      try {
        setCreating(true);
        setError(null);
        await GlobalAdminService.updateCampaign(editingCampaign.id, formData);
        setShowCreateModal(false);
        setEditingCampaign(null);
        setSuccessMsg(`Campaña "${formData.name}" actualizada correctamente.`);
        await fetchData();
      } catch (err: any) {
        setError(err.message || 'Error al actualizar campaña');
      } finally {
        setCreating(false);
      }
      return;
    }
    if (formData.accessPassword.length < 10) {
      setError('La contraseña de acceso debe tener al menos 10 caracteres.');
      return;
    }
    if (formData.accessPassword !== formData.accessPasswordConfirm) {
      setError('Las contraseñas de acceso no coinciden.');
      return;
    }
    let createdCampaign: GlobalAdminCampaign | null = null;
    try {
      setCreating(true);
      setError(null);
      createdCampaign = await GlobalAdminService.createCampaign(formData);
      await GlobalAdminService.createCampaignUser({
        campaignId: createdCampaign.id,
        displayName: formData.candidateName,
        email: formData.accessEmail,
        password: formData.accessPassword
      });
      window.dispatchEvent(new CustomEvent('global-admin-users-changed', {
        detail: { campaignId: createdCampaign.id, email: formData.accessEmail }
      }));
      const activeJurisdiction = {
        campaignId: createdCampaign.id,
        campaignName: createdCampaign.name,
        candidateName: createdCampaign.candidateName,
        electionType: createdCampaign.type,
        level: jurisdictionLevel(createdCampaign.type),
        country: 'Colombia',
        department: createdCampaign.department,
        municipality: createdCampaign.city,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('active_campaign_jurisdiction_v1', JSON.stringify(activeJurisdiction));
      localStorage.setItem('active_campaign_id', createdCampaign.id);
      localStorage.setItem('candidate_name', createdCampaign.candidateName);
      try {
        const dossierKey = 'elecciones_campana_principal_dossier_v2';
        const currentDossier = JSON.parse(localStorage.getItem(dossierKey) || '{}');
        localStorage.setItem(dossierKey, JSON.stringify({
          ...currentDossier,
          id: createdCampaign.id,
          updatedAt: new Date().toISOString(),
          corporacion: createdCampaign.type,
          circunscripcionTerritorial: jurisdictionLevel(createdCampaign.type) === 'NACIONAL'
            ? 'Nacional'
            : jurisdictionLevel(createdCampaign.type) === 'DEPARTAMENTAL'
              ? 'Departamento'
              : 'Municipio',
          pais: 'Colombia',
          departamento: createdCampaign.department,
          municipio: createdCampaign.city,
          nombreCandidato: createdCampaign.candidateName
        }));
      } catch {
        // La jurisdicción maestra ya quedó guardada aunque no exista un dossier previo.
      }
      window.dispatchEvent(new CustomEvent('campaign-jurisdiction-changed', { detail: activeJurisdiction }));
      window.dispatchEvent(new Event('candidate_name_updated'));
      window.dispatchEvent(new Event('storage'));
      setShowCreateModal(false);
      setEditingCampaign(null);
      setShowAccessPassword(false);
      setFormData({
        name: '',
        candidateName: '',
        type: 'Alcaldía',
        department: 'Antioquia',
        city: firstMunicipality('Antioquia'),
        budgetLimitCop: 0,
        adminManager: '',
        accessEmail: '',
        accessPassword: '',
        accessPasswordConfirm: '',
        isDemo: false,
        demoDays: 5
      });
      setSuccessMsg(`Campaña "${formData.name}" y usuario ${formData.accessEmail} creados exitosamente.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      if (createdCampaign) {
        try { await GlobalAdminService.deleteCampaign(createdCampaign.id); } catch { /* Mantener el error original. */ }
      }
      setError(err.message || 'Error al crear campaña');
    } finally {
      setCreating(false);
    }
  };

  const openEditCampaign = (campaign: GlobalAdminCampaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      candidateName: campaign.candidateName,
      type: campaign.type,
      department: campaign.department,
      city: campaign.city,
      budgetLimitCop: campaign.budgetLimitCop,
      adminManager: campaign.adminManager,
      accessEmail: '',
      accessPassword: '',
      accessPasswordConfirm: '',
      isDemo: Boolean(campaign.isDemo),
      demoDays: 5
    });
    setError(null);
    setShowCreateModal(true);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      setCreating(true);
      await GlobalAdminService.deleteCampaignAndUsers(campaignToDelete.id);
      setCampaignToDelete(null);
      setError(null);
      setSuccessMsg('La campaña y sus accesos fueron eliminados correctamente.');
      window.dispatchEvent(new Event('global-admin-users-changed'));
      window.dispatchEvent(new CustomEvent('platform-data-changed', {
        detail: { table: 'campaigns', eventType: 'DELETE' }
      }));
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar campaña');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (campaign: GlobalAdminCampaign, newStatus: GlobalAdminCampaign['status']) => {
    try {
      await GlobalAdminService.updateCampaignStatus(campaign.id, newStatus);
      setSuccessMsg(`Estado de "${campaign.name}" actualizado a ${newStatus}.`);
      window.dispatchEvent(new Event('global-admin-users-changed'));
      window.dispatchEvent(new CustomEvent('platform-data-changed', {
        detail: { table: 'campaigns', eventType: 'UPDATE' }
      }));
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado');
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.candidateName.toLowerCase().includes(search.toLowerCase()) ||
    c.city.toLowerCase().includes(search.toLowerCase()) ||
    c.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-md">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white font-mono flex items-center gap-2">
            <Flag className="w-5 h-5 text-cyan-400" />
            ADMINISTRACIÓN DE CAMPAÑAS ELECTORALES
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Supervisión multi-inquilino de campañas activas, techos presupuestales CNE y cobertura territorial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
          <button
            onClick={() => {
              setEditingCampaign(null);
              setFormData({
                name: '',
                candidateName: '',
                type: 'Alcaldía',
                department: 'Antioquia',
                city: firstMunicipality('Antioquia'),
                budgetLimitCop: 0,
                adminManager: '',
                accessEmail: '',
                accessPassword: '',
                accessPasswordConfirm: '',
                isDemo: false,
                demoDays: 5
              });
              setShowAccessPassword(false);
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-semibold shadow-lg shadow-cyan-900/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Campaña</span>
            <kbd className="hidden rounded border border-cyan-300/30 bg-cyan-950/40 px-1.5 py-0.5 text-[9px] text-cyan-100 lg:inline">Ctrl N</kbd>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Filter and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 backdrop-blur-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campaña por nombre, candidato, departamento o municipio..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <kbd className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] text-slate-500 sm:block">Ctrl K</kbd>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('list')}
            title="Vista en Lista"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'list'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Vista en Tarjetas"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'grid'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tarjetas</span>
          </button>
        </div>
      </div>

      {/* Campaigns View (List or Grid) */}
      {viewMode === 'list' ? (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800/80 bg-slate-950/70 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3.5 px-4 whitespace-nowrap">CAMPAÑA / CÓDIGO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">CANDIDATO & CARGO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">UBICACIÓN</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">PRESUPUESTO CNE</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">ESTADO</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">CREADA</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[340px]">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-sans text-xs">
                      No se encontraron campañas que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="text-white font-bold text-sm block tracking-tight">{camp.name}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] bg-slate-950 text-cyan-300 font-mono px-2 py-0.5 rounded border border-slate-800">
                              {camp.code}
                            </span>
                            {camp.isDemo && (
                              <span className="rounded border border-violet-500/40 bg-violet-950/70 px-2 py-0.5 text-[10px] font-bold text-violet-300 whitespace-nowrap">
                                DEMO · vence {camp.demoExpiresAt ? new Date(camp.demoExpiresAt).toLocaleString('es-CO') : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <span className="text-slate-200 font-semibold block">{camp.candidateName}</span>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <Vote className="w-3 h-3 text-cyan-400" /> {camp.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{camp.city}, {camp.department}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px] whitespace-nowrap">
                          <div className="text-slate-200 font-semibold flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>${(camp.budgetLimitCop / 1000000).toFixed(0)}M COP</span>
                          </div>
                          <div className="text-slate-400 text-[10px]">
                            <span>Tope Oficial Ley 1475</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          camp.status === 'Activa'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                            : camp.status === 'En Pausa'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {camp.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                          {camp.status === 'Activa' ? (
                            <button
                              onClick={() => handleToggleStatus(camp, 'En Pausa')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-amber-950/30 cursor-pointer"
                              title="Pausar campaña"
                            >
                              <PauseCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              <span>Pausar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(camp, 'Activa')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-emerald-950/30 cursor-pointer"
                              title="Activar campaña"
                            >
                              <PlayCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              <span>Activar</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEditCampaign(camp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-cyan-950/30 cursor-pointer"
                            title="Modificar datos de la campaña"
                          >
                            <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                            <span>Editar</span>
                          </button>
                          {camp.status !== 'Finalizada' && (
                            <button
                              onClick={() => handleToggleStatus(camp, 'Finalizada')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-black/30 cursor-pointer"
                              title="Finalizar campaña"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              <span>Finalizar</span>
                            </button>
                          )}
                          <button
                            onClick={() => setCampaignToDelete(camp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-rose-950/30 cursor-pointer"
                            title="Eliminar campaña y accesos"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                            <span>Eliminar</span>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((camp) => (
            <div
              key={camp.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-slate-950 text-cyan-300 font-mono px-2 py-0.5 rounded border border-slate-800">{camp.code}</span>
                    {camp.isDemo && (
                      <span className="rounded border border-violet-500/40 bg-violet-950/70 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                        DEMO · vence {camp.demoExpiresAt ? new Date(camp.demoExpiresAt).toLocaleString('es-CO') : ''}
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                    camp.status === 'Activa'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                      : camp.status === 'En Pausa'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {camp.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1 tracking-tight font-sans">{camp.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mb-3 font-sans">
                  <Vote className="w-3.5 h-3.5 text-cyan-400" />
                  Candidato: <strong className="text-slate-200">{camp.candidateName}</strong> ({camp.type})
                </p>

                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2 text-xs mb-4 font-sans">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> Ubicación</span>
                    <span className="text-slate-200 font-medium">{camp.city}, {camp.department}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Presupuesto / Tope CNE</span>
                    <span className="text-slate-200 font-semibold">${(camp.budgetLimitCop / 1000000).toFixed(0)}M COP</span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-800/80 flex flex-col gap-2.5 font-sans">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Creada: {new Date(camp.createdAt).toLocaleDateString()}</span>
                  <span>{camp.status}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {camp.status === 'Activa' ? (
                    <button
                      onClick={() => handleToggleStatus(camp, 'En Pausa')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-amber-950/30 cursor-pointer"
                      title="Pausar campaña"
                    >
                      <PauseCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>Pausar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(camp, 'Activa')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-emerald-950/30 cursor-pointer"
                      title="Activar campaña"
                    >
                      <PlayCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>Activar</span>
                    </button>
                  )}
                  <button
                    onClick={() => openEditCampaign(camp)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-cyan-950/30 cursor-pointer"
                    title="Modificar datos de la campaña"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>Editar</span>
                  </button>
                  {camp.status !== 'Finalizada' && (
                    <button
                      onClick={() => handleToggleStatus(camp, 'Finalizada')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-black/30 cursor-pointer"
                      title="Finalizar campaña"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>Finalizar</span>
                    </button>
                  )}
                  <button
                    onClick={() => setCampaignToDelete(camp)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-medium whitespace-nowrap transition-all active:scale-95 shadow-sm shadow-rose-950/30 cursor-pointer"
                    title="Eliminar campaña y accesos"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 lg:p-8 shadow-2xl font-mono text-xs">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-400" />
              {editingCampaign ? 'MODIFICAR CAMPAÑA ELECTORAL' : 'REGISTRAR NUEVA CAMPAÑA ELECTORAL'}
            </h3>
            <p className="text-slate-400 mb-4">
              {editingCampaign ? 'Actualiza los datos, la jurisdicción y el presupuesto de la campaña.' : 'Crea un espacio de campaña aislado con asignación de presupuesto y territorio.'}
            </p>

            <form onSubmit={handleCreateCampaign} className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              <div>
                <label className="block text-slate-300 mb-1">Nombre de la Campaña</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Campaña Municipal 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {!editingCampaign && <div className="rounded-xl border border-cyan-500/25 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/60 p-2 text-cyan-300">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Acceso del propietario de la campaña</h4>
                    <p className="text-[10px] leading-relaxed text-slate-400">Estas credenciales permitirán ingresar al software. La contraseña se almacena cifrada exclusivamente en Supabase Auth.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Correo / usuario de acceso</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={formData.accessEmail}
                      onChange={(e) => setFormData({ ...formData, accessEmail: e.target.value.trimStart().toLowerCase() })}
                      placeholder="propietario@campana.com"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-3 text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 mb-1">Contraseña temporal</label>
                    <div className="relative">
                      <input
                        type={showAccessPassword ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        value={formData.accessPassword}
                        onChange={(e) => setFormData({ ...formData, accessPassword: e.target.value })}
                        placeholder="Mínimo 10 caracteres"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 pr-10 text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessPassword((value) => !value)}
                        aria-label={showAccessPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:text-cyan-300"
                      >
                        {showAccessPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Confirmar contraseña</label>
                    <input
                      type={showAccessPassword ? 'text' : 'password'}
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={formData.accessPasswordConfirm}
                      onChange={(e) => setFormData({ ...formData, accessPasswordConfirm: e.target.value })}
                      placeholder="Repita la contraseña"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-violet-200">
                    <input
                      type="checkbox"
                      checked={formData.isDemo}
                      onChange={(e) => setFormData({ ...formData, isDemo: e.target.checked })}
                      className="h-4 w-4 accent-violet-500"
                    />
                    <span className="font-bold">Crear como cuenta demo temporal</span>
                  </label>
                  {formData.isDemo && (
                    <div className="mt-3">
                      <label className="mb-1 block text-slate-300">Duración de la prueba (máximo 5 días)</label>
                      <select
                        value={formData.demoDays}
                        onChange={(e) => setFormData({ ...formData, demoDays: Math.min(5, Math.max(1, Number(e.target.value))) })}
                        className="w-full rounded-lg border border-violet-500/30 bg-slate-950 px-3 py-2.5 text-violet-200 outline-none focus:border-violet-400"
                      >
                        {[1, 2, 3, 4, 5].map((days) => <option key={days} value={days}>{days} {days === 1 ? 'día' : 'días'}</option>)}
                      </select>
                      <p className="mt-2 text-[10px] leading-relaxed text-rose-300">
                        Al vencer se eliminarán automáticamente la campaña, el usuario y todos los datos relacionados. Esta acción no se puede deshacer.
                      </p>
                    </div>
                  )}
                </div>
              </div>}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Nombre del Candidato</label>
                  <input
                    type="text"
                    required
                    value={formData.candidateName}
                    onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                    placeholder="Ej: Dr. Santiago Vallejo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Tipo de Elección</label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const type = e.target.value as GlobalAdminCampaign['type'];
                      setFormData({ ...formData, type, ...territoryForType(type) });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Alcaldía">Alcaldía</option>
                    <option value="Gobernación">Gobernación</option>
                    <option value="Concejo">Concejo</option>
                    <option value="Asamblea">Asamblea</option>
                    <option value="Senado">Senado</option>
                    <option value="Cámara">Cámara</option>
                    <option value="Presidencia">Presidencia</option>
                  </select>
                </div>
              </div>

              {jurisdictionLevel(formData.type) === 'NACIONAL' ? (
                <div>
                  <label className="block text-slate-300 mb-1">País / Jurisdicción</label>
                  <select
                    value="Colombia"
                    disabled
                    className="w-full bg-slate-950 border border-cyan-700/60 rounded-lg px-3 py-2 text-cyan-200 disabled:opacity-100"
                  >
                    <option value="Colombia">Colombia — Cobertura nacional</option>
                  </select>
                </div>
              ) : (
                <div className={`grid ${jurisdictionLevel(formData.type) === 'MUNICIPAL' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  <div>
                    <label className="block text-slate-300 mb-1">Departamento</label>
                    <select
                      required
                      value={formData.department}
                      onChange={(e) => {
                        const department = e.target.value;
                        setFormData({
                          ...formData,
                          department,
                          city: jurisdictionLevel(formData.type) === 'MUNICIPAL'
                            ? firstMunicipality(department)
                            : 'Todo el departamento'
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                    >
                      {DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>

                  {jurisdictionLevel(formData.type) === 'MUNICIPAL' && (
                    <div>
                      <label className="block text-slate-300 mb-1">Municipio / Ciudad</label>
                      <select
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                      >
                        {(colombiaTerritorialData[formData.department] || []).map((municipality) => (
                          <option key={municipality} value={municipality}>{municipality}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-cyan-200">
                <span className="font-bold">Jurisdicción que se aplicará al software: </span>
                {jurisdictionLevel(formData.type) === 'NACIONAL'
                  ? 'Colombia'
                  : jurisdictionLevel(formData.type) === 'DEPARTAMENTAL'
                    ? formData.department
                    : `${formData.city}, ${formData.department}`}
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Techo Presupuestal CNE (COP)</label>
                <div className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 transition-all focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Techo presupuestal CNE en pesos colombianos"
                    value={formatCop(formData.budgetLimitCop)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const value = digits ? Number(digits) : 0;
                      setFormData({ ...formData, budgetLimitCop: Number.isSafeInteger(value) ? value : formData.budgetLimitCop });
                    }}
                    className="w-full bg-transparent py-3 pl-8 pr-16 text-base font-bold tracking-wide text-white outline-none placeholder:text-slate-600"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2 py-1 text-[10px] font-bold tracking-wider text-cyan-300">
                    COP
                  </span>
                </div>
                <p className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Ingrese el límite autorizado por el CNE</span>
                  <span className="font-semibold text-slate-400">${formatCop(formData.budgetLimitCop)} COP</span>
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800 lg:col-span-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingCampaign(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating
                    ? (editingCampaign ? 'Guardando cambios…' : 'Creando campaña y acceso…')
                    : (editingCampaign ? 'Guardar Cambios' : 'Guardar Campaña y Crear Acceso')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {campaignToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-rose-950 p-3 text-rose-400"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-white">Eliminar campaña definitivamente</h3>
                <p className="text-xs text-slate-400">Esta acción requiere confirmación.</p>
              </div>
            </div>
            <p className="rounded-xl border border-rose-500/20 bg-rose-950/30 p-3 text-sm text-rose-200">
              Se eliminará <strong>{campaignToDelete.name}</strong> y todos sus usuarios de acceso vinculados. Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={creating} onClick={() => setCampaignToDelete(null)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300">Cancelar</button>
              <button disabled={creating} onClick={handleDeleteCampaign} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {creating ? 'Eliminando…' : 'Sí, eliminar campaña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
