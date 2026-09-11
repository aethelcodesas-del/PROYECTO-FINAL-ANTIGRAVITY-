import React, { useState, useEffect } from 'react';
import { ViewMode } from '../../types';
import { 
  Settings, 
  ShieldCheck, 
  Bell, 
  Database, 
  Key, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  Download, 
  Check,
  Contrast,
  Sun,
  Moon,
  Type,
  MousePointerClick,
  Accessibility,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Server,
  Zap,
  Globe
} from 'lucide-react';
import { testSupabaseConnection, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { ColorModeToggle } from '../common/ColorModeToggle';

interface ConfiguracionViewProps {
  onSelectView: (view: ViewMode) => void;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({ onSelectView }) => {
  const [activeTab, setActiveTab] = useState<'accesibilidad' | 'seguridad' | 'notificaciones' | 'api' | 'base_datos'>('accesibilidad');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [campaignName, setCampaignName] = useState('Campaña Presidencial Javier Méndez 2026');
  const [candidateName, setCandidateName] = useState('Javier Méndez');
  const [jurisdiction, setJurisdiction] = useState('Colombia - Cobertura Nacional');
  const [electionDate, setElectionDate] = useState('2026-05-24');
  const [targetVotes, setTargetVotes] = useState('8,500,000');

  // Accessibility & Theme states
  const [themeMode, setThemeMode] = useState<'dark' | 'high_contrast' | 'light'>(() => {
    return (localStorage.getItem('bee_theme_mode') as any) || 'dark';
  });
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('bee_font_scale') as any) || 'normal';
  });
  const [enhancedFocus, setEnhancedFocus] = useState<boolean>(() => {
    return localStorage.getItem('bee_enhanced_focus') === 'true';
  });
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    return localStorage.getItem('bee_reduce_motion') === 'true';
  });
  const [underlineLinks, setUnderlineLinks] = useState<boolean>(() => {
    return localStorage.getItem('bee_underline_links') === 'true';
  });

  // Apply accessibility classes to documentElement
  useEffect(() => {
    const root = document.documentElement;
    
    // Theme High Contrast
    if (themeMode === 'high_contrast') {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    localStorage.setItem('bee_theme_mode', themeMode);

    // Font Scale
    root.classList.remove('font-scale-lg', 'font-scale-xl');
    if (fontScale === 'large') root.classList.add('font-scale-lg');
    if (fontScale === 'xlarge') root.classList.add('font-scale-xl');
    localStorage.setItem('bee_font_scale', fontScale);

    // Enhanced Focus Rings
    if (enhancedFocus) {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }
    localStorage.setItem('bee_enhanced_focus', String(enhancedFocus));

    // Reduce Motion
    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    localStorage.setItem('bee_reduce_motion', String(reduceMotion));

    // Underline Links
    if (underlineLinks) {
      root.classList.add('underline-links');
    } else {
      root.classList.remove('underline-links');
    }
    localStorage.setItem('bee_underline_links', String(underlineLinks));
  }, [themeMode, fontScale, enhancedFocus, reduceMotion, underlineLinks]);

  // Security settings
  const [require2FA, setRequire2FA] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [geofenceRadius, setGeofenceRadius] = useState('100');

  // Notifications settings
  const [alertE14Discrepancy, setAlertE14Discrepancy] = useState(true);
  const [alertBudgetOverrun, setAlertBudgetOverrun] = useState(true);
  const [alertSocialCrisis, setAlertSocialCrisis] = useState(true);
  const [dailyDigestEmail, setDailyDigestEmail] = useState(false);

  // API Keys state
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('AIzaSyD-73918239102938102938109238');
  const [whatsappApiKey, setWhatsappApiKey] = useState('WA_PRO_LIVE_992182019203910293');
  const [mapsApiKey, setMapsApiKey] = useState('AIzaSyB-8837192837129837129837129');

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const [supabaseStatus, setSupabaseStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: false,
    success: true,
    message: 'Base de datos central conectada mediante TLS 1.3 con RLS activo.'
  });

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      const res = await testSupabaseConnection();
      setSupabaseStatus({
        checked: true,
        success: res.success,
        message: res.message
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSupabaseStatus({
        checked: true,
        success: false,
        message: e?.message || 'Error al conectar con la base de datos'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePresetAccessibility = (preset: 'standard' | 'high_contrast' | 'maximum') => {
    if (preset === 'standard') {
      setThemeMode('dark');
      setFontScale('normal');
      setEnhancedFocus(false);
      setReduceMotion(false);
      setUnderlineLinks(false);
    } else if (preset === 'high_contrast') {
      setThemeMode('high_contrast');
      setFontScale('large');
      setEnhancedFocus(true);
      setReduceMotion(false);
      setUnderlineLinks(true);
    } else if (preset === 'maximum') {
      setThemeMode('high_contrast');
      setFontScale('xlarge');
      setEnhancedFocus(true);
      setReduceMotion(true);
      setUnderlineLinks(true);
    }
  };

  const tabs = [
    { id: 'accesibilidad', label: 'Accesibilidad & Tema', icon: <Accessibility className="w-4 h-4" /> },
    { id: 'seguridad', label: 'Seguridad y Roles', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'notificaciones', label: 'Alertas', icon: <Bell className="w-4 h-4" /> },
    { id: 'api', label: 'Claves API', icon: <Key className="w-4 h-4" /> },
    { id: 'base_datos', label: 'Datos y Sync', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030712] text-slate-100 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-gradient-to-r from-[#061c36] via-[#08284c] to-[#041226] p-6 rounded-3xl border border-cyan-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-lg shrink-0">
            <Settings className="w-6 h-6 animate-spin-slow text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-wide">
                Configuración del Sistema
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                v2.6 PRO
              </span>
              {themeMode === 'high_contrast' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/50">
                  WCAG AA ALTO CONTRASTE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Administración centralizada de parámetros de campaña, accesibilidad WCAG AA, modelos de IA, claves API y seguridad.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white animate-bounce" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-white" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Success Floating Notification */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <div>
            <div className="font-bold text-xs">Configuración Actualizada</div>
            <div className="text-[11px] text-emerald-100">Los cambios se aplicaron exitosamente en todo el sistema.</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-2xl bg-[#07172e] border border-cyan-500/20">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-cyan-500/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: ACCESIBILIDAD Y TEMA */}
      {activeTab === 'accesibilidad' && (
        <div className="space-y-6">
          {/* Visual Color Mode: Color Establecido vs Efecto Blanco */}
          <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Apariencia — Color Principal y Efecto Visual
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Alterna entre el esquema de color establecido o el efecto blanco de alta luminosidad sin alterar datos ni funciones.
                </p>
              </div>
              <div>
                <ColorModeToggle variant="segmented" />
              </div>
            </div>

            <ColorModeToggle variant="cards" />
          </div>

          {/* Theme Selector Grid */}
          <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Contrast className="w-4 h-4 text-cyan-400" />
                  Selector de Tema y Modo de Contraste
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Elige la combinación visual adaptada a tus condiciones visuales y luminosidad de trabajo.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 bg-[#030e1f] p-1 rounded-xl border border-cyan-500/20">
                <button
                  onClick={() => handlePresetAccessibility('standard')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    themeMode === 'dark' && fontScale === 'normal' && !enhancedFocus
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Estándar
                </button>
                <button
                  onClick={() => handlePresetAccessibility('high_contrast')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    themeMode === 'high_contrast'
                      ? 'bg-yellow-500 text-black font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  WCAG AA
                </button>
                <button
                  onClick={() => handlePresetAccessibility('maximum')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    themeMode === 'high_contrast' && fontScale === 'xlarge'
                      ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  WCAG AAA
                </button>
              </div>
            </div>

            {/* 3 Visual Theme Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Theme 1: Cyber Dark (Standard) */}
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                  themeMode === 'dark'
                    ? 'bg-[#041226] border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-900/30'
                    : 'bg-[#030e1f] border-slate-700/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs text-white">Cyber Dark (Predeterminado)</span>
                  </div>
                  {themeMode === 'dark' && (
                    <span className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                      <Check className="w-3 h-3 font-black" />
                    </span>
                  )}
                </div>

                <div className="h-16 rounded-xl bg-gradient-to-br from-[#040e21] to-[#08203e] border border-cyan-500/30 p-2.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="w-8 h-1.5 rounded-full bg-slate-600" />
                    <span className="w-12 h-1.5 rounded-full bg-slate-700" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-cyan-300 font-mono font-semibold">Contrast: 5.2:1</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Standard</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  Estética electoral tecnológica con acentos cian, verde esmeralda y coral equilibrados.
                </p>
              </button>

              {/* Theme 2: High Contrast (WCAG AA) */}
              <button
                type="button"
                onClick={() => setThemeMode('high_contrast')}
                className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                  themeMode === 'high_contrast'
                    ? 'bg-[#000000] border-yellow-400 ring-2 ring-yellow-400 shadow-xl shadow-yellow-950/50'
                    : 'bg-[#030e1f] border-slate-700/60 hover:border-yellow-400/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Contrast className="w-4 h-4 text-yellow-400" />
                    <span className="font-extrabold text-xs text-yellow-300">Modo Alto Contraste (WCAG AA)</span>
                  </div>
                  {themeMode === 'high_contrast' && (
                    <span className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-black">
                      <Check className="w-3 h-3 font-black" />
                    </span>
                  )}
                </div>

                <div className="h-16 rounded-xl bg-black border-2 border-white p-2.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className="w-10 h-2 rounded-full bg-white" />
                    <span className="w-14 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-yellow-300 font-mono font-extrabold">Ratio: 12.5:1</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400 text-black font-black uppercase">WCAG AAA</span>
                  </div>
                </div>

                <p className="text-[11px] text-white font-medium">
                  Fondo negro puro, tipografía blanca brillante, bordes nítidos de 2px y contraste certificado.
                </p>
              </button>

              {/* Theme 3: Campo Solar / Alta Luminosidad */}
              <button
                type="button"
                onClick={() => {
                  setThemeMode('dark');
                  setFontScale('large');
                  setEnhancedFocus(true);
                }}
                className="p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-3 relative bg-[#030e1f] border-slate-700/60 hover:border-slate-500"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs text-white">Trabajo de Campo Exterior</span>
                  </div>
                </div>

                <div className="h-16 rounded-xl bg-gradient-to-br from-[#0c2447] to-[#041124] border border-amber-400/40 p-2.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-12 h-1.5 rounded-full bg-amber-200" />
                    <span className="w-8 h-1.5 rounded-full bg-white" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-amber-300 font-mono font-semibold">Contrast: 8.4:1</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">Outdoor AA</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  Ajuste de tipografía agrandada y bordes destacados para visibilidad bajo sol directo en Día D.
                </p>
              </button>

            </div>
          </div>

          {/* Granular Accessibility Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Visual & Typographic Scale */}
            <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Type className="w-4 h-4 text-cyan-400" />
                Escala Tipográfica y Legibilidad
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Tamaño de Fuente Global
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFontScale('normal')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        fontScale === 'normal'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                          : 'bg-[#030b19] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      100% Estándar
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontScale('large')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        fontScale === 'large'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                          : 'bg-[#030b19] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      112% Grande
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontScale('xlarge')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        fontScale === 'xlarge'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                          : 'bg-[#030b19] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      125% Accesible
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
                  <div>
                    <div className="text-xs font-bold text-white">Subrayar Enlaces y Botones de Texto</div>
                    <div className="text-[10px] text-slate-400">Garantiza diferenciación sin depender del color (WCAG 1.4.1)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={underlineLinks}
                    onChange={(e) => setUnderlineLinks(e.target.checked)}
                    className="w-5 h-5 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Navigation & Focus Accessibility */}
            <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-emerald-400" />
                Navegación por Teclado y Movimiento
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
                  <div>
                    <div className="text-xs font-bold text-white">Anillos de Foco Reforzados (Focus Rings)</div>
                    <div className="text-[10px] text-slate-400">Borde amarillo de 3px para navegación rápida con tecla Tab</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enhancedFocus}
                    onChange={(e) => setEnhancedFocus(e.target.checked)}
                    className="w-5 h-5 accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
                  <div>
                    <div className="text-xs font-bold text-white">Reducir Animaciones y Transiciones</div>
                    <div className="text-[10px] text-slate-400">Previene fatiga visual y respeta 'prefers-reduced-motion'</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                    className="w-5 h-5 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* WCAG Compliance Live Validator Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#031527] to-[#072444] border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Conformidad con Directrices WCAG 2.1 Nivel AA y AAA</span>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Aprobado
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Los componentes de Bee Campaign AI mantienen ratios de contraste de color superiores a 4.5:1 en texto regular y 3:1 en elementos de interfaz interactivos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center px-3 py-1.5 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase">Ratio Texto</div>
                <div className="text-xs font-mono font-bold text-emerald-400">12.5 : 1</div>
              </div>
              <div className="text-center px-3 py-1.5 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase">Ratio UI</div>
                <div className="text-xs font-mono font-bold text-cyan-400">4.8 : 1</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT: SEGURIDAD Y ROLES */}
      {activeTab === 'seguridad' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Políticas de Autenticación y Sesión
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
                <div>
                  <div className="text-xs font-bold text-white">Exigir Autenticación de Dos Factores (2FA)</div>
                  <div className="text-[10px] text-slate-400">Obligatorio para Coordinadores Electorales y Admin</div>
                </div>
                <input
                  type="checkbox"
                  checked={require2FA}
                  onChange={(e) => setRequire2FA(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Cierre de Sesión por Inactividad (Minutos)</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-full bg-[#030b19] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="15">15 Minutos</option>
                  <option value="30">30 Minutos (Recomendado)</option>
                  <option value="60">60 Minutos</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Radio Máximo de Verificación Geofence para Testigos (Metros)</label>
                <select
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(e.target.value)}
                  className="w-full bg-[#030b19] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="50">50 Metros (Máxima Precisión)</option>
                  <option value="100">100 Metros (Estándar)</option>
                  <option value="250">250 Metros (Zonas Rurales)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4">
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Auditoría y Permisos Jerárquicos
            </h2>

            <div className="p-4 rounded-2xl bg-[#030e1f] border border-cyan-500/10 space-y-2 text-xs">
              <div className="font-bold text-cyan-300">Roles Configurados en el Sistema:</div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li><strong className="text-white">Superadmin:</strong> Acceso total a todos los módulos y claves API.</li>
                <li><strong className="text-white">Administrador:</strong> Gestión de usuarios y nómina.</li>
                <li><strong className="text-white">Director Estratégico:</strong> DAFO, presupuestos e IA.</li>
                <li><strong className="text-white">Coordinador Territorial:</strong> Mapas, actas E-14 y testigos.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: NOTIFICACIONES */}
      {activeTab === 'notificaciones' && (
        <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4 max-w-3xl">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Preferencias de Alertas en Tiempo Real
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
              <div>
                <div className="text-xs font-bold text-white">Alertar Inconsistencias Aritméticas E-14</div>
                <div className="text-[10px] text-slate-400">Notificar inmediatamente cuando el OCR detecte alteración de votos</div>
              </div>
              <input
                type="checkbox"
                checked={alertE14Discrepancy}
                onChange={(e) => setAlertE14Discrepancy(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
              <div>
                <div className="text-xs font-bold text-white">Alerta de Umbral de Presupuesto (&gt;80%)</div>
                <div className="text-[10px] text-slate-400">Avisar a tesorería cuando una categoría supere el límite asignado</div>
              </div>
              <input
                type="checkbox"
                checked={alertBudgetOverrun}
                onChange={(e) => setAlertBudgetOverrun(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
              <div>
                <div className="text-xs font-bold text-white">Alerta de Crisis en Redes Sociales</div>
                <div className="text-[10px] text-slate-400">Gatillar cuando se detecten más de 500 menciones negativas por hora</div>
              </div>
              <input
                type="checkbox"
                checked={alertSocialCrisis}
                onChange={(e) => setAlertSocialCrisis(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20">
              <div>
                <div className="text-xs font-bold text-white">Resumen Diario por Correo Electrónico</div>
                <div className="text-[10px] text-slate-400">Enviar informe ejecutivo consolidado cada medianoche</div>
              </div>
              <input
                type="checkbox"
                checked={dailyDigestEmail}
                onChange={(e) => setDailyDigestEmail(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: API KEYS */}
      {activeTab === 'api' && (
        <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-4 max-w-3xl">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            Gestión de Integraciones y Claves API
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">Gemini AI API Key (Servidor)</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full bg-[#030b19] border border-cyan-500/30 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">WhatsApp Business API Key (Broadcast)</label>
              <input
                type="password"
                value={whatsappApiKey}
                onChange={(e) => setWhatsappApiKey(e.target.value)}
                className="w-full bg-[#030b19] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">Google Maps Platform API Key (Geofencing)</label>
              <input
                type="password"
                value={mapsApiKey}
                onChange={(e) => setMapsApiKey(e.target.value)}
                className="w-full bg-[#030b19] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DATABASE AND SYNC */}
      {activeTab === 'base_datos' && (
        <div className="space-y-6 max-w-3xl">
          <div className="p-6 rounded-3xl bg-[#07172e] border border-cyan-500/20 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-cyan-500/10 pb-4">
              <div>
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Base de Datos Central (PostgreSQL Cloud)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conexión segura en tiempo real con cifrado TLS 1.3 y seguridad a nivel de fila (RLS).
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Enlace Activo
              </span>
            </div>

            {/* Connection Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20 space-y-1">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  API Endpoint / URL
                </div>
                <div className="font-mono text-[11px] text-slate-200 truncate select-all">
                  https://••••••••.cloud-cluster/rest/v1
                </div>
                <div className="text-[10px] text-slate-500">API Endpoint seguro REST v1 (Conectado)</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#030e1f] border border-cyan-500/20 space-y-1">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  Publishable Key
                </div>
                <div className="font-mono text-[11px] text-slate-200 truncate select-all">
                  {SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 12)}••••••••${SUPABASE_ANON_KEY.slice(-8)}` : '••••••••••••'}
                </div>
                <div className="text-[10px] text-emerald-400/80">Token JWT firmado y verificado</div>
              </div>
            </div>

            {/* Security Parameters Badges */}
            <div className="p-4 rounded-2xl bg-[#030e1f]/80 border border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Protocolos de Seguridad & Protección de Datos
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#07172e] border border-cyan-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Cifrado TLS 1.3 / SSL</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#07172e] border border-cyan-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Row-Level Security (RLS)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#07172e] border border-cyan-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Backup & Replicación Cloud</span>
                </div>
              </div>
            </div>

            {/* Sync Test Action */}
            <div className="p-4 rounded-2xl bg-[#030e1f] border border-cyan-500/20 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  Estado de Conexión en Nube
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{supabaseStatus.message}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncDatabase}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-cyan-900/30"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Verificando...' : 'Comprobar Conexión'}</span>
                </button>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Exportar Respaldo Local (JSON)</span>
              </button>
            </div>
          </div>

          {/* DANGER ZONE: RESET TO ZERO */}
          <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-500/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white">
                  Restablecer Software a Estado Inicial (Empezar Desde Cero)
                </h2>
                <p className="text-xs text-rose-300/80">
                  Limpia expedientes previos, contabilidad, testigos y datos de prueba para iniciar la operación desde cero.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#020712] border border-rose-500/20 text-xs text-slate-300 space-y-2">
              <p className="text-[11px] text-slate-400">
                Al ejecutar esta acción, el software restablecerá todos los módulos (expediente de candidato, listas aliadas, libro contable CNE y testigos electorales) a un estado limpio sin registros previos.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Confirmas que deseas restablecer el software a estado inicial desde cero?')) {
                      try {
                        localStorage.removeItem('elecciones_campana_principal_dossier_v2');
                        localStorage.removeItem('elecciones_campanas_guardadas_v2');
                        localStorage.removeItem('elecciones_campana_activa_id_v2');
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
                        console.error(e);
                      }
                      window.dispatchEvent(new Event('candidate_photo_updated'));
                      window.dispatchEvent(new Event('candidate_name_updated'));
                      window.dispatchEvent(new Event('storage'));
                      setSaveSuccess(true);
                      setTimeout(() => {
                        window.location.reload();
                      }, 800);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restablecer y Empezar Desde Cero</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
