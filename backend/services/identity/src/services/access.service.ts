import { inject, injectable } from 'inversify';
import {
  BadRequestError,
  CoreToken,
  Database,
  DbExecutor,
  ForbiddenError,
  IAccessResolver,
  Principal,
  UnauthorizedError,
} from '@market-pro/core';
import {
  AccessProfile,
  AuthScope,
  AvailableModulePermissions,
  ErrorCode,
  FeatureState,
  ModuleCode,
  PermissionWildcard,
  TenantStatus,
  UserStatus,
} from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { CeilingPermissionRow, IAccessRepository } from '../repositories/access.repository.js';
import { ICatalogRepository } from '../repositories/catalog.repository.js';
import { IPlatformUserRepository } from '../repositories/platform-user.repository.js';

/**
 * Motor de permisos. Implementa IAccessResolver: dentro de identity se
 * registra como CoreToken.AccessResolver (consulta directa a la BD, sin caché),
 * y el resto de microservicios lo consume vía /internal/access/resolve.
 */
@injectable()
export class AccessService implements IAccessResolver {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(IdentityToken.AccessRepository) private readonly access: IAccessRepository,
    @inject(IdentityToken.PlatformUserRepository) private readonly platformUsers: IPlatformUserRepository,
    @inject(IdentityToken.CatalogRepository) private readonly catalog: ICatalogRepository,
  ) {}

  resolve(principal: Principal): Promise<AccessProfile> {
    return this.resolveSubject(principal.scope, principal.subjectId, principal.tenantId);
  }

  resolveSubject(scope: AuthScope, subjectId: string, tenantId: string | null): Promise<AccessProfile> {
    if (scope === AuthScope.PLATFORM) return this.resolvePlatform(subjectId);
    if (!tenantId) throw new UnauthorizedError();
    return this.resolveTenant(tenantId, subjectId);
  }

  async resolvePlatform(subjectId: string): Promise<AccessProfile> {
    return this.db.withGlobal(async (tx) => {
      const user = await this.platformUsers.findById(tx, subjectId);
      if (!user) throw new UnauthorizedError();
      const modules = await this.catalog.listActiveModuleCodes(tx);
      return {
        scope: AuthScope.PLATFORM,
        subjectId,
        tenantId: null,
        tenantStatus: null,
        isActive: user.status === UserStatus.ACTIVE,
        isOwner: false,
        enabledModules: modules,
        modules,
        permissions: [PermissionWildcard.ALL],
        features: {},
        settings: null,
        resolvedAt: new Date().toISOString(),
      };
    });
  }

  async resolveTenant(tenantId: string, userId: string): Promise<AccessProfile> {
    return this.db.withTenant(tenantId, async (tx) => {
      const tenant = await this.access.tenantContext(tx, tenantId);
      const user = await this.access.userContext(tx, userId);
      if (!tenant || !user) throw new UnauthorizedError();

      const expired = tenant.expiresAt !== null && new Date(tenant.expiresAt).getTime() <= Date.now();
      const tenantStatus = expired ? TenantStatus.SUSPENDED : tenant.status;

      const enabledModules = await this.access.enabledModules(tx, tenantId);
      const permissions = await this.access.effectivePermissions(tx, tenantId, userId, user.isOwner);
      const featureRows = await this.access.features(tx, tenantId);

      const features: Record<string, FeatureState> = {};
      for (const row of featureRows) features[row.code] = { enabled: row.enabled, limit: row.limit };

      const modules = [...new Set(permissions.map((code) => code.split(':')[0] as ModuleCode))];

      return {
        scope: AuthScope.TENANT,
        subjectId: userId,
        tenantId,
        tenantStatus,
        isActive: user.status === UserStatus.ACTIVE,
        isOwner: user.isOwner,
        enabledModules,
        modules,
        permissions,
        features,
        settings: tenant.settings,
        resolvedAt: new Date().toISOString(),
      };
    });
  }

  /** Permisos que el tenant puede repartir (su techo), agrupados por módulo. */
  async availablePermissions(tenantId: string): Promise<AvailableModulePermissions[]> {
    const rows = await this.db.withTenant(tenantId, (tx) => this.access.ceiling(tx, tenantId));
    const grouped = new Map<ModuleCode, AvailableModulePermissions>();
    for (const row of rows) {
      const entry = grouped.get(row.moduleCode) ?? { moduleCode: row.moduleCode, moduleName: row.moduleName, actions: [] };
      entry.actions.push(row.action);
      grouped.set(row.moduleCode, entry);
    }
    return [...grouped.values()];
  }

  /**
   * Traduce códigos a IDs validando que estén dentro del techo del tenant.
   * Debe llamarse dentro de una transacción withTenant.
   */
  async ceilingIds(tx: DbExecutor, tenantId: string, codes: string[]): Promise<Map<string, string>> {
    const ceiling: CeilingPermissionRow[] = await this.access.ceiling(tx, tenantId);
    const byCode = new Map(ceiling.map((row) => [row.code, row.permissionId]));
    const invalid = codes.filter((code) => !byCode.has(code));
    if (invalid.length > 0) {
      throw new BadRequestError('Hay permisos que no están habilitados para la tienda', { invalid });
    }
    return byCode;
  }

  /**
   * Evita escalamiento de privilegios: un usuario que no es dueño solo puede
   * otorgar permisos que él mismo tiene.
   */
  assertCanDelegate(actor: AccessProfile, codes: string[]): void {
    if (actor.isOwner || actor.permissions.includes(PermissionWildcard.ALL)) return;
    const missing = codes.filter((code) => !actor.permissions.includes(code));
    if (missing.length > 0) {
      throw new ForbiddenError(ErrorCode.PERMISSION_DENIED, 'No puedes otorgar permisos que no tienes', { missing });
    }
  }
}
