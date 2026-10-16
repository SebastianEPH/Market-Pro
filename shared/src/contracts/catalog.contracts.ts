import { ProductUnit, StockMovementType } from '../enums/domain.enums.js';

export interface CategoryView {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export interface ProductView {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  unit: ProductUnit;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementView {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  stockAfter: number | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Respuesta interna catalog -> sales para armar una venta. */
export interface ProductLookupItem {
  id: string;
  sku: string;
  name: string;
  unit: ProductUnit;
  salePrice: number;
  stock: number;
  isActive: boolean;
}

export interface StockApplyItem {
  productId: string;
  quantity: number;
}
