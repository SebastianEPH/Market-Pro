import { z } from 'zod';
import { optionalQueryText, paginationSchema, uuidSchema } from '@market-pro/core';
import {
  AuthScope,
  FeatureCode,
  ModuleCode,
  PermissionAction,
  PermissionEffect,
  TenantSettings,
  TenantStatus,
  UserStatus,
} from '@market-pro/shared';

const email = z.string().trim().toLowerCase().pipe(z.email({ message: 'Email inválido' }));
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const isoDate = z.iso.datetime({ offset: true }).nullable().optional();

// ---------------------------------------------------------------- Auth

export interface LoginDto {
  tenantSlug?: string;
  email: string;
  password: string;
}
export const loginSchema = z.object({
  tenantSlug: z.string().trim().toLowerCase().min(3).max(50).optional(),
  email,
  password: z.string().min(1).max(128),
});

export interface RefreshDto {
  refreshToken: string;
}
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export interface ResolveAccessDto {
  scope: AuthScope;
  subjectId: string;
  tenantId: string | null;
}
export const resolveAccessSchema = z.object({
  scope: z.enum(AuthScope),
  subjectId: uuidSchema,
  tenantId: uuidSchema.nullable(),
});

// ---------------------------------------------------------------- Tenants (plataforma)

export const settingsSchema = z.object({
  currency: z.string().trim().length(3).toUpperCase().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  taxIncluded: z.boolean().optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  receiptFooter: optionalText(300),
});

export interface ModuleConfigDto {
  moduleCode: ModuleCode;
  isEnabled: boolean;
  actions: PermissionAction[];
  expiresAt?: string | null;
}
const moduleConfigSchema = z.object({
  moduleCode: z.enum(ModuleCode),
  isEnabled: z.boolean(),
  actions: z.array(z.enum(PermissionAction)).max(4),
  expiresAt: isoDate,
});

export interface FeatureConfigDto {
  featureCode: FeatureCode;
  isEnabled: boolean;
  limit?: number | null;
}
const featureConfigSchema = z.object({
  featureCode: z.enum(FeatureCode),
  isEnabled: z.boolean(),
  limit: z.number().int().min(0).nullable().optional(),
});

export interface CreateTenantDto {
  slug: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  planName?: string | null;
  expiresAt?: string | null;
  settings?: Partial<TenantSettings>;
  owner: { email: string; fullName: string; password: string };
  modules?: ModuleConfigDto[];
  features?: FeatureConfigDto[];
}
export const createTenantSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Solo minúsculas, números y guiones (3-50 caracteres)'),
  name: z.string().trim().min(2).max(120),
  legalName: optionalText(200),
  taxId: optionalText(20),
  contactEmail: email.nullable().optional(),
  contactPhone: optionalText(30),
  planName: optionalText(60),
  expiresAt: isoDate,
  settings: settingsSchema.optional(),
  owner: z.object({ email, fullName: z.string().trim().min(2).max(120), password }),
  modules: z.array(moduleConfigSchema).optional(),
  features: z.array(featureConfigSchema).optional(),
});

export interface UpdateTenantDto {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  planName?: string | null;
  expiresAt?: string | null;
  settings?: Partial<TenantSettings>;
}
export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  legalName: optionalText(200),
  taxId: optionalText(20),
  contactEmail: email.nullable().optional(),
  contactPhone: optionalText(30),
  planName: optionalText(60),
  expiresAt: isoDate,
  settings: settingsSchema.optional(),
});

export interface TenantStatusDto {
  status: TenantStatus;
}
export const tenantStatusSchema = z.object({ status: z.enum(TenantStatus) });

export interface TenantModulesDto {
  modules: ModuleConfigDto[];
}
export const tenantModulesSchema = z.object({ modules: z.array(moduleConfigSchema).min(1) });

export interface TenantFeaturesDto {
  features: FeatureConfigDto[];
}
export const tenantFeaturesSchema = z.object({ features: z.array(featureConfigSchema).min(1) });

export interface ResetPasswordDto {
  password: string;
}
export const resetPasswordSchema = z.object({ password });

export interface ModuleActiveDto {
  isActive: boolean;
}
export const moduleActiveSchema = z.object({ isActive: z.boolean() });

export interface TenantListQuery {
  search?: string;
  status?: TenantStatus;
  page: number;
  pageSize: number;
}
export const tenantListQuerySchema = paginationSchema.extend({
  search: optionalQueryText,
  status: z.enum(TenantStatus).optional(),
});

// ---------------------------------------------------------------- Usuarios (tenant)

export interface UserListQuery {
  search?: string;
  status?: UserStatus;
  page: number;
  pageSize: number;
}
export const userListQuerySchema = paginationSchema.extend({
  search: optionalQueryText,
  status: z.enum(UserStatus).optional(),
});

export interface CreateUserDto {
  email: string;
  fullName: string;
  password: string;
  documentNumber?: string | null;
  phone?: string | null;
  roleIds?: string[];
}
export const createUserSchema = z.object({
  email,
  fullName: z.string().trim().min(2).max(120),
  password,
  documentNumber: optionalText(20),
  phone: optionalText(30),
  roleIds: z.array(uuidSchema).max(20).optional(),
});

export interface UpdateUserDto {
  fullName?: string;
  documentNumber?: string | null;
  phone?: string | null;
  status?: UserStatus;
  password?: string;
}
export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  documentNumber: optionalText(20),
  phone: optionalText(30),
  status: z.enum(UserStatus).optional(),
  password: password.optional(),
});

export interface UserRolesDto {
  roleIds: string[];
}
export const userRolesSchema = z.object({ roleIds: z.array(uuidSchema).max(20) });

export interface UserPermissionsDto {
  overrides: { code: string; effect: PermissionEffect }[];
}
export const userPermissionsSchema = z.object({
  overrides: z
    .array(z.object({ code: z.string().regex(/^[a-z_]+:(create|read|update|delete)$/), effect: z.enum(PermissionEffect) }))
    .max(200),
});

// ---------------------------------------------------------------- Roles (tenant)

export interface RoleDto {
  name: string;
  description?: string | null;
  permissions: string[];
}
const permissionCodes = z.array(z.string().regex(/^[a-z_]+:(create|read|update|delete)$/)).max(200);
export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(200),
  permissions: permissionCodes.default([]),
});

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
  permissions?: string[];
}
export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: optionalText(200),
  permissions: permissionCodes.optional(),
});

// ---------------------------------------------------------------- Configuración (tenant)

export interface UpdateSettingsDto extends Partial<TenantSettings> {}
export const updateSettingsSchema = settingsSchema;
