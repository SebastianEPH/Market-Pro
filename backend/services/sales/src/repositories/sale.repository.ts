import { injectable } from 'inversify';
import { DbExecutor, pageOffset } from '@market-pro/core';
import { PaymentMethod, SaleItemView, SaleView } from '@market-pro/shared';
import { SaleListQuery } from '../schemas/sales.schemas.js';

export interface NewSale {
  tenantId: string;
  number: number;
  cashSessionId: string;
  sellerId: string;
  sellerName: string;
  customerName: string | null;
  customerDocument: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
}

export interface NewSaleItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface SaleListFilter extends SaleListQuery {
  timezone: string;
  /** Si se define, solo ventas de este vendedor (usuarios con pos:read sin sales:read). */
  onlySellerId?: string;
}

export interface ISaleRepository {
  nextNumber(db: DbExecutor, tenantId: string): Promise<number>;
  create(db: DbExecutor, sale: NewSale, items: NewSaleItem[]): Promise<string>;
  get(db: DbExecutor, id: string): Promise<SaleView | null>;
  list(db: DbExecutor, filter: SaleListFilter): Promise<{ items: SaleView[]; total: number }>;
  markVoided(db: DbExecutor, id: string, userId: string, reason: string): Promise<boolean>;
}

const SALE_COLUMNS = `
  s.id, s.number, s.cash_session_id AS "cashSessionId", s.seller_id AS "sellerId", s.seller_name AS "sellerName",
  s.customer_name AS "customerName", s.customer_document AS "customerDocument", s.currency,
  s.subtotal, s.discount_total AS "discountTotal", s.tax_total AS "taxTotal", s.total,
  s.payment_method AS "paymentMethod", s.amount_paid AS "amountPaid", s.change_amount AS "changeAmount",
  s.status, s.void_reason AS "voidReason", s.voided_at AS "voidedAt", s.created_at AS "createdAt"`;

@injectable()
export class PgSaleRepository implements ISaleRepository {
  async nextNumber(db: DbExecutor, tenantId: string): Promise<number> {
    const row = await db.one<{ value: number }>(
      `INSERT INTO tenant_counters (tenant_id, name, value) VALUES ($1, 'sale', 1)
       ON CONFLICT (tenant_id, name) DO UPDATE SET value = tenant_counters.value + 1
       RETURNING value`,
      [tenantId],
    );
    return row.value;
  }

  async create(db: DbExecutor, sale: NewSale, items: NewSaleItem[]): Promise<string> {
    const row = await db.one<{ id: string }>(
      `INSERT INTO sales (tenant_id, number, cash_session_id, seller_id, seller_name, customer_name, customer_document,
                          currency, subtotal, discount_total, tax_total, total, payment_method, amount_paid, change_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        sale.tenantId,
        sale.number,
        sale.cashSessionId,
        sale.sellerId,
        sale.sellerName,
        sale.customerName,
        sale.customerDocument,
        sale.currency,
        sale.subtotal,
        sale.discountTotal,
        sale.taxTotal,
        sale.total,
        sale.paymentMethod,
        sale.amountPaid,
        sale.changeAmount,
      ],
    );
    for (const item of items) {
      await db.execute(
        `INSERT INTO sale_items (tenant_id, sale_id, product_id, sku, product_name, quantity, unit_price, discount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sale.tenantId,
          row.id,
          item.productId,
          item.sku,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.discount,
          item.lineTotal,
        ],
      );
    }
    return row.id;
  }

  async get(db: DbExecutor, id: string): Promise<SaleView | null> {
    const sale = await db.maybeOne<SaleView>(`SELECT ${SALE_COLUMNS} FROM sales s WHERE s.id = $1`, [id]);
    if (!sale) return null;
    sale.items = await db.query<SaleItemView>(
      `SELECT id, product_id AS "productId", sku, product_name AS "productName", quantity,
              unit_price AS "unitPrice", discount, line_total AS "lineTotal"
         FROM sale_items WHERE sale_id = $1 ORDER BY id`,
      [id],
    );
    return sale;
  }

  async list(db: DbExecutor, filter: SaleListFilter): Promise<{ items: SaleView[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [filter.timezone];
    if (filter.from) {
      params.push(filter.from);
      where.push(`s.created_at >= ($${params.length}::date::timestamp AT TIME ZONE $1)`);
    }
    if (filter.to) {
      params.push(filter.to);
      where.push(`s.created_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE $1)`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`s.status = $${params.length}`);
    }
    const sellerId = filter.onlySellerId ?? filter.sellerId;
    if (sellerId) {
      params.push(sellerId);
      where.push(`s.seller_id = $${params.length}`);
    }
    if (filter.cashSessionId) {
      params.push(filter.cashSessionId);
      where.push(`s.cash_session_id = $${params.length}`);
    }
    // $1 (timezone) siempre se envía; se referencia en una condición neutra para que PG lo tipe
    const whereSql = `WHERE $1::text IS NOT NULL${where.length ? ` AND ${where.join(' AND ')}` : ''}`;

    const totalRow = await db.one<{ total: number }>(`SELECT count(*)::int AS total FROM sales s ${whereSql}`, params);
    const items = await db.query<SaleView>(
      `SELECT ${SALE_COLUMNS} FROM sales s ${whereSql}
        ORDER BY s.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }

  async markVoided(db: DbExecutor, id: string, userId: string, reason: string): Promise<boolean> {
    const affected = await db.execute(
      `UPDATE sales SET status = 'VOIDED', voided_by = $2, voided_at = now(), void_reason = $3
        WHERE id = $1 AND status = 'COMPLETED'`,
      [id, userId, reason],
    );
    return affected > 0;
  }
}
