import { Container } from 'inversify';
import { ServiceName, createCoreContainer } from '@market-pro/core';
import { HttpCatalogGateway, ICatalogGateway } from './clients/catalog.gateway.js';
import { ICashSessionRepository, PgCashSessionRepository } from './repositories/cash-session.repository.js';
import { IDashboardRepository, PgDashboardRepository } from './repositories/dashboard.repository.js';
import { ISaleRepository, PgSaleRepository } from './repositories/sale.repository.js';
import { SalesToken } from './sales-token.enum.js';
import { CashSessionService } from './services/cash-session.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { SaleService } from './services/sale.service.js';

export function createSalesContainer(): Container {
  const container = createCoreContainer({ serviceName: ServiceName.SALES });

  container.bind<ICatalogGateway>(SalesToken.CatalogGateway).to(HttpCatalogGateway).inSingletonScope();

  container.bind<ICashSessionRepository>(SalesToken.CashSessionRepository).to(PgCashSessionRepository).inSingletonScope();
  container.bind<ISaleRepository>(SalesToken.SaleRepository).to(PgSaleRepository).inSingletonScope();
  container.bind<IDashboardRepository>(SalesToken.DashboardRepository).to(PgDashboardRepository).inSingletonScope();

  container.bind<CashSessionService>(SalesToken.CashSessionService).to(CashSessionService).inSingletonScope();
  container.bind<SaleService>(SalesToken.SaleService).to(SaleService).inSingletonScope();
  container.bind<DashboardService>(SalesToken.DashboardService).to(DashboardService).inSingletonScope();

  return container;
}
