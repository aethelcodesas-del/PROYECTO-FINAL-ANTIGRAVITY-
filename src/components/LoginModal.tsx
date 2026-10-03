import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  X, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Brain,
  MapPin,
  DollarSign,
  Vote,
  Shield,
  Target,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  ChevronDown,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { AuthUser, UserRole, ViewMode } from '../types';
import { supabase } from '../lib/supabaseClient';

export const isGlobalAdminRole = (role?: string) =>
  ['GLOBAL_ADMIN', 'SUPERADMIN', 'superadmin', 'master'].includes(String(role || ''));

export interface AccessEnvironment {
  id: 'estrategia' | 'territorio' | 'dia_e' | 'global_admin';
  title: string;
  category: string;
  badge: string;
  description: string;
  context: string;
  targetView: ViewMode;
  icon: any;
  colorScheme: {
    border: string;
    hoverBorder: string;
    bg: string;
    iconBg: string;
    iconText: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    glow: string;
    accentGradient: string;
  };
  allowedRoles: string[];
  defaultModuleTitle: string;
}

export const ACCESS_ENVIRONMENTS: AccessEnvironment[] = [
  {
    id: 'estrategia',
    title: 'Campaña & Estrategia Electoral',
    category: 'Candidato / Dirección General',
    badge: 'Estrategia & Dirección',
    description: 'Diagnóstico 360°, Programa de Gobierno, DOFA, Narrativa, CV y Redes Sociales.',
    context: 'Requiere credenciales de Candidato, Director Político o Administrador de Campaña.',
    targetView: 'gestion_estrategica',
    icon: Target,
    colorScheme: {
      border: 'border-violet-500/30',
      hoverBorder: 'hover:border-violet-400/80',
      bg: 'from-violet-950/40 via-slate-900/90 to-slate-950/90',
      iconBg: 'bg-violet-950/80 border-violet-500/40',
      iconText: 'text-violet-400',
      badgeBg: 'bg-violet-500/15',
      badgeText: 'text-violet-300',
      badgeBorder: 'border-violet-500/30',
      glow: 'shadow-violet-950/50 hover:shadow-violet-900/30',
      accentGradient: 'from-violet-600 via-indigo-600 to-blue-600'
    },
    allowedRoles: [
      'candidato', 'administrador', 'superadmin', 'GLOBAL_ADMIN', 
      'SUPERADMIN', 'ADMIN_CLIENTE', 'ADMINISTRADOR', 'DIRECTOR', 
      'ESTRATEGICO', 'estrategico'
    ],
    defaultModuleTitle: 'Gestión Estratégica'
  },
  {
    id: 'territorio',
    title: 'Operación Territorial & Censo',
    category: 'Coordinación de Campo',
    badge: 'Territorio & Votantes',
    description: 'Registro de Votantes, Mapa & Cobertura, Líderes y Encuestas de Opinión.',
    context: 'Requiere credenciales de Coordinador Territorial o Líder Comunal.',
    targetView: 'gestion_territorial',
    icon: MapPin,
    colorScheme: {
      border: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400/80',
      bg: 'from-emerald-950/40 via-slate-900/90 to-slate-950/90',
      iconBg: 'bg-emerald-950/80 border-emerald-500/40',
      iconText: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      glow: 'shadow-emerald-950/50 hover:shadow-emerald-900/30',
      accentGradient: 'from-emerald-600 via-teal-600 to-cyan-600'
    },
    allowedRoles: [
      'coordinador_general_zona', 'territorial', 'lider', 'COORDINADOR', 
      'USUARIO', 'USUARIO_LIMITADO', 'TERRITORIAL', 'superadmin', 
      'GLOBAL_ADMIN', 'SUPERADMIN', 'administrador', 'candidato', 
      'ADMINISTRADOR', 'DIRECTOR'
    ],
    defaultModuleTitle: 'Gestión Territorial'
  },
  {
    id: 'dia_e',
    title: 'Día E & Control Electoral',
    category: 'Testigos y Jurados de Mesa',
    badge: 'Testigos & Jurados',
    description: 'Confirmación GPS en puesto, Apertura de Mesa, Escrutinio y Actas E-14.',
    context: 'Requiere credenciales asignadas de Testigo o Jurado Electoral.',
    targetView: 'testigo_campo',
    icon: Vote,
    colorScheme: {
      border: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400/80',
      bg: 'from-amber-950/40 via-slate-900/90 to-slate-950/90',
      iconBg: 'bg-amber-950/80 border-amber-500/40',
      iconText: 'text-amber-400',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30',
      glow: 'shadow-amber-950/50 hover:shadow-amber-900/30',
      accentGradient: 'from-amber-600 via-orange-600 to-rose-600'
    },
    allowedRoles: [
      'testigo_electoral', 'jurado_mesa', 'superadmin', 'GLOBAL_ADMIN', 
      'SUPERADMIN', 'administrador', 'candidato', 'ADMINISTRADOR', 
      'DIRECTOR', 'COORDINADOR', 'coordinador_general_zona'
    ],
    defaultModuleTitle: 'Testigos en Campo Día E'
  },
  {
    id: 'global_admin',
    title: 'Terminal de Gobernanza Global',
    category: 'Super Administrador / Auditor Master',
    badge: 'Master Governance',
    description: 'Infraestructura, licenciamiento, cuotas de APIs y logs de seguridad global.',
    context: 'Aislamiento estricto: Cero acceso a datos privados de campañas de clientes.',
    targetView: 'global_admin',
    icon: ShieldAlert,
    colorScheme: {
      border: 'border-cyan-500/40',
      hoverBorder: 'hover:border-cyan-400/80',
      bg: 'from-cyan-950/40 via-slate-900/90 to-slate-950/90',
      iconBg: 'bg-cyan-950/80 border-cyan-500/40',
      iconText: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/15',
      badgeText: 'text-cyan-300',
      badgeBorder: 'border-cyan-500/30',
      glow: 'shadow-cyan-950/50 hover:shadow-cyan-900/30',
      accentGradient: 'from-cyan-600 via-blue-600 to-indigo-600'
    },
    allowedRoles: ['superadmin', 'GLOBAL_ADMIN', 'SUPERADMIN'],
    defaultModuleTitle: 'Panel de Gobernanza Global'
  }
];

export const PRESET_PERSONAS: Array<{
  id: string;
  name: string;
  cedula: string;
  email: string;
  role: UserRole;
  roleName: string;
  moduleName: string;
  badgeColor: string;
  icon: any;
  defaultView: ViewMode;
}> = [
  {
    id: 'USR-1000',
    name: 'Superadministrador Maestro (Tech & Governance)',
    cedula: '1020304050',
    email: 'superadmin.global@campanaganadora.co',
    role: 'superadmin',
    roleName: 'Superadministrador Global (Master)',
    moduleName: 'Panel Administrativo Global',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: ShieldCheck,
    defaultView: 'saas_admin'
  },
  {
    id: 'USR-1001',
    name: 'Dra. María Paula Restrepo',
    cedula: '1085294312',
    email: 'admin.general@campanaganadora.co',
    role: 'superadmin',
    roleName: 'Superadministradora / Candidata',
    moduleName: 'Gestión Administrativa',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: ShieldCheck,
    defaultView: 'modulo_admin'
  },
  {
    id: 'USR-1002',
    name: 'Ing. Carlos Alberto Mendoza',
    cedula: '1020784920',
    email: 'director.estrategico@campanaganadora.co',
    role: 'candidato',
    roleName: 'Director Político & Estratégico',
    moduleName: 'Gestión Estratégica',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    icon: Brain,
    defaultView: 'gestion_estrategica'
  },
  {
    id: 'USR-1003',
    name: 'Capitán Fernando Torres',
    cedula: '1144028392',
    email: 'coordinador.territorial@campanaganadora.co',
    role: 'coordinador_general_zona',
    roleName: 'Coordinador Territorial & E-14',
    moduleName: 'Gestión Territorial',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: MapPin,
    defaultView: 'gestion_territorial'
  },
  {
    id: 'USR-1004',
    name: 'Dra. Elena Gómez Soler',
    cedula: '31894021',
    email: 'tesoreria@campanaganadora.co',
    role: 'administrador',
    roleName: 'Tesorera & Auditora CNE',
    moduleName: 'Gestión Administrativa',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: DollarSign,
    defaultView: 'modulo_admin'
  },
  {
    id: 'USR-1005',
    name: 'Santiago Pérez Jurado',
    cedula: '1098471203',
    email: 'testigo.mesa04@campanaganadora.co',
    role: 'testigo_electoral',
    roleName: 'Testigo Electoral de Mesa E-14',
    moduleName: 'Gestión Territorial',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: Vote,
    defaultView: 'testigo_campo'
  },
  {
    id: 'USR-1006',
    name: 'Andrés Felipe Morales',
    cedula: '1017283904',
    email: 'jurado.puesto12@campanaganadora.co',
    role: 'jurado_mesa',
    roleName: 'Jurado de Votación Día E',
    moduleName: 'Gestión Territorial',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    icon: Shield,
    defaultView: 'jurado_campo'
  }
];

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser, initialRoute?: ViewMode) => void;
  targetModule?: string;
  targetView?: ViewMode;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  targetModule,
  targetView
}) => {
  // Step 1: 'select_environment' | Step 2: 'credentials'
  const [step, setStep] = useState<'select_environment' | 'credentials'>('select_environment');
  const [selectedEnv, setSelectedEnv] = useState<AccessEnvironment | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  // RBAC mismatch state
  const [rbacMismatch, setRbacMismatch] = useState<{
    user: AuthUser;
    suggestedRoute: ViewMode;
    suggestedModuleName: string;
    userRoleLabel: string;
  } | null>(null);

  // Initialize or reset flow upon opening
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoading(false);
      setIdentifier('');
      setPassword('');
      setRecoveryMessage(null);
      setRbacMismatch(null);

      // If a specific targetView was explicitly passed, match to its environment and go directly to credentials
      if (targetView) {
        const matched = ACCESS_ENVIRONMENTS.find(e => 
          e.targetView === targetView || 
          (targetView === 'modulo_admin' && e.id === 'estrategia') ||
          (targetView === 'encuestas' && e.id === 'territorio') ||
          (targetView === 'jurado_campo' && e.id === 'dia_e')
        );
        if (matched) {
          setSelectedEnv(matched);
          setStep('credentials');
          return;
        }
      }

      // Default: Step 1 (Module Gatekeeper Selector)
      setSelectedEnv(null);
      setStep('select_environment');
    }
  }, [isOpen, targetView, targetModule]);

  if (!isOpen) return null;

  const handleSelectEnvironment = (env: AccessEnvironment) => {
    setSelectedEnv(env);
    setErrorMsg(null);
    setRecoveryMessage(null);
    setRbacMismatch(null);
    setStep('credentials');
  };

  const handleBackToSelector = () => {
    setStep('select_environment');
    setErrorMsg(null);
    setRecoveryMessage(null);
    setRbacMismatch(null);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setRbacMismatch(null);

    const email = identifier.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMsg('Ingresa el correo electrónico registrado en el sistema.');
      return;
    }
    if (!password) {
      setErrorMsg('Ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !authData.user) {
        const authMessage = String(authError?.message || '').toLowerCase();
        const code = authMessage.includes('invalid login credentials')
          ? 'AUTH_INVALID_CREDENTIALS'
          : authMessage.includes('email not confirmed')
            ? 'AUTH_EMAIL_NOT_CONFIRMED'
            : authMessage.includes('rate limit')
              ? 'AUTH_RATE_LIMIT'
              : authMessage.includes('fetch') || authMessage.includes('network')
                ? 'AUTH_NETWORK_ERROR'
                : 'AUTH_SESSION_ERROR';
        console.warn('Authentication rejected', { code, source: 'campaign-login' });
        if (code === 'AUTH_EMAIL_NOT_CONFIRMED') {
          throw new Error('Tu correo está pendiente de confirmación. Usa "¿Olvidaste tu contraseña?" para activar el acceso de forma segura.');
        }
        if (code === 'AUTH_RATE_LIMIT') {
          throw new Error('Demasiados intentos. Espera unos minutos antes de volver a intentar.');
        }
        if (code === 'AUTH_NETWORK_ERROR') {
          throw new Error('No fue posible conectar con el servicio de acceso. Intenta nuevamente.');
        }
        throw new Error('Correo o contraseña incorrectos.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,email,display_name,role,status,client_id,campaign_id,allowed_modules')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta no tiene un perfil autorizado en el sistema.');
      }
      if (!['ACTIVE', 'ACTIVO'].includes(String(profile.status || '').toUpperCase())) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta está inactiva o suspendida.');
      }

      if (profile.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('id,estado')
          .eq('id', profile.campaign_id)
          .maybeSingle();

        if (campaign && ['SUSPENDIDA', 'CANCELADA'].includes(String(campaign.estado || '').toUpperCase())) {
          await supabase.auth.signOut();
          throw new Error('La campaña asociada a tu cuenta se encuentra temporalmente suspendida o inactiva.');
        }
      }

      const roleMap: Record<string, { role: UserRole; label: string; defaultRoute: ViewMode; defaultModule: string }> = {
        GLOBAL_ADMIN: { role: 'superadmin', label: 'Administrador Global', defaultRoute: 'global_admin', defaultModule: 'Gobernanza Global' },
        SUPERADMIN: { role: 'superadmin', label: 'Superadministrador', defaultRoute: 'global_admin', defaultModule: 'Gobernanza Global' },
        superadmin: { role: 'superadmin', label: 'Superadministrador', defaultRoute: 'global_admin', defaultModule: 'Gobernanza Global' },
        ADMIN_CLIENTE: { role: 'administrador', label: 'Administrador de campaña', defaultRoute: 'modulo_admin', defaultModule: 'Campaña & Estrategia' },
        ADMINISTRADOR: { role: 'administrador', label: 'Administrador General', defaultRoute: 'modulo_admin', defaultModule: 'Campaña & Estrategia' },
        administrador: { role: 'administrador', label: 'Administrador de campaña', defaultRoute: 'modulo_admin', defaultModule: 'Campaña & Estrategia' },
        DIRECTOR: { role: 'candidato', label: 'Director estratégico', defaultRoute: 'gestion_estrategica', defaultModule: 'Campaña & Estrategia' },
        candidato: { role: 'candidato', label: 'Candidato Oficial', defaultRoute: 'gestion_estrategica', defaultModule: 'Campaña & Estrategia' },
        COORDINADOR: { role: 'coordinador_general_zona', label: 'Coordinador territorial', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        coordinador_general_zona: { role: 'coordinador_general_zona', label: 'Coordinador territorial', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        USUARIO: { role: 'territorial', label: 'Usuario territorial', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        territorial: { role: 'territorial', label: 'Usuario territorial', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        USUARIO_LIMITADO: { role: 'lider', label: 'Líder barrial / comunal', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        lider: { role: 'lider', label: 'Líder barrial / comunal', defaultRoute: 'gestion_territorial', defaultModule: 'Operación Territorial' },
        TESTIGO: { role: 'testigo_electoral', label: 'Testigo Electoral', defaultRoute: 'testigo_campo', defaultModule: 'Día E & Testigos' },
        testigo_electoral: { role: 'testigo_electoral', label: 'Testigo Electoral', defaultRoute: 'testigo_campo', defaultModule: 'Día E & Testigos' },
        JURADO: { role: 'jurado_mesa', label: 'Jurado de Votación', defaultRoute: 'jurado_campo', defaultModule: 'Día E & Jurados' },
        jurado_mesa: { role: 'jurado_mesa', label: 'Jurado de Votación', defaultRoute: 'jurado_campo', defaultModule: 'Día E & Jurados' }
      };

      const mapped = roleMap[profile.role] || {
        role: 'territorial' as UserRole,
        label: 'Usuario Registrado',
        defaultRoute: 'gestion_territorial' as ViewMode,
        defaultModule: 'Operación Territorial'
      };

      const { data: permissionRows } = await supabase
        .from('user_permissions')
        .select('function_code,actions')
        .eq('user_id', profile.id);

      const permissions = (permissionRows || [])
        .filter((permission: any) => Array.isArray(permission.actions) && permission.actions.includes('ACCESS'))
        .map((permission: any) => String(permission.function_code));

      const isSuperadmin = isGlobalAdminRole(profile.role);

      const user: AuthUser = {
        id: profile.id,
        name: profile.display_name || email.split('@')[0],
        email: profile.email || email,
        role: mapped.role,
        roleName: mapped.label,
        moduleName: selectedEnv?.title || targetModule || 'Sistema Electoral',
        clientId: isSuperadmin ? undefined : (profile.client_id || undefined),
        clientName: isSuperadmin 
          ? (selectedEnv?.id === 'global_admin' ? 'Administración Global' : 'Modo Exploración (Cero-Acceso)')
          : (profile.client_id || profile.campaign_id ? 'Campaña autorizada' : 'Administración Electoral'),
        campaignId: isSuperadmin ? undefined : (profile.campaign_id ? String(profile.campaign_id) : undefined),
        permissions
      };

      // RBAC CHECK: Validate if the user role matches the selected environment
      if (selectedEnv) {
        const isAllowedForEnv = isSuperadmin || 
          selectedEnv.allowedRoles.includes(profile.role) || 
          selectedEnv.allowedRoles.includes(mapped.role);

        if (!isAllowedForEnv) {
          // Deny access to selected module but offer direct redirection to their assigned module
          setRbacMismatch({
            user,
            suggestedRoute: mapped.defaultRoute,
            suggestedModuleName: mapped.defaultModule,
            userRoleLabel: mapped.label
          });
          return;
        }
      }

      // Successful matching login
      const destination = selectedEnv ? selectedEnv.targetView : targetView;
      onLoginSuccess(user, destination);
      onClose();
    } catch (error: any) {
      setErrorMsg(error?.message || 'No fue posible validar el acceso.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setErrorMsg(null);
    setRecoveryMessage(null);
    const email = identifier.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMsg('Ingresa primero el correo electrónico registrado.');
      return;
    }
    setIsRecovering(true);
    try {
      const redirectTo = `${window.location.origin}/?type=recovery&returnTo=campaign`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        throw new Error('No fue posible solicitar la recuperación en este momento.');
      }
      setRecoveryMessage('Si el correo está registrado, recibirás un enlace seguro para crear una contraseña nueva.');
    } catch (error: any) {
      setErrorMsg(error?.message || 'No fue posible solicitar la recuperación.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`relative w-full mx-auto bg-[#030d1d] border border-slate-800 rounded-3xl shadow-2xl shadow-cyan-950/40 p-5 sm:p-7 z-10 text-slate-100 overflow-hidden box-border font-sans transition-all duration-300 ${
            step === 'select_environment' ? 'max-w-3xl' : 'max-w-md'
          }`}
        >
          {/* Ambient Lighting */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer z-20"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* ======================================================== */}
          {/* STEP 1: SELECTOR DE ENTORNO / MÓDULO (MODULE GATEKEEPER) */}
          {/* ======================================================== */}
          {step === 'select_environment' && (
            <motion.div
              key="step-selector"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              className="relative z-10"
            >
              {/* Header */}
              <div className="mb-6 pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Control de Acceso • Paso 1 de 2
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    TLS 1.3
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
                  ¿A qué módulo o entorno deseas ingresar?
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Selecciona tu área de operación para desplegar el formulario de autenticación contextual correspondiente.
                </p>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
                {ACCESS_ENVIRONMENTS.map((env) => {
                  const Icon = env.icon;
                  return (
                    <div
                      key={env.id}
                      onClick={() => handleSelectEnvironment(env)}
                      className={`group relative flex flex-col justify-between p-4.5 sm:p-5 rounded-2xl bg-gradient-to-b ${env.colorScheme.bg} border ${env.colorScheme.border} ${env.colorScheme.hoverBorder} shadow-lg ${env.colorScheme.glow} hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden will-change-[transform,box-shadow]`}
                    >
                      <div>
                        {/* Top Icon & Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl ${env.colorScheme.iconBg} border flex items-center justify-center ${env.colorScheme.iconText} group-hover:scale-105 transition-transform shadow-inner shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${env.colorScheme.badgeBg} ${env.colorScheme.badgeText} border ${env.colorScheme.badgeBorder}`}>
                            {env.badge}
                          </span>
                        </div>

                        {/* Title & Category */}
                        <h3 className="text-sm font-bold text-white group-hover:text-white transition-colors font-display tracking-tight">
                          {env.title}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 font-sans">
                          {env.category}
                        </p>

                        {/* Description */}
                        <p className="text-xs text-slate-300/90 mt-2 leading-relaxed">
                          {env.description}
                        </p>
                      </div>

                      {/* Footer Action */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-white transition-colors">
                          Ingresar aquí
                        </span>
                        <div className={`w-7 h-7 rounded-lg ${env.colorScheme.iconBg} border flex items-center justify-center ${env.colorScheme.iconText} group-hover:translate-x-1 transition-transform`}>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Security Policy Badge */}
              <div className="mt-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Autenticación con protección Zero-Knowledge y validación estricta de privilegios RBAC por campaña.
                </span>
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: FORMULARIO DE CREDENCIALES CONTEXTUAL           */}
          {/* ======================================================== */}
          {step === 'credentials' && selectedEnv && (
            <motion.div
              key="step-credentials"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="relative z-10"
            >
              {/* Back button to Step 1 */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handleBackToSelector}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cambiar módulo</span>
                </button>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${selectedEnv.colorScheme.badgeBg} ${selectedEnv.colorScheme.badgeText} border ${selectedEnv.colorScheme.badgeBorder}`}>
                  {selectedEnv.badge}
                </span>
              </div>

              {/* Context Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${selectedEnv.colorScheme.iconBg} border flex items-center justify-center ${selectedEnv.colorScheme.iconText} shadow-inner shrink-0`}>
                  {React.createElement(selectedEnv.icon, { className: 'w-5 h-5' })}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-black text-white font-display truncate">
                    {selectedEnv.title}
                  </h2>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedEnv.context}
                  </p>
                </div>
              </div>

              {/* RBAC Mismatch Notice & Direct Action */}
              {rbacMismatch && (
                <div className="p-4 mb-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-300 font-bold mb-1">
                        Acceso Restringido por Rol (RBAC)
                      </strong>
                      <p className="leading-relaxed">
                        Credenciales válidas, pero su rol asignado (<strong>{rbacMismatch.userRoleLabel}</strong>) no cuenta con privilegios para el módulo <strong>{selectedEnv.title}</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onLoginSuccess(rbacMismatch.user, rbacMismatch.suggestedRoute);
                      onClose();
                    }}
                    className="w-full mt-3 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <span>Ir a mi módulo asignado ({rbacMismatch.suggestedModuleName})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Error Message if any */}
              {errorMsg && !rbacMismatch && (
                <div className="p-3 mb-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="break-words min-w-0">{errorMsg}</span>
                </div>
              )}

              {recoveryMessage && (
                <div className="p-3 mb-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="break-words min-w-0">{recoveryMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 w-full">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-bold text-slate-300 mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative flex items-center w-full">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <input
                      type="email"
                      name="email"
                      id="login-email"
                      autoComplete="username email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Correo electrónico registrado"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all dark-autofill min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="login-password" className="block text-xs font-bold text-slate-300">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={handlePasswordRecovery}
                      disabled={isRecovering || isLoading}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isRecovering ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
                    </button>
                  </div>
                  <div className="relative flex items-center w-full">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      id="login-password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese su contraseña"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all dark-autofill min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPassword((prev) => !prev);
                      }}
                      title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer z-20 focus:outline-none min-h-[38px] min-w-[38px] flex items-center justify-center"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 pointer-events-none" />
                      ) : (
                        <Eye className="w-4 h-4 pointer-events-none" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit button contextual to selected module */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 px-3 rounded-xl bg-gradient-to-r ${selectedEnv.colorScheme.accentGradient} hover:brightness-110 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm shadow-lg border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-4 min-h-[44px]`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validando credenciales...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 shrink-0" />
                      <span className="truncate">Acceder a {selectedEnv.title}</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
