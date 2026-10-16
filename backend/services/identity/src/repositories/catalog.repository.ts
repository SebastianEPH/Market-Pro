import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { FeatureView, ModuleCode, ModuleView, PermissionView } from '@market-pro/shared';

/** Catálogo global: módulos, permisos y features (sin RLS). */
export interface ICatalogRepository {
  listModules(db: DbExecutor): Promise<ModuleView[]>;
  listActiveModuleCodes(db: DbExecutor): Promise<ModuleCode[]>;
  listPermissions(db: DbExecutor): Promise<PermissionView[]>;
  listFeatures(db: DbExecutor): Promise<FeatureView[]>;
  setModuleActive(db: DbExecutor, code: ModuleCode, isActive: boolean): Promise<boolean>;
}

@injectable()
export class PgCatalogRepository implements ICatalogRepository {
  async listModules(db: DbExecutor): Promise<ModuleView[]> {
    return db.query<ModuleView>(
      `SELECT m.code, m.name, m.description, m.icon,
              m.sort_order AS "sortOrder", m.is_active AS "isActive",
              coalesce((
                SELECT json_agg(json_build_object(
                         'id', p.id, 'code', p.code, 'moduleCode', p.module_code,
                         'action', p.action, 'description', p.description) ORDER BY p.action)
                FROM permissions p WHERE p.module_code = m.code), '[]') AS permissions,
              coalesce((
                SELECT json_agg(json_build_object(
                         'code', f.code, 'moduleCode', f.module_code, 'name', f.name,
                         'description', f.description, 'valueType', f.value_type,
                         'defaultEnabled', f.default_enabled, 'defaultLimit', f.default_limit) ORDER BY f.code)
                FROM features f WHERE f.module_code = m.code), '[]') AS features
         FROM modules m
        ORDER BY m.sort_order, m.code`,
    );
  }

  async listActiveModuleCodes(db: DbExecutor): Promise<ModuleCode[]> {
    const rows = await db.query<{ code: ModuleCode }>(
      'SELECT code FROM modules WHERE is_active ORDER BY sort_order',
    );
    return rows.map((row) => row.code);
  }

  async listPermissions(db: DbExecutor): Promise<PermissionView[]> {
    return db.query<PermissionView>(
      `SELECT id, code, module_code AS "moduleCode", action, description
         FROM permissions ORDER BY module_code, action`,
    );
  }

  async listFeatures(db: DbExecutor): Promise<FeatureView[]> {
    return db.query<FeatureView>(
      `SELECT code, module_code AS "moduleCode", name, description, value_type AS "valueType",
              default_enabled AS "defaultEnabled", default_limit AS "defaultLimit"
         FROM features ORDER BY code`,
    );
  }

  async setModuleActive(db: DbExecutor, code: ModuleCode, isActive: boolean): Promise<boolean> {
    const affected = await db.execute('UPDATE modules SET is_active = $2, updated_at = now() WHERE code = $1', [
      code,
      isActive,
    ]);
    return affected > 0;
  }
}
