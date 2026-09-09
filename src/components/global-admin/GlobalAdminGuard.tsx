import React, { useState, useEffect } from 'react';
import { GlobalAdminService } from '../../services/globalAdminService';
import { GlobalAdminSession } from '../../types/globalAdmin';
import { GlobalAdminLayout } from './GlobalAdminLayout';
import { 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Terminal,
  Cpu
} from 'lucide-react';

interface GlobalAdminGuardProps {
  onBackToApp?: () => void;
}

export const GlobalAdminGuard: React.FC<GlobalAdminGuardProps> = ({ onBackToApp }) => {
  const [session, setSession] = useState<GlobalAdminSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  // Check existing session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        setLoading(true);
        const res = await GlobalAdminService.verifySession();
        if (res.valid && res.session?.user?.role === 'GLOBAL_ADMIN') {
          setSession(res.session);
        } else {
          GlobalAdminService.clearSession();
        }
      } catch (err: any) {
        // Not authenticated or invalid token
        GlobalAdminService.clearSession();
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setAccessDenied(false);

    try {
      const res = await GlobalAdminService.login(email, password);
      if (res.session && res.session.user.role === 'GLOBAL_ADMIN') {
        setSession(res.session);
      } else {
        setAccessDenied(true);
        setError('El usuario no posee permisos de Administrador Global.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al autenticar en el Panel Global.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await GlobalAdminService.logout();
    setSession(null);
    setPassword('');
    onBackToApp?.();
  };

  const handlePasswordRecovery = async () => {
    setError(null);
    setRecoveryMessage(null);
    if (!email.trim()) {
      setError('Ingresa primero el correo del administrador global.');
      return;
    }
    try {
      setSubmitting(true);
      const result = await GlobalAdminService.requestPasswordReset(email);
      setRecoveryMessage(result.message);
    } catch (err: any) {
      setError(err.message || 'No fue posible solicitar la recuperación.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="flex items-center space-x-3 bg-slate-900/80 border border-slate-800 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-md">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="text-sm font-mono tracking-wider text-slate-300">
            VERIFICANDO PROTOCOLO DE SEGURIDAD GLOBAL...
          </span>
        </div>
      </div>
    );
  }

  // 2. Authenticated -> Render Full Global Admin Layout
  if (session && session.user.role === 'GLOBAL_ADMIN') {
    return (
      <GlobalAdminLayout 
        session={session} 
        onLogout={handleLogout} 
        onExitToApp={onBackToApp} 
      />
    );
  }

  // 3. Login Gateway (Dark, High-Security, Private)
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden selection:bg-cyan-500 selection:text-black">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.08)_0%,transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Main Security Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Security Badge Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 font-display">
                TERMINAL PRIVADO <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">L10</span>
              </h1>
              <p className="text-xs text-slate-400 font-sans">Acceso Restringido - Master System</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-emerald-400">TLS 1.3</span>
          </div>
        </div>

        {/* Access Denied Banner if applicable */}
        {accessDenied && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-sans flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-rose-200">403 Acceso Denegado</strong>
              Tu cuenta no cuenta con autorización de Administrador Global.
            </div>
          </div>
        )}

        {/* Error message */}
        {error && !accessDenied && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-sans flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {recoveryMessage && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{recoveryMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-sans font-medium text-slate-300 mb-1.5">
              CORREO DE ADMINISTRADOR GLOBAL
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico registrado"
                spellCheck={false}
                autoCapitalize="none"
                style={{ fontFamily: 'Consolas, "Courier New", monospace', letterSpacing: '0.02em' }}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-sans font-medium text-slate-300">
                CLAVE DE ACCESO MAESTRA
              </label>
              <button
                type="button"
                onClick={handlePasswordRecovery}
                disabled={submitting}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
              >
                Restablecer contraseña
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                style={{ fontFamily: 'Consolas, "Courier New", monospace', letterSpacing: '0.03em' }}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-3.5 pr-11 py-2.5 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPassword((prev) => !prev);
                }}
                title={showPassword ? "Ocultar clave maestra" : "Mostrar clave maestra"}
                aria-label={showPassword ? "Ocultar clave maestra" : "Mostrar clave maestra"}
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-sans font-bold py-3 px-4 rounded-xl shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>DESENCRIPTANDO SESIÓN...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>AUTORIZAR INGRESO GLOBAL</span>
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        {onBackToApp && (
          <div className="mt-6 pt-4 border-t border-slate-800/70 text-center">
            <button
              onClick={onBackToApp}
              className="text-xs font-sans text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la interfaz electoral pública</span>
            </button>
          </div>
        )}
      </div>

      {/* Security Footer Notice */}
      <div className="mt-6 text-center text-[11px] font-mono text-slate-500 max-w-sm">
        <p>AUDITORÍA EN TIEMPO REAL ACTIVA • SESIONES PROTEGIDAS POR TOKEN SHA-256 Y POLÍTICAS RLS</p>
      </div>
    </div>
  );
};
