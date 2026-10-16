import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { ModuleCode, PermissionAction, TenantSettings, TenantStatus, UserStatus } from '@market-pro/shared';

export interface TenantAccessContext {
  status: TenantStatus;
  expiresAt: string | null;
  settings: TenantSettings;
}

export interface UserAccessContext {
  status: UserStatus;
  isOwner: boolean;
}

export interface FeatureAccessRow {
  code: string;
  enabled: boolean;
  limit: number | null;
}

export interface CeilingPermissionRow {
  permissionId: string;
  code: string;
  moduleCode: ModuleCode;
  moduleName: string;
  action: PermissionAction;
}

/**
 * Consultas del motor de permisos. Regla efectiva de un usuario:
 *
 *   módulo activo globalmente
 *   ∩ módulo habilitado (y vigente) para el tenant
 *   ∩ techo de permisos del tenant (tenant_permissions)
 *   ∩ ( dueño ? todo : (permisos de roles ∪ ALLOW directos) − DENY directos )
 */
export interface IAccessRepository {
  tenantContext(db: DbExecutor, tenantId: string): Promise<TenantAccessContext | null>;
  userContext(db: DbExecutor, userId: string): Promise<UserAccessContext | null>;
  enabledModules(db: DbExecutor, tenantId: string): Promise<ModuleCode[]>;
  effectivePermissions(db: DbExecutor, tenantId: string, userId: string, isOwner: boolean): Promise<string[]>;
  features(db: DbExecutor, tenantId: string): Promise<FeatureAccessRow[]>;
  ceiling(db: DbExecutor, tenantId: string): Promise<CeilingPermissionRow[]>;
}

const ENABLED_MODULES_CTE = `
  enabled_modules AS (
    SELECT tm.module_code
      FROM tenant_modules tm
      JOIN modules m ON m.code = tm.module_code AND m.is_active
     WHERE tm.tenant_id = $1
       AND tm.is_enabled
       AND (tm.expires_at IS NULL OR tm.expires_at > now())
  )`;

@injectable()
export class PgAccessRepository implements IAccessRepository {
  tenantContext(db: DbExecutor, tenantId: string): Promise<TenantAccessContext | null> {
    return db.maybeOne<TenantAccessContext>(
      'SELECT status, expires_at AS "expiresAt", settings FROM tenants WHERE id = $1',
      [tenantId],
    );
  }

  userContext(db: DbExecutor, userId: string): Promise<UserAccessContext | null> {
    return db.maybeOne<UserAccessContext>('SELECT status, is_owner AS "isOwner" FROM users WHERE id = $1', [userId]);
  }

  async enabledModules(db: DbExecutor, tenantId: string): Promise<ModuleCode[]> {
    const rows = await db.query<{ module_code: ModuleCode }>(
      `WITH ${ENABLED_MODULES_CTE} SELECT module_code FROM enabled_modules`,
      [tenantId],
    );
    return rows.map((row) => row.module_code);
  }

  async effectivePermissions(db: DbExecutor, tenantId: string, userId: string, isOwner: boolean): Promise<string[]> {
    const rows = await db.query<{ code: string }>(
      `WITH ${ENABLED_MODULES_CTE},
       ceiling AS (
         SELECT p.id, p.code
           FROM tenant_permissions tp
           JOIN permissions p ON p.id = tp.permission_id
          WHERE tp.tenant_id = $1
            AND p.module_code IN (SELECT module_code FROM enabled_modules)
       ),
       granted AS (
         SELECT rp.permission_id
           FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
          WHERE ur.user_id = $2
         UNION
         SELECT up.permission_id FROM user_permissions up WHERE up.user_id = $2 AND up.effect = 'ALLOW'
       ),
       denied AS (
         SELECT up.permission_id FROM user_permissions up WHERE up.user_id = $2 AND up.effect = 'DENY'
       )
       SELECT c.code
         FROM ceiling c
        WHERE $3::boolean
           OR (c.id IN (SELECT permission_id FROM granted) AND c.id NOT IN (SELECT permission_id FROM denied))
        ORDER BY c.code`,
      [tenantId, userId, isOwner],
    );
    return rows.map((row) => row.code);
  }

  features(db: DbExecutor, tenantId: string): Promise<FeatureAccessRow[]> {
    return db.query<FeatureAccessRow>(
      `WITH ${ENABLED_MODULES_CTE}
       SELECT f.code,
              (f.module_code IN (SELECT module_code FROM enabled_modules)
                AND coalesce(tf.is_enabled, f.default_enabled)) AS enabled,
              coalesce(tf.limit_value, f.default_limit) AS "limit"
         FROM features f
         LEFT JOIN tenant_features tf ON tf.feature_code = f.code AND tf.tenant_id = $1`,
      [tenantId],
    );
  }

  ceiling(db: DbExecutor, tenantId: string): Promise<CeilingPermissionRow[]> {
    return db.query<CeilingPermissionRow>(
      `WITH ${ENABLED_MODULES_CTE}
       SELECT p.id AS "permissionId", p.code, p.module_code AS "moduleCode", m.name AS "moduleName", p.action
         FROM tenant_permissions tp
         JOIN permissions p ON p.id = tp.permission_id
         JOIN modules m ON m.code = p.module_code
        WHERE tp.tenant_id = $1
          AND p.module_code IN (SELECT module_code FROM enabled_modules)
        ORDER BY m.sort_order, p.action`,
      [tenantId],
    );
  }
}
