import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Loader,
  PageHeader,
  Pagination,
  TENANT_STATUS_LABELS,
  formatDate,
  useApi,
  useAsync,
} from '@market-pro/frontend-common';
import { PaginatedResult, TenantStatus, TenantView } from '@market-pro/shared';
import { tenantTone } from '../tenant-tone';

export function TenantsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, error, loading } = useAsync(
    () => api.get<PaginatedResult<TenantView>>('/identity/platform/tenants', { search, status, page, pageSize: 20 }),
    [search, status, page],
  );

  return (
    <>
      <PageHeader
        title="Tiendas"
        subtitle="Cada tienda es una instancia vendida a un comprador"
        actions={
          <Link className="btn btn--primary" to="/tenants/new">
            ➕ Nueva tienda
          </Link>
        }
      />
      <ErrorBanner error={error} />
      <div className="card card--flush">
        <div className="toolbar">
          <input
            placeholder="Buscar por nombre, código o RUC…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            {Object.values(TenantStatus).map((value) => (
              <option key={value} value={value}>
                {TENANT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {loading && !data ? (
          <Loader />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="Sin tiendas" message="Crea la primera instancia para un comprador." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Código</th>
                  <th>RUC</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((tenant) => (
                  <tr key={tenant.id} onClick={() => navigate(`/tenants/${tenant.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <strong>{tenant.name}</strong>
                      <div className="muted">{tenant.contactEmail}</div>
                    </td>
                    <td className="mono">{tenant.slug}</td>
                    <td>{tenant.taxId ?? '—'}</td>
                    <td>{tenant.planName ?? '—'}</td>
                    <td>
                      <Badge tone={tenantTone(tenant.status)}>{TENANT_STATUS_LABELS[tenant.status]}</Badge>
                    </td>
                    <td>{formatDate(tenant.expiresAt)}</td>
                    <td>{formatDate(tenant.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
