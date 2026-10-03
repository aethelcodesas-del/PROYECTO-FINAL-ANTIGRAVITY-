import React, { useState, useRef, useEffect } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { useCampaignGeo } from '../../hooks/useCampaignGeo';
import { supabase } from '../../lib/supabaseClient';
import { authenticatedFetch } from '../../lib/authenticatedFetch';
import { motion, AnimatePresence } from 'motion/react';
import { EditorMediaStudio } from './EditorMediaStudio';
import { 
  Share2, 
  MessageSquare, 
  Sparkles, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Users, 
  ThumbsUp, 
  Eye, 
  Zap, 
  Copy, 
  CheckCircle2, 
  Plus, 
  Filter, 
  Search, 
  AlertTriangle, 
  ShieldCheck, 
  Send, 
  Video, 
  Hash, 
  Globe, 
  Radio, 
  Edit3, 
  Trash2, 
  X, 
  BarChart2, 
  MessageCircle, 
  Layers, 
  Play, 
  FileText,
  Flame,
  Award,
  Upload,
  Image as ImageIcon,
  Film,
  FileVideo,
  Paperclip,
  Maximize2,
  PlayCircle,
  ExternalLink
} from 'lucide-react';

interface CandidateProfileProps {
  fullName?: string;
  politicalName?: string;
  slogan?: string;
  territory?: string;
  partyAlliance?: string;
  avatarUrl?: string;
}

interface ComunicacionRedesViewProps {
  candidateProfile?: CandidateProfileProps;
  campaignId?: string;
}

const AnimatedCounter: React.FC<{ value: number; duration?: number }> = ({ value, duration = 400 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;
    const targetValue = value;
    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    let animationFrameId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * easeProgress));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <>{displayValue}</>;
};

export interface MediaAttachment {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size?: string;
  storagePath?: string;
}

export interface PostContent {
  id: string;
  title: string;
  platform: 'Instagram' | 'TikTok' | 'X (Twitter)' | 'Facebook' | 'WhatsApp' | 'Boletín Prensa';
  format: 'Reel / Video' | 'Carrusel Infográfico' | 'Hilo de Texto' | 'Comunicado Oficial' | 'Audio Memo';
  scheduledDate: string;
  scheduledTime: string;
  status: 'Publicado' | 'Programado' | 'En Revisión' | 'Borrador';
  pilarEstrategico: string;
  caption: string;
  hashtags: string[];
  estimatedReach: string;
  engagement: string;
  author: string;
  attachments?: MediaAttachment[];
}

export const ComunicacionRedesView: React.FC<ComunicacionRedesViewProps> = ({ candidateProfile, campaignId: propCampaignId }) => {
  // ── Datos de campaña desde el contexto global ─────────────────────────────
  // Reflejan la circunscripción real configurada en Global Admin.
  // El prop candidateProfile queda como fallback de compatibilidad.
  const campaignCtx     = useCampaignData();
  const geoCtx          = useCampaignGeo();
  const candidateName   = campaignCtx.candidateName  || candidateProfile?.fullName     || '';
  const slogan          = campaignCtx.slogan          || candidateProfile?.slogan       || '';
  const territory       = geoCtx.territory            || candidateProfile?.territory    || '';
  const party           = campaignCtx.partyAlliance  || candidateProfile?.partyAlliance || '';
  const officeType      = campaignCtx.officeType      || '';
  const department      = campaignCtx.department      || '';
  const circunscripcion = campaignCtx.circunscripcion || 'MUNICIPAL';
  // ─────────────────────────────────────────────────────────────────────────

  const [campaignId, setCampaignId] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');
  const [isSavingPost, setIsSavingPost] = useState(false);

  // Active Sub-Tab State
  const [activeSubTab, setActiveSubTab] = useState<'calendario' | 'ai_studio' | 'editor_media' | 'pilares' | 'social_listening' | 'whatsapp'>('calendario');
  const [selectedMediaForEditor, setSelectedMediaForEditor] = useState<MediaAttachment | null>(null);

  // Filters & Search
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('Todas');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lightbox modal state
  const [lightboxMedia, setLightboxMedia] = useState<MediaAttachment | null>(null);

  // Scheduled / Published Posts State (100% Real Supabase Data)
  const [posts, setPosts] = useState<PostContent[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<PostContent | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadCommunicationWorkspace = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        let profile: any = null;
        if (userId) {
          const { data: prof } = await supabase.from('profiles').select('client_id,campaign_id').eq('id', userId).maybeSingle();
          profile = prof;
        }

        const targetCampId = propCampaignId || rememberedCampaignId;
        let campaign: any = null;

        // 1. Try propCampaignId or remembered ID
        if (targetCampId) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,client_id').eq('id', targetCampId).maybeSingle();
          if (data) campaign = data;
        }
        // 2. Try profile campaign_id
        if (!campaign && profile?.campaign_id) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,client_id').eq('id', profile.campaign_id).maybeSingle();
          if (data) campaign = data;
        }
        // 3. Try profile client_id
        if (!campaign && profile?.client_id) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,client_id').eq('client_id', profile.client_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (data) campaign = data;
        }
        // 4. Global database fallback
        if (!campaign) {
          const { data } = await supabase.from('campaigns').select('id,descripcion,candidato_nombre,cargo_postulacion,departamento,municipio,client_id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (data) campaign = data;
        }

        if (!campaign) return;
        const activeCampId = String(campaign.id);
        if (!mounted) return;
        setCampaignId(activeCampId);
        localStorage.setItem('active_campaign_id', activeCampId);
        
        let description: any = {};
        try { description = JSON.parse(campaign.descripcion || '{}'); } catch { description = {}; }
        const rawPosts: PostContent[] = Array.isArray(description.communicationPosts) ? description.communicationPosts : [];
        // Filter out any legacy demo posts ('post-1'..'post-6')
        const storedPosts = rawPosts.filter(p => !/^post-[1-6]$/.test(String(p?.id || '')));
        const token = sessionData.session?.access_token;
        
        if (storedPosts.length > 0) {
          const hydratedPosts = await Promise.all(storedPosts.map(async post => ({
            ...post,
            attachments: await Promise.all((post.attachments || []).map(async attachment => {
              if (!attachment.storagePath || !token) return attachment;
              const response = await authenticatedFetch('/api/strategic/media-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ campaignId: activeCampId, storagePath: attachment.storagePath }),
              });
              const signed = await response.json();
              return { ...attachment, url: response.ok ? String(signed.signedUrl || '') : '' };
            })),
          })));
          if (!mounted) return;
          setPosts(hydratedPosts);
        } else {
          try {
            const { data: dbRows } = await supabase.from('campana_publicaciones_redes').select('*').eq('campaign_id', activeCampId).order('fecha_programada', { ascending: false });
            if (Array.isArray(dbRows) && dbRows.length > 0) {
              const mapped: PostContent[] = dbRows.map((r: any) => ({
                id: String(r.id),
                title: String(r.titulo || r.title || 'Publicación'),
                platform: (r.red_social || r.platform || 'Instagram') as PostContent['platform'],
                format: (r.formato || r.format || 'Reel / Video') as PostContent['format'],
                scheduledDate: String(r.fecha_programada || r.scheduled_date || new Date().toISOString().split('T')[0]),
                scheduledTime: String(r.hora_programada || r.scheduled_time || '12:00'),
                status: (r.estado === 'Publicado' || r.estado === 'publicada' ? 'Publicado' : r.estado === 'En Revisión' ? 'En Revisión' : r.estado === 'Borrador' ? 'Borrador' : 'Programado') as PostContent['status'],
                pilarEstrategico: String(r.pilar || r.pilar_estrategico || ''),
                caption: String(r.copy || r.caption || ''),
                hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
                estimatedReach: String(r.alcance_estimado || r.estimated_reach || ''),
                engagement: String(r.engagement || ''),
                author: String(r.autor || r.author || candidateName || 'Equipo Estratégico'),
                attachments: Array.isArray(r.attachments) ? r.attachments : []
              }));
              if (mounted) {
                setPosts(mapped);
                return;
              }
            }
          } catch {}
          if (!mounted) return;
          setPosts([]);
        }
      } catch (error: any) {
        console.warn('Communications live database sync notice:', error?.message);
      }
    };
    void loadCommunicationWorkspace();
    return () => { mounted = false; };
  }, [propCampaignId]);

  // AI Content Generator Form State
  const [aiForm, setAiForm] = useState({
    topic: '',
    platform: 'Instagram' as 'Instagram' | 'TikTok' | 'X (Twitter)' | 'Facebook' | 'WhatsApp',
    tone: 'Inspiracional & Cercano' as 'Inspiracional & Cercano' | 'Firme / Ataque Político' | 'Propuesta Técnica' | 'Emotivo Comunitario',
    targetAudience: '',
    keyHighlight: ''
  });

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedOutput, setAiGeneratedOutput] = useState<{
    hook: string;
    caption: string;
    videoScript?: string;
    hashtags: string[];
    callToAction: string;
  } | null>(null);

  const [copySuccess, setCopySuccess] = useState(false);

  // New Post Modal State & Media Attachments State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalAttachments, setModalAttachments] = useState<MediaAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'image' | 'video'>('image');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [newPost, setNewPost] = useState<Omit<PostContent, 'id'>>({
    title: '',
    platform: 'Instagram',
    format: 'Reel / Video',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '12:00',
    status: 'Programado',
    pilarEstrategico: '',
    caption: '',
    hashtags: [],
    estimatedReach: '',
    engagement: '',
    author: ''
  });

  // Media Attachment Upload & Dropzone Processing
  const processFiles = async (files: FileList | File[]) => {
    if (!campaignId) return setCommunicationMessage('No existe una campaña activa para almacenar archivos.');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setCommunicationMessage('La sesión expiró. Inicie sesión nuevamente.');
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i);
      const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

      if (!isVideo && !isImage) {
        setCommunicationMessage('Seleccione únicamente imágenes o videos compatibles.');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCommunicationMessage(`${file.name} supera el límite de 10 MB.`);
        continue;
      }
      try {
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
          reader.readAsDataURL(file);
        });
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${campaignId}/communications/${Date.now()}-${safeName}`;
        const response = await authenticatedFetch('/api/strategic/media-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaignId, storagePath, fileName: file.name, mimeType: file.type, fileBase64: encoded }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'No fue posible subir el archivo.');
        setModalAttachments(prev => [...prev, {
          id: crypto.randomUUID(), url: URL.createObjectURL(file), storagePath,
          type: isVideo ? 'video' : 'image', name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        }]);
        setCommunicationMessage('Archivo almacenado de forma privada.');
      } catch (error: any) {
        setCommunicationMessage(error?.message || 'No fue posible almacenar el archivo.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFiles(e.target.files);
    }
  };

  const handleAddUrlMedia = () => {
    if (!urlInput.trim()) return;
    const newAtt: MediaAttachment = {
      id: `media-url-${Date.now()}`,
      url: urlInput.trim(),
      type: urlType,
      name: urlInput.trim().split('/').pop()?.split('?')[0] || (urlType === 'video' ? 'Video_Enlace.mp4' : 'Imagen_Enlace.jpg'),
      size: 'Enlace Web'
    };
    setModalAttachments(prev => [...prev, newAtt]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setModalAttachments(prev => prev.filter(a => a.id !== id));
  };

  // AI Generation Handler (100% Real Backend Endpoint)
  const handleGenerateAiPost = async () => {
    setIsGeneratingAi(true);
    setCommunicationMessage('');
    try {
      if (!aiForm.topic.trim()) throw new Error('Escriba el tema real de la publicación.');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('La sesión expiró. Inicie sesión nuevamente.');
      const response = await authenticatedFetch('/api/strategic/content-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaignId,
          ...aiForm,
          campaignContext: geoCtx.aiContextBlock,
          territory: geoCtx.territory,
          municipality: geoCtx.municipality,
          department: geoCtx.department,
          officeLabel: geoCtx.officeLabel,
          subdivisionLabel: geoCtx.subdivisionLabel,
          subdivisions: geoCtx.subdivisions.slice(0, 10),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'No fue posible generar el contenido.');
      setAiGeneratedOutput(result);
      setCommunicationMessage('Contenido generado con los datos reales disponibles de la campaña.');
    } catch (error: any) {
      setCommunicationMessage(error?.message || 'No fue posible generar el contenido.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const saveCommunicationPosts = async (nextPosts: PostContent[]) => {
    if (!campaignId) throw new Error('No existe una campaña activa para guardar publicaciones.');
    const { data, error: readError } = await supabase.from('campaigns').select('descripcion').eq('id', campaignId).single();
    if (readError) throw readError;
    let description: any = {};
    try { description = JSON.parse(data?.descripcion || '{}'); } catch { description = {}; }
    const serialized = nextPosts.map(post => ({
      ...post,
      attachments: (post.attachments || []).map(attachment => ({
        ...attachment,
        url: attachment.storagePath ? '' : attachment.url,
      })),
    }));
    const { error } = await supabase.from('campaigns').update({
      descripcion: JSON.stringify({ ...description, communicationPosts: serialized }),
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId);
    if (error) throw error;

    try {
      const dbPayloads = nextPosts.map(p => ({
        id: p.id,
        campaign_id: campaignId,
        titulo: p.title,
        red_social: p.platform,
        formato: p.format,
        fecha_programada: p.scheduledDate,
        hora_programada: p.scheduledTime,
        estado: p.status,
        pilar: p.pilarEstrategico,
        copy: p.caption,
        hashtags: p.hashtags,
        alcance_estimado: p.estimatedReach,
        engagement: p.engagement,
        autor: p.author,
        attachments: p.attachments,
        updated_at: new Date().toISOString()
      }));
      await supabase.from('campana_publicaciones_redes').upsert(dbPayloads, { onConflict: 'id' });
    } catch {}
  };

  const handleOpenCreateModal = () => {
    setEditingPostId(null);
    setModalAttachments([]);
    setNewPost({
      title: '',
      platform: 'Instagram',
      format: 'Reel / Video',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '12:00',
      status: 'Programado',
      pilarEstrategico: '',
      caption: '',
      hashtags: [],
      estimatedReach: '',
      engagement: '',
      author: candidateName || 'Equipo Estratégico'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditPost = (post: PostContent) => {
    setEditingPostId(post.id);
    setModalAttachments(post.attachments || []);
    setNewPost({
      title: post.title,
      platform: post.platform,
      format: post.format,
      scheduledDate: post.scheduledDate,
      scheduledTime: post.scheduledTime,
      status: post.status,
      pilarEstrategico: post.pilarEstrategico,
      caption: post.caption,
      hashtags: post.hashtags || [],
      estimatedReach: post.estimatedReach || '',
      engagement: post.engagement || '',
      author: post.author || ''
    });
    setIsAddModalOpen(true);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPost(true);
    setCommunicationMessage('');
    const postObj: PostContent = {
      ...newPost,
      id: editingPostId || crypto.randomUUID(),
      author: newPost.author?.trim() || candidateName || 'Equipo de Comunicaciones',
      attachments: modalAttachments.length > 0 ? [...modalAttachments] : undefined
    };
    const next = editingPostId
      ? posts.map(p => p.id === editingPostId ? postObj : p)
      : [postObj, ...posts];
    try {
      await saveCommunicationPosts(next);
      setPosts(next);
      setIsAddModalOpen(false);
      setEditingPostId(null);
      setModalAttachments([]);
      setNewPost({
        title: '', platform: 'Instagram', format: 'Reel / Video',
        scheduledDate: new Date().toISOString().split('T')[0], scheduledTime: '12:00',
        status: 'Programado', pilarEstrategico: '', caption: '', hashtags: [],
        estimatedReach: '', engagement: '', author: ''
      });
      setCommunicationMessage(editingPostId ? 'Publicación actualizada en la base de datos.' : 'Publicación guardada en el calendario real de la campaña.');
    } catch (error: any) {
      setCommunicationMessage(error?.message || 'No fue posible guardar la publicación.');
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    const next = posts.filter(p => p.id !== id);
    try {
      await saveCommunicationPosts(next);
      try {
        await supabase.from('campana_publicaciones_redes').delete().eq('id', id);
      } catch {}
      setPosts(next);
      setPostToDelete(null);
      setCommunicationMessage('Publicación eliminada del calendario.');
    } catch (error: any) {
      setCommunicationMessage(error?.message || 'No fue posible eliminar la publicación.');
    }
  };

  const handleSaveEditedMedia = (editedMedia: MediaAttachment | MediaAttachment[], targetPostId?: string) => {
    const itemsToAdd = Array.isArray(editedMedia) ? editedMedia : [editedMedia];
    if (targetPostId) {
      const next = posts.map(p => {
        if (p.id === targetPostId) {
          const existingAtts = p.attachments || [];
          return {
            ...p,
            attachments: [...itemsToAdd, ...existingAtts]
          };
        }
        return p;
      });
      setPosts(next);
      void saveCommunicationPosts(next).catch(() => {});
    } else {
      setModalAttachments(prev => [...itemsToAdd, ...prev]);
    }
  };

  // Filtered Posts
  const filteredPosts = posts.filter(post => {
    const matchesPlatform = selectedPlatformFilter === 'Todas' || post.platform === selectedPlatformFilter;
    const matchesStatus = selectedStatusFilter === 'Todos' || post.status === selectedStatusFilter;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          post.pilarEstrategico.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesStatus && matchesSearch;
  });
  const programmedCount = posts.filter(post => post.status === 'Programado').length;
  const publishedCount = posts.filter(post => post.status === 'Publicado').length;
  const reviewCount = posts.filter(post => post.status === 'En Revisión').length;
  const draftCount = posts.filter(post => post.status === 'Borrador').length;
  const attachmentCount = posts.reduce((total, post) => total + (post.attachments?.length || 0), 0);

  return (
    <div className="space-y-6 font-sans comunicacion-redes-view">
      
      {/* HEADER BANNER: SALA DE ESTRATEGIA DE COMUNICACIÓN & REDES SOCIALES */}
      <div className="bg-gradient-to-r from-[#0a182c] via-[#0d274c] to-[#07172e] border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden comms-header-banner animate-comms-stagger-1">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight comms-header-title">
              Estrategia de Comunicación & <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent comms-header-highlight">Redes Sociales AI</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer comms-primary-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Programar Publicación</span>
            </button>
          </div>
        </div>

        {/* METRICS DASHBOARD / KPIS DE CAMPAÑA DIGITAL */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-purple-500/20 comms-metrics-grid animate-comms-stagger-2">
          
          <div className="bg-[#051428]/90 border border-purple-500/20 p-3.5 rounded-2xl space-y-1 comms-metric-card comms-metric-total cursor-default">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 comms-metric-label">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Piezas registradas
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white font-mono comms-metric-value">
                <AnimatedCounter value={posts.length} />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate comms-metric-subtitle">Calendario de la campaña</p>
          </div>

          <div className="bg-[#051428]/90 border border-purple-500/20 p-3.5 rounded-2xl space-y-1 comms-metric-card comms-metric-programmed cursor-default">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 comms-metric-label">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Programadas
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-400 font-mono comms-metric-value">
                <AnimatedCounter value={programmedCount} />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate comms-metric-subtitle">Pendientes de publicación</p>
          </div>

          <div className="bg-[#051428]/90 border border-purple-500/20 p-3.5 rounded-2xl space-y-1 comms-metric-card comms-metric-published cursor-default">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 comms-metric-label">
              <Eye className="w-3.5 h-3.5 text-emerald-400" /> Publicadas
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-cyan-300 font-mono comms-metric-value">
                <AnimatedCounter value={publishedCount} />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate comms-metric-subtitle">Marcadas por el equipo</p>
          </div>

          <div className="bg-[#051428]/90 border border-purple-500/20 p-3.5 rounded-2xl space-y-1 comms-metric-card comms-metric-review cursor-default">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 comms-metric-label">
              <ThumbsUp className="w-3.5 h-3.5 text-sky-400" /> En revisión / borrador
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-300 font-mono comms-metric-value">
                <AnimatedCounter value={reviewCount + draftCount} />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate comms-metric-subtitle">Creativos · O borradores</p>
          </div>

          <div className="bg-[#051428]/90 border border-purple-500/20 p-3.5 rounded-2xl space-y-1 col-span-2 sm:col-span-1 comms-metric-card comms-metric-files cursor-default">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1 comms-metric-label">
              <Radio className="w-3.5 h-3.5 text-purple-400" /> Archivos privados
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-300 font-mono comms-metric-value">
                <AnimatedCounter value={attachmentCount} />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate comms-metric-subtitle">Imágenes y videos adjuntos</p>
          </div>

        </div>
      </div>

      {communicationMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 comms-feedback-msg ${
          /guardada|eliminada|almacenado|actualizada/i.test(communicationMessage) 
            ? 'comms-msg-success bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
            : 'comms-msg-alert bg-amber-950/40 text-amber-300 border-amber-500/40'
        }`}>
          {/guardada|eliminada|almacenado|actualizada/i.test(communicationMessage) ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{communicationMessage}</span>
        </div>
      )}

      {/* SUB-TABS NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05162a] p-2 rounded-2xl border border-purple-500/20 shadow-md comms-subtabs-nav animate-comms-stagger-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          
          <button
            type="button"
            onClick={() => setActiveSubTab('calendario')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-calendario group ${
              activeSubTab === 'calendario'
                ? 'active bg-gradient-to-r from-purple-500/30 to-indigo-500/30 text-purple-300 border border-purple-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Calendario & Grid ({posts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ai_studio')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-ai group ${
              activeSubTab === 'ai_studio'
                ? 'active bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-400/50 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Estudio AI de Contenidos</span>
            <span className="bg-amber-500/30 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-mono group-hover:brightness-125 transition-all">IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('editor_media')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-media group ${
              activeSubTab === 'editor_media'
                ? 'active bg-gradient-to-r from-pink-500/30 to-purple-500/30 text-pink-300 border border-pink-400/50 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Film className="w-4 h-4 text-pink-400" />
            <span>Editor Fotos & Videos</span>
            <span className="bg-pink-500/30 text-pink-300 text-[9px] px-1.5 py-0.2 rounded font-mono group-hover:brightness-125 transition-all">PRO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pilares')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-pilares group ${
              activeSubTab === 'pilares'
                ? 'active bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 border border-cyan-400/50 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Pilares & Tono de Voz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('social_listening')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-listening group ${
              activeSubTab === 'social_listening'
                ? 'active bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 border border-emerald-400/50 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>Escucha Activa & Escudo Anti-Fake</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('whatsapp')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer comms-subtab-btn subtab-whatsapp group ${
              activeSubTab === 'whatsapp'
                ? 'active bg-gradient-to-r from-emerald-600/30 to-green-500/30 text-emerald-300 border border-emerald-400/50 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp & Difusión Comunal</span>
          </button>

        </div>
      </div>

      {/* SUBTAB 1: CALENDARIO Y GRID DE PUBLICACIONES */}
      {activeSubTab === 'calendario' && (
        <div className="space-y-4 comms-tab-calendario">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-[#05162a] border border-purple-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs comms-filter-bar animate-comms-stagger-4">
            
            <div className="relative flex items-center w-full md:flex-1 md:min-w-[280px] bg-[#0b1329]/80 border border-purple-500/40 rounded-xl px-4 py-2.5 transition-all duration-200 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/20 comms-search-box">
              {/* Icono de Lupa alineado y sin colisión */}
              <Search className="w-4 h-4 text-purple-400/80 mr-3 shrink-0 select-none" />
              
              {/* Input de texto limpio y fluido */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar publicación por título, pilar o palabra clave..."
                className="search-clean-input w-full bg-transparent border-none p-0 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0"
              />

              {/* Botón de limpiar si hay texto */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="ml-2 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer p-0.5 shrink-0"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#0b1329]/80 px-3.5 py-2 rounded-xl border border-purple-500/40 transition-all duration-200 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/20 comms-filter-box">
                <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0 select-none" />
                <span className="text-slate-400 font-bold shrink-0">Red:</span>
                <select
                  value={selectedPlatformFilter}
                  onChange={(e) => setSelectedPlatformFilter(e.target.value)}
                  className="bg-transparent border-none p-0 text-white font-bold outline-none cursor-pointer comms-filter-select text-xs focus:ring-0"
                >
                  <option value="Todas" className="bg-slate-900">Todas las redes</option>
                  <option value="Instagram" className="bg-slate-900">Instagram</option>
                  <option value="TikTok" className="bg-slate-900">TikTok</option>
                  <option value="X (Twitter)" className="bg-slate-900">X (Twitter)</option>
                  <option value="Facebook" className="bg-slate-900">Facebook</option>
                  <option value="WhatsApp" className="bg-slate-900">WhatsApp</option>
                  <option value="Boletín Prensa" className="bg-slate-900">Boletín Prensa</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0b1329]/80 px-3.5 py-2 rounded-xl border border-purple-500/40 transition-all duration-200 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/20 comms-filter-box">
                <span className="text-slate-400 font-bold shrink-0">Estado:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-transparent border-none p-0 text-white font-bold outline-none cursor-pointer comms-filter-select text-xs focus:ring-0"
                >
                  <option value="Todos" className="bg-slate-900">Todos los estados</option>
                  <option value="Programado" className="bg-slate-900">Programado</option>
                  <option value="Publicado" className="bg-slate-900">Publicado</option>
                  <option value="En Revisión" className="bg-slate-900">En Revisión</option>
                  <option value="Borrador" className="bg-slate-900">Borrador</option>
                </select>
              </div>
            </div>

          </div>

          {/* POSTS LISTING */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 comms-posts-grid animate-comms-stagger-5">
            {filteredPosts.length === 0 ? (
              <div className="col-span-full bg-[#05162a] border border-purple-500/20 rounded-2xl p-12 text-center text-slate-400 space-y-3 comms-empty-state">
                <Calendar className="w-12 h-12 text-purple-400/80 mx-auto empty-social-icon" />
                {posts.length === 0 ? (
                  <>
                    <p className="font-extrabold text-white text-base">Sin publicaciones programadas en el calendario</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Cree la primera pieza digital de su campaña o genere un guión con el Estudio AI de Contenidos.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="mt-3 px-5 py-2.5 text-white text-xs font-extrabold rounded-xl inline-flex items-center gap-2 cursor-pointer comms-primary-btn"
                    >
                      <Plus className="w-4 h-4" /> Programar Primera Publicación
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm">No se encontraron publicaciones con los filtros seleccionados.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlatformFilter('Todas');
                        setSelectedStatusFilter('Todos');
                        setSearchQuery('');
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
                    >
                      Restablecer Filtros
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-[#05162a] border border-purple-500/20 hover:border-purple-400/50 rounded-2xl p-5 space-y-4 shadow-xl transition-all flex flex-col justify-between group comms-post-card"
                >
                  <div className="space-y-3">
                    
                    {/* TOP BADGES */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border comms-post-platform-badge ${
                        post.platform === 'Instagram' ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' :
                        post.platform === 'TikTok' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                        post.platform === 'X (Twitter)' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                        post.platform === 'Facebook' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' :
                        post.platform === 'WhatsApp' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {post.platform} • {post.format}
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border comms-post-status-badge ${
                        post.status === 'Publicado' ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30' :
                        post.status === 'Programado' ? 'bg-purple-950 text-purple-300 border-purple-500/30' :
                        post.status === 'En Revisión' ? 'bg-amber-950 text-amber-300 border-amber-500/30' :
                        'bg-slate-900 text-slate-400 border-slate-700'
                      }`}>
                        {post.status}
                      </span>
                    </div>

                    {/* TITLE & PILAR */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block comms-post-pilar">
                        Pilar: {post.pilarEstrategico}
                      </span>
                      <h4 className="font-extrabold text-white text-sm leading-snug group-hover:text-purple-300 transition-colors comms-post-title">
                        {post.title}
                      </h4>
                    </div>

                    {/* CAPTION PREVIEW */}
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-[#030e1c] p-3 rounded-xl border border-purple-500/10 comms-caption-box">
                      {post.caption}
                    </p>

                    {/* ATTACHED MEDIA PREVIEW IN CARD */}
                    {post.attachments && post.attachments.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-purple-500/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-300 flex items-center gap-1 comms-attachment-header">
                            <Paperclip className="w-3 h-3 text-purple-400" />
                            {post.attachments.length} {post.attachments.length === 1 ? 'Archivo Adjunto' : 'Archivos Adjuntos'}:
                          </span>
                        </div>

                        <div className="space-y-2">
                          {post.attachments.map((att) => (
                            <div key={att.id} className="rounded-xl overflow-hidden bg-[#020b16] border border-purple-500/20 relative comms-attachment-box">
                              {att.type === 'video' ? (
                                <div className="relative">
                                  <video 
                                    src={att.url} 
                                    controls 
                                    preload="metadata" 
                                    className="w-full h-40 object-cover bg-black rounded-t-xl"
                                  />
                                  <div className="p-2 bg-[#030e1c] flex items-center justify-between text-[10px] text-slate-300 comms-attachment-info">
                                    <span className="font-bold flex items-center gap-1 text-cyan-300 truncate max-w-[140px]">
                                      <Film className="w-3 h-3 text-cyan-400" /> {att.name}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {att.size && <span className="font-mono text-[9px] text-slate-400">{att.size}</span>}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedMediaForEditor(att);
                                          setActiveSubTab('editor_media');
                                        }}
                                        className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 rounded font-bold text-[9px] flex items-center gap-1 cursor-pointer transition-all comms-edit-media-btn"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" /> Editar
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative cursor-pointer group/img">
                                  <div onClick={() => setLightboxMedia(att)}>
                                    <img 
                                      src={att.url} 
                                      alt={att.name} 
                                      className="w-full h-36 object-cover transition-transform group-hover/img:scale-105" 
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                      <span className="px-2.5 py-1 bg-black/70 text-white font-bold text-[10px] rounded-lg border border-white/20 flex items-center gap-1">
                                        <Maximize2 className="w-3 h-3" /> Ampliar Imagen
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-2 bg-[#030e1c] flex items-center justify-between text-[10px] text-slate-300 comms-attachment-info">
                                    <span className="font-bold flex items-center gap-1 text-pink-300 truncate max-w-[140px]">
                                      <ImageIcon className="w-3 h-3 text-pink-400" /> {att.name}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {att.size && <span className="font-mono text-[9px] text-slate-400">{att.size}</span>}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedMediaForEditor(att);
                                          setActiveSubTab('editor_media');
                                        }}
                                        className="px-2 py-0.5 bg-pink-950 hover:bg-pink-900 text-pink-300 border border-pink-500/30 rounded font-bold text-[9px] flex items-center gap-1 cursor-pointer transition-all comms-edit-media-btn"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" /> Editar
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HASHTAGS */}
                    <div className="flex flex-wrap gap-1">
                      {post.hashtags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-bold text-cyan-400/90 comms-post-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                  </div>

                  {/* BOTTOM FOOTER */}
                  <div className="pt-3 border-t border-purple-500/20 space-y-2 comms-post-footer">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-purple-400" /> {post.scheduledDate} ({post.scheduledTime})
                      </span>
                      <span className="font-bold text-slate-300 comms-post-reach">{post.estimatedReach}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Por: {post.author}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPost(post)}
                          className="text-slate-400 hover:text-purple-300 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Editar Publicación"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostToDelete(post)}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer comms-post-del-btn"
                          title="Eliminar Publicación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* SUBTAB 2: ESTUDIO AI DE GENERACIÓN DE CONTENIDOS (AI CONTENT STUDIO) */}
      {activeSubTab === 'ai_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 comms-tab-ai">
          
          {/* LEFT COLUMN: FORMULARIO GENERADOR AI (5/12) */}
          <div className="lg:col-span-5 bg-[#05162a] border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-2xl comms-ai-form-card">
            
            <div className="flex items-center gap-2 border-b border-amber-500/20 pb-3 comms-ai-header">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl comms-ai-icon-box">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base comms-ai-title">Asistente AI de Contenido Digital</h3>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1 comms-ai-label">Tema / Eje de la Publicación:</label>
                <input
                  type="text"
                  value={aiForm.topic}
                  onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })}
                  placeholder="Ej: Plan de Choque de Pavimentación Vial..."
                  className="w-full bg-[#030e1c] border border-amber-500/30 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400 font-medium comms-ai-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 comms-ai-label">Red Objetivo:</label>
                  <select
                    value={aiForm.platform}
                    onChange={(e) => setAiForm({ ...aiForm, platform: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-amber-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 cursor-pointer comms-ai-select"
                  >
                    <option value="Instagram">Instagram (Reel / Carrusel)</option>
                    <option value="TikTok">TikTok (Short Video)</option>
                    <option value="X (Twitter)">X / Twitter (Hilo)</option>
                    <option value="Facebook">Facebook (Post / Foto)</option>
                    <option value="WhatsApp">WhatsApp (Difusión)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 comms-ai-label">Tono Comunicacional:</label>
                  <select
                    value={aiForm.tone}
                    onChange={(e) => setAiForm({ ...aiForm, tone: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-amber-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 cursor-pointer comms-ai-select"
                  >
                    <option value="Inspiracional & Cercano">Inspiracional & Cercano</option>
                    <option value="Firme / Ataque Político">Firme / Contundente</option>
                    <option value="Propuesta Técnica">Propuesta Técnica</option>
                    <option value="Emotivo Comunitario">Emotivo / Comunitario</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 comms-ai-label">Audiencia Objetivo:</label>
                <input
                  type="text"
                  value={aiForm.targetAudience}
                  onChange={(e) => setAiForm({ ...aiForm, targetAudience: e.target.value })}
                  placeholder="Ej: Madres cabeza de hogar, Jóvenes 18-28..."
                  className="w-full bg-[#030e1c] border border-amber-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 comms-ai-input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 comms-ai-label">Dato Clave / Cifra de Impacto:</label>
                <textarea
                  value={aiForm.keyHighlight}
                  onChange={(e) => setAiForm({ ...aiForm, keyHighlight: e.target.value })}
                  placeholder="Ej: Reducción del 18% en extorsión, 10.000 becas..."
                  className="w-full bg-[#030e1c] border border-amber-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 h-20 text-xs leading-relaxed comms-ai-textarea"
                />
              </div>

              <button
                onClick={handleGenerateAiPost}
                disabled={isGeneratingAi}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 comms-ai-generate-btn"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? 'Generando Contenido Viral...' : 'Generar Guión & Caption con IA'}</span>
              </button>

            </div>

          </div>

          {/* RIGHT COLUMN: VISTA PREVIA Y RESULTADOS GENERADOS (7/12) */}
          <div className="lg:col-span-7 space-y-4">
            
            {aiGeneratedOutput ? (
              <div className="bg-[#05162a] border border-amber-500/40 rounded-3xl p-6 space-y-5 shadow-2xl relative comms-ai-output-card">
                
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 comms-ai-output-header">
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 border border-amber-400/30 comms-ai-badge-success">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" /> Contenido Generado Exitosamente
                  </span>

                  <button
                    onClick={() => {
                      const fullText = `${aiGeneratedOutput.hook}\n\n${aiGeneratedOutput.caption}\n\n${aiGeneratedOutput.hashtags.join(' ')}`;
                      navigator.clipboard.writeText(fullText);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer comms-ai-copy-btn"
                  >
                    {copySuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>

                {/* HOOK DE APERTURA */}
                <div className="space-y-1.5 bg-[#030e1c] p-4 rounded-2xl border border-amber-500/20 comms-ai-output-box">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1 comms-ai-box-label">
                    <Flame className="w-3.5 h-3.5" /> Hook / Gancho Inicial (Primeros 3 Segundos):
                  </span>
                  <p className="text-white text-sm font-extrabold italic leading-snug comms-ai-hook-text">
                    {aiGeneratedOutput.hook}
                  </p>
                </div>

                {/* GUIÓN TIKTOK/REELS SI APLICA */}
                {aiGeneratedOutput.videoScript && (
                  <div className="space-y-1.5 bg-[#030e1c] p-4 rounded-2xl border border-cyan-500/20 comms-ai-output-box comms-ai-script-box">
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1 comms-ai-box-label">
                      <Video className="w-3.5 h-3.5" /> Escaleta de Video / Guión Técnico:
                    </span>
                    <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed comms-ai-script-text">
                      {aiGeneratedOutput.videoScript}
                    </pre>
                  </div>
                )}

                {/* CAPTION Y TEXTO DE ACOMPAÑAMIENTO */}
                <div className="space-y-1.5 bg-[#030e1c] p-4 rounded-2xl border border-amber-500/20 comms-ai-output-box">
                  <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1 comms-ai-box-label">
                    <FileText className="w-3.5 h-3.5" /> Texto de Acompañamiento (Caption):
                  </span>
                  <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap comms-ai-caption-text">
                    {aiGeneratedOutput.caption}
                  </p>
                </div>

                {/* HASHTAGS Y CTA */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap gap-1">
                    {aiGeneratedOutput.hashtags.map((h, i) => (
                      <span key={i} className="text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30 comms-ai-tag">
                        {h}
                      </span>
                    ))}
                  </div>

                  <span className="text-xs font-black text-amber-300 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-500/30 comms-ai-cta">
                    CTA: {aiGeneratedOutput.callToAction}
                  </span>
                </div>

                {/* BUTTON TO ADD DIRECTLY TO CALENDAR */}
                <button
                  type="button"
                  onClick={async () => {
                    const newPostObj: PostContent = {
                      id: `post-${Date.now()}`,
                      title: aiForm.topic,
                      platform: aiForm.platform,
                      format: aiForm.platform === 'TikTok' || aiForm.platform === 'Instagram' ? 'Reel / Video' : 'Hilo de Texto',
                      scheduledDate: new Date().toISOString().split('T')[0],
                      scheduledTime: '18:00',
                      status: 'Programado',
                      pilarEstrategico: aiForm.topic,
                      caption: `${aiGeneratedOutput.hook}\n\n${aiGeneratedOutput.caption}`,
                      hashtags: aiGeneratedOutput.hashtags,
                      estimatedReach: 'Generado por IA',
                      engagement: 'Pendiente',
                      author: `IA Assistant + ${candidateName}`
                    };
                    const next = [newPostObj, ...posts];
                    setPosts(next);
                    await saveCommunicationPosts(next);
                    setCommunicationMessage('Pieza generada por IA guardada e insertada en el calendario de la campaña.');
                    setActiveSubTab('calendario');
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 comms-ai-add-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar e Insertar en el Calendario de Publicaciones</span>
                </button>

              </div>
            ) : (
              <div className="bg-[#05162a] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-4 flex flex-col items-center justify-center min-h-[400px] comms-ai-waiting-card">
                <Sparkles className="w-12 h-12 text-amber-400 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-base comms-ai-waiting-title">Esperando Parámetros de Generación</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto comms-ai-waiting-desc">
                    Diligencie el formulario de la izquierda con el eje temático y presione "Generar Guión" para obtener piezas publicitarias con IA.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* SUBTAB: EDITOR MULTIMEDIA PRO (FOTOS Y VIDEOS) */}
      {activeSubTab === 'editor_media' && (
        <div className="comms-tab-media">
          <EditorMediaStudio
            posts={posts}
            candidateName={candidateName}
            candidateRole="Candidato a la Alcaldía"
            initialMedia={selectedMediaForEditor}
            onSaveEditedMedia={handleSaveEditedMedia}
          />
        </div>
      )}

      {/* SUBTAB 3: PILARES Y TONO DE VOZ DE LA COMUNICACIÓN */}
      {activeSubTab === 'pilares' && (
        <div className="space-y-6 comms-tab-pilares">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Pilar 1: Seguridad */}
            <div className="relative bg-gradient-to-b from-[#071e3d] to-[#04122a] border border-cyan-500/40 p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col group hover:border-cyan-400/60 transition-all duration-300 comms-pillar-card pilar-card-1">
              <div className="h-1 w-full bg-gradient-to-r from-cyan-400 to-cyan-600 comms-pillar-accent" />
              <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 comms-pillar-icon">
                    <ShieldCheck className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block whitespace-nowrap">Pilar 1</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap comms-pillar-category">Seguridad</span>
                  </div>
                  <span className="ml-auto text-3xl font-black text-cyan-500/15 select-none leading-none shrink-0 comms-pillar-number">01</span>
                </div>
                <h4 className="font-black text-white text-sm leading-snug comms-pillar-title">
                  {territory ? `${territory} Segura e Inteligente` : 'Seguridad Ciudadana Inteligente'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed flex-1 comms-pillar-desc">
                  Narrativa enfocada en paz urbana, combate a la inseguridad, tecnología de vigilancia y respuesta policial inmediata para el territorio de la circunscripción.
                </p>
                <div className="pt-3 border-t border-cyan-500/15 comms-pillar-footer">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[11px] font-black text-cyan-300 comms-pillar-tag">
                    #{(territory || 'Territorio').replace(/[\s,]/g, '')}Segura
                  </span>
                </div>
              </div>
            </div>

            {/* Pilar 2: Empleo */}
            <div className="relative bg-gradient-to-b from-[#071e18] to-[#041209] border border-emerald-500/40 p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col group hover:border-emerald-400/60 transition-all duration-300 comms-pillar-card pilar-card-2">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-600 comms-pillar-accent" />
              <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 comms-pillar-icon">
                    <TrendingUp className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block whitespace-nowrap">Pilar 2</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap comms-pillar-category">Empleo</span>
                  </div>
                  <span className="ml-auto text-3xl font-black text-emerald-500/15 select-none leading-none shrink-0 comms-pillar-number">02</span>
                </div>
                <h4 className="font-black text-white text-sm leading-snug comms-pillar-title">
                  Desarrollo Económico & Empleo Local
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed flex-1 comms-pillar-desc">
                  Apoyo a microempresarios, atracción de inversión, simplificación de trámites e incentivos tributarios para la generación de empleo en la circunscripción.
                </p>
                <div className="pt-3 border-t border-emerald-500/15 comms-pillar-footer">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-[11px] font-black text-emerald-300 comms-pillar-tag">
                    #EmpleoLocal
                  </span>
                </div>
              </div>
            </div>

            {/* Pilar 3: Juventud */}
            <div className="relative bg-gradient-to-b from-[#1e1504] to-[#120d02] border border-amber-500/40 p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col group hover:border-amber-400/60 transition-all duration-300 comms-pillar-card pilar-card-3">
              <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600 comms-pillar-accent" />
              <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 comms-pillar-icon">
                    <Award className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block whitespace-nowrap">Pilar 3</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap comms-pillar-category">Juventud</span>
                  </div>
                  <span className="ml-auto text-3xl font-black text-amber-500/15 select-none leading-none shrink-0 comms-pillar-number">03</span>
                </div>
                <h4 className="font-black text-white text-sm leading-snug comms-pillar-title">
                  Oportunidades para la Juventud
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed flex-1 comms-pillar-desc">
                  Becas, centros de formación técnica y deporte competitivo para los jóvenes de la circunscripción como motor de transformación social.
                </p>
                <div className="pt-3 border-t border-amber-500/15 comms-pillar-footer">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-[11px] font-black text-amber-300 comms-pillar-tag">
                    #JuventudAvanza
                  </span>
                </div>
              </div>
            </div>

            {/* Pilar 4: Transparencia */}
            <div className="relative bg-gradient-to-b from-[#160d2a] to-[#0d0618] border border-purple-500/40 p-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col group hover:border-purple-400/60 transition-all duration-300 comms-pillar-card pilar-card-4">
              <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-purple-600 comms-pillar-accent" />
              <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 comms-pillar-icon">
                    <CheckCircle2 className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block whitespace-nowrap">Pilar 4</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap comms-pillar-category">Transparencia</span>
                  </div>
                  <span className="ml-auto text-3xl font-black text-purple-500/15 select-none leading-none shrink-0 comms-pillar-number">04</span>
                </div>
                <h4 className="font-black text-white text-sm leading-snug comms-pillar-title">
                  Gerencia Pública Abierta
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed flex-1 comms-pillar-desc">
                  Cero tolerancia a la corrupción, veeduría ciudadana en tiempo real y presupuesto participativo 100% digital para la circunscripción.
                </p>
                <div className="pt-3 border-t border-purple-500/15 comms-pillar-footer">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-[11px] font-black text-purple-300 comms-pillar-tag">
                    #GerenciaHonesta
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* TONO DE VOZ GUIDELINES */}
          <div className="bg-[#05162a] border border-purple-500/30 p-6 rounded-3xl space-y-4 shadow-xl comms-tone-card">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2 comms-tone-title">
              <Radio className="w-5 h-5 text-purple-400" />
              Guía de Tono de Voz & Lenguaje Permitido
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl space-y-2 comms-tone-good">
                <strong className="text-emerald-300 font-extrabold block text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Palabras y Atributos Recomendados:
                </strong>
                <p className="text-slate-300 leading-relaxed">
                  "Eficiencia, Gerencia, Transparencia, Resultados, Equipos, Oportunidades Reales, Unificación, Respeto por los Barrios, Soluciones sin Improvisación."
                </p>
              </div>

              <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl space-y-2 comms-tone-bad">
                <strong className="text-rose-300 font-extrabold block text-sm flex items-center gap-1.5">
                  <X className="w-4 h-4 text-rose-400" /> Términos Estrictamente Prohibidos:
                </strong>
                <p className="text-slate-300 leading-relaxed">
                  Evitar agresiones personales contra contrincantes, adjetivos descalificativos sobre apariencia, promesas presupuestalmente inviables o jerga técnica excesivamente compleja.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB 4: ESCUCHA ACTIVA & ANTI-FAKE NEWS */}
      {activeSubTab === 'social_listening' && (
        <div className="space-y-6 comms-tab-listening">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ESCUDO CONTRA DESINFORMACIÓN */}
            <div className="bg-[#05162a] border border-rose-500/40 p-6 rounded-3xl space-y-4 shadow-xl comms-shield-card">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-3 comms-shield-header">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl comms-shield-icon-box">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-white text-base comms-shield-title">Escudo Anti-Fake News & Respuesta Rápida</h3>
                </div>
                <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-400/40 comms-shield-badge">
                  Protocolo Activo
                </span>
              </div>

              <div className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-2xl space-y-3 comms-shield-alert-box">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Protocolo de Desmentido Oficial ({territory || 'Territorio'})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Plantilla lista</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Escenario de Contención:</strong> Desinformación en cadenas de mensajería sobre propuestas sociales y programas prioritarios de {candidateName}.
                </p>

                <div className="bg-[#030e1c] p-3 rounded-xl border border-emerald-500/30 space-y-1.5 comms-shield-counter-box">
                  <strong className="text-emerald-400 text-xs font-extrabold block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Contra-Narrativa Oficial Preparada:
                  </strong>
                  <p className="text-slate-200 text-xs leading-relaxed">
                    "Es falso. El Programa de Gobierno de {candidateName} fortalece y amplía la inversión social en {territory || 'nuestro territorio'}. Invitamos a la ciudadanía a consultar nuestras propuestas oficiales."
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const counterPost: PostContent = {
                      id: `post-${Date.now()}`,
                      title: `Comunicado Oficial de Desmentido — ${territory || 'Campaña'}`,
                      platform: 'WhatsApp',
                      format: 'Comunicado Oficial',
                      scheduledDate: new Date().toISOString().split('T')[0],
                      scheduledTime: new Date().toTimeString().slice(0, 5),
                      status: 'Programado',
                      pilarEstrategico: 'Defensa & Contra-Narrativa',
                      caption: `COMUNICADO OFICIAL (${candidateName}): Es falso el rumor difundido en cadenas de mensajería. Nuestro Programa de Gobierno fortalece la inversión social en ${territory || 'el territorio'}. Exigimos una contienda limpia basada en propuestas reales.`,
                      hashtags: [
                        `#${(candidateName || 'Campaña').replace(/[^a-zA-Z0-9]/g, '')}`,
                        `#${(territory || 'Territorio').replace(/[^a-zA-Z0-9]/g, '')}ConLaVerdad`,
                      ],
                      estimatedReach: 'Red de Líderes',
                      engagement: 'Directo',
                      author: candidateName,
                    };
                    const next = [counterPost, ...posts];
                    setPosts(next);
                    await saveCommunicationPosts(next);
                    setCommunicationMessage('Comunicado de desmentido oficial guardado y programado en el calendario.');
                    setActiveSubTab('calendario');
                  }}
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow comms-shield-btn"
                >
                  Programar Desmentido en WhatsApp & Redes
                </button>
              </div>
            </div>

            {/* MONITOR DE SENTIMIENTO SOCIAL */}
            <div className="bg-[#05162a] border border-cyan-500/30 p-6 rounded-3xl space-y-4 shadow-xl comms-listening-card">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2 border-b border-cyan-500/20 pb-3 comms-listening-title">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
                Distribución del Calendario Digital ({posts.length} piezas)
              </h3>

              <div className="space-y-3 text-xs comms-sentiment-bars">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-emerald-400 comms-sentiment-label-pos">Publicadas ({publishedCount})</span>
                    <span className="text-white font-mono comms-sentiment-val">
                      {posts.length > 0 ? Math.round((publishedCount / posts.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden comms-sentiment-track">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${posts.length > 0 ? Math.round((publishedCount / posts.length) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-purple-300 comms-sentiment-label-neu">Programadas ({programmedCount})</span>
                    <span className="text-white font-mono comms-sentiment-val">
                      {posts.length > 0 ? Math.round((programmedCount / posts.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden comms-sentiment-track">
                    <div
                      className="bg-purple-400 h-full rounded-full"
                      style={{ width: `${posts.length > 0 ? Math.round((programmedCount / posts.length) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-amber-400 comms-sentiment-label-neg">En Revisión / Borrador ({reviewCount + draftCount})</span>
                    <span className="text-white font-mono comms-sentiment-val">
                      {posts.length > 0 ? Math.round(((reviewCount + draftCount) / posts.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden comms-sentiment-track">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${posts.length > 0 ? Math.round(((reviewCount + draftCount) / posts.length) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-cyan-500/20 space-y-2 comms-hashtags-section">
                <span className="text-xs font-extrabold text-cyan-300 block comms-hashtags-title">Hashtags Oficiales de la Campaña:</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold comms-hashtag-badge">
                    #{(candidateName || 'Candidato').replace(/[^a-zA-Z0-9]/g, '')}
                  </span>
                  <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold comms-hashtag-badge">
                    #{(territory || 'Territorio').replace(/[^a-zA-Z0-9]/g, '')}Avanza
                  </span>
                  <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold comms-hashtag-badge">
                    #PropuestasConResultados
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUBTAB 5: ESTRATEGIA WHATSAPP & CANALES DIRECTOS */}
      {activeSubTab === 'whatsapp' && (
        <div className="bg-[#05162a] border border-emerald-500/30 p-6 rounded-3xl space-y-6 shadow-xl comms-whatsapp-card">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-emerald-500/20 pb-4 comms-whatsapp-header">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl comms-whatsapp-icon-box">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg comms-whatsapp-title">Central de Difusión Directa por WhatsApp ({territory || 'Campaña'})</h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingPostId(null);
                setNewPost({
                  title: `Boletín de Difusión WhatsApp — ${territory || 'Líderes'}`,
                  platform: 'WhatsApp',
                  format: 'Audio Memo',
                  scheduledDate: new Date().toISOString().split('T')[0],
                  scheduledTime: '09:00',
                  pilarEstrategico: 'Movilización Territorial',
                  caption: `Mensaje directo de ${candidateName} para coordinadores y líderes barriales de ${territory || 'la campaña'}.`,
                  hashtags: `#${(territory || 'Campaña').replace(/[^a-zA-Z0-9]/g, '')}`,
                });
                setModalAttachments([]);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer comms-whatsapp-btn"
            >
              <Send className="w-4 h-4" />
              <span>Programar Difusión a Líderes</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-[#030e1c] border border-emerald-500/20 p-4 rounded-2xl space-y-2 comms-whatsapp-channel">
              <span className="text-xs font-extrabold text-emerald-400 block comms-channel-title">Canal 1: Coordinadores y Líderes Territoriales</span>
              <p className="text-xs text-slate-300 comms-channel-desc">Difusión directa para estructura territorial en {territory || 'el municipio'}.</p>
              <span className="text-[10px] text-slate-400 font-mono comms-channel-time">
                Piezas WhatsApp registradas: {posts.filter((p) => p.platform === 'WhatsApp').length}
              </span>
            </div>

            <div className="bg-[#030e1c] border border-emerald-500/20 p-4 rounded-2xl space-y-2 comms-whatsapp-channel">
              <span className="text-xs font-extrabold text-emerald-400 block comms-channel-title">Canal 2: Gremios, Comercio y Sector Productivo</span>
              <p className="text-xs text-slate-300 comms-channel-desc">Cápsulas programáticas de empleo y desarrollo económico local.</p>
              <span className="text-[10px] text-slate-400 font-mono comms-channel-time">Formato recomendado: Infografía + Audio</span>
            </div>

            <div className="bg-[#030e1c] border border-emerald-500/20 p-4 rounded-2xl space-y-2 comms-whatsapp-channel">
              <span className="text-xs font-extrabold text-emerald-400 block comms-channel-title">Canal 3: Red de Jóvenes y Voluntariado</span>
              <p className="text-xs text-slate-300 comms-channel-desc">Convocatorias de avanzada, pedagogía electoral y activación digital.</p>
              <span className="text-[10px] text-slate-400 font-mono comms-channel-time">Formato recomendado: Sticker + Video corto</span>
            </div>

          </div>

        </div>
      )}

      {/* MODAL: CREAR / PROGRAMAR NUEVA PUBLICACIÓN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-purple-500/40 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-xs shadow-2xl custom-scrollbar comms-modal-dialog">
            
            <div className="flex justify-between items-center border-b border-purple-500/20 pb-3 comms-modal-header">
              <h4 className="font-extrabold text-white text-sm flex items-center gap-2 comms-modal-title">
                <Plus className="w-4 h-4 text-purple-400" />
                {editingPostId ? 'Editar Publicación Programada' : 'Programar Nueva Publicación en Redes'}
              </h4>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingPostId(null); }} className="text-slate-400 hover:text-white cursor-pointer comms-modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              
              <div>
                <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Título / Pieza de Contenido:</label>
                <input
                  type="text"
                  required
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="Ej: Video Lanzamiento Plan de Seguridad Comuna 13"
                  className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 font-medium comms-modal-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Red Social:</label>
                  <select
                    value={newPost.platform}
                    onChange={(e) => setNewPost({ ...newPost, platform: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 cursor-pointer comms-modal-select"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="X (Twitter)">X (Twitter)</option>
                    <option value="Facebook">Facebook</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Boletín Prensa">Boletín Prensa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Formato:</label>
                  <select
                    value={newPost.format}
                    onChange={(e) => setNewPost({ ...newPost, format: e.target.value as any })}
                    className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 cursor-pointer comms-modal-select"
                  >
                    <option value="Reel / Video">Reel / Video Short</option>
                    <option value="Carrusel Infográfico">Carrusel Infográfico</option>
                    <option value="Hilo de Texto">Hilo de Texto</option>
                    <option value="Comunicado Oficial">Comunicado Oficial</option>
                    <option value="Audio Memo">Audio Memo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Fecha Programada:</label>
                  <input
                    type="date"
                    required
                    value={newPost.scheduledDate}
                    onChange={(e) => setNewPost({ ...newPost, scheduledDate: e.target.value })}
                    className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 comms-modal-input"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Hora Programada:</label>
                  <input
                    type="time"
                    required
                    value={newPost.scheduledTime}
                    onChange={(e) => setNewPost({ ...newPost, scheduledTime: e.target.value })}
                    className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 comms-modal-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Pilar Estratégico Asociado:</label>
                <input
                  type="text"
                  required
                  value={newPost.pilarEstrategico}
                  onChange={(e) => setNewPost({ ...newPost, pilarEstrategico: e.target.value })}
                  placeholder="Ej: Seguridad Inteligente, Empleo..."
                  className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 comms-modal-input"
                />
              </div>

              <div>
                <label className="block text-purple-300 font-bold mb-1 comms-modal-label">Texto de la Publicación (Caption):</label>
                <textarea
                  required
                  value={newPost.caption}
                  onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                  placeholder="Escriba el texto oficial o copy de la publicación..."
                  className="w-full bg-[#030e1c] border border-purple-500/30 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 h-24 text-xs leading-relaxed comms-modal-textarea"
                />
              </div>

              {/* ADJUNTAR MULTIMEDIA (IMÁGENES Y VIDEOS) */}
              <div className="space-y-2 pt-2 border-t border-purple-500/20">
                <div className="flex items-center justify-between">
                  <label className="block text-purple-300 font-bold flex items-center gap-1.5 comms-modal-label">
                    <Paperclip className="w-3.5 h-3.5 text-purple-400" />
                    Adjuntar Archivos Multimedia (Fotos y Videos):
                  </label>
                </div>

                {/* DROPZONE AREA */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 comms-dropzone ${
                    dragActive
                      ? 'border-purple-400 bg-purple-500/20 scale-[1.01]'
                      : 'border-purple-500/30 bg-[#030e1c] hover:border-purple-400/60 hover:bg-[#041326]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                  />
                  <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-full comms-dropzone-icon">
                    <Upload className="w-5 h-5 animate-bounce text-purple-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white comms-dropzone-title">
                      Arrastra y suelta tus videos o imágenes aquí
                    </p>
                    <p className="text-[10px] text-slate-400 comms-dropzone-desc">
                      o haz clic para explorar en tu dispositivo (MP4, MOV, WEBM, JPG, PNG, GIF)
                    </p>
                  </div>
                </div>

                {/* ALTERNATIVE URL INPUT TOGGLE */}
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer comms-url-toggle"
                  >
                    {showUrlInput ? 'Ocultar ingreso por URL' : '＋ Ingresar enlace URL externo (video / imagen)'}
                  </button>
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2 bg-[#030e1c] p-2 rounded-xl border border-purple-500/30 comms-url-box">
                    <select
                      value={urlType}
                      onChange={(e) => setUrlType(e.target.value as any)}
                      className="bg-slate-900 text-white font-bold text-[10px] px-2 py-1 rounded-lg border border-purple-500/30 outline-none cursor-pointer comms-url-select"
                    >
                      <option value="video">🎥 Video</option>
                      <option value="image">🖼️ Imagen</option>
                    </select>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/mi_video.mp4"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 bg-transparent text-white text-xs outline-none px-1 comms-url-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrlMedia}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-lg text-xs cursor-pointer transition-all comms-url-btn"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {/* LIST OF ATTACHED MEDIA PREVIEWS */}
                {modalAttachments.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 block comms-modal-label">
                      Archivos adjuntos ({modalAttachments.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {modalAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 bg-[#030e1c] p-2 rounded-xl border border-purple-500/30 relative group comms-attachment-item"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800 flex items-center justify-center relative">
                            {att.type === 'video' ? (
                              <>
                                <video src={att.url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Film className="w-4 h-4 text-cyan-400" />
                                </div>
                              </>
                            ) : (
                              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 text-left space-y-0.5">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              att.type === 'video' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' : 'bg-pink-950 text-pink-300 border border-pink-500/40'
                            }`}>
                              {att.type === 'video' ? 'VIDEO' : 'IMAGEN'}
                            </span>
                            <p className="text-[11px] font-bold text-white truncate leading-tight comms-item-name">
                              {att.name}
                            </p>
                            {att.size && (
                              <p className="text-[9px] text-slate-400 font-mono comms-item-size">
                                {att.size}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar archivo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-purple-500/20 comms-modal-footer">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingPostId(null); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-all comms-modal-btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPost || !campaignId}
                  className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl font-extrabold cursor-pointer transition-all shadow-lg shadow-purple-900/40 comms-modal-btn-submit"
                >
                  {isSavingPost ? 'Guardando...' : editingPostId ? 'Guardar Cambios' : 'Guardar Publicación'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE PUBLICACIÓN */}
      {postToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#05162a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-extrabold text-white text-sm">Confirmar eliminación de publicación</h4>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ¿Está seguro de eliminar permanentemente la publicación <strong>"{postToDelete.title}"</strong> ({postToDelete.platform}) del calendario de la campaña?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = postToDelete.id;
                  setPostToDelete(null);
                  await handleDeletePost(id);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold cursor-pointer transition-all"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR FULLSCREEN MEDIA VIEW */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-[#05162a] border border-purple-500/40 rounded-3xl p-4 shadow-2xl space-y-3 comms-lightbox-dialog">
            <div className="flex justify-between items-center border-b border-purple-500/20 pb-3 px-2 comms-lightbox-header">
              <div className="flex items-center gap-2">
                {lightboxMedia.type === 'video' ? (
                  <Film className="w-5 h-5 text-cyan-400" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                )}
                <div>
                  <h4 className="font-extrabold text-white text-sm comms-lightbox-title">{lightboxMedia.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{lightboxMedia.size || 'Multimedia'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center rounded-2xl overflow-hidden bg-black max-h-[75vh]">
              {lightboxMedia.type === 'video' ? (
                <video 
                  src={lightboxMedia.url} 
                  controls 
                  autoPlay 
                  className="max-w-full max-h-[70vh] rounded-xl" 
                />
              ) : (
                <img src={lightboxMedia.url} alt={lightboxMedia.name} className="max-w-full max-h-[70vh] object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
