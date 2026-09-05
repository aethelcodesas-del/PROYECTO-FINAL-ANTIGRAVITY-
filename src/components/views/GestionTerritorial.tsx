import React, { lazy, Suspense, useState } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { motion, AnimatePresence } from 'motion/react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { ViewMode, TerritorialZone, AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';
const RegistroVotantesView = lazy(() => import('./RegistroVotantesView').then(module => ({ default: module.RegistroVotantesView })));
import { 
  Search, 
  Filter, 
  ChevronDown, 
  MapPin, 
  Plus, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Users, 
  CheckCircle, 
  WifiOff, 
  RotateCw,
  Globe,
  Bell,
  Settings,
  Edit3,
  Target,
  Award,
  X,
  Trash2,
  UserCheck,
  ShieldCheck,
  SearchCheck
} from 'lucide-react';

interface GestionTerritorialProps {
  onSelectView: (view: ViewMode) => void;
  zones: TerritorialZone[];
  onOpenFieldRegistrationModal: () => void;
  initialSubTab?: 'registro' | 'mapa';
  onSubTabChange?: (subTab: 'registro' | 'mapa') => void;
  authUser?: AuthUser | null;
}

const FitRealMapBounds: React.FC<{ points: Array<{ lat: number; lng: number }> }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points.map(point => [point.lat, point.lng] as [number, number]), { padding: [36, 36], maxZoom: 15 });
    }
  }, [map, points]);
  return null;
};

export const GestionTerritorial: React.FC<GestionTerritorialProps> = ({
  onSelectView,
  zones,
  onOpenFieldRegistrationModal,
  initialSubTab = 'registro',
  onSubTabChange,
  authUser
}) => {
  // ── Datos de campaña desde contexto global (circunscripción real) ────────────
  const campaignCtx = useCampaignData();
  // ───────────────────────────────────────────────────────────────────────────
  const [sectorList, setSectorList] = useState<TerritorialZone[]>([]);

  const [selectedZone, setSelectedZone] = useState<TerritorialZone | null>(sectorList[1] || sectorList[0] || null);
  const [activeSubTab, setActiveSubTab] = useState<'registro' | 'mapa'>(initialSubTab);
  const [realStats, setRealStats] = useState({
    leaders: 0,
    voters: 0,
    voteGoal: 0,
    witnesses: 0,
    accreditedWitnesses: 0,
    completedSurveys: 0,
  });
  const [realMapPoints, setRealMapPoints] = useState<Array<{ id: string; lat: number; lng: number }>>([]);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  React.useEffect(() => {
    if (activeSubTab !== 'mapa') return;
    let mounted = true;
    let clientId = '';

    const loadRealTerritorialData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
      clientId = String(profile?.client_id || '');
      if (!clientId) return;
      const rememberedCampaignId = localStorage.getItem('active_campaign_id');
      const validRememberedCampaignId = rememberedCampaignId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rememberedCampaignId)
        ? rememberedCampaignId
        : '';
      let campaignQuery = supabase.from('campaigns').select('id,meta_votos');
      campaignQuery = validRememberedCampaignId ? campaignQuery.eq('id', validRememberedCampaignId) : campaignQuery.eq('client_id', clientId);
      const [campaignResult, leadersResult, votersResult, witnessesResult, surveysResult] = await Promise.all([
        campaignQuery.order('updated_at', { ascending: false }).limit(1),
        supabase.from('leaders').select('id,comuna').eq('client_id', clientId).eq('status', 'ACTIVE'),
        supabase.from('voters').select('id,comuna').eq('client_id', clientId).eq('status', 'ACTIVE'),
        supabase.from('witnesses').select('id,estado,zona,municipio').eq('client_id', clientId).neq('estado', 'INACTIVO'),
        supabase.from('survey_responses').select('id,latitude,longitude').eq('client_id', clientId),
      ]);
      if (!mounted) return;
      const leaders = leadersResult.data || [];
      const voters = votersResult.data || [];
      const witnesses = witnessesResult.data || [];
      const voteGoal = Number(campaignResult.data?.[0]?.meta_votos || 0);
      const accreditedWitnesses = witnesses.filter((item: any) => ['ACREDITADO', 'EN_MESA'].includes(String(item.estado))).length;
      setRealStats({
        leaders: leaders.length,
        voters: voters.length,
        voteGoal,
        witnesses: witnesses.length,
        accreditedWitnesses,
        completedSurveys: (surveysResult.data || []).length,
      });
      setRealMapPoints((surveysResult.data || [])
        .map((item: any) => ({ id: String(item.id), lat: Number(item.latitude), lng: Number(item.longitude) }))
        .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat !== 0 && point.lng !== 0));

      const grouped = new Map<string, { leaders: number; voters: number; witnesses: number }>();
      const ensure = (name: string) => {
        const key = name.trim() || 'Sin sector asignado';
        if (!grouped.has(key)) grouped.set(key, { leaders: 0, voters: 0, witnesses: 0 });
        return grouped.get(key)!;
      };
      leaders.forEach((item: any) => { ensure(String(item.comuna || '')).leaders += 1; });
      voters.forEach((item: any) => { ensure(String(item.comuna || '')).voters += 1; });
      witnesses.forEach((item: any) => { ensure(String(item.zona || item.municipio || '')).witnesses += 1; });
      const entries = [...grouped.entries()];
      setSectorList(entries.map(([nombre, value], index) => {
        const metaVotos = entries.length && voteGoal ? Math.round(voteGoal / entries.length) : 0;
        return {
          id: `real-${index}-${nombre}`,
          nombre,
          lideres: value.leaders,
          votantes: value.voters,
          cobertura: metaVotos ? Math.min(100, Math.round(value.voters * 100 / metaVotos)) : 0,
          heatValue: value.voters,
          coordenadas: { x: 18 + (index % 4) * 22, y: 25 + Math.floor(index / 4) * 24 },
          testigosActivos: value.witnesses,
          testigosFaltantes: 0,
          metaVotos,
        };
      }));
    };

    void loadRealTerritorialData();
    const channel = supabase.channel('gestion-territorial-real')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaders' }, () => void loadRealTerritorialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => void loadRealTerritorialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'witnesses' }, () => void loadRealTerritorialData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_responses' }, () => void loadRealTerritorialData())
      .subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [activeSubTab]);

  const handleSubTabSelect = (tab: 'registro' | 'mapa') => {
    setActiveSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Intención de Voto');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Edit Sector Modal state
  const [editingSector, setEditingSector] = useState<TerritorialZone | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editMetaVotos, setEditMetaVotos] = useState<number | string>('');
  const [editLideres, setEditLideres] = useState<number | string>('');
  const [editVotantes, setEditVotantes] = useState<number | string>('');

  // New Sector Modal state
  const [showAddSectorModal, setShowAddSectorModal] = useState<boolean>(false);
  const [newSectorName, setNewSectorName] = useState<string>('');
  const [newSectorMetaVotos, setNewSectorMetaVotos] = useState<number | string>(50000);

  const filteredSectorList = sectorList.filter(z => 
    z.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const coveragePercent = realStats.voteGoal
    ? Math.min(100, Math.round(realStats.voters * 100 / realStats.voteGoal))
    : 0;
  const witnessTrainingPercent = realStats.witnesses
    ? Math.round(realStats.accreditedWitnesses * 100 / realStats.witnesses)
    : 0;

  React.useEffect(() => {
    setSelectedZone(current => {
      if (current && sectorList.some(item => item.id === current.id)) return current;
      return sectorList[0] || null;
    });
  }, [sectorList]);

  const handleOpenEditModal = (sector: TerritorialZone) => {
    setEditingSector(sector);
    setEditName(sector.nombre);
    setEditMetaVotos(sector.metaVotos || Math.round(sector.votantes * 1.25));
    setEditLideres(sector.lideres);
    setEditVotantes(sector.votantes);
  };

  const handleSaveSector = () => {
    if (!editingSector) return;
    const numMeta = typeof editMetaVotos === 'number' ? editMetaVotos : parseInt(editMetaVotos as string) || 0;
    const numLideres = typeof editLideres === 'number' ? editLideres : parseInt(editLideres as string) || 0;
    const numVotantes = typeof editVotantes === 'number' ? editVotantes : parseInt(editVotantes as string) || 0;

    const newNombre = editName.trim() || editingSector.nombre;
    const newCobertura = numMeta > 0 ? Math.min(100, Math.round((numVotantes / numMeta) * 100)) : editingSector.cobertura;

    setSectorList(prev => prev.map(s => {
      if (s.id !== editingSector.id) return s;
      return {
        ...s,
        nombre: newNombre,
        metaVotos: numMeta,
        lideres: numLideres,
        votantes: numVotantes,
        cobertura: newCobertura
      };
    }));

    if (selectedZone && selectedZone.id === editingSector.id) {
      setSelectedZone({
        ...selectedZone,
        nombre: newNombre,
        metaVotos: numMeta,
        lideres: numLideres,
        votantes: numVotantes,
        cobertura: newCobertura
      });
    }

    setEditingSector(null);
  };

  const handleDeleteSector = (sectorId: string) => {
    const target = sectorList.find(s => s.id === sectorId);
    if (!target) return;
    if (!window.confirm(`¿Está seguro de eliminar el sector "${target.nombre}"?`)) return;

    setSectorList(prev => {
      const remaining = prev.filter(s => s.id !== sectorId);
      if (remaining.length > 0 && selectedZone?.id === sectorId) {
        setSelectedZone(remaining[0]);
      } else if (remaining.length === 0) {
        setSelectedZone(null);
      }
      return remaining;
    });
    setEditingSector(null);
  };

  const handleAddSectorSubmit = () => {
    if (!newSectorName.trim()) return;
    const numMeta = typeof newSectorMetaVotos === 'number' ? newSectorMetaVotos : parseInt(newSectorMetaVotos as string) || 50000;
    
    const newZone: TerritorialZone = {
      id: `z_${Date.now()}`,
      nombre: newSectorName.trim(),
      lideres: 0,
      votantes: 0,
      cobertura: 0,
      heatValue: 0,
      coordenadas: { x: 50, y: 50 },
      testigosActivos: 0,
      testigosFaltantes: 0,
      metaVotos: numMeta
    };

    setSectorList(prev => [...prev, newZone]);
    setSelectedZone(newZone);
    setShowAddSectorModal(false);
    setNewSectorName('');
    setNewSectorMetaVotos(50000);
  };

  return (
    <div className="responsive-view min-h-[calc(100dvh-60px)] w-full min-w-0 bg-[#020712] text-white p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden">
      {activeSubTab === 'registro' ? (
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" /></div>}>
        <RegistroVotantesView onSelectView={onSelectView} authUser={authUser} />
        </Suspense>
      ) : (
        <>
          {/* Main Grid Layout matching Image 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT SIDEBAR: Stats & Indicators (Navy Cards) */}
        <div className="functional-grid lg:col-span-4 space-y-4">
          
          {/* Card 1: Líderes y Votantes */}
          <div className="functional-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3">
            <h3 className="text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2 flex items-center justify-between">
              <span>Líderes y Votantes</span>
              <Users className="w-4 h-4 text-teal-400" />
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Líderes:</span>
                <span className="font-extrabold text-white">{realStats.leaders.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Votantes:</span>
                <span className="font-extrabold text-white">{realStats.voters.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-slate-300 mb-1">
                <span>Porcentaje de Cobertura:</span>
                <span className="text-teal-400 font-bold">{coveragePercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${coveragePercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Card 2: Operación Electoral */}
          <div className="functional-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3">
            <h3 className="text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2">
              Operación Electoral
            </h3>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1.5 text-xs">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Estado de Testigos</p>
                <div>
                  <p className="text-[11px] text-slate-300">Testigos Registrados:</p>
                  <p className="text-base font-bold text-white">{realStats.witnesses.toLocaleString('es-CO')}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-300">Faltantes:</p>
                  <p className="text-sm font-bold text-rose-400">{Math.max(0, realStats.witnesses - realStats.accreditedWitnesses).toLocaleString('es-CO')}</p>
                </div>
              </div>

              {/* Radial Capacitación Ring */}
              <div className="flex flex-col items-center justify-center p-1">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray={`${witnessTrainingPercent}, 100`}
                    />
                  </svg>
                  <span className="absolute font-extrabold text-xs text-white">{witnessTrainingPercent}%</span>
                </div>
                <span className="text-[10px] text-teal-300 mt-1 font-medium">Capacitación</span>
              </div>
            </div>
          </div>

          {/* Card 3: Investigación Electoral */}
          <div className="functional-card bg-[#0b1b36] text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3">
            <h3 className="text-sm font-bold tracking-wide text-white border-b border-slate-700/60 pb-2">
              Investigación Electoral
            </h3>

            <div className="space-y-1.5 text-xs">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Progreso de Encuestas</p>
              <div className="flex justify-between">
                <span className="text-slate-300">Encuestas Completadas:</span>
                <span className="font-bold text-white">{realStats.completedSurveys.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Encuestas en Proceso:</span>
                <span className="font-bold text-amber-400">0</span>
              </div>
            </div>

            {/* Avance Semanal mini chart */}
            <div>
              <p className="text-[10px] text-slate-400 font-semibold mb-1">Avance Semanal</p>
              <div className="h-10 flex items-end justify-between gap-1 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
                {[0, 0, 0, 0, 0, realStats.completedSurveys ? 100 : 0].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-teal-600 to-emerald-400 rounded-t"
                    style={{ height: `${h}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating Green Button matching Image 4 bottom left */}
          <button
            onClick={onOpenFieldRegistrationModal}
            className="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black px-4 py-3 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="text-xs">Registro en Campo (Offline Ready)</span>
            </div>
            <WifiOff className="w-4 h-4 text-slate-800" />
          </button>

        </div>

        {/* RIGHT MAIN AREA: Interactive Heatmap Stage */}
        <div className="lg:col-span-8 bg-[#030d1d] rounded-3xl border border-cyan-500/20 p-4 shadow-xl relative flex flex-col justify-between min-h-[520px] overflow-hidden">
          
          {/* Map Title Overlay */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 z-10">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-400" />
              Mapa de Calor de Intención de Voto - Cobertura Territorial
            </h3>
          </div>

          <div className="relative flex-1 my-3 min-h-[420px] rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
            <MapContainer
              center={[4.5709, -74.2973]}
              zoom={5}
              className="h-full min-h-[420px] w-full"
              preferCanvas
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitRealMapBounds points={realMapPoints} />
              {realMapPoints.map(point => (
                <CircleMarker
                  key={point.id}
                  center={[point.lat, point.lng]}
                  radius={9}
                  pathOptions={{ color: '#22d3ee', fillColor: '#14b8a6', fillOpacity: 0.55, weight: 2 }}
                >
                  <Popup>
                    <strong>Respuesta territorial registrada</strong><br />
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
            {realMapPoints.length === 0 && (
              <div className="absolute inset-x-4 bottom-4 z-[500] rounded-xl bg-slate-950/90 border border-cyan-500/30 px-4 py-3 text-center text-xs text-slate-300 pointer-events-none">
                Aún no existen registros reales con coordenadas GPS para generar el mapa de calor.
              </div>
            )}
          </div>

          {/* Selected Zone Quick Detail Bar */}
          {selectedZone && (
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">{selectedZone.nombre}</h4>
                  <p className="text-[11px] text-slate-400">
                    Líderes: <span className="text-teal-300 font-semibold">{selectedZone.lideres}</span> • Votantes: <span className="text-teal-300 font-semibold">{selectedZone.votantes.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-teal-950 text-teal-300 border border-teal-500/40 px-2.5 py-1 rounded-full font-bold">
                  Cobertura {selectedZone.cobertura}%
                </span>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* Sectores derived from real campaign records */}
      <div className="bg-[#0b1b36] border border-slate-800/90 text-white rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-400" />
              Sectores Territoriales y Metas de Votos
            </h3>
          </div>

        </div>

        {/* Grid de Tarjetas de Sector */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSectorList.map((sector, idx) => {
            const meta = sector.metaVotos ?? 0;
            const porcentajeMeta = meta > 0 ? Math.min(100, Math.round((sector.votantes / meta) * 100)) : 0;
            const isSelected = selectedZone?.id === sector.id;

            return (
              <motion.div
                key={sector.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className={`bg-[#051325] border ${
                  isSelected ? 'border-teal-500/70 ring-1 ring-teal-500/30' : 'border-slate-800 hover:border-slate-700'
                } rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all shadow-md group`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-500/30 px-2 py-0.5 rounded-md inline-block">
                      Sector / Zona
                    </span>
                    <h4 className="font-extrabold text-sm text-white leading-tight group-hover:text-teal-300 transition-colors">
                      {sector.nombre}
                    </h4>
                  </div>

                </div>

                {/* Progress Bar Meta de Votos */}
                <div className="bg-[#081b33] border border-slate-800/80 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-400" /> Meta de Votos:
                    </span>
                    <strong className="text-amber-300 font-black text-xs">
                      {meta.toLocaleString()}
                    </strong>
                  </div>

                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${porcentajeMeta}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        porcentajeMeta >= 80
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          : porcentajeMeta >= 50
                          ? 'bg-gradient-to-r from-amber-500 to-teal-400'
                          : 'bg-gradient-to-r from-rose-500 to-amber-400'
                      }`}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Votantes: <strong className="text-white">{sector.votantes.toLocaleString()}</strong></span>
                    <span className="font-extrabold text-teal-400">{porcentajeMeta}% de la meta</span>
                  </div>
                </div>

                {/* Métricas secundarias */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#08192e] p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Líderes</p>
                      <p className="font-bold text-white">{sector.lideres}</p>
                    </div>
                  </div>

                  <div className="bg-[#08192e] p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Cobertura</p>
                      <p className="font-bold text-emerald-300">{sector.cobertura}%</p>
                    </div>
                  </div>
                </div>

                {/* Acción para enfocar mapa */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedZone(sector)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-[#081d38] hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {isSelected ? '✓ Seleccionado en Mapa' : 'Ver en Mapa de Calor'}
                </motion.button>
              </motion.div>
            );
          })}
          {filteredSectorList.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-700 bg-[#051325] p-8 text-center text-sm text-slate-400">
              No existen sectores reales. Se crearán automáticamente cuando se registren líderes o votantes con comuna o zona asignada.
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* MODAL PARA EDITAR SECTOR */}
      <AnimatePresence>
        {editingSector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#05162a] border border-teal-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 text-xs shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-300">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm">Editar Sector Territorial</h4>
                    <p className="text-[11px] text-slate-400">Modifique el nombre o ajuste la meta de votos</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSector(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Nombre del Sector / Zona:
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ej: Zona Norte / Santa Ana"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Meta de Votos Objetivo:</span>
                    <span className="text-[11px] text-teal-400 font-semibold">
                      {typeof editMetaVotos === 'number' ? editMetaVotos.toLocaleString() : editMetaVotos} votos
                    </span>
                  </label>
                  <input
                    type="number"
                    value={editMetaVotos}
                    onChange={(e) => setEditMetaVotos(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 100000"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permite reajustar el techo u objetivo proyectado de votos en este sector territorial.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      Líderes Asignados:
                    </label>
                    <input
                      type="number"
                      value={editLideres}
                      onChange={(e) => setEditLideres(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      Votantes Registrados:
                    </label>
                    <input
                      type="number"
                      value={editVotantes}
                      onChange={(e) => setEditVotantes(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteSector(editingSector.id)}
                  className="py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Eliminar Sector"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSector(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSector}
                    className="py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CREAR SECTOR */}
      <AnimatePresence>
        {showAddSectorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="bg-[#05162a] border border-teal-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 text-xs shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-300">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm">Crear Nuevo Sector Territorial</h4>
                    <p className="text-[11px] text-slate-400">Registre un nuevo sector con su meta de votos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddSectorModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nombre del Sector:</label>
                  <input
                    type="text"
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    placeholder="Ej: Comuna 13 / San Javier"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Meta de Votos Objetivo:</label>
                  <input
                    type="number"
                    value={newSectorMetaVotos}
                    onChange={(e) => setNewSectorMetaVotos(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 50000"
                    className="w-full bg-[#081f3b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddSectorSubmit}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer"
                >
                  Crear Sector
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
