import { FeatureCode, ModuleCode, PermissionAction, PermissionWildcard } from '../enums/access.enums.js';
import { AccessProfile, FeatureState } from '../contracts/access.contracts.js';

export function permissionCode(module: ModuleCode, action: PermissionAction): string {
  return `${module}:${action}`;
}

export function parsePermissionCode(code: string): { module: ModuleCode; action: PermissionAction } {
  const [module, action] = code.split(':');
  return { module: module as ModuleCode, action: action as PermissionAction };
}

export function hasPermission(access: AccessProfile | null | undefined, module: ModuleCode, action: PermissionAction): boolean {
  if (!access) return false;
  if (access.permissions.includes(PermissionWildcard.ALL)) return true;
  return access.permissions.includes(permissionCode(module, action));
}

export function hasModule(access: AccessProfile | null | undefined, module: ModuleCode): boolean {
  if (!access) return false;
  if (access.permissions.includes(PermissionWildcard.ALL)) return true;
  return access.modules.includes(module);
}

export function getFeature(access: AccessProfile | null | undefined, feature: FeatureCode): FeatureState {
  return access?.features[feature] ?? { enabled: false, limit: null };
}

export function isFeatureEnabled(access: AccessProfile | null | undefined, feature: FeatureCode): boolean {
  if (access?.permissions.includes(PermissionWildcard.ALL)) return true;
  return getFeature(access, feature).enabled;
}
