import React, { useState, useEffect, useRef } from 'react';
import { useCampaignData, useCampaignLive } from '../../contexts/CampaignContext';
import { ViewMode, BankTransaction, BudgetItem } from '../../types';
import { supabase } from '../../lib/supabase';
import { isExpectedEmptyCampaignState } from '../../lib/campaignSetupState';
import { 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  Plus, 
  FileText, 
  Download, 
  Search, 
  DollarSign, 
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Building2,
  FileSpreadsheet,
  Award,
  Filter,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  PenSquare,
  Trash2,
  RefreshCw,
  FileCheck,
  Check,
  X,
  FileCode,
  Calendar,
  Share2
} from 'lucide-react';

interface PresupuestoContabilidadProps {
  onSelectView?: (view: ViewMode) => void;
  transactions?: BankTransaction[];
  onOpenAddTransactionModal?: () => void;
  onOpenOCRModal?: () => void;
}

// Initial Colombia CNE Compliant Budget Items (Starts clean from zero for real campaign usage)
const initialBudgetItems: BudgetItem[] = [];

export const PresupuestoContabilidad: React.FC<PresupuestoContabilidadProps> = ({
  onSelectView,
  transactions = [],
  onOpenAddTransactionModal,
  onOpenOCRModal
}) => {
  // Master Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'oficial_cne' | 'borrador_estrategico' | 'gestion_items' | 'ocr_scanner'>('oficial_cne');
  const subTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Contexto global — tope CNE y ejecutado en tiempo real ────────────────────────────
  const liveMetrics = useCampaignLive();

  // Auto-center active sub-tab in horizontal scroll container
  useEffect(() => {
    const activeBtn = subTabRefs.current[activeSubTab];
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeSubTab]);

  // Scroll tabs helper
  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [showSignModal, setShowSignModal] = useState(false);
  const [isSignedCNE, setIsSignedCNE] = useState<boolean>(() => {
    return localStorage.getItem('presupuesto_cne_signed') === 'true';
  });
  const [signAuditHash, setSignAuditHash] = useState<string>(() => {
    return localStorage.getItem('presupuesto_cne_hash') || 'CNE-SHA256-99A82B3F001D4E';
  });

  // Budget Items State with Persistence
  const [items, setItems] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem('presupuesto_items_master_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error reading saved budget items', e);
      }
    }
    return initialBudgetItems;
  });
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSyncError, setBudgetSyncError] = useState('');
  const [campaignBudgetLimit, setCampaignBudgetLimit] = useState<number | null>(null);

  // Save to LocalStorage on every item change
  useEffect(() => {
    localStorage.setItem('presupuesto_items_master_v2', JSON.stringify(items));
  }, [items]);

  const statusToDatabase = (status: BudgetItem['estado']) => {
    if (status === 'Auditado CNE' || status === 'Soportado OCR' || status === 'Ejecutado') return 'VERIFICADO';
    if (status === 'Pendiente Aprobación') return 'OBSERVADO';
    if (status === 'Borrador') return 'REGISTRADO';
    return 'REGISTRADO';
  };

  const parseBudgetItem = (row: any): BudgetItem => {
    let metadata: any = {};
    try { metadata = JSON.parse(row.observaciones || '{}')?.budgetMeta || {}; } catch { metadata = {}; }
    return {
      id: row.id,
      codigoRubro: metadata.codigoRubro || String(row.categoria_cne || '').split(' - ')[0] || '202',
      nombreRubro: metadata.nombreRubro || String(row.categoria_cne || '').replace(/^\d+\s*-\s*/, '') || 'Rubro CNE',
      nombre: row.concepto,
      tipo: row.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto',
      centroCosto: metadata.centroCosto || 'Administración & Sedes',
      montoAsignado: Number(metadata.montoAsignado ?? row.monto ?? 0),
      montoEjecutado: Number(metadata.montoEjecutado ?? row.monto ?? 0),
      estado: metadata.estado || (row.estado === 'VERIFICADO' ? 'Auditado CNE' : row.estado === 'OBSERVADO' ? 'Pendiente Aprobación' : 'Aprobado'),
      terceroNombre: row.beneficiario_nombre || '',
      terceroNit: row.beneficiario_nit || '',
      facturaNumero: row.comprobante_numero || '',
      fechaRegistro: row.fecha || row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      observaciones: metadata.nota || ''
    };
  };

  const budgetItemPayload = (item: BudgetItem) => ({
    client_id: activeClientId,
    campaign_id: activeCampaignId,
    tipo: item.tipo === 'Ingreso' ? 'INGRESO' : 'GASTO',
    categoria_cne: `${item.codigoRubro} - ${item.nombreRubro}`,
    concepto: item.nombre,
    monto: Number(item.montoEjecutado || item.montoAsignado || 0),
    fecha: item.fechaRegistro || new Date().toISOString().slice(0, 10),
    comprobante_numero: item.facturaNumero || null,
    beneficiario_nombre: item.terceroNombre || null,
    beneficiario_nit: item.terceroNit || null,
    estado: statusToDatabase(item.estado),
    observaciones: JSON.stringify({
      budgetMeta: {
        codigoRubro: item.codigoRubro,
        nombreRubro: item.nombreRubro,
        centroCosto: item.centroCosto,
        montoAsignado: Number(item.montoAsignado || 0),
        montoEjecutado: Number(item.montoEjecutado || 0),
        estado: item.estado,
        nota: item.observaciones || ''
      }
    }),
    updated_at: new Date().toISOString()
  });

  const reloadBudgetItems = async (campaignId = activeCampaignId) => {
    if (!campaignId) return;
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    setItems((data || []).map(parseBudgetItem));
  };

  useEffect(() => {
    let mounted = true;
    const loadRealBudget = async () => {
      setBudgetLoading(true);
      setBudgetSyncError('');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let userId = sessionData.session?.user?.id;
        if (!userId) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          userId = refreshed.session?.user?.id;
        }
        if (!userId) throw new Error('Debes iniciar sesión para consultar el presupuesto.');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('client_id,campaign_id')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.client_id && !profile?.campaign_id) throw new Error('El usuario no tiene una organización electoral asignada.');

        const rememberedId = profile?.campaign_id || localStorage.getItem('active_campaign_id');
        let query = supabase.from('campaigns').select('id,client_id,cargo_postulacion,presupuesto_total');
        if (rememberedId) query = query.eq('id', rememberedId);
        else if (profile?.client_id) query = query.eq('client_id', profile.client_id).order('updated_at', { ascending: false });
        let { data: campaigns, error: campaignError } = await query.limit(1);
        if (campaignError) throw campaignError;
        if (!campaigns?.length && profile?.client_id) {
          const fallback = await supabase
            .from('campaigns')
            .select('id,client_id,cargo_postulacion,presupuesto_total')
            .eq('client_id', profile.client_id)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (fallback.error) throw fallback.error;
          campaigns = fallback.data;
        }
        const campaign = campaigns?.[0];
        if (!campaign) throw new Error('No existe una campaña activa accesible para este usuario.');

        if (!mounted) return;
        setActiveClientId(campaign.client_id || profile?.client_id || profile?.campaign_id || null);
        setActiveCampaignId(campaign.id);
        setCampaignBudgetLimit(Number(campaign.presupuesto_total ?? 0));
        localStorage.setItem('active_campaign_id', campaign.id);
        const corporation = campaign.cargo_postulacion === 'JAL' ? 'Ediles' : campaign.cargo_postulacion;
        if (['Alcaldía', 'Gobernación', 'Concejo', 'Asamblea', 'Ediles'].includes(corporation)) {
          setSelectedCorporation(corporation as typeof selectedCorporation);
        }
        await reloadBudgetItems(campaign.id);
      } catch (error: any) {
        if (mounted) setBudgetSyncError(isExpectedEmptyCampaignState(error) ? '' : (error?.message || 'No fue posible cargar el presupuesto desde Supabase.'));
      } finally {
        if (mounted) setBudgetLoading(false);
      }
    };
    void loadRealBudget();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!activeCampaignId) return;
    const channel = supabase
      .channel(`campaign-budget-limit-${activeCampaignId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'campaigns',
        filter: `id=eq.${activeCampaignId}`
      }, (payload: any) => {
        setCampaignBudgetLimit(Number(payload.new?.presupuesto_total ?? 0));
        showNotification('El tope CNE fue actualizado desde la configuración de la campaña.', 'info');
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeCampaignId]);

  // ── Sincronización adicional con el contexto global (ruta rápida) ────────────────────
  // Si el CampaignProvider recibe el cambio de presupuesto_total antes que
  // el canal local, actualiza el límite inmediatamente.
  useEffect(() => {
    if (liveMetrics.budgetLimitCop > 0) {
      setCampaignBudgetLimit(liveMetrics.budgetLimitCop);
    }
  }, [liveMetrics.budgetLimitCop]);

  const [typeFilter, setTypeFilter] = useState<'Todos' | 'Ingreso' | 'Gasto'>('Todos');
  const [centroCostoFilter, setCentroCostoFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Draft Simulator States with Persistence
  const [selectedCorporation, setSelectedCorporation] = useState<'Alcaldía' | 'Gobernación' | 'Concejo' | 'Asamblea' | 'Ediles'>(() => {
    return (localStorage.getItem('presupuesto_corporation') as any) || 'Alcaldía';
  });

  useEffect(() => {
    localStorage.setItem('presupuesto_corporation', selectedCorporation);
  }, [selectedCorporation]);

  const [selectedScenario, setSelectedScenario] = useState<'Pesimista' | 'Base' | 'Optimista'>('Base');
  const [pctPauta, setPctPauta] = useState<number>(35);
  const [pctEventos, setPctEventos] = useState<number>(25);
  const [pctDiaE, setPctDiaE] = useState<number>(20);
  const [pctAdmin, setPctAdmin] = useState<number>(12);
  const [pctJuridico, setPctJuridico] = useState<number>(8);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Item Add/Edit Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formCodigoRubro, setFormCodigoRubro] = useState('202');
  const [formNombre, setFormNombre] = useState('');
  const [formTipo, setFormTipo] = useState<'Ingreso' | 'Gasto'>('Gasto');
  const [formCentroCosto, setFormCentroCosto] = useState<BudgetItem['centroCosto']>('Comunicaciones & Pauta');
  const [formMontoAsignado, setFormMontoAsignado] = useState<number>(10000000);
  const [formMontoEjecutado, setFormMontoEjecutado] = useState<number>(0);
  const [formTerceroNombre, setFormTerceroNombre] = useState('');
  const [formTerceroNit, setFormTerceroNit] = useState('');
  const [formFacturaNumero, setFormFacturaNumero] = useState('');
  const [formEstado, setFormEstado] = useState<BudgetItem['estado']>('Aprobado');

  // OCR Processing Simulator State
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrSuccessData, setOcrSuccessData] = useState<any | null>(null);

  // El único tope válido es el definido al crear o editar la campaña.
  const currentLimit = campaignBudgetLimit ?? 0;

  // Calculated totals
  const totalIngresosAsignados = items.filter(i => i.tipo === 'Ingreso').reduce((acc, curr) => acc + (Number(curr.montoAsignado) || 0), 0);
  const totalIngresosEjecutados = items.filter(i => i.tipo === 'Ingreso').reduce((acc, curr) => acc + (Number(curr.montoEjecutado) || 0), 0);

  const totalGastosAsignados = items.filter(i => i.tipo === 'Gasto').reduce((acc, curr) => acc + (Number(curr.montoAsignado) || 0), 0);
  const totalGastosEjecutados = items.filter(i => i.tipo === 'Gasto').reduce((acc, curr) => acc + (Number(curr.montoEjecutado) || 0), 0);

  const saldoDisponibleCNE = currentLimit - totalGastosEjecutados;
  const rawPctEjecutadoTope = currentLimit > 0 ? Math.round((totalGastosEjecutados / currentLimit) * 100) : 0;
  const pctEjecutadoTope = Math.min(100, rawPctEjecutadoTope);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => {
      setNotificationMsg(null);
    }, 6000);
  };

  // Export Cuentas Claras CSV & Official Format
  const handleExportCuentasClaras = () => {
    const headers = [
      'Codigo Rubro CNE',
      'Nombre Rubro',
      'Concepto Detalle',
      'Tipo (Ingreso/Gasto)',
      'Centro de Costo',
      'Monto Asignado COP',
      'Monto Ejecutado COP',
      'Tercero Razón Social',
      'NIT / Identificacion',
      'Numero Factura / Soporte',
      'Estado Auditoria',
      'Fecha Registro'
    ];

    const rows = items.map(item => [
      `"${item.codigoRubro}"`,
      `"${item.nombreRubro.replace(/"/g, '""')}"`,
      `"${item.nombre.replace(/"/g, '""')}"`,
      `"${item.tipo}"`,
      `"${item.centroCosto}"`,
      item.montoAsignado,
      item.montoEjecutado,
      `"${(item.terceroNombre || '').replace(/"/g, '""')}"`,
      `"${(item.terceroNit || '').replace(/"/g, '""')}"`,
      `"${(item.facturaNumero || '').replace(/"/g, '""')}"`,
      `"${item.estado}"`,
      `"${item.fechaRegistro || new Date().toISOString().split('T')[0]}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cuentas_Claras_CNE_${selectedCorporation}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('✅ Archivo oficial de Cuentas Claras CNE exportado y descargado exitosamente en formato CSV / Excel.', 'success');
  };

  // Open Create Item Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormCodigoRubro('202');
    setFormNombre('');
    setFormTipo('Gasto');
    setFormCentroCosto('Comunicaciones & Pauta');
    setFormMontoAsignado(15000000);
    setFormMontoEjecutado(0);
    setFormTerceroNombre('');
    setFormTerceroNit('');
    setFormFacturaNumero('');
    setFormEstado('Aprobado');
    setShowItemModal(true);
  };

  // Open Edit Item Modal
  const handleOpenEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setFormCodigoRubro(item.codigoRubro);
    setFormNombre(item.nombre);
    setFormTipo(item.tipo);
    setFormCentroCosto(item.centroCosto);
    setFormMontoAsignado(item.montoAsignado);
    setFormMontoEjecutado(item.montoEjecutado);
    setFormTerceroNombre(item.terceroNombre || '');
    setFormTerceroNit(item.terceroNit || '');
    setFormFacturaNumero(item.facturaNumero || '');
    setFormEstado(item.estado);
    setShowItemModal(true);
  };

  // Save Item Handler
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      showNotification('Por favor ingrese el nombre o concepto del ítem de presupuesto.', 'error');
      return;
    }

    const rubroNames: Record<string, string> = {
      '101': 'Aportes Propios del Candidato',
      '102': 'Créditos Entidades Financieras',
      '103': 'Donaciones de Particulares',
      '104': 'Aportes del Partido / Coalición',
      '201': 'Gastos de Administración',
      '202': 'Propaganda Electoral y Publicidad',
      '203': 'Actos Públicos y Eventos',
      '204': 'Transporte y Movilización',
      '205': 'Capacitación Electoral y Testigos',
      '206': 'Gastos de Financiamiento'
    };

    const itemToSave: BudgetItem = editingItem ? {
        ...editingItem,
        codigoRubro: formCodigoRubro,
        nombreRubro: rubroNames[formCodigoRubro] || 'Rubro CNE',
        nombre: formNombre,
        tipo: formTipo,
        centroCosto: formCentroCosto,
        montoAsignado: Number(formMontoAsignado),
        montoEjecutado: Number(formMontoEjecutado),
        terceroNombre: formTerceroNombre,
        terceroNit: formTerceroNit,
        facturaNumero: formFacturaNumero,
        estado: formEstado
      } : {
        id: '',
        codigoRubro: formCodigoRubro,
        nombreRubro: rubroNames[formCodigoRubro] || 'Rubro CNE',
        nombre: formNombre,
        tipo: formTipo,
        centroCosto: formCentroCosto,
        montoAsignado: Number(formMontoAsignado),
        montoEjecutado: Number(formMontoEjecutado),
        estado: formEstado,
        terceroNombre: formTerceroNombre,
        terceroNit: formTerceroNit,
        facturaNumero: formFacturaNumero,
        fechaRegistro: new Date().toISOString().split('T')[0]
      };
    if (!activeCampaignId || !activeClientId) return showNotification('No hay una campaña activa vinculada al presupuesto.', 'error');
    setBudgetSaving(true);
    setBudgetSyncError('');
    try {
      const payload = budgetItemPayload(itemToSave);
      const operation = editingItem
        ? supabase.from('budget_items').update(payload).eq('id', editingItem.id)
        : supabase.from('budget_items').insert(payload);
      const { error } = await operation;
      if (error) throw error;
      await reloadBudgetItems();
      showNotification(editingItem ? `Ítem "${formNombre}" actualizado en Supabase.` : `Nuevo ítem "${formNombre}" registrado en Supabase.`);
      setShowItemModal(false);
    } catch (error: any) {
      setBudgetSyncError(error?.message || 'No fue posible guardar el ítem.');
      showNotification(`No se pudo guardar: ${error?.message || 'error de Supabase'}`, 'error');
    } finally {
      setBudgetSaving(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (confirm(`¿Está seguro de eliminar "${itemToDelete?.nombre || 'este ítem'}" del presupuesto oficial?`)) {
      setBudgetSaving(true);
      const { error } = await supabase.from('budget_items').delete().eq('id', id);
      setBudgetSaving(false);
      if (error) return showNotification(`No se pudo eliminar: ${error.message}`, 'error');
      setItems(prev => prev.filter(i => i.id !== id));
      showNotification('Ítem eliminado del presupuesto y de Supabase.', 'info');
    }
  };

  // Toggle item audit status quickly
  const handleCycleStatus = async (id: string) => {
    const statuses: BudgetItem['estado'][] = ['Borrador', 'Pendiente Aprobación', 'Aprobado', 'Soportado OCR', 'Auditado CNE'];
    const current = items.find(item => item.id === id);
    if (!current) return;
    const nextStatus = statuses[(statuses.indexOf(current.estado) + 1) % statuses.length];
    const updated: BudgetItem = { ...current, estado: nextStatus };
    const { error } = await supabase.from('budget_items').update(budgetItemPayload(updated)).eq('id', id);
    if (error) return showNotification(`No se pudo cambiar el estado: ${error.message}`, 'error');
    setItems(prev => prev.map(item => item.id === id ? updated : item));
  };

  // Load Preset Template for Draft
  const handleLoadDraftTemplate = async () => {
    const scenarioMultiplier = selectedScenario === 'Pesimista' ? 0.40 : selectedScenario === 'Base' ? 0.75 : 0.95;
    const baseAmount = currentLimit * scenarioMultiplier;

    const newDraftItems: BudgetItem[] = [
      {
        id: 'drf-' + Date.now() + '-1',
        codigoRubro: '202',
        nombreRubro: 'Propaganda Electoral y Publicidad',
        nombre: `[Borrador ${selectedCorporation}] Pauta Digital, Vallas y Materiales Impresos`,
        tipo: 'Gasto',
        centroCosto: 'Comunicaciones & Pauta',
        montoAsignado: Math.round((baseAmount * pctPauta) / 100),
        montoEjecutado: 0,
        estado: 'Borrador',
        fechaRegistro: new Date().toISOString().split('T')[0]
      },
      {
        id: 'drf-' + Date.now() + '-2',
        codigoRubro: '203',
        nombreRubro: 'Actos Públicos y Eventos',
        nombre: `[Borrador ${selectedCorporation}] Eventos de Lanzamiento, Tarimas y Sonido`,
        tipo: 'Gasto',
        centroCosto: 'Eventos & Logística',
        montoAsignado: Math.round((baseAmount * pctEventos) / 100),
        montoEjecutado: 0,
        estado: 'Borrador',
        fechaRegistro: new Date().toISOString().split('T')[0]
      },
      {
        id: 'drf-' + Date.now() + '-3',
        codigoRubro: '205',
        nombreRubro: 'Capacitación Electoral y Testigos',
        nombre: `[Borrador ${selectedCorporation}] Kits y Logística de Testigos Día E`,
        tipo: 'Gasto',
        centroCosto: 'Operación Día E',
        montoAsignado: Math.round((baseAmount * pctDiaE) / 100),
        montoEjecutado: 0,
        estado: 'Borrador',
        fechaRegistro: new Date().toISOString().split('T')[0]
      },
      {
        id: 'drf-' + Date.now() + '-4',
        codigoRubro: '201',
        nombreRubro: 'Gastos de Administración',
        nombre: `[Borrador ${selectedCorporation}] Arriendo Sedes y Servicios Administrativos`,
        tipo: 'Gasto',
        centroCosto: 'Administración & Sedes',
        montoAsignado: Math.round((baseAmount * pctAdmin) / 100),
        montoEjecutado: 0,
        estado: 'Borrador',
        fechaRegistro: new Date().toISOString().split('T')[0]
      },
      {
        id: 'drf-' + Date.now() + '-5',
        codigoRubro: '206',
        nombreRubro: 'Gastos de Financiamiento',
        nombre: `[Borrador ${selectedCorporation}] Asesoría Jurídica y Póliza de Cumplimiento CNE`,
        tipo: 'Gasto',
        centroCosto: 'Estrategia Jurídica',
        montoAsignado: Math.round((baseAmount * pctJuridico) / 100),
        montoEjecutado: 0,
        estado: 'Borrador',
        fechaRegistro: new Date().toISOString().split('T')[0]
      }
    ];

    if (!activeCampaignId || !activeClientId) return showNotification('No hay campaña activa.', 'error');
    setBudgetSaving(true);
    try {
      const oldDraftIds = items.filter(i => i.estado === 'Borrador').map(i => i.id);
      if (oldDraftIds.length) {
        const { error: deleteError } = await supabase.from('budget_items').delete().in('id', oldDraftIds);
        if (deleteError) throw deleteError;
      }
      const { error } = await supabase.from('budget_items').insert(newDraftItems.map(budgetItemPayload));
      if (error) throw error;
      await reloadBudgetItems();
      showNotification(`✅ Plantilla guardada en Supabase para [${selectedCorporation} - ${selectedScenario}]. Presupuesto proyectado: $${baseAmount.toLocaleString()} COP.`);
    } catch (error: any) {
      showNotification(`No se pudo crear el borrador: ${error?.message || 'error de Supabase'}`, 'error');
    } finally {
      setBudgetSaving(false);
    }
  };

  // Convert Draft to Official
  const handleApproveDraft = async () => {
    const draftCount = items.filter(i => i.estado === 'Borrador').length;
    if (draftCount === 0) {
      showNotification('No hay ítems en estado Borrador para convertir. Primero cargue o cree una plantilla borrador.', 'info');
      return;
    }
    setBudgetSaving(true);
    try {
      const drafts = items.filter(item => item.estado === 'Borrador');
      const results = await Promise.all(drafts.map(item => {
        const approved = { ...item, estado: 'Aprobado' as const };
        return supabase.from('budget_items').update(budgetItemPayload(approved)).eq('id', item.id);
      }));
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
      await reloadBudgetItems();
      showNotification(`🎉 Se formalizaron ${draftCount} ítems en Supabase como Presupuesto Oficial CNE.`);
    } catch (error: any) {
      showNotification(`No se pudo aprobar el borrador: ${error?.message || 'error de Supabase'}`, 'error');
    } finally {
      setBudgetSaving(false);
    }
  };

  // Interactive OCR Process Simulation
  const handleExecuteOCRScan = (file?: File) => {
    setIsProcessingOCR(true);
    setOcrSuccessData(null);

    setTimeout(() => {
      const sampleInvoices = [
        {
          tercero: 'Publicidad & Medios Colombia S.A.S.',
          nit: 'NIT 900.555.333-1',
          factura: `FE-${Math.floor(10000 + Math.random() * 90000)}`,
          monto: 14500000,
          rubroCod: '202',
          rubroNom: 'Propaganda Electoral y Publicidad',
          centro: 'Comunicaciones & Pauta',
          concepto: 'Pauta Radial y Vallas Digitales Comunas 1 a 10'
        },
        {
          tercero: 'Proveedor de transporte',
          nit: 'NIT 890.222.111-4',
          factura: `FE-${Math.floor(10000 + Math.random() * 90000)}`,
          monto: 8200000,
          rubroCod: '204',
          rubroNom: 'Transporte y Movilización',
          centro: 'Operación Territorial',
          concepto: 'Transporte y Caravana Recorridos Territoriales'
        },
        {
          tercero: 'Servicios Gastronómicos & Eventos S.A.S.',
          nit: 'NIT 901.888.222-9',
          factura: `FE-${Math.floor(10000 + Math.random() * 90000)}`,
          monto: 5800000,
          rubroCod: '203',
          rubroNom: 'Actos Públicos y Eventos',
          centro: 'Eventos & Logística',
          concepto: 'Refrigerios y Logística Acto Público Comuna 13'
        }
      ];

      const selected = sampleInvoices[Math.floor(Math.random() * sampleInvoices.length)];
      setIsProcessingOCR(false);
      setOcrSuccessData(selected);
    }, 1500);
  };

  // Add Extracted OCR to real budget
  const handleAddOCRToBudget = async () => {
    if (!ocrSuccessData) return;

    const newItem: BudgetItem = {
      id: 'ocr-' + Date.now(),
      codigoRubro: ocrSuccessData.rubroCod,
      nombreRubro: ocrSuccessData.rubroNom,
      nombre: ocrSuccessData.concepto,
      tipo: 'Gasto',
      centroCosto: ocrSuccessData.centro as any,
      montoAsignado: ocrSuccessData.monto,
      montoEjecutado: ocrSuccessData.monto,
      estado: 'Soportado OCR',
      terceroNombre: ocrSuccessData.tercero,
      terceroNit: ocrSuccessData.nit,
      facturaNumero: ocrSuccessData.factura,
      fechaRegistro: new Date().toISOString().split('T')[0]
    };

    if (!activeCampaignId || !activeClientId) return showNotification('No hay campaña activa.', 'error');
    setBudgetSaving(true);
    const { error } = await supabase.from('budget_items').insert(budgetItemPayload(newItem));
    setBudgetSaving(false);
    if (error) return showNotification(`No se pudo registrar la factura: ${error.message}`, 'error');
    await reloadBudgetItems();
    showNotification(`Factura ${ocrSuccessData.factura} registrada y soportada en Supabase.`);
    setOcrSuccessData(null);
  };

  // Sign Digital CNE Certificate
  const handleSignOfficialCNE = () => {
    const generatedHash = 'CNE-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString().slice(-6);
    setIsSignedCNE(true);
    setSignAuditHash(generatedHash);
    localStorage.setItem('presupuesto_cne_signed', 'true');
    localStorage.setItem('presupuesto_cne_hash', generatedHash);
    setShowSignModal(false);
    showNotification('✅ Certificación y Firma Digital estampada con éxito ante el sistema de Cuentas Claras CNE.');
  };

  // Reset Budget items to defaults
  const handleResetDefaults = async () => {
    if (confirm('¿Desea restaurar los datos iniciales de presupuesto y topes CNE?')) {
      if (!activeCampaignId) return showNotification('No hay campaña activa.', 'error');
      const { error } = await supabase.from('budget_items').delete().eq('campaign_id', activeCampaignId);
      if (error) return showNotification(`No se pudo limpiar el presupuesto: ${error.message}`, 'error');
      setItems(initialBudgetItems);
      localStorage.removeItem('presupuesto_items_master_v2');
      showNotification('Presupuesto restaurado a valores estándar CNE.', 'info');
    }
  };

  // Filtered Budget Items
  const filteredItems = items.filter(item => {
    const matchesType = typeFilter === 'Todos' || item.tipo === typeFilter;
    const matchesCentro = centroCostoFilter === 'Todos' || item.centroCosto === centroCostoFilter;
    const matchesStatus = statusFilter === 'Todos' || item.estado === statusFilter;
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.codigoRubro.includes(searchTerm) || 
                          (item.terceroNombre && item.terceroNombre.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesCentro && matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#020712] text-slate-200 p-4 md:p-8 space-y-6 animate-fadeIn">
      
      {/* Toast Notification */}
      {notificationMsg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xl border animate-fadeIn ${
          notificationMsg.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
          notificationMsg.type === 'error' ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' :
          'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
        }`}>
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            <span>{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="p-1 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {(budgetLoading || budgetSaving || budgetSyncError) && (
        <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
          budgetSyncError
            ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200'
        }`}>
          {budgetSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>
            {budgetLoading
              ? 'Cargando libro presupuestal real desde Supabase...'
              : budgetSaving
                ? 'Sincronizando movimiento con Supabase...'
                : `Sincronización pendiente: ${budgetSyncError}`}
          </span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-[#030d1d] text-white rounded-2xl p-5 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Presupuesto de Campaña & Rendición Oficial</span>
              {isSignedCNE && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" /> Certificado CNE Activo
                </span>
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCuentasClaras}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Cuentas Claras (CSV)</span>
            </button>
            <button
              onClick={handleResetDefaults}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
              title="Restaurar valores de ejemplo CNE"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation Bar (Professional Clean Design without crude scrollbar) */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-2 relative">
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScrollTabs('left')}
            className="hidden sm:flex items-center justify-center p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 shadow-md transition-all cursor-pointer shrink-0"
            title="Desplazar a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Clean Scroll Container */}
          <div 
            ref={tabsContainerRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto text-xs font-semibold scroll-smooth py-1 px-1 no-scrollbar rounded-xl"
          >
            {[
              { id: 'oficial_cne', label: '1. Presupuesto Oficial CNE & Cuentas Claras', icon: <Building2 className="w-4 h-4" /> },
              { id: 'borrador_estrategico', label: '2. Plantilla Borrador & Simulador', icon: <FileSpreadsheet className="w-4 h-4" /> },
              { id: 'gestion_items', label: '3. Gestión Integral de Ítems (' + items.length + ')', icon: <Layers className="w-4 h-4" /> },
              { id: 'ocr_scanner', label: '4. Escáner OCR & Comprobantes IA', icon: <Sparkles className="w-4 h-4 text-teal-300" /> }
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={el => { subTabRefs.current[tab.id] = el; }}
                  id={`subtab-btn-${tab.id}`}
                  onClick={(e) => {
                    setActiveSubTab(tab.id as any);
                    e.currentTarget.scrollIntoView({
                      behavior: 'smooth',
                      inline: 'center',
                      block: 'nearest'
                    });
                  }}
                  className={`px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2.5 cursor-pointer shrink-0 select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] font-black border border-indigo-400/80 ring-1 ring-white/20'
                      : 'bg-[#020712]/90 text-slate-300 hover:text-white hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScrollTabs('right')}
            className="hidden sm:flex items-center justify-center p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 shadow-md transition-all cursor-pointer shrink-0"
            title="Desplazar a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* SUB-TAB 1: PRESUPUESTO OFICIAL CNE & RENDICIÓN DE CUENTAS CLARAS */}
      {/* ---------------------------------------------------------------------- */}
      {activeSubTab === 'oficial_cne' && (
        <div className="space-y-6">
          
          {/* Executive Legal Limit & Progress Meter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-[#030d1d] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col justify-between space-y-2.5 min-w-0">
              <span className="text-xs font-bold text-slate-400 block truncate" title="Tope Máximo CNE Ley 1475">Tope Máximo CNE Ley 1475</span>
              <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                <span className={`text-lg sm:text-xl xl:text-2xl font-black tracking-tight break-all sm:break-normal ${currentLimit > 0 ? 'text-white' : 'text-amber-300'}`}>
                  {currentLimit > 0 ? `$${currentLimit.toLocaleString()}` : 'Sin definir'}
                </span>
                {currentLimit > 0 && <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0">COP</span>}
              </div>
              <div>
                <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/50 font-bold px-2 py-0.5 rounded inline-block truncate max-w-full">
                  Jurisdicción: {selectedCorporation || 'Sin corporación seleccionada'}
                </span>
              </div>
            </div>

            <div className="bg-[#030d1d] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col justify-between space-y-2.5 min-w-0">
              <span className="text-xs font-bold text-slate-400 block truncate" title="Ingresos Recaudados y Validados">Ingresos Recaudados y Validados</span>
              <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                <span className="text-lg sm:text-xl xl:text-2xl font-black text-emerald-400 tracking-tight break-all sm:break-normal">
                  ${totalIngresosEjecutados.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-emerald-400/80 font-mono shrink-0">COP</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate" title="Aportes propios, donaciones y crédito bancario">
                Aportes propios, donaciones y crédito bancario
              </div>
            </div>

            <div className="bg-[#030d1d] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col justify-between space-y-2.5 min-w-0">
              <span className="text-xs font-bold text-slate-400 block truncate" title="Gastos Ejecutados Reales">Gastos Ejecutados Reales</span>
              <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                <span className="text-lg sm:text-xl xl:text-2xl font-black text-white tracking-tight break-all sm:break-normal">
                  ${totalGastosEjecutados.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0">COP</span>
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${pctEjecutadoTope > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pctEjecutadoTope}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>{currentLimit > 0 ? `${rawPctEjecutadoTope}% del tope ejecutado` : 'Tope pendiente de configuración'}</span>
                  <span className={rawPctEjecutadoTope > 100 || currentLimit === 0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-bold'}>
                    {currentLimit === 0 ? '⚠️ SIN TOPE' : rawPctEjecutadoTope > 100 ? '⚠️ EXCEDIDO' : 'OK CNE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#030d1d] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm flex flex-col justify-between space-y-2.5 min-w-0">
              <span className="text-xs font-bold text-slate-400 block truncate" title="Saldo Disponible sin Exceder Tope">Saldo Disponible sin Exceder Tope</span>
              <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                <span className={`text-lg sm:text-xl xl:text-2xl font-black tracking-tight break-all sm:break-normal ${
                  saldoDisponibleCNE < 0 || currentLimit === 0 ? 'text-rose-400' : 'text-cyan-400'
                }`}>
                  {currentLimit > 0 ? `$${saldoDisponibleCNE.toLocaleString()}` : 'Sin calcular'}
                </span>
                {currentLimit > 0 && <span className="text-[11px] font-bold text-cyan-400/80 font-mono shrink-0">COP</span>}
              </div>
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block truncate max-w-full border ${
                  saldoDisponibleCNE < 0 || currentLimit === 0
                    ? 'text-rose-300 bg-rose-950/60 border-rose-700/50' 
                    : 'text-emerald-300 bg-emerald-950/60 border-emerald-700/50'
                }`}>
                  {currentLimit === 0 ? 'Defina el tope al crear o editar la campaña' : saldoDisponibleCNE < 0 ? 'Tope Excedido - Alerta Legal' : 'Cumplimiento CNE Garantizado'}
                </span>
              </div>
            </div>

          </div>

          {/* Statutory CNE Rubros Table */}
          <div className="bg-[#030d1d] rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  Rubros Oficiales CNE - Formato Cuentas Claras (Candidatos y Partidos)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenCreateModal}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Movimiento / Ítem</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#020712]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800">
                    <th className="p-3 whitespace-nowrap">Código CNE</th>
                    <th className="p-3 whitespace-nowrap">Nombre Oficial del Rubro CNE</th>
                    <th className="p-3 whitespace-nowrap">Tipo</th>
                    <th className="p-3 text-right whitespace-nowrap">Asignado</th>
                    <th className="p-3 text-right whitespace-nowrap">Ejecutado</th>
                    <th className="p-3 text-right whitespace-nowrap">Diferencia</th>
                    <th className="p-3 text-center whitespace-nowrap">Estado Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {[
                    { cod: '101', nom: 'Aportes Propios del Candidato', tipo: 'Ingreso' },
                    { cod: '102', nom: 'Créditos de Entidades Financieras', tipo: 'Ingreso' },
                    { cod: '103', nom: 'Donaciones de Particulares', tipo: 'Ingreso' },
                    { cod: '104', nom: 'Aportes de Partidos y Coaliciones', tipo: 'Ingreso' },
                    { cod: '201', nom: 'Gastos de Administración (Sedes y Asesores)', tipo: 'Gasto' },
                    { cod: '202', nom: 'Propaganda Electoral y Publicidad', tipo: 'Gasto' },
                    { cod: '203', nom: 'Actos Públicos y Eventos de Campaña', tipo: 'Gasto' },
                    { cod: '204', nom: 'Transporte y Movilización Territorial', tipo: 'Gasto' },
                    { cod: '205', nom: 'Capacitación Electoral y Testigos Día E', tipo: 'Gasto' },
                    { cod: '206', nom: 'Gastos de Financiamiento e Intereses', tipo: 'Gasto' }
                  ].map(rubro => {
                    const rubroItems = items.filter(i => i.codigoRubro === rubro.cod);
                    const asignado = rubroItems.reduce((acc, curr) => acc + (Number(curr.montoAsignado) || 0), 0);
                    const ejecutado = rubroItems.reduce((acc, curr) => acc + (Number(curr.montoEjecutado) || 0), 0);
                    const dif = asignado - ejecutado;

                    return (
                      <tr key={rubro.cod} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-amber-400">{rubro.cod}</td>
                        <td className="p-3 font-bold text-white">{rubro.nom}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border whitespace-nowrap ${
                            rubro.tipo === 'Ingreso' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {rubro.tipo}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-300">${asignado.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-white">${ejecutado.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-emerald-400 font-bold">${dif.toLocaleString()}</td>
                        <td className="p-3 text-center min-w-[100px]">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border whitespace-nowrap ${
                            ejecutado > 0 ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                            {ejecutado > 0 ? 'Auditado CNE' : 'Sin Ejecución'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SUB-TAB 2: PLANTILLA BORRADOR & SIMULADOR ESTRATÉGICO */}
      {/* ---------------------------------------------------------------------- */}
      {activeSubTab === 'borrador_estrategico' && (
        <div className="space-y-6">
          
          <div className="bg-[#030d1d] rounded-2xl p-6 border border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                  Plantilla de Borrador & Simulador Financiero Interno
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleLoadDraftTemplate}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Cargar Plantilla Sugerida</span>
                </button>

                <button
                  onClick={handleApproveDraft}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Convertir a Presupuesto Oficial</span>
                </button>
              </div>
            </div>

            {/* Selectors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#020712] p-4 rounded-2xl border border-purple-900/40">
              
              {/* Corporation Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Campaña / Corporación *</label>
                <select
                  value={selectedCorporation}
                  disabled
                  className="w-full bg-[#030d1d] border border-purple-700/50 rounded-xl px-3 py-2 font-bold text-xs text-white opacity-80 cursor-not-allowed"
                >
                  <option value="Alcaldía">Alcaldía Municipal</option>
                  <option value="Gobernación">Gobernación Departamental</option>
                  <option value="Concejo">Concejo Municipal</option>
                  <option value="Asamblea">Asamblea Departamental</option>
                  <option value="Ediles">Ediles / JAL</option>
                </select>
                <p className="text-[10px] text-purple-300/80 mt-1">La corporación y el tope se heredan de la campaña activa y no pueden alterarse desde este simulador.</p>
              </div>

              {/* Scenario Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Escenario de Recaudación / Simulación *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Pesimista', 'Base', 'Optimista'] as const).map(sc => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => {
                        setSelectedScenario(sc);
                        showNotification(`Escenario ajustado a: ${sc} (${sc === 'Pesimista' ? '40%' : sc === 'Base' ? '75%' : '95%'} del tope legal)`, 'info');
                      }}
                      className={`py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                        selectedScenario === sc
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-[#030d1d] border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {sc} ({sc === 'Pesimista' ? '40%' : sc === 'Base' ? '75%' : '95%'})
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Cost Centers Allocation Sliders */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
                Distribución Porcentual por Centros de Costos
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Comunicaciones */}
                <div className="bg-[#020712] p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">1. Comunicaciones, Pauta & Imprenta</span>
                    <span className="text-purple-400 font-mono">{pctPauta}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={pctPauta}
                    onChange={(e) => setPctPauta(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="text-[10px] text-slate-400 font-mono">
                    Monto Estimado: ${Math.round(((currentLimit * (selectedScenario === 'Pesimista' ? 0.4 : selectedScenario === 'Base' ? 0.75 : 0.95)) * pctPauta) / 100).toLocaleString()} COP
                  </div>
                </div>

                {/* Eventos */}
                <div className="bg-[#020712] p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">2. Eventos Públicos & Logística</span>
                    <span className="text-purple-400 font-mono">{pctEventos}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={pctEventos}
                    onChange={(e) => setPctEventos(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="text-[10px] text-slate-400 font-mono">
                    Monto Estimado: ${Math.round(((currentLimit * (selectedScenario === 'Pesimista' ? 0.4 : selectedScenario === 'Base' ? 0.75 : 0.95)) * pctEventos) / 100).toLocaleString()} COP
                  </div>
                </div>

                {/* Operación Día E */}
                <div className="bg-[#020712] p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">3. Operación Día E (Testigos & Logística)</span>
                    <span className="text-purple-400 font-mono">{pctDiaE}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={pctDiaE}
                    onChange={(e) => setPctDiaE(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="text-[10px] text-slate-400 font-mono">
                    Monto Estimado: ${Math.round(((currentLimit * (selectedScenario === 'Pesimista' ? 0.4 : selectedScenario === 'Base' ? 0.75 : 0.95)) * pctDiaE) / 100).toLocaleString()} COP
                  </div>
                </div>

                {/* Administración */}
                <div className="bg-[#020712] p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">4. Administración, Sedes & Staff</span>
                    <span className="text-purple-400 font-mono">{pctAdmin}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={pctAdmin}
                    onChange={(e) => setPctAdmin(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="text-[10px] text-slate-400 font-mono">
                    Monto Estimado: ${Math.round(((currentLimit * (selectedScenario === 'Pesimista' ? 0.4 : selectedScenario === 'Base' ? 0.75 : 0.95)) * pctAdmin) / 100).toLocaleString()} COP
                  </div>
                </div>

              </div>
            </div>

            {/* Current Draft Items Table */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h4 className="font-extrabold text-white text-sm">
                Lista de Ítems en Borrador Estratégico
              </h4>

              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#020712]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800">
                      <th className="p-3 whitespace-nowrap">Rubro CNE</th>
                      <th className="p-3 whitespace-nowrap">Concepto / Ítem Borrador</th>
                      <th className="p-3 whitespace-nowrap">Centro de Costo</th>
                      <th className="p-3 text-right whitespace-nowrap">Monto Estimado</th>
                      <th className="p-3 text-center whitespace-nowrap">Estado</th>
                      <th className="p-3 text-right whitespace-nowrap">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {items.filter(i => i.estado === 'Borrador').map(drf => (
                      <tr key={drf.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-purple-400">{drf.codigoRubro}</td>
                        <td className="p-3 font-bold text-white">{drf.nombre}</td>
                        <td className="p-3 text-slate-300">{drf.centroCosto}</td>
                        <td className="p-3 text-right font-mono font-bold text-purple-300">${drf.montoAsignado.toLocaleString()} COP</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-700/50 text-[10px] font-bold rounded">
                            Borrador
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setItems(prev => prev.map(i => i.id === drf.id ? { ...i, estado: 'Aprobado' } : i));
                              showNotification(`Ítem "${drf.nombre}" aprobado e incorporado al presupuesto oficial.`);
                            }}
                            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/40 font-bold text-[10px] transition-all cursor-pointer"
                          >
                            Aprobar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.filter(i => i.estado === 'Borrador').length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          No hay ítems en estado borrador. Haga clic en &quot;Cargar Plantilla Sugerida&quot; para generar la proyección borrador automática.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SUB-TAB 3: GESTIÓN INTEGRAL DE ÍTEMS DE PRESUPUESTO (MAESTRO) */}
      {/* ---------------------------------------------------------------------- */}
      {activeSubTab === 'gestion_items' && (
        <div className="space-y-6">
          
          <div className="bg-[#030d1d] rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  Gestión Integral Maestro de Ítems de Presupuesto
                </h3>
              </div>

              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Crear Nuevo Ítem</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#020712] p-3 rounded-xl border border-slate-800">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar ítem o tercero..."
                  className="w-full bg-[#030d1d] border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full bg-[#030d1d] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="Todos">Todos los Tipos (Ingresos y Gastos)</option>
                  <option value="Ingreso">Solo Ingresos</option>
                  <option value="Gasto">Solo Gastos</option>
                </select>
              </div>

              {/* Centro Costo Filter */}
              <div>
                <select
                  value={centroCostoFilter}
                  onChange={(e) => setCentroCostoFilter(e.target.value)}
                  className="w-full bg-[#030d1d] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="Todos">Todos los Centros de Costo</option>
                  <option value="Comunicaciones & Pauta">Comunicaciones & Pauta</option>
                  <option value="Operación Territorial">Operación Territorial</option>
                  <option value="Operación Día E">Operación Día E</option>
                  <option value="Administración & Sedes">Administración & Sedes</option>
                  <option value="Estrategia Jurídica">Estrategia Jurídica</option>
                  <option value="Eventos & Logística">Eventos & Logística</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#030d1d] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="Todos">Todos los Estados</option>
                  <option value="Borrador">Borrador</option>
                  <option value="Pendiente Aprobación">Pendiente Aprobación</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Soportado OCR">Soportado OCR</option>
                  <option value="Auditado CNE">Auditado CNE</option>
                </select>
              </div>

            </div>

            {/* Master Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#020712]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800">
                    <th className="p-3 whitespace-nowrap">CNE</th>
                    <th className="p-3 whitespace-nowrap">Concepto / Ítem Presupuestal</th>
                    <th className="p-3 whitespace-nowrap">Tipo & Centro Costo</th>
                    <th className="p-3 whitespace-nowrap">Tercero / Proveedor</th>
                    <th className="p-3 text-right whitespace-nowrap">Asignado</th>
                    <th className="p-3 text-right whitespace-nowrap">Ejecutado</th>
                    <th className="p-3 text-center whitespace-nowrap">Estado</th>
                    <th className="p-3 text-right whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-emerald-400">{item.codigoRubro}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{item.nombre}</div>
                        <div className="text-[10px] text-slate-400">{item.nombreRubro} • Fac: {item.facturaNumero || 'N/A'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded block w-fit mb-0.5 border whitespace-nowrap ${
                          item.tipo === 'Ingreso' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {item.tipo}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.centroCosto}</span>
                      </td>
                      <td className="p-3">
                        {item.terceroNombre ? (
                          <div>
                            <div className="font-bold text-white text-[11px]">{item.terceroNombre}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.terceroNit}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No asignado</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">${item.montoAsignado.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-white">${item.montoEjecutado.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleCycleStatus(item.id)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer hover:scale-105 transition-all ${
                            item.estado === 'Auditado CNE' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' :
                            item.estado === 'Soportado OCR' ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50' :
                            item.estado === 'Aprobado' ? 'bg-purple-950/60 text-purple-300 border-purple-700/50' :
                            item.estado === 'Pendiente Aprobación' ? 'bg-amber-950/60 text-amber-300 border-amber-700/50' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                          title="Haga clic para avanzar de estado de auditoría"
                        >
                          {item.estado}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer border border-slate-700"
                            title="Editar"
                          >
                            <PenSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded cursor-pointer border border-rose-800/50"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        No se encontraron ítems de presupuesto con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* SUB-TAB 4: ESCÁNER OCR & COMPROBANTES IA */}
      {/* ---------------------------------------------------------------------- */}
      {activeSubTab === 'ocr_scanner' && (
        <div className="space-y-6">
          <div className="bg-[#030d1d] rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  Lectura Inteligente IA & Escáner OCR de Facturas Electrónicas
                </h3>
              </div>

              <span className="px-3 py-1 bg-teal-950/60 text-teal-300 font-bold text-xs rounded-xl border border-teal-700/50 w-fit">
                Lector DIAN + CNE Activo
              </span>
            </div>

            {/* Drag and Drop Zone with input */}
            <div className="bg-[#020712] border-2 border-dashed border-teal-500/40 hover:border-teal-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-teal-950/20">
              <div className="w-12 h-12 rounded-full bg-teal-950/80 border border-teal-600/50 text-teal-400 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-white">
                Arrastre o seleccione comprobantes de pago aquí (PDF, XML DIAN, JPG)
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                El sistema extraerá automáticamente: NIT del Tercero, Número de Factura, Subtotal, IVA, Retención en la Fuente y clasificará en el Rubro CNE correspondiente.
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <label className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow cursor-pointer flex items-center gap-2 transition-all">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span>{isProcessingOCR ? 'Procesando OCR con IA...' : 'Escanear Nuevo Comprobante'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleExecuteOCRScan(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleExecuteOCRScan()}
                  disabled={isProcessingOCR}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                >
                  {isProcessingOCR ? 'Leyendo documento...' : 'Ejecutar Escaneo Rápido de Prueba'}
                </button>
              </div>
            </div>

            {/* OCR Process Result Preview */}
            {ocrSuccessData && (
              <div className="p-4 bg-[#041733] border border-teal-500/50 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-teal-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                    <h4 className="font-extrabold text-white text-sm">Comprobante Extraído con Éxito (100% Legible)</h4>
                  </div>
                  <span className="text-[10px] font-mono text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-600">
                    CNE Match 99.4%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Proveedor / Razón Social:</span>
                    <span className="font-bold text-white">{ocrSuccessData.tercero}</span>
                    <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{ocrSuccessData.nit}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Número Factura / Doc:</span>
                    <span className="font-bold text-white font-mono">{ocrSuccessData.factura}</span>
                    <span className="text-[10px] text-emerald-400 block font-bold mt-0.5">Válida DIAN</span>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Monto Extraído:</span>
                    <span className="font-extrabold text-emerald-400 font-mono text-sm">${ocrSuccessData.monto.toLocaleString()} COP</span>
                    <span className="text-[10px] text-slate-400 block">IVA Incluido</span>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Rubro Sugerido CNE:</span>
                    <span className="font-bold text-amber-300">{ocrSuccessData.rubroCod} - {ocrSuccessData.rubroNom}</span>
                    <span className="text-[10px] text-slate-400 block">{ocrSuccessData.centro}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-teal-500/20">
                  <button
                    type="button"
                    onClick={() => setOcrSuccessData(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddOCRToBudget}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Incorporar a Presupuesto Oficial</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: CREAR / EDITAR ÍTEM DE PRESUPUESTO */}
      {/* ---------------------------------------------------------------------- */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#030d1d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">
                    {editingItem ? 'Editar Ítem de Presupuesto' : 'Crear Nuevo Ítem de Presupuesto'}
                  </h4>
                  <p className="text-[10px] text-slate-400">Asignación codificada según normatividad CNE</p>
                </div>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Tipo de Registro *</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as any)}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Gasto">Gasto / Egreso</option>
                    <option value="Ingreso">Ingreso / Aporte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Código Rubro CNE *</label>
                  <select
                    value={formCodigoRubro}
                    onChange={(e) => setFormCodigoRubro(e.target.value)}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="101">101 - Aportes Propios Candidato</option>
                    <option value="102">102 - Créditos Bancarios</option>
                    <option value="103">103 - Donaciones Particulares</option>
                    <option value="104">104 - Aportes del Partido</option>
                    <option value="201">201 - Gastos de Administración</option>
                    <option value="202">202 - Propaganda Electoral</option>
                    <option value="203">203 - Actos Públicos y Eventos</option>
                    <option value="204">204 - Transporte y Movilización</option>
                    <option value="205">205 - Capacitación Electoral / Testigos</option>
                    <option value="206">206 - Gastos de Financiamiento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">Concepto / Nombre del Ítem *</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Impresión de 50.000 Volantes Comunas Norte"
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Centro de Costo *</label>
                  <select
                    value={formCentroCosto}
                    onChange={(e) => setFormCentroCosto(e.target.value as any)}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Comunicaciones & Pauta">Comunicaciones & Pauta</option>
                    <option value="Operación Territorial">Operación Territorial</option>
                    <option value="Operación Día E">Operación Día E</option>
                    <option value="Administración & Sedes">Administración & Sedes</option>
                    <option value="Estrategia Jurídica">Estrategia Jurídica</option>
                    <option value="Eventos & Logística">Eventos & Logística</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Estado de Auditoría *</label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value as any)}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Borrador">Borrador</option>
                    <option value="Pendiente Aprobación">Pendiente Aprobación</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Soportado OCR">Soportado OCR</option>
                    <option value="Auditado CNE">Auditado CNE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Monto Asignado (COP) *</label>
                  <input
                    type="number"
                    required
                    value={formMontoAsignado}
                    onChange={(e) => setFormMontoAsignado(Number(e.target.value))}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Monto Ejecutado Real (COP)</label>
                  <input
                    type="number"
                    value={formMontoEjecutado}
                    onChange={(e) => setFormMontoEjecutado(Number(e.target.value))}
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Razón Social Tercero / Proveedor</label>
                  <input
                    type="text"
                    value={formTerceroNombre}
                    onChange={(e) => setFormTerceroNombre(e.target.value)}
                    placeholder="Ej: Imprenta Regional S.A.S."
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">NIT / Cédula del Tercero</label>
                  <input
                    type="text"
                    value={formTerceroNit}
                    onChange={(e) => setFormTerceroNit(e.target.value)}
                    placeholder="Ej: NIT 900.123.456-7"
                    className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">Número Factura / Comprobante</label>
                <input
                  type="text"
                  value={formFacturaNumero}
                  onChange={(e) => setFormFacturaNumero(e.target.value)}
                  placeholder="Ej: FE-98124"
                  className="w-full bg-[#020712] border border-slate-700 rounded-xl px-3 py-1.5 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow cursor-pointer"
                >
                  Guardar Ítem
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: FIRMA DIGITAL & CERTIFICACIÓN CNE */}
      {/* ---------------------------------------------------------------------- */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#030d1d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-500/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">
                    Certificación y Firma Digital Cuentas Claras
                  </h4>
                  <p className="text-[10px] text-slate-400">Formalización del Formulario 5.1A y Cierre Contable CNE</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-[#020712] p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Candidato Oficial:</span>
                <span className="font-bold text-white">Candidato de la campaña activa</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Contador Público:</span>
                <span className="font-bold text-amber-300">Dr. Ricardo Valencia (TP-192844-T)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Tesorero de Campaña:</span>
                <span className="font-bold text-emerald-300">Dra. Claudia Morales</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Total Ingresos Reportados:</span>
                <span className="font-bold font-mono text-emerald-400">${totalIngresosEjecutados.toLocaleString()} COP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Gastos Reportados:</span>
                <span className="font-bold font-mono text-white">${totalGastosEjecutados.toLocaleString()} COP</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
              Al estampar la firma digital, se genera una huella criptográfica SHA-256 inalterable y se valida el cumplimiento de topes según la Ley 1475 de 2011.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSignOfficialCNE}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Firmar Digitalmente</span>
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};
