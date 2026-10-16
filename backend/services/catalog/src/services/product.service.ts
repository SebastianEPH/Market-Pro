import { inject, injectable } from 'inversify';
import { ConflictError, CoreToken, Database, NotFoundError } from '@market-pro/core';
import {
  AccessProfile,
  ErrorCode,
  FeatureCode,
  PaginatedResult,
  ProductLookupItem,
  ProductView,
  StockMovementType,
  getFeature,
} from '@market-pro/shared';
import { CatalogToken } from '../catalog-token.enum.js';
import { IProductRepository } from '../repositories/product.repository.js';
import { IStockRepository } from '../repositories/stock.repository.js';
import { CreateProductDto, ProductListQuery, UpdateProductDto } from '../schemas/catalog.schemas.js';

@injectable()
export class ProductService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(CatalogToken.ProductRepository) private readonly products: IProductRepository,
    @inject(CatalogToken.StockRepository) private readonly stock: IStockRepository,
  ) {}

  async list(tenantId: string, query: ProductListQuery): Promise<PaginatedResult<ProductView>> {
    const result = await this.db.withTenant(tenantId, (tx) => this.products.list(tx, query));
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(tenantId: string, id: string): Promise<ProductView> {
    const product = await this.db.withTenant(tenantId, (tx) => this.products.get(tx, id));
    if (!product) throw new NotFoundError('Producto');
    return product;
  }

  /** Búsqueda por código de barras o SKU (lector del POS). */
  async findByCode(tenantId: string, code: string): Promise<ProductView> {
    const product = await this.db.withTenant(tenantId, (tx) => this.products.findByCode(tx, code));
    if (!product) throw new NotFoundError('Producto');
    return product;
  }

  async create(actor: AccessProfile, userId: string, dto: CreateProductDto): Promise<ProductView> {
    const tenantId = actor.tenantId as string;
    const id = await this.db.withTenant(tenantId, async (tx) => {
      const limit = getFeature(actor, FeatureCode.PRODUCTS_MAX);
      if (limit.enabled && limit.limit !== null && (await this.products.count(tx)) >= limit.limit) {
        throw new ConflictError(`Tu plan permite como máximo ${limit.limit} productos`, ErrorCode.LIMIT_REACHED);
      }

      const productId = await this.products.create(tx, tenantId, dto);
      if (dto.initialStock > 0) {
        const movementId = await this.stock.insertMovement(tx, {
          tenantId,
          productId,
          type: StockMovementType.IN,
          quantity: dto.initialStock,
          note: 'Stock inicial',
          createdBy: userId,
        });
        const stockAfter = await this.stock.applyDelta(tx, productId, dto.initialStock);
        if (movementId && stockAfter !== null) await this.stock.setStockAfter(tx, movementId, stockAfter);
      }
      return productId;
    });
    return this.get(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto): Promise<ProductView> {
    const updated = await this.db.withTenant(tenantId, (tx) => this.products.update(tx, id, dto));
    if (!updated) throw new NotFoundError('Producto');
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const deleted = await this.db.withTenant(tenantId, (tx) => this.products.softDelete(tx, id));
    if (!deleted) throw new NotFoundError('Producto');
  }

  /** Uso interno (sales): datos mínimos y precio vigente para armar una venta. */
  lookup(tenantId: string, productIds: string[]): Promise<ProductLookupItem[]> {
    return this.db.withTenant(tenantId, (tx) => this.products.lookup(tx, [...new Set(productIds)]));
  }
}
