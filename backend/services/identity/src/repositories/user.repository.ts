import { injectable } from 'inversify';
import { DbExecutor, buildSetClause, likePattern, pageOffset } from '@market-pro/core';
import { PermissionEffect, PermissionOverride, UserStatus, UserView } from '@market-pro/shared';

export interface UserRecord {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
  isOwner: boolean;
}

export interface UserListFilter {
  search?: string;
  status?: UserStatus;
  page: number;
  pageSize: number;
}

export interface NewUser {
  tenantId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  documentNumber?: string | null;
  phone?: string | null;
  isOwner?: boolean;
}

export interface UserPatch {
  fullName?: string;
  documentNumber?: string | null;
  phone?: string | null;
  status?: UserStatus;
  passwordHash?: string;
}

export interface PermissionOverrideRow {
  permissionId: string;
  effect: PermissionEffect;
}

/** Usuarios de tenant. Todas las operaciones corren dentro de withTenant (RLS). */
export interface IUserRepository {
  findByEmail(db: DbExecutor, email: string): Promise<UserRecord | null>;
  findById(db: DbExecutor, id: string): Promise<UserRecord | null>;
  list(db: DbExecutor, filter: UserListFilter): Promise<{ items: UserView[]; total: number }>;
  getView(db: DbExecutor, id: string): Promise<UserView | null>;
  findOwnerView(db: DbExecutor, tenantId: string): Promise<UserView | null>;
  countActive(db: DbExecutor): Promise<number>;
  create(db: DbExecutor, data: NewUser): Promise<string>;
  update(db: DbExecutor, id: string, patch: UserPatch): Promise<void>;
  delete(db: DbExecutor, id: string): Promise<boolean>;
  touchLogin(db: DbExecutor, id: string): Promise<void>;
  replaceRoles(db: DbExecutor, tenantId: string, userId: string, roleIds: string[]): Promise<void>;
  getOverrides(db: DbExecutor, userId: string): Promise<PermissionOverride[]>;
  replaceOverrides(db: DbExecutor, tenantId: string, userId: string, overrides: PermissionOverrideRow[]): Promise<void>;
}

const RECORD_COLUMNS = `id, tenant_id AS "tenantId", email, password_hash AS "passwordHash",
  full_name AS "fullName", status, is_owner AS "isOwner"`;

const VIEW_COLUMNS = `
  u.id, u.tenant_id AS "tenantId", u.email, u.full_name AS "fullName",
  u.document_number AS "documentNumber", u.phone, u.status, u.is_owner AS "isOwner",
  u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
  coalesce((SELECT json_agg(json_build_object('id', r.id, 'name', r.name) ORDER BY r.name)
              FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = u.id), '[]') AS roles`;

@injectable()
export class PgUserRepository implements IUserRepository {
  findByEmail(db: DbExecutor, email: string): Promise<UserRecord | null> {
    return db.maybeOne<UserRecord>(`SELECT ${RECORD_COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  }

  findById(db: DbExecutor, id: string): Promise<UserRecord | null> {
    return db.maybeOne<UserRecord>(`SELECT ${RECORD_COLUMNS} FROM users WHERE id = $1`, [id]);
  }

  async list(db: DbExecutor, filter: UserListFilter): Promise<{ items: UserView[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.search) {
      params.push(likePattern(filter.search));
      where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`u.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = await db.one<{ total: number }>(`SELECT count(*)::int AS total FROM users u ${whereSql}`, params);
    const items = await db.query<UserView>(
      `SELECT ${VIEW_COLUMNS} FROM users u ${whereSql}
        ORDER BY u.is_owner DESC, u.full_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }

  getView(db: DbExecutor, id: string): Promise<UserView | null> {
    return db.maybeOne<UserView>(`SELECT ${VIEW_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
  }

  findOwnerView(db: DbExecutor, tenantId: string): Promise<UserView | null> {
    return db.maybeOne<UserView>(`SELECT ${VIEW_COLUMNS} FROM users u WHERE u.tenant_id = $1 AND u.is_owner`, [
      tenantId,
    ]);
  }

  async countActive(db: DbExecutor): Promise<number> {
    const row = await db.one<{ total: number }>(`SELECT count(*)::int AS total FROM users WHERE status = 'ACTIVE'`);
    return row.total;
  }

  async create(db: DbExecutor, data: NewUser): Promise<string> {
    const row = await db.one<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, document_number, phone, is_owner)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.tenantId,
        data.email,
        data.passwordHash,
        data.fullName,
        data.documentNumber ?? null,
        data.phone ?? null,
        data.isOwner ?? false,
      ],
    );
    return row.id;
  }

  async update(db: DbExecutor, id: string, patch: UserPatch): Promise<void> {
    const set = buildSetClause({ ...patch }, {
      fullName: 'full_name',
      documentNumber: 'document_number',
      phone: 'phone',
      status: 'status',
      passwordHash: 'password_hash',
    }, 2);
    if (!set.sql) return;
    await db.execute(`UPDATE users SET ${set.sql} WHERE id = $1`, [id, ...set.values]);
  }

  async delete(db: DbExecutor, id: string): Promise<boolean> {
    return (await db.execute('DELETE FROM users WHERE id = $1 AND NOT is_owner', [id])) > 0;
  }

  async touchLogin(db: DbExecutor, id: string): Promise<void> {
    await db.execute('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  }

  async replaceRoles(db: DbExecutor, tenantId: string, userId: string, roleIds: string[]): Promise<void> {
    await db.execute('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    if (roleIds.length === 0) return;
    await db.execute(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       SELECT $1, $2, r.id FROM roles r WHERE r.id = ANY($3::uuid[])`,
      [tenantId, userId, roleIds],
    );
  }

  getOverrides(db: DbExecutor, userId: string): Promise<PermissionOverride[]> {
    return db.query<PermissionOverride>(
      `SELECT p.code, up.effect
         FROM user_permissions up JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = $1 ORDER BY p.code`,
      [userId],
    );
  }

  async replaceOverrides(
    db: DbExecutor,
    tenantId: string,
    userId: string,
    overrides: PermissionOverrideRow[],
  ): Promise<void> {
    await db.execute('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
    for (const override of overrides) {
      await db.execute(
        'INSERT INTO user_permissions (tenant_id, user_id, permission_id, effect) VALUES ($1, $2, $3, $4)',
        [tenantId, userId, override.permissionId, override.effect],
      );
    }
  }
}
