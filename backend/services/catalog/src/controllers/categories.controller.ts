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
import { CatalogToken } from '../catalog-token.enum.js';
import { CategoryDto, createCategorySchema, updateCategorySchema } from '../schemas/catalog.schemas.js';
import { CategoryService } from '../services/category.service.js';

@injectable()
@Controller('/categories', RouteScope.TENANT)
export class CategoriesController {
  constructor(@inject(CatalogToken.CategoryService) private readonly categories: CategoryService) {}

  @Get()
  @Permission(ModuleCode.CATEGORIES, PermissionAction.READ)
  @Permission(ModuleCode.PRODUCTS, PermissionAction.READ)
  @Permission(ModuleCode.POS, PermissionAction.READ)
  async list(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.categories.list(request.tenantId));
  }

  @Post()
  @Permission(ModuleCode.CATEGORIES, PermissionAction.CREATE)
  @Body(createCategorySchema)
  async create(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.created(await this.categories.create(request.tenantId, request.getBody<CategoryDto>()));
  }

  @Get('/{id}')
  @Permission(ModuleCode.CATEGORIES, PermissionAction.READ)
  async get(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(await this.categories.get(request.tenantId, request.param('id')));
  }

  @Patch('/{id}')
  @Permission(ModuleCode.CATEGORIES, PermissionAction.UPDATE)
  @Body(updateCategorySchema)
  async update(request: ApiRequest): Promise<HttpResult> {
    return ApiResponse.ok(
      await this.categories.update(request.tenantId, request.param('id'), request.getBody<Partial<CategoryDto>>()),
    );
  }

  @Delete('/{id}')
  @Permission(ModuleCode.CATEGORIES, PermissionAction.DELETE)
  async remove(request: ApiRequest): Promise<HttpResult> {
    await this.categories.remove(request.tenantId, request.param('id'));
    return ApiResponse.noContent();
  }
}
