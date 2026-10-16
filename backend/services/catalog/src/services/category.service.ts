import { inject, injectable } from 'inversify';
import { CoreToken, Database, NotFoundError } from '@market-pro/core';
import { CategoryView } from '@market-pro/shared';
import { CatalogToken } from '../catalog-token.enum.js';
import { ICategoryRepository } from '../repositories/category.repository.js';
import { CategoryDto } from '../schemas/catalog.schemas.js';

@injectable()
export class CategoryService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(CatalogToken.CategoryRepository) private readonly categories: ICategoryRepository,
  ) {}

  list(tenantId: string): Promise<CategoryView[]> {
    return this.db.withTenant(tenantId, (tx) => this.categories.list(tx));
  }

  async get(tenantId: string, id: string): Promise<CategoryView> {
    const category = await this.db.withTenant(tenantId, (tx) => this.categories.get(tx, id));
    if (!category) throw new NotFoundError('Categoría');
    return category;
  }

  async create(tenantId: string, dto: CategoryDto): Promise<CategoryView> {
    const id = await this.db.withTenant(tenantId, (tx) => this.categories.create(tx, tenantId, dto));
    return this.get(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: Partial<CategoryDto>): Promise<CategoryView> {
    const updated = await this.db.withTenant(tenantId, (tx) => this.categories.update(tx, id, dto));
    if (!updated) throw new NotFoundError('Categoría');
    return this.get(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const deleted = await this.db.withTenant(tenantId, (tx) => this.categories.delete(tx, id));
    if (!deleted) throw new NotFoundError('Categoría');
  }
}
