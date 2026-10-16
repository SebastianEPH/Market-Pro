import { useState } from 'react';
import { ErrorBanner, Loader, PageHeader, Switch, useApi, useAsync } from '@market-pro/frontend-common';
import { ModuleView } from '@market-pro/shared';

/** Interruptor global de módulos: apagar uno lo desactiva en TODAS las tiendas. */
export function ModulesPage() {
  const api = useApi();
  const { data, error, loading, setData } = useAsync(() => api.get<ModuleView[]>('/identity/platform/modules'), []);
  const [actionError, setActionError] = useState<unknown>(null);

  const toggle = async (module: ModuleView, isActive: boolean) => {
    setActionError(null);
    try {
      setData(await api.patch<ModuleView[]>(`/identity/platform/modules/${module.code}`, { isActive }));
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <>
      <PageHeader title="Módulos globales" subtitle="Catálogo de módulos, permisos CRUD y características del sistema" />
      <ErrorBanner error={error ?? actionError} />
      {loading && !data ? (
        <Loader />
      ) : (
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Código</th>
                  <th>Permisos</th>
                  <th>Características</th>
                  <th>Activo (global)</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((module) => (
                  <tr key={module.code}>
                    <td>
                      <strong>{module.name}</strong>
                      <div className="muted">{module.description}</div>
                    </td>
                    <td className="mono">{module.code}</td>
                    <td className="mono">{module.permissions.map((permission) => permission.action).join(' · ')}</td>
                    <td>{module.features.map((feature) => feature.name).join(', ') || '—'}</td>
                    <td>
                      <Switch checked={module.isActive} onChange={(checked) => void toggle(module, checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
