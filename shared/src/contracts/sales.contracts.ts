import { CashSessionStatus, PaymentMethod, SaleStatus } from '../enums/domain.enums.js';

export interface CashSessionView {
  id: string;
  openedBy: string;
  openedByName: string;
  openingAmount: number;
  openedAt: string;
  closedBy: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  closedAt: string | null;
  status: CashSessionStatus;
  notes: string | null;
  salesCount: number;
  salesTotal: number;
  cashSalesTotal: number;
}

export interface SaleItemView {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface SaleView {
  id: string;
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
  status: SaleStatus;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  items?: SaleItemView[];
}

export interface CreateSaleItemRequest {
  productId: string;
  quantity: number;
  discount?: number;
}

export interface CreateSaleRequest {
  items: CreateSaleItemRequest[];
  paymentMethod: PaymentMethod;
  amountPaid?: number;
  globalDiscount?: number;
  customerName?: string | null;
  customerDocument?: string | null;
}

export interface DashboardDayPoint {
  day: string;
  total: number;
  count: number;
}

export interface DashboardPaymentBreakdown {
  paymentMethod: PaymentMethod;
  total: number;
  count: number;
}

export interface DashboardTopProduct {
  productId: string;
  productName: string;
  quantity: number;
  total: number;
}

export interface DashboardSummary {
  currency: string;
  todayTotal: number;
  todayCount: number;
  averageTicket: number;
  openCashSessions: number;
  last7Days: DashboardDayPoint[];
  paymentsToday: DashboardPaymentBreakdown[];
  topProducts: DashboardTopProduct[];
}
