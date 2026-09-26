import React, { useState, useEffect } from 'react';
import { RoleItem, PermissionDefinition, UserSession, api } from '../../lib/api';
import { formatPermissionLabel, formatRoleName } from '../../lib/displayFormatters';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Notice } from '../ui/Notice';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import {
  Shield,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Lock,
  Users,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface RoleManagementViewProps {
  user: UserSession;
}

export function RoleManagementView({ user }: RoleManagementViewProps) {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, PermissionDefinition[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);

  // Modal states
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageRoles = user.role_id === 'role_administrator' || user.permissions.includes('roles.manage');
  const isAdmin = user.role_id === 'role_administrator';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roleRes, permRes] = await Promise.all([
        api.getRoles(),
        api.getPermissions()
      ]);
      setRoles(roleRes.roles);
      setPermissions(permRes.permissions);
      setGroupedPermissions(permRes.grouped);
      if (roleRes.roles.length > 0 && !selectedRole) {
        setSelectedRole(roleRes.roles[0]);
      } else if (selectedRole) {
        const updated = roleRes.roles.find(r => r.id === selectedRole.id);
        if (updated) setSelectedRole(updated);
      }
    } catch (err) {
      console.error('Failed to load roles and permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingRoleId(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPerms([]);
    setFormError(null);
  };

  const openEditModal = (role: RoleItem) => {
    setModalMode('edit');
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description);
    setSelectedPerms([...role.permissions]);
    setFormError(null);
  };

  const togglePermission = (code: string) => {
    if (selectedPerms.includes(code)) {
      setSelectedPerms(selectedPerms.filter(p => p !== code));
    } else {
      setSelectedPerms([...selectedPerms, code]);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !roleDescription.trim()) {
      setFormError('Role name and description are required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (modalMode === 'create') {
        const res = await api.createRole({
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: selectedPerms
        });
        setNotice(`Role "${res.role.name}" created successfully.`);
      } else if (modalMode === 'edit' && editingRoleId) {
        const res = await api.updateRole(editingRoleId, {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissions: selectedPerms
        });
        setNotice(`Role "${res.role.name}" updated successfully.`);
      }
      setModalMode(null);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (role.is_system) {
      alert('System roles are protected and cannot be deleted.');
      return;
    }
    if (role.assignedUserCount > 0) {
      alert(`Cannot delete role: ${role.assignedUserCount} user(s) are currently assigned to this role. Please reassign them first.`);
      return;
    }
    if (!window.confirm(`Permanently delete custom role "${role.name}"?`)) {
      return;
    }

    try {
      await api.deleteRole(role.id);
      setNotice(`Role "${role.name}" deleted.`);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete role.');
    }
  };

  return (
    <div className="space-y-6 w-full pb-10">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Roles & Granular RBAC Permissions
            </h1>
            <Badge variant="neutral">{roles.length} Roles Defined</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative permission matrix, privilege containment boundaries, and operational access controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Matrix
          </Button>

          {canManageRoles && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Custom Role
            </Button>
          )}
        </div>
      </div>

      {notice && <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />}

      {/* Two Column Layout: Left Role Selector, Right Permissions Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Roles Catalog */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Role Profiles
          </div>

          <div className="space-y-2">
            {roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600/30'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900 text-sm">{r.name}</div>
                    {r.is_system ? (
                      <Badge variant="warning" size="sm">System</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Custom</Badge>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {r.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">{r.permissions.length} Permissions</span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Users className="w-3 h-3 text-slate-400" />
                      {r.assignedUserCount} users
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Matrix for Selected Role */}
        <div className="lg:col-span-8">
          {selectedRole ? (
            <Card>
              <CardHeader className="bg-slate-50/50 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{selectedRole.name}</CardTitle>
                      {selectedRole.is_system && (
                        <Badge variant="warning">Protected System Role</Badge>
                      )}
                    </div>
                    <CardDescription>{selectedRole.description}</CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageRoles && selectedRole.id !== 'role_administrator' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(selectedRole)}
                        icon={<Edit2 className="w-3 h-3" />}
                      >
                        Edit Permissions
                      </Button>
                    )}
                    {canManageRoles && !selectedRole.is_system && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteRole(selectedRole)}
                        icon={<Trash2 className="w-3 h-3" />}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Role Type: <span className="font-semibold text-slate-900">{formatRoleName(selectedRole.id, selectedRole.name)}</span></span>
                  </div>
                  <div className="text-slate-500">
                    Assigned: <strong className="text-slate-800">{selectedRole.assignedUserCount} active personnel</strong>
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                    const grantedInModule = perms.filter(p =>
                      selectedRole.id === 'role_administrator' || selectedRole.permissions.includes(p.code)
                    );

                    return (
                      <div key={moduleName} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            {moduleName} Module
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {grantedInModule.length} of {perms.length} granted
                          </span>
                        </div>

                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((p) => {
                            const isGranted =
                              selectedRole.id === 'role_administrator' || selectedRole.permissions.includes(p.code);

                            return (
                              <div
                                key={p.code}
                                className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                                  isGranted
                                    ? 'bg-emerald-50/40 border-emerald-200/80 text-slate-900'
                                    : 'bg-slate-50/50 border-slate-200 text-slate-400 opacity-60'
                                }`}
                              >
                                {isGranted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <span className="font-semibold block">{formatPermissionLabel(p.code)}</span>
                                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                                    {p.description}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-slate-400">
                Select a role from the list to view its authorized permissions.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Role Creation / Editing Modal */}
      {modalMode && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create Custom Operational Role' : `Edit Role: ${roleName}`}
          description="Configure role identity and assign granular permissions. Privilege containment is strictly verified."
          maxWidth="xl"
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setModalMode(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveRole} loading={saving}>
                {modalMode === 'create' ? 'Create Role' : 'Save Changes'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveRole} className="space-y-4">
            {formError && <Notice variant="error" message={formError} onDismiss={() => setFormError(null)} />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Role Name"
                required
                placeholder="e.g. Lead Inbound Dispatcher"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
              <Input
                label="Role Description"
                required
                placeholder="Operational scope and responsibility"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
              />
            </div>

            {/* Privilege Containment Advisory */}
            {!isAdmin && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Privilege Containment Notice:</strong> You can only assign permissions that your own role currently possesses. Permissions you lack will be blocked.
                </span>
              </div>
            )}

            {/* Permissions Selection Checklist */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
                <div key={moduleName} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      {moduleName} Permissions
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const moduleCodes = perms
                          .filter(p => isAdmin || user.permissions.includes(p.code))
                          .map(p => p.code);
                        const allSelected = moduleCodes.every(c => selectedPerms.includes(c));
                        if (allSelected) {
                          setSelectedPerms(selectedPerms.filter(c => !moduleCodes.includes(c)));
                        } else {
                          setSelectedPerms(Array.from(new Set([...selectedPerms, ...moduleCodes])));
                        }
                      }}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
                    >
                      {`Toggle All ${moduleName} Permissions`}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const isAllowedByContainment = isAdmin || user.permissions.includes(p.code);
                      const isChecked = selectedPerms.includes(p.code);

                      return (
                        <label
                          key={p.code}
                          className={`flex items-start gap-2.5 p-2 rounded border text-xs cursor-pointer transition-colors ${
                            !isAllowedByContainment
                              ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                              : isChecked
                              ? 'bg-white border-emerald-600 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isAllowedByContainment}
                            onChange={() => togglePermission(p.code)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 block">{formatPermissionLabel(p.code)}</span>
                            <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                              {p.description}
                            </span>
                            {!isAllowedByContainment && (
                              <span className="text-[10px] text-rose-600 block mt-0.5">
                                Not in your clearance
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
