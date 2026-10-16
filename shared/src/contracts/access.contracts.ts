import { AuthScope, FeatureValueType, ModuleCode, PermissionAction, PermissionEffect } from '../enums/access.enums.js';
import { TenantStatus } from '../enums/domain.enums.js';

export interface FeatureState {
  enabled: boolean;
  limit: number | null;
}

export interface TenantSettings {
  currency: string;
  taxRate: number;
  taxIncluded: boolean;
  timezone: string;
  receiptFooter: string | null;
}

/**
 * Perfil de acceso efectivo de un usuario, resuelto en tiempo real por el
 * microservicio identity. Lo consumen tanto los demás microservicios
 * (middlewares) como los frontends (menús y botones).
 */
export interface AccessProfile {
  scope: AuthScope;
  subjectId: string;
  tenantId: string | null;
  tenantStatus: TenantStatus | null;
  isActive: boolean;
  isOwner: boolean;
  /** Módulos habilitados para el tenant por el administrador de plataforma. */
  enabledModules: ModuleCode[];
  /** Módulos a los que el usuario tiene al menos un permiso. */
  modules: ModuleCode[];
  /** Códigos `modulo:accion` efectivos (o `*` para plataforma). */
  permissions: string[];
  features: Record<string, FeatureState>;
  settings: TenantSettings | null;
  resolvedAt: string;
}

export interface PermissionView {
  id: string;
  code: string;
  moduleCode: ModuleCode;
  action: PermissionAction;
  description: string | null;
}

export interface FeatureView {
  code: string;
  moduleCode: ModuleCode;
  name: string;
  description: string | null;
  valueType: FeatureValueType;
  defaultEnabled: boolean;
  defaultLimit: number | null;
}

export interface ModuleView {
  code: ModuleCode;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  permissions: PermissionView[];
  features: FeatureView[];
}

/** Permisos que un tenant puede repartir entre sus usuarios (su techo). */
export interface AvailableModulePermissions {
  moduleCode: ModuleCode;
  moduleName: string;
  actions: PermissionAction[];
}

export interface PermissionOverride {
  code: string;
  effect: PermissionEffect;
}
