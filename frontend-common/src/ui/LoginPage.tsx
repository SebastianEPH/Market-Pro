import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ErrorBanner, Field } from './components';

const LAST_TENANT_KEY = 'market-pro:last-tenant';

function readLastTenant(): string {
  try {
    return localStorage.getItem(LAST_TENANT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LoginPage({ title, subtitle, askTenant }: { title: string; subtitle?: string; askTenant: boolean }) {
  const { login, notice } = useAuth();
  const [tenantSlug, setTenantSlug] = useState(readLastTenant);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ tenantSlug: askTenant ? tenantSlug.trim().toLowerCase() : undefined, email, password });
      if (askTenant) {
        try {
          localStorage.setItem(LAST_TENANT_KEY, tenantSlug.trim().toLowerCase());
        } catch {
          // ignorar
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__brand">
          <span className="shell__logo" aria-hidden="true">
            ▣
          </span>
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
        </div>
        {notice && <div className="alert alert--warning">{notice}</div>}
        <ErrorBanner error={error} />
        {askTenant && (
          <Field label="Código de tienda">
            <input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="mi-tienda" required autoFocus />
          </Field>
        )}
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!askTenant} />
        </Field>
        <Field label="Contraseña">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
