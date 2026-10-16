export interface SetClause {
  sql: string;
  values: unknown[];
}

/**
 * Construye un `SET col = $n, ...` solo con las claves definidas del patch.
 * `columns` mapea propiedad -> columna; las propiedades no mapeadas se ignoran.
 */
export function buildSetClause(
  patch: Record<string, unknown>,
  columns: Record<string, string>,
  startIndex = 1,
): SetClause {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = patch[key];
    if (value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${startIndex + values.length - 1}`);
  }
  return { sql: assignments.join(', '), values };
}

export function pageOffset(page: number, pageSize: number): number {
  return (Math.max(page, 1) - 1) * pageSize;
}

/** Escapa comodines para usar texto del usuario dentro de un ILIKE. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
