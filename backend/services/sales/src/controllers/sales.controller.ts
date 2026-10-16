import { inject, injectable } from 'inversify';
import {
  ApiRequest,
  ApiResponse,
  Body,
  Controller,
  Get,
  HttpResult,
  Permission,
  Post,
  Query,
  RequireFeature,
  RouteScope,
} from '@market-pro/core';
import { FeatureCode, ModuleCode, PermissionAction } from '@market-pro/shared';
import { SalesToken } from '../sales-token.enum.js';
import { CreateSaleDto, SaleListQuery, VoidSaleDto, createSaleSchema, saleListQuerySchema, voidSaleSchema } from '../schemas/sales.schemas.js';
import { SaleContext, SaleService } from '../services/sale.service.js';

function saleContext(request: ApiRequest): SaleContext {
  return { principal: request.requirePrincipal(), access: request.requireAccess(), requestId: request.requestId };
}

@injectable()
@Controller('/sales', RouteScope.TENANT)
export class SalesController {
  constructor(@inject(SalesToken.SaleService) private readonly sales: SaleService) {}

  /** Registrar venta desde el POS. */
  @Post()
  @Permission(ModuleCode.POS, PermissionAction.CREATE)
  @Body(createSaleSchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(await this.sales.create(saleContext(request), request.getBody<CreateSaleDto>()));
  }

  /** Con sales:read ve todas; con pos:read solo las propias. */
  @Get()
  @Permission(ModuleCode.SALES, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  @Query(saleListQuerySchema)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.sales.list(saleContext(request), request.getQuery<SaleListQuery>()));
  }

  @Get('/{id}')
  @Permission(ModuleCode.SALES, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.sales.get(saleContext(request), request.param('id')));
  }

  @Post('/{id}/void')
  @Permission(ModuleCode.SALES, PermissionAction.DELETE)
  @RequireFeature(FeatureCode.SALES_VOID)
  @Body(voidSaleSchema)
  async void(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.sales.void(saleContext(request), request.param('id'), request.getBody<VoidSaleDto>().reason),
    );
  }
}
