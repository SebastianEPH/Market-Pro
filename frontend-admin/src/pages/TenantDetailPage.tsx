import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import {
  Badge,
  ErrorBanner,
  Field,
  Loader,
  Modal,
  PageHeader,
  TENANT_STATUS_LABELS,
  formatDateTime,
  useApi,
  useAsync,
} from '@market-pro/frontend-common';
import { ModuleView, TenantDetailView, TenantFeatureConfig, TenantModuleConfig, TenantStatus } from '@market-pro/shared';
import { TenantFeaturesEditor } from '../components/TenantFeaturesEditor';
import { TenantModulesEditor } from '../components/TenantModulesEditor';
import { tenantTone } from '../tenant-tone';

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const api = useApi();
  const tenantState = useAsync(() => api.get<TenantDetailView>(`/identity/platform/tenants/${id}`), [id]);
  const catalog = useAsync(() => api.get<ModuleView[]>('/identity/platform/modules'), []);
  const tenant = tenantState.data;

  const [info, setInfo] = useState({ name: '', legalName: '', taxId: '', contactEmail: '', contactPhone: '', planName: '', expiresAt: '' });
  const [modules, setModules] = useState<TenantModuleConfig[]>([]);
  const [features, setFeatures] = useState<TenantFeatureConfig[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setInfo({
      name: tenant.name,
      legalName: tenant.legalName ?? '',
      taxId: tenant.taxId ?? '',
      contactEmail: tenant.contactEmail ?? '',
      contactPhone: tenant.contactPhone ?? '',
      planName: tenant.planName ?? '',
      expiresAt: tenant.expiresAt ? tenant.expiresAt.slice(0, 10) : '',
    });
    setModules(tenant.modules);
    setFeatures(tenant.features);
  }, [tenant]);

  const run = async (action: () => Promise<TenantDetailView | void>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await action();
      if (updated) tenantState.setData(updated);
      setMessage(success);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const saveInfo = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () =>
        api.patch<TenantDetailView>(`/identity/platform/tenants/${id}`, {
          name: info.name,
          legalName: info.legalName || null,
          taxId: info.taxId || null,
          contactEmail: info.contactEmail || null,
          contactPhone: info.contactPhone || null,
          planName: info.planName || null,
          expiresAt: info.expiresAt ? new Date(`${info.expiresAt}T23:59:59`).toISOString() : null,
        }),
      'Datos actualizados',
    );
  };

  const setStatus = (status: TenantStatus) =>
    run(() => api.patch<TenantDetailView>(`/identity/platform/tenants/${id}/status`, { status }), `Estado: ${TENANT_STATUS_LABELS[status]}`);

  if (tenantState.loading && !tenant) return <Loader />;
  if (!tenant) return <ErrorBanner error={tenantState.error} />;

  return (
    <>
      <PageHeader
        title={tenant.name}
        subtitle={`Código: ${tenant.slug} · ${tenant.userCount} usuario(s) · creada ${formatDateTime(tenant.createdAt)}`}
        actions={
          <>
            <Badge tone={tenantTone(tenant.status)}>{TENANT_STATUS_LABELS[tenant.status]}</Badge>
            {tenant.status !== TenantStatus.ACTIVE && (
              <button className="btn" disabled={busy} onClick={() => void setStatus(TenantStatus.ACTIVE)}>
                ▶ Reactivar
              </button>
            )}
            {tenant.status === TenantStatus.ACTIVE && (
              <button className="btn" disabled={busy} onClick={() => void setStatus(TenantStatus.SUSPENDED)}>
                ⏸ Suspender
              </button>
            )}
            {tenant.status !== TenantStatus.CANCELLED && (
              <button className="btn btn--danger" disabled={busy} onClick={() => void setStatus(TenantStatus.CANCELLED)}>
                Cancelar
              </button>
            )}
          </>
        }
      />
      {message && <div className="alert alert--info">{message}</div>}
      <ErrorBanner error={error ?? catalog.error} />

      <form className="card stack" onSubmit={saveInfo}>
        <div className="row row--between">
          <h2>Datos de la tienda</h2>
          <button className="btn btn--primary" disabled={busy}>
            Guardar datos
          </button>
        </div>
        <div className="grid grid--2">
          <Field label="Nombre comercial">
            <input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
          </Field>
          <Field label="Razón social">
            <input value={info.legalName} onChange={(e) => setInfo({ ...info, legalName: e.target.value })} />
          </Field>
          <Field label="RUC">
            <input value={info.taxId} onChange={(e) => setInfo({ ...info, taxId: e.target.value })} />
          </Field>
          <Field label="Email de contacto">
            <input type="email" value={info.contactEmail} onChange={(e) => setInfo({ ...info, contactEmail: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <input value={info.contactPhone} onChange={(e) => setInfo({ ...info, contactPhone: e.target.value })} />
          </Field>
          <Field label="Plan">
            <input value={info.planName} onChange={(e) => setInfo({ ...info, planName: e.target.value })} />
          </Field>
          <Field label="Vence">
            <input type="date" value={info.expiresAt} onChange={(e) => setInfo({ ...info, expiresAt: e.target.value })} />
          </Field>
        </div>
      </form>

      <div className="card stack">
        <div className="row row--between">
          <div>
            <h2>Módulos y permisos</h2>
            <p className="muted">Los cambios aplican en tiempo real a todos los usuarios de la tienda.</p>
          </div>
          <button
            className="btn btn--primary"
            disabled={busy}
            onClick={() =>
              void run(() => api.put<TenantDetailView>(`/identity/platform/tenants/${id}/modules`, { modules }), 'Módulos actualizados')
            }
          >
            Guardar módulos
          </button>
        </div>
        {catalog.data && <TenantModulesEditor modules={catalog.data} value={modules} onChange={setModules} />}
      </div>

      <div className="card stack">
        <div className="row row--between">
          <h2>Características</h2>
          <button
            className="btn btn--primary"
            disabled={busy}
            onClick={() =>
              void run(
                () => api.put<TenantDetailView>(`/identity/platform/tenants/${id}/features`, { features }),
                'Características actualizadas',
              )
            }
          >
            Guardar características
          </button>
        </div>
        {catalog.data && (
          <TenantFeaturesEditor features={catalog.data.flatMap((module) => module.features)} value={features} onChange={setFeatures} />
        )}
      </div>

      <div className="card stack">
        <div className="row row--between">
          <h2>Administrador de la tienda</h2>
          <button className="btn" onClick={() => setResetOpen(true)}>
            🔑 Restablecer contraseña
          </button>
        </div>
        {tenant.owner ? (
          <div>
            <strong>{tenant.owner.fullName}</strong> · {tenant.owner.email}
            <div className="muted">Último ingreso: {formatDateTime(tenant.owner.lastLoginAt)}</div>
          </div>
        ) : (
          <p className="muted">Sin administrador asignado.</p>
        )}
      </div>

      <Modal
        open={resetOpen}
        title="Restablecer contraseña del administrador"
        onClose={() => setResetOpen(false)}
        footer={
          <button
            className="btn btn--primary"
            disabled={busy || newPassword.length < 8}
            onClick={() =>
              void run(async () => {
                await api.post(`/identity/platform/tenants/${id}/owner/reset-password`, { password: newPassword });
                setResetOpen(false);
                setNewPassword('');
              }, 'Contraseña restablecida')
            }
          >
            Guardar
          </button>
        }
      >
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}
