import { inject, injectable } from 'inversify';
import { ApiRequest, ApiResponse, Body, Controller, HttpResult, Post, RouteScope } from '@market-pro/core';
import { CatalogToken } from '../catalog-token.enum.js';
import { ProductLookupDto, StockApplyDto, productLookupSchema, stockApplySchema } from '../schemas/catalog.schemas.js';
import { InventoryService } from '../services/inventory.service.js';
import { ProductService } from '../services/product.service.js';

/** Endpoints que consume el microservicio sales. */
@injectable()
@Controller('/internal', RouteScope.INTERNAL)
export class CatalogInternalController {
  constructor(
    @inject(CatalogToken.ProductService) private readonly products: ProductService,
    @inject(CatalogToken.InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Post('/products/lookup')
  @Body(productLookupSchema)
  async lookup(request: ApiRequest): Promise<HttpResult> {
    const dto = request.getBody<ProductLookupDto>();
    return ApiResponse.ok(await this.products.lookup(dto.tenantId, dto.productIds));
  }

  @Post('/stock/apply')
  @Body(stockApplySchema)
  async applyStock(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.inventory.applyStock(request.getBody<StockApplyDto>()));
  }
}
