import { inject, injectable } from 'inversify';
import { ConflictError, CoreToken, Database, NotFoundError } from '@market-pro/core';
import { ErrorCode, PaginatedResult, StockMovementType, StockMovementView } from '@market-pro/shared';
import { CatalogToken } from '../catalog-token.enum.js';
import { IProductRepository } from '../repositories/product.repository.js';
import { IStockRepository } from '../repositories/stock.repository.js';
import { AdjustmentType, MovementListQuery, StockAdjustmentDto, StockApplyDto } from '../schemas/catalog.schemas.js';

export interface StockApplyResult {
  applied: number;
  skipped: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

@injectable()
export class InventoryService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(CatalogToken.ProductRepository) private readonly products: IProductRepository,
    @inject(CatalogToken.StockRepository) private readonly stock: IStockRepository,
  ) {}

  async listMovements(tenantId: string, query: MovementListQuery): Promise<PaginatedResult<StockMovementView>> {
    const result = await this.db.withTenant(tenantId, (tx) => this.stock.list(tx, query));
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  /** Entrada, salida o conteo físico manual. */
  async adjust(tenantId: string, userId: string, dto: StockAdjustmentDto): Promise<{ stock: number }> {
    return this.db.withTenant(tenantId, async (tx) => {
      const current = await this.products.lockStock(tx, dto.productId);
      if (current === null) throw new NotFoundError('Producto');

      let delta: number;
      let type: StockMovementType;
      switch (dto.type) {
        case AdjustmentType.IN:
          delta = dto.quantity;
          type = StockMovementType.IN;
          break;
        case AdjustmentType.OUT:
          delta = -dto.quantity;
          type = StockMovementType.OUT;
          break;
        case AdjustmentType.COUNT:
          delta = round3(dto.quantity - current);
          type = StockMovementType.ADJUSTMENT;
          break;
        default:
          throw new ConflictError('Tipo de ajuste no soportado');
      }

      if (delta === 0 && dto.type !== AdjustmentType.COUNT) {
        throw new ConflictError('La cantidad debe ser mayor a cero');
      }

      const movementId = await this.stock.insertMovement(tx, {
        tenantId,
        productId: dto.productId,
        type,
        quantity: delta,
        note: dto.note,
        createdBy: userId,
      });
      const stockAfter = (await this.stock.applyDelta(tx, dto.productId, delta)) ?? current;
      if (movementId) await this.stock.setStockAfter(tx, movementId, stockAfter);
      return { stock: stockAfter };
    });
  }

  /**
   * Aplica el stock de una venta (o su anulación) de forma atómica e idempotente:
   * si la misma referencia llega dos veces, la segunda no vuelve a descontar.
   */
  async applyStock(dto: StockApplyDto): Promise<StockApplyResult> {
    const sign = dto.movementType === StockMovementType.SALE ? -1 : 1;

    return this.db.withTenant(dto.tenantId, async (tx) => {
      let applied = 0;
      let skipped = 0;
      const insufficient: { productId: string; stock: number }[] = [];

      for (const item of dto.items) {
        const delta = round3(sign * item.quantity);
        const movementId = await this.stock.insertMovement(tx, {
          tenantId: dto.tenantId,
          productId: item.productId,
          type: dto.movementType,
          quantity: delta,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          createdBy: dto.userId,
        });
        if (!movementId) {
          skipped++;
          continue;
        }

        const stockAfter = await this.stock.applyDelta(tx, item.productId, delta);
        if (stockAfter === null) throw new NotFoundError('Producto');
        if (stockAfter < 0 && !dto.allowNegative && sign < 0) {
          insufficient.push({ productId: item.productId, stock: round3(stockAfter - delta) });
        }
        await this.stock.setStockAfter(tx, movementId, stockAfter);
        applied++;
      }

      if (insufficient.length > 0) {
        // Lanzar provoca ROLLBACK de toda la transacción (ningún producto se descuenta)
        throw new ConflictError('Stock insuficiente', ErrorCode.INSUFFICIENT_STOCK, { products: insufficient });
      }
      return { applied, skipped };
    });
  }
}
