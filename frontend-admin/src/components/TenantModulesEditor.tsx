import { ACTION_LABELS, ALL_ACTIONS, Switch } from '@market-pro/frontend-common';
import { ModuleView, PermissionAction, TenantModuleConfig } from '@market-pro/shared';

/** Configuración por defecto: todos los módulos activos con CRUD completo. */
export function defaultModuleConfigs(modules: ModuleView[]): TenantModuleConfig[] {
  return modules
    .filter((module) => module.isActive)
    .map((module) => ({ moduleCode: module.code, isEnabled: true, expiresAt: null, actions: [...ALL_ACTIONS] }));
}

/**
 * Editor del "techo" de la tienda: qué módulos tiene y qué acciones CRUD
 * puede repartir el comprador entre sus usuarios.
 */
export function TenantModulesEditor({
  modules,
  value,
  onChange,
}: {
  modules: ModuleView[];
  value: TenantModuleConfig[];
  onChange(next: TenantModuleConfig[]): void;
}) {
  const byCode = new Map(value.map((config) => [config.moduleCode, config]));

  const update = (module: ModuleView, patch: Partial<TenantModuleConfig>) => {
    const current = byCode.get(module.code) ?? { moduleCode: module.code, isEnabled: false, expiresAt: null, actions: [] };
    const next = { ...current, ...patch };
    onChange([...value.filter((config) => config.moduleCode !== module.code), next]);
  };

  const toggleAction = (module: ModuleView, action: PermissionAction, checked: boolean) => {
    const current = byCode.get(module.code)?.actions ?? [];
    update(module, { actions: checked ? [...new Set([...current, action])] : current.filter((a) => a !== action) });
  };

  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Habilitado</th>
            {ALL_ACTIONS.map((action) => (
              <th key={action} className="center">
                {ACTION_LABELS[action]}
              </th>
            ))}
            <th>Vence</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => {
            const config = byCode.get(module.code);
            const enabled = config?.isEnabled ?? false;
            return (
              <tr key={module.code}>
                <td>
                  <strong>{module.name}</strong>
                  {!module.isActive && <div className="muted">Apagado globalmente</div>}
                </td>
                <td>
                  <Switch
                    checked={enabled}
                    onChange={(checked) =>
                      update(module, { isEnabled: checked, actions: checked && !config?.actions.length ? [...ALL_ACTIONS] : config?.actions ?? [] })
                    }
                  />
                </td>
                {ALL_ACTIONS.map((action) => (
                  <td key={action} className="center">
                    <input
                      type="checkbox"
                      disabled={!enabled}
                      checked={config?.actions.includes(action) ?? false}
                      onChange={(event) => toggleAction(module, action, event.target.checked)}
                      aria-label={`${module.name} ${ACTION_LABELS[action]}`}
                    />
                  </td>
                ))}
                <td>
                  <input
                    type="date"
                    disabled={!enabled}
                    value={config?.expiresAt ? config.expiresAt.slice(0, 10) : ''}
                    onChange={(event) =>
                      update(module, { expiresAt: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : null })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
