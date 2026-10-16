import { inject, injectable } from 'inversify';
import { CoreToken, Database, DbExecutor, ForbiddenError, NotFoundError } from '@market-pro/core';
import { AccessProfile, AvailableModulePermissions, RoleView } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { IRoleRepository } from '../repositories/role.repository.js';
import { RoleDto, UpdateRoleDto } from '../schemas/identity.schemas.js';
import { AccessService } from './access.service.js';

/** Roles de una tienda. Sus permisos nunca superan el techo del tenant. */
@injectable()
export class RoleService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(IdentityToken.RoleRepository) private readonly roles: IRoleRepository,
    @inject(IdentityToken.AccessService) private readonly accessService: AccessService,
  ) {}

  list(tenantId: string): Promise<RoleView[]> {
    return this.db.withTenant(tenantId, (tx) => this.roles.list(tx));
  }

  async get(tenantId: string, id: string): Promise<RoleView> {
    const role = await this.db.withTenant(tenantId, (tx) => this.roles.get(tx, id));
    if (!role) throw new NotFoundError('Rol');
    return role;
  }

  available(tenantId: string): Promise<AvailableModulePermissions[]> {
    return this.accessService.availablePermissions(tenantId);
  }

  async create(actor: AccessProfile, dto: RoleDto): Promise<RoleView> {
    const tenantId = this.tenantOf(actor);
    this.accessService.assertCanDelegate(actor, dto.permissions);
    const id = await this.db.withTenant(tenantId, async (tx) => {
      const roleId = await this.roles.create(tx, tenantId, dto.name, dto.description ?? null);
      await this.applyPermissions(tx, tenantId, roleId, dto.permissions);
      return roleId;
    });
    return this.get(tenantId, id);
  }

  async update(actor: AccessProfile, id: string, dto: UpdateRoleDto): Promise<RoleView> {
    const tenantId = this.tenantOf(actor);
    if (dto.permissions) this.accessService.assertCanDelegate(actor, dto.permissions);
    await this.db.withTenant(tenantId, async (tx) => {
      const role = await this.roles.get(tx, id);
      if (!role) throw new NotFoundError('Rol');
      if (role.isSystem) throw new ForbiddenError(undefined, 'Los roles del sistema no se pueden modificar');
      await this.roles.update(tx, id, dto.name, dto.description);
      if (dto.permissions) await this.applyPermissions(tx, tenantId, id, dto.permissions);
    });
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const deleted = await this.db.withTenant(tenantId, (tx) => this.roles.delete(tx, id));
    if (!deleted) throw new NotFoundError('Rol (o es un rol del sistema)');
  }

  private async applyPermissions(tx: DbExecutor, tenantId: string, roleId: string, codes: string[]): Promise<void> {
    const unique = [...new Set(codes)];
    const ids = await this.accessService.ceilingIds(tx, tenantId, unique);
    await this.roles.replacePermissions(
      tx,
      tenantId,
      roleId,
      unique.map((code) => ids.get(code) as string),
    );
  }

  private tenantOf(actor: AccessProfile): string {
    if (!actor.tenantId) throw new ForbiddenError();
    return actor.tenantId;
  }
}
