/**
 * Módulos del sistema. Deben coincidir con la tabla `modules` (sql/identity/003_seed_catalog.sql).
 * Todo el código está siempre desplegado: el acceso se controla con datos, en tiempo real.
 */
export enum ModuleCode {
  DASHBOARD = 'dashboard',
  USERS = 'users',
  ROLES = 'roles',
  SETTINGS = 'settings',
  CATEGORIES = 'categories',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  POS = 'pos',
  CASH_REGISTER = 'cash_register',
  SALES = 'sales',
}

/** Acciones CRUD; un permiso = módulo + acción (ej. `products:create`). */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

/** Características configurables por tenant (tabla `features`). */
export enum FeatureCode {
  SALES_DISCOUNTS = 'sales.discounts',
  SALES_VOID = 'sales.void',
  INVENTORY_NEGATIVE_STOCK = 'inventory.negative_stock',
  USERS_MAX = 'users.max',
  PRODUCTS_MAX = 'products.max',
}

export enum FeatureValueType {
  BOOLEAN = 'BOOLEAN',
  NUMBER = 'NUMBER',
}

/** Ámbito del token: administrador de plataforma o usuario de un tenant. */
export enum AuthScope {
  PLATFORM = 'platform',
  TENANT = 'tenant',
}

export enum PermissionEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

/** Comodín de permisos para el administrador de plataforma. */
export enum PermissionWildcard {
  ALL = '*',
}
