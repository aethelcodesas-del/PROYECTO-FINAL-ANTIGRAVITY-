import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { saveDemoLeadToSupabase, testSupabaseConnection, registerNewClient, PANEL_ADMIN_URL, SUPABASE_URL } from '../lib/supabase';
import {
  CAMPANA_GANADORA_CATEGORIES,
  CAMPANA_GANADORA_MODULES,
  CampanaGanadoraItem,
} from '../data/campanaGanadoraModules';
import { CampanaGanadoraDetailModal } from './common/CampanaGanadoraDetailModal';
import { BallotBrainIcon } from './common/CampaignLogoIcon';
import { LandingParticleNetwork } from './landing/LandingParticleNetwork';
import {
  LandingCommercialConfigService,
  DEFAULT_LANDING_COMMERCIAL_CONFIG,
  LANDING_COMMERCIAL_CONFIG_EVENT,
} from '../services/landingCommercialConfigService';
import {
  Sparkles,
  ArrowRight,
  ArrowUp,
  ShieldCheck,
  Zap,
  Users,
  MapPin,
  Vote,
  BarChart3,
  CheckCircle2,
  Lock,
  Bot,
  ChevronDown,
  Layers,
  Cpu,
  Play,
  X,
  Menu,
  Calculator,
  Target,
  Send,
  Sliders,
  Database,
  Check,
  Building2,
  LayoutDashboard,
  Globe,
  Radio,
  FileText,
  Clock,
  Award,
  ExternalLink,
  Scale,
  Shield,
  Search,
} from 'lucide-react';

interface RedSunBeeCampaignLandingProps {
  onLogin?: () => void;
}

export const RedSunBeeCampaignLanding: React.FC<RedSunBeeCampaignLandingProps> = ({ onLogin }) => {
  const landingRootRef = useRef<HTMLDivElement>(null);
  const [showCinematicIntro, setShowCinematicIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !sessionStorage.getItem('cg_cinematic_intro_v1');
  });
  // Navigation & Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTabDemo, setActiveTabDemo] = useState<'ai' | 'crm' | 'territory' | 'e14'>('ai');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [commercialConfig, setCommercialConfig] = useState(DEFAULT_LANDING_COMMERCIAL_CONFIG);

  // Floating Scroll to Top button state
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Selected Module Modal for Campaña Ganadora
  const [selectedModule, setSelectedModule] = useState<CampanaGanadoraItem | null>(null);
  const [activePillarCategory, setActivePillarCategory] = useState<string>('estrategia');
  const [searchModuleQuery, setSearchModuleQuery] = useState<string>('');

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const returnToLandingStart = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    returnToLandingStart();

    // Algunos navegadores restauran la posición después del primer render.
    // Se repite al terminar de pintar y cuando la página vuelve desde caché.
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(returnToLandingStart);
    });
    window.addEventListener('load', returnToLandingStart);
    window.addEventListener('pageshow', returnToLandingStart);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.removeEventListener('load', returnToLandingStart);
      window.removeEventListener('pageshow', returnToLandingStart);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const syncLandingMotion = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const root = landingRootRef.current;
        if (!root) return;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        root.style.setProperty('--landing-scroll-progress', String(progress));
      });
    };
    syncLandingMotion();
    window.addEventListener('scroll', syncLandingMotion, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncLandingMotion);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!showCinematicIntro) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('cg_cinematic_intro_v1', 'seen');
      setShowCinematicIntro(false);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [showCinematicIntro]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);

    // Initial hash scroll handler
    const rawHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    if (rawHash) {
      setTimeout(() => {
        const targetEl = document.getElementById(rawHash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Local Notification Toast State
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'info' }>>([]);

  const addNotification = (message: string, type: 'success' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  // Interactive FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Interactive AI Demo State
  const [aiPromptInput, setAiPromptInput] = useState<string>('Estrategia de comunicación para votantes jóvenes indecisos');
  const [aiResponse, setAiResponse] = useState<string>(
    'Análisis Campaña Ganadora AI: Los jóvenes de 18-28 años en el sector urbano priorizan propuestas de empleo tecnológico y transporte sostenible. Se recomienda una campaña de video corto enfocada en 3 compromisos clave con tono cercano y datos transparentes.'
  );
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Registration / Sign Up Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalEmail, setModalEmail] = useState<string>('');
  const [modalPassword, setModalPassword] = useState<string>('');
  const [modalFullName, setModalFullName] = useState<string>('');
  const [modalCampaignName, setModalCampaignName] = useState<string>('');
  const [modalPhone, setModalPhone] = useState<string>('');
  const [modalSubmitted, setModalSubmitted] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [registeredPanelUrl, setRegisteredPanelUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const loadCommercialConfig = () => {
      LandingCommercialConfigService.get().then((config) => {
        if (active) setCommercialConfig(config);
      }).catch(() => {
        if (active) setCommercialConfig(DEFAULT_LANDING_COMMERCIAL_CONFIG);
      });
    };

    loadCommercialConfig();
    window.addEventListener('pageshow', loadCommercialConfig);
    window.addEventListener('focus', loadCommercialConfig);
    window.addEventListener('storage', loadCommercialConfig);
    window.addEventListener(LANDING_COMMERCIAL_CONFIG_EVENT, loadCommercialConfig);

    return () => {
      active = false;
      window.removeEventListener('pageshow', loadCommercialConfig);
      window.removeEventListener('focus', loadCommercialConfig);
      window.removeEventListener('storage', loadCommercialConfig);
      window.removeEventListener(LANDING_COMMERCIAL_CONFIG_EVENT, loadCommercialConfig);
    };
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleSimulateAiPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim()) return;
    setIsAiGenerating(true);
    setAiResponse('Procesando consulta estratégica con modelo de lenguaje político Campaña Ganadora...');
    setTimeout(() => {
      setIsAiGenerating(false);
      setAiResponse(
        `Estrategia Generada para: "${aiPromptInput}":\n• Mensaje Fuerza: "Propuestas concretas con impacto medible en los primeros 100 días".\n• Canal Recomendado: Redes sociales + Volanteo focalizado en puesto de votación con mayor densidad.\n• Tasa de conversión proyectada: +18.4% sobre electorado neutro.`
      );
    }, 1200);
  };

  const handleOpenModuleById = (moduleId: string) => {
    const found = CAMPANA_GANADORA_MODULES.find((m) => m.id === moduleId);
    if (found) {
      setSelectedModule(found);
    }
  };

  // Filter modules for the interactive pillars section
  const filteredModules = CAMPANA_GANADORA_MODULES.filter((mod) => {
    const matchCategory = activePillarCategory === 'todos' || mod.category === activePillarCategory;
    const matchQuery =
      searchModuleQuery === '' ||
      mod.title.toLowerCase().includes(searchModuleQuery.toLowerCase()) ||
      mod.shortDesc.toLowerCase().includes(searchModuleQuery.toLowerCase()) ||
      mod.keyFeatures.some((f) => f.toLowerCase().includes(searchModuleQuery.toLowerCase()));
    return matchCategory && matchQuery;
  });

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmail.trim() || !modalPassword.trim() || !modalFullName.trim() || !modalCampaignName.trim()) return;

    if (modalPassword.length < 8) {
      setModalError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    const result = await registerNewClient({
      fullName: modalFullName,
      email: modalEmail,
      password: modalPassword,
      campaignName: modalCampaignName,
      phone: modalPhone,
    });

    setModalLoading(false);

    if (!result.success) {
      setModalError(result.error || 'Error al registrar. Intenta nuevamente.');
      return;
    }

    setModalSubmitted(true);
    setRegisteredPanelUrl(result.panelUrl || PANEL_ADMIN_URL);
    addNotification(`¡Cuenta creada exitosamente para ${modalEmail}! Redirigiendo al Panel...`, 'success');

    setTimeout(() => {
      window.open(result.panelUrl || PANEL_ADMIN_URL, '_blank');
    }, 2000);
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // FAQ Items
  const faqItems = [
    {
      question: '¿Qué es Campaña Ganadora AI y cómo ayuda a mi campaña política?',
      answer:
        'Campaña Ganadora AI es una plataforma integral SaaS y de Inteligencia Artificial diseñada específicamente para campañas electorales en Colombia y América Latina. Combina CRM de votantes 1x10, mapas de calor territorial, copiloto de IA generativo, control presupuestal CNE Cuentas Claras y monitoreo del Día D con OCR de actas E-14.',
    },
    {
      question: '¿Mis datos de votantes y estrategias están seguros y son privados?',
      answer:
        'Absolutamente. La plataforma cuenta con aislamiento estricto multi-inquilino (tenant isolation), encriptación de grado militar AES-256 en reposo y TLS 1.3 en tránsito. Cumplimos con la Ley 1581 de 2012 de Habeas Data y ningún dato de tu campaña se comparte con terceros.',
    },
    {
      question: '¿Cómo funciona el monitoreo de mesas y escrutinio del Día D (E-14)?',
      answer:
        'La aplicación permite a los testigos electorales tomar fotografías de los formularios E-14 desde su celular. Nuestro motor OCR extrae los conteos de votos al instante y detecta discrepancias o fraudes con alertas automatizadas para el equipo jurídico en comisiones escrutadoras.',
    },
    {
      question: '¿Se requiere instalación de software especializado en computadores?',
      answer:
        'No. Campaña Ganadora AI es una aplicación 100% web en la nube y optimizada para dispositivos móviles (smartphones y tablets). Puedes usarla desde cualquier navegador sin instalar nada.',
    },
    {
      question: '¿Cumple con los requisitos del CNE y la Ley 1475 de 2011?',
      answer:
        'Sí. El módulo administrativo incorpora los formatos oficiales de Cuentas Claras (Formularios 5B, 6B, 7B, 8B) y cuenta con un semáforo de alerta preventiva de topes de gastos fijados por el Consejo Nacional Electoral.',
    },
    {
      question: '¿Cómo puedo solicitar una demostración personalizada para mi equipo?',
      answer:
        'Puedes solicitar una sesión interactiva personalizada haciendo clic en cualquier botón de "Iniciar Sesión" o agendando directamente en nuestro formulario de registro.',
    },
  ];

  return (
    <div ref={landingRootRef} className="lusion-landing min-h-screen bg-[#080808] text-white font-sans selection:bg-[#FF4D4D] selection:text-white relative overflow-x-clip">
      <div className="lusion-page-progress fixed left-0 top-0 z-[80] h-[2px] w-full origin-left pointer-events-none" />
      <AnimatePresence>
        {showCinematicIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.025 }}
            transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black"
            aria-hidden="true"
          >
            <motion.div
              initial={{ clipPath: 'inset(-20% 100% -20% -20%)' }}
              animate={{ clipPath: 'inset(-20% -20% -20% -20%)' }}
              transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
              className="relative text-center px-8 py-6"
            >
              <div className="text-[clamp(2.4rem,8.5vw,7.2rem)] font-black leading-[1.15] tracking-[-0.03em] text-white select-none pb-2 pt-1 flex items-center justify-center flex-wrap">
                <span className="inline-block text-white">CAMPAÑA</span>
                <span className="text-redsun-gradient font-black inline-block ml-1 sm:ml-2">GANADORA</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.38em] text-zinc-400">
                <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-zinc-600" />
                <span>Experiencia electoral inteligente</span>
                <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-zinc-600" />
              </div>
            </motion.div>
            <div className="lusion-intro-progress" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Toast Notification Container */}
      <div className="fixed top-24 right-4 z-[100] space-y-2 pointer-events-none max-w-sm w-full">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="p-3.5 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md bg-emerald-950/90 text-emerald-200 border-emerald-500/50 pointer-events-auto flex items-center justify-between gap-2.5 animate-slide-up"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1">{n.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Background Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 transform-gpu">
        <LandingParticleNetwork />
        <div className="lusion-ambient lusion-ambient-a absolute top-[-10%] left-[15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#FF4D4D]/10 via-[#FF7A3D]/10 to-[#FF6B81]/10 blur-[100px] pointer-events-none opacity-60" />
        <div className="lusion-ambient lusion-ambient-b absolute bottom-[5%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-[#FF2E2E]/10 via-[#FF7A3D]/10 to-transparent blur-[110px] pointer-events-none opacity-50" />
        <div className="lusion-mesh-wave absolute inset-0" />
        <div className="lusion-scroll-depth absolute inset-0" />
        <div className="lusion-orbit-field absolute left-1/2 top-1/2" />
        <div className="lusion-depth-grid absolute inset-x-0 bottom-[-22vh] h-[62vh]" />
        <div className="lusion-comet lusion-comet-a" />
        <div className="lusion-comet lusion-comet-b" />
        <div className="lusion-comet lusion-comet-c" />
        <div className="lusion-film-grain absolute inset-0 opacity-[0.035]" />
      </div>

      {/* SECTION 1: NAVBAR (Anchored & Permanently Fixed at Top of Viewport) */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-[#080808]/95 border-b border-white/10 shadow-2xl shadow-black/90 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo - Fixed No-Shrink */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] p-0.5 shadow-lg shadow-[#FF4D4D]/30 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#080808] rounded-[10px] flex items-center justify-center">
                <BallotBrainIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF6A52] drop-shadow-[0_0_8px_rgba(255,77,77,0.65)]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-base sm:text-xl font-black tracking-tight text-white">
                Campaña <span className="text-redsun-gradient font-black">Ganadora</span>
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#FF4D4D]/20 text-[#FF7A3D] border border-[#FF4D4D]/30">
                AI
              </span>
            </div>
          </div>

          {/* Desktop & Wide Screen Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold text-zinc-300">
            <a
              href="#producto"
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Módulos Electorales
            </a>
            <a
              href="#demo"
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Demo Interactiva
            </a>
            <a
              href="#precios"
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Planes
            </a>
            <a
              href="#faq"
              className="px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              FAQ
            </a>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              id="btn-nav-iniciar-sesion"
              onClick={() => onLogin?.()}
              aria-label="Iniciar Sesión"
              className="px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] hover:brightness-110 active:scale-[0.98] text-white font-extrabold text-xs shadow-lg shadow-red-950/60 cursor-pointer flex items-center gap-2 border border-white/20 transition-all hover:scale-[1.03] whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Iniciar Sesión</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white cursor-pointer transition-colors shrink-0"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Top Spacer for Fixed Header */}
      <div className="pt-16 sm:pt-20" />

      {/* MOBILE & TABLET DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#080808]/98 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-8 lg:hidden animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF4D4D] to-[#FF7A3D] p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-[#080808] rounded-[10px] flex items-center justify-center">
                  <BallotBrainIcon className="w-6 h-6 text-[#FF6A52] drop-shadow-[0_0_8px_rgba(255,77,77,0.65)]" />
                </div>
              </div>
              <span className="text-base font-extrabold text-white">Campaña Ganadora AI</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl bg-white/10 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-6 text-lg font-bold text-zinc-200 my-auto">
            <a
              href="#producto"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#FF4D4D] transition"
            >
              Módulos Electorales
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#FF4D4D] transition"
            >
              Demo Interactiva
            </a>
            <a
              href="#precios"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#FF4D4D] transition"
            >
              Planes y Precios
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#FF4D4D] transition"
            >
              Preguntas Frecuentes
            </a>
          </nav>

          <div className="space-y-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogin?.();
              }}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full py-3.5 rounded-full bg-white/10 text-white font-bold text-sm border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Crear Cuenta de Campaña</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: HERO SECTION */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative min-h-[calc(100svh-5rem)] px-4 py-12 sm:px-6 lg:px-8 z-10 flex items-center justify-center overflow-hidden"
      >
        <div className="lusion-hero-sculpture" aria-hidden="true">
          <span className="lusion-sculpture-core" />
          <span className="lusion-sculpture-ring lusion-sculpture-ring-a" />
          <span className="lusion-sculpture-ring lusion-sculpture-ring-b" />
          <span className="lusion-particle lusion-particle-a" />
          <span className="lusion-particle lusion-particle-b" />
          <span className="lusion-particle lusion-particle-c" />
        </div>
        <div className="relative z-10 w-full text-center space-y-7 max-w-[1500px] mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-[#FF7A3D] text-xs font-bold shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-[#FF4D4D]" />
            <span>Suite Integral para Ganar Elecciones en Colombia</span>
          </div>

          {/* Fluid Cinematic Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lusion-campaign-hero font-black text-white uppercase"
          >
            <motion.span initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="lusion-hero-word lusion-hero-word-top block">Campaña</motion.span>
            <motion.span initial={{ opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="lusion-hero-word lusion-hero-word-bottom block text-redsun-gradient">Ganadora<span className="lusion-ai-mark">AI</span></motion.span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-zinc-400 font-normal max-w-2xl mx-auto leading-relaxed"
          >
            Tecnología electoral con Inteligencia Artificial para convertir estrategia, territorio y datos en una campaña ganadora.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              onClick={() => onLogin?.()}
              className="redsun-btn-primary w-full sm:w-auto text-sm sm:text-base py-4 px-8"
            >
              <span>Acceder al Sistema</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#pilares"
              className="redsun-btn-secondary w-full sm:w-auto text-sm sm:text-base py-4 px-8"
            >
              <Play className="w-4 h-4 text-[#FF4D4D] fill-current" />
              <span>Explorar los 5 Pilares</span>
            </a>
          </motion.div>
        </div>
        <motion.a
          href="#pilares"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="absolute bottom-5 right-5 hidden items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500 transition-colors hover:text-white sm:flex"
        >
          Desliza para explorar <span className="lusion-scroll-line" />
        </motion.a>
      </motion.section>

      {/* SECTION 3: TRUST MARQUEE */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: 0.6 }}
        className="py-10 border-y border-white/10 bg-[#080808]/90 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 text-center mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Respaldado para elecciones a Alcaldía, Gobernación, Concejo, Asamblea y Congreso
          </p>
        </div>

        <div className="relative w-full overflow-hidden">
          <div className="animate-redsun-marquee flex items-center gap-12 sm:gap-20">
            {[
              'ALCALDÍAS MUNICIPALES',
              'GOBERNACIONES DEPARTAMENTALES',
              'CONCEJOS & ASAMBLEAS',
              'CÁMARA & SENADO',
              'CUMPLIMIENTO CNE LEY 1475',
              'HABEAS DATA LEY 1581',
              'ESCRUTINIO OCR E-14',
              'MOVILIZACIÓN TERRITORIAL 1X10',
            ].map((logo, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 shrink-0 text-sm font-extrabold tracking-wide text-zinc-300 hover:text-white hover:border-[#FF4D4D]/40 transition cursor-default"
              >
                <Award className="w-4 h-4 text-[#FF4D4D]" />
                <span>{logo}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* SECTION 4: LOS 5 PILARES DE UNA CAMPAÑA GANADORA (DESARROLLADOS) */}
      <div id="producto" className="scroll-mt-24" />
      <motion.section
        id="pilares"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 scroll-mt-20"
      >
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Metodología de Victoria Electoral</span>
          </div>
          <h2 className="text-redsun-h2 font-black text-white">
            Los 5 Pilares de una <span className="text-redsun-gradient">Campaña Ganadora</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Haz clic en cualquiera de las herramientas para ver su desarrollo operativo completo, impacto electoral y marco legal.
          </p>
        </div>

        {/* Category Filter Pills & Search Bar */}
        <div className="space-y-6">
          {/* Centered Category Pills matching layout */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {CAMPANA_GANADORA_CATEGORIES.map((cat) => {
              const isActive = activePillarCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActivePillarCategory(cat.id);
                  }}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none flex items-center gap-2 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF4D4D] to-[#FF7A3D] text-white shadow-xl shadow-[#FF4D4D]/30 ring-2 ring-[#FF4D4D]/50 scale-105 border-transparent'
                      : 'bg-[#151515] text-zinc-300 hover:text-white hover:bg-[#222222] border border-white/10 hover:border-white/20'
                  }`}
                >
                  <span>{cat.title}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box & Quick Info Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4 pt-2">
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF4D4D] animate-pulse" />
              <span>
                Mostrando <strong className="text-white font-bold">{filteredModules.length}</strong> herramientas de{' '}
                <span className="text-[#FF7A3D] font-bold">
                  {CAMPANA_GANADORA_CATEGORIES.find((c) => c.id === activePillarCategory)?.title || 'Todas las Categorías'}
                </span>
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchModuleQuery}
                onChange={(e) => setSearchModuleQuery(e.target.value)}
                placeholder="Buscar en este pilar..."
                className="w-full pl-10 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#FF4D4D] transition"
              />
              {searchModuleQuery && (
                <button
                  onClick={() => setSearchModuleQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid of Developed Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredModules.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={() => setSelectedModule(item)}
                className="p-6 rounded-[24px] bg-[#111111] border border-white/10 hover:border-[#FF4D4D]/60 hover:bg-[#161616] transition-all duration-300 group cursor-pointer flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl hover:shadow-red-950/20"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${item.categoryColor}`}>
                      {item.categoryLabel}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400 border border-white/10">
                      {item.metricBadge}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#FF7A3D] transition-colors flex items-center justify-between">
                    <span>{item.title}</span>
                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {item.shortDesc}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-500 font-medium truncate max-w-[190px]">
                    {item.recommendedRole}
                  </span>
                  <span className="text-[#FF4D4D] font-bold text-xs flex items-center gap-1 group-hover:underline">
                    Ver Desarrollo →
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* SECTION 5: PROBLEMA VS SOLUCIÓN */}
      <motion.section
        id="soluciones"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16"
      >
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-redsun-h2 font-black text-white">
            De la Desorganización Tradicional a la <span className="text-redsun-gradient">Inteligencia Automatizada</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Las campañas ganadoras no se basan en rumores ni en listas de Excel desactualizadas. Centraliza cada área de tu campaña en una sola fuente de verdad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card: Tradicional */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 rounded-[28px] bg-red-950/20 border border-red-500/20 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
              <X className="w-4 h-4" />
              <span>Gestión Tradicional Fraccionada</span>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <span>Listas de votantes en hojas de cálculo dispersas, con duplicados y filtraciones.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <span>Cero visibilidad en tiempo real del trabajo de líderes y coordinadores barriales.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <span>Escrutinio del Día D a ciegas, con demoras para detectar alteraciones en formularios E-14.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                <span>Riesgo inminente de multas del CNE por sobrepasar topes de gastos de campaña.</span>
              </li>
            </ul>
          </motion.div>

          {/* Card: Campaña Ganadora Solution */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 rounded-[28px] bg-gradient-to-br from-[#FF4D4D]/15 via-transparent to-[#FF7A3D]/10 border border-[#FF4D4D]/40 space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 text-[#FF4D4D]/10 pointer-events-none">
              <Sparkles className="w-32 h-32" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#FF4D4D] to-[#FF7A3D] text-white text-xs font-bold shadow-lg">
              <Check className="w-4 h-4" />
              <span>Ecosistema Campaña Ganadora AI</span>
            </div>
            <ul className="space-y-4 text-xs sm:text-sm text-white font-medium">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#FF4D4D] shrink-0" />
                <span>CRM electoral unificado con segmentación 1x10 y validación de puesto en censo.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#FF4D4D] shrink-0" />
                <span>Mapas de calor en vivo que muestran el avance de votos objetivo por comuna y barrio.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#FF4D4D] shrink-0" />
                <span>Validación OCR de actas E-14 en 10 segundos con detección instantánea de alteraciones.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#FF4D4D] shrink-0" />
                <span>Control financiero CNE Cuentas Claras automatizado con semáforo de topes legales.</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </motion.section>

      {/* SECTION 6: PRODUCT SHOWCASE (INTERACTIVE DEMO SIMULATOR) */}
      <motion.section
        id="demo"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12"
      >
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-redsun-h2 font-black text-white">
            Demostración <span className="text-redsun-gradient">Interactiva</span> de Campaña Ganadora
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Explora las capacidades en tiempo real haciendo clic en las pestañas a continuación.
          </p>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { id: 'ai', label: 'Copiloto IA Generativo', icon: Bot },
            { id: 'crm', label: 'CRM & Líderes 1x10', icon: Users },
            { id: 'territory', label: 'Control Territorial & Heatmaps', icon: MapPin },
            { id: 'e14', label: 'Escrutinio Día D (OCR E-14)', icon: Vote },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabDemo === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabDemo(tab.id as any)}
                className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] text-white shadow-xl shadow-[#FF4D4D]/20 scale-105'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Showcase Canvas */}
        <div className="p-6 sm:p-10 rounded-[32px] bg-[#111111] border border-white/15 shadow-2xl space-y-6">
          {activeTabDemo === 'ai' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FF4D4D]/20 text-[#FF4D4D]">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Generador de Inteligencia Política</h4>
                    <p className="text-xs text-zinc-400">Prueba cómo responde la IA a un requerimiento de tu campaña</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSimulateAiPrompt} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={aiPromptInput}
                    onChange={(e) => setAiPromptInput(e.target.value)}
                    placeholder="Escribe un tema o instrucción para el copiloto..."
                    className="flex-1 px-4 py-3.5 rounded-2xl bg-black/60 border border-white/15 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-[#FF4D4D]"
                  />
                  <button
                    type="submit"
                    disabled={isAiGenerating}
                    className="redsun-btn-primary text-xs shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isAiGenerating ? 'Generando...' : 'Ejecutar IA'}</span>
                  </button>
                </div>
              </form>

              <div className="p-5 rounded-2xl bg-black/80 border border-white/10 space-y-2">
                <span className="text-[10px] font-mono text-[#FF7A3D] font-bold block">
                  RESULTADO SIMULADO CAMPAÑA GANADORA AI:
                </span>
                <p className="text-xs sm:text-sm text-zinc-200 font-mono whitespace-pre-line leading-relaxed">
                  {aiResponse}
                </p>
              </div>
            </div>
          )}

          {activeTabDemo === 'crm' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h4 className="text-base font-bold text-white">Segmentación de Votantes en CRM 1x10</h4>
                <span className="text-xs text-emerald-400 font-bold">1,240 Contactos Registrados</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-xs text-zinc-400 font-bold">Voto Seguro</span>
                  <span className="text-2xl font-black text-emerald-400">28,450</span>
                  <span className="text-[10px] text-zinc-500 block">63% de la Meta</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-xs text-zinc-400 font-bold">Indecisos Objetivo</span>
                  <span className="text-2xl font-black text-amber-400">12,100</span>
                  <span className="text-[10px] text-zinc-500 block">Atención Prioritaria</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-xs text-zinc-400 font-bold">Líderes de Zona</span>
                  <span className="text-2xl font-black text-[#FF7A3D]">48</span>
                  <span className="text-[10px] text-zinc-500 block">En Terreno</span>
                </div>
              </div>
            </div>
          )}

          {activeTabDemo === 'territory' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h4 className="text-base font-bold text-white">Mapa de Cobertura por Puestos de Votación</h4>
                <span className="text-xs text-[#FF4D4D] font-bold">12 Comunas Monitoreadas</span>
              </div>
              <div className="p-6 rounded-2xl bg-black/60 border border-white/10 text-center space-y-3">
                <MapPin className="w-10 h-10 text-[#FF4D4D] mx-auto animate-bounce" />
                <p className="text-xs text-zinc-300">
                  Visualiza municipios y concentraciones de simpatizantes con actualización en tiempo real desde la app móvil.
                </p>
              </div>
            </div>
          )}

          {activeTabDemo === 'e14' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h4 className="text-base font-bold text-white">Auditoría E-14 Día D en Vivo</h4>
                <span className="text-xs text-emerald-400 font-bold">Sin Discrepancias Detectadas</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">Mesa #12 • Colegio San José</span>
                    <span className="text-[11px] text-zinc-400">142 Votos Contabilizados OK</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  E-14 Verificado
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* SECTION 8: FUNCIONAMIENTO / PASO A PASO */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16 border-t border-white/10"
      >
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-redsun-h2 font-black text-white">
            Despliegue en <span className="text-redsun-gradient">4 Pasos Hacia la Victoria</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Configuración de Campaña',
              desc: 'Crea el perfil de tu candidatura, define el censo de tu municipio y carga tus metas de votación.',
            },
            {
              step: '02',
              title: 'Copiloto & Programa',
              desc: 'Sube tu programa de gobierno para entrenar al copiloto IA y alinear tus discursos y piezas.',
            },
            {
              step: '03',
              title: 'Movilización 1x10',
              desc: 'Asigna coordinadores y líderes barriales para censar y fidelizar votantes en el CRM.',
            },
            {
              step: '04',
              title: 'Día D & E-14 OCR',
              desc: 'Despliega tu red de testigos con escaneo fotográfico de actas y blindaje en escrutinios.',
            },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="redsun-card p-6 space-y-4"
            >
              <span className="text-3xl font-black text-redsun-gradient">{item.step}</span>
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* SECTION 10: INFORMACIÓN PARA NUEVAS CAMPAÑAS */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl space-y-12 px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6A52]/30 bg-[#FF6A52]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7A3D]">
            <Sparkles className="h-3.5 w-3.5" /> Etapa de lanzamiento comercial
          </div>
          <h2 className="text-redsun-h2 font-black text-white">
            Una plataforma para <span className="text-redsun-gradient">organizar toda la campaña</span>
          </h2>
          <p className="text-sm leading-7 text-zinc-400 sm:text-base">
            Campaña Ganadora AI inicia su etapa de comercialización con una propuesta clara: reunir estrategia, territorio, operación electoral y administración en un entorno centralizado y configurable.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Target, title: 'Para diferentes aspiraciones', text: 'Configura elecciones a alcaldía, concejo, gobernación, asamblea, Cámara, Senado o Presidencia con su alcance territorial correspondiente.' },
            { icon: Users, title: 'Equipos con funciones claras', text: 'Administra candidatos, coordinadores, líderes, encuestadores, testigos y jurados mediante perfiles y permisos separados.' },
            { icon: MapPin, title: 'Operación territorial', text: 'Organiza sectores, puestos, mesas, responsables, metas de cobertura y registros de campo vinculados a la campaña activa.' },
            { icon: BarChart3, title: 'Información consolidada', text: 'Consulta indicadores creados a partir de registros de votantes, encuestas, actividades territoriales y avances administrativos.' },
            { icon: FileText, title: 'Preparación para el Día E', text: 'Coordina asignaciones, verificación de llegada, reportes de participación, novedades y documentación electoral.' },
            { icon: Shield, title: 'Datos separados por campaña', text: 'Cada organización trabaja en su propio espacio, con acceso autenticado, permisos por rol y controles para proteger la información.' },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
              className="redsun-card group space-y-4 p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FF6A52]/25 bg-[#FF6A52]/10 text-[#FF6A52] transition-transform group-hover:scale-105"><Icon className="h-5 w-5" /></div>
              <h3 className="text-base font-black text-white">{item.title}</h3>
              <p className="text-xs leading-6 text-zinc-400">{item.text}</p>
            </motion.div>
          )})}
        </div>

        <div className="grid gap-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-7 md:grid-cols-3 md:p-10">
          <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6A52]">1. Configuración</p><h3 className="font-black text-white">Defina la contienda</h3><p className="mt-2 text-xs leading-6 text-zinc-400">Registre candidato, cargo, territorio, fecha electoral, equipo y módulos habilitados.</p></div>
          <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7A3D]">2. Implementación</p><h3 className="font-black text-white">Cargue la información</h3><p className="mt-2 text-xs leading-6 text-zinc-400">Incorpore sus datos reales y asigne responsables para comenzar la operación.</p></div>
          <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6B81]">3. Seguimiento</p><h3 className="font-black text-white">Controle los avances</h3><p className="mt-2 text-xs leading-6 text-zinc-400">Revise resultados, pendientes y actividad del equipo desde los paneles autorizados.</p></div>
        </div>
      </motion.section>

      {/* SECTION 11: PRICING (PLANES Y PRECIOS) */}
      <motion.section
        id="precios"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16"
      >
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-redsun-h2 font-black text-white">
            Planes Diseñados para <span className="text-redsun-gradient">Cada Alcance</span>
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Elige el plan acorde al tipo de elección y tamaño de tu campaña política.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-white/5 border border-white/10 mt-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
                billingCycle === 'monthly' ? 'bg-[#FF4D4D] text-white shadow' : 'text-zinc-400'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                billingCycle === 'annual' ? 'bg-[#FF4D4D] text-white shadow' : 'text-zinc-400'
              }`}
            >
              <span>Anual</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black uppercase">
                20% Ahorro
              </span>
            </button>
          </div>
        </div>

        {commercialConfig.plans.some(plan => plan.enabled) && (
          <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 lg:gap-8">
            {commercialConfig.plans
              .filter(plan => plan.enabled)
              .sort((a, b) => a.order - b.order)
              .map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`redsun-card relative flex flex-col justify-between space-y-6 p-6 sm:p-7 lg:p-8 ${plan.highlighted ? 'border-2 border-[#FF4D4D] redsun-glow-coral' : ''}`}
                >
                  {plan.badge && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#FF4D4D] to-[#FF7A3D] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">{plan.badge}</div>}
                  <div className="space-y-6">
                    <div><h3 className="mt-1 text-xl font-black text-white sm:text-2xl">{plan.name}</h3><p className="mt-2 text-xs text-zinc-400">{plan.description}</p></div>
                    <div className="flex items-baseline gap-1"><span className="text-3xl font-black text-white sm:text-4xl">{plan.currency === 'USD' ? '$' : ''}{(billingCycle === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice).toLocaleString('es-CO')}</span><span className="text-xs font-semibold text-zinc-400">{plan.currency} {plan.billingLabel}</span></div>
                    <ul className="space-y-3 text-xs text-zinc-300">{plan.features.filter(Boolean).map((feature, featureIndex) => <li key={`${plan.id}-${featureIndex}`} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4D4D]"/><span>{feature}</span></li>)}</ul>
                  </div>
                  <button onClick={() => onLogin?.()} className={plan.highlighted ? 'redsun-btn-primary w-full text-xs' : 'redsun-btn-secondary w-full text-xs'}>{plan.buttonLabel || 'Seleccionar plan'}</button>
                </motion.div>
              ))}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className={`${commercialConfig.plans.some(plan => plan.enabled) ? 'hidden' : 'grid'} grid-cols-1 md:grid-cols-3 gap-5 md:gap-5 lg:gap-8 items-stretch`}>
          {/* Card 1: Starter */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="redsun-card p-6 sm:p-7 md:p-6 lg:p-8 space-y-6 md:space-y-6 lg:space-y-8 flex flex-col justify-between"
          >
            <div className="space-y-5 md:space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">Starter Local</h3>
                <p className="text-xs text-zinc-400 mt-2">Para campañas a Concejo o Alcaldías pequeñas.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">
                  ${billingCycle === 'annual' ? '119' : '149'}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">USD / mes</span>
              </div>

              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Hasta 10,000 votantes en CRM</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Copiloto IA (500 consultas/mes)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Monitoreo de 20 mesas E-14</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onLogin?.()}
              className="redsun-btn-secondary w-full text-xs cursor-pointer"
            >
              Seleccionar Starter
            </button>
          </motion.div>

          {/* Card 2: PRO AI (Highlighted) */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="redsun-card p-6 sm:p-7 md:p-6 lg:p-8 space-y-6 md:space-y-6 lg:space-y-8 flex flex-col justify-between border-2 border-[#FF4D4D] relative redsun-glow-coral"
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#FF4D4D] to-[#FF7A3D] text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
              MÁS POPULAR
            </div>

            <div className="space-y-5 md:space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">Campaña Ganadora Pro</h3>
                <p className="text-xs text-zinc-300 mt-2">Poder total con IA ilimitada y control territorial.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">
                  ${billingCycle === 'annual' ? '319' : '399'}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">USD / mes</span>
              </div>

              <ul className="space-y-3 text-xs text-white">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Hasta 100,000 votantes en CRM</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Copiloto IA Ilimitado</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Escrutinio OCR E-14 sin límite</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Cuentas Claras CNE & Topes</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onLogin?.()}
              className="redsun-btn-primary w-full text-xs cursor-pointer"
            >
              Iniciar Campaña Ganadora Pro
            </button>
          </motion.div>

          {/* Card 3: Enterprise */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="redsun-card p-6 sm:p-7 md:p-6 lg:p-8 space-y-6 md:space-y-6 lg:space-y-8 flex flex-col justify-between"
          >
            <div className="space-y-5 md:space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">Gobernación / Senado</h3>
                <p className="text-xs text-zinc-400 mt-2">Para campañas de cobertura departamental y nacional.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">
                  ${billingCycle === 'annual' ? '719' : '899'}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">USD / mes</span>
              </div>

              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Votantes ilimitados en CRM</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Módulo Jurídico E-24 / E-26 Completo</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#FF4D4D]" />
                  <span>Soporte prioritario Día D 24/7 en vivo</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => onLogin?.()}
              className="redsun-btn-secondary w-full text-xs cursor-pointer"
            >
              Contactar Asesor Especializado
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* SECTION 12: PREGUNTAS FRECUENTES (FAQ ACCORDION) */}
      <motion.section
        id="faq"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12"
      >
        <div className="text-center space-y-4">
          <h2 className="text-redsun-h2 font-black text-white">
            Preguntas <span className="text-redsun-gradient">Frecuentes</span>
          </h2>
        </div>

        <div className="space-y-4">
          {faqItems.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="rounded-2xl bg-[#111111] border border-white/10 overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-[#FF4D4D] transition cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#FF4D4D] shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-xs sm:text-sm text-zinc-400 leading-relaxed animate-fade-in border-t border-white/5 pt-4">
                    {faq.answer}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* SECTION 13: CTA FINAL HIGH IMPACT BANNER */}
      <motion.section
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <div className="p-10 sm:p-16 rounded-[36px] bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] text-white text-center space-y-8 relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              ¿Listo para Asegurar la Victoria de Tu Campaña con IA?
            </h2>
            <p className="text-sm sm:text-lg text-white/90 max-w-xl mx-auto font-medium">
              Ingresa a Campaña Ganadora AI hoy mismo y blinda cada voto en tu territorio.
            </p>
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => onLogin?.()}
                className="px-8 py-4 rounded-full bg-white text-black font-extrabold text-sm hover:bg-zinc-100 transition shadow-xl cursor-pointer"
              >
                Ingresar al Sistema Ahora
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* PIE DE PÁGINA */}
      <footer className="mt-10 border-t border-white/10 bg-[#050505] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-md space-y-4">
            <a href="#" className="inline-flex items-center gap-3" aria-label="Volver al inicio">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4D4D] to-[#FF7A3D] p-0.5 shadow-lg shadow-red-950/40">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#080808]">
                  <BallotBrainIcon className="h-7 w-7 text-[#FF6A52]" />
                </div>
              </div>
              <div>
                <p className="text-base font-black text-white">Campaña Ganadora AI</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6A52]">Tecnología electoral</p>
              </div>
            </a>
            <p className="text-sm leading-6 text-zinc-400">
              Plataforma para organizar la estrategia, el territorio, los equipos y la operación electoral desde un solo lugar.
            </p>
            {Object.values(commercialConfig.contact).some(Boolean) && (
              <div className="pt-2">
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white">Información de contacto</h3>
                <div className="grid gap-1.5 text-xs text-zinc-400">
                  {commercialConfig.contact.email && <a className="hover:text-[#FF6A52]" href={`mailto:${commercialConfig.contact.email}`}>{commercialConfig.contact.email}</a>}
                  {commercialConfig.contact.phone && <a className="hover:text-[#FF6A52]" href={`tel:${commercialConfig.contact.phone}`}>{commercialConfig.contact.phone}</a>}
                  {commercialConfig.contact.whatsapp && <a className="hover:text-[#FF6A52]" href={`https://wa.me/${commercialConfig.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp: {commercialConfig.contact.whatsapp}</a>}
                  {(commercialConfig.contact.address || commercialConfig.contact.city) && <p>{[commercialConfig.contact.address, commercialConfig.contact.city].filter(Boolean).join(' · ')}</p>}
                  {commercialConfig.contact.schedule && <p>{commercialConfig.contact.schedule}</p>}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">Explorar</h3>
            <nav className="grid gap-3 text-sm text-zinc-400" aria-label="Navegación del pie de página">
              <a href="#producto" className="transition-colors hover:text-[#FF6A52]">Módulos electorales</a>
              <a href="#demo" className="transition-colors hover:text-[#FF6A52]">Demostración del sistema</a>
              <a href="#precios" className="transition-colors hover:text-[#FF6A52]">Planes disponibles</a>
              <a href="#faq" className="transition-colors hover:text-[#FF6A52]">Preguntas frecuentes</a>
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">Acceso</h3>
            <p className="mb-4 text-sm leading-6 text-zinc-400">Ingrese de forma segura al panel de control de su campaña.</p>
            <button
              type="button"
              onClick={() => onLogin?.()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-red-950/40 transition hover:brightness-110"
            >
              <Lock className="h-3.5 w-3.5" />
              Iniciar sesión
            </button>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-[11px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Campaña Ganadora AI. Todos los derechos reservados.</p>
          <p>Uso responsable de datos y acceso protegido por roles.</p>
        </div>
      </footer>

      {/* DETAIL MODAL FOR ANY DEVELOPED MODULE OF CAMPAÑA GANADORA */}
      <CampanaGanadoraDetailModal
        item={selectedModule}
        onClose={() => setSelectedModule(null)}
        onLogin={onLogin}
      />

      {/* FULL REGISTRATION / SIGN UP MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-[#0d0d0d] border border-white/15 rounded-[32px] p-8 max-w-md w-full space-y-6 relative shadow-2xl"
            >
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setModalSubmitted(false);
                  setModalError(null);
                }}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF4D4D] to-[#FF7A3D] p-0.5 mx-auto flex items-center justify-center shadow-lg shadow-red-950/50">
                  <div className="w-full h-full bg-[#080808] rounded-[14px] flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[#FF4D4D]" />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">Crear Cuenta de Campaña Ganadora</h3>
                <p className="text-xs text-zinc-400">
                  Accede a la suite completa de inteligencia política en segundos.
                </p>
              </div>

              {modalSubmitted ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <span className="text-sm font-black text-white block">¡Campaña Registrada Exitosamente!</span>
                    <p className="text-xs text-zinc-300">Tu espacio seguro ha sido aprovisionado. Ingresando al panel...</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      onLogin?.();
                    }}
                    className="redsun-btn-primary w-full text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Iniciar Sesión Ahora</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleModalSubmit} className="space-y-3">
                  {modalError && (
                    <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 font-semibold">
                      {modalError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        required
                        value={modalFullName}
                        onChange={(e) => setModalFullName(e.target.value)}
                        placeholder="Nombre del candidato o gerente"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF4D4D] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Nombre de la Campaña *</label>
                      <input
                        type="text"
                        required
                        value={modalCampaignName}
                        onChange={(e) => setModalCampaignName(e.target.value)}
                        placeholder="Ej: Campaña Alcaldía 2027"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF4D4D] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Correo Electrónico *</label>
                      <input
                        type="email"
                        required
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        placeholder="candidato@campanaganadora.co"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF4D4D] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Contraseña (mín. 8 caracteres) *</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={modalPassword}
                        onChange={(e) => setModalPassword(e.target.value)}
                        placeholder="Contraseña segura"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF4D4D] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Teléfono (opcional)</label>
                      <input
                        type="tel"
                        value={modalPhone}
                        onChange={(e) => setModalPhone(e.target.value)}
                        placeholder="+57 300 000 0000"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#FF4D4D] transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="redsun-btn-primary w-full text-xs py-3.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {modalLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creando tu campaña...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>Registrar Campaña Ganadora</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-zinc-600">
                    ¿Ya tienes cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        onLogin?.();
                      }}
                      className="text-[#FF4D4D] hover:underline font-bold cursor-pointer"
                    >
                      Inicia Sesión aquí →
                    </button>
                  </p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Scroll To Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 15 }}
            onClick={scrollToTop}
            className="fixed bottom-5 right-5 z-50 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-gradient-to-r from-[#FF4D4D] via-[#FF7A3D] to-[#FF6B81] text-white shadow-lg shadow-[#FF4D4D]/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1.5 border border-white/25 group cursor-pointer"
            title="Volver al inicio"
          >
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden sm:inline">Volver Arriba</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
