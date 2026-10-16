/** Identificadores de inyección propios del microservicio identity. */
export enum IdentityToken {
  PasswordHasher = 'identity.PasswordHasher',
  CatalogRepository = 'identity.CatalogRepository',
  TenantRepository = 'identity.TenantRepository',
  PlatformUserRepository = 'identity.PlatformUserRepository',
  UserRepository = 'identity.UserRepository',
  RoleRepository = 'identity.RoleRepository',
  AccessRepository = 'identity.AccessRepository',
  RefreshTokenRepository = 'identity.RefreshTokenRepository',
  AccessService = 'identity.AccessService',
  AuthService = 'identity.AuthService',
  TenantService = 'identity.TenantService',
  ModuleService = 'identity.ModuleService',
  UserService = 'identity.UserService',
  RoleService = 'identity.RoleService',
}
