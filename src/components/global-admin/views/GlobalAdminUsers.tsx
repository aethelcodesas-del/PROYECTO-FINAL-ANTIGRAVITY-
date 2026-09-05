import React, { useState, useEffect } from 'react';
import { GlobalAdminUser, GlobalAdminRole, GlobalAdminCampaign } from '../../../types/globalAdmin';
import { GlobalAdminService } from '../../../services/globalAdminService';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  Check,
  Eye,
  SlidersHorizontal,
  Mail,
  Phone,
  Building
} from 'lucide-react';

export const GlobalAdminUsers: React.FC = () => {
  const [users, setUsers] = useState<GlobalAdminUser[]>([]);
  const [roles, setRoles] = useState<GlobalAdminRole[]>([]);
  const [campaigns, setCampaigns] = useState<GlobalAdminCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<GlobalAdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cedula: '',
    phone: '',
    roleCode: 'administrador',
    campaignId: '',
    campaignName: 'Campaña Central',
    password: '',
    status: 'ACTIVO' as GlobalAdminUser['status']
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, campaignsData] = await Promise.all([
        GlobalAdminService.getUsers(),
        GlobalAdminService.getRoles(),
        GlobalAdminService.getCampaigns()
      ]);
      setUsers(usersData);
      setRoles(rolesData.roles);
      setCampaigns(campaignsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const syncUsers = () => fetchData();
    window.addEventListener('global-admin-users-changed', syncUsers);
    return () => window.removeEventListener('global-admin-users-changed', syncUsers);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await GlobalAdminService.createUser(formData);
      setShowCreateModal(false);
      setSuccessMsg(`Usuario ${formData.name} registrado con éxito.`);
      fetchData();
      setFormData({
        name: '',
        email: '',
        cedula: '',
        phone: '',
        roleCode: 'administrador',
        campaignId: '',
        campaignName: 'Campaña Central',
        password: '',
        status: 'ACTIVO'
      });
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await GlobalAdminService.updateUser(selectedUser.id, formData);
      setShowEditModal(false);
      setSuccessMsg(`Usuario ${selectedUser.name} actualizado con éxito.`);
      window.dispatchEvent(new Event('global-admin-users-changed'));
      window.dispatchEvent(new CustomEvent('platform-data-changed', {
        detail: { table: 'profiles', eventType: 'UPDATE' }
      }));
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar usuario');
    }
  };

  const handleToggleStatus = async (user: GlobalAdminUser, newStatus: GlobalAdminUser['status']) => {
    try {
      await GlobalAdminService.updateUserStatus(user.id, newStatus);
      setSuccessMsg(`Estado de ${user.name} cambiado a ${newStatus}.`);
      window.dispatchEvent(new Event('global-admin-users-changed'));
      window.dispatchEvent(new CustomEvent('platform-data-changed', {
        detail: { table: 'profiles', eventType: 'UPDATE' }
      }));
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado');
    }
  };

  const handleResetPassword = async (user: GlobalAdminUser) => {
    try {
      setSelectedUser(user);
      const res = await GlobalAdminService.resetPassword(user.id);
      if (!res.temporaryPassword) throw new Error('No se recibió la contraseña temporal.');
      setTempPassword(res.temporaryPassword);
      setShowResetModal(true);
      setSuccessMsg(null);
    } catch (err: any) {
      setError(err.message || 'Error al resetear contraseña');
    }
  };

  const openEditModal = (user: GlobalAdminUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      cedula: user.cedula || '',
      phone: user.phone || '',
      roleCode: user.roleCode,
      campaignId: user.campaignId || '',
      campaignName: user.campaignName || 'Campaña Central',
      password: '',
      status: user.status
    });
    setShowEditModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.cedula && u.cedula.includes(search)) ||
      (u.campaignName && u.campaignName.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = selectedRole === 'ALL' || u.roleCode === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/40">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Users className="w-4 h-4" />
            </span>
            <span>ADMINISTRACIÓN GLOBAL DE USUARIOS</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1.5 leading-relaxed">
            Control transversal de credenciales, roles RBAC, acceso multi-campaña y políticas de seguridad.
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
            onClick={() => {
              setFormData({
                name: '',
                email: '',
                cedula: '',
                phone: '',
                roleCode: 'administrador',
                campaignId: '',
                campaignName: 'Campaña Central',
                password: '',
                status: 'ACTIVO'
              });
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-bold shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-sans flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 backdrop-blur-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, cédula o campaña..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-sans text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-sans text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">Todos los Roles RBAC</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-sans text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
            <option value="BLOQUEADO">BLOQUEADO</option>
            <option value="SUSPENDIDO">SUSPENDIDO</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/80 font-display uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-4">USUARIO / IDENTIFICACIÓN</th>
                <th className="py-3 px-4">ROL RBAC</th>
                <th className="py-3 px-4">CAMPAÑA ASIGNADA</th>
                <th className="py-3 px-4">ESTADO</th>
                <th className="py-3 px-4">ÚLTIMO ACCESO</th>
                <th className="py-3 px-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No se encontraron usuarios que coincidan con los filtros de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white font-bold block">{user.name}</span>
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-cyan-400" /> {user.email}
                        </span>
                        {user.cedula && (
                          <span className="text-slate-500 text-[10px] block mt-0.5">
                            CC: {user.cedula}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        user.roleCode === 'GLOBAL_ADMIN'
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                          : user.roleCode === 'superadmin' || user.roleCode === 'administrador'
                          ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {user.roleName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-slate-500" />
                        {user.campaignName || 'Campaña General'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.status === 'ACTIVO'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : user.status === 'BLOQUEADO'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                      }`}>
                        {user.status === 'ACTIVO' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {user.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {user.lastLoginAt ? (
                        <div>
                          <span className="block">{new Date(user.lastLoginAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-slate-500">{new Date(user.lastLoginAt).toLocaleTimeString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Sin ingresos</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          title="Editar usuario"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          title="Ver acceso y generar contraseña temporal"
                          aria-label={`Ver acceso de ${user.name} y generar contraseña temporal`}
                          className="p-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {user.status === 'ACTIVO' ? (
                          <button
                            onClick={() => handleToggleStatus(user, 'BLOQUEADO')}
                            title="Bloquear cuenta"
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(user, 'ACTIVO')}
                            title="Desbloquear cuenta"
                            className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h3 className="text-base font-bold font-mono text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              REGISTRAR NUEVO USUARIO
            </h3>
            <p className="text-xs text-slate-400 font-mono mb-4">
              Crea una cuenta transversal con asignación de rol y permisos automáticos.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Lic. Andrés Restrepo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="andres@campanaganadora.co"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Cédula</label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                    placeholder="1020304050"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+57 300 123 4567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Rol RBAC</label>
                  <select
                    value={formData.roleCode}
                    onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    {roles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Campaña Asignada</label>
                  <input
                    type="text"
                    value={formData.campaignName}
                    onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                    placeholder="Campaña Alcaldía"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Dejar vacío para autogenerar clave segura"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-900/30"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h3 className="text-base font-bold font-mono text-white mb-1 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-cyan-400" />
              MODIFICAR USUARIO: {selectedUser.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono mb-4">
              Ajusta credenciales, rol RBAC o pertenencia de campaña.
            </p>

            <form onSubmit={handleEditUser} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Cédula</label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Rol RBAC</label>
                  <select
                    value={formData.roleCode}
                    onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    {roles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Estado de Acceso</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                    <option value="SUSPENDIDO">SUSPENDIDO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Campaña a la que pertenece</label>
                <select
                  value={formData.campaignId}
                  onChange={(e) => {
                    const selectedCampaign = campaigns.find((campaign) => campaign.id === e.target.value);
                    setFormData({
                      ...formData,
                      campaignId: e.target.value,
                      campaignName: selectedCampaign?.name || 'Sin campaña asignada'
                    });
                  }}
                  disabled={['SUPERADMIN', 'GLOBAL_ADMIN'].includes(formData.roleCode.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
                >
                  <option value="">Sin campaña asignada</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-900/30"
                >
                  Actualizar Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET POPUP */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl font-mono text-xs">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              CONTRASEÑA TEMPORAL GENERADA
            </h3>
            <p className="text-slate-400 mb-4">
              Por seguridad, la contraseña anterior no puede recuperarse. Se creó una nueva contraseña temporal para <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email}).
            </p>

            <div className="p-3 bg-slate-950 border border-cyan-500/40 rounded-xl flex items-center justify-between mb-4">
              <code className="text-cyan-300 font-bold text-sm tracking-wider">
                {tempPassword}
              </code>
              <button
                onClick={() => copyToClipboard(tempPassword || '')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiada' : 'Copiar'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-4">
              Esta contraseña solo se muestra ahora. Cópiala y entrégala al usuario por un canal seguro.
            </p>

            <button
              onClick={() => setShowResetModal(false)}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
            >
              Entendido y Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
