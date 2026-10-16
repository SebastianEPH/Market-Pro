import 'reflect-metadata';
import { LambdaApplication } from '@market-pro/core';
import { createSalesContainer } from './container.js';
import { CashSessionsController } from './controllers/cash-sessions.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { SalesController } from './controllers/sales.controller.js';

/** Entrada Lambda del microservicio sales. Ruta API Gateway: `ANY /sales/{proxy+}`. */
const app = new LambdaApplication(createSalesContainer(), {
  controllers: [CashSessionsController, SalesController, DashboardController],
});

export const handler = app.handler;
