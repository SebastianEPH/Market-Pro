import {
  CashSessionStatus,
  ModuleCode,
  PaymentMethod,
  PermissionAction,
  ProductUnit,
  SaleStatus,
  StockMovementType,
  TenantStatus,
  UserStatus,
} from '@market-pro/shared';

export const MODULE_LABELS: Record<ModuleCode, string> = {
  [ModuleCode.DASHBOARD]: 'Dashboard',
  [ModuleCode.USERS]: 'Usuarios',
  [ModuleCode.ROLES]: 'Roles y permisos',
  [ModuleCode.SETTINGS]: 'Configuración',
  [ModuleCode.CATEGORIES]: 'Categorías',
  [ModuleCode.PRODUCTS]: 'Productos',
  [ModuleCode.INVENTORY]: 'Inventario',
  [ModuleCode.POS]: 'Punto de venta',
  [ModuleCode.CASH_REGISTER]: 'Caja',
  [ModuleCode.SALES]: 'Ventas',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  [PermissionAction.CREATE]: 'Crear',
  [PermissionAction.READ]: 'Ver',
  [PermissionAction.UPDATE]: 'Editar',
  [PermissionAction.DELETE]: 'Eliminar',
};

export const ALL_ACTIONS: PermissionAction[] = [
  PermissionAction.CREATE,
  PermissionAction.READ,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Efectivo',
  [PaymentMethod.CARD]: 'Tarjeta',
  [PaymentMethod.TRANSFER]: 'Transferencia',
  [PaymentMethod.DIGITAL_WALLET]: 'Billetera digital',
};

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  [TenantStatus.ACTIVE]: 'Activa',
  [TenantStatus.SUSPENDED]: 'Suspendida',
  [TenantStatus.CANCELLED]: 'Cancelada',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'Activo',
  [UserStatus.INACTIVE]: 'Inactivo',
  [UserStatus.LOCKED]: 'Bloqueado',
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  [SaleStatus.COMPLETED]: 'Completada',
  [SaleStatus.VOIDED]: 'Anulada',
};

export const CASH_STATUS_LABELS: Record<CashSessionStatus, string> = {
  [CashSessionStatus.OPEN]: 'Abierta',
  [CashSessionStatus.CLOSED]: 'Cerrada',
};

export const UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: 'Unidad',
  [ProductUnit.KG]: 'Kilogramo',
  [ProductUnit.LT]: 'Litro',
  [ProductUnit.BOX]: 'Caja',
  [ProductUnit.PACK]: 'Paquete',
};

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  [StockMovementType.IN]: 'Entrada',
  [StockMovementType.OUT]: 'Salida',
  [StockMovementType.ADJUSTMENT]: 'Conteo',
  [StockMovementType.SALE]: 'Venta',
  [StockMovementType.SALE_VOID]: 'Anulación',
};
