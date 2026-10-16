import 'reflect-metadata';
import { LambdaApplication } from '@market-pro/core';
import { createCatalogContainer } from './container.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { CatalogInternalController } from './controllers/internal.controller.js';
import { InventoryController } from './controllers/inventory.controller.js';
import { ProductsController } from './controllers/products.controller.js';

/** Entrada Lambda del microservicio catalog. Ruta API Gateway: `ANY /catalog/{proxy+}`. */
const app = new LambdaApplication(createCatalogContainer(), {
  controllers: [CategoriesController, ProductsController, InventoryController, CatalogInternalController],
});

export const handler = app.handler;
