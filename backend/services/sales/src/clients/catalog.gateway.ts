import { inject, injectable } from 'inversify';
import { CoreToken, ServiceClient, ServiceName } from '@market-pro/core';
import { ProductLookupItem, StockApplyItem, StockMovementType, StockReferenceType } from '@market-pro/shared';

export interface StockApplyRequest {
  tenantId: string;
  userId: string;
  referenceType: StockReferenceType;
  referenceId: string;
  movementType: StockMovementType;
  allowNegative: boolean;
  items: StockApplyItem[];
}

/**
 * Puerto hacia el microservicio catalog. La implementación usa ServiceClient
 * (HTTP hoy, Lambda invoke o cola mañana) sin que SaleService se entere.
 */
export interface ICatalogGateway {
  lookup(tenantId: string, productIds: string[], requestId?: string): Promise<ProductLookupItem[]>;
  applyStock(request: StockApplyRequest, requestId?: string): Promise<void>;
}

@injectable()
export class HttpCatalogGateway implements ICatalogGateway {
  constructor(@inject(CoreToken.ServiceClient) private readonly client: ServiceClient) {}

  lookup(tenantId: string, productIds: string[], requestId?: string): Promise<ProductLookupItem[]> {
    return this.client.post<ProductLookupItem[]>(
      ServiceName.CATALOG,
      '/internal/products/lookup',
      { tenantId, productIds },
      { requestId },
    );
  }

  async applyStock(request: StockApplyRequest, requestId?: string): Promise<void> {
    await this.client.post(ServiceName.CATALOG, '/internal/stock/apply', request, { requestId });
  }
}
