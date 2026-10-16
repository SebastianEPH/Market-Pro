import { injectable } from 'inversify';
import { DbExecutor, buildSetClause, likePattern, pageOffset } from '@market-pro/core';
import { ProductLookupItem, ProductView } from '@market-pro/shared';
import { CreateProductDto, ProductListQuery, UpdateProductDto } from '../schemas/catalog.schemas.js';

export interface IProductRepository {
  list(db: DbExecutor, filter: ProductListQuery): Promise<{ items: ProductView[]; total: number }>;
  get(db: DbExecutor, id: string): Promise<ProductView | null>;
  findByCode(db: DbExecutor, code: string): Promise<ProductView | null>;
  count(db: DbExecutor): Promise<number>;
  create(db: DbExecutor, tenantId: string, dto: CreateProductDto): Promise<string>;
  update(db: DbExecutor, id: string, dto: UpdateProductDto): Promise<boolean>;
  softDelete(db: DbExecutor, id: string): Promise<boolean>;
  lookup(db: DbExecutor, ids: string[]): Promise<ProductLookupItem[]>;
  lockStock(db: DbExecutor, id: string): Promise<number | null>;
}

const VIEW_COLUMNS = `
  p.id, p.category_id AS "categoryId", c.name AS "categoryName", p.sku, p.barcode, p.name,
  p.description, p.unit, p.cost_price AS "costPrice", p.sale_price AS "salePrice", p.stock,
  p.min_stock AS "minStock", p.is_active AS "isActive", p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

const FROM = 'FROM products p LEFT JOIN categories c ON c.id = p.category_id';

@injectable()
export class PgProductRepository implements IProductRepository {
  async list(db: DbExecutor, filter: ProductListQuery): Promise<{ items: ProductView[]; total: number }> {
    const where = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (filter.search) {
      params.push(likePattern(filter.search));
      const i = params.length;
      where.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i} OR p.barcode ILIKE $${i})`);
    }
    if (filter.categoryId) {
      params.push(filter.categoryId);
      where.push(`p.category_id = $${params.length}`);
    }
    if (filter.lowStock) where.push('p.stock <= p.min_stock');
    if (filter.active !== undefined) {
      params.push(filter.active);
      where.push(`p.is_active = $${params.length}`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalRow = await db.one<{ total: number }>(`SELECT count(*)::int AS total ${FROM} ${whereSql}`, params);
    const items = await db.query<ProductView>(
      `SELECT ${VIEW_COLUMNS} ${FROM} ${whereSql}
        ORDER BY p.name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, pageOffset(filter.page, filter.pageSize)],
    );
    return { items, total: totalRow.total };
  }

  get(db: DbExecutor, id: string): Promise<ProductView | null> {
    return db.maybeOne<ProductView>(`SELECT ${VIEW_COLUMNS} ${FROM} WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]);
  }

  findByCode(db: DbExecutor, code: string): Promise<ProductView | null> {
    return db.maybeOne<ProductView>(
      `SELECT ${VIEW_COLUMNS} ${FROM}
        WHERE p.deleted_at IS NULL AND (p.barcode = $1 OR lower(p.sku) = lower($1))
        ORDER BY (p.barcode = $1) DESC LIMIT 1`,
      [code],
    );
  }

  async count(db: DbExecutor): Promise<number> {
    const row = await db.one<{ total: number }>('SELECT count(*)::int AS total FROM products WHERE deleted_at IS NULL');
    return row.total;
  }

  async create(db: DbExecutor, tenantId: string, dto: CreateProductDto): Promise<string> {
    const row = await db.one<{ id: string }>(
      `INSERT INTO products (tenant_id, category_id, sku, barcode, name, description, unit,
                             cost_price, sale_price, min_stock, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        tenantId,
        dto.categoryId ?? null,
        dto.sku,
        dto.barcode ?? null,
        dto.name,
        dto.description ?? null,
        dto.unit,
        dto.costPrice,
        dto.salePrice,
        dto.minStock,
        dto.isActive,
      ],
    );
    return row.id;
  }

  async update(db: DbExecutor, id: string, dto: UpdateProductDto): Promise<boolean> {
    const set = buildSetClause({ ...dto }, {
      categoryId: 'category_id',
      sku: 'sku',
      barcode: 'barcode',
      name: 'name',
      description: 'description',
      unit: 'unit',
      costPrice: 'cost_price',
      salePrice: 'sale_price',
      minStock: 'min_stock',
      isActive: 'is_active',
    }, 2);
    if (!set.sql) return true;
    const affected = await db.execute(`UPDATE products SET ${set.sql} WHERE id = $1 AND deleted_at IS NULL`, [
      id,
      ...set.values,
    ]);
    return affected > 0;
  }

  async softDelete(db: DbExecutor, id: string): Promise<boolean> {
    const affected = await db.execute(
      'UPDATE products SET deleted_at = now(), is_active = false WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return affected > 0;
  }

  lookup(db: DbExecutor, ids: string[]): Promise<ProductLookupItem[]> {
    return db.query<ProductLookupItem>(
      `SELECT id, sku, name, unit, sale_price AS "salePrice", stock, (is_active AND deleted_at IS NULL) AS "isActive"
         FROM products WHERE id = ANY($1::uuid[])`,
      [ids],
    );
  }

  async lockStock(db: DbExecutor, id: string): Promise<number | null> {
    const row = await db.maybeOne<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id],
    );
    return row ? row.stock : null;
  }
}
