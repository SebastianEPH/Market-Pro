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
  Put,
  Query,
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQuery,
  UserPermissionsDto,
  UserRolesDto,
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
  userPermissionsSchema,
  userRolesSchema,
} from '../schemas/identity.schemas.js';
import { UserService } from '../services/user.service.js';

@injectable()
@Controller('/users', RouteScope.TENANT)
export class UsersController {
  constructor(@inject(IdentityToken.UserService) private readonly users: UserService) {}

  @Get()
  @Permission(ModuleCode.USERS, PermissionAction.READ)
  @Query(userListQuerySchema)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.users.list(request.tenantId, request.getQuery<UserListQuery>()));
  }

  @Post()
  @Permission(ModuleCode.USERS, PermissionAction.CREATE)
  @Body(createUserSchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(await this.users.create(request.requireAccess(), request.getBody<CreateUserDto>()));
  }

  @Get('/{id}')
  @Permission(ModuleCode.USERS, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.users.get(request.tenantId, request.param('id')));
  }

  @Patch('/{id}')
  @Permission(ModuleCode.USERS, PermissionAction.UPDATE)
  @Body(updateUserSchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.users.update(request.requireAccess(), request.param('id'), request.getBody<UpdateUserDto>()),
    );
  }

  @Delete('/{id}')
  @Permission(ModuleCode.USERS, PermissionAction.DELETE)
  async remove(request: ApiRequest): Promise<HttpResult> {
    await this.users.remove(request.requireAccess(), request.param('id'));
    return ApiResponse.noContent();
  }

  @Put('/{id}/roles')
  @Permission(ModuleCode.USERS, PermissionAction.UPDATE)
  @Body(userRolesSchema)
  async setRoles(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.users.setRoles(request.requireAccess(), request.param('id'), request.getBody<UserRolesDto>().roleIds),
    );
  }

  /** Permisos directos (ALLOW / DENY) que se suman o restan a los de sus roles. */
  @Put('/{id}/permissions')
  @Permission(ModuleCode.USERS, PermissionAction.UPDATE)
  @Body(userPermissionsSchema)
  async setPermissions(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.users.setPermissions(request.requireAccess(), request.param('id'), request.getBody<UserPermissionsDto>()),
    );
  }

  /** Permisos efectivos del usuario (para previsualizar en el backoffice). */
  @Get('/{id}/access')
  @Permission(ModuleCode.USERS, PermissionAction.READ)
  async access(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.users.getAccess(request.tenantId, request.param('id')));
  }
}
