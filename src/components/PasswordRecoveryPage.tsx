import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export function PasswordRecoveryPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setRecoverySessionReady(true);
        setCheckingSession(false);
        setError('');
      }
    });
    const validationTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setCheckingSession(false);
      setError('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.');
    }, 2500);
    return () => {
      mounted = false;
      window.clearTimeout(validationTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!recoverySessionReady) {
      setError('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.');
      return;
    }
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || 'No fue posible actualizar la contraseña. Solicita un enlace nuevo.');
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    window.history.replaceState(null, '', returnTo === 'campaign' ? '/' : '/global-admin');
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950 p-3 text-cyan-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Crear nueva contraseña</h1>
            <p className="text-sm text-slate-400">Recuperación segura de cuenta</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Nueva contraseña</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-11 text-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-cyan-300">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Confirmar contraseña</span>
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
            />
          </label>

          <button disabled={loading || checkingSession || !recoverySessionReady} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-bold text-white disabled:opacity-60">
            {(loading || checkingSession) && <Loader2 className="h-4 w-4 animate-spin" />}
            {checkingSession ? 'Validando enlace…' : 'Guardar contraseña y continuar'}
          </button>
        </form>
      </section>
    </main>
  );
}
