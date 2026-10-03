import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle2, XCircle, X, ShieldAlert } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /**
   * Optional async action to run while keeping the modal open with a loading spinner
   * on the confirm button until the request finishes.
   */
  onConfirm?: () => Promise<void | boolean> | void | boolean;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastVariant;
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'title'>> {
  id: string;
  title?: string;
}

interface ConfirmDialogContextValue {
  confirmModal: (options: ConfirmModalOptions) => Promise<boolean>;
  showToast: (messageOrOptions: string | ToastOptions, type?: ToastVariant) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

// Global singleton references for imperative usage across any module
let globalConfirmFn: ((options: ConfirmModalOptions) => Promise<boolean>) | null = null;
let globalToastFn: ((messageOrOptions: string | ToastOptions, type?: ToastVariant) => void) | null = null;

export const confirmModal = (options: ConfirmModalOptions): Promise<boolean> => {
  if (globalConfirmFn) {
    return globalConfirmFn(options);
  }
  return Promise.resolve(false);
};

export const showToast = (messageOrOptions: string | ToastOptions, type: ToastVariant = 'info'): void => {
  if (globalToastFn) {
    globalToastFn(messageOrOptions, type);
  }
};

export const useConfirmModal = (): ConfirmDialogContextValue => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    return { confirmModal, showToast };
  }
  return ctx;
};

interface ActiveModalState {
  options: ConfirmModalOptions;
  resolve: (confirmed: boolean) => void;
}

// Helper to highlight quoted text ("...") with a subtle badge in the descriptive message
const renderHighlightedMessage = (message: string) => {
  const parts = message.split(/("[^"]+")/g);
  return parts.map((part, idx) => {
    if (part.startsWith('"') && part.endsWith('"') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <span
          key={idx}
          className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-white font-semibold text-xs"
        >
          &ldquo;{inner}&rdquo;
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const triggerConfirm = useCallback((options: ConfirmModalOptions): Promise<boolean> => {
    setIsSubmitting(false);
    return new Promise<boolean>((resolve) => {
      setActiveModal({ options, resolve });
    });
  }, []);

  const triggerToast = useCallback((messageOrOptions: string | ToastOptions, defaultType: ToastVariant = 'info') => {
    const opts: ToastOptions =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions, type: defaultType }
        : messageOrOptions;

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = {
      id,
      title: opts.title,
      message: opts.message,
      type: opts.type || defaultType,
      duration: opts.duration ?? 5000,
    };

    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, item.duration);
  }, []);

  useEffect(() => {
    globalConfirmFn = triggerConfirm;
    globalToastFn = triggerToast;
    return () => {
      if (globalConfirmFn === triggerConfirm) globalConfirmFn = null;
      if (globalToastFn === triggerToast) globalToastFn = null;
    };
  }, [triggerConfirm, triggerToast]);

  // Handle Escape key
  useEffect(() => {
    if (!activeModal || isSubmitting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeModal.resolve(false);
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, isSubmitting]);

  const handleCancel = () => {
    if (!activeModal || isSubmitting) return;
    activeModal.resolve(false);
    setActiveModal(null);
  };

  const handleConfirm = async () => {
    if (!activeModal || isSubmitting) return;
    const { options, resolve } = activeModal;
    if (options.onConfirm) {
      setIsSubmitting(true);
      try {
        const result = await options.onConfirm();
        setIsSubmitting(false);
        setActiveModal(null);
        resolve(result !== false);
      } catch {
        setIsSubmitting(false);
        setActiveModal(null);
        resolve(false);
      }
    } else {
      setActiveModal(null);
      resolve(true);
    }
  };

  const variant: ConfirmVariant = activeModal?.options.variant || 'danger';

  const iconBadgeClass =
    variant === 'danger'
      ? 'w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
      : variant === 'warning'
      ? 'w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
      : 'w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]';

  const confirmBtnClass =
    variant === 'danger'
      ? 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(225,29,72,0.35)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
      : variant === 'warning'
      ? 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(245,158,11,0.35)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
      : 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  return (
    <ConfirmDialogContext.Provider value={{ confirmModal: triggerConfirm, showToast: triggerToast }}>
      {children}

      {/* Global Dark Glassmorphic Confirmation Modal */}
      {activeModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop-animate"
          style={{ zIndex: 10000 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) handleCancel();
          }}
        >
          <div className="bg-slate-900/95 border border-slate-700/60 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl max-w-md w-full p-6 text-white relative overflow-hidden modal-container-animate">
            {/* Subtle top glow bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                variant === 'danger'
                  ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-600'
                  : variant === 'warning'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500'
              }`}
            />

            {/* Header Icon */}
            <div className="flex items-start justify-between">
              <div className={iconBadgeClass}>
                {variant === 'danger' ? (
                  <Trash2 className="w-6 h-6" />
                ) : variant === 'warning' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <h3 id="confirm-modal-title" className="text-lg font-semibold text-white">
              {activeModal.options.title}
            </h3>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">
              {renderHighlightedMessage(activeModal.options.message)}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
              >
                {activeModal.options.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={confirmBtnClass}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>{activeModal.options.confirmText || 'Sí, eliminar'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Dark Glassmorphic Toast Stack */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0.75rem))] md:bottom-5 right-3 md:right-5 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
          style={{ zIndex: 10001 }}
        >
          {toasts.map((t) => {
            const borderStyle =
              t.type === 'success'
                ? 'border-emerald-500/40 bg-slate-900/95 text-emerald-100 shadow-[0_15px_35px_rgba(0,0,0,0.55)]'
                : t.type === 'error'
                ? 'border-rose-500/40 bg-slate-900/95 text-rose-100 shadow-[0_15px_35px_rgba(0,0,0,0.55)]'
                : t.type === 'warning'
                ? 'border-amber-500/40 bg-slate-900/95 text-amber-100 shadow-[0_15px_35px_rgba(0,0,0,0.55)]'
                : 'border-cyan-500/40 bg-slate-900/95 text-cyan-100 shadow-[0_15px_35px_rgba(0,0,0,0.55)]';

            return (
              <div
                key={t.id}
                className={`pointer-events-auto backdrop-blur-md border rounded-2xl p-4 flex items-start gap-3 animate-fade-in ${borderStyle}`}
              >
                <div className="shrink-0 mt-0.5">
                  {t.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : t.type === 'error' ? (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  ) : t.type === 'warning' ? (
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Info className="w-5 h-5 text-cyan-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {t.title && <p className="text-xs font-bold text-white mb-0.5">{t.title}</p>}
                  <p className="text-xs font-medium text-slate-200 leading-relaxed break-words">{t.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};
