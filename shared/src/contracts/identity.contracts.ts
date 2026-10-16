import { AuthScope, ModuleCode, PermissionAction } from '../enums/access.enums.js';
import { TenantStatus, UserStatus } from '../enums/domain.enums.js';
import { AccessProfile, PermissionOverride, TenantSettings } from './access.contracts.js';

export interface LoginRequest {
  tenantSlug?: string;
  email: string;
  password: string;
}

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

export interface AuthUserView {
  id: string;
  email: string;
  fullName: string;
  scope: AuthScope;
  isOwner: boolean;
  tenant: TenantSummary | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserView;
  access: AccessProfile;
}

export interface MeResponse {
  user: AuthUserView;
  access: AccessProfile;
}

export interface TenantView {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: TenantStatus;
  planName: string | null;
  settings: TenantSettings;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantModuleConfig {
  moduleCode: ModuleCode;
  isEnabled: boolean;
  expiresAt: string | null;
  actions: PermissionAction[];
}

export interface TenantFeatureConfig {
  featureCode: string;
  isEnabled: boolean;
  limit: number | null;
}

export interface RoleSummary {
  id: string;
  name: string;
}

export interface UserView {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  documentNumber: string | null;
  phone: string | null;
  status: UserStatus;
  isOwner: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleSummary[];
}

export interface UserDetailView extends UserView {
  permissionOverrides: PermissionOverride[];
}

export interface TenantDetailView extends TenantView {
  modules: TenantModuleConfig[];
  features: TenantFeatureConfig[];
  owner: UserView | null;
  userCount: number;
}

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}
