import React from 'react';
import { CampanaDossier } from '../../types/campana';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileText, 
  Building2, 
  User, 
  Landmark, 
  Calendar,
  Award
} from 'lucide-react';

interface ChecklistCNEModalProps {
  dossier: CampanaDossier;
  isOpen: boolean;
  onClose: () => void;
}

export const ChecklistCNEModal: React.FC<ChecklistCNEModalProps> = ({
  dossier,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  // Evaluation criteria
  const items = [
    {
      id: 'territorio',
      title: 'Jurisdicción & Territorio Configurado',
      category: 'Territorio',
      isComplete: Boolean(dossier.departamento && dossier.municipio && dossier.corporacion),
      details: `${dossier.corporacion} en ${dossier.municipio} (${dossier.departamento})`
    },
    {
      id: 'candidato_datos',
      title: 'Datos Básicos del Candidato (Nombre & CC)',
      category: 'Candidatura',
      isComplete: Boolean(dossier.nombreCandidato && dossier.cedulaCandidato),
      details: `${dossier.nombreCandidato || 'Sin nombre'} - CC ${dossier.cedulaCandidato || 'Sin CC'}`
    },
    {
      id: 'candidato_foto',
      title: 'Fotografía Oficial para Tarjetón',
      category: 'Candidatura',
      isComplete: Boolean(dossier.fotoUrl && dossier.fotoUrl.length > 5),
      details: dossier.fotoUrl ? 'Fotografía cargada correctamente' : 'Falta enlace a fotografía oficial'
    },
    {
      id: 'aval_formal',
      title: 'Respaldo Político & Aval CNE',
      category: 'Aval Político',
      isComplete: Boolean(
        dossier.modalidadAval === 'Partido' ? (dossier.partidoUnico && dossier.numeroAvalCNE) :
        dossier.modalidadAval === 'Firmas' ? (dossier.nombreGrupoFirmas && dossier.radicadoRegistraduria) :
        (dossier.nombreCoalicion && dossier.partidosCoalicion.length > 0)
      ),
      details: `Modalidad: ${dossier.modalidadAval}`
    },
    {
      id: 'poliza_seriedad',
      title: 'Póliza de Seriedad de Candidatura',
      category: 'Legal',
      isComplete: Boolean(dossier.polizaNumero && dossier.aseguradora),
      details: `${dossier.polizaNumero || 'Sin póliza'} (${dossier.aseguradora || 'Sin aseguradora'})`
    },
    {
      id: 'gerente_campana',
      title: 'Gerente Oficial de Campaña Designado',
      category: 'Equipo CNE',
      isComplete: Boolean(dossier.equipo?.gerenteNombre && dossier.equipo?.gerenteCedula),
      details: `${dossier.equipo?.gerenteNombre || 'Falta designar Gerente'} - CC ${dossier.equipo?.gerenteCedula || 'N/A'}`
    },
    {
      id: 'contador_publico',
      title: 'Contador Público con Tarjeta Profesional JCC',
      category: 'Equipo CNE',
      isComplete: Boolean(dossier.equipo?.contadorNombre && dossier.equipo?.contadorTarjetaProfesional),
      details: `${dossier.equipo?.contadorNombre || 'Falta Contador'} - ${dossier.equipo?.contadorTarjetaProfesional || 'Sin TP'}`
    },
    {
      id: 'cuenta_bancaria',
      title: 'Cuenta Bancaria Exclusiva (Ley 1475/2011)',
      category: 'Financiero CNE',
      isComplete: Boolean(dossier.equipo?.bancoNombre && dossier.equipo?.bancoNumeroCuenta),
      details: `${dossier.equipo?.bancoNombre || 'Falta Banco'} - ${dossier.equipo?.bancoTipoCuenta || ''} No. ${dossier.equipo?.bancoNumeroCuenta || 'N/A'}`
    },
    {
      id: 'listas_aliadas',
      title: 'Listas y Co-Candidaturas Aliadas Vinculadas',
      category: 'Listas Aliadas',
      isComplete: Boolean(dossier.campanasAliadas && dossier.campanasAliadas.length > 0),
      details: `${dossier.campanasAliadas?.length || 0} listas aliadas configuradas (Concejo/Asamblea/JAL)`
    }
  ];

  const completedCount = items.filter(i => i.isComplete).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  return (
    <div className="checklist-cne-modal-backdrop fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="checklist-cne-modal-box bg-[#041226] rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-cyan-500/40 space-y-4 sm:space-y-5 text-white max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">Auditoría & Checklist de Conformidad CNE</h3>
              <p className="text-[11px] text-slate-400">Verificación normativa de requisitos legales según Registraduría y CNE Colombia</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#081f3d] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Card */}
        <div className="bg-[#020712] p-4 rounded-xl border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs font-bold text-slate-300">Índice de Completitud del Expediente</div>
            <div className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
              <span className={percentage === 100 ? 'text-emerald-400' : percentage >= 70 ? 'text-cyan-300' : 'text-amber-400'}>
                {percentage}% Conforme
              </span>
              <span className="text-xs text-slate-400 font-normal">({completedCount} de {items.length} requisitos)</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full sm:w-48 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
            <div 
              className={`h-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-400' : percentage >= 70 ? 'bg-cyan-400' : 'bg-amber-400'}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2 text-xs">
          {items.map(item => (
            <div 
              key={item.id}
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                item.isComplete 
                  ? 'bg-[#031c38]/60 border-emerald-500/30 text-slate-200' 
                  : 'bg-[#1a0f0a]/60 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {item.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-extrabold text-white flex items-center gap-2">
                    <span>{item.title}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#020712] border border-slate-700 text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.details}</div>
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                item.isComplete 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {item.isComplete ? 'Completado' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-cyan-500/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            Entendido / Cerrar Auditoría
          </button>
        </div>
      </div>
    </div>
  );
};
