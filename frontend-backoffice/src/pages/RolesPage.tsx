import { FormEvent, useState } from 'react';
import {
  Can,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PageHeader,
  PermissionMatrix,
  useApi,
  useAsync,
} from '@market-pro/frontend-common';
import { AvailableModulePermissions, ModuleCode, PermissionAction, RoleView } from '@market-pro/shared';

export function RolesPage() {
  const api = useApi();
  const roles = useAsync(() => api.get<RoleView[]>('/identity/roles'), []);
  const available = useAsync(() => api.get<AvailableModulePermissions[]>('/identity/roles/available-permissions'), []);

  const [editing, setEditing] = useState<RoleView | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);

  const openForm = (role: RoleView | null) => {
    setEditing(role);
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissions(role?.permissions ?? []);
    setError(null);
    setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { name, description: description || null, permissions };
      if (editing) await api.patch(`/identity/roles/${editing.id}`, payload);
      else await api.post('/identity/roles', payload);
      setOpen(false);
      roles.reload();
    } catch (err) {
      setError(err);
    }
  };

  const remove = async (role: RoleView) => {
    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Los usuarios con este rol perderán sus permisos.`)) return;
    try {
      await api.delete(`/identity/roles/${role.id}`);
      roles.reload();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        subtitle="Agrupa permisos CRUD por módulo y asígnalos a tus usuarios"
        actions={
          <Can module={ModuleCode.ROLES} action={PermissionAction.CREATE}>
            <button className="btn btn--primary" onClick={() => openForm(null)}>
              ➕ Nuevo rol
            </button>
          </Can>
        }
      />
      <ErrorBanner error={roles.error ?? available.error ?? (!open ? error : null)} />
      {roles.loading && !roles.data ? (
        <Loader />
      ) : (
        <div className="card card--flush">
          <table className="table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Permisos</th>
                <th className="right">Usuarios</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roles.data?.map((role) => (
                <tr key={role.id}>
                  <td>
                    <strong>{role.name}</strong>
                    <div className="muted">{role.description}</div>
                  </td>
                  <td className="muted">{role.permissions.length} permiso(s)</td>
                  <td className="right">{role.userCount}</td>
                  <td className="right">
                    <Can module={ModuleCode.ROLES} action={PermissionAction.UPDATE}>
                      <button className="btn btn--ghost btn--sm" onClick={() => openForm(role)} disabled={role.isSystem}>
                        Editar
                      </button>
                    </Can>
                    <Can module={ModuleCode.ROLES} action={PermissionAction.DELETE}>
                      <button className="btn btn--ghost btn--sm" onClick={() => void remove(role)} disabled={role.isSystem}>
                        Eliminar
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        wide
        title={editing ? `Editar rol: ${editing.name}` : 'Nuevo rol'}
        onClose={() => setOpen(false)}
        footer={
          <button className="btn btn--primary" form="role-form">
            Guardar
          </button>
        }
      >
        <form id="role-form" className="stack" onSubmit={save}>
          <ErrorBanner error={error} />
          <div className="grid grid--2">
            <Field label="Nombre">
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>
            <Field label="Descripción">
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <p className="muted">Solo aparecen los módulos y acciones que tu plan tiene habilitados.</p>
          <PermissionMatrix rows={available.data ?? []} value={permissions} onChange={setPermissions} />
        </form>
      </Modal>
    </>
  );
}
