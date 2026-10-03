import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Bell,
  Share2,
  ListFilter,
  CalendarDays,
  Target,
  ShieldCheck,
  Radio,
  DollarSign,
  Flag,
  Search,
  X,
  FileText,
  Scale,
  Building2,
  Edit3,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AgendaCalendarioViewProps {
  onSelectView?: (view: string) => void;
  campaignId?: string;
  candidateProfile?: any;
}

interface DiaECountdownWidgetProps {
  targetDateStr?: string;
  className?: string;
}

const DiaECountdownWidget: React.FC<DiaECountdownWidgetProps> = React.memo(({ targetDateStr = '', className = '' }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!targetDateStr) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const target = new Date(targetDateStr).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDateStr]);

  return (
    <div className={`bg-[#06182c]/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 text-center agenda-countdown-widget ${className}`}>
      <div className="flex items-center justify-center gap-1.5 text-amber-400 font-black text-xs uppercase tracking-wider">
        <Flag className="w-4 h-4 text-amber-400" />
        <span>CUENTA REGRESIVA PARA EL DÍA E</span>
      </div>

      <div className="grid grid-cols-4 gap-2 font-mono">
        <div className="bg-[#041222] p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="block text-2xl sm:text-3xl font-black text-amber-400 font-mono">{timeLeft.days}</span>
          <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold tracking-wider">DÍAS</span>
        </div>
        <div className="bg-[#041222] p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="block text-2xl sm:text-3xl font-black text-cyan-400 font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold tracking-wider">HORAS</span>
        </div>
        <div className="bg-[#041222] p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="block text-2xl sm:text-3xl font-black text-cyan-400 font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold tracking-wider">MIN</span>
        </div>
        <div className="bg-[#041222] p-2 sm:p-2.5 rounded-xl border border-slate-700/80">
          <span className="block text-2xl sm:text-3xl font-black text-rose-400 font-mono agenda-countdown-seg-pulse">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-400 font-sans uppercase font-extrabold tracking-wider">SEG</span>
        </div>
      </div>
    </div>
  );
});
DiaECountdownWidget.displayName = 'DiaECountdownWidget';

export interface ElectoralEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  category: 'CNE_Registraduria' | 'Territorial_Campana' | 'Debates_Medios' | 'Testigos_DiaE' | 'Finanzas_CNE';
  priority: 'Critica' | 'Alta' | 'Media';
  location: string;
  comunaSector?: string;
  organizer: string;
  attendeesCount?: number;
  status: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado';
  description: string;
  isOfficialDeadline?: boolean;
}

export const AgendaCalendarioView: React.FC<AgendaCalendarioViewProps> = ({
  onSelectView,
  campaignId: propCampaignId,
  candidateProfile
}) => {
  const geoCtx = useCampaignGeo();

  const [campaignId, setCampaignId] = useState('');
  const [clientId, setClientId] = useState('');
  const [electionDate, setElectionDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [viewMode, setViewMode] = useState<'timeline' | 'month' | 'official_cne'>('timeline');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedPriority, setSelectedPriority] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<ElectoralEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [selectedEventDetail, setSelectedEventDetail] = useState<ElectoralEvent | null>(null);

  const emptyFormState: Omit<ElectoralEvent, 'id'> = {
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    category: 'Territorial_Campana',
    priority: 'Alta',
    location: '',
    comunaSector: '',
    organizer: '',
    attendeesCount: 0,
    status: 'Pendiente',
    description: '',
    isOfficialDeadline: false
  };

  const [newEvent, setNewEvent] = useState<Omit<ElectoralEvent, 'id'>>(emptyFormState);

  // 100% Real Database Events State (Zero Mock Data)
  const [events, setEvents] = useState<ElectoralEvent[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const mapRowToEvent = (activity: any): ElectoralEvent => {
    let details: any = {};
    try {
      details = JSON.parse(activity.descripcion || '{}');
    } catch {
      details = { description: activity.descripcion || '' };
    }
    const statusMap: Record<string, ElectoralEvent['status']> = {
      PENDIENTE: 'Pendiente',
      PROGRAMADA: 'Pendiente',
      EN_PROGRESO: 'En Proceso',
      COMPLETADA: 'Completado',
      COMPLETADO: 'Completado',
      CANCELADA: 'Cancelado'
    };
    const rawDate = activity.fecha
      ? String(activity.fecha).slice(0, 10)
      : activity.fecha_hora
        ? String(activity.fecha_hora).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    return {
      id: String(activity.id),
      title: String(activity.titulo || ''),
      date: rawDate,
      time: String(details.time || activity.end_time || '09:00'),
      category: details.category || 'Territorial_Campana',
      priority: details.priority || activity.priority || 'Media',
      location: String(details.location || activity.lugar || ''),
      comunaSector: String(details.comunaSector || activity.comuna || ''),
      organizer: String(details.organizer || activity.responsable || ''),
      attendeesCount: Number(details.attendeesCount ?? activity.target_attendees ?? 0),
      status: statusMap[String(activity.estado || '').toUpperCase()] || 'Pendiente',
      description: String(details.description || ''),
      isOfficialDeadline: Boolean(details.isOfficialDeadline || details.category === 'CNE_Registraduria')
    };
  };

  const loadRealAgenda = async () => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      const token = sessionData.session?.access_token;

      let campaign: any = null;
      const targetCampId = propCampaignId || localStorage.getItem('active_campaign_id') || '';

      if (targetCampId) {
        const { data } = await supabase
          .from('campaigns')
          .select('id,client_id,fecha_eleccion,fecha_elecciones,descripcion')
          .eq('id', targetCampId)
          .maybeSingle();
        if (data) campaign = data;
      }

      if (!campaign && token) {
        try {
          const resp = await authenticatedFetch('/api/supabase-admin/active-campaign', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const body = await resp.json();
            if (body?.campaign) campaign = body.campaign;
          }
        } catch {
          // fallback to direct queries
        }
      }

      if (!campaign) {
        let profile: any = null;
        if (userId) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('client_id,campaign_id')
            .eq('id', userId)
            .maybeSingle();
          profile = prof;
        }

        if (!campaign && profile?.campaign_id) {
          const { data } = await supabase
            .from('campaigns')
            .select('id,client_id,fecha_eleccion,fecha_elecciones,descripcion')
            .eq('id', profile.campaign_id)
            .maybeSingle();
          if (data) campaign = data;
        }
        if (!campaign && profile?.client_id) {
          const { data } = await supabase
            .from('campaigns')
            .select('id,client_id,fecha_eleccion,fecha_elecciones,descripcion')
            .eq('client_id', profile.client_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) campaign = data;
        }
        if (!campaign) {
          const { data } = await supabase
            .from('campaigns')
            .select('id,client_id,fecha_eleccion,fecha_elecciones,descripcion')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) campaign = data;
        }
      }

      if (!campaign) {
        setEvents([]);
        return;
      }

      const activeCampId = String(campaign.id);
      const activeClientId = String(campaign.client_id || campaign.id);
      setCampaignId(activeCampId);
      setClientId(activeClientId);
      localStorage.setItem('active_campaign_id', activeCampId);

      // Sincronizar Fecha Oficial de Elecciones (Día E) desde todas las fuentes reales
      let officialElectionDate = String(campaign.fecha_eleccion || campaign.fecha_elecciones || '').trim();
      if (!officialElectionDate && campaign.descripcion) {
        try {
          const desc = JSON.parse(campaign.descripcion);
          officialElectionDate = String(desc.fecha_eleccion || desc.fecha_elecciones || '').trim();
        } catch {}
      }

      if (!officialElectionDate && activeCampId) {
        try {
          const { data: configData } = await supabase
            .from('campana_config')
            .select('fecha_elecciones,fecha_eleccion')
            .eq('campana_id', activeCampId)
            .maybeSingle();
          if (configData) {
            officialElectionDate = String(configData.fecha_elecciones || configData.fecha_eleccion || '').trim();
          }
        } catch {}
      }

      if (!officialElectionDate && activeCampId) {
        try {
          const { data: datosData } = await supabase
            .from('campana_datos')
            .select('fecha_elecciones,fecha_eleccion')
            .eq('campana_id', activeCampId)
            .maybeSingle();
          if (datosData) {
            officialElectionDate = String(datosData.fecha_elecciones || datosData.fecha_eleccion || '').trim();
          }
        } catch {}
      }

      setElectionDate(officialElectionDate);

      // Cargar actividades e hitos reales de la campaña activa
      const { data: activities, error } = await supabase
        .from('campaign_activities')
        .select('*')
        .eq('campaign_id', activeCampId)
        .order('fecha', { ascending: true });

      if (error) throw error;

      const mapped: ElectoralEvent[] = (activities || []).map(mapRowToEvent);
      setEvents(mapped);
    } catch (error: any) {
      console.warn('Agenda live database sync notice:', error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRealAgenda();
  }, [propCampaignId]);

  const handleOpenCreateModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingEventId(null);
    setNewEvent({
      ...emptyFormState,
      date: new Date().toISOString().slice(0, 10)
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, evt: ElectoralEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingEventId(evt.id);
    setNewEvent({
      title: evt.title,
      date: evt.date,
      time: evt.time,
      category: evt.category,
      priority: evt.priority,
      location: evt.location,
      comunaSector: evt.comunaSector || '',
      organizer: evt.organizer,
      attendeesCount: evt.attendeesCount || 0,
      status: evt.status,
      description: evt.description,
      isOfficialDeadline: Boolean(evt.isOfficialDeadline)
    });
    setSelectedEventDetail(null);
    setShowAddModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!newEvent.title.trim() || !newEvent.date.trim()) {
      showToast('Complete los campos obligatorios: Título y Fecha del hito.');
      return;
    }

    const targetCampId = campaignId || localStorage.getItem('active_campaign_id') || '';
    const targetClientId = clientId || null;

    if (!targetCampId) {
      showToast('No existe una campaña activa para guardar el hito electoral.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const isOfficial = Boolean(newEvent.isOfficialDeadline || newEvent.category === 'CNE_Registraduria');
      const dbStatus = newEvent.status === 'Completado' ? 'COMPLETADA' : 'PENDIENTE';
      const serializedDesc = JSON.stringify({
        description: newEvent.description.trim(),
        time: newEvent.time,
        category: newEvent.category,
        priority: newEvent.priority,
        location: newEvent.location.trim(),
        comunaSector: (newEvent.comunaSector || '').trim(),
        organizer: newEvent.organizer.trim(),
        attendeesCount: Number(newEvent.attendeesCount || 0),
        isOfficialDeadline: isOfficial
      });

      const payload: Record<string, any> = {
        campaign_id: targetCampId,
        client_id: targetClientId,
        titulo: newEvent.title.trim(),
        fecha: newEvent.date,
        fecha_hora: `${newEvent.date}T${newEvent.time || '09:00'}:00`,
        end_time: newEvent.time || '09:00',
        tipo: newEvent.category,
        lugar: newEvent.location.trim(),
        comuna: (newEvent.comunaSector || '').trim(),
        responsable: newEvent.organizer.trim(),
        priority: newEvent.priority,
        target_attendees: Number(newEvent.attendeesCount || 0),
        estado: dbStatus,
        descripcion: serializedDesc,
        updated_at: new Date().toISOString()
      };

      if (editingEventId) {
        let updatedRow: any = null;
        if (token) {
          const resp = await authenticatedFetch('/api/supabase-admin/political-crm', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ table: 'campaign_activities', id: editingEventId, data: payload })
          });
          const resBody = await resp.json();
          if (resp.ok && resBody?.data) {
            updatedRow = Array.isArray(resBody.data) ? resBody.data[0] : resBody.data;
          }
        }
        if (!updatedRow) {
          const { data, error } = await supabase
            .from('campaign_activities')
            .update(payload)
            .eq('id', editingEventId)
            .select('*')
            .single();
          if (error) throw error;
          updatedRow = data;
        }
        const mapped = mapRowToEvent(updatedRow);
        setEvents(prev => prev.map(ev => (ev.id === editingEventId ? mapped : ev)));
        showToast('Hito electoral actualizado en la base de datos.');
      } else {
        let insertedRow: any = null;
        if (token) {
          const resp = await authenticatedFetch('/api/supabase-admin/political-crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ table: 'campaign_activities', data: payload })
          });
          const resBody = await resp.json();
          if (resp.ok && resBody?.data) {
            insertedRow = Array.isArray(resBody.data) ? resBody.data[0] : resBody.data;
          }
        }
        if (!insertedRow) {
          const { data, error } = await supabase
            .from('campaign_activities')
            .insert(payload)
            .select('*')
            .single();
          if (error) throw error;
          insertedRow = data;
        }
        const mapped = mapRowToEvent(insertedRow);
        setEvents(prev => [mapped, ...prev].sort((a, b) => a.date.localeCompare(b.date)));
        showToast('Hito electoral programado y guardado en el servidor seguro.');
      }

      setShowAddModal(false);
      setEditingEventId(null);
      setNewEvent(emptyFormState);
    } catch (error: any) {
      showToast(error?.message || 'No fue posible guardar el hito electoral.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const current = events.find(event => event.id === id);
    if (!current) return;
    const nextStatus: ElectoralEvent['status'] = current.status === 'Completado' ? 'Pendiente' : 'Completado';
    const databaseStatus = nextStatus === 'Completado' ? 'COMPLETADA' : 'PENDIENTE';
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      let ok = false;
      if (token) {
        const resp = await authenticatedFetch('/api/supabase-admin/political-crm', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            table: 'campaign_activities',
            id,
            data: { estado: databaseStatus, updated_at: new Date().toISOString() }
          })
        });
        ok = resp.ok;
      }
      if (!ok) {
        const { error } = await supabase
          .from('campaign_activities')
          .update({ estado: databaseStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
      setEvents(prev => prev.map(event => (event.id === id ? { ...event, status: nextStatus } : event)));
      showToast(`Estado actualizado a: ${nextStatus}.`);
    } catch (error: any) {
      showToast(error?.message || 'No fue posible actualizar el estado del evento.');
    }
  };

  const confirmDeleteEvent = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!eventToDelete) return;
    const targetId = eventToDelete.id;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      let ok = false;
      if (token) {
        const resp = await authenticatedFetch('/api/supabase-admin/political-crm', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ table: 'campaign_activities', id: targetId })
        });
        ok = resp.ok;
      }
      if (!ok) {
        const { error } = await supabase.from('campaign_activities').delete().eq('id', targetId);
        if (error) throw error;
      }
      setEvents(prev => prev.filter(ev => ev.id !== targetId));
      if (selectedEventDetail?.id === targetId) setSelectedEventDetail(null);
      setEventToDelete(null);
      showToast('Hito electoral eliminado permanentemente.');
    } catch (error: any) {
      showToast(error?.message || 'No fue posible eliminar el hito electoral.');
    }
  };

  // Distinct months available in events for Month Filter
  const availableMonths = Array.from(new Set(events.map(e => e.date.slice(0, 7)).filter(Boolean))).sort();

  // Filtered Events
  const filteredEvents = events.filter(evt => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (evt.comunaSector && evt.comunaSector.toLowerCase().includes(searchTerm.toLowerCase())) ||
      evt.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'Todos' || evt.category === selectedCategory;
    const matchesPriority = selectedPriority === 'Todos' || evt.priority === selectedPriority;
    const matchesStatus = selectedStatus === 'Todos' || evt.status === selectedStatus;
    const matchesMonth = selectedMonthFilter === 'Todos' || evt.date.startsWith(selectedMonthFilter);

    return matchesSearch && matchesCategory && matchesPriority && matchesStatus && matchesMonth;
  });

  const getCategoryBadge = (cat: ElectoralEvent['category']) => {
    switch (cat) {
      case 'CNE_Registraduria':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold flex items-center gap-1">
            <Scale className="w-3 h-3" /> Referencia Registraduría / CNE
          </span>
        );
      case 'Territorial_Campana':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1">
            <Flag className="w-3 h-3" /> Campaña & Territorio
          </span>
        );
      case 'Debates_Medios':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold flex items-center gap-1">
            <Radio className="w-3 h-3" /> Debates & Medios
          </span>
        );
      case 'Testigos_DiaE':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-extrabold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Testigos & Día E
          </span>
        );
      case 'Finanzas_CNE':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Finanzas CNE
          </span>
        );
    }
  };

  const getPriorityColor = (priority: ElectoralEvent['priority']) => {
    switch (priority) {
      case 'Critica':
        return 'text-rose-400 bg-rose-950/80 border-rose-500/40';
      case 'Alta':
        return 'text-amber-400 bg-amber-950/80 border-amber-500/40';
      case 'Media':
        return 'text-cyan-400 bg-cyan-950/80 border-cyan-500/40';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  const exportCalendar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (events.length === 0) {
      showToast('No hay eventos programados para exportar.');
      return;
    }
    const escapeIcs = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Campaña Ganadora//Agenda Electoral//ES',
      ...events.flatMap(event => {
        const start = `${event.date.replace(/-/g, '')}T${event.time.replace(':', '')}00`;
        return [
          'BEGIN:VEVENT',
          `UID:${event.id}@campana-ganadora`,
          `DTSTART:${start}`,
          `SUMMARY:${escapeIcs(event.title)}`,
          `LOCATION:${escapeIcs(event.location || '')}`,
          `DESCRIPTION:${escapeIcs(event.description || '')}`,
          'END:VEVENT'
        ];
      }),
      'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agenda-campana-${campaignId || 'activa'}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Agenda exportada en formato iCalendar (.ics).');
  };

  const territorialZones = Array.from(
    new Set(
      [
        ...(geoCtx.subdivisions || []),
        'Casco Urbano Central',
        'Zona Rural / Corregimientos',
        'Todo el Territorio'
      ].filter(Boolean)
    )
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100 agenda-calendario-view">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-[100] bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 text-xs font-extrabold flex items-center gap-2 agenda-toast"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER WITH COUNTDOWN TIMER */}
      <div className="bg-gradient-to-r from-[#05182d] via-[#08223f] to-[#041224] border border-cyan-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden space-y-6 agenda-header-banner animate-agenda-stagger-1">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none agenda-header-glow" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight agenda-header-title">
              Agenda Estratégica &{' '}
              <span className="text-amber-400 agenda-header-highlight">
                Calendario Electoral
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Cronograma operativo en tiempo real vinculado a{' '}
              <strong className="text-cyan-300">{geoCtx.territory || candidateProfile?.municipio || 'Cotorra, Córdoba'}</strong>.
            </p>
          </div>

          {/* COUNTDOWN BOX TO DÍA E */}
          <DiaECountdownWidget
            targetDateStr={electionDate ? `${electionDate}T08:00:00` : ''}
            className="shrink-0 lg:w-80"
          />
        </div>

        {/* TOP ACTIONS & VIEW TABS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-cyan-500/20 relative z-10 agenda-header-actions animate-agenda-stagger-2">
          <div className="flex flex-wrap items-center gap-2 agenda-view-tabs">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('timeline');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 agenda-view-tab-btn agenda-tab-timeline ${
                viewMode === 'timeline'
                  ? 'agenda-tab-active'
                  : 'agenda-tab-inactive bg-[#030e1c] text-slate-300'
              }`}
            >
              <span>1. Cronograma / Línea de Tiempo ({events.length})</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('month');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 agenda-view-tab-btn agenda-tab-month ${
                viewMode === 'month'
                  ? 'agenda-tab-active'
                  : 'agenda-tab-inactive bg-[#030e1c] text-slate-300'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>2. Calendario Mensual Grid</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('official_cne');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 agenda-view-tab-btn agenda-tab-cne ${
                viewMode === 'official_cne'
                  ? 'agenda-tab-active'
                  : 'agenda-tab-inactive bg-[#030e1c] text-slate-300'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>3. Hitos Oficiales CNE ({events.filter(e => e.isOfficialDeadline).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 agenda-action-buttons">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer agenda-btn-new-event"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Hito / Evento</span>
            </button>

            <button
              type="button"
              onClick={exportCalendar}
              className="px-3.5 py-2 bg-[#030e1c] text-slate-200 border border-cyan-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer agenda-btn-export"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span>Exportar (.ics)</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 shadow-xl agenda-filter-bar animate-agenda-stagger-3">
        {/* Search */}
        <div className="relative w-full xl:w-72 agenda-search-box agenda-search-box-focus rounded-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 agenda-search-icon" />
          <input
            type="text"
            placeholder="Buscar por hito, lugar o sector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#030e1c] border border-cyan-500/20 text-xs text-white rounded-xl pl-9 pr-4 py-2.5 outline-none transition-all placeholder:text-slate-500 agenda-search-input"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto agenda-filter-controls">
          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 agenda-filter-label">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filtros:
          </span>

          {/* Status Filter */}
          <div className="agenda-filter-box-focus rounded-xl">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer agenda-filter-select"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En curso</option>
              <option value="Completado">Cumplido</option>
            </select>
          </div>

          {/* Month Filter */}
          <div className="agenda-filter-box-focus rounded-xl">
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer agenda-filter-select"
            >
              <option value="Todos">Todos los Meses</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  Mes: {m}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="agenda-filter-box-focus rounded-xl">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer agenda-filter-select"
            >
              <option value="Todos">Todas las Categorías</option>
              <option value="Territorial_Campana">Territorial</option>
              <option value="Debates_Medios">Medios</option>
              <option value="CNE_Registraduria">Legal CNE</option>
              <option value="Testigos_DiaE">Movilización</option>
              <option value="Finanzas_CNE">Finanzas</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="agenda-filter-box-focus rounded-xl">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer agenda-filter-select"
            >
              <option value="Todos">Todas las Prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Critica">Baja</option>
            </select>
          </div>

          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-3 py-1.5 rounded-full border border-cyan-500/30 agenda-count-badge">
            {filteredEvents.length} Hitos
          </span>
        </div>
      </div>

      {/* VIEW 1: TIMELINE / CRONOGRAMA LIST */}
      {viewMode === 'timeline' && (
        <div className="space-y-4 agenda-timeline-section animate-agenda-stagger-4">
          <div className="flex items-center justify-between agenda-timeline-header">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2 agenda-timeline-title">
              <ListFilter className="w-5 h-5 text-amber-400" />
              <span>Línea de Tiempo Cronológica de la Campaña</span>
            </h3>
            <span className="text-xs text-slate-400 agenda-timeline-subtitle font-medium">
              {events.filter(e => e.status === 'Completado').length} completados •{' '}
              {events.filter(e => e.status !== 'Completado').length} pendientes
            </span>
          </div>

          {isLoading ? (
            <div className="bg-[#05162a] border border-cyan-500/20 rounded-3xl p-10 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-300">Cargando cronograma real desde el servidor seguro...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-[#05162a] border border-dashed border-cyan-500/30 rounded-3xl p-10 text-center space-y-4 agenda-empty-state">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 empty-agenda-icon">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-black text-white">
                  {events.length === 0
                    ? 'Sin hitos estratégicos programados'
                    : 'No hay eventos que coincidan con los filtros seleccionados'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {events.length === 0
                    ? 'Cree el primer evento clave o hito legal para estructurar la línea de tiempo oficial de la campaña en el servidor seguro.'
                    : 'Ajuste los filtros de estado, mes, categoría o prioridad para visualizar otros registros.'}
                </p>
              </div>
              {events.length === 0 && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-5 py-2.5 text-slate-950 font-black text-xs rounded-xl shadow-lg inline-flex items-center gap-2 cursor-pointer transition-all agenda-btn-create-first"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Crear Primer Hito Electoral</span>
                </button>
              )}
            </div>
          ) : (
            <div className="relative border-l-2 border-cyan-500/30 ml-4 pl-6 space-y-6 agenda-timeline-track">
              {filteredEvents.map((evt) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`relative p-5 rounded-2xl border transition-all agenda-timeline-card ${
                    evt.isOfficialDeadline
                      ? 'bg-gradient-to-r from-[#0d1f33] to-[#121a29] border-rose-500/40 hover:border-rose-400 agenda-card-deadline'
                      : 'bg-[#05162a] border-cyan-500/20 hover:border-cyan-400/50'
                  } ${evt.status === 'Completado' ? 'opacity-75 agenda-card-completed' : ''}`}
                >
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-[31px] top-6 w-4 h-4 rounded-full border-2 agenda-timeline-dot ${
                      evt.status === 'Completado'
                        ? 'bg-emerald-500 border-emerald-300 dot-completed'
                        : evt.isOfficialDeadline
                        ? 'bg-rose-500 border-rose-300 dot-deadline'
                        : 'bg-amber-400 border-amber-200 dot-normal'
                    }`}
                  />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getCategoryBadge(evt.category)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold border agenda-priority-badge ${getPriorityColor(
                            evt.priority
                          )}`}
                        >
                          Prioridad {evt.priority}
                        </span>
                        {evt.isOfficialDeadline && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase agenda-deadline-pill">
                            Hito Legal CNE
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-400 agenda-card-datetime">
                          {evt.date} • {evt.time} HS
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white flex items-center gap-2 agenda-card-title">
                        {evt.title}
                      </h4>

                      {evt.description && (
                        <p className="text-xs text-slate-300 leading-relaxed agenda-card-desc">
                          {evt.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1 agenda-card-meta">
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {evt.location}
                          </span>
                        )}
                        {evt.comunaSector && (
                          <span className="flex items-center gap-1 text-emerald-300 font-bold agenda-meta-comuna">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400" /> {evt.comunaSector}
                          </span>
                        )}
                        {evt.organizer && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-amber-400" /> Resp: {evt.organizer}
                          </span>
                        )}
                        {evt.attendeesCount && evt.attendeesCount > 0 ? (
                          <span className="flex items-center gap-1 text-cyan-300 font-mono font-bold agenda-meta-attendees">
                            ~{evt.attendeesCount.toLocaleString('es-CO')} Asistentes
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => void handleToggleStatus(evt.id, e)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all agenda-card-status-btn ${
                          evt.status === 'Completado'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 status-completed'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-cyan-500/30 status-pending'
                        }`}
                      >
                        {evt.status === 'Completado' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Completado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>Marcar Listo</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(e, evt)}
                        className="p-2 rounded-xl bg-[#030e1c] hover:bg-cyan-950 text-cyan-300 border border-cyan-500/30 cursor-pointer transition-all"
                        title="Editar hito electoral"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEventToDelete(evt);
                        }}
                        className="p-2 rounded-xl bg-[#030e1c] hover:bg-rose-950 text-rose-400 border border-rose-500/30 cursor-pointer transition-all"
                        title="Eliminar hito electoral"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MONTHLY GRID */}
      {viewMode === 'month' && (() => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        return (
          <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl agenda-month-card animate-agenda-stagger-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 pb-3 agenda-month-header">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-2 bg-[#030e1c] hover:bg-slate-800 rounded-xl border border-cyan-500/30 text-white cursor-pointer agenda-month-nav-btn transition-colors"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-extrabold text-white text-lg font-mono agenda-month-title">
                  {currentMonthDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  className="p-2 bg-[#030e1c] hover:bg-slate-800 rounded-xl border border-cyan-500/30 text-white cursor-pointer agenda-month-nav-btn transition-colors"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentMonthDate(new Date());
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold border bg-[#030e1c] text-cyan-300 border-cyan-500/30 hover:bg-cyan-950 cursor-pointer transition-all"
                >
                  Mes Actual
                </button>
                {electionDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentMonthDate(new Date(`${electionDate.slice(0, 7)}-01T12:00:00`));
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold border bg-rose-950 text-rose-300 border-rose-500/40 hover:bg-rose-900 cursor-pointer transition-all"
                  >
                    Ir a Mes de Elección ({electionDate})
                  </button>
                )}
              </div>
            </div>

            {/* DAYS OF WEEK HEADER */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-cyan-300 uppercase tracking-wider py-2 bg-[#030e1c] rounded-xl border border-cyan-500/20 agenda-weekday-header">
              <div className="agenda-weekday-col">Lun</div>
              <div className="agenda-weekday-col">Mar</div>
              <div className="agenda-weekday-col">Mié</div>
              <div className="agenda-weekday-col">Jue</div>
              <div className="agenda-weekday-col">Vie</div>
              <div className="agenda-weekday-col text-amber-400 col-sat">Sáb</div>
              <div className="agenda-weekday-col text-rose-400 col-sun">Dom</div>
            </div>

            {/* CALENDAR GRID */}
            <div className="grid grid-cols-7 gap-2 agenda-grid-container">
              {Array.from({ length: firstDayOfWeek }, (_, i) => {
                const prevDay = daysInPrevMonth - firstDayOfWeek + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="min-h-[105px] p-2 rounded-2xl border border-slate-800/40 bg-[#020b16]/30 opacity-30 flex flex-col justify-between select-none"
                  >
                    <span className="font-mono text-xs font-bold text-slate-600">{prevDay}</span>
                  </div>
                );
              })}

              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNumber = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.date === dateStr);
                const isDiaE = Boolean(electionDate && dateStr === electionDate);
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;

                return (
                  <div
                    key={dayNumber}
                    className={`min-h-[105px] p-2 rounded-2xl border flex flex-col justify-between transition-all agenda-day-cell ${
                      isDiaE
                        ? 'bg-gradient-to-b from-rose-950 via-[#1e0a12] to-[#0a0306] border-rose-500 shadow-xl cell-dia-e'
                        : isToday
                        ? 'bg-[#0a274c] border-blue-500 shadow-md cell-today'
                        : dayEvents.length > 0
                        ? 'bg-[#081e36] border-cyan-500/40 hover:border-cyan-300 cell-with-events'
                        : 'bg-[#030e1c]/60 border-slate-800/80 hover:border-slate-700 cell-empty'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-black px-2 py-0.5 rounded agenda-day-number ${
                          isDiaE
                            ? 'bg-rose-600 text-white animate-pulse'
                            : isToday
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300'
                        }`}
                      >
                        {dayNumber}
                      </span>
                      {isDiaE && (
                        <span className="text-[9px] font-black uppercase text-rose-200 bg-rose-900 px-1.5 py-0.2 rounded agenda-day-badge-e shadow">
                          DÍA E
                        </span>
                      )}
                      {isToday && !isDiaE && (
                        <span className="text-[9px] font-bold uppercase text-blue-300 bg-blue-900/60 px-1 rounded agenda-day-badge-today">
                          HOY
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1 agenda-day-events-list">
                      {dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEventDetail(ev)}
                          title={`${ev.time} - ${ev.title} (${ev.location})`}
                          className={`p-1 rounded text-[10px] font-bold truncate leading-tight border cursor-pointer hover:scale-102 transition-transform agenda-day-event-pill ${
                            ev.isOfficialDeadline
                              ? 'bg-rose-950 text-rose-200 border-rose-500/40 pill-deadline shadow'
                              : 'bg-cyan-950 text-cyan-200 border-cyan-500/30 pill-normal'
                          }`}
                        >
                          <span className="font-mono text-[9px] opacity-80 mr-1">{ev.time}</span>
                          {ev.title}
                        </div>
                      ))}
                    </div>

                    <div className="text-[9px] text-slate-400 font-mono text-right agenda-day-count">
                      {dayEvents.length > 0 ? `${dayEvents.length} Evento(s)` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* VIEW 3: FECHAS LÍMITE OFICIALES CNE & REGISTRADURÍA */}
      {viewMode === 'official_cne' && (
        <div className="space-y-4 agenda-cne-section animate-agenda-stagger-4">
          <div className="bg-gradient-to-r from-rose-950/80 via-[#05162a] to-amber-950/80 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4 agenda-cne-card">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3 agenda-cne-header">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-400/30 agenda-cne-icon-box">
                  <Scale className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg agenda-cne-title">
                    Hitos e Imperativos Legales CNE & Registraduría
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setEditingEventId(null);
                  setNewEvent({
                    ...emptyFormState,
                    category: 'CNE_Registraduria',
                    priority: 'Critica',
                    isOfficialDeadline: true
                  });
                  setShowAddModal(true);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Registrar Hito CNE
              </button>
            </div>

            {events.filter(e => e.isOfficialDeadline).length === 0 ? (
              <div className="p-8 text-center bg-[#030e1c]/80 rounded-2xl border border-dashed border-rose-500/30 space-y-2">
                <p className="text-sm font-bold text-white">Sin fechas límite legales registradas</p>
                <p className="text-xs text-slate-400">
                  Registre los vencimientos de inscripción de testigos, reportes de Cuentas Claras o cierres de censo para su monitoreo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 agenda-cne-grid">
                {events
                  .filter(e => e.isOfficialDeadline)
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="p-4 bg-[#030e1c] rounded-2xl border border-rose-500/30 space-y-2 agenda-cne-item"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase agenda-cne-badge">
                          Exigencia Legal
                        </span>
                        <span className="text-xs font-mono font-extrabold text-amber-300 agenda-cne-date">
                          {evt.date} • {evt.time}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm agenda-cne-item-title">{evt.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed agenda-cne-desc">{evt.description}</p>

                      <div className="flex items-center justify-between pt-2 text-[11px] border-t border-slate-800 agenda-cne-footer">
                        <span className="text-slate-400">
                          Entidad: <strong className="text-slate-200">{evt.organizer || 'CNE / Registraduría'}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => void handleToggleStatus(evt.id, e)}
                          className={`font-bold cursor-pointer ${
                            evt.status === 'Completado'
                              ? 'text-emerald-400 status-ok'
                              : 'text-amber-400 status-pending'
                          }`}
                        >
                          {evt.status === 'Completado' ? '✓ Cumplido' : '⚠️ Marcar Cumplido'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PROGRAMAR O EDITAR EVENTO DE CAMPAÑA */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 agenda-modal-overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 agenda-modal-dialog max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 agenda-modal-header">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2 agenda-modal-title">
                  {editingEventId ? (
                    <>
                      <Edit3 className="w-5 h-5 text-cyan-400" /> Editar Hito o Evento Electoral
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-emerald-400" /> Programar Evento o Hito Electoral
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingEventId(null);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer agenda-modal-close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                    Título del Evento / Hito *:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Encuentro con líderes barriales o Entrega de listas de testigos..."
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2.5 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                      Fecha (AAAA-MM-DD) *:
                    </label>
                    <input
                      type="date"
                      required
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">Hora (24h):</label>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">Categoría:</label>
                    <select
                      value={newEvent.category}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          category: e.target.value as ElectoralEvent['category'],
                          isOfficialDeadline: e.target.value === 'CNE_Registraduria'
                        })
                      }
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-select"
                    >
                      <option value="Territorial_Campana">Campaña & Territorio</option>
                      <option value="CNE_Registraduria">Oficial Registraduría / CNE</option>
                      <option value="Debates_Medios">Debates & Medios</option>
                      <option value="Testigos_DiaE">Testigos & Día E</option>
                      <option value="Finanzas_CNE">Finanzas CNE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">Prioridad:</label>
                    <select
                      value={newEvent.priority}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, priority: e.target.value as ElectoralEvent['priority'] })
                      }
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-select"
                    >
                      <option value="Critica">Prioridad Crítica</option>
                      <option value="Alta">Prioridad Alta</option>
                      <option value="Media">Prioridad Media</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">Ubicación / Lugar:</label>
                    <input
                      type="text"
                      placeholder="Ej: Sede Central / Plaza Principal..."
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                      Zona / Corregimiento / Sector:
                    </label>
                    <input
                      type="text"
                      list="agenda-zones-datalist"
                      placeholder={`Ej: ${territorialZones[0] || 'Casco Urbano'}`}
                      value={newEvent.comunaSector}
                      onChange={(e) => setNewEvent({ ...newEvent, comunaSector: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                    />
                    <datalist id="agenda-zones-datalist">
                      {territorialZones.map(z => (
                        <option key={z} value={z} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                      Responsable / Organizador:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Coordinación Territorial"
                      value={newEvent.organizer}
                      onChange={(e) => setNewEvent({ ...newEvent, organizer: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 agenda-modal-input"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                      Aforo Estimado (Personas):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newEvent.attendeesCount || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, attendeesCount: Number(e.target.value || 0) })}
                      placeholder="0"
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 font-mono agenda-modal-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 agenda-modal-label">
                    Descripción / Notas Estratégicas:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Objetivo del evento, mensaje clave a transmitir y compromisos..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none agenda-modal-textarea"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-cyan-500/20 pt-4 agenda-modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingEventId(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer agenda-modal-btn-cancel"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow-lg cursor-pointer agenda-modal-btn-submit"
                  >
                    {isSaving ? 'Guardando...' : editingEventId ? 'Guardar Cambios' : 'Guardar en Agenda'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE HITO */}
      <AnimatePresence>
        {eventToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" /> Eliminar Hito Electoral
                </h4>
                <button
                  type="button"
                  onClick={() => setEventToDelete(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-300 leading-relaxed">
                ¿Confirma la eliminación permanente del hito{' '}
                <strong className="text-white">"{eventToDelete.title}"</strong> ({eventToDelete.date}) de la agenda de la campaña?
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteEvent}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DETALLE DE EVENTO SELECCIONADO EN CALENDARIO */}
      <AnimatePresence>
        {selectedEventDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {getCategoryBadge(selectedEventDetail.category)}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getPriorityColor(
                        selectedEventDetail.priority
                      )}`}
                    >
                      Prioridad {selectedEventDetail.priority}
                    </span>
                    {selectedEventDetail.isOfficialDeadline && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase">
                        Hito Legal CNE
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-white text-base leading-snug mt-1">
                    {selectedEventDetail.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEventDetail(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="bg-[#030e1c] p-3.5 rounded-xl border border-cyan-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" /> Horario:
                    </span>
                    <span className="font-mono font-black text-amber-300">
                      {selectedEventDetail.date} • {selectedEventDetail.time} HS
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Ubicación:
                    </span>
                    <span className="font-bold text-white text-right max-w-[240px] truncate">
                      {selectedEventDetail.location || 'Por definir'}
                    </span>
                  </div>

                  {selectedEventDetail.comunaSector && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Zona / Sector:
                      </span>
                      <span className="font-bold text-emerald-300">{selectedEventDetail.comunaSector}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-400" /> Responsable:
                    </span>
                    <span className="text-slate-200">{selectedEventDetail.organizer || 'Coordinación General'}</span>
                  </div>
                </div>

                {selectedEventDetail.description && (
                  <div className="bg-[#030e1c] p-3 rounded-xl border border-cyan-500/10 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">
                      Descripción / Objetivos:
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedEventDetail.description}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/20 pt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    void handleToggleStatus(selectedEventDetail.id, e);
                    setSelectedEventDetail(prev =>
                      prev ? { ...prev, status: prev.status === 'Completado' ? 'Pendiente' : 'Completado' } : null
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    selectedEventDetail.status === 'Completado'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-cyan-500/30'
                  }`}
                >
                  {selectedEventDetail.status === 'Completado' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>✓ Evento Completado</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Marcar como Cumplido</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditModal(e, selectedEventDetail)}
                    className="px-3.5 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEventDetail(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
