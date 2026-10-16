import { injectable } from 'inversify';
import { DbExecutor, pageOffset } from '@market-pro/core';
import { StockMovementType, StockMovementView } from '@market-pro/shared';
import { MovementListQuery } from '../schemas/catalog.schemas.js';

export interface NewMovement {
  tenantId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export interface IStockRepository {
  /** Inserta el movimiento; devuelve null si ya existía (idempotencia por referencia). */
  insertMovement(db: DbExecutor, movement: NewMovement): Promise<string | null>;
  /** Suma `delta` al stock y devuelve el stock resultante (null si el producto no existe). */
  applyDelta(db: DbExecutor, productId: string, delta: number): Promise<number | null>;
  setStockAfter(db: DbExecutor, movementId: string, stockAfter: number): Promise<void>;
  list(db: DbExecutor, filter: MovementListQuery): Promise<{ items: StockMovementView[]; total: number }>;
}

@injectable()
export class PgStockRepository implements IStockRepository {
  async insertMovement(db: DbExecutor, movement: NewMovement): Promise<string | null> {
    const row = await db.maybeOne<{ id: string }>(
      `INSERT INTO stock_movements (tenant_id, product_id, type, quantity, reference_type, reference_id, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, reference_type, reference_id, product_id) WHERE reference_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [
        movement.tenantId,
        movement.productId,
        movement.type,
        movement.quantity,
        movement.referenceType ?? null,
        movement.referenceId ?? null,
        movement.note ?? null,
        movement.createdBy ?? null,
      ],
    );
    return row?.id ?? null;
  }

  async applyDelta(db: DbExecutor, productId: string, delta: number): Promise<number | null> {
    const row = await db.maybeOne<{ stock: number }>(
      'UPDATE products SET stock = stock + $2 WHERE id = $1 AND deleted_at IS NULL RETURNING stock',
      [productId, delta],
    );
    return row ? row.stock : null;
  }

  async setStockAfter(db: DbExecutor, movementId: string, stockAfter: number): Promise<void> {
    await db.execute('UPDATE stock_movements SET stock_after = $2 WHERE id = $1', [movementId, stockAfter]);
  }

  async list(db: DbExecutor, filter: MovementListQuery): Promise<{ items: StockMovementView[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.productId) {
      params.push(filter.productId);
      where.push(`m.product_id = $${params.length}`);
    }
    if (filter.type) {
      params.push(filter.type);
      where.push(`m.type = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = await db.one<{ total: number }>(
      `SELECT count(*)::int AS total FROM stock_movements m ${whereSql}`,
      params,
    );
    const items = await db.query<StockMovementView>(
      `SELECT m.id, m.product_id AS "productId", p.name AS "productName", p.sku, m.type, m.quantity,
              m.stock_after AS "stockAfter", m.reference_type AS "referenceType", m.reference_id AS "referenceId",
              m.note, m.created_by AS "createdBy", m.created_at AS "createdAt"
         FROM stock_movements m JOIN products p ON p.id = m.product_id
         ${whereSql}
        ORDER BY m.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }
}
