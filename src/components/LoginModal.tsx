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
  id: 'estrategia' | 'territorio' | 'dia_e';
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

export const getModuleContextLabel = (envId?: string) => {
  switch (envId) {
    case 'estrategia':
      return 'ESTRATEGIA & DIRECCIÓN DE CAMPAÑA';
    case 'territorio':
      return 'GESTIÓN DE PADRÓN & TERRITORIO';
    case 'dia_e':
      return 'DÍA E & CONTROL ELECTORAL';
    default:
      return 'CONTROL ELECTORAL';
  }
};

export interface ModuleLoginTheme {
  id: 'estrategia' | 'territorio' | 'dia_e';
  leftBg: string;
  glowColor: string;
  glowColorHex: string;
  shieldGradient: string;
  shieldInnerBg: string;
  shieldGlow: string;
  brandAccentText: string;
  backBtn: string;
  securityIconText: string;
  recoveryLink: string;
  inputFocus: string;
  checkboxAccent: string;
  submitButton: string;
  ambientGlow: string;
}

export const MODULE_LOGIN_THEMES: Record<'estrategia' | 'territorio' | 'dia_e', ModuleLoginTheme> = {
  estrategia: {
    id: 'estrategia',
    leftBg: 'bg-gradient-to-b from-[#0e1628] via-[#090e1a] to-[#060913]',
    glowColor: 'rgba(147, 51, 234, 0.25)',
    glowColorHex: '#9333ea',
    shieldGradient: 'from-purple-500 via-indigo-500 to-violet-400',
    shieldInnerBg: 'bg-[#160b2e]',
    shieldGlow: 'shadow-[0_0_30px_rgba(168,85,247,0.45)]',
    brandAccentText: 'text-purple-400',
    backBtn: 'text-purple-300 border-purple-500/30 hover:bg-purple-950/40 hover:border-purple-400/60',
    securityIconText: 'text-purple-400/80',
    recoveryLink: 'text-purple-400 hover:text-purple-300',
    inputFocus: 'focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20',
    checkboxAccent: 'accent-purple-500 text-purple-500 focus:ring-purple-500/30',
    submitButton: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-500 shadow-[0_4px_24px_rgba(147,51,234,0.45)]',
    ambientGlow: 'bg-purple-500/15'
  },
  territorio: {
    id: 'territorio',
    leftBg: 'bg-gradient-to-b from-[#0e1628] via-[#090e1a] to-[#060913]',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    glowColorHex: '#10b981',
    shieldGradient: 'from-emerald-500 via-teal-500 to-cyan-400',
    shieldInnerBg: 'bg-[#06241e]',
    shieldGlow: 'shadow-[0_0_30px_rgba(16,185,129,0.45)]',
    brandAccentText: 'text-emerald-400',
    backBtn: 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/40 hover:border-emerald-400/60',
    securityIconText: 'text-emerald-400/80',
    recoveryLink: 'text-emerald-400 hover:text-emerald-300',
    inputFocus: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
    checkboxAccent: 'accent-emerald-500 text-emerald-500 focus:ring-emerald-500/30',
    submitButton: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 shadow-[0_4px_24px_rgba(16,185,129,0.45)]',
    ambientGlow: 'bg-emerald-500/15'
  },
  dia_e: {
    id: 'dia_e',
    leftBg: 'bg-gradient-to-b from-[#0e1628] via-[#090e1a] to-[#060913]',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    glowColorHex: '#f59e0b',
    shieldGradient: 'from-amber-500 via-orange-500 to-yellow-400',
    shieldInnerBg: 'bg-[#291705]',
    shieldGlow: 'shadow-[0_0_30px_rgba(245,158,11,0.45)]',
    brandAccentText: 'text-amber-400',
    backBtn: 'text-amber-300 border-amber-500/30 hover:bg-amber-950/40 hover:border-amber-400/60',
    securityIconText: 'text-amber-400/80',
    recoveryLink: 'text-amber-400 hover:text-amber-300',
    inputFocus: 'focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20',
    checkboxAccent: 'accent-amber-500 text-amber-500 focus:ring-amber-500/30',
    submitButton: 'bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500 shadow-[0_4px_24px_rgba(245,158,11,0.45)]',
    ambientGlow: 'bg-amber-500/15'
  }
};

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

  // Active theme based on selected module
  const currentTheme: ModuleLoginTheme = (selectedEnv ? MODULE_LOGIN_THEMES[selectedEnv.id] : null) || MODULE_LOGIN_THEMES.estrategia;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
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
          ? 'Modo Exploración (Cero-Acceso)'
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
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full mx-auto bg-[#080d1b] border border-slate-800/80 rounded-3xl shadow-2xl shadow-cyan-950/40 z-10 text-slate-100 overflow-hidden box-border font-sans will-change-[transform,opacity] transform-gpu ${
            step === 'select_environment' ? 'max-w-5xl p-5 sm:p-7' : 'max-w-4xl p-0'
          }`}
        >
          {/* Ambient Lighting */}
          <div className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transform-gpu transition-colors duration-500 ${step === 'credentials' ? currentTheme.ambientGlow : 'bg-cyan-500/10'}`} />
          <div className={`absolute -bottom-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transform-gpu transition-colors duration-500 ${step === 'credentials' ? currentTheme.ambientGlow : 'bg-blue-500/10'}`} />

          {/* Close button for Step 1 */}
          {step === 'select_environment' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer z-20"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* ======================================================== */}
          {/* STEP 1: SELECTOR DE ENTORNO / MÓDULO (MODULE GATEKEEPER) */}
          {/* ======================================================== */}
          {step === 'select_environment' && (
            <motion.div
              key="step-selector"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 will-change-[transform,opacity] transform-gpu"
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

              {/* 3 Cards Grid with GPU Stagger Cascade under 0.25s */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 my-4">
                {ACCESS_ENVIRONMENTS.map((env, index) => {
                  const Icon = env.icon;
                  return (
                    <motion.div
                      key={env.id}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.18,
                        delay: index * 0.035,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      onClick={() => handleSelectEnvironment(env)}
                      className={`group relative flex flex-col justify-between p-4.5 sm:p-5 rounded-2xl bg-gradient-to-b ${env.colorScheme.bg} border ${env.colorScheme.border} ${env.colorScheme.hoverBorder} shadow-lg ${env.colorScheme.glow} hover:-translate-y-1 active:scale-[0.98] transition-[transform,box-shadow,opacity] duration-[160ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer overflow-hidden will-change-[transform,box-shadow] transform-gpu`}
                    >
                      <div>
                        {/* Top Icon & Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl ${env.colorScheme.iconBg} border flex items-center justify-center ${env.colorScheme.iconText} group-hover:scale-105 transition-transform duration-[160ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] shadow-inner shrink-0 will-change-transform transform-gpu`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${env.colorScheme.badgeBg} ${env.colorScheme.badgeText} border ${env.colorScheme.badgeBorder}`}>
                            {env.badge}
                          </span>
                        </div>

                        {/* Title & Category */}
                        <h3 className="text-sm font-bold text-white group-hover:text-white transition-colors duration-[160ms] font-display tracking-tight">
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
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-white transition-colors duration-[160ms]">
                          Ingresar aquí
                        </span>
                        <div className={`w-7 h-7 rounded-lg ${env.colorScheme.iconBg} border flex items-center justify-center ${env.colorScheme.iconText} group-hover:translate-x-1 transition-transform duration-[160ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] will-change-transform transform-gpu`}>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </motion.div>
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
          {/* STEP 2: NUEVO DISEÑO SPLIT CARD GLASSMORPHISM 50/50     */}
          {/* ======================================================== */}
          {step === 'credentials' && selectedEnv && (
            <motion.div
              key="step-credentials"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative z-10 w-full grid grid-cols-1 md:grid-cols-2 min-h-[520px]"
            >
              {/* Botón de Cierre Superior Derecho para toda la tarjeta */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer z-30 shadow-md"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* ---------------------------------------------------- */}
              {/* COLUMNA IZQUIERDA: BRANDING & CONTEXTO DEL MÓDULO    */}
              {/* ---------------------------------------------------- */}
              <div className="relative p-6 sm:p-8 md:p-10 flex flex-col justify-between items-center text-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-800/80 bg-gradient-to-b from-[#0e1628] via-[#090e1a] to-[#060913]">
                {/* Resplandor radial suave y difuso centrado detrás del imagotipo (sin líneas) */}
                <div
                  className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[85px] opacity-25 pointer-events-none transition-all duration-300"
                  style={{ backgroundColor: currentTheme.glowColorHex }}
                />

                {/* Spacer top */}
                <div className="hidden md:block w-full h-4" />

                {/* Brand & Isotipo Container */}
                <div className="relative z-10 flex flex-col items-center justify-center my-auto py-4 sm:py-6 w-full max-w-xs">
                  {/* Isotipo: Escudo con gradiente y resplandor dinámico */}
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${currentTheme.shieldGradient} p-[2px] ${currentTheme.shieldGlow} shrink-0 flex items-center justify-center transition-all duration-300 ease-out`}>
                      <div className={`w-full h-full ${currentTheme.shieldInnerBg} rounded-[14px] flex items-center justify-center transition-colors duration-300`}>
                        <Shield className="w-6 h-6 text-white stroke-[2.2]" />
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="block text-[9px] font-mono font-bold tracking-[0.24em] text-slate-400 uppercase">
                        PLATAFORMA OFICIAL
                      </span>
                      <span className="text-2xl font-black tracking-tight font-display">
                        <span className="text-white">Control</span>
                        <span className={`transition-colors duration-300 ${currentTheme.brandAccentText}`}>Electoral</span>
                      </span>
                    </div>
                  </div>

                  {/* Separador: ACCESO AL SISTEMA */}
                  <div className="relative w-full my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800/90" />
                    </div>
                    <span className="relative px-3.5 bg-[#090e1a] text-[9.5px] uppercase font-mono font-semibold tracking-[0.22em] text-slate-500">
                      ACCESO AL SISTEMA
                    </span>
                  </div>

                  {/* Contexto Dinámico del Módulo Seleccionado */}
                  <div className="mt-2 text-center">
                    <h3 className="text-xs sm:text-sm font-bold tracking-[0.16em] text-slate-200 uppercase font-mono leading-relaxed">
                      {getModuleContextLabel(selectedEnv.id)}
                    </h3>
                  </div>

                  {/* Enlace o botón interactivo: Cambiar de módulo */}
                  <button
                    type="button"
                    onClick={handleBackToSelector}
                    className={`inline-flex items-center gap-1.5 mt-5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border text-xs font-medium transition-all duration-300 cursor-pointer group shadow-sm ${currentTheme.backBtn}`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>← Cambiar de módulo</span>
                  </button>
                </div>

                {/* Footer de seguridad */}
                <div className="relative z-10 w-full pt-3 flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500">
                  <ShieldCheck className={`w-3.5 h-3.5 transition-colors duration-300 ${currentTheme.securityIconText}`} />
                  <span>Cifrado TLS 1.3 • Zero-Knowledge</span>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* COLUMNA DERECHA: FORMULARIO DE CREDENCIALES          */}
              {/* ---------------------------------------------------- */}
              <div className="relative p-6 sm:p-8 md:p-10 pb-8 bg-[#090f1d] flex flex-col justify-center">
                {/* Cabecera */}
                <div className="mb-6 pr-8">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
                    Bienvenido
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Ingresa tus credenciales oficiales para continuar.
                  </p>
                </div>

                {/* Alerta de Desajuste RBAC */}
                {rbacMismatch && (
                  <div className="p-3.5 mb-4 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-amber-300 font-bold mb-0.5">
                          Acceso Restringido por Rol (RBAC)
                        </strong>
                        <p className="leading-relaxed text-[11px]">
                          Credenciales válidas, pero tu rol (<strong>{rbacMismatch.userRoleLabel}</strong>) no tiene acceso al módulo <strong>{selectedEnv.title}</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onLoginSuccess(rbacMismatch.user, rbacMismatch.suggestedRoute);
                        onClose();
                      }}
                      className="w-full mt-2.5 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                    >
                      <span>Ir a mi módulo ({rbacMismatch.suggestedModuleName})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Mensaje de Error */}
                {errorMsg && !rbacMismatch && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span className="break-words min-w-0">{errorMsg}</span>
                  </div>
                )}

                {/* Mensaje de Recuperación */}
                {recoveryMessage && (
                  <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className="break-words min-w-0">{recoveryMessage}</span>
                  </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleCredentialsSubmit} className="space-y-4 w-full">
                  {/* Campo 1: USUARIO / CORREO ELECTRÓNICO */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-slate-300 tracking-wider uppercase"
                    >
                      USUARIO / CORREO ELECTRÓNICO
                    </label>
                    <div className={`relative flex items-center w-full bg-[#0a1120] border border-slate-700/80 rounded-xl px-3.5 py-2.5 transition-all duration-200 ${currentTheme.inputFocus}`}>
                      <span className="text-slate-500 text-sm font-mono mr-2.5 select-none shrink-0">
                        @
                      </span>
                      <input
                        type="email"
                        name="email"
                        id="login-email"
                        autoComplete="username email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="usuario@campana.com"
                        className="login-decorated-input w-full bg-transparent border-none p-0 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0 dark-autofill"
                        required
                      />
                    </div>
                  </div>

                  {/* Campo 2: CONTRASEÑA */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="text-xs font-semibold text-slate-300 tracking-wider uppercase"
                      >
                        CONTRASEÑA
                      </label>
                      <button
                        type="button"
                        onClick={handlePasswordRecovery}
                        disabled={isRecovering || isLoading}
                        className={`text-xs font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 ${currentTheme.recoveryLink}`}
                      >
                        {isRecovering ? 'Enviando enlace…' : '¿Olvidaste tu contraseña?'}
                      </button>
                    </div>
                    <div className={`relative flex items-center w-full bg-[#0a1120] border border-slate-700/80 rounded-xl px-3.5 py-2.5 transition-all duration-200 ${currentTheme.inputFocus}`}>
                      <span className="text-slate-500 text-sm font-mono mr-2.5 select-none shrink-0">
                        #
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        id="login-password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="login-decorated-input w-full bg-transparent border-none p-0 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0 dark-autofill"
                        required
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowPassword((prev) => !prev);
                        }}
                        title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                        aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                        className="ml-2 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors p-1 shrink-0 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Checkbox: Recordar este dispositivo */}
                  <div className="pt-0.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-slate-400 hover:text-slate-300 text-sm">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className={`w-4 h-4 rounded border-slate-700 bg-[#0d1627] cursor-pointer transition-colors duration-300 ${currentTheme.checkboxAccent}`}
                      />
                      <span>Recordar este dispositivo</span>
                    </label>
                  </div>

                  {/* Botón Primario: Iniciar Sesión */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full mt-2 py-3.5 px-4 rounded-xl ${currentTheme.submitButton} hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] text-white font-bold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Validando credenciales...</span>
                      </>
                    ) : (
                      <span>Iniciar Sesión</span>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
