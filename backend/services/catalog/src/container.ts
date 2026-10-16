import { Container } from 'inversify';
import { ServiceName, createCoreContainer } from '@market-pro/core';
import { CatalogToken } from './catalog-token.enum.js';
import { ICategoryRepository, PgCategoryRepository } from './repositories/category.repository.js';
import { IProductRepository, PgProductRepository } from './repositories/product.repository.js';
import { IStockRepository, PgStockRepository } from './repositories/stock.repository.js';
import { CategoryService } from './services/category.service.js';
import { InventoryService } from './services/inventory.service.js';
import { ProductService } from './services/product.service.js';

export function createCatalogContainer(): Container {
  const container = createCoreContainer({ serviceName: ServiceName.CATALOG });

  container.bind<ICategoryRepository>(CatalogToken.CategoryRepository).to(PgCategoryRepository).inSingletonScope();
  container.bind<IProductRepository>(CatalogToken.ProductRepository).to(PgProductRepository).inSingletonScope();
  container.bind<IStockRepository>(CatalogToken.StockRepository).to(PgStockRepository).inSingletonScope();

  container.bind<CategoryService>(CatalogToken.CategoryService).to(CategoryService).inSingletonScope();
  container.bind<ProductService>(CatalogToken.ProductService).to(ProductService).inSingletonScope();
  container.bind<InventoryService>(CatalogToken.InventoryService).to(InventoryService).inSingletonScope();

  return container;
}
