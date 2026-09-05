import React, { useState, useEffect } from 'react';
import { GlobalAdminRole, GlobalAdminPermission } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';

export const GlobalAdminRoles: React.FC = () => {
  const [roles, setRoles] = useState<GlobalAdminRole[]>([]);
  const [permissions, setPermissions] = useState<GlobalAdminPermission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<GlobalAdminRole | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissions: [] as string[]
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await GlobalAdminService.getRoles();
      setRoles(data.roles);
      setPermissions(data.permissionsCatalog);
      if (!selectedRole && data.roles.length > 0) {
        setSelectedRole(data.roles[0]);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar roles y permisos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await GlobalAdminService.createRole(formData);
      setShowCreateModal(false);
      setSuccessMsg(`Rol ${formData.name} creado exitosamente.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al crear rol');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    try {
      await GlobalAdminService.updateRole(selectedRole.id, formData);
      setShowEditModal(false);
      setSuccessMsg(`Rol ${selectedRole.name} actualizado.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar rol');
    }
  };

  const handleDeleteRole = async (role: GlobalAdminRole) => {
    if (role.isSystem) {
      setError('Los roles de sistema protegidos no pueden ser eliminados.');
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar el rol "${role.name}"?`)) return;

    try {
      await GlobalAdminService.deleteRole(role.id);
      setSuccessMsg(`Rol ${role.name} eliminado.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar rol');
    }
  };

  const togglePermissionInForm = (code: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code]
    }));
  };

  const openCreateModal = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      permissions: []
    });
    setShowCreateModal(true);
  };

  const openEditModal = (role: GlobalAdminRole) => {
    setSelectedRole(role);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: [...role.permissions]
    });
    setShowEditModal(true);
  };

  // Group permissions by Category
  const categories = Array.from(new Set(permissions.map(p => p.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/40">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span>CONTROL DE ACCESO Y MATRIZ RBAC</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1.5 leading-relaxed">
            Gestión granular de roles del sistema, jerarquía de privilegios y políticas de autorización transversal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold font-sans border border-slate-700/80 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-bold shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Rol RBAC</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Roles Master & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List (Left Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-md shadow-xl">
          <h3 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider mb-3 px-1">
            ROLES CONFIGURADOS ({roles.length})
          </h3>

          <div className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer font-mono text-xs ${
                  selectedRole?.id === role.id
                    ? 'bg-cyan-950/50 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {role.code === 'GLOBAL_ADMIN' ? (
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Sistema
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {role.description}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {role.userCount || 0} Usuarios
                  </span>
                  <span className="text-cyan-400 font-semibold">
                    {role.permissions?.length || 0} Permisos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Role Detail & Permissions Matrix (Right 2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl">
          {selectedRole ? (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold font-mono text-white">{selectedRole.name}</h3>
                    <code className="text-xs bg-slate-950 text-cyan-300 px-2 py-0.5 rounded border border-slate-800 font-mono">
                      {selectedRole.code}
                    </code>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">{selectedRole.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedRole)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 text-xs font-sans font-medium border border-cyan-500/30 transition-all active:scale-95 shadow-sm shadow-cyan-950/30 cursor-pointer whitespace-nowrap"
                  >
                    <Edit2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>Editar Matriz</span>
                  </button>
                  {!selectedRole.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-sans font-medium border border-rose-500/30 transition-all active:scale-95 shadow-sm shadow-rose-950/30 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions Breakdown by Category */}
              <div className="mt-5 space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  PERMISOS CONCEDIDOS ({selectedRole.permissions?.length || 0} de {permissions.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  {categories.map((cat) => {
                    const catPerms = permissions.filter(p => p.category === cat);
                    return (
                      <div key={cat} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                        <span className="text-[11px] font-bold text-cyan-400 block mb-2">{cat}</span>
                        <div className="space-y-1.5">
                          {catPerms.map((perm) => {
                            const isGranted = selectedRole.permissions?.includes(perm.code);
                            return (
                              <div
                                key={perm.code}
                                className={`flex items-start gap-2 p-1.5 rounded text-[11px] ${
                                  isGranted ? 'bg-cyan-950/40 text-slate-200' : 'text-slate-600'
                                }`}
                              >
                                {isGranted ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <span className="font-semibold block">{perm.name}</span>
                                  <span className="text-[10px] text-slate-400">{perm.description}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 font-mono text-xs">
              Selecciona un rol de la lista para inspeccionar sus permisos.
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT ROLE MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl font-mono text-xs">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              {showCreateModal ? 'CREAR NUEVO ROL RBAC' : `MODIFICAR ROL: ${formData.name}`}
            </h3>
            <p className="text-slate-400 mb-4">
              Define los privilegios de acceso y ámbito de ejecución para este rol.
            </p>

            <form onSubmit={showCreateModal ? handleCreateRole : handleUpdateRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Nombre del Rol</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Auditor Territorial"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Código Identificador (Slug)</label>
                  <input
                    type="text"
                    required
                    disabled={showEditModal}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="auditor_territorial"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe las responsabilidades y alcance de este rol..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-2">
                  MATRIZ DE PERMISOS ({formData.permissions.length} SELECCIONADOS)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                  {permissions.map((perm) => {
                    const isChecked = formData.permissions.includes(perm.code);
                    return (
                      <div
                        key={perm.code}
                        onClick={() => togglePermissionInForm(perm.code)}
                        className={`p-2 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                          isChecked ? 'bg-cyan-950/50 border-cyan-500/50 text-white' : 'bg-slate-900/40 border-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold block text-[11px]">{perm.name}</span>
                          <span className="text-[10px] text-slate-500">{perm.category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-900/30"
                >
                  Guardar Rol RBAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
