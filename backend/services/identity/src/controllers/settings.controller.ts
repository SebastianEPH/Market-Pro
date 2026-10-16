import { inject, injectable } from 'inversify';
import {
  ApiRequest,
  ApiResponse,
  Body,
  Controller,
  Get,
  HttpResult,
  Permission,
  Put,
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { UpdateSettingsDto, updateSettingsSchema } from '../schemas/identity.schemas.js';
import { TenantService } from '../services/tenant.service.js';

/** Configuración propia de la tienda (moneda, impuestos, pie de ticket). */
@injectable()
@Controller('/settings', RouteScope.TENANT)
export class SettingsController {
  constructor(@inject(IdentityToken.TenantService) private readonly tenants: TenantService) {}

  @Get()
  @Permission(ModuleCode.SETTINGS, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.getSettings(request.tenantId));
  }

  @Put()
  @Permission(ModuleCode.SETTINGS, PermissionAction.UPDATE)
  @Body(updateSettingsSchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.updateSettings(request.tenantId, request.getBody<UpdateSettingsDto>()));
  }
}
