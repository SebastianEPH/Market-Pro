import { FormEvent, useEffect, useState } from 'react';
import { ErrorBanner, Field, Loader, PageHeader, useApi, useAsync, useAuth } from '@market-pro/frontend-common';
import { ModuleCode, PermissionAction, TenantSettings } from '@market-pro/shared';

interface SettingsResponse {
  name: string;
  settings: TenantSettings;
}

export function SettingsPage() {
  const api = useApi();
  const { can, reloadAccess } = useAuth();
  const current = useAsync(() => api.get<SettingsResponse>('/identity/settings'), []);
  const [form, setForm] = useState({ currency: 'PEN', taxRate: '18', taxIncluded: true, timezone: 'America/Lima', receiptFooter: '' });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const editable = can(ModuleCode.SETTINGS, PermissionAction.UPDATE);

  useEffect(() => {
    const settings = current.data?.settings;
    if (!settings) return;
    setForm({
      currency: settings.currency,
      taxRate: String(Math.round(settings.taxRate * 10_000) / 100),
      taxIncluded: settings.taxIncluded,
      timezone: settings.timezone,
      receiptFooter: settings.receiptFooter ?? '',
    });
  }, [current.data]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      current.setData(
        await api.put<SettingsResponse>('/identity/settings', {
          currency: form.currency,
          taxRate: Number(form.taxRate) / 100,
          taxIncluded: form.taxIncluded,
          timezone: form.timezone,
          receiptFooter: form.receiptFooter || null,
        }),
      );
      setSaved(true);
      await reloadAccess();
    } catch (err) {
      setError(err);
    }
  };

  if (current.loading && !current.data) return <Loader />;

  return (
    <form className="stack" onSubmit={save}>
      <PageHeader
        title="Configuración"
        subtitle={current.data?.name}
        actions={
          editable && (
            <button className="btn btn--primary" type="submit">
              Guardar
            </button>
          )
        }
      />
      <ErrorBanner error={error ?? current.error} />
      {saved && <div className="alert alert--info">Configuración guardada.</div>}
      <div className="card grid grid--2">
        <Field label="Moneda (ISO 4217)">
          <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} disabled={!editable} />
        </Field>
        <Field label="Impuesto (%)" hint="IGV Perú: 18">
          <input type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} disabled={!editable} />
        </Field>
        <Field label="Zona horaria">
          <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} disabled={!editable} />
        </Field>
        <Field label="Precios">
          <select
            value={form.taxIncluded ? 'yes' : 'no'}
            onChange={(e) => setForm({ ...form, taxIncluded: e.target.value === 'yes' })}
            disabled={!editable}
          >
            <option value="yes">Incluyen impuesto</option>
            <option value="no">No incluyen impuesto</option>
          </select>
        </Field>
        <Field label="Pie del ticket">
          <input value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} disabled={!editable} />
        </Field>
      </div>
    </form>
  );
}
