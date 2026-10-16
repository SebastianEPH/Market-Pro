import { ModuleCode, PermissionAction, permissionCode } from '@market-pro/shared';
import { ACTION_LABELS, ALL_ACTIONS } from '../utils/labels';

export interface PermissionMatrixRow {
  moduleCode: ModuleCode;
  moduleName: string;
  /** Acciones disponibles para asignar (techo). */
  actions: PermissionAction[];
}

/**
 * Matriz módulo × CRUD. `value` son códigos `modulo:accion`.
 * Las acciones fuera del techo se muestran deshabilitadas.
 */
export function PermissionMatrix({
  rows,
  value,
  onChange,
  disabled = false,
}: {
  rows: PermissionMatrixRow[];
  value: string[];
  onChange(next: string[]): void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (code: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
    onChange([...next]);
  };

  const toggleRow = (row: PermissionMatrixRow) => {
    const codes = row.actions.map((action) => permissionCode(row.moduleCode, action));
    const allOn = codes.every((code) => selected.has(code));
    const next = new Set(selected);
    for (const code of codes) {
      if (allOn) next.delete(code);
      else next.add(code);
    }
    onChange([...next]);
  };

  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Módulo</th>
            {ALL_ACTIONS.map((action) => (
              <th key={action} className="center">
                {ACTION_LABELS[action]}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.moduleCode}>
              <td>{row.moduleName}</td>
              {ALL_ACTIONS.map((action) => {
                const code = permissionCode(row.moduleCode, action);
                const available = row.actions.includes(action);
                return (
                  <td key={action} className="center">
                    {available ? (
                      <input
                        type="checkbox"
                        checked={selected.has(code)}
                        disabled={disabled}
                        onChange={(event) => toggle(code, event.target.checked)}
                        aria-label={`${row.moduleName} ${ACTION_LABELS[action]}`}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                );
              })}
              <td className="right">
                <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => toggleRow(row)}>
                  Todo
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
