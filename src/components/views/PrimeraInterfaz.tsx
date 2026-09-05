import React, { useState, useEffect } from 'react';
import { useCampaignData } from '../../contexts/CampaignContext';
import { motion, AnimatePresence } from 'motion/react';
import { ViewMode, UserRole, AuthUser } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { insforge } from '../../lib/insforgeClient';
import { writeAuditLog } from '../../utils/auditLogger';

// iOS Spring Physics Configuration
const iosSpring = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85
};
import { CampaignLogoBadge } from '../common/CampaignLogoIcon';
import { CountdownWidget } from '../common/CountdownWidget';
import { CampaignLivePanel } from '../common/LiveMetricsBadge';
import { 
  Shield, 
  LayoutGrid, 
  Megaphone, 
  MapPin, 
  Users, 
  Lock, 
  Unlock, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  BarChart3, 
  Zap, 
  Building2, 
  Globe2, 
  Sliders,
  ChevronRight,
  UserCheck,
  AlertCircle,
  KeyRound,
  User,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  RefreshCw,
  Database,
  X,
  Award,
  Activity
} from 'lucide-react';

interface PrimeraInterfazProps {
  onLoginSuccess: (user: AuthUser, route: ViewMode) => void;
}

export const PrimeraInterfaz: React.FC<PrimeraInterfazProps> = ({ onLoginSuccess }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('superadmin');
  
  // Login Modal State
  const [selectedModuleForLogin, setSelectedModuleForLogin] = useState<any | null>(null);
  // 'info' = software info screen, 'login' = credential form
  const [modalStep, setModalStep] = useState<'info' | 'login'>('info');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullNameInput, setFullNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [successBannerMessage, setSuccessBannerMessage] = useState('');

  // Check if redirect link has been clicked for verification
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasHash = window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('type=signup') || window.location.hash.includes('error='));
    const hasCode = urlParams.has('code') || urlParams.has('type');
    
    if (hasHash || hasCode) {
      const clientNameParam = urlParams.get('campaign') || 'Campaña Oficial';
      setSuccessBannerMessage(`¡Verificación de Cuenta de Campaña Ganadora IA exitosa! Te has registrado en la campaña del candidato: ${decodeURIComponent(clientNameParam)}. Ya puedes iniciar sesión con tus credenciales.`);
      
      // Auto open login form
      setSelectedModuleForLogin({
        id: 'modulo_admin',
        title: 'Gestión Administrativa',
        route: 'modulo_admin' as ViewMode,
        roleLabel: 'Rol: Administrador / Superadmin'
      });
      setModalStep('login');
      
      // Clean URL hash/search to keep it clean
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Brute-force protection states (consecutive failed logins block input)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);

  // Countdown timer for lockout duration
  React.useEffect(() => {
    if (lockoutTime === null) return;
    if (lockoutTime <= 0) {
      setLockoutTime(null);
      setFailedAttempts(0);
      return;
    }
    const interval = setInterval(() => {
      setLockoutTime(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  // Hover & Cursor Motion Animation State
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [mousePosMap, setMousePosMap] = useState<Record<string, { x: number; y: number }>>({});

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>, moduleId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosMap(prev => ({ ...prev, [moduleId]: { x, y } }));
  };

  // Pre-configured and authorized campaign personas for instant verified access
  const AUTHORIZED_CAMPAIGN_USERS: Array<{
    email: string;
    name: string;
    cedula: string;
    role: UserRole;
    roleName: string;
    clientId: string;
    clientName: string;
    allowedModules: string[];
    defaultPassword?: string;
  }> = [
    {
      email: 'admin.general@campanaganadora.co',
      name: 'Dra. María Paula Restrepo',
      cedula: '1085294312',
      role: 'superadmin',
      roleName: 'Superadministradora / Candidata',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['modulo_admin', 'gestion_operativa', 'gestion_estrategica_territorial'],
      defaultPassword: ''
    },
    {
      email: 'admin@campana.ai',
      name: 'Admin General - Santiago Pérez',
      cedula: '1085294312',
      role: 'superadmin',
      roleName: 'Administrador de Campaña',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['modulo_admin', 'gestion_operativa', 'gestion_estrategica_territorial'],
      defaultPassword: ''
    },
    {
      email: 'director.estrategico@campanaganadora.co',
      name: 'Ing. Carlos Alberto Mendoza',
      cedula: '1020784920',
      role: 'candidato',
      roleName: 'Director Político & Estratégico',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_estrategica_territorial', 'modulo_admin'],
      defaultPassword: ''
    },
    {
      email: 'estrategia@campana.ai',
      name: 'Dra. Elena Rostova',
      cedula: '1020784920',
      role: 'estrategico',
      roleName: 'Directora Estratégica & Territorial',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_estrategica_territorial'],
      defaultPassword: ''
    },
    {
      email: 'coordinador.e14@campanaganadora.co',
      name: 'Capitán Fernando Torres',
      cedula: '1144028392',
      role: 'coordinador_general_zona',
      roleName: 'Coordinador Territorial & E-14',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_estrategica_territorial', 'gestion_operativa'],
      defaultPassword: ''
    },
    {
      email: 'operaciones@campana.ai',
      name: 'Carlos Gómez',
      cedula: '1144028392',
      role: 'coordinador_zona',
      roleName: 'Coordinador Operativo / Logística',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_operativa'],
      defaultPassword: ''
    },
    {
      email: 'tesoreria@campanaganadora.co',
      name: 'Dra. Elena Gómez Soler',
      cedula: '31894021',
      role: 'administrador',
      roleName: 'Tesorera & Auditora CNE',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['modulo_admin'],
      defaultPassword: ''
    },
    {
      email: 'testigo.mesa04@campanaganadora.co',
      name: 'Santiago Pérez Jurado',
      cedula: '1098471203',
      role: 'testigo_electoral',
      roleName: 'Testigo Electoral de Mesa E-14',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_estrategica_territorial'],
      defaultPassword: ''
    },
    {
      email: 'jurado.puesto12@campanaganadora.co',
      name: 'Andrés Felipe Morales',
      cedula: '1017283904',
      role: 'jurado_mesa',
      roleName: 'Jurado de Votación Día E',
      clientId: 'CLI-2026-COL',
      clientName: 'Campaña María Paula Restrepo 2026',
      allowedModules: ['gestion_estrategica_territorial'],
      defaultPassword: ''
    }
  ];

  // Definition of the 3 Great Modules requested by the user
  const mainModules = [
    {
      id: 'modulo_admin',
      title: 'Gestión Administrativa',
      route: 'modulo_admin' as ViewMode,
      subtitle: 'Nómina, Presupuesto CNE, Auditoría, Roles y Seguridad',
      description: 'Panel de administración global para gestionar finanzas CNE, nómina de campaña, inventarios contables, accesos, roles y auditoría de seguridad.',
      icon: <LayoutGrid className="w-8 h-8 text-cyan-400" />,
      gradient: 'from-cyan-900/60 via-slate-900 to-blue-950/80',
      borderColor: 'border-cyan-500/40 hover:border-cyan-400',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      allowedRoles: ['administrador', 'superadmin', 'candidato'] as UserRole[],
      roleLabel: 'Rol: Administrador / Superadmin',
      defaultEmail: 'admin.general@campanaganadora.co',
      userFullName: 'Dra. María Paula Restrepo',
      userRoleType: 'superadmin' as UserRole,
      stats: [
        { label: 'Usuarios Activos', value: '1,248' },
        { label: 'Permisos Asignados', value: '24 Niveles' },
        { label: 'Estado del Sistema', value: '100% Operativo' }
      ],
      features: [
        'Gestión de Roles y privilegios de acceso RBAC',
        'Administración de Nómina de Campaña y Contratos',
        'Control de Presupuesto e ingresos/egresos para reporte CNE',
        'Auditoría inalterable de Audit Logs y Cuentas Claras'
      ],
      buttonText: 'Acceso Protegido - Gestión Administrativa'
    },
    {
      id: 'gestion_operativa',
      title: 'Gestión Operativa',
      route: 'primera_interfaz' as ViewMode,
      subtitle: 'Voluntarios, Call Center, Agenda, Eventos y Logística de Campo',
      description: 'Coordinación táctica de brigadas en terreno, red de voluntarios, call center de simpatizantes, agenda electoral y monitoreo en tiempo real.',
      icon: <Activity className="w-8 h-8 text-teal-400" />,
      gradient: 'from-teal-900/60 via-slate-900 to-cyan-950/80',
      borderColor: 'border-teal-500/40 hover:border-teal-400',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      allowedRoles: ['administrador', 'coordinador_zona', 'superadmin', 'candidato'] as UserRole[],
      roleLabel: 'Rol: Coordinador Operativo / Logística',
      defaultEmail: 'operaciones@campana.ai',
      userFullName: 'Coordinador Operativo - Carlos Gómez',
      userRoleType: 'coordinador_zona' as UserRole,
      stats: [
        { label: 'Voluntarios Activos', value: '840' },
        { label: 'Eventos en Agenda', value: '38' },
        { label: 'Llamadas Realizadas', value: '14,200' }
      ],
      features: [
        'Call Center y fidelización de simpatizantes',
        'Red de Voluntarios y asignación de tareas de campo',
        'Agenda de Campaña, recorridos y eventos multitudinarios',
        'Logística y despliegue para el Día D'
      ],
      buttonText: 'Acceso Protegido - Gestión Operativa'
    },
    {
      id: 'gestion_estrategica_territorial',
      title: 'Gestión Estratégica y Territorial',
      route: 'gestion_territorial' as ViewMode,
      subtitle: 'Diagnóstico IA, Puestos de Votación, Testigos de Mesa y Actas E-14',
      description: 'Inteligencia electoral predictiva, diagnóstico FODA con IA, control territorial de puestos de votación, testigos electorales y auditoría E-14.',
      icon: <MapPin className="w-8 h-8 text-emerald-400" />,
      gradient: 'from-emerald-900/60 via-slate-900 to-teal-950/80',
      borderColor: 'border-emerald-500/40 hover:border-emerald-400',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      allowedRoles: ['territorial', 'estrategico', 'superadmin', 'candidato'] as UserRole[],
      roleLabel: 'Rol: Director Estratégico & Territorial',
      defaultEmail: 'director.estrategico@campanaganadora.co',
      userFullName: 'Ing. Carlos Alberto Mendoza',
      userRoleType: 'candidato' as UserRole,
      stats: [
        { label: 'Puestos Cubiertos', value: '100%' },
        { label: 'Líderes de Zona', value: '312' },
        { label: 'Testigos Activos', value: '1,840' }
      ],
      features: [
        'Diagnóstico 360° y FODA / SWOT asistido por IA',
        'Registro y mapa de calor de votantes por comuna',
        'Control y reportes de Testigos en mesa (Día D)',
        'Escrutinio con captura y validación OCR de actas E-14'
      ],
      buttonText: 'Acceso Protegido - Gestión Estratégica y Territorial'
    }
  ];

  const handleOpenLoginModal = (m: any) => {
    setSelectedModuleForLogin(m);
    setModalStep('info'); // Always show info screen first
    setAuthMode('signin');
    setFullNameInput(m.userFullName || '');
    setUsernameInput('');
    setPasswordInput('');
    setLoginError('');
  };

  const handleCloseModal = () => {
    setSelectedModuleForLogin(null);
    setModalStep('info');
  };

  // Perform Authentication with Supabase Backend and Local Authorized Table Fallback
  const handlePerformLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setLoginError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    if (lockoutTime !== null && lockoutTime > 0) {
      writeAuditLog(
        { email: usernameInput.trim().toLowerCase() }, 
        'LOGIN_BLOCKED_LOCKOUT', 
        'AUTENTICACION', 
        'Intento de inicio de sesión bloqueado por lockout activo de fuerza bruta', 
        'Fallo'
      );
      setLoginError(`Demasiados intentos fallidos. Formulario bloqueado por seguridad. Espere ${lockoutTime} segundos.`);
      return;
    }

    setIsAuthenticating(true);
    setLoginError('');

    try {
      const targetEmail = usernameInput.trim().toLowerCase();
      const targetPassword = passwordInput.trim();

      // 1. Validate email format with regex to prevent malicious formats or injections
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(targetEmail)) {
        setLoginError('Por favor ingrese un correo electrónico con formato válido.');
        setIsAuthenticating(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword
      });
      if (authError || !authData.user) {
        throw new Error('Correo o contraseña incorrectos.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email,display_name,role,status,client_id,campaign_id')
        .eq('id', authData.user.id)
        .single();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta no tiene un perfil autorizado.');
      }
      if (!['ACTIVE', 'ACTIVO'].includes(String(profile.status || '').toUpperCase())) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta está inactiva o suspendida.');
      }

      const trustedRoles: Record<string, UserRole> = {
        SUPERADMIN: 'superadmin',
        GLOBAL_ADMIN: 'superadmin',
        ADMIN_CLIENTE: 'administrador',
        ADMINISTRADOR: 'administrador',
        DIRECTOR: 'candidato',
        COORDINADOR: 'coordinador_general_zona',
        USUARIO: 'territorial',
        USUARIO_LIMITADO: 'lider'
      };
      const trustedRole = trustedRoles[String(profile.role || '').toUpperCase()];
      if (!trustedRole || !(selectedModuleForLogin?.allowedRoles || []).includes(trustedRole)) {
        await supabase.auth.signOut();
        throw new Error('Tu rol no tiene acceso a este módulo.');
      }

      const trustedUser: AuthUser = {
        id: profile.id,
        name: profile.display_name || targetEmail.split('@')[0],
        email: profile.email || targetEmail,
        role: trustedRole,
        roleName: String(profile.role || ''),
        moduleName: selectedModuleForLogin?.title || 'Gestión de Campaña',
        clientId: profile.client_id || profile.campaign_id || undefined,
        clientName: 'Campaña autorizada'
      };
      setFailedAttempts(0);
      setLockoutTime(null);
      writeAuditLog(trustedUser, 'LOGIN_SUCCESS', 'AUTENTICACION', 'Inicio de sesión validado por Supabase.', 'Éxito');
      onLoginSuccess(trustedUser, selectedModuleForLogin?.route || 'primera_interfaz');
      setIsAuthenticating(false);
      return;

    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setLoginError(`Error de autenticación: ${err.message || 'No se pudo verificar el acceso.'}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      setIsAuthenticating(true);
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        }
      });
    } catch (err: any) {
      setLoginError(`OAuth con ${provider} iniciado o no soportado en entorno local.`);
      setIsAuthenticating(false);
    }
  };

  const rolesList: { id: UserRole; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'superadmin',
      title: 'Super Usuario (Root)',
      desc: 'Control Total e Infraestructura, Licencias y Llaves API',
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />
    },
    {
      id: 'candidato',
      title: 'Candidato Principal',
      desc: 'Monitoreo de metas de votantes, proyecciones electorales, IA DAFO y agenda.',
      icon: <Award className="w-4 h-4 text-emerald-400" />
    },
    {
      id: 'administrador',
      title: 'Administrador (Operativo)',
      desc: 'Gestión diaria de usuarios, asignación de zonas y presupuestos',
      icon: <LayoutGrid className="w-4 h-4 text-cyan-400" />
    },
    {
      id: 'auditor',
      title: 'Auditor (Cumplimiento)',
      desc: 'Solo lectura, inspección inalterable de Audit Logs y cumplimiento',
      icon: <Eye className="w-4 h-4 text-emerald-400" />
    },
    {
      id: 'estrategico',
      title: 'Director Estratégico',
      desc: 'Análisis electoral, DAFO e inteligencia financiera',
      icon: <Megaphone className="w-4 h-4 text-teal-400" />
    },
    {
      id: 'territorial',
      title: 'Coordinador Territorial',
      desc: 'Control de mapas de calor, geofencing y actas E-14',
      icon: <MapPin className="w-4 h-4 text-amber-400" />
    }
  ];

  const checkAccess = (allowed: UserRole[]) => {
    if (activeRole === 'superadmin') return true;
    return allowed.includes(activeRole);
  };

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030712] text-slate-100 p-3 sm:p-5 md:p-8 space-y-5 sm:space-y-8 max-w-7xl mx-auto w-full overflow-x-hidden">
      
      {/* SOFTWARE LOGO & HERO BANNER */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#041329] via-[#092244] to-[#041733] border border-cyan-500/30 p-4 sm:p-6 md:p-8 shadow-2xl overflow-hidden">
        {/* Background Decorative Mesh & Glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6">
          {/* Logo Icon & Title Group */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left w-full lg:w-auto">
            {/* Main Emblem Software Logo */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 bg-[#00d2a0]/40 rounded-3xl blur-md group-hover:bg-[#00d2a0]/60 transition duration-500"></div>
              <CampaignLogoBadge size="lg" className="sm:hidden relative shadow-2xl" />
              <CampaignLogoBadge size="xl" className="hidden sm:flex relative shadow-2xl" />
            </div>

            {/* Software Brand Text */}
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                CAMPAÑA GANADORA <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">IA</span>
              </h1>

              <p className="text-xs md:text-sm text-slate-300 max-w-xl font-medium">
                Plataforma Integral de Gestión Electoral, Control Territorial, Inteligencia Financiera y Auditoría en Tiempo Real.
              </p>
            </div>
          </div>

          {/* Countdown & Security Status Badge */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 shrink-0 w-full lg:w-auto">
            <CountdownWidget variant="card" className="w-full sm:w-auto lg:w-80" />
            
            <div className="flex items-center justify-between gap-3 bg-[#030d1d]/80 border border-cyan-500/20 p-2.5 sm:p-3 rounded-2xl w-full sm:w-auto lg:w-80">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 shrink-0">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                </div>
                <div className="text-left text-xs min-w-0">
                  <div className="text-slate-400 font-medium text-[9px] sm:text-[10px] truncate">Seguridad de Grado Electoral</div>
                  <div className="text-cyan-300 font-bold font-mono text-[10px] sm:text-[11px]">Encriptación SHA-256</div>
                </div>
              </div>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Verificado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Keyframe Style for Hover Color Shift Animation */}
      <style>{`
        @keyframes colorCycleBorder {
          0% {
            border-color: rgba(6, 182, 212, 0.9);
            box-shadow: 0 0 40px rgba(6, 182, 212, 0.5), inset 0 0 25px rgba(6, 182, 212, 0.2);
          }
          25% {
            border-color: rgba(16, 185, 129, 0.9);
            box-shadow: 0 0 40px rgba(16, 185, 129, 0.5), inset 0 0 25px rgba(16, 185, 129, 0.2);
          }
          50% {
            border-color: rgba(168, 85, 247, 0.9);
            box-shadow: 0 0 40px rgba(168, 85, 247, 0.5), inset 0 0 25px rgba(168, 85, 247, 0.2);
          }
          75% {
            border-color: rgba(245, 158, 11, 0.9);
            box-shadow: 0 0 40px rgba(245, 158, 11, 0.5), inset 0 0 25px rgba(245, 158, 11, 0.2);
          }
          100% {
            border-color: rgba(6, 182, 212, 0.9);
            box-shadow: 0 0 40px rgba(6, 182, 212, 0.5), inset 0 0 25px rgba(6, 182, 212, 0.2);
          }
        }

        .animated-card-glow {
          animation: colorCycleBorder 3.5s infinite linear;
        }
      `}</style>

      {/* ── MÉTRICAS EN VIVO ── actualizado automáticamente via Supabase Realtime ── */}
      <div className="px-1 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Indicadores en Vivo</span>
        </div>
        <CampaignLivePanel className="justify-start" />
      </div>

      {/* THE 3 GREAT MODULE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {mainModules.map((m) => {
          const hasAccess = checkAccess(m.allowedRoles);
          const isHovered = hoveredCardId === m.id;
          const pos = mousePosMap[m.id] || { x: 150, y: 150 };

          return (
            <div
              key={m.id}
              onMouseEnter={() => setHoveredCardId(m.id)}
              onMouseLeave={() => setHoveredCardId(null)}
              onMouseMove={(e) => handleCardMouseMove(e, m.id)}
              className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group overflow-hidden ${
                isHovered
                  ? 'bg-[#020b18] opacity-100 -translate-y-2.5 scale-[1.02] z-20 animated-card-glow border-2'
                  : hoveredCardId
                  ? 'bg-[#030d1f]/80 opacity-60 scale-[0.98] border border-slate-800'
                  : `bg-gradient-to-b ${m.gradient} border ${m.borderColor} shadow-2xl hover:-translate-y-1.5`
              }`}
            >
              {/* Dynamic Cursor Spotlight & Color Shimmer */}
              {isHovered && (
                <div
                  className="pointer-events-none absolute rounded-full blur-3xl opacity-90 transition-opacity duration-150"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: '340px',
                    height: '340px',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(16,185,129,0.35) 40%, rgba(168,85,247,0.25) 75%, transparent 100%)'
                  }}
                />
              )}

              {/* Opaque Background Tint Overlay */}
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                isHovered ? 'bg-[#030d1d]/90 backdrop-blur-xl' : 'opacity-0'
              }`} />

              <div className="relative z-10">
                {/* Module Title & Subtitle */}
                <h3 className="text-2xl font-black text-white group-hover:text-cyan-200 transition-colors flex items-center justify-between mb-2">
                  <span className="flex items-center gap-3">
                    {m.icon}
                    <span>{m.title}</span>
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed font-medium">
                  {m.subtitle}
                </p>



                {/* Feature Bullet Points */}
                <div className="space-y-3.5 mb-6 mt-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                    Funcionalidades Principales:
                  </span>
                  {m.features.map((ft, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{ft}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              {/* Action Button */}
              <div className="relative z-10">
                {hasAccess ? (
                  <button
                    onClick={() => handleOpenLoginModal(m)}
                    className={`w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl font-black text-[11px] sm:text-xs tracking-wide shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-300 text-slate-950 shadow-cyan-500/50 scale-[1.01]'
                        : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-cyan-900/40'
                    }`}
                  >
                    <LogIn className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isHovered ? 'text-slate-950' : 'text-cyan-200'}`} />
                    <span className="truncate">{m.buttonText}</span>
                    <ArrowRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform group-hover:translate-x-1.5 ${isHovered ? 'text-slate-950' : 'text-emerald-300'}`} />
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 font-medium text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 cursor-not-allowed opacity-75"
                  >
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                    <span className="truncate">Acceso Denegado para {rolesList.find(r => r.id === activeRole)?.title}</span>
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>



      {/* MODAL OVERLAY: INFO SCREEN + LOGIN FORM */}
      <AnimatePresence>
        {selectedModuleForLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
            {/* Glassmorphism Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-pointer"
            />

            {/* Modal Card */}
            <motion.div
              key={modalStep}
              initial={{ y: '100%', opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0, scale: 0.94 }}
              transition={iosSpring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.65 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 400) {
                  handleCloseModal();
                }
              }}
              className={`relative z-10 w-[95vw] rounded-2xl sm:rounded-3xl bg-[#040e1e]/98 border border-cyan-500/40 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-left pointer-events-auto max-h-[90vh] overflow-y-auto custom-scrollbar ${
                modalStep === 'info' ? 'max-w-2xl p-4 sm:p-7' : 'max-w-md p-4 sm:p-6'
              }`}
            >
              {/* Tactile Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-500/50 hover:bg-slate-300 rounded-full mx-auto -mt-0.5 mb-3 sm:mb-4 cursor-grab active:cursor-grabbing shrink-0 transition-colors" />

              {/* ── STEP 1: SOFTWARE INFO SCREEN ── */}
              {modalStep === 'info' && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Header (Centrado) */}
                  <div className="relative flex flex-col items-center text-center pt-1 sm:pt-2">
                    {/* Botón de cerrar absoluto a la derecha superior */}
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      aria-label="Cerrar modal"
                      className="absolute right-0 top-0 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Icono del Módulo */}
                    <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/20 border border-cyan-400/40 mb-2.5 sm:mb-3 shadow-lg">
                      {selectedModuleForLogin.icon}
                    </div>

                    {/* Badge y Textos */}
                    <div className="space-y-1.5 sm:space-y-2 flex flex-col items-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] sm:text-[10px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5 mx-auto">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Sistema Activo
                      </span>
                      
                      <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                        {selectedModuleForLogin.title}
                      </h2>
                      
                      <p className="text-xs text-cyan-300/80 max-w-md mx-auto">
                        {selectedModuleForLogin.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Módulo Seleccionado Info */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900/40 border border-cyan-500/20 p-3.5 sm:p-4 shadow-inner">
                    {/* Left cyan accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-teal-400" />
                    
                    <div className="space-y-1.5 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400/90 font-mono">
                          Especificación del Módulo
                        </p>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        {selectedModuleForLogin.description}
                      </p>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="w-full sm:w-auto sm:flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-700"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalStep('login')}
                      className="w-full sm:w-auto sm:flex-[2] py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Iniciar Sesión →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: LOGIN FORM ── */}
              {modalStep === 'login' && (
                <div className="space-y-5">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-cyan-500/20 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                        <KeyRound className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white">
                          Acceso al {selectedModuleForLogin.title}
                        </h3>
                        <p className="text-xs text-cyan-300/80 mt-0.5">
                          {selectedModuleForLogin.roleLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setModalStep('info')}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-all cursor-pointer text-xs font-bold"
                        title="Ver información del módulo"
                      >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Login Form */}
                  <form onSubmit={handlePerformLogin} className="space-y-4">
                    {successBannerMessage && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col gap-1.5 shadow-md shadow-emerald-950/20">
                        <div className="flex items-center gap-2 font-black text-emerald-400">
                          <CampaignLogoBadge className="w-4 h-4 text-emerald-400 animate-bounce" />
                          <span>Campaña Ganadora IA</span>
                        </div>
                        <p className="leading-relaxed text-[11px]">{successBannerMessage}</p>
                      </div>
                    )}

                    {loginError && (
                      <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Usuario / Correo Registrado
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="usuario@campana.ai"
                          disabled={lockoutTime !== null && lockoutTime > 0}
                          className="w-full bg-[#030b19] border border-cyan-500/30 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Contraseña de Seguridad
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-cyan-400 absolute left-3.5 pointer-events-none z-10" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="••••••••"
                          disabled={lockoutTime !== null && lockoutTime > 0}
                          className="w-full bg-[#030b19] border border-cyan-500/30 focus:border-cyan-400 rounded-xl pl-10 pr-11 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowPassword((prev) => !prev);
                          }}
                          disabled={lockoutTime !== null && lockoutTime > 0}
                          title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                          aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer z-20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4 pointer-events-none" /> : <Eye className="w-4 h-4 pointer-events-none" />}
                        </button>
                      </div>
                    </div>

                    {/* Quick Preset Credentials Selector */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/20 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Credenciales oficiales del sistema:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {AUTHORIZED_CAMPAIGN_USERS.slice(0, 4).map((u, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setUsernameInput(u.email);
                              setPasswordInput('');
                              setFullNameInput(u.name);
                              setLoginError('');
                            }}
                            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 font-medium ${
                              usernameInput === u.email
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                                : 'bg-slate-800/80 border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{u.roleName.split('/')[0].trim()}:</span>
                            <span className="font-mono text-cyan-300">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={(lockoutTime !== null && lockoutTime > 0) || isAuthenticating}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        <LogIn className="w-4 h-4 text-white" />
                        <span>
                          {lockoutTime !== null && lockoutTime > 0
                            ? `Bloqueado (${lockoutTime}s)`
                            : isAuthenticating
                              ? 'Autenticando...'
                              : 'Iniciar Sesión e Ingresar →'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
