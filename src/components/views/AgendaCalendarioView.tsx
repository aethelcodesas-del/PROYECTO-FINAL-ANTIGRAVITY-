import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { CountdownWidget } from '../common/CountdownWidget';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Sparkles, 
  Filter, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  Scale, 
  Radio, 
  ShieldCheck, 
  DollarSign, 
  Flag, 
  X, 
  CalendarDays, 
  ListFilter, 
  Bell, 
  Check, 
  Info,
  Building2,
  Send
} from 'lucide-react';

export interface ElectoralEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  category: 'CNE_Registraduria' | 'Territorial_Campana' | 'Debates_Medios' | 'Testigos_DiaE' | 'Finanzas_CNE';
  priority: 'Critica' | 'Alta' | 'Media' | 'Informativa';
  location: string;
  comunaSector?: string;
  organizer: string;
  attendeesCount?: number;
  status: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado';
  description: string;
  isOfficialDeadline?: boolean;
}

export const AgendaCalendarioView: React.FC<{
  onSelectView?: (view: any) => void;
}> = ({ onSelectView }) => {
  // Current view mode inside agenda: 'timeline' | 'month' | 'official_cne'
  const [viewMode, setViewMode] = useState<'timeline' | 'month' | 'official_cne'>('timeline');
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedPriority, setSelectedPriority] = useState<string>('Todos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Month navigation
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [campaignId, setCampaignId] = useState('');
  const [clientId, setClientId] = useState('');
  const [electionDate, setElectionDate] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState<Omit<ElectoralEvent, 'id'>>({
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
  });

  // Countdown timer state to Día E (25 de Octubre 2026)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      if (!electionDate) return setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      const distance = Math.max(0, new Date(`${electionDate}T08:00:00`).getTime() - Date.now());
      setTimeLeft({
        days: Math.floor(distance / 86400000),
        hours: Math.floor((distance % 86400000) / 3600000),
        minutes: Math.floor((distance % 3600000) / 60000),
        seconds: Math.floor((distance % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [electionDate]);

  // Events Dataset
  const [events, setEvents] = useState<ElectoralEvent[]>(false ? [
    {
      id: 'evt-cne-1',
      title: 'Fecha Límite: Inscripción de Cédulas en Puestos de Votación',
      date: '2026-08-25',
      time: '23:59',
      category: 'CNE_Registraduria',
      priority: 'Critica',
      location: 'Registraduría Nacional / Puestos de Medellín',
      organizer: 'Registraduría Nacional del Estado Civil',
      status: 'Completado',
      description: 'Cierre oficial del periodo de inscripción de cédulas para ciudadanas y ciudadanos en el censo electoral.',
      isOfficialDeadline: true
    },
    {
      id: 'evt-cne-2',
      title: 'Sorteo de Posición de Candidatos en la Tarjeta Electoral',
      date: '2026-09-10',
      time: '10:00',
      category: 'CNE_Registraduria',
      priority: 'Critica',
      location: 'Plaza de la Libertad - Medellín',
      organizer: 'Consejo Nacional Electoral (CNE)',
      status: 'Completado',
      description: 'Definición de las casillas y numeración oficial en el tarjetón definitivo de votación.',
      isOfficialDeadline: true
    },
    {
      id: 'evt-camp-1',
      title: 'Gran Caminata por el Futuro: Comuna 13 (San Javier)',
      date: '2026-10-12',
      time: '15:00',
      category: 'Territorial_Campana',
      priority: 'Alta',
      location: 'Estación Metro San Javier -> Escaleras Eléctricas',
      comunaSector: 'Comuna 13 - San Javier',
      organizer: 'Coordinación Territorial Noroccidente',
      attendeesCount: 1200,
      status: 'Pendiente',
      description: 'Recorrido con el candidato Santiago Pérez, presentación del plan de empleabilidad juvenil y micro-emprendimiento.'
    },
    {
      id: 'evt-medios-1',
      title: 'Debate Gran Foro de Candidatos - Telemedellín & Prensa Regional',
      date: '2026-10-14',
      time: '20:00',
      category: 'Debates_Medios',
      priority: 'Critica',
      location: 'Estudios Telemedellín - Canal Parque',
      organizer: 'Comité de Comunicaciones',
      attendeesCount: 50,
      status: 'Pendiente',
      description: 'Debate televisado en vivo sobre Seguridad Ciudadana, Movilidad Sostenible y Transparencia en la Contratación.'
    },
    {
      id: 'evt-cne-3',
      title: 'Fecha Límite: Designación y Notificación de Jurados de Votación',
      date: '2026-10-16',
      time: '18:00',
      category: 'CNE_Registraduria',
      priority: 'Critica',
      location: 'Plataforma Registraduría Nacional',
      organizer: 'Registraduría Nacional',
      status: 'Pendiente',
      description: 'Publicación de listas oficiales de jurados de votación asignados para las mesas de Medellín.',
      isOfficialDeadline: true
    },
    {
      id: 'evt-test-1',
      title: 'Capacitación Masiva de Testigos Electorales (Zona Nororiente)',
      date: '2026-10-18',
      time: '09:00',
      category: 'Testigos_DiaE',
      priority: 'Alta',
      location: 'Auditorio Comfama Aranjuez',
      comunaSector: 'Comuna 4 - Aranjuez',
      organizer: 'Equipo de Control Electoral Día E',
      attendeesCount: 450,
      status: 'Pendiente',
      description: 'Taller práctico sobre verificación de Formulario E-14, impugnaciones y uso de la App de escrutinio rápido.'
    },
    {
      id: 'evt-fin-1',
      title: 'Presentación de Informe Financiero Intermedio CNE No. 3',
      date: '2026-10-20',
      time: '17:00',
      category: 'Finanzas_CNE',
      priority: 'Alta',
      location: 'Plataforma Cuentas Claras CNE',
      organizer: 'Dirección Financiera & Auditoría',
      status: 'Pendiente',
      description: 'Cargue oficial de facturas electrónicas y soportes de pauta publicitaria en el aplicativo Cuentas Claras.',
      isOfficialDeadline: true
    },
    {
      id: 'evt-cne-4',
      title: 'Fecha Límite: Acreditación Oficial de Testigos Electorales ante la Registraduría',
      date: '2026-10-22',
      time: '23:59',
      category: 'CNE_Registraduria',
      priority: 'Critica',
      location: 'Registraduría Especial de Medellín',
      organizer: 'Coordinación Legal y Día E',
      status: 'Pendiente',
      description: 'Radicación final del listado con los 2,140 testigos electorales para obtener las escarapelas oficiales del CNE.',
      isOfficialDeadline: true
    },
    {
      id: 'evt-camp-2',
      title: 'Cierre de Campaña Masivo: Parque de los Deseos',
      date: '2026-10-23',
      time: '17:00',
      category: 'Territorial_Campana',
      priority: 'Critica',
      location: 'Parque de los Deseos - Medellín',
      comunaSector: 'Comuna 10 - Centro / Aranjuez',
      organizer: 'Comité Central de Campaña',
      attendeesCount: 15000,
      status: 'Pendiente',
      description: 'Gran evento de cierre de plazas públicas antes del silencio electoral regulado por ley.'
    },
    {
      id: 'evt-cne-5',
      title: 'DÍAS E: Elecciones Generales 2026 - Apertura de Urnas',
      date: '2026-10-25',
      time: '08:00',
      category: 'CNE_Registraduria',
      priority: 'Critica',
      location: 'Todos los Puestos de Votación de Medellín',
      organizer: 'Registraduría Nacional & Fuerza Pública',
      status: 'Pendiente',
      description: 'Apertura de votación a las 8:00 AM. Cierre de mesas a las 4:00 PM e inicio inmediato de escrutinios e informe de Formulario E-14.',
      isOfficialDeadline: true
    }
  ] : []);

  const loadRealAgenda = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Inicie sesión para consultar la agenda.');
      const { data: profile, error: profileError } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      const rememberedCampaignId = localStorage.getItem('active_campaign_id');
      let campaignQuery = supabase.from('campaigns').select('id,client_id,fecha_eleccion');
      campaignQuery = rememberedCampaignId ? campaignQuery.eq('id', rememberedCampaignId) : profile?.campaign_id ? campaignQuery.eq('id', profile.campaign_id) : campaignQuery.eq('client_id', profile?.client_id || '');
      const { data: campaigns, error: campaignError } = await campaignQuery.order('updated_at', { ascending: false }).limit(1);
      if (campaignError) throw campaignError;
      const campaign = campaigns?.[0];
      if (!campaign) throw new Error('No existe una campaña activa para la agenda.');
      const { data: activities, error } = await supabase.from('campaign_activities').select('id,titulo,descripcion,fecha,estado').eq('campaign_id', campaign.id).order('fecha', { ascending: true });
      if (error) throw error;
      const mapped: ElectoralEvent[] = (activities || []).map((activity: any) => {
        let details: any = {};
        try { details = JSON.parse(activity.descripcion || '{}'); } catch { details = { description: activity.descripcion || '' }; }
        const statusMap: Record<string, ElectoralEvent['status']> = { PENDIENTE: 'Pendiente', EN_PROGRESO: 'En Proceso', COMPLETADA: 'Completado', CANCELADA: 'Cancelado' };
        return {
          id: String(activity.id), title: String(activity.titulo || ''), date: String(activity.fecha || ''),
          time: String(details.time || '09:00'), category: details.category || 'Territorial_Campana',
          priority: details.priority || 'Media', location: String(details.location || ''),
          comunaSector: String(details.comunaSector || ''), organizer: String(details.organizer || ''),
          attendeesCount: Number(details.attendeesCount || 0), status: statusMap[String(activity.estado)] || 'Pendiente',
          description: String(details.description || ''), isOfficialDeadline: Boolean(details.isOfficialDeadline),
        };
      });
      setCampaignId(String(campaign.id));
      setClientId(String(campaign.client_id || profile?.client_id || ''));
      setElectionDate(String(campaign.fecha_eleccion || ''));
      if (campaign.fecha_eleccion) setCurrentMonthDate(new Date(`${campaign.fecha_eleccion}T12:00:00`));
      setEvents(mapped);
    } catch (error: any) {
      showToast(error?.message || 'No fue posible cargar la agenda real.');
    }
  };

  useEffect(() => {
    void loadRealAgenda();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date.trim()) {
      alert('Por favor complete los campos requeridos (Título y Fecha).');
      return;
    }

    if (!campaignId || !clientId) return showToast('No existe una campaña activa para guardar el evento.');
    try {
      const { data, error } = await supabase.from('campaign_activities').insert({
        client_id: clientId,
        campaign_id: campaignId,
        titulo: newEvent.title.trim(),
        fecha: newEvent.date,
        estado: 'PENDIENTE',
        descripcion: JSON.stringify({
          description: newEvent.description, time: newEvent.time, category: newEvent.category,
          priority: newEvent.priority, location: newEvent.location, comunaSector: newEvent.comunaSector,
          organizer: newEvent.organizer, attendeesCount: newEvent.attendeesCount,
          isOfficialDeadline: false,
        }),
      }).select('id').single();
      if (error) throw error;
      const created: ElectoralEvent = { ...newEvent, id: String(data.id), isOfficialDeadline: false };
      setEvents(prev => [created, ...prev]);
      setShowAddModal(false);
    setNewEvent({
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
    });
      showToast('Evento guardado en la agenda de la campaña.');
    } catch (error: any) {
      showToast(error?.message || 'No fue posible guardar el evento.');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const current = events.find(event => event.id === id);
    if (!current) return;
    const nextStatus = current.status === 'Completado' ? 'Pendiente' : 'Completado';
    const databaseStatus = nextStatus === 'Completado' ? 'COMPLETADA' : 'PENDIENTE';
    try {
      const { error } = await supabase.from('campaign_activities').update({ estado: databaseStatus }).eq('id', id).eq('campaign_id', campaignId);
      if (error) throw error;
      setEvents(prev => prev.map(event => event.id === id ? { ...event, status: nextStatus } : event));
      showToast('Estado del evento guardado.');
    } catch (error: any) {
      showToast(error?.message || 'No fue posible actualizar el evento.');
    }
  };

  // Filtered Events
  const filteredEvents = events.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          evt.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (evt.comunaSector && evt.comunaSector.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'Todos' || evt.category === selectedCategory;
    const matchesPriority = selectedPriority === 'Todos' || evt.priority === selectedPriority;

    return matchesSearch && matchesCategory && matchesPriority;
  });

  // Category labels helper
  const getCategoryBadge = (cat: ElectoralEvent['category']) => {
    switch (cat) {
      case 'CNE_Registraduria':
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold flex items-center gap-1"><Scale className="w-3 h-3" /> Referencia Registraduría / CNE</span>;
      case 'Territorial_Campana':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1"><Flag className="w-3 h-3" /> Campaña & Territorio</span>;
      case 'Debates_Medios':
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold flex items-center gap-1"><Radio className="w-3 h-3" /> Debates & Medios</span>;
      case 'Testigos_DiaE':
        return <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-extrabold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Testigos & Día E</span>;
      case 'Finanzas_CNE':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold flex items-center gap-1"><DollarSign className="w-3 h-3" /> Finanzas CNE</span>;
    }
  };

  const getPriorityColor = (priority: ElectoralEvent['priority']) => {
    switch (priority) {
      case 'Critica': return 'text-rose-400 bg-rose-950/80 border-rose-500/40';
      case 'Alta': return 'text-amber-400 bg-amber-950/80 border-amber-500/40';
      case 'Media': return 'text-cyan-400 bg-cyan-950/80 border-cyan-500/40';
      default: return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  const exportCalendar = () => {
    const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const content = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Campaña Ganadora//Agenda Electoral//ES',
      ...events.flatMap(event => {
        const start = `${event.date.replace(/-/g, '')}T${event.time.replace(':', '')}00`;
        return ['BEGIN:VEVENT', `UID:${event.id}@campana-ganadora`, `DTSTART:${start}`, `SUMMARY:${escapeIcs(event.title)}`, `LOCATION:${escapeIcs(event.location || '')}`, `DESCRIPTION:${escapeIcs(event.description || '')}`, 'END:VEVENT'];
      }),
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agenda-campana-${campaignId || 'sin-campana'}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Agenda exportada en formato iCalendar.');
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-[100] bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 text-xs font-extrabold flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER WITH COUNTDOWN TIMER */}
      <div className="bg-gradient-to-r from-[#05182d] via-[#08223f] to-[#041224] border border-cyan-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Agenda Estratégica & <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-400">Calendario Electoral</span>
            </h1>
          </div>

          {/* COUNTDOWN BOX TO DÍA E */}
          <CountdownWidget targetDateStr={electionDate ? `${electionDate}T08:00:00` : ''} variant="card" className="shrink-0 lg:w-80" />
        </div>

        {/* TOP ACTIONS & VIEW TABS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-cyan-500/20 relative z-10">
          
          <div className="flex flex-wrap items-center gap-2">
            
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'timeline'
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-600 text-slate-950 shadow-lg font-black'
                  : 'bg-[#030e1c] text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>1. Cronograma / Línea de Tiempo</span>
            </button>

            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'month'
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-600 text-slate-950 shadow-lg font-black'
                  : 'bg-[#030e1c] text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>2. Calendario Mensual Grid</span>
            </button>

            <button
              onClick={() => setViewMode('official_cne')}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'official_cne'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-lg font-black'
                  : 'bg-[#030e1c] text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Scale className="w-4 h-4 text-rose-300" />
              <span>3. Fechas Límite Oficiales CNE ({events.filter(e => e.isOfficialDeadline).length})</span>
            </button>

          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Programar Evento</span>
            </button>

            <button
              onClick={exportCalendar}
              className="px-3.5 py-2 bg-[#030e1c] hover:bg-slate-800 text-slate-200 border border-cyan-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Exportar a Google Calendar (.ics)</span>
            </button>
          </div>

        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[#05162a] border border-cyan-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por evento, lugar o comuna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#030e1c] border border-cyan-500/20 text-xs text-white rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-cyan-400 transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Categoría:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer"
          >
            <option value="Todos">Todas las Categorías</option>
            <option value="CNE_Registraduria">Oficial Registraduría / CNE</option>
            <option value="Territorial_Campana">Campaña & Territorio</option>
            <option value="Debates_Medios">Debates & Medios</option>
            <option value="Testigos_DiaE">Testigos & Día E</option>
            <option value="Finanzas_CNE">Finanzas CNE</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#030e1c] border border-cyan-500/30 text-xs text-white rounded-xl px-3 py-2 outline-none font-semibold cursor-pointer"
          >
            <option value="Todos">Todas las Prioridades</option>
            <option value="Critica">Prioridad Crítica</option>
            <option value="Alta">Prioridad Alta</option>
            <option value="Media">Prioridad Media</option>
          </select>

          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1 rounded-full border border-cyan-500/30">
            {filteredEvents.length} Eventos
          </span>
        </div>

      </div>

      {/* VIEW 1: TIMELINE / CRONOGRAMA LIST */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-amber-400" />
              Línea de Tiempo Cronológica de la Campaña
            </h3>
            <span className="text-xs text-slate-400">Ordenado por proximidad de fecha</span>
          </div>

          <div className="relative border-l-2 border-cyan-500/30 ml-4 pl-6 space-y-6">
            {filteredEvents.map((evt) => {
              const isPast = new Date(`${evt.date}T23:59:59`) < new Date();
              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`relative p-5 rounded-2xl border transition-all ${
                    evt.isOfficialDeadline
                      ? 'bg-gradient-to-r from-[#0d1f33] to-[#121a29] border-rose-500/40 hover:border-rose-400'
                      : 'bg-[#05162a] border-cyan-500/20 hover:border-cyan-400/50'
                  } ${evt.status === 'Completado' ? 'opacity-70' : ''}`}
                >
                  {/* Timeline Node Dot */}
                  <div className={`absolute -left-[31px] top-6 w-4 h-4 rounded-full border-2 ${
                    evt.status === 'Completado'
                      ? 'bg-emerald-500 border-emerald-300'
                      : evt.isOfficialDeadline
                      ? 'bg-rose-500 border-rose-300 animate-ping'
                      : 'bg-amber-400 border-amber-200'
                  }`} />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getCategoryBadge(evt.category)}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getPriorityColor(evt.priority)}`}>
                          Prioridad {evt.priority}
                        </span>
                        {evt.isOfficialDeadline && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase">
                            Hito Legal CNE
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {evt.date} • {evt.time} HS
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white flex items-center gap-2">
                        {evt.title}
                      </h4>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {evt.location}
                        </span>
                        {evt.comunaSector && (
                          <span className="flex items-center gap-1 text-emerald-300 font-bold">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400" /> {evt.comunaSector}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-amber-400" /> Org: {evt.organizer}
                        </span>
                        {evt.attendeesCount && (
                          <span className="flex items-center gap-1 text-cyan-300 font-mono font-bold">
                            ~{evt.attendeesCount.toLocaleString()} Asistentes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleStatus(evt.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                          evt.status === 'Completado'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-cyan-500/30'
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
                    </div>

                  </div>
                </motion.div>
              );
            })}
            {filteredEvents.length === 0 && <p className="text-xs text-slate-400">No hay eventos registrados para los filtros seleccionados.</p>}
          </div>
        </div>
      )}

      {/* VIEW 2: MONTHLY GRID */}
      {viewMode === 'month' && (
        <div className="bg-[#05162a] border border-cyan-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
          
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-2 bg-[#030e1c] hover:bg-slate-800 rounded-xl border border-cyan-500/30 text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="font-extrabold text-white text-lg font-mono">
                {currentMonthDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h3>
              <button
                onClick={() => setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-2 bg-[#030e1c] hover:bg-slate-800 rounded-xl border border-cyan-500/30 text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              {electionDate ? `Elección configurada: ${electionDate}` : 'Sin fecha electoral configurada'}
            </span>
          </div>

          {/* DAYS OF WEEK HEADER */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-cyan-300 uppercase tracking-wider py-2 bg-[#030e1c] rounded-xl border border-cyan-500/20">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div className="text-amber-400">Sáb</div>
            <div className="text-rose-400">Dom</div>
          </div>

          {/* CALENDAR GRID */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate() }, (_, i) => {
              const dayNumber = i + 1;
              const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
              const dayEvents = events.filter(e => e.date === dateStr);
              const isDiaE = Boolean(electionDate && dateStr === electionDate);

              return (
                <div
                  key={dayNumber}
                  className={`min-h-[100px] p-2 rounded-2xl border flex flex-col justify-between transition-all ${
                    isDiaE
                      ? 'bg-gradient-to-b from-rose-950 via-[#1e0a12] to-[#0a0306] border-rose-500 shadow-xl'
                      : dayEvents.length > 0
                      ? 'bg-[#081e36] border-cyan-500/40 hover:border-cyan-300'
                      : 'bg-[#030e1c]/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                      isDiaE ? 'bg-rose-600 text-white animate-pulse' : 'text-slate-300'
                    }`}>
                      {dayNumber}
                    </span>
                    {isDiaE && (
                      <span className="text-[9px] font-black uppercase text-rose-300 bg-rose-900 px-1 rounded">
                        DÍA E
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 my-1">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        title={ev.title}
                        className={`p-1 rounded text-[10px] font-bold truncate leading-tight border ${
                          ev.isOfficialDeadline
                            ? 'bg-rose-950 text-rose-200 border-rose-500/40'
                            : 'bg-cyan-950 text-cyan-200 border-cyan-500/30'
                        }`}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] text-slate-500 font-mono text-right">
                    {dayEvents.length > 0 ? `${dayEvents.length} Evento(s)` : ''}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* VIEW 3: FECHAS LÍMITE OFICIALES CNE & REGISTRADURÍA */}
      {viewMode === 'official_cne' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-950/80 via-[#05162a] to-amber-950/80 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-400/30">
                  <Scale className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg">Hitos e Imperativos Legales CNE & Registraduría</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.filter(e => e.isOfficialDeadline).map((evt) => (
                <div key={evt.id} className="p-4 bg-[#030e1c] rounded-2xl border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase">
                      Exigencia Legal
                    </span>
                    <span className="text-xs font-mono font-extrabold text-amber-300">
                      {evt.date} • {evt.time}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm">{evt.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>
                  
                  <div className="flex items-center justify-between pt-2 text-[11px] border-t border-slate-800">
                    <span className="text-slate-400">Entidad: <strong>{evt.organizer}</strong></span>
                    <span className={`font-bold ${evt.status === 'Completado' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {evt.status === 'Completado' ? '✓ Cumplido' : '⚠️ Pendiente por Radicar'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROGRAMAR NUEVO EVENTO DE CAMPAÑA */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#05162a] border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" /> Programar Evento o Hito Electoral
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Título del Evento / Hito:</label>
                  <input
                    type="text"
                    placeholder="Ej: Caminata Comuna 4 o Reunión con Gremio de Comerciantes..."
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Fecha (AAAA-MM-DD):</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Hora (24h):</label>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Categoría:</label>
                    <select
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Territorial_Campana">Campaña & Territorio</option>
                      <option value="CNE_Registraduria">Oficial Registraduría / CNE</option>
                      <option value="Debates_Medios">Debates & Medios</option>
                      <option value="Testigos_DiaE">Testigos & Día E</option>
                      <option value="Finanzas_CNE">Finanzas CNE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Prioridad:</label>
                    <select
                      value={newEvent.priority}
                      onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Critica">Prioridad Crítica</option>
                      <option value="Alta">Prioridad Alta</option>
                      <option value="Media">Prioridad Media</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Ubicación / Lugar:</label>
                    <input
                      type="text"
                      placeholder="Ej: Parque Aranjuez..."
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Comuna / Sector (Opcional):</label>
                    <input
                      type="text"
                      placeholder="Ej: Comuna 4 - Aranjuez"
                      value={newEvent.comunaSector}
                      onChange={(e) => setNewEvent({ ...newEvent, comunaSector: e.target.value })}
                      className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Descripción / Notas Estratégicas:</label>
                  <textarea
                    rows={3}
                    placeholder="Objetivo del evento, mensaje clave a transmitir y compromisos..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full bg-[#030e1c] border border-cyan-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-cyan-500/20 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black rounded-xl shadow-lg cursor-pointer"
                >
                  Guardar en Agenda
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
