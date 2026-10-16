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
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { CatalogToken } from '../catalog-token.enum.js';
import {
  MovementListQuery,
  StockAdjustmentDto,
  movementListQuerySchema,
  stockAdjustmentSchema,
} from '../schemas/catalog.schemas.js';
import { InventoryService } from '../services/inventory.service.js';

@injectable()
@Controller('/inventory', RouteScope.TENANT)
export class InventoryController {
  constructor(@inject(CatalogToken.InventoryService) private readonly inventory: InventoryService) {}

  @Get('/movements')
  @Permission(ModuleCode.INVENTORY, PermissionAction.READ)
  @Query(movementListQuerySchema)
  async movements(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.inventory.listMovements(request.tenantId, request.getQuery<MovementListQuery>()));
  }

  @Post('/adjustments')
  @Permission(ModuleCode.INVENTORY, PermissionAction.CREATE)
  @Body(stockAdjustmentSchema)
  async adjust(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(
      await this.inventory.adjust(request.tenantId, request.userId, request.getBody<StockAdjustmentDto>()),
    );
  }
}
