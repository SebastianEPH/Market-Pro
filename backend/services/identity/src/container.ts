import { Container } from 'inversify';
import { ServiceName, createCoreContainer } from '@market-pro/core';
import { IdentityToken } from './identity-token.enum.js';
import { IAccessRepository, PgAccessRepository } from './repositories/access.repository.js';
import { ICatalogRepository, PgCatalogRepository } from './repositories/catalog.repository.js';
import { IPlatformUserRepository, PgPlatformUserRepository } from './repositories/platform-user.repository.js';
import { IRefreshTokenRepository, PgRefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { IRoleRepository, PgRoleRepository } from './repositories/role.repository.js';
import { ITenantRepository, PgTenantRepository } from './repositories/tenant.repository.js';
import { IUserRepository, PgUserRepository } from './repositories/user.repository.js';
import { IPasswordHasher, ScryptPasswordHasher } from './security/password-hasher.js';
import { AccessService } from './services/access.service.js';
import { AuthService } from './services/auth.service.js';
import { ModuleService } from './services/module.service.js';
import { RoleService } from './services/role.service.js';
import { TenantService } from './services/tenant.service.js';
import { UserService } from './services/user.service.js';

export function createIdentityContainer(): Container {
  // identity resuelve permisos contra su propia BD (sin llamada HTTP ni caché)
  const container = createCoreContainer({ serviceName: ServiceName.IDENTITY, accessResolver: AccessService });

  container.bind<IPasswordHasher>(IdentityToken.PasswordHasher).to(ScryptPasswordHasher).inSingletonScope();

  container.bind<ICatalogRepository>(IdentityToken.CatalogRepository).to(PgCatalogRepository).inSingletonScope();
  container.bind<ITenantRepository>(IdentityToken.TenantRepository).to(PgTenantRepository).inSingletonScope();
  container
    .bind<IPlatformUserRepository>(IdentityToken.PlatformUserRepository)
    .to(PgPlatformUserRepository)
    .inSingletonScope();
  container.bind<IUserRepository>(IdentityToken.UserRepository).to(PgUserRepository).inSingletonScope();
  container.bind<IRoleRepository>(IdentityToken.RoleRepository).to(PgRoleRepository).inSingletonScope();
  container.bind<IAccessRepository>(IdentityToken.AccessRepository).to(PgAccessRepository).inSingletonScope();
  container
    .bind<IRefreshTokenRepository>(IdentityToken.RefreshTokenRepository)
    .to(PgRefreshTokenRepository)
    .inSingletonScope();

  container.bind<AccessService>(IdentityToken.AccessService).to(AccessService).inSingletonScope();
  container.bind<AuthService>(IdentityToken.AuthService).to(AuthService).inSingletonScope();
  container.bind<TenantService>(IdentityToken.TenantService).to(TenantService).inSingletonScope();
  container.bind<ModuleService>(IdentityToken.ModuleService).to(ModuleService).inSingletonScope();
  container.bind<UserService>(IdentityToken.UserService).to(UserService).inSingletonScope();
  container.bind<RoleService>(IdentityToken.RoleService).to(RoleService).inSingletonScope();

  return container;
}
