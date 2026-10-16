import { inject, injectable } from 'inversify';
import {
  ApiRequest,
  ApiResponse,
  Body,
  Controller,
  Delete,
  Get,
  HttpResult,
  Patch,
  Permission,
  Post,
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { RoleDto, UpdateRoleDto, createRoleSchema, updateRoleSchema } from '../schemas/identity.schemas.js';
import { RoleService } from '../services/role.service.js';

@injectable()
@Controller('/roles', RouteScope.TENANT)
export class RolesController {
  constructor(@inject(IdentityToken.RoleService) private readonly roles: RoleService) {}

  @Get()
  @Permission(ModuleCode.ROLES, PermissionAction.READ)
  @Permission(ModuleCode.USERS, PermissionAction.READ)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.roles.list(request.tenantId));
  }

  /** Permisos que la tienda puede repartir (techo definido por la plataforma). */
  @Get('/available-permissions')
  @Permission(ModuleCode.ROLES, PermissionAction.READ)
  @Permission(ModuleCode.USERS, PermissionAction.READ)
  async available(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.roles.available(request.tenantId));
  }

  @Post()
  @Permission(ModuleCode.ROLES, PermissionAction.CREATE)
  @Body(createRoleSchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(await this.roles.create(request.requireAccess(), request.getBody<RoleDto>()));
  }

  @Get('/{id}')
  @Permission(ModuleCode.ROLES, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.roles.get(request.tenantId, request.param('id')));
  }

  @Patch('/{id}')
  @Permission(ModuleCode.ROLES, PermissionAction.UPDATE)
  @Body(updateRoleSchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.roles.update(request.requireAccess(), request.param('id'), request.getBody<UpdateRoleDto>()),
    );
  }

  @Delete('/{id}')
  @Permission(ModuleCode.ROLES, PermissionAction.DELETE)
  async remove(request: ApiRequest): Promise<HttpResult> {
    await this.roles.remove(request.tenantId, request.param('id'));
    return ApiResponse.noContent();
  }
}
