import { injectable } from 'inversify';
import { DbExecutor, buildSetClause, likePattern, pageOffset } from '@market-pro/core';
import {
  ModuleCode,
  PermissionAction,
  TenantFeatureConfig,
  TenantModuleConfig,
  TenantSettings,
  TenantStatus,
  TenantView,
} from '@market-pro/shared';

export interface TenantListFilter {
  search?: string;
  status?: TenantStatus;
  page: number;
  pageSize: number;
}

export interface NewTenant {
  slug: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  planName?: string | null;
  expiresAt?: string | null;
  settings?: Partial<TenantSettings>;
}

export interface TenantPatch {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  planName?: string | null;
  expiresAt?: string | null;
  status?: TenantStatus;
}

export interface ITenantRepository {
  list(db: DbExecutor, filter: TenantListFilter): Promise<{ items: TenantView[]; total: number }>;
  findById(db: DbExecutor, id: string): Promise<TenantView | null>;
  findBySlug(db: DbExecutor, slug: string): Promise<TenantView | null>;
  create(db: DbExecutor, data: NewTenant): Promise<TenantView>;
  update(db: DbExecutor, id: string, patch: TenantPatch): Promise<void>;
  mergeSettings(db: DbExecutor, id: string, settings: Partial<TenantSettings>): Promise<void>;
  getModules(db: DbExecutor, tenantId: string): Promise<TenantModuleConfig[]>;
  upsertModule(db: DbExecutor, tenantId: string, config: TenantModuleConfig): Promise<void>;
  getFeatures(db: DbExecutor, tenantId: string): Promise<TenantFeatureConfig[]>;
  upsertFeature(db: DbExecutor, tenantId: string, config: TenantFeatureConfig): Promise<void>;
  countUsers(db: DbExecutor, tenantId: string): Promise<number>;
}

const TENANT_COLUMNS = `
  t.id, t.slug, t.name, t.legal_name AS "legalName", t.tax_id AS "taxId",
  t.contact_email AS "contactEmail", t.contact_phone AS "contactPhone",
  t.status, t.plan_name AS "planName", t.settings, t.expires_at AS "expiresAt",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;

@injectable()
export class PgTenantRepository implements ITenantRepository {
  async list(db: DbExecutor, filter: TenantListFilter): Promise<{ items: TenantView[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.search) {
      params.push(likePattern(filter.search));
      where.push(`(t.name ILIKE $${params.length} OR t.slug ILIKE $${params.length} OR t.tax_id ILIKE $${params.length})`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`t.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await db.one<{ total: number }>(`SELECT count(*)::int AS total FROM tenants t ${whereSql}`, params);
    const items = await db.query<TenantView>(
      `SELECT ${TENANT_COLUMNS} FROM tenants t ${whereSql}
        ORDER BY t.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }

  findById(db: DbExecutor, id: string): Promise<TenantView | null> {
    return db.maybeOne<TenantView>(`SELECT ${TENANT_COLUMNS} FROM tenants t WHERE t.id = $1`, [id]);
  }

  findBySlug(db: DbExecutor, slug: string): Promise<TenantView | null> {
    return db.maybeOne<TenantView>(`SELECT ${TENANT_COLUMNS} FROM tenants t WHERE t.slug = lower($1)`, [slug]);
  }

  async create(db: DbExecutor, data: NewTenant): Promise<TenantView> {
    return db.one<TenantView>(
      `INSERT INTO tenants AS t (slug, name, legal_name, tax_id, contact_email, contact_phone, plan_name, expires_at, settings)
       VALUES (lower($1), $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING ${TENANT_COLUMNS}`,
      [
        data.slug,
        data.name,
        data.legalName ?? null,
        data.taxId ?? null,
        data.contactEmail ?? null,
        data.contactPhone ?? null,
        data.planName ?? null,
        data.expiresAt ?? null,
        JSON.stringify({
          currency: 'PEN',
          taxRate: 0.18,
          taxIncluded: true,
          timezone: 'America/Lima',
          receiptFooter: null,
          ...data.settings,
        }),
      ],
    );
  }

  async update(db: DbExecutor, id: string, patch: TenantPatch): Promise<void> {
    const set = buildSetClause({ ...patch }, {
      name: 'name',
      legalName: 'legal_name',
      taxId: 'tax_id',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      planName: 'plan_name',
      expiresAt: 'expires_at',
      status: 'status',
    }, 2);
    if (!set.sql) return;
    await db.execute(`UPDATE tenants SET ${set.sql} WHERE id = $1`, [id, ...set.values]);
  }

  async mergeSettings(db: DbExecutor, id: string, settings: Partial<TenantSettings>): Promise<void> {
    await db.execute('UPDATE tenants SET settings = settings || $2::jsonb WHERE id = $1', [id, JSON.stringify(settings)]);
  }

  getModules(db: DbExecutor, tenantId: string): Promise<TenantModuleConfig[]> {
    return db.query<TenantModuleConfig>(
      `SELECT tm.module_code AS "moduleCode", tm.is_enabled AS "isEnabled", tm.expires_at AS "expiresAt",
              coalesce(array_agg(p.action::text ORDER BY p.action) FILTER (WHERE tp.permission_id IS NOT NULL), '{}') AS actions
         FROM tenant_modules tm
         JOIN modules m ON m.code = tm.module_code
         LEFT JOIN permissions p ON p.module_code = tm.module_code
         LEFT JOIN tenant_permissions tp ON tp.permission_id = p.id AND tp.tenant_id = tm.tenant_id
        WHERE tm.tenant_id = $1
        GROUP BY tm.module_code, tm.is_enabled, tm.expires_at, m.sort_order
        ORDER BY m.sort_order`,
      [tenantId],
    );
  }

  async upsertModule(db: DbExecutor, tenantId: string, config: TenantModuleConfig): Promise<void> {
    await db.execute(
      `INSERT INTO tenant_modules (tenant_id, module_code, is_enabled, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, module_code)
       DO UPDATE SET is_enabled = EXCLUDED.is_enabled, expires_at = EXCLUDED.expires_at`,
      [tenantId, config.moduleCode, config.isEnabled, config.expiresAt],
    );
    await this.replaceModuleActions(db, tenantId, config.moduleCode, config.actions);
  }

  private async replaceModuleActions(
    db: DbExecutor,
    tenantId: string,
    moduleCode: ModuleCode,
    actions: PermissionAction[],
  ): Promise<void> {
    await db.execute(
      `DELETE FROM tenant_permissions tp
        USING permissions p
        WHERE tp.permission_id = p.id AND tp.tenant_id = $1 AND p.module_code = $2`,
      [tenantId, moduleCode],
    );
    if (actions.length === 0) return;
    await db.execute(
      `INSERT INTO tenant_permissions (tenant_id, permission_id)
       SELECT $1, p.id FROM permissions p
        WHERE p.module_code = $2 AND p.action = ANY($3::permission_action[])
       ON CONFLICT DO NOTHING`,
      [tenantId, moduleCode, actions],
    );
  }

  getFeatures(db: DbExecutor, tenantId: string): Promise<TenantFeatureConfig[]> {
    return db.query<TenantFeatureConfig>(
      `SELECT f.code AS "featureCode",
              coalesce(tf.is_enabled, f.default_enabled) AS "isEnabled",
              coalesce(tf.limit_value, f.default_limit) AS "limit"
         FROM features f
         LEFT JOIN tenant_features tf ON tf.feature_code = f.code AND tf.tenant_id = $1
        ORDER BY f.code`,
      [tenantId],
    );
  }

  async upsertFeature(db: DbExecutor, tenantId: string, config: TenantFeatureConfig): Promise<void> {
    await db.execute(
      `INSERT INTO tenant_features (tenant_id, feature_code, is_enabled, limit_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, feature_code)
       DO UPDATE SET is_enabled = EXCLUDED.is_enabled, limit_value = EXCLUDED.limit_value`,
      [tenantId, config.featureCode, config.isEnabled, config.limit],
    );
  }

  async countUsers(db: DbExecutor, tenantId: string): Promise<number> {
    const row = await db.one<{ total: number }>('SELECT count(*)::int AS total FROM users WHERE tenant_id = $1', [
      tenantId,
    ]);
    return row.total;
  }
}
