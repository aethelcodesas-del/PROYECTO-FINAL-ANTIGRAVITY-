import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  Home, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  ShieldAlert,
  Terminal,
  Activity
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  moduleName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Log to standard error stream with context
    console.error('[Bee Campaign AI ErrorBoundary]: Uncaught exception captured:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      (prevProps.moduleName !== this.props.moduleName || prevProps.children !== this.props.children)
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        copied: false,
        showDetails: false,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('bee_current_view');
      window.location.reload();
    } catch (e) {
      window.location.href = '/';
    }
  };

  handleReturnToLanding = () => {
    try {
      localStorage.setItem('bee_current_view', 'landing');
      window.location.reload();
    } catch (e) {
      window.location.href = '/';
    }
  };

  handleCopyDiagnostics = async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      module: this.props.moduleName || 'Global Root',
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack,
      },
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (err) {
      console.warn('Clipboard write failed, fallback to console log', err);
    }
  };

  handleDownloadReport = () => {
    const diagnostics = {
      app: 'Bee Campaign AI Suite',
      version: '2026.1.0',
      timestamp: new Date().toISOString(),
      module: this.props.moduleName || 'Global Root',
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack,
      },
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bee-campaign-error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Se produjo una interrupción inesperada en la ejecución del módulo.';
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || 'No hay traza de pila disponible.';

      return (
        <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden select-none">
          {/* Ambient Glows */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
          </div>

          {/* Main Error Card */}
          <div className="relative z-10 w-full max-w-2xl bg-gradient-to-b from-[#0b1329]/95 via-[#070d1e]/95 to-[#040814]/95 border border-red-500/30 shadow-2xl shadow-red-950/40 rounded-3xl p-6 sm:p-8 md:p-10 backdrop-blur-xl flex flex-col gap-6">
            
            {/* Header / Icon */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-red-500/20 via-orange-500/10 to-red-900/30 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-950/50">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                    SISTEMA DE RECUPERACIÓN RESILIENTE
                  </span>
                  {this.props.moduleName && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                      MÓDULO: {this.props.moduleName.toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Incidencia Controlada en el Entorno Electoral
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  El sistema detectó una anomalía y aisló el proceso para proteger la integridad de los datos de campaña y las sesiones en curso.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-red-950/30 border border-red-500/25 rounded-2xl p-4 text-xs font-mono text-red-200/90 flex items-start gap-3 select-text">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="overflow-hidden break-words flex-1">
                <span className="font-bold text-red-300">Detalle del Evento:</span> {errorMessage}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                id="btn-error-retry"
                onClick={this.handleReset}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reintentar Operación</span>
              </button>

              <button
                id="btn-error-home"
                onClick={this.handleReturnToLanding}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Volver al Portal Principal</span>
              </button>
            </div>

            {/* Secondary Controls: Diagnostics toggle & report */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors font-medium cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>{this.state.showDetails ? 'Ocultar Diagnóstico Técnico' : 'Ver Diagnóstico Técnico'}</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={this.handleCopyDiagnostics}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copiar traza técnica al portapapeles"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Traza</span>
                    </>
                  )}
                </button>

                <button
                  onClick={this.handleDownloadReport}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Descargar informe JSON para soporte"
                >
                  <FileText className="w-3.5 h-3.5 text-orange-400" />
                  <span>Descargar Reporte</span>
                </button>
              </div>
            </div>

            {/* Collapsible Technical Details */}
            {this.state.showDetails && (
              <div className="bg-[#02050e] border border-cyan-500/20 rounded-xl p-4 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto custom-scrollbar select-text space-y-3">
                <div>
                  <span className="text-cyan-400 font-bold block mb-1">Pila de Ejecución (Stack Trace):</span>
                  <pre className="text-slate-400 whitespace-pre-wrap leading-relaxed text-[10px]">
                    {errorStack}
                  </pre>
                </div>
                <div className="pt-2 border-t border-white/5 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
                  <span>URL: {window.location.href}</span>
                  <span>Hora: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                Bee Campaign AI Core Resiliency
              </span>
              <button 
                onClick={this.handleHardReset}
                className="hover:text-red-400 underline underline-offset-2 transition-colors cursor-pointer"
              >
                Limpiar caché de sesión local
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
