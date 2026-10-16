import { inject, injectable } from 'inversify';
import { CoreToken, Database, DbExecutor, NotFoundError } from '@market-pro/core';
import {
  ModuleCode,
  PaginatedResult,
  PermissionAction,
  TenantDetailView,
  TenantSettings,
  TenantStatus,
  TenantView,
  permissionCode,
} from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { ICatalogRepository } from '../repositories/catalog.repository.js';
import { IRoleRepository } from '../repositories/role.repository.js';
import { ITenantRepository } from '../repositories/tenant.repository.js';
import { IUserRepository } from '../repositories/user.repository.js';
import {
  CreateTenantDto,
  FeatureConfigDto,
  ModuleConfigDto,
  TenantListQuery,
  UpdateSettingsDto,
  UpdateTenantDto,
} from '../schemas/identity.schemas.js';
import { IPasswordHasher } from '../security/password-hasher.js';

/** Rol que se crea por defecto en cada tienda nueva (editable por el dueño). */
const DEFAULT_CASHIER_ROLE = {
  name: 'Cajero',
  description: 'Vende en el POS y maneja su caja',
  permissions: [
    permissionCode(ModuleCode.POS, PermissionAction.CREATE),
    permissionCode(ModuleCode.POS, PermissionAction.READ),
    permissionCode(ModuleCode.CASH_REGISTER, PermissionAction.CREATE),
    permissionCode(ModuleCode.CASH_REGISTER, PermissionAction.READ),
    permissionCode(ModuleCode.CASH_REGISTER, PermissionAction.UPDATE),
    permissionCode(ModuleCode.PRODUCTS, PermissionAction.READ),
    permissionCode(ModuleCode.CATEGORIES, PermissionAction.READ),
  ],
};

export interface TenantSettingsView {
  name: string;
  settings: TenantSettings;
}

/** Gestión de tenants (compradores). Usado por el administrador de plataforma. */
@injectable()
export class TenantService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(IdentityToken.TenantRepository) private readonly tenants: ITenantRepository,
    @inject(IdentityToken.UserRepository) private readonly users: IUserRepository,
    @inject(IdentityToken.RoleRepository) private readonly roles: IRoleRepository,
    @inject(IdentityToken.CatalogRepository) private readonly catalog: ICatalogRepository,
    @inject(IdentityToken.PasswordHasher) private readonly hasher: IPasswordHasher,
  ) {}

  async list(query: TenantListQuery): Promise<PaginatedResult<TenantView>> {
    const result = await this.db.withPlatform((tx) => this.tenants.list(tx, query));
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<TenantDetailView> {
    return this.db.withPlatform(async (tx) => {
      const tenant = await this.tenants.findById(tx, id);
      if (!tenant) throw new NotFoundError('Tienda');
      return {
        ...tenant,
        modules: await this.tenants.getModules(tx, id),
        features: await this.tenants.getFeatures(tx, id),
        owner: await this.users.findOwnerView(tx, id),
        userCount: await this.tenants.countUsers(tx, id),
      };
    });
  }

  async create(dto: CreateTenantDto): Promise<TenantDetailView> {
    const passwordHash = await this.hasher.hash(dto.owner.password);

    const tenantId = await this.db.withPlatform(async (tx) => {
      const tenant = await this.tenants.create(tx, dto);

      // Sin configuración explícita: todos los módulos activos con CRUD completo
      const modules =
        dto.modules ??
        (await this.catalog.listActiveModuleCodes(tx)).map<ModuleConfigDto>((moduleCode) => ({
          moduleCode,
          isEnabled: true,
          actions: Object.values(PermissionAction),
          expiresAt: null,
        }));
      await this.applyModules(tx, tenant.id, modules);
      if (dto.features) await this.applyFeatures(tx, tenant.id, dto.features);

      await this.users.create(tx, {
        tenantId: tenant.id,
        email: dto.owner.email,
        fullName: dto.owner.fullName,
        passwordHash,
        isOwner: true,
      });

      await this.createDefaultRole(tx, tenant.id);
      return tenant.id;
    });

    return this.get(tenantId);
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantDetailView> {
    await this.db.withPlatform(async (tx) => {
      await this.ensureExists(tx, id);
      const { settings, ...patch } = dto;
      await this.tenants.update(tx, id, patch);
      if (settings) await this.tenants.mergeSettings(tx, id, settings);
    });
    return this.get(id);
  }

  async setStatus(id: string, status: TenantStatus): Promise<TenantDetailView> {
    await this.db.withPlatform(async (tx) => {
      await this.ensureExists(tx, id);
      await this.tenants.update(tx, id, { status });
    });
    return this.get(id);
  }

  async setModules(id: string, modules: ModuleConfigDto[]): Promise<TenantDetailView> {
    await this.db.withPlatform(async (tx) => {
      await this.ensureExists(tx, id);
      await this.applyModules(tx, id, modules);
    });
    return this.get(id);
  }

  async setFeatures(id: string, features: FeatureConfigDto[]): Promise<TenantDetailView> {
    await this.db.withPlatform(async (tx) => {
      await this.ensureExists(tx, id);
      await this.applyFeatures(tx, id, features);
    });
    return this.get(id);
  }

  async resetOwnerPassword(id: string, password: string): Promise<void> {
    const passwordHash = await this.hasher.hash(password);
    await this.db.withPlatform(async (tx) => {
      const owner = await this.users.findOwnerView(tx, id);
      if (!owner) throw new NotFoundError('Dueño de la tienda');
      await this.users.update(tx, owner.id, { passwordHash });
    });
  }

  // ------------------------------------------------------- configuración del tenant

  async getSettings(tenantId: string): Promise<TenantSettingsView> {
    const tenant = await this.db.withGlobal((tx) => this.tenants.findById(tx, tenantId));
    if (!tenant) throw new NotFoundError('Tienda');
    return { name: tenant.name, settings: tenant.settings };
  }

  async updateSettings(tenantId: string, dto: UpdateSettingsDto): Promise<TenantSettingsView> {
    await this.db.withGlobal((tx) => this.tenants.mergeSettings(tx, tenantId, dto));
    return this.getSettings(tenantId);
  }

  // ------------------------------------------------------- privados

  private async ensureExists(tx: DbExecutor, id: string): Promise<void> {
    if (!(await this.tenants.findById(tx, id))) throw new NotFoundError('Tienda');
  }

  private async applyModules(tx: DbExecutor, tenantId: string, modules: ModuleConfigDto[]): Promise<void> {
    for (const config of modules) {
      await this.tenants.upsertModule(tx, tenantId, {
        moduleCode: config.moduleCode,
        isEnabled: config.isEnabled,
        expiresAt: config.expiresAt ?? null,
        actions: [...new Set(config.actions)],
      });
    }
  }

  private async applyFeatures(tx: DbExecutor, tenantId: string, features: FeatureConfigDto[]): Promise<void> {
    for (const feature of features) {
      await this.tenants.upsertFeature(tx, tenantId, {
        featureCode: feature.featureCode,
        isEnabled: feature.isEnabled,
        limit: feature.limit ?? null,
      });
    }
  }

  private async createDefaultRole(tx: DbExecutor, tenantId: string): Promise<void> {
    const roleId = await this.roles.create(tx, tenantId, DEFAULT_CASHIER_ROLE.name, DEFAULT_CASHIER_ROLE.description);
    const permissions = await this.catalog.listPermissions(tx);
    const ids = permissions.filter((p) => DEFAULT_CASHIER_ROLE.permissions.includes(p.code)).map((p) => p.id);
    await this.roles.replacePermissions(tx, tenantId, roleId, ids);
  }
}
