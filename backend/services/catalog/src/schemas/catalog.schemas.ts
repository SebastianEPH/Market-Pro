import { z } from 'zod';
import { moneySchema, optionalQueryText, paginationSchema, queryBoolean, quantitySchema, uuidSchema } from '@market-pro/core';
import { ProductUnit, StockMovementType, StockReferenceType } from '@market-pro/shared';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// ---------------------------------------------------------------- Categorías

export interface CategoryDto {
  name: string;
  description?: string | null;
  isActive?: boolean;
}
export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(200),
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

// ---------------------------------------------------------------- Productos

export interface CreateProductDto {
  categoryId?: string | null;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unit: ProductUnit;
  costPrice: number;
  salePrice: number;
  initialStock: number;
  minStock: number;
  isActive: boolean;
}
export const createProductSchema = z.object({
  categoryId: uuidSchema.nullable().optional(),
  sku: z.string().trim().min(1).max(40),
  barcode: z.string().trim().min(4).max(32).nullable().optional(),
  name: z.string().trim().min(2).max(160),
  description: optionalText(500),
  unit: z.enum(ProductUnit).default(ProductUnit.UNIT),
  costPrice: moneySchema.default(0),
  salePrice: moneySchema,
  initialStock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export interface UpdateProductDto {
  categoryId?: string | null;
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  unit?: ProductUnit;
  costPrice?: number;
  salePrice?: number;
  minStock?: number;
  isActive?: boolean;
}
export const updateProductSchema = z.object({
  categoryId: uuidSchema.nullable().optional(),
  sku: z.string().trim().min(1).max(40).optional(),
  barcode: z.string().trim().min(4).max(32).nullable().optional(),
  name: z.string().trim().min(2).max(160).optional(),
  description: optionalText(500),
  unit: z.enum(ProductUnit).optional(),
  costPrice: moneySchema.optional(),
  salePrice: moneySchema.optional(),
  minStock: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export interface ProductListQuery {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  active?: boolean;
  page: number;
  pageSize: number;
}
export const productListQuerySchema = paginationSchema.extend({
  search: optionalQueryText,
  categoryId: uuidSchema.optional(),
  lowStock: queryBoolean,
  active: queryBoolean,
});

// ---------------------------------------------------------------- Inventario

export enum AdjustmentType {
  IN = 'IN',
  OUT = 'OUT',
  /** Conteo físico: fija el stock al valor indicado. */
  COUNT = 'ADJUSTMENT',
}

export interface StockAdjustmentDto {
  productId: string;
  type: AdjustmentType;
  quantity: number;
  note?: string | null;
}
export const stockAdjustmentSchema = z.object({
  productId: uuidSchema,
  type: z.enum(AdjustmentType),
  quantity: z.coerce.number().min(0).max(9_999_999.999),
  note: optionalText(300),
});

export interface MovementListQuery {
  productId?: string;
  type?: StockMovementType;
  page: number;
  pageSize: number;
}
export const movementListQuerySchema = paginationSchema.extend({
  productId: uuidSchema.optional(),
  type: z.enum(StockMovementType).optional(),
});

// ---------------------------------------------------------------- Internos (sales -> catalog)

export interface ProductLookupDto {
  tenantId: string;
  productIds: string[];
}
export const productLookupSchema = z.object({
  tenantId: uuidSchema,
  productIds: z.array(uuidSchema).min(1).max(200),
});

export interface StockApplyDto {
  tenantId: string;
  userId: string;
  referenceType: StockReferenceType;
  referenceId: string;
  movementType: StockMovementType.SALE | StockMovementType.SALE_VOID;
  allowNegative: boolean;
  items: { productId: string; quantity: number }[];
}
export const stockApplySchema = z.object({
  tenantId: uuidSchema,
  userId: uuidSchema,
  referenceType: z.enum(StockReferenceType),
  referenceId: uuidSchema,
  movementType: z.enum([StockMovementType.SALE, StockMovementType.SALE_VOID]),
  allowNegative: z.boolean().default(false),
  items: z.array(z.object({ productId: uuidSchema, quantity: quantitySchema })).min(1).max(200),
});
