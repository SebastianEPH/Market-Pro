import { z } from 'zod';
import { moneySchema, paginationSchema, quantitySchema, uuidSchema } from '@market-pro/core';
import { CashSessionStatus, CreateSaleRequest, PaymentMethod, SaleStatus } from '@market-pro/shared';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export interface OpenCashSessionDto {
  openingAmount: number;
  notes?: string | null;
}
export const openCashSessionSchema = z.object({ openingAmount: moneySchema, notes: optionalText(300) });

export interface CloseCashSessionDto {
  closingAmount: number;
  notes?: string | null;
}
export const closeCashSessionSchema = z.object({ closingAmount: moneySchema, notes: optionalText(300) });

export interface CashSessionListQuery {
  status?: CashSessionStatus;
  page: number;
  pageSize: number;
}
export const cashSessionListQuerySchema = paginationSchema.extend({ status: z.enum(CashSessionStatus).optional() });

export interface CreateSaleDto extends CreateSaleRequest {}
export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        quantity: quantitySchema,
        discount: moneySchema.optional(),
      }),
    )
    .min(1, 'La venta debe tener al menos un producto')
    .max(200),
  paymentMethod: z.enum(PaymentMethod),
  amountPaid: moneySchema.optional(),
  globalDiscount: moneySchema.optional(),
  customerName: optionalText(120),
  customerDocument: optionalText(20),
});

export interface VoidSaleDto {
  reason: string;
}
export const voidSaleSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export interface SaleListQuery {
  from?: string;
  to?: string;
  status?: SaleStatus;
  sellerId?: string;
  cashSessionId?: string;
  page: number;
  pageSize: number;
}
export const saleListQuerySchema = paginationSchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(SaleStatus).optional(),
  sellerId: uuidSchema.optional(),
  cashSessionId: uuidSchema.optional(),
});
