import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ViewMode } from '../../types';
import { supabase } from '../../lib/supabase';
import { isExpectedEmptyCampaignState } from '../../lib/campaignSetupState';
import { 
  Award, 
  Users, 
  MapPin, 
  Building2, 
  Building, 
  Search, 
  Filter, 
  Plus, 
  UserCheck, 
  Locate, 
  AlertTriangle, 
  Compass, 
  Sliders, 
  Crosshair, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  FileCheck, 
  FileSpreadsheet, 
  FileUp, 
  Download, 
  Printer, 
  QrCode, 
  Phone, 
  Mail, 
  Radio, 
  Clock, 
  X, 
  Check, 
  ShieldAlert, 
  FolderGit2, 
  Share2, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  Eye,
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import { 
  getPartidosPrioritariosCandidato, 
  saveCustomPuesto, 
  deleteCustomPuesto, 
  PuestoVotacionInfo,
  normalizeMunicipioName
} from '../../data/puestosVotacionColombia';
import {
  initializeCampaignPollingStations,
  loadCampaignPollingPlaces,
} from '../../services/campaignPollingStationService';

export interface TestigoElectoral {
  id: string;
  cc: string;
  nombre: string;
  telefono: string;
  email: string;
  partido: string;
  rol: 'Testigo de Mesa (E-16)' | 'Testigo Rematador / Coordinador de Puesto' | 'Testigo de Escrutinio Municipal' | 'Testigo de Escrutinio Departamental';
  puesto: string;
  mesa: string;
  comuna: string;
  acreditacion: 'Formulario E-16 Aprobado' | 'Formulario E-16 En Trámite' | 'Rechazado Registraduría';
  geofencing: string;
  estado: 'Acreditado' | 'Inscrito' | 'Pendiente' | 'Inactivo';
  vehiculo?: string;
  observaciones?: string;
}

export interface GpsPingData {
  distanciaMetros: number;
  lat: number;
  lng: number;
  ultimoPing: string;
  bateriaPct: number;
  estadoGPS: 'DENTRO' | 'FUERA' | 'SIN_SIGNAL';
}

export interface GeofenceAlertRecord {
  id: string;
  testigoId: string;
  testigoNombre: string;
  puesto: string;
  distanciaMetros: number;
  hora: string;
  estado: 'Activa' | 'Justificada' | 'Atendida';
}

const STORAGE_TESTIGOS_KEY = 'elecciones_testigos_lista_v2';
const STORAGE_CAMPAIGN_DOSSIER_KEY = 'elecciones_campana_principal_dossier_v2';

interface GestionTestigosProps {
  onSelectView?: (view: ViewMode) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const GestionTestigos: React.FC<GestionTestigosProps> = ({
  onSelectView,
  onNavigateToTab
}) => {
  // -------------------------------------------------------------------------
  // 1. CARGA DE CAMPAÑA & CIRCUNSCRIPCIÓN DEL ASPIRANTE
  // -------------------------------------------------------------------------
  const [campaignDossier, setCampaignDossier] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CAMPAIGN_DOSSIER_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      nombreCandidato: '',
      corporacion: '',
      departamento: '',
      municipio: '',
      circunscripcionTerritorial: '',
      modalidadAval: '',
      partidoUnico: '',
      candidatoPrincipal: {
        nombreCompleto: ''
      }
    };
  });

  const [hasActiveCampaign, setHasActiveCampaign] = useState(true);
  const [customPuestosVersion, setCustomPuestosVersion] = useState(0);

  // Escuchar cambios en la campaña (sincronización en tiempo real)
  useEffect(() => {
    const handleSyncDossier = () => {
      try {
        const saved = localStorage.getItem(STORAGE_CAMPAIGN_DOSSIER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCampaignDossier(parsed);
        }
      } catch (e) {
        console.error('Error syncing campaign dossier in testigos', e);
      }
    };

    handleSyncDossier();
    window.addEventListener('storage', handleSyncDossier);
    return () => window.removeEventListener('storage', handleSyncDossier);
  }, []);

  // -------------------------------------------------------------------------
  // 2. GENERACIÓN DINÁMICA DE PUESTOS Y PARTIDOS SEGÚN LA CIRCUNSCRIPCIÓN
  // -------------------------------------------------------------------------
  const candidateDepartamento = campaignDossier?.departamento || '';
  const candidateMunicipio = normalizeMunicipioName(campaignDossier?.municipio) || '';
  const candidateCircunscripcion = campaignDossier?.circunscripcionTerritorial || '';
  const candidateCorporacion = campaignDossier?.corporacion || '';
  const candidateName = campaignDossier?.candidatoPrincipal?.nombreCompleto || campaignDossier?.nombreCandidato || '';
  const normalizedElectoralScope = `${candidateCircunscripcion} ${candidateCorporacion}`.toUpperCase();
  const activeTerritoryLabel = normalizedElectoralScope.includes('NACIONAL') || normalizedElectoralScope.includes('PRESIDENCIA') || normalizedElectoralScope.includes('SENADO')
    ? 'Colombia'
    : normalizedElectoralScope.includes('DEPARTAMENT') || normalizedElectoralScope.includes('GOBERNACIÓN') || normalizedElectoralScope.includes('GOBERNACION') || normalizedElectoralScope.includes('ASAMBLEA')
      ? candidateDepartamento
      : candidateMunicipio;

  const [campaignPollingPlaces, setCampaignPollingPlaces] = useState<PuestoVotacionInfo[]>([]);
  const puestosTerritorioOpt = campaignPollingPlaces;

  // Partidos prioritarios calculados según avales y coalición del candidato
  const partidosPoliticosOpt = useMemo(() => {
    return getPartidosPrioritariosCandidato(campaignDossier);
  }, [campaignDossier]);

  // -------------------------------------------------------------------------
  // 3. PERSISTENCIA DE TESTIGOS ELECTORALES
  // -------------------------------------------------------------------------
  const [testigos, setTestigos] = useState<TestigoElectoral[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TESTIGOS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading witnesses from storage', e);
    }

    // Default starts clean from zero for real campaign usage
    return [];
  });
  const [witnessClientId, setWitnessClientId] = useState<string | null>(null);
  const [witnessLoading, setWitnessLoading] = useState(true);
  const [witnessSaving, setWitnessSaving] = useState(false);
  const [witnessSyncError, setWitnessSyncError] = useState('');
  const registeredWitnessParties = useMemo(
    () => [...new Set(testigos.map(testigo => testigo.partido?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es')),
    [testigos]
  );

  // Sincronizar testigos a localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TESTIGOS_KEY, JSON.stringify(testigos));
    } catch (e) {
      console.error('Error saving witnesses to storage', e);
    }
  }, [testigos]);

  const databaseStatusFor = (status: TestigoElectoral['estado']) =>
    status === 'Acreditado' ? 'ACREDITADO' : status === 'Inactivo' ? 'INACTIVO' : status === 'Inscrito' ? 'CAPACITADO' : 'PENDIENTE';

  const witnessPayload = (witness: Omit<TestigoElectoral, 'id'> | TestigoElectoral) => ({
    client_id: witnessClientId,
    nombre: witness.nombre,
    cedula: witness.cc,
    telefono: witness.telefono || null,
    email: witness.email || null,
    municipio: candidateMunicipio,
    zona: witness.comuna,
    puesto: witness.puesto,
    mesa: witness.mesa,
    estado: databaseStatusFor(witness.estado),
    observaciones: JSON.stringify({
      witnessMeta: {
        partido: witness.partido,
        rol: witness.rol,
        acreditacion: witness.acreditacion,
        geofencing: witness.geofencing,
        vehiculo: witness.vehiculo || '',
        nota: witness.observaciones || ''
      }
    }),
    updated_at: new Date().toISOString()
  });

  const mapDatabaseWitness = (row: any): TestigoElectoral => {
    let metadata: any = {};
    try { metadata = JSON.parse(row.observaciones || '{}')?.witnessMeta || {}; } catch { metadata = {}; }
    const status: TestigoElectoral['estado'] = row.estado === 'ACREDITADO' || row.estado === 'EN_MESA'
      ? 'Acreditado' : row.estado === 'INACTIVO' ? 'Inactivo' : row.estado === 'CAPACITADO' ? 'Inscrito' : 'Pendiente';
    return {
      id: row.id,
      cc: row.cedula,
      nombre: row.nombre,
      telefono: row.telefono || '',
      email: row.email || '',
      partido: metadata.partido || 'Sin partido asignado',
      rol: metadata.rol || 'Testigo de Mesa (E-16)',
      puesto: row.puesto,
      mesa: row.mesa,
      comuna: row.zona || row.municipio || '',
      acreditacion: metadata.acreditacion || (status === 'Acreditado' ? 'Formulario E-16 Aprobado' : 'Formulario E-16 En Trámite'),
      geofencing: metadata.geofencing || 'Pendiente Día E',
      estado: status,
      vehiculo: metadata.vehiculo || '',
      observaciones: metadata.nota || ''
    };
  };

  const reloadRealWitnesses = async (clientId = witnessClientId) => {
    if (!clientId) return;
    const { data, error } = await supabase.from('witnesses').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (error) throw error;
    setTestigos((data || []).map(mapDatabaseWitness));
  };

  useEffect(() => {
    let mounted = true;
    const loadWitnessModule = async () => {
      setWitnessLoading(true);
      setWitnessSyncError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          userId = refreshed.session?.user?.id;
        }
        if (!userId) throw new Error('Debes iniciar sesión para consultar los testigos.');
        const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id && !profile?.campaign_id) throw new Error('El usuario no tiene una campaña asignada.');

        const rememberedCampaignId = profile?.campaign_id || localStorage.getItem('active_campaign_id');
        let campaignQuery = supabase.from('campaigns').select('*');
        if (rememberedCampaignId) campaignQuery = campaignQuery.eq('id', rememberedCampaignId);
        else if (profile?.client_id) campaignQuery = campaignQuery.eq('client_id', profile.client_id);
        else throw new Error('Tu usuario no tiene una campaña asignada.');
        const { data: campaigns, error: campaignError } = await campaignQuery.limit(1);
        if (campaignError) throw campaignError;
        const campaign = campaigns?.[0];
        if (mounted) {
          if (campaign) {
            setCampaignDossier((current: any) => ({
              ...current,
              departamento: campaign.departamento || '',
              municipio: normalizeMunicipioName(campaign.municipio) || '',
              circunscripcionTerritorial: campaign.circunscripcion || '',
              corporacion: campaign.cargo_postulacion || current?.corporacion || '',
            }));
          } else {
            setCampaignDossier({
              nombreCandidato: '', corporacion: '', departamento: '', municipio: '',
              circunscripcionTerritorial: '', modalidadAval: '', partidoUnico: '',
              candidatoPrincipal: { nombreCompleto: '' },
            });
          }
        }
        if (campaign?.id) {
          let storedPlaces = await loadCampaignPollingPlaces(campaign.id);
          if (storedPlaces.length === 0) {
            const rawScope = String(campaign.circunscripcion || '').toUpperCase();
            await initializeCampaignPollingStations({
              campaignId: campaign.id,
              department: campaign.departamento || candidateDepartamento,
              municipality: campaign.municipio || candidateMunicipio,
              scope: rawScope === 'NACIONAL'
                ? 'Nacional'
                : rawScope === 'DEPARTAMENTAL'
                  ? 'Departamento'
                  : 'Municipio',
            });
            storedPlaces = await loadCampaignPollingPlaces(campaign.id);
          }
          if (mounted) setCampaignPollingPlaces(storedPlaces);
        }
        if (campaign?.descripcion) {
          try {
            const parsed = JSON.parse(campaign.descripcion);
            if (parsed?.dossier && mounted) setCampaignDossier(parsed.dossier);
          } catch {}
        }
        if (!mounted) return;
        setHasActiveCampaign(Boolean(campaign));
        setWitnessClientId(profile.client_id);
        await reloadRealWitnesses(profile.client_id);
      } catch (error: any) {
        if (mounted) setWitnessSyncError(isExpectedEmptyCampaignState(error) ? '' : (error?.message || 'No fue posible cargar testigos desde Supabase.'));
      } finally {
        if (mounted) setWitnessLoading(false);
      }
    };
    void loadWitnessModule();
    return () => { mounted = false; };
  }, []);

  // Keep every counter synchronized when witnesses are created, assigned,
  // accredited, edited or removed from another active session.
  useEffect(() => {
    if (!witnessClientId) return;

    const channel = supabase
      .channel(`campaign-witnesses-${witnessClientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'witnesses',
          filter: `client_id=eq.${witnessClientId}`
        },
        () => {
          void reloadRealWitnesses(witnessClientId).catch((error: any) => {
            setWitnessSyncError(error?.message || 'No fue posible actualizar los indicadores de testigos.');
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [witnessClientId]);

  // -------------------------------------------------------------------------
  // 4. GEOFENCING Y RADAR GPS
  // -------------------------------------------------------------------------
  const [geofenceActive, setGeofenceActive] = useState(true);
  const [geofenceRadius, setGeofenceRadius] = useState(150); // Metros
  const [geofenceToleranceMinutes, setGeofenceToleranceMinutes] = useState(15);
  const [selectedGeofencePuesto, setSelectedGeofencePuesto] = useState(puestosTerritorioOpt[0]?.nombre || '');
  const [autoNotifyCommandCenter, setAutoNotifyCommandCenter] = useState(true);
  const [showGeofenceConfigPanel, setShowGeofenceConfigPanel] = useState(true);

  // Asegurar que el puesto seleccionado en Geofence exista en la lista actual
  useEffect(() => {
    if (puestosTerritorioOpt.length > 0) {
      const exists = puestosTerritorioOpt.some(p => p.nombre === selectedGeofencePuesto);
      if (!exists) {
        setSelectedGeofencePuesto(puestosTerritorioOpt[0].nombre);
      }
    }
  }, [puestosTerritorioOpt, selectedGeofencePuesto]);

  // GPS starts empty and only receives readings from real campaign witnesses.
  const [testigoGpsPings, setTestigoGpsPings] = useState<Record<string, GpsPingData>>({});

  // Alertas de Geofence
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlertRecord[]>([]);

  useEffect(() => {
    const realWitnessIds = new Set(testigos.map(testigo => testigo.id));
    setTestigoGpsPings(previous => Object.fromEntries(
      Object.entries(previous).filter(([testigoId]) => realWitnessIds.has(testigoId))
    ));
    setGeofenceAlerts(previous => previous.filter(alert => realWitnessIds.has(alert.testigoId)));
  }, [testigos]);

  // Toast flotante
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Simular Ping GPS individual
  const handleSimulateWitnessPing = (tId: string) => {
    const target = testigos.find(t => t.id === tId);
    const newDistance = Math.floor(Math.random() * 320) + 12;
    const isInside = newDistance <= geofenceRadius;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTestigoGpsPings(prev => ({
      ...prev,
      [tId]: {
        distanciaMetros: newDistance,
        lat: 6.244 + (Math.random() * 0.006 - 0.003),
        lng: -75.581 + (Math.random() * 0.006 - 0.003),
        ultimoPing: 'Justo ahora',
        bateriaPct: Math.max(15, Math.floor(Math.random() * 30) + 70),
        estadoGPS: isInside ? 'DENTRO' : 'FUERA'
      }
    }));

    if (!isInside && geofenceActive && target) {
      const newAlert: GeofenceAlertRecord = {
        id: `alt-${Date.now()}`,
        testigoId: tId,
        testigoNombre: target.nombre,
        puesto: target.puesto,
        distanciaMetros: newDistance,
        hora: nowStr,
        estado: 'Activa'
      };
      setGeofenceAlerts(prev => [newAlert, ...prev]);
      showToast(`⚠️ ALERTA GPS: ${target.nombre} se encuentra a ${newDistance}m (Fuera del cerco de ${geofenceRadius}m)`);
    } else if (target) {
      showToast(`🛰️ Ping GPS actualizado: ${target.nombre} a ${newDistance}m (Dentro del Cerco ✅)`);
    }
  };

  // Simular Pings Masivos
  const handleSimulateBulkPings = () => {
    testigos.forEach(t => {
      handleSimulateWitnessPing(t.id);
    });
    showToast(`🔄 Telemetría GPS actualizada para ${testigos.length} testigos electorales.`);
  };

  // -------------------------------------------------------------------------
  // 5. FILTROS Y BÚSQUEDA
  // -------------------------------------------------------------------------
  const [witnessSearchQuery, setWitnessSearchQuery] = useState('');
  const [witnessPartidoFilter, setWitnessPartidoFilter] = useState('Todos');
  const [witnessPuestoFilter, setWitnessPuestoFilter] = useState('Todos');
  const [witnessAcreditacionFilter, setWitnessAcreditacionFilter] = useState('Todos');
  const [witnessGpsFilter, setWitnessGpsFilter] = useState<'Todos' | 'DENTRO' | 'FUERA'>('Todos');

  // -------------------------------------------------------------------------
  // 6. FORMULARIO DE CREACIÓN / EDICIÓN DE TESTIGO
  // -------------------------------------------------------------------------
  const [showWitnessForm, setShowWitnessForm] = useState(false);
  const [editingWitnessId, setEditingWitnessId] = useState<string | null>(null);

  const [witNombre, setWitNombre] = useState('');
  const [witCc, setWitCc] = useState('');
  const [witTelefono, setWitTelefono] = useState('');
  const [witEmail, setWitEmail] = useState('');
  const [witPartido, setWitPartido] = useState(partidosPoliticosOpt[0] || '');
  const [witRol, setWitRol] = useState<TestigoElectoral['rol']>('Testigo de Mesa (E-16)');
  const [witPuesto, setWitPuesto] = useState(puestosTerritorioOpt[0]?.nombre || '');
  const [witMesa, setWitMesa] = useState('Mesa 01');
  const [witComuna, setWitComuna] = useState(puestosTerritorioOpt[0]?.comuna || 'Zona Urbana Central');
  const [witAcreditacion, setWitAcreditacion] = useState<TestigoElectoral['acreditacion']>('Formulario E-16 En Trámite');
  const [witEstado, setWitEstado] = useState<TestigoElectoral['estado']>('Inscrito');
  const [witObservaciones, setWitObservaciones] = useState('');
  const [witVehiculo, setWitVehiculo] = useState('');

  // Sincronizar defaults cuando cambian los puestos del territorio
  useEffect(() => {
    if (puestosTerritorioOpt.length > 0) {
      const existsPuesto = puestosTerritorioOpt.some(p => p.nombre === witPuesto);
      if (!existsPuesto) {
        setWitPuesto(puestosTerritorioOpt[0].nombre);
        setWitComuna(puestosTerritorioOpt[0].comuna);
      }
    }
  }, [puestosTerritorioOpt, witPuesto]);

  // Sincronizar defaults cuando cambian los partidos avaladores
  useEffect(() => {
    if (partidosPoliticosOpt.length > 0) {
      const existsPartido = partidosPoliticosOpt.includes(witPartido);
      if (!existsPartido) {
        setWitPartido(partidosPoliticosOpt[0]);
      }
    }
  }, [partidosPoliticosOpt, witPartido]);

  // Puesto actualmente seleccionado en el formulario para cálculo de mesas
  const currentPuestoObj = useMemo(() => {
    return puestosTerritorioOpt.find(p => p.nombre === witPuesto) || puestosTerritorioOpt[0];
  }, [puestosTerritorioOpt, witPuesto]);

  const maxMesasEnPuesto = currentPuestoObj?.mesas || 30;

  const resetWitnessForm = () => {
    setEditingWitnessId(null);
    setWitNombre('');
    setWitCc('');
    setWitTelefono('');
    setWitEmail('');
    setWitPartido(partidosPoliticosOpt[0] || '');
    setWitRol('Testigo de Mesa (E-16)');
    setWitPuesto(puestosTerritorioOpt[0]?.nombre || '');
    setWitMesa('Mesa 01');
    setWitComuna(puestosTerritorioOpt[0]?.comuna || 'Zona Urbana');
    setWitAcreditacion('Formulario E-16 En Trámite');
    setWitEstado('Inscrito');
    setWitObservaciones('');
    setWitVehiculo('');
    setShowWitnessForm(false);
  };

  const handleStartEditWitness = (t: TestigoElectoral) => {
    setEditingWitnessId(t.id);
    setWitNombre(t.nombre);
    setWitCc(t.cc);
    setWitTelefono(t.telefono);
    setWitEmail(t.email);
    setWitPartido(t.partido);
    setWitRol(t.rol);
    setWitPuesto(t.puesto);
    setWitMesa(t.mesa);
    setWitComuna(t.comuna);
    setWitAcreditacion(t.acreditacion);
    setWitEstado(t.estado);
    setWitObservaciones(t.observaciones || '');
    setWitVehiculo(t.vehiculo || '');
    setShowWitnessForm(true);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleDeleteWitness = async (id: string) => {
    const target = testigos.find(t => t.id === id);
    if (confirm(`¿Está seguro de eliminar al testigo electoral "${target?.nombre || id}" de la lista oficial?`)) {
      setWitnessSaving(true);
      const { error } = await supabase.from('witnesses').delete().eq('id', id);
      setWitnessSaving(false);
      if (error) return setWitnessSyncError(error.message);
      setTestigos(prev => prev.filter(t => t.id !== id));
      showToast(`Testigo eliminado correctamente de Supabase.`);
    }
  };

  const handleSaveWitness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasActiveCampaign) {
      alert('⚠️ No se puede inscribir ni modificar un testigo porque no existe una campaña creada aún.');
      return;
    }
    if (!witNombre.trim() || !witCc.trim() || !witTelefono.trim() || !witEmail.trim()) {
      alert('Nombre, cédula, teléfono y correo electrónico son obligatorios para registrar y localizar al testigo.');
      return;
    }

    if (!witnessClientId) return setWitnessSyncError('No hay una organización electoral activa.');
    const existingWitness = editingWitnessId ? testigos.find(t => t.id === editingWitnessId) : null;
    const witnessToSave: Omit<TestigoElectoral, 'id'> = {
        nombre: witNombre.trim(),
        cc: witCc.trim(),
        telefono: witTelefono.trim(),
        email: witEmail.trim().toLowerCase(),
        partido: witPartido,
        rol: witRol,
        puesto: witPuesto,
        mesa: witMesa,
        comuna: witComuna,
        acreditacion: witAcreditacion,
        estado: witEstado,
        observaciones: witObservaciones.trim(),
        vehiculo: witVehiculo.trim(),
        geofencing: existingWitness?.geofencing || 'Pendiente Día E'
      };

    if (!editingWitnessId) {
      // Duplicate check
      if (testigos.some(t => t.cc === witCc.trim())) {
        alert(`Error: La cédula ${witCc.trim()} ya se encuentra inscrita en la lista de testigos.`);
        return;
      }
    }
    setWitnessSaving(true);
    setWitnessSyncError('');
    try {
      const operation = editingWitnessId
        ? supabase.from('witnesses').update(witnessPayload(witnessToSave)).eq('id', editingWitnessId)
        : supabase.from('witnesses').insert(witnessPayload(witnessToSave));
      const { error } = await operation;
      if (error) throw error;
      await reloadRealWitnesses();
      showToast(editingWitnessId ? `✅ Modificación sincronizada para ${witNombre.trim()}` : `✅ Testigo ${witNombre.trim()} inscrito en Supabase para ${witPartido}`);
      resetWitnessForm();
    } catch (error: any) {
      setWitnessSyncError(error?.message || 'No fue posible guardar el testigo.');
    } finally {
      setWitnessSaving(false);
    }
  };

  // Quick toggle accreditation
  const handleToggleAcreditacion = async (id: string) => {
    const witness = testigos.find(t => t.id === id);
    if (!witness) return;
    const nextAcred = witness.acreditacion === 'Formulario E-16 Aprobado' ? 'Formulario E-16 En Trámite' : 'Formulario E-16 Aprobado';
    const updated: TestigoElectoral = { ...witness, acreditacion: nextAcred, estado: nextAcred === 'Formulario E-16 Aprobado' ? 'Acreditado' : 'Inscrito' };
    const { error } = await supabase.from('witnesses').update(witnessPayload(updated)).eq('id', id);
    if (error) return setWitnessSyncError(error.message);
    setTestigos(prev => prev.map(t => t.id === id ? updated : t));
    showToast(`Estado de acreditación actualizado en Supabase.`);
  };

  // -------------------------------------------------------------------------
  // 7. MODAL: AGREGAR / PERSONALIZAR PUESTO DE VOTACIÓN EN EL TERRITORIO
  // -------------------------------------------------------------------------
  const [showAddPuestoModal, setShowAddPuestoModal] = useState(false);
  const [newPuestoNombre, setNewPuestoNombre] = useState('');
  const [newPuestoComuna, setNewPuestoComuna] = useState('');
  const [newPuestoMesas, setNewPuestoMesas] = useState(25);
  const [newPuestoCenso, setNewPuestoCenso] = useState(8750);
  const [newPuestoDireccion, setNewPuestoDireccion] = useState('');

  const handleCreateCustomPuesto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPuestoNombre.trim()) {
      alert('Por favor ingrese el nombre del puesto de votación.');
      return;
    }

    const newPst: PuestoVotacionInfo = {
      id: `custom-${Date.now()}`,
      nombre: newPuestoNombre.trim(),
      departamento: candidateDepartamento,
      municipio: candidateMunicipio,
      comuna: newPuestoComuna.trim() || 'Zona Urbana',
      mesas: Number(newPuestoMesas) || 20,
      censoEstimado: Number(newPuestoCenso) || 7000,
      direccion: newPuestoDireccion.trim() || `Sede Oficial, ${candidateMunicipio}`,
      lat: 4.6097,
      lng: -74.0817,
      isCustom: true
    };

    saveCustomPuesto(newPst);
    setCustomPuestosVersion(v => v + 1);
    setWitPuesto(newPst.nombre);
    setWitComuna(newPst.comuna);
    setShowAddPuestoModal(false);
    setNewPuestoNombre('');
    setNewPuestoComuna('');
    setNewPuestoDireccion('');
    showToast(`🏛️ ¡Puesto de votación "${newPst.nombre}" agregado con éxito al territorio de ${candidateMunicipio}!`);
  };

  // -------------------------------------------------------------------------
  // 8. MODALES: CREDENCIAL OFICIAL E-16, FORMULARIO E-16 & IMPORTACIÓN
  // -------------------------------------------------------------------------
  const [selectedWitnessForCard, setSelectedWitnessForCard] = useState<TestigoElectoral | null>(null);
  const [showE16Modal, setShowE16Modal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // Bulk Import State
  const [importTextData, setImportTextData] = useState('');

  const handleProcessImportCsv = async () => {
    if (!importTextData.trim()) {
      alert('Pegue datos en formato CSV o ingrese líneas válidas.');
      return;
    }

    const lines = importTextData.trim().split('\n');
    let importedCount = 0;
    const newItems: TestigoElectoral[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const cc = parts[0];
        const nombre = parts[1];
        const tel = parts[2] || '+57 300 000 0000';
        const partido = parts[3] || partidosPoliticosOpt[0] || 'Partido Liberal Colombiano';
        const puesto = parts[4] || puestosTerritorioOpt[0]?.nombre || 'Puesto Central';
        const mesa = parts[5] || 'Mesa 01';
        const matchedPst = puestosTerritorioOpt.find(p => p.nombre.toLowerCase() === puesto.toLowerCase());

        if (!testigos.some(t => t.cc === cc) && !newItems.some(t => t.cc === cc)) {
          const newId = `t-imp-${Date.now()}-${idx}`;
          newItems.push({
            id: newId,
            cc,
            nombre,
            telefono: tel,
            email: `${cc}@testigo.cne.co`,
            partido,
            rol: 'Testigo de Mesa (E-16)',
            puesto,
            mesa,
            comuna: matchedPst?.comuna || 'Zona Urbana',
            acreditacion: 'Formulario E-16 Aprobado',
            geofencing: 'Pendiente Día E',
            estado: 'Acreditado'
          });
          importedCount++;
        }
      }
    });

    if (newItems.length > 0) {
      if (!witnessClientId) return setWitnessSyncError('No hay una organización electoral activa.');
      setWitnessSaving(true);
      const { error } = await supabase.from('witnesses').insert(newItems.map(witnessPayload));
      setWitnessSaving(false);
      if (error) return setWitnessSyncError(error.message);
      await reloadRealWitnesses();
      setShowImportModal(false);
      setImportTextData('');
      showToast(`🎉 ¡${importedCount} testigos importados a Supabase y asignados a ${candidateMunicipio}!`);
    } else {
      alert('No se pudieron importar testigos (posibles cédulas duplicadas o formato inválido).');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = 'CEDULA,NOMBRE,TELEFONO,EMAIL,PARTIDO,ROL,PUESTO,MESA,COMUNA,ACREDITACION,ESTADO\n';
    const rows = testigos.map(t => 
      `"${t.cc}","${t.nombre}","${t.telefono}","${t.email}","${t.partido}","${t.rol}","${t.puesto}","${t.mesa}","${t.comuna}","${t.acreditacion}","${t.estado}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Listado_Testigos_E16_${candidateMunicipio}_${candidateDepartamento}_2026.csv`;
    link.click();
    showToast('📥 Archivo CSV descargado con éxito.');
  };

  // WhatsApp Contact Helper
  const handleOpenWhatsApp = (t: TestigoElectoral) => {
    const cleanTel = t.telefono.replace(/[^\d]/g, '');
    const message = encodeURIComponent(
      `Hola ${t.nombre}, cordial saludo de la Campaña de ${candidateName} (${candidateCorporacion} de ${candidateMunicipio}, ${candidateDepartamento}). Le confirmamos su designación oficial como ${t.rol} en el puesto de votación "${t.puesto}" (${t.mesa}). Por favor confirmar asistencia y recepción de su credencial oficial E-16.`
    );
    window.open(`https://wa.me/${cleanTel}?text=${message}`, '_blank');
  };

  // Filtered witnesses list
  const filteredTestigos = testigos.filter(t => {
    if (witnessPartidoFilter !== 'Todos' && t.partido !== witnessPartidoFilter) return false;
    if (witnessPuestoFilter !== 'Todos' && t.puesto !== witnessPuestoFilter) return false;
    if (witnessAcreditacionFilter !== 'Todos' && t.acreditacion !== witnessAcreditacionFilter) return false;
    
    if (witnessGpsFilter !== 'Todos') {
      const gps = testigoGpsPings[t.id];
      const isInside = gps ? gps.distanciaMetros <= geofenceRadius : true;
      if (witnessGpsFilter === 'DENTRO' && !isInside) return false;
      if (witnessGpsFilter === 'FUERA' && isInside) return false;
    }

    if (witnessSearchQuery.trim()) {
      const q = witnessSearchQuery.toLowerCase();
      return (
        t.nombre.toLowerCase().includes(q) ||
        t.cc.includes(q) ||
        t.puesto.toLowerCase().includes(q) ||
        t.mesa.toLowerCase().includes(q) ||
        t.telefono.includes(q)
      );
    }
    return true;
  });

  // Calculate Metrics
  const totalInscritos = testigos.length;
  const totalAcreditados = testigos.filter(t => t.estado === 'Acreditado' || t.acreditacion === 'Formulario E-16 Aprobado').length;
  const totalMesasConsignadas = puestosTerritorioOpt.reduce((acc, p) => acc + p.mesas, 0);
  const mesasCubiertas = new Set(testigos.map(t => `${t.puesto}-${t.mesa}`)).size;
  const pctCobertura = totalMesasConsignadas > 0 ? Math.min(100, Math.round((mesasCubiertas / totalMesasConsignadas) * 100)) : 0;
  const puestosAsignados = new Set(testigos.map(t => t.puesto).filter(Boolean)).size;
  const testigosDentroCerco = testigos.filter(testigo => {
    const ping = testigoGpsPings[testigo.id];
    return Boolean(ping && ping.distanciaMetros <= geofenceRadius);
  }).length;
  const activeAlertsCount = geofenceAlerts.filter(a => a.estado === 'Activa').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 w-full max-w-7xl mx-auto px-2 sm:px-4">
      {/* ========================================================================= */}
      {/* FLOATING TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#041c38] text-white border border-cyan-400/50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="p-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(witnessLoading || witnessSaving || witnessSyncError) && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
          witnessSyncError ? 'bg-rose-950/70 border-rose-500/50 text-rose-200' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-200'
        }`}>
          <RefreshCw className={`w-4 h-4 ${witnessLoading || witnessSaving ? 'animate-spin' : ''}`} />
          <span>{witnessLoading ? 'Cargando testigos reales desde Supabase...' : witnessSaving ? 'Sincronizando cambios con Supabase...' : `Error de sincronización: ${witnessSyncError}`}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-[#030e21]/95 rounded-3xl p-4 sm:p-6 border border-cyan-500/30 shadow-2xl space-y-6">
        
        {/* ========================================================================= */}
        {/* TOP ACTION BUTTONS BAR (ONLY BUTTONS) */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-cyan-500/20 pb-4">
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-black rounded-xl shadow-inner whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Campaña Activa: Creada ✓</span>
          </div>

          <button
            type="button"
            onClick={() => setShowE16Modal(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <FileCheck className="w-4 h-4" />
            <span>Generar Formulario E-16 Oficial</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-[#041733] hover:bg-[#07244f] active:scale-95 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>Importar Masivo</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#020b18] hover:bg-[#051833] active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            title="Descargar base de testigos en archivo CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddPuestoModal(true)}
            className="px-3.5 py-2 bg-[#051f42] hover:bg-[#082a5a] active:scale-95 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            <span>+ Añadir puesto</span>
          </button>
        </div>

        {/* ACTIVE CAMPAIGN METRICS & JURISDICTION BAR */}
        <div className="space-y-4">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-[#020712] rounded-xl border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span>Testigos Acreditados</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">{totalAcreditados} / {totalInscritos}</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all" 
                  style={{ width: `${totalInscritos > 0 ? (totalAcreditados / totalInscritos) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-emerald-300 font-bold">
                {totalInscritos > 0 ? Math.round((totalAcreditados / totalInscritos) * 100) : 0}% con Formulario E-16 OK
              </span>
            </div>

            <div className="p-3.5 bg-[#020712] rounded-xl border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span>Cobertura de Mesas</span>
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">{mesasCubiertas} / {totalMesasConsignadas}</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-400 h-full rounded-full transition-all" 
                  style={{ width: `${pctCobertura}%` }}
                />
              </div>
              <span className="text-[10px] text-cyan-300 font-bold">
                {pctCobertura}% Mesas con testigo
              </span>
            </div>

            <div className="p-3.5 bg-[#020712] rounded-xl border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span>Puestos Asignados</span>
                <Building className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {puestosAsignados} / {puestosTerritorioOpt.length}
              </div>
              <span className="text-[10px] text-indigo-300 font-bold">
                Puestos electorales de la circunscripción
              </span>
            </div>

            <div className="p-3.5 bg-[#020712] rounded-xl border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span>Cerco GPS en Tiempo Real</span>
                <Locate className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {testigosDentroCerco} / {totalInscritos}
              </div>
              <span className="text-[10px] text-amber-300 font-bold">
                Testigos en posición asignada
              </span>
            </div>
          </div>

          {/* Solo se muestra el resumen de partidos que ya tienen testigos reales registrados. */}
          {registeredWitnessParties.length > 0 && <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Resumen de Testigos por Partido Político / Aval de Campaña</span>
              </h4>
              {witnessPartidoFilter !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setWitnessPartidoFilter('Todos')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Limpiar Filtro ({witnessPartidoFilter})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {registeredWitnessParties.map((partido) => {
                const count = testigos.filter(t => t.partido === partido).length;
                const acreditados = testigos.filter(t => t.partido === partido && (t.estado === 'Acreditado' || t.acreditacion === 'Formulario E-16 Aprobado')).length;
                const isSelected = witnessPartidoFilter === partido;

                return (
                  <div 
                    key={partido}
                    onClick={() => setWitnessPartidoFilter(isSelected ? 'Todos' : partido)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected 
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-md ring-2 ring-cyan-500/50' 
                        : 'bg-[#030d1f] hover:bg-[#071b38] border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-xs truncate max-w-[170px]" title={partido}>
                        {partido}
                      </span>
                      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                        {count} Testigos
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>E-16 Aprobados: <strong className="text-emerald-400">{acreditados}</strong></span>
                      <span className="text-cyan-300 font-bold">{count > 0 ? Math.round((acreditados / count) * 100) : 0}% OK</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ========================================================================= */}
          {/* GEOFENCING & RADAR GPS PANEL */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-indigo-500/30 bg-[#04142b] p-6 text-center">
            <Locate className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <h4 className="font-extrabold text-white">Sin reportes GPS reales</h4>
            <p className="mt-2 text-xs text-slate-400">
              El cerco perimetral se habilitará cuando existan puestos oficiales y los testigos registrados reporten su ubicación desde la mesa asignada.
            </p>
          </div>
          {false && (
          <div className="bg-gradient-to-b from-[#04142b] to-[#020b18] border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/40">
                  <Locate className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <span>Sistema de Geofencing & Cerco Perimetral GPS de Testigos</span>
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateBulkPings}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Simular Pings GPS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGeofenceConfigPanel(!showGeofenceConfigPanel)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{showGeofenceConfigPanel ? 'Ocultar Parámetros' : 'Ajustar Cerco'}</span>
                </button>
              </div>
            </div>

            {showGeofenceConfigPanel && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fadeIn">
                {/* Left Column: Cerco Parameters */}
                <div className="lg:col-span-5 space-y-3 bg-slate-900/60 p-4 rounded-xl border border-indigo-500/20">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span>Estado del Cerco Perimetral GPS:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setGeofenceActive(!geofenceActive);
                        showToast(`Cerco GPS ${!geofenceActive ? 'Activado' : 'Desactivado'}`);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        geofenceActive 
                          ? 'bg-emerald-500 text-slate-950 shadow-md' 
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {geofenceActive ? 'ACTIVO (Vigilando)' : 'INACTIVO'}
                    </button>
                  </div>

                  {/* Radius Slider */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-indigo-200">
                        Radio de Tolerancia del Cerco (Distancia):
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="30"
                          max="2000"
                          value={geofenceRadius}
                          onChange={(e) => setGeofenceRadius(Math.max(10, Number(e.target.value)))}
                          className="w-20 bg-slate-800 border border-indigo-500/50 rounded-lg text-center font-mono font-black text-indigo-300 py-1 text-xs focus:outline-none focus:border-indigo-400"
                        />
                        <span className="font-bold text-slate-400">m</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="30"
                      max="1000"
                      step="10"
                      disabled={!geofenceActive}
                      value={geofenceRadius}
                      onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg disabled:opacity-40"
                    />

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                      {[
                        { label: '50m (Mesas)', val: 50 },
                        { label: '100m (Puesto)', val: 100 },
                        { label: '150m (Estándar)', val: 150 },
                        { label: '300m (Manzana)', val: 300 },
                        { label: '500m (Zona)', val: 500 }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setGeofenceRadius(preset.val)}
                          className={`px-2 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                            geofenceRadius === preset.val
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tolerance Minutes & Alerts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 space-y-1">
                      <label className="block font-bold text-slate-300 text-[11px]">
                        Tiempo Tol. Fuera de Cerco
                      </label>
                      <select
                        value={geofenceToleranceMinutes}
                        onChange={(e) => setGeofenceToleranceMinutes(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-1.5 font-bold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="5">5 Minutos</option>
                        <option value="15">15 Minutos (Recomendado)</option>
                        <option value="30">30 Minutos</option>
                        <option value="60">60 Minutos</option>
                      </select>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                      <label className="block font-bold text-slate-300 text-[11px]">
                        Alerta al Centro Mando
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={autoNotifyCommandCenter}
                          onChange={(e) => setAutoNotifyCommandCenter(e.target.checked)}
                          className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                        />
                        <span className="text-[11px] text-indigo-200 font-medium">Disparo Automático Día E</span>
                      </label>
                    </div>
                  </div>

                  {/* Puesto Selection for Radar View */}
                  <div className="space-y-1">
                    <label className="block font-bold text-indigo-300 text-xs">
                      Inspeccionar puesto de votación en radar:
                    </label>
                    <select
                      value={selectedGeofencePuesto}
                      onChange={(e) => setSelectedGeofencePuesto(e.target.value)}
                      className="w-full bg-slate-800 border border-indigo-500/40 text-white rounded-xl p-2 font-bold text-xs focus:outline-none focus:border-indigo-400"
                    >
                      {puestosTerritorioOpt.map((pst, idx) => (
                        <option key={idx} value={pst.nombre}>{pst.nombre} - {pst.comuna}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right Column: Interactive Radar Diagram & Live Ping Monitor */}
                <div className="lg:col-span-7 bg-slate-800/60 border border-indigo-500/20 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                    <h5 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-indigo-400" />
                      <span>Radar Perimetral de Cobertura GPS: {selectedGeofencePuesto}</span>
                    </h5>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-mono">
                      Radio Actual: {geofenceRadius} metros
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* Graphic Radar Simulation Circle */}
                    <div className="sm:col-span-6 flex flex-col items-center justify-center p-3 bg-slate-950/80 rounded-2xl border border-indigo-500/30 relative min-h-[220px]">
                      {/* Radar Background grid rings */}
                      <div className="w-40 h-40 rounded-full border border-indigo-500/20 flex items-center justify-center relative">
                        <div className="w-28 h-28 rounded-full border border-indigo-500/40 flex items-center justify-center">
                          {/* Dynamic Geofence Perimeter Circle */}
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-400/80 bg-emerald-500/10 flex items-center justify-center animate-pulse relative">
                            {/* Central Polling Station Icon */}
                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.8)] border border-white">
                              <Building className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>

                        {/* Radar Scanning Line Effect */}
                        <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-spin opacity-30 pointer-events-none" style={{ animationDuration: '8s' }} />

                        {/* Simulated Witness Dots on Radar */}
                        {testigos
                          .filter(t => t.puesto === selectedGeofencePuesto || selectedGeofencePuesto === (puestosTerritorioOpt[0]?.nombre || ''))
                          .slice(0, 4)
                          .map((t, idx) => {
                            const gps = testigoGpsPings[t.id] || { distanciaMetros: 50, estadoGPS: 'DENTRO' };
                            const isInside = geofenceActive ? (gps.distanciaMetros <= geofenceRadius) : true;
                            const offsets = [
                              { top: '25%', left: '30%' },
                              { top: '65%', left: '70%' },
                              { top: '15%', left: '75%' },
                              { top: '80%', left: '30%' }
                            ];
                            const pos = offsets[idx % offsets.length];
                            return (
                              <div
                                key={t.id}
                                style={{ top: pos.top, left: pos.left }}
                                onClick={() => handleSimulateWitnessPing(t.id)}
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10"
                                title={`${t.nombre}: ${gps.distanciaMetros}m (${isInside ? 'DENTRO' : 'FUERA'}) - Clic para ping`}
                              >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] text-white shadow-md transition-all hover:scale-125 ${
                                  isInside 
                                    ? 'bg-emerald-500 ring-2 ring-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                                    : 'bg-rose-600 ring-2 ring-rose-400 shadow-[0_0_10px_rgba(225,29,72,0.9)] animate-bounce'
                                }`}>
                                  T{idx + 1}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="text-[10px] text-slate-400 mt-2 text-center font-mono truncate max-w-[200px]">
                        Centro: {selectedGeofencePuesto} | Cerco: {geofenceRadius}m
                      </div>
                    </div>

                    {/* Live Witness Distances List */}
                    <div className="sm:col-span-6 space-y-2">
                      <div className="flex items-center justify-between">
                        <h6 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Testigos en este Puesto:
                        </h6>
                        <span className="text-[10px] text-cyan-300 font-mono">
                          {testigos.filter(t => t.puesto === selectedGeofencePuesto).length} Asignados
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {testigos
                          .filter(t => t.puesto === selectedGeofencePuesto || selectedGeofencePuesto === (puestosTerritorioOpt[0]?.nombre || ''))
                          .map((t) => {
                            const gps = testigoGpsPings[t.id] || {
                              distanciaMetros: 45,
                              ultimoPing: 'Hace 2 min',
                              bateriaPct: 85,
                              estadoGPS: 'DENTRO'
                            };
                            const isInside = geofenceActive ? (gps.distanciaMetros <= geofenceRadius) : true;

                            return (
                              <div key={t.id} className="p-2 bg-slate-900/90 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs">
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-white truncate text-[11px]">{t.nombre}</div>
                                  <div className="text-[10px] text-indigo-300 font-mono">
                                    Distancia: <strong className={isInside ? 'text-emerald-400' : 'text-rose-400 font-black'}>{gps.distanciaMetros}m</strong> • {t.mesa}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${
                                    !geofenceActive 
                                      ? 'bg-slate-700 text-slate-300 border-slate-600'
                                      : isInside 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                  }`}>
                                    {!geofenceActive ? 'Inactivo' : isInside ? 'DENTRO ✅' : 'FUERA 🚨'}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleSimulateWitnessPing(t.id)}
                                    className="p-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 rounded-lg transition-colors cursor-pointer"
                                    title="Simular nuevo reporte GPS (Ping)"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ========================================================================= */}
          {/* ACTION & FILTER BAR (RESPONSIVE) */}
          {/* ========================================================================= */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative w-full sm:w-auto flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={witnessSearchQuery}
                  onChange={(e) => setWitnessSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, CC o mesa..."
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Party Filter */}
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
                <select
                  value={witnessPartidoFilter}
                  onChange={(e) => setWitnessPartidoFilter(e.target.value)}
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Todos">Todos los Partidos</option>
                  {partidosPoliticosOpt.map((p, i) => (
                    <option key={i} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Polling Station Filter (Candidate's territory) */}
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[160px]">
                <select
                  value={witnessPuestoFilter}
                  onChange={(e) => setWitnessPuestoFilter(e.target.value)}
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Todos">Todos los puestos</option>
                  {puestosTerritorioOpt.map((pst, i) => (
                    <option key={i} value={pst.nombre}>{pst.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Acreditación Filter */}
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[150px]">
                <select
                  value={witnessAcreditacionFilter}
                  onChange={(e) => setWitnessAcreditacionFilter(e.target.value)}
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Todos">Acreditaciones E-16</option>
                  <option value="Formulario E-16 Aprobado">Formulario E-16 Aprobado</option>
                  <option value="Formulario E-16 En Trámite">Formulario E-16 En Trámite</option>
                  <option value="Rechazado Registraduría">Rechazado Registraduría</option>
                </select>
              </div>

              {/* GPS Status Filter */}
              <div className="w-full sm:w-auto flex-1 sm:flex-initial min-w-[140px]">
                <select
                  value={witnessGpsFilter}
                  onChange={(e) => setWitnessGpsFilter(e.target.value as any)}
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Todos">Estados GPS</option>
                  <option value="DENTRO">Dentro de Cerco (OK)</option>
                  <option value="FUERA">Fuera de Cerco (Alerta)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (showWitnessForm && !editingWitnessId) {
                  setShowWitnessForm(false);
                } else {
                  resetWitnessForm();
                  setShowWitnessForm(true);
                }
              }}
              className="w-full lg:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{showWitnessForm ? 'Cerrar Formulario' : '+ Inscribir Nuevo Testigo'}</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* FORM TO CREATE OR MODIFY WITNESS INFO */}
          {/* ========================================================================= */}
          {showWitnessForm && (
            <form onSubmit={handleSaveWitness} className="bg-[#030d1d] border-2 border-cyan-500/40 rounded-2xl p-5 space-y-4 animate-fadeIn shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>{editingWitnessId ? 'Modificar Información y Asignación de Testigo' : 'Inscribir nuevo testigo electoral'}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Territorio oficial: <strong>{activeTerritoryLabel || 'Pendiente de configurar'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetWitnessForm}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={witNombre}
                    onChange={(e) => setWitNombre(e.target.value)}
                    placeholder="Ej: Laura Camila Restrepo"
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Cédula de Ciudadanía (CC) *</label>
                  <input
                    type="text"
                    required
                    value={witCc}
                    onChange={(e) => setWitCc(e.target.value)}
                    placeholder="Ej: 1025889900"
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Teléfono Móvil / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={witTelefono}
                    onChange={(e) => setWitTelefono(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={witEmail}
                    onChange={(e) => setWitEmail(e.target.value)}
                    placeholder="testigo@campana.co"
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Partido Político Selection */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-300 mb-1">Partido Político o Movimiento Avalador *</label>
                  <select
                    value={witPartido}
                    onChange={(e) => setWitPartido(e.target.value)}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400"
                  >
                    {partidosPoliticosOpt.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Rol del Testigo */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-300 mb-1">Rol de Testigo *</label>
                  <select
                    value={witRol}
                    onChange={(e) => setWitRol(e.target.value as any)}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Testigo de Mesa (E-16)">Testigo de Mesa (E-16)</option>
                    <option value="Testigo Rematador / Coordinador de Puesto">Testigo Rematador / Coordinador de Puesto</option>
                    <option value="Testigo de Escrutinio Municipal">Testigo de Escrutinio Municipal</option>
                    <option value="Testigo de Escrutinio Departamental">Testigo de Escrutinio Departamental</option>
                  </select>
                </div>

                {/* Puesto de Votación (Circunscripción Dinámica) */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-300">
                      Puesto de votación *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddPuestoModal(true)}
                      className="text-[11px] text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>+ Crear otro puesto</span>
                    </button>
                  </div>
                  <select
                    value={witPuesto}
                    onChange={(e) => {
                      const pstObj = puestosTerritorioOpt.find(p => p.nombre === e.target.value);
                      setWitPuesto(e.target.value);
                      if (pstObj) setWitComuna(pstObj.comuna);
                    }}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400"
                  >
                    {puestosTerritorioOpt.map((pst, idx) => (
                      <option key={idx} value={pst.nombre}>
                        {pst.nombre} — {pst.comuna} ({pst.mesas} Mesas)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mesa Asignada */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Mesa Asignada (Capacidad: {maxMesasEnPuesto} mesas) *
                  </label>
                  <select
                    value={witMesa}
                    onChange={(e) => setWitMesa(e.target.value)}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    {Array.from({ length: maxMesasEnPuesto }, (_, i) => `Mesa ${String(i + 1).padStart(2, '0')}`).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="Todas las Mesas (Coordinación de Puesto)">Todas las Mesas (Coordinación de Puesto)</option>
                  </select>
                </div>

                {/* Estado Acreditación Registraduría */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Acreditación Registraduría</label>
                  <select
                    value={witAcreditacion}
                    onChange={(e) => setWitAcreditacion(e.target.value as any)}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Formulario E-16 En Trámite">Formulario E-16 En Trámite</option>
                    <option value="Formulario E-16 Aprobado">Formulario E-16 Aprobado</option>
                    <option value="Rechazado Registraduría">Rechazado Registraduría</option>
                  </select>
                </div>

                {/* Estado General */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Estado General</label>
                  <select
                    value={witEstado}
                    onChange={(e) => setWitEstado(e.target.value as any)}
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Inscrito">Inscrito</option>
                    <option value="Acreditado">Acreditado</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                {/* Vehículo Asignado */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-300 mb-1">Transporte / Vehículo Logístico (Opcional)</label>
                  <input
                    type="text"
                    value={witVehiculo}
                    onChange={(e) => setWitVehiculo(e.target.value)}
                    placeholder="Ej: Motocicleta AKT 125 (Placa ABC-12D)"
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Observaciones */}
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block font-bold text-slate-300 mb-1">Observaciones / Notas del Testigo</label>
                  <input
                    type="text"
                    value={witObservaciones}
                    onChange={(e) => setWitObservaciones(e.target.value)}
                    placeholder="Ej: Tiene capacitación CNE, cuenta con smartphone y plan de datos."
                    className="w-full p-2 bg-[#020712] border border-slate-700 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetWitnessForm}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingWitnessId ? 'Guardar Cambios' : 'Inscribir Testigo'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* WITNESSES LIST (DUAL RESPONSIVE: CARDS ON MOBILE & TABLE ON DESKTOP) */}
          {/* ========================================================================= */}
          <div className="bg-[#020712] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3.5 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h4 className="font-extrabold text-white text-xs sm:text-sm">
                  Lista Oficial de Testigos Electorales ({filteredTestigos.length} de {testigos.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Territorio: <strong>{activeTerritoryLabel || 'Pendiente de configurar'}</strong>
              </span>
            </div>

            {/* 1. MOBILE CARDS VIEW (<lg screens) */}
            <div className="block lg:hidden divide-y divide-slate-800/80">
              {filteredTestigos.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs px-4">
                  No se encontraron testigos con los filtros aplicados.
                </div>
              ) : (
                filteredTestigos.map((t) => {
                  const gps: GpsPingData = testigoGpsPings[t.id] || { 
                    distanciaMetros: 50, 
                    estadoGPS: 'DENTRO', 
                    ultimoPing: 'Hace poco',
                    bateriaPct: 90,
                    lat: 4.6097,
                    lng: -74.0817
                  };
                  const isInside = geofenceActive ? (gps.distanciaMetros <= geofenceRadius) : true;

                  return (
                    <div key={t.id} className="p-3.5 sm:p-4 space-y-3 hover:bg-[#030d1f]/60 transition-colors">
                      {/* Top Row: Name, Status & QR */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h5 className="font-extrabold text-white text-sm leading-tight">{t.nombre}</h5>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                            <span>CC: {t.cc}</span>
                            <span>•</span>
                            <span className="text-indigo-300 font-sans font-bold">{t.rol}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedWitnessForCard(t)}
                            className="p-2 bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-white rounded-xl border border-cyan-500/40 transition-colors"
                            title="Ver Carnet Oficial E-16 con QR"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(t)}
                            className="p-2 bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-white rounded-xl border border-emerald-500/40 transition-colors"
                            title="Enviar WhatsApp"
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#030d1d] p-3 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Puesto & Mesa:</span>
                          <span className="font-bold text-slate-200 block truncate">{t.puesto}</span>
                          <span className="text-cyan-400 font-mono font-bold text-[11px]">{t.mesa} • {t.comuna}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Partido / Aval:</span>
                          <span className="font-semibold text-slate-300 block truncate">{t.partido}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{t.telefono}</span>
                        </div>
                      </div>

                      {/* Bottom Row: E-16 Status, GPS Telemetry & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Toggle E-16 Accreditation */}
                          <button
                            type="button"
                            onClick={() => handleToggleAcreditacion(t.id)}
                            className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                              t.acreditacion === 'Formulario E-16 Aprobado'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            }`}
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>{t.acreditacion}</span>
                          </button>

                          {/* GPS Ping Telemetry */}
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded border font-mono ${
                              !geofenceActive
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : isInside
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                            }`}>
                              {!geofenceActive ? 'GPS Inactivo' : isInside ? `GPS OK (${gps.distanciaMetros}m)` : `FUERA (${gps.distanciaMetros}m)`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSimulateWitnessPing(t.id)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                              title="Ping GPS"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleStartEditWitness(t)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWitness(t.id)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. DESKTOP FULL TABLE VIEW (>=lg screens) */}
            <div className="hidden lg:block overflow-x-auto w-full max-w-full">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#030d1f] text-cyan-300 uppercase tracking-wider text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3 whitespace-nowrap">Testigo / Documento</th>
                    <th className="py-3 px-3 whitespace-nowrap">Partido Avalador</th>
                    <th className="py-3 px-3 whitespace-nowrap">Rol & Asignación</th>
                    <th className="py-3 px-3 whitespace-nowrap">Puesto / Mesa</th>
                    <th className="py-3 px-3 whitespace-nowrap">Acreditación E-16</th>
                    <th className="py-3 px-3 whitespace-nowrap">Telemetría GPS</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTestigos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        No se encontraron testigos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredTestigos.map((t) => {
                      const gps: GpsPingData = testigoGpsPings[t.id] || { 
                        distanciaMetros: 50, 
                        estadoGPS: 'DENTRO', 
                        ultimoPing: 'Hace poco',
                        bateriaPct: 90,
                        lat: 4.6097,
                        lng: -74.0817
                      };
                      const isInside = geofenceActive ? (gps.distanciaMetros <= geofenceRadius) : true;

                      return (
                        <tr key={t.id} className="hover:bg-cyan-950/20 transition-colors">
                          {/* Testigo / CC */}
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-white">{t.nombre}</div>
                            <div className="text-[11px] text-slate-400 font-mono">CC {t.cc}</div>
                            <div className="text-[10px] text-cyan-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              <span>{t.telefono}</span>
                            </div>
                          </td>

                          {/* Partido */}
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-200 block">{t.partido}</span>
                            <span className="text-[10px] text-slate-400">{t.estado}</span>
                          </td>

                          {/* Rol */}
                          <td className="py-3 px-3">
                            <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-semibold border border-slate-700 inline-block">
                              {t.rol}
                            </span>
                          </td>

                          {/* Puesto & Mesa */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-white text-xs">{t.puesto}</div>
                            <div className="text-[11px] text-cyan-300 font-mono font-bold">{t.mesa}</div>
                            <div className="text-[10px] text-slate-400">{t.comuna}</div>
                          </td>

                          {/* Acreditación E-16 */}
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => handleToggleAcreditacion(t.id)}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                t.acreditacion === 'Formulario E-16 Aprobado'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                              }`}
                              title="Clic para alternar estado de acreditación"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>{t.acreditacion}</span>
                            </button>
                          </td>

                          {/* GPS Ping */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded border font-mono ${
                                !geofenceActive
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : isInside
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              }`}>
                                {!geofenceActive ? 'Inactivo' : isInside ? `OK (${gps.distanciaMetros}m)` : `FUERA (${gps.distanciaMetros}m)`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSimulateWitnessPing(t.id)}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                                title="Ping GPS"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {gps.ultimoPing} • {gps.bateriaPct}% Bat
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Contact */}
                              <button
                                type="button"
                                onClick={() => handleOpenWhatsApp(t)}
                                className="p-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                                title="Enviar mensaje de asignación y credencial por WhatsApp"
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                              </button>

                              {/* Ver Carnet Digital */}
                              <button
                                type="button"
                                onClick={() => setSelectedWitnessForCard(t)}
                                className="p-1.5 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer"
                                title="Ver Carnet Oficial E-16 con QR"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>

                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => handleStartEditWitness(t)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg transition-colors cursor-pointer"
                                title="Editar Testigo"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Eliminar */}
                              <button
                                type="button"
                                onClick={() => handleDeleteWitness(t.id)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar Testigo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TERRITORIAL POLLING STATION COVERAGE SUMMARY */}
          {/* ========================================================================= */}
          <div className="bg-[#030d1d] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Matriz de cobertura de mesas{activeTerritoryLabel ? ` en ${activeTerritoryLabel}` : ''}</span>
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-cyan-300 font-bold bg-cyan-950/60 px-3 py-1 rounded-xl border border-cyan-500/30">
                  {puestosTerritorioOpt.length} Puestos • {totalMesasConsignadas} Mesas Totales
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPuestoModal(true)}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Puesto</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {puestosTerritorioOpt.length === 0 && (
                <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                  No hay puestos ni mesas oficiales cargados para esta campaña.
                </div>
              )}
              {puestosTerritorioOpt.map((pst, idx) => {
                const testigosEnPuesto = testigos.filter(t => t.puesto === pst.nombre);
                const isSelected = witnessPuestoFilter === pst.nombre;
                const isCovered = testigosEnPuesto.length > 0;

                return (
                  <div 
                    key={idx} 
                    onClick={() => setWitnessPuestoFilter(isSelected ? 'Todos' : pst.nombre)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected 
                        ? 'bg-[#061d3d] border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg' 
                        : 'bg-[#020712] hover:bg-[#061833] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white truncate max-w-[200px]" title={pst.nombre}>
                        {pst.nombre}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                        {pst.mesas} Mesas
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{pst.comuna}</div>
                    
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          testigosEnPuesto.length >= pst.mesas ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(100, (testigosEnPuesto.length / pst.mesas) * 100)}%` }}
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px]">
                      <span className="text-slate-300">
                        Testigos: <strong className="text-cyan-300">{testigosEnPuesto.length}</strong>
                      </span>
                      <span className={`font-black ${isCovered ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isCovered ? 'Cubierto ✅' : 'Pendiente Asignar ⚠️'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: AGREGAR / PERSONALIZAR PUESTO DE VOTACIÓN EN ESTA CIRCUNSCRIPCIÓN */}
      {/* ========================================================================= */}
      {showAddPuestoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <form onSubmit={handleCreateCustomPuesto} className="bg-[#051325] rounded-3xl max-w-[95vw] sm:max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-4 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-cyan-400" />
                <h4 className="font-black text-white text-base">
                  Registrar puesto de votación
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPuestoModal(false)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#020712] rounded-xl border border-cyan-500/20 text-[11px] text-cyan-200">
                📍 <strong>Territorio activo:</strong> {activeTerritoryLabel || 'Pendiente de configurar'}
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre Oficial del Puesto *</label>
                <input
                  type="text"
                  required
                  value={newPuestoNombre}
                  onChange={(e) => setNewPuestoNombre(e.target.value)}
                    placeholder="Ej: Colegio Departamental San José"
                  className="w-full p-2.5 bg-[#020712] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Comuna / Localidad / Corregimiento</label>
                  <input
                    type="text"
                    value={newPuestoComuna}
                    onChange={(e) => setNewPuestoComuna(e.target.value)}
                    placeholder="Ej: Zona Centro / Comuna 01"
                    className="w-full p-2.5 bg-[#020712] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Cantidad Total de Mesas *</label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    required
                    value={newPuestoMesas}
                    onChange={(e) => setNewPuestoMesas(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#020712] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Censo Electoral Estimado (Votantes)</label>
                  <input
                    type="number"
                    value={newPuestoCenso}
                    onChange={(e) => setNewPuestoCenso(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#020712] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Dirección / Sede</label>
                  <input
                    type="text"
                    value={newPuestoDireccion}
                    onChange={(e) => setNewPuestoDireccion(e.target.value)}
                    placeholder="Calle Principal # 10-20"
                    className="w-full p-2.5 bg-[#020712] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setShowAddPuestoModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Incorporar Puesto Electoral</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREDENCIAL OFICIAL DIGITAL E-16 (CARNET CON QR) */}
      {/* ========================================================================= */}
      {selectedWitnessForCard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#051325] rounded-3xl max-w-[95vw] sm:max-w-md w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-5 text-white max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h4 className="font-black text-white text-base">Credencial Oficial de Testigo Electoral</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWitnessForCard(null)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Badge Card */}
            <div className="bg-gradient-to-b from-slate-900 to-[#020b18] border-2 border-cyan-400/60 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 text-center relative overflow-hidden">
              {/* Watermark Logo */}
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Award className="w-32 h-32 text-cyan-400" />
              </div>

              {/* Header Badge */}
              <div className="border-b border-cyan-500/30 pb-3">
                <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest block">
                  REPÚBLICA DE COLOMBIA • REGISTRADURÍA NACIONAL
                </span>
                <h5 className="font-black text-sm text-white mt-0.5">
                  FORMULARIO E-16 • CREDENCIAL OFICIAL
                </h5>
                <span className="text-[9px] text-slate-400 block font-mono">
                  Elecciones territoriales
                </span>
              </div>

              {/* Witness Photo & QR */}
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg border-2 border-cyan-400/60">
                  {selectedWitnessForCard.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div className="p-2 bg-white rounded-xl shadow-md">
                  <QrCode className="w-16 h-16 text-slate-950" />
                </div>
              </div>

              {/* Witness Details */}
              <div className="space-y-2 text-xs text-left bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Nombre del Testigo:</span>
                  <span className="font-extrabold text-white text-sm">{selectedWitnessForCard.nombre}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Cédula:</span>
                    <span className="font-mono font-bold text-cyan-300">{selectedWitnessForCard.cc}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Partido:</span>
                    <span className="font-bold text-slate-200 truncate block">{selectedWitnessForCard.partido}</span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Puesto Asignado:</span>
                    <span className="font-bold text-white text-[11px] truncate block">{selectedWitnessForCard.puesto}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Mesa:</span>
                    <span className="font-black text-emerald-400 text-xs font-mono">{selectedWitnessForCard.mesa}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Candidato / Campaña:</span>
                  <span className="font-bold text-cyan-200 text-[11px]">
                    {candidateName} ({candidateCorporacion} de {candidateMunicipio})
                  </span>
                </div>
              </div>

              {/* Security Seal */}
              <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span>COD-E16: {selectedWitnessForCard.id.toUpperCase()}</span>
                <span className="text-emerald-400 font-bold">Acreditación Verificada ✔</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => handleOpenWhatsApp(selectedWitnessForCard)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Enviar por WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Carnet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FORMULARIO OFICIAL E-16 REGISTRADURÍA */}
      {/* ========================================================================= */}
      {showE16Modal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#051325] rounded-3xl max-w-[95vw] sm:max-w-3xl lg:max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-4 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <h4 className="font-black text-white text-base">
                  Planilla Oficial de Postulación y Acreditación de Testigos (Formulario E-16)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowE16Modal(false)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white text-slate-950 p-4 sm:p-6 rounded-2xl space-y-4 text-xs">
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h3 className="font-black text-sm sm:text-base uppercase">República de Colombia • Consejo Nacional Electoral</h3>
                <h4 className="font-bold text-xs uppercase text-slate-700">Registraduría Nacional del Estado Civil</h4>
                <div className="font-mono text-[11px] font-bold text-indigo-900 mt-1">
                  ACTA DE POSTULACIÓN DE TESTIGOS ELECTORALES - FORMULARIO E-16
                </div>
                <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                  Circunscripción: {candidateCorporacion} de {candidateMunicipio}, Departamento de {candidateDepartamento} • Elecciones 2026
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-100 p-3 rounded-lg text-[11px]">
                <div>
                  <strong>Candidato / Organización:</strong> {candidateName}
                </div>
                <div>
                  <strong>Partido Avalador Principal:</strong> {campaignDossier.partidoUnico || 'Partido Liberal'}
                </div>
                <div>
                  <strong>Municipio / Territorio:</strong> {candidateMunicipio} ({candidateDepartamento})
                </div>
                <div>
                  <strong>Total Testigos Postulados:</strong> {testigos.length}
                </div>
              </div>

              <div className="overflow-x-auto w-full max-w-full">
                <table className="w-full text-left text-[11px] border border-slate-300">
                  <thead className="bg-slate-200 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">#</th>
                      <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Cédula</th>
                      <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Nombre Completo</th>
                      <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Puesto ({candidateMunicipio})</th>
                      <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Mesa</th>
                      <th className="p-1.5 whitespace-nowrap">Acreditación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testigos.map((t, idx) => (
                      <tr key={t.id} className="border-b border-slate-200">
                        <td className="p-1.5 border-r border-slate-300">{idx + 1}</td>
                        <td className="p-1.5 border-r border-slate-300 font-mono">{t.cc}</td>
                        <td className="p-1.5 border-r border-slate-300 font-bold">{t.nombre}</td>
                        <td className="p-1.5 border-r border-slate-300">{t.puesto}</td>
                        <td className="p-1.5 border-r border-slate-300 font-mono font-bold">{t.mesa}</td>
                        <td className="p-1.5">{t.acreditacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 bg-[#030d1d] hover:bg-[#071b38] text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/30 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Formulario E-16</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: IMPORTACIÓN MASIVA DE TESTIGOS */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#051325] rounded-3xl max-w-[95vw] sm:max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-4 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-cyan-400" />
                <h4 className="font-black text-white text-base">
                  Importación masiva de testigos
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300">
                Pegue líneas de texto en formato separado por comas (CSV) con el siguiente orden:
              </p>
              <div className="p-2.5 bg-[#020712] rounded-xl border border-slate-800 font-mono text-[10px] text-cyan-300 overflow-x-auto">
                CEDULA, NOMBRE COMPLETO, TELEFONO, PARTIDO, PUESTO, MESA
              </div>
              <textarea
                rows={6}
                value={importTextData}
                onChange={(e) => setImportTextData(e.target.value)}
                placeholder={`1025889901, Andrés Morales Restrepo, +57 310 111 2233, ${partidosPoliticosOpt[0] || 'Partido Liberal'}, ${puestosTerritorioOpt[0]?.nombre || 'Puesto Central'}, Mesa 01
1025889902, Claudia Patricia Giraldo, +57 312 222 3344, ${partidosPoliticosOpt[0] || 'Partido Liberal'}, ${puestosTerritorioOpt[1]?.nombre || puestosTerritorioOpt[0]?.nombre || 'Puesto Central'}, Mesa 02`}
                className="w-full bg-[#020712] border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-cyan-500/20">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessImportCsv}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Procesar e Incorporar Testigos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BANDEJA DE ALERTAS DE CERCO GPS */}
      {/* ========================================================================= */}
      {showAlertsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#051325] rounded-3xl max-w-[95vw] sm:max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-rose-500/40 space-y-4 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h4 className="font-black text-white text-base">Alertas por Abandono de Cerco Perimetral GPS</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {geofenceAlerts.length === 0 ? (
                <div className="text-center p-6 text-slate-400 text-xs">
                  No hay alertas registradas. Todos los testigos permanecen dentro del cerco perimetral.
                </div>
              ) : (
                geofenceAlerts.map((alt) => (
                  <div key={alt.id} className="p-3 bg-[#030d1f] border border-rose-500/30 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{alt.testigoNombre}</span>
                      <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-700/50">
                        {alt.distanciaMetros}m de distancia
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Puesto: {alt.puesto} • Hora de Alerta: {alt.hora}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGeofenceAlerts(prev => prev.filter(a => a.id !== alt.id));
                          showToast(`Alerta de ${alt.testigoNombre} marcada como justificada.`);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer"
                      >
                        Justificar Salida
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = testigos.find(t => t.id === alt.testigoId);
                          if (target) handleOpenWhatsApp(target);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>Contactar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
