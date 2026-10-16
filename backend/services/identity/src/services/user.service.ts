import { inject, injectable } from 'inversify';
import {
  BadRequestError,
  ConflictError,
  CoreToken,
  Database,
  DbExecutor,
  ForbiddenError,
  NotFoundError,
} from '@market-pro/core';
import {
  AccessProfile,
  ErrorCode,
  FeatureCode,
  PaginatedResult,
  PermissionEffect,
  UserDetailView,
  UserStatus,
  UserView,
  getFeature,
} from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { IRoleRepository } from '../repositories/role.repository.js';
import { IUserRepository } from '../repositories/user.repository.js';
import { CreateUserDto, UpdateUserDto, UserListQuery, UserPermissionsDto } from '../schemas/identity.schemas.js';
import { IPasswordHasher } from '../security/password-hasher.js';
import { AccessService } from './access.service.js';

/** Usuarios de una tienda, gestionados por su administrador (comprador). */
@injectable()
export class UserService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(IdentityToken.UserRepository) private readonly users: IUserRepository,
    @inject(IdentityToken.RoleRepository) private readonly roles: IRoleRepository,
    @inject(IdentityToken.PasswordHasher) private readonly hasher: IPasswordHasher,
    @inject(IdentityToken.AccessService) private readonly accessService: AccessService,
  ) {}

  async list(tenantId: string, query: UserListQuery): Promise<PaginatedResult<UserView>> {
    const result = await this.db.withTenant(tenantId, (tx) => this.users.list(tx, query));
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(tenantId: string, id: string): Promise<UserDetailView> {
    return this.db.withTenant(tenantId, async (tx) => {
      const user = await this.users.getView(tx, id);
      if (!user) throw new NotFoundError('Usuario');
      return { ...user, permissionOverrides: await this.users.getOverrides(tx, id) };
    });
  }

  async create(actor: AccessProfile, dto: CreateUserDto): Promise<UserDetailView> {
    const tenantId = this.tenantOf(actor);
    const passwordHash = await this.hasher.hash(dto.password);

    const id = await this.db.withTenant(tenantId, async (tx) => {
      const limit = getFeature(actor, FeatureCode.USERS_MAX);
      if (limit.enabled && limit.limit !== null && (await this.users.countActive(tx)) >= limit.limit) {
        throw new ConflictError(`Tu plan permite como máximo ${limit.limit} usuarios activos`, ErrorCode.LIMIT_REACHED);
      }
      const userId = await this.users.create(tx, {
        tenantId,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        documentNumber: dto.documentNumber,
        phone: dto.phone,
      });
      if (dto.roleIds?.length) {
        await this.assertRolesDelegable(tx, actor, dto.roleIds);
        await this.users.replaceRoles(tx, tenantId, userId, dto.roleIds);
      }
      return userId;
    });
    return this.get(tenantId, id);
  }

  async update(actor: AccessProfile, id: string, dto: UpdateUserDto): Promise<UserDetailView> {
    const tenantId = this.tenantOf(actor);
    const passwordHash = dto.password ? await this.hasher.hash(dto.password) : undefined;

    await this.db.withTenant(tenantId, async (tx) => {
      const user = await this.users.findById(tx, id);
      if (!user) throw new NotFoundError('Usuario');
      if (user.isOwner && !actor.isOwner) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Solo el dueño puede modificar su propia cuenta');
      }
      if (user.isOwner && dto.status && dto.status !== UserStatus.ACTIVE) {
        throw new BadRequestError('No se puede desactivar al dueño de la tienda');
      }
      if (id === actor.subjectId && dto.status && dto.status !== UserStatus.ACTIVE) {
        throw new BadRequestError('No puedes desactivarte a ti mismo');
      }
      const { password: _password, ...patch } = dto;
      await this.users.update(tx, id, { ...patch, passwordHash });
    });
    return this.get(tenantId, id);
  }

  async remove(actor: AccessProfile, id: string): Promise<void> {
    const tenantId = this.tenantOf(actor);
    if (id === actor.subjectId) throw new BadRequestError('No puedes eliminar tu propio usuario');
    const deleted = await this.db.withTenant(tenantId, (tx) => this.users.delete(tx, id));
    if (!deleted) throw new NotFoundError('Usuario (o es el dueño de la tienda)');
  }

  async setRoles(actor: AccessProfile, id: string, roleIds: string[]): Promise<UserDetailView> {
    const tenantId = this.tenantOf(actor);
    await this.db.withTenant(tenantId, async (tx) => {
      const user = await this.users.findById(tx, id);
      if (!user) throw new NotFoundError('Usuario');
      const unique = [...new Set(roleIds)];
      if ((await this.roles.countExisting(tx, unique)) !== unique.length) {
        throw new BadRequestError('Uno o más roles no existen');
      }
      await this.assertRolesDelegable(tx, actor, unique);
      await this.users.replaceRoles(tx, tenantId, id, unique);
    });
    return this.get(tenantId, id);
  }

  async setPermissions(actor: AccessProfile, id: string, dto: UserPermissionsDto): Promise<UserDetailView> {
    const tenantId = this.tenantOf(actor);
    const allowCodes = dto.overrides.filter((o) => o.effect === PermissionEffect.ALLOW).map((o) => o.code);
    this.accessService.assertCanDelegate(actor, allowCodes);

    await this.db.withTenant(tenantId, async (tx) => {
      const user = await this.users.findById(tx, id);
      if (!user) throw new NotFoundError('Usuario');
      const ids = await this.accessService.ceilingIds(
        tx,
        tenantId,
        dto.overrides.map((o) => o.code),
      );
      await this.users.replaceOverrides(
        tx,
        tenantId,
        id,
        dto.overrides.map((o) => ({ permissionId: ids.get(o.code) as string, effect: o.effect })),
      );
    });
    return this.get(tenantId, id);
  }

  async getAccess(tenantId: string, id: string): Promise<AccessProfile> {
    return this.accessService.resolveTenant(tenantId, id);
  }

  private tenantOf(actor: AccessProfile): string {
    if (!actor.tenantId) throw new ForbiddenError();
    return actor.tenantId;
  }

  private async assertRolesDelegable(tx: DbExecutor, actor: AccessProfile, roleIds: string[]): Promise<void> {
    if (actor.isOwner) return;
    const codes = await this.roles.permissionCodesOf(tx, roleIds);
    this.accessService.assertCanDelegate(actor, codes);
  }
}
