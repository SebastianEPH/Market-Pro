import { FormEvent, useState } from 'react';
import {
  Badge,
  Can,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PageHeader,
  Pagination,
  PermissionMatrix,
  Tone,
  USER_STATUS_LABELS,
  formatDateTime,
  useApi,
  useAsync,
  useAuth,
} from '@market-pro/frontend-common';
import {
  AvailableModulePermissions,
  ModuleCode,
  PaginatedResult,
  PermissionAction,
  PermissionEffect,
  RoleView,
  UserDetailView,
  UserStatus,
  UserView,
} from '@market-pro/shared';

interface UserForm {
  email: string;
  fullName: string;
  password: string;
  documentNumber: string;
  phone: string;
  status: UserStatus;
  roleIds: string[];
  allow: string[];
  deny: string[];
}

const EMPTY: UserForm = {
  email: '',
  fullName: '',
  password: '',
  documentNumber: '',
  phone: '',
  status: UserStatus.ACTIVE,
  roleIds: [],
  allow: [],
  deny: [],
};

export function UsersPage() {
  const api = useApi();
  const { can, user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const users = useAsync(
    () => api.get<PaginatedResult<UserView>>('/identity/users', { search, page, pageSize: 20 }),
    [search, page],
  );
  const roles = useAsync(() => api.get<RoleView[]>('/identity/roles'), []);
  const available = useAsync(() => api.get<AvailableModulePermissions[]>('/identity/roles/available-permissions'), []);

  const [editing, setEditing] = useState<UserDetailView | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  };

  const openEdit = async (user: UserView) => {
    setError(null);
    try {
      const detail = await api.get<UserDetailView>(`/identity/users/${user.id}`);
      setEditing(detail);
      setForm({
        email: detail.email,
        fullName: detail.fullName,
        password: '',
        documentNumber: detail.documentNumber ?? '',
        phone: detail.phone ?? '',
        status: detail.status,
        roleIds: detail.roles.map((role) => role.id),
        allow: detail.permissionOverrides.filter((o) => o.effect === PermissionEffect.ALLOW).map((o) => o.code),
        deny: detail.permissionOverrides.filter((o) => o.effect === PermissionEffect.DENY).map((o) => o.code),
      });
      setOpen(true);
    } catch (err) {
      setError(err);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!editing) {
        await api.post('/identity/users', {
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          documentNumber: form.documentNumber || null,
          phone: form.phone || null,
          roleIds: form.roleIds,
        });
      } else {
        await api.patch(`/identity/users/${editing.id}`, {
          fullName: form.fullName,
          documentNumber: form.documentNumber || null,
          phone: form.phone || null,
          status: form.status,
          password: form.password || undefined,
        });
        if (!editing.isOwner) {
          await api.put(`/identity/users/${editing.id}/roles`, { roleIds: form.roleIds });
          const deny = new Set(form.deny);
          await api.put(`/identity/users/${editing.id}/permissions`, {
            overrides: [
              ...form.allow.filter((code) => !deny.has(code)).map((code) => ({ code, effect: PermissionEffect.ALLOW })),
              ...form.deny.map((code) => ({ code, effect: PermissionEffect.DENY })),
            ],
          });
        }
      }
      setOpen(false);
      users.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (user: UserView) => {
    if (!window.confirm(`¿Eliminar al usuario ${user.fullName}?`)) return;
    try {
      await api.delete(`/identity/users/${user.id}`);
      users.reload();
    } catch (err) {
      setError(err);
    }
  };

  const toggleRole = (roleId: string, checked: boolean) =>
    set('roleIds', checked ? [...form.roleIds, roleId] : form.roleIds.filter((id) => id !== roleId));

  const isOwnerEdit = editing?.isOwner ?? false;
  const canEditAccess = can(ModuleCode.USERS, PermissionAction.UPDATE) && !isOwnerEdit;

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Personal de la tienda y sus accesos"
        actions={
          <Can module={ModuleCode.USERS} action={PermissionAction.CREATE}>
            <button className="btn btn--primary" onClick={openCreate}>
              ➕ Nuevo usuario
            </button>
          </Can>
        }
      />
      <ErrorBanner error={users.error ?? (!open ? error : null)} />
      <div className="card card--flush">
        <div className="toolbar">
          <input
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {users.loading && !users.data ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Roles</th>
                  <th>Estado</th>
                  <th>Último ingreso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data?.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong> {user.isOwner && <Badge tone={Tone.INFO}>Administrador</Badge>}
                      <div className="muted">{user.email}</div>
                    </td>
                    <td>{user.isOwner ? 'Todos los permisos' : user.roles.map((role) => role.name).join(', ') || '—'}</td>
                    <td>
                      <Badge tone={user.status === UserStatus.ACTIVE ? Tone.SUCCESS : Tone.WARNING}>{USER_STATUS_LABELS[user.status]}</Badge>
                    </td>
                    <td>{formatDateTime(user.lastLoginAt)}</td>
                    <td className="right">
                      <Can module={ModuleCode.USERS} action={PermissionAction.UPDATE}>
                        <button className="btn btn--ghost btn--sm" onClick={() => void openEdit(user)}>
                          Editar
                        </button>
                      </Can>
                      <Can module={ModuleCode.USERS} action={PermissionAction.DELETE}>
                        <button
                          className="btn btn--ghost btn--sm"
                          disabled={user.isOwner || user.id === me?.id}
                          onClick={() => void remove(user)}
                        >
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
        {users.data && <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onChange={setPage} />}
      </div>

      <Modal
        open={open}
        wide
        title={editing ? `Editar: ${editing.fullName}` : 'Nuevo usuario'}
        onClose={() => setOpen(false)}
        footer={
          <button className="btn btn--primary" form="user-form" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        }
      >
        <form id="user-form" className="stack" onSubmit={save}>
          <ErrorBanner error={error} />
          <div className="grid grid--2">
            <Field label="Nombre completo">
              <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!!editing} />
            </Field>
            <Field label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'} hint="Mínimo 8 caracteres">
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required={!editing}
                minLength={8}
              />
            </Field>
            <Field label="Documento">
              <input value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            {editing && (
              <Field label="Estado">
                <select value={form.status} onChange={(e) => set('status', e.target.value as UserStatus)} disabled={isOwnerEdit}>
                  {Object.values(UserStatus).map((status) => (
                    <option key={status} value={status}>
                      {USER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {isOwnerEdit ? (
            <div className="alert alert--info">El administrador de la tienda tiene todos los permisos habilitados en el plan.</div>
          ) : (
            <>
              <h2>Roles</h2>
              <div className="row">
                {roles.data?.map((role) => (
                  <label key={role.id} className="row badge" style={{ padding: '6px 12px' }}>
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(role.id)}
                      disabled={editing !== null && !canEditAccess}
                      onChange={(e) => toggleRole(role.id, e.target.checked)}
                    />
                    {role.name}
                  </label>
                ))}
                {roles.data?.length === 0 && <span className="muted">No hay roles creados.</span>}
              </div>

              {editing && (
                <>
                  <h2>Permisos adicionales</h2>
                  <p className="muted">Se suman a los de sus roles.</p>
                  <PermissionMatrix rows={available.data ?? []} value={form.allow} onChange={(next) => set('allow', next)} disabled={!canEditAccess} />
                  <h2>Permisos bloqueados</h2>
                  <p className="muted">Se quitan aunque un rol los otorgue.</p>
                  <PermissionMatrix rows={available.data ?? []} value={form.deny} onChange={(next) => set('deny', next)} disabled={!canEditAccess} />
                </>
              )}
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
