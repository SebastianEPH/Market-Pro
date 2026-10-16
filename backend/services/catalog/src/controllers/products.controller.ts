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
  Query,
  RouteScope,
} from '@market-pro/core';
import { ModuleCode, PermissionAction } from '@market-pro/shared';
import { CatalogToken } from '../catalog-token.enum.js';
import {
  CreateProductDto,
  ProductListQuery,
  UpdateProductDto,
  createProductSchema,
  productListQuerySchema,
  updateProductSchema,
} from '../schemas/catalog.schemas.js';
import { ProductService } from '../services/product.service.js';

@injectable()
@Controller('/products', RouteScope.TENANT)
export class ProductsController {
  constructor(@inject(CatalogToken.ProductService) private readonly products: ProductService) {}

  /** Lo usan backoffice (products/inventory) y POS (pos:read). */
  @Get()
  @Permission(ModuleCode.PRODUCTS, PermissionAction.READ)
  @Permission(ModuleCode.INVENTORY, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  @Query(productListQuerySchema)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.products.list(request.tenantId, request.getQuery<ProductListQuery>()));
  }

  @Get('/by-code/{code}')
  @Permission(ModuleCode.PRODUCTS, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  async byCode(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.products.findByCode(request.tenantId, request.param('code')));
  }

  @Post()
  @Permission(ModuleCode.PRODUCTS, PermissionAction.CREATE)
  @Body(createProductSchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(
      await this.products.create(request.requireAccess(), request.userId, request.getBody<CreateProductDto>()),
    );
  }

  @Get('/{id}')
  @Permission(ModuleCode.PRODUCTS, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.products.get(request.tenantId, request.param('id')));
  }

  @Patch('/{id}')
  @Permission(ModuleCode.PRODUCTS, PermissionAction.UPDATE)
  @Body(updateProductSchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.products.update(request.tenantId, request.param('id'), request.getBody<UpdateProductDto>()),
    );
  }

  @Delete('/{id}')
  @Permission(ModuleCode.PRODUCTS, PermissionAction.DELETE)
  async remove(request: ApiRequest): Promise<HttpResult> {
    await this.products.remove(request.tenantId, request.param('id'));
    return ApiResponse.noContent();
  }
}
