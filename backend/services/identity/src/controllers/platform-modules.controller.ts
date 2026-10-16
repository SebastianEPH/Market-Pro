import { inject, injectable } from 'inversify';
import { ApiRequest, ApiResponse, Body, Controller, Get, HttpResult, Patch, RouteScope } from '@market-pro/core';
import { ModuleCode } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { ModuleActiveDto, moduleActiveSchema } from '../schemas/identity.schemas.js';
import { ModuleService } from '../services/module.service.js';

/** Catálogo global de módulos con sus permisos y features. */
@injectable()
@Controller('/platform/modules', RouteScope.PLATFORM)
export class PlatformModulesController {
  constructor(@inject(IdentityToken.ModuleService) private readonly modules: ModuleService) {}

  @Get()
  async list(): Promise<HttpResult> {
    return ApiResponse.ok(await this.modules.list());
  }

  @Patch('/{code}')
  @Body(moduleActiveSchema)
  async setActive(request: ApiRequest): Promise<HttpResult> {
    const code = request.param('code') as ModuleCode;
    return ApiResponse.ok(await this.modules.setActive(code, request.getBody<ModuleActiveDto>().isActive));
  }
}
