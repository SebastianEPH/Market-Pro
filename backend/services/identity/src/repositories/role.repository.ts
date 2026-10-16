import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { RoleView } from '@market-pro/shared';

export interface IRoleRepository {
  list(db: DbExecutor): Promise<RoleView[]>;
  get(db: DbExecutor, id: string): Promise<RoleView | null>;
  create(db: DbExecutor, tenantId: string, name: string, description: string | null): Promise<string>;
  update(db: DbExecutor, id: string, name: string | undefined, description: string | null | undefined): Promise<void>;
  delete(db: DbExecutor, id: string): Promise<boolean>;
  replacePermissions(db: DbExecutor, tenantId: string, roleId: string, permissionIds: string[]): Promise<void>;
  /** Permisos (códigos) que otorga un conjunto de roles. */
  permissionCodesOf(db: DbExecutor, roleIds: string[]): Promise<string[]>;
  countExisting(db: DbExecutor, roleIds: string[]): Promise<number>;
}

const VIEW_COLUMNS = `
  r.id, r.name, r.description, r.is_system AS "isSystem",
  coalesce((SELECT array_agg(p.code ORDER BY p.code)
              FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id), '{}') AS permissions,
  (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS "userCount"`;

@injectable()
export class PgRoleRepository implements IRoleRepository {
  list(db: DbExecutor): Promise<RoleView[]> {
    return db.query<RoleView>(`SELECT ${VIEW_COLUMNS} FROM roles r ORDER BY r.name`);
  }

  get(db: DbExecutor, id: string): Promise<RoleView | null> {
    return db.maybeOne<RoleView>(`SELECT ${VIEW_COLUMNS} FROM roles r WHERE r.id = $1`, [id]);
  }

  async create(db: DbExecutor, tenantId: string, name: string, description: string | null): Promise<string> {
    const row = await db.one<{ id: string }>(
      'INSERT INTO roles (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [tenantId, name, description],
    );
    return row.id;
  }

  async update(db: DbExecutor, id: string, name: string | undefined, description: string | null | undefined): Promise<void> {
    await db.execute(
      `UPDATE roles
          SET name = coalesce($2, name),
              description = CASE WHEN $4::boolean THEN $3 ELSE description END
        WHERE id = $1`,
      [id, name ?? null, description ?? null, description !== undefined],
    );
  }

  async delete(db: DbExecutor, id: string): Promise<boolean> {
    return (await db.execute('DELETE FROM roles WHERE id = $1 AND NOT is_system', [id])) > 0;
  }

  async replacePermissions(db: DbExecutor, tenantId: string, roleId: string, permissionIds: string[]): Promise<void> {
    await db.execute('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    if (permissionIds.length === 0) return;
    await db.execute(
      `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
       SELECT $1, $2, unnest($3::uuid[])`,
      [tenantId, roleId, permissionIds],
    );
  }

  async permissionCodesOf(db: DbExecutor, roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const rows = await db.query<{ code: string }>(
      `SELECT DISTINCT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ANY($1::uuid[])`,
      [roleIds],
    );
    return rows.map((row) => row.code);
  }

  async countExisting(db: DbExecutor, roleIds: string[]): Promise<number> {
    if (roleIds.length === 0) return 0;
    const row = await db.one<{ total: number }>('SELECT count(*)::int AS total FROM roles WHERE id = ANY($1::uuid[])', [
      roleIds,
    ]);
    return row.total;
  }
}
