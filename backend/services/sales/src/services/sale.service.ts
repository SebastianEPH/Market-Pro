import { inject, injectable } from 'inversify';
import {
  BadRequestError,
  ConflictError,
  CoreToken,
  Database,
  ForbiddenError,
  NotFoundError,
  Principal,
} from '@market-pro/core';
import {
  AccessProfile,
  ErrorCode,
  FeatureCode,
  ModuleCode,
  PaginatedResult,
  PaymentMethod,
  PermissionAction,
  ProductLookupItem,
  SaleView,
  StockMovementType,
  StockReferenceType,
  TenantSettings,
  hasPermission,
  isFeatureEnabled,
} from '@market-pro/shared';
import { ICatalogGateway } from '../clients/catalog.gateway.js';
import { ICashSessionRepository } from '../repositories/cash-session.repository.js';
import { ISaleRepository, NewSaleItem } from '../repositories/sale.repository.js';
import { SalesToken } from '../sales-token.enum.js';
import { CreateSaleDto, SaleListQuery } from '../schemas/sales.schemas.js';
import { fromCents, toCents } from './money.js';

export interface SaleContext {
  principal: Principal;
  access: AccessProfile;
  requestId: string;
}

const DEFAULT_SETTINGS: TenantSettings = {
  currency: 'PEN',
  taxRate: 0.18,
  taxIncluded: true,
  timezone: 'America/Lima',
  receiptFooter: null,
};

interface SaleTotals {
  items: NewSaleItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

@injectable()
export class SaleService {
  constructor(
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(SalesToken.SaleRepository) private readonly sales: ISaleRepository,
    @inject(SalesToken.CashSessionRepository) private readonly sessions: ICashSessionRepository,
    @inject(SalesToken.CatalogGateway) private readonly catalog: ICatalogGateway,
  ) {}

  /**
   * Registra una venta:
   *  1. exige caja abierta del vendedor,
   *  2. obtiene precios vigentes desde catalog (no confía en el cliente),
   *  3. calcula totales en céntimos con el impuesto de la tienda,
   *  4. guarda la venta y descuenta stock en catalog dentro de la misma
   *     transacción: si catalog rechaza (sin stock), se hace ROLLBACK.
   */
  async create(ctx: SaleContext, dto: CreateSaleDto): Promise<SaleView> {
    const tenantId = ctx.access.tenantId as string;
    const settings = ctx.access.settings ?? DEFAULT_SETTINGS;

    const session = await this.db.withTenant(tenantId, (tx) => this.sessions.findOpenByUser(tx, ctx.principal.subjectId));
    if (!session) {
      throw new ConflictError('Debes abrir caja antes de vender', ErrorCode.CASH_SESSION_REQUIRED);
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = new Map(
      (await this.catalog.lookup(tenantId, productIds, ctx.requestId)).map((product) => [product.id, product]),
    );
    const totals = this.computeTotals(dto, products, settings);

    const hasDiscount = totals.discountCents > 0;
    if (hasDiscount && !isFeatureEnabled(ctx.access, FeatureCode.SALES_DISCOUNTS)) {
      throw new ForbiddenError(ErrorCode.FEATURE_DISABLED, 'Los descuentos no están habilitados para esta tienda');
    }

    const amountPaidCents =
      dto.paymentMethod === PaymentMethod.CASH ? toCents(dto.amountPaid ?? fromCents(totals.totalCents)) : totals.totalCents;
    if (amountPaidCents < totals.totalCents) {
      throw new BadRequestError('El monto recibido es menor al total');
    }

    const saleId = await this.db.withTenant(tenantId, async (tx) => {
      const number = await this.sales.nextNumber(tx, tenantId);
      const id = await this.sales.create(
        tx,
        {
          tenantId,
          number,
          cashSessionId: session.id,
          sellerId: ctx.principal.subjectId,
          sellerName: ctx.principal.name,
          customerName: dto.customerName ?? null,
          customerDocument: dto.customerDocument ?? null,
          currency: settings.currency,
          subtotal: fromCents(totals.subtotalCents),
          discountTotal: fromCents(totals.discountCents),
          taxTotal: fromCents(totals.taxCents),
          total: fromCents(totals.totalCents),
          paymentMethod: dto.paymentMethod,
          amountPaid: fromCents(amountPaidCents),
          changeAmount: fromCents(amountPaidCents - totals.totalCents),
        },
        totals.items,
      );

      await this.catalog.applyStock(
        {
          tenantId,
          userId: ctx.principal.subjectId,
          referenceType: StockReferenceType.SALE,
          referenceId: id,
          movementType: StockMovementType.SALE,
          allowNegative: isFeatureEnabled(ctx.access, FeatureCode.INVENTORY_NEGATIVE_STOCK),
          items: this.aggregateQuantities(totals.items),
        },
        ctx.requestId,
      );
      return id;
    });

    return this.get(ctx, saleId);
  }

  async list(ctx: SaleContext, query: SaleListQuery): Promise<PaginatedResult<SaleView>> {
    const tenantId = ctx.access.tenantId as string;
    const settings = ctx.access.settings ?? DEFAULT_SETTINGS;
    const result = await this.db.withTenant(tenantId, (tx) =>
      this.sales.list(tx, {
        ...query,
        timezone: settings.timezone,
        onlySellerId: this.canSeeAllSales(ctx.access) ? undefined : ctx.principal.subjectId,
      }),
    );
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async get(ctx: SaleContext, id: string): Promise<SaleView> {
    const tenantId = ctx.access.tenantId as string;
    const sale = await this.db.withTenant(tenantId, (tx) => this.sales.get(tx, id));
    if (!sale) throw new NotFoundError('Venta');
    if (!this.canSeeAllSales(ctx.access) && sale.sellerId !== ctx.principal.subjectId) {
      throw new NotFoundError('Venta');
    }
    return sale;
  }

  /** Anula la venta y devuelve el stock (movimiento SALE_VOID idempotente). */
  async void(ctx: SaleContext, id: string, reason: string): Promise<SaleView> {
    const tenantId = ctx.access.tenantId as string;
    await this.db.withTenant(tenantId, async (tx) => {
      const sale = await this.sales.get(tx, id);
      if (!sale) throw new NotFoundError('Venta');
      if (!(await this.sales.markVoided(tx, id, ctx.principal.subjectId, reason))) {
        throw new ConflictError('La venta ya fue anulada');
      }
      await this.catalog.applyStock(
        {
          tenantId,
          userId: ctx.principal.subjectId,
          referenceType: StockReferenceType.SALE,
          referenceId: id,
          movementType: StockMovementType.SALE_VOID,
          allowNegative: true,
          items: this.aggregateQuantities(sale.items ?? []),
        },
        ctx.requestId,
      );
    });
    return this.get(ctx, id);
  }

  // ------------------------------------------------------------------ privados

  private canSeeAllSales(access: AccessProfile): boolean {
    return hasPermission(access, ModuleCode.SALES, PermissionAction.READ);
  }

  private computeTotals(dto: CreateSaleDto, products: Map<string, ProductLookupItem>, settings: TenantSettings): SaleTotals {
    let linesCents = 0;
    let itemDiscountCents = 0;

    const items = dto.items.map<NewSaleItem>((item) => {
      const product = products.get(item.productId);
      if (!product) throw new NotFoundError(`Producto ${item.productId}`);
      if (!product.isActive) throw new ConflictError(`El producto "${product.name}" no está disponible`);

      const grossCents = Math.round(toCents(product.salePrice) * item.quantity);
      const discountCents = toCents(item.discount ?? 0);
      if (discountCents > grossCents) {
        throw new BadRequestError(`El descuento de "${product.name}" supera el importe`);
      }
      const lineCents = grossCents - discountCents;
      linesCents += lineCents;
      itemDiscountCents += discountCents;

      return {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        discount: fromCents(discountCents),
        lineTotal: fromCents(lineCents),
      };
    });

    const globalDiscountCents = toCents(dto.globalDiscount ?? 0);
    if (globalDiscountCents > linesCents) throw new BadRequestError('El descuento global supera el total');

    const netCents = linesCents - globalDiscountCents;
    let subtotalCents: number;
    let taxCents: number;
    let totalCents: number;
    if (settings.taxIncluded) {
      totalCents = netCents;
      taxCents = Math.round(netCents - netCents / (1 + settings.taxRate));
      subtotalCents = totalCents - taxCents;
    } else {
      subtotalCents = netCents;
      taxCents = Math.round(netCents * settings.taxRate);
      totalCents = subtotalCents + taxCents;
    }

    return {
      items,
      subtotalCents,
      taxCents,
      totalCents,
      discountCents: itemDiscountCents + globalDiscountCents,
    };
  }

  /** Un producto repetido en el carrito se descuenta como una sola línea de stock. */
  private aggregateQuantities(items: { productId: string; quantity: number }[]): { productId: string; quantity: number }[] {
    const totals = new Map<string, number>();
    for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
    return [...totals.entries()].map(([productId, quantity]) => ({
      productId,
      quantity: Math.round(quantity * 1000) / 1000,
    }));
  }
}
