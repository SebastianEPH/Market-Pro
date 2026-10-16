import { inject, injectable } from 'inversify';
import {
  ApiRequest,
  ApiResponse,
  Body,
  Controller,
  Get,
  HttpResult,
  Patch,
  Post,
  Put,
  Query,
  RouteScope,
} from '@market-pro/core';
import { IdentityToken } from '../identity-token.enum.js';
import {
  CreateTenantDto,
  ResetPasswordDto,
  TenantFeaturesDto,
  TenantListQuery,
  TenantModulesDto,
  TenantStatusDto,
  UpdateTenantDto,
  createTenantSchema,
  resetPasswordSchema,
  tenantFeaturesSchema,
  tenantListQuerySchema,
  tenantModulesSchema,
  tenantStatusSchema,
  updateTenantSchema,
} from '../schemas/identity.schemas.js';
import { TenantService } from '../services/tenant.service.js';

/** Administración de tiendas (compradores). Solo administrador de plataforma. */
@injectable()
@Controller('/platform/tenants', RouteScope.PLATFORM)
export class PlatformTenantsController {
  constructor(@inject(IdentityToken.TenantService) private readonly tenants: TenantService) {}

  @Get()
  @Query(tenantListQuerySchema)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.list(request.getQuery<TenantListQuery>()));
  }

  /** Crea la instancia del comprador con su usuario administrador, módulos y features. */
  @Post()
  @Body(createTenantSchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(await this.tenants.create(request.getBody<CreateTenantDto>()));
  }

  @Get('/{id}')
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.get(request.param('id')));
  }

  @Patch('/{id}')
  @Body(updateTenantSchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.update(request.param('id'), request.getBody<UpdateTenantDto>()));
  }

  /** Suspender / reactivar / cancelar la tienda (efecto inmediato). */
  @Patch('/{id}/status')
  @Body(tenantStatusSchema)
  async setStatus(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.setStatus(request.param('id'), request.getBody<TenantStatusDto>().status));
  }

  /** Habilita módulos y define qué acciones CRUD puede usar la tienda (techo). */
  @Put('/{id}/modules')
  @Body(tenantModulesSchema)
  async setModules(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.tenants.setModules(request.param('id'), request.getBody<TenantModulesDto>().modules));
  }

  @Put('/{id}/features')
  @Body(tenantFeaturesSchema)
  async setFeatures(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.tenants.setFeatures(request.param('id'), request.getBody<TenantFeaturesDto>().features),
    );
  }

  @Post('/{id}/owner/reset-password')
  @Body(resetPasswordSchema)
  async resetOwnerPassword(request: ApiRequest): Promise<HttpResult> {
    await this.tenants.resetOwnerPassword(request.param('id'), request.getBody<ResetPasswordDto>().password);
    return ApiResponse.noContent();
  }
}
