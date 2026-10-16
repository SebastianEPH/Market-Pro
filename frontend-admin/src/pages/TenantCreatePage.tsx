import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorBanner, Field, Loader, PageHeader, useApi, useAsync } from '@market-pro/frontend-common';
import { ModuleView, TenantDetailView, TenantFeatureConfig, TenantModuleConfig } from '@market-pro/shared';
import { TenantFeaturesEditor, defaultFeatureConfigs } from '../components/TenantFeaturesEditor';
import { TenantModulesEditor, defaultModuleConfigs } from '../components/TenantModulesEditor';

export function TenantCreatePage() {
  const api = useApi();
  const navigate = useNavigate();
  const catalog = useAsync(() => api.get<ModuleView[]>('/identity/platform/modules'), []);

  const [form, setForm] = useState({
    slug: '',
    name: '',
    legalName: '',
    taxId: '',
    contactEmail: '',
    contactPhone: '',
    planName: '',
    expiresAt: '',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
  });
  const [modules, setModules] = useState<TenantModuleConfig[]>([]);
  const [features, setFeatures] = useState<TenantFeatureConfig[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!catalog.data) return;
    setModules(defaultModuleConfigs(catalog.data));
    setFeatures(defaultFeatureConfigs(catalog.data.flatMap((module) => module.features)));
  }, [catalog.data]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tenant = await api.post<TenantDetailView>('/identity/platform/tenants', {
        slug: form.slug,
        name: form.name,
        legalName: form.legalName || null,
        taxId: form.taxId || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        planName: form.planName || null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
        owner: { email: form.ownerEmail, fullName: form.ownerName, password: form.ownerPassword },
        modules,
        features,
      });
      navigate(`/tenants/${tenant.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (catalog.loading) return <Loader />;

  return (
    <form className="stack" onSubmit={submit}>
      <PageHeader
        title="Nueva tienda"
        subtitle="Crea la instancia del comprador con su usuario administrador"
        actions={
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear tienda'}
          </button>
        }
      />
      <ErrorBanner error={error ?? catalog.error} />

      <div className="card stack">
        <h2>Datos de la tienda</h2>
        <div className="grid grid--2">
          <Field label="Código (login)" hint="Minúsculas, números y guiones. Ej: bodega-lucia">
            <input value={form.slug} onChange={set('slug')} required pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]" />
          </Field>
          <Field label="Nombre comercial">
            <input value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Razón social">
            <input value={form.legalName} onChange={set('legalName')} />
          </Field>
          <Field label="RUC">
            <input value={form.taxId} onChange={set('taxId')} />
          </Field>
          <Field label="Email de contacto">
            <input type="email" value={form.contactEmail} onChange={set('contactEmail')} />
          </Field>
          <Field label="Teléfono">
            <input value={form.contactPhone} onChange={set('contactPhone')} />
          </Field>
          <Field label="Plan">
            <input value={form.planName} onChange={set('planName')} placeholder="BÁSICO, PRO…" />
          </Field>
          <Field label="Vence (opcional)" hint="Al vencer, la tienda queda suspendida automáticamente">
            <input type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </Field>
        </div>
      </div>

      <div className="card stack">
        <h2>Administrador de la tienda</h2>
        <div className="grid grid--2">
          <Field label="Nombre completo">
            <input value={form.ownerName} onChange={set('ownerName')} required />
          </Field>
          <Field label="Email">
            <input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} required />
          </Field>
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres">
            <input type="password" value={form.ownerPassword} onChange={set('ownerPassword')} required minLength={8} />
          </Field>
        </div>
      </div>

      <div className="card stack">
        <h2>Módulos y permisos (techo)</h2>
        <p className="muted">El administrador de la tienda solo podrá repartir entre sus usuarios lo que marques aquí.</p>
        {catalog.data && <TenantModulesEditor modules={catalog.data} value={modules} onChange={setModules} />}
      </div>

      <div className="card stack">
        <h2>Características</h2>
        {catalog.data && (
          <TenantFeaturesEditor
            features={catalog.data.flatMap((module) => module.features)}
            value={features}
            onChange={setFeatures}
          />
        )}
      </div>
    </form>
  );
}
