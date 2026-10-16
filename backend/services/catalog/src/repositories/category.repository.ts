import { injectable } from 'inversify';
import { DbExecutor, buildSetClause } from '@market-pro/core';
import { CategoryView } from '@market-pro/shared';
import { CategoryDto } from '../schemas/catalog.schemas.js';

export interface ICategoryRepository {
  list(db: DbExecutor): Promise<CategoryView[]>;
  get(db: DbExecutor, id: string): Promise<CategoryView | null>;
  create(db: DbExecutor, tenantId: string, dto: CategoryDto): Promise<string>;
  update(db: DbExecutor, id: string, dto: Partial<CategoryDto>): Promise<boolean>;
  delete(db: DbExecutor, id: string): Promise<boolean>;
}

const VIEW_COLUMNS = `
  c.id, c.name, c.description, c.is_active AS "isActive", c.created_at AS "createdAt",
  (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS "productCount"`;

@injectable()
export class PgCategoryRepository implements ICategoryRepository {
  list(db: DbExecutor): Promise<CategoryView[]> {
    return db.query<CategoryView>(`SELECT ${VIEW_COLUMNS} FROM categories c ORDER BY c.name`);
  }

  get(db: DbExecutor, id: string): Promise<CategoryView | null> {
    return db.maybeOne<CategoryView>(`SELECT ${VIEW_COLUMNS} FROM categories c WHERE c.id = $1`, [id]);
  }

  async create(db: DbExecutor, tenantId: string, dto: CategoryDto): Promise<string> {
    const row = await db.one<{ id: string }>(
      'INSERT INTO categories (tenant_id, name, description, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
      [tenantId, dto.name, dto.description ?? null, dto.isActive ?? true],
    );
    return row.id;
  }

  async update(db: DbExecutor, id: string, dto: Partial<CategoryDto>): Promise<boolean> {
    const set = buildSetClause({ ...dto }, { name: 'name', description: 'description', isActive: 'is_active' }, 2);
    if (!set.sql) return true;
    return (await db.execute(`UPDATE categories SET ${set.sql} WHERE id = $1`, [id, ...set.values])) > 0;
  }

  async delete(db: DbExecutor, id: string): Promise<boolean> {
    return (await db.execute('DELETE FROM categories WHERE id = $1', [id])) > 0;
  }
}
