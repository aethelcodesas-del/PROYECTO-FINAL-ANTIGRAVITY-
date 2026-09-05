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
  Shield
} from 'lucide-react';
import { AuthUser, UserRole, ViewMode } from '../types';
import { supabase } from '../lib/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser, initialRoute?: ViewMode) => void;
  targetModule?: string;
  targetView?: ViewMode;
}

// Preset pre-configured demo personas with real roles
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

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  targetModule,
  targetView
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsLoading(false);
      setIdentifier('');
      setPassword('');
      setRecoveryMessage(null);
    }
  }, [isOpen, targetModule]);

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const email = identifier.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMsg('Ingresa el correo electrónico registrado en Supabase.');
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
          throw new Error('Tu correo está pendiente de confirmación. Usa “¿Olvidaste tu contraseña?” para activar el acceso de forma segura.');
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
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .select('descripcion')
          .eq('id', profile.campaign_id)
          .maybeSingle();
        if (campaignError) {
          await supabase.auth.signOut();
          throw new Error('No fue posible validar la vigencia de la campaña.');
        }
        let demoExpiresAt: string | null = null;
        try {
          const demoMetadata = JSON.parse(String(campaign?.descripcion || ''));
          if (demoMetadata?.systemType === 'DEMO') demoExpiresAt = demoMetadata.demoExpiresAt || null;
        } catch { /* Descripción de campaña sin metadatos internos. */ }
        if (demoExpiresAt && new Date(demoExpiresAt).getTime() <= Date.now()) {
          await supabase.auth.signOut();
          throw new Error('La demostración finalizó y su información está siendo eliminada automáticamente.');
        }
        if (demoExpiresAt) {
          localStorage.setItem('active_demo_expires_at', demoExpiresAt);
        } else {
          localStorage.removeItem('active_demo_expires_at');
        }
      }

      const roleMap: Record<string, { role: UserRole; label: string }> = {
        GLOBAL_ADMIN: { role: 'superadmin', label: 'Administrador Global' },
        SUPERADMIN: { role: 'superadmin', label: 'Superadministrador' },
        ADMIN_CLIENTE: { role: 'administrador', label: 'Administrador de campaña' },
        ADMINISTRADOR: { role: 'administrador', label: 'Administrador General' },
        DIRECTOR: { role: 'candidato', label: 'Director estratégico' },
        COORDINADOR: { role: 'coordinador_general_zona', label: 'Coordinador territorial' },
        USUARIO: { role: 'territorial', label: 'Usuario territorial' },
        USUARIO_LIMITADO: { role: 'lider', label: 'Usuario limitado' }
      };
      const mapped = roleMap[profile.role];
      if (!mapped) {
        await supabase.auth.signOut();
        throw new Error('Tu rol no tiene acceso a los módulos del sistema.');
      }

      const { data: permissionRows, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('function_code,actions')
        .eq('user_id', profile.id);
      if (permissionsError) {
        await supabase.auth.signOut();
        throw new Error('No fue posible cargar los permisos asignados a tu cuenta.');
      }
      const permissions = (permissionRows || [])
        .filter((permission: any) => Array.isArray(permission.actions) && permission.actions.includes('ACCESS'))
        .map((permission: any) => String(permission.function_code));

      const user: AuthUser = {
        id: profile.id,
        name: profile.display_name || email.split('@')[0],
        email: profile.email || email,
        role: mapped.role,
        roleName: mapped.label,
        moduleName: targetModule || 'Sistema Electoral',
        clientId: profile.client_id || undefined,
        clientName: profile.client_id || profile.campaign_id ? 'Campaña autorizada' : 'Administración global',
        permissions
      };

      onLoginSuccess(user, targetView);
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
        const value = String(error.message || '').toLowerCase();
        const code = value.includes('rate limit') || value.includes('too many')
          ? 'AUTH_RATE_LIMIT'
          : value.includes('fetch') || value.includes('network')
            ? 'AUTH_NETWORK_ERROR'
            : value.includes('api key')
              ? 'AUTH_CONFIGURATION_ERROR'
              : 'AUTH_SESSION_ERROR';
        console.warn('Password recovery rejected', { code, source: 'campaign-login' });
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
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="relative w-full max-w-lg bg-[#030d1d] border border-cyan-500/25 rounded-3xl shadow-2xl shadow-black/90 p-5 sm:p-7 z-10 text-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center z-20 border border-slate-700/50"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 p-0.5 shadow-lg shadow-teal-950/60 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#020b18] rounded-[14px] flex items-center justify-center">
                <Lock className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-950/70 px-2 py-0.5 rounded-full border border-cyan-800/50">
                  Control de Acceso
                </span>
                {targetModule && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40 truncate max-w-[170px]">
                    {targetModule}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1 truncate">
                Iniciar Sesión
              </h2>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3 mb-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
          {recoveryMessage && (
            <div className="p-3 mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{recoveryMessage}</span>
            </div>
          )}

          {/* FORMULARIO DE CREDENCIALES */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Correo registrado en Supabase"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
            </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-300">Contraseña de Seguridad</label>
                  <button
                    type="button"
                    onClick={handlePasswordRecovery}
                    disabled={isRecovering || isLoading}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                  >
                    {isRecovering ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer z-20 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 pointer-events-none" />
                    ) : (
                      <Eye className="w-4 h-4 pointer-events-none" />
                    )}
                  </button>
                </div>
              </div>

            {/* Security info notice */}
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-start gap-2 text-[11px] text-cyan-300/90 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Autenticación encriptada con asignación automática de permisos según el rol directivo y territorial.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:brightness-110 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-teal-950/60 border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando Acceso...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Iniciar Sesión en {targetModule || 'el Módulo'}</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
