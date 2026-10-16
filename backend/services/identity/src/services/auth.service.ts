import { randomBytes } from 'node:crypto';
import { inject, injectable } from 'inversify';
import {
  AppConfig,
  BadRequestError,
  CoreToken,
  Database,
  ForbiddenError,
  Principal,
  TokenService,
  UnauthorizedError,
} from '@market-pro/core';
import {
  AuthScope,
  AuthSession,
  AuthUserView,
  ErrorCode,
  MeResponse,
  TenantStatus,
  TenantView,
  UserStatus,
} from '@market-pro/shared';
import { IdentityToken } from '../identity-token.enum.js';
import { IPlatformUserRepository } from '../repositories/platform-user.repository.js';
import { IRefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { ITenantRepository } from '../repositories/tenant.repository.js';
import { IUserRepository, UserRecord } from '../repositories/user.repository.js';
import { ChangePasswordDto, LoginDto } from '../schemas/identity.schemas.js';
import { IPasswordHasher, sha256 } from '../security/password-hasher.js';
import { AccessService } from './access.service.js';

export interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface SessionSubject {
  principal: Principal;
  user: AuthUserView;
}

@injectable()
export class AuthService {
  constructor(
    @inject(CoreToken.Config) private readonly config: AppConfig,
    @inject(CoreToken.Database) private readonly db: Database,
    @inject(CoreToken.TokenService) private readonly tokens: TokenService,
    @inject(IdentityToken.PasswordHasher) private readonly hasher: IPasswordHasher,
    @inject(IdentityToken.TenantRepository) private readonly tenants: ITenantRepository,
    @inject(IdentityToken.UserRepository) private readonly users: IUserRepository,
    @inject(IdentityToken.PlatformUserRepository) private readonly platformUsers: IPlatformUserRepository,
    @inject(IdentityToken.RefreshTokenRepository) private readonly refreshTokens: IRefreshTokenRepository,
    @inject(IdentityToken.AccessService) private readonly accessService: AccessService,
  ) {}

  /** Login de tenant (con tenantSlug) o de plataforma (sin tenantSlug). */
  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthSession> {
    const subject = dto.tenantSlug ? await this.loginTenant(dto) : await this.loginPlatform(dto);
    return this.issueSession(subject, meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthSession> {
    const record = await this.db.withGlobal((tx) => this.refreshTokens.findByHash(tx, sha256(refreshToken)));
    if (!record) throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Sesión inválida');

    if (record.revokedAt) {
      // Reutilización de un token ya rotado: posible robo -> se revocan todas las sesiones
      await this.db.withGlobal((tx) => this.refreshTokens.revokeAllForSubject(tx, record.subjectId));
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Sesión revocada');
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedError(ErrorCode.TOKEN_EXPIRED, 'La sesión expiró');
    }

    const subject =
      record.scope === AuthScope.PLATFORM
        ? await this.platformSubjectById(record.subjectId)
        : await this.tenantSubjectById(record.tenantId, record.subjectId);

    const session = await this.issueSession(subject, meta, record.id);
    return session;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db.withGlobal(async (tx) => {
      const record = await this.refreshTokens.findByHash(tx, sha256(refreshToken));
      if (record) await this.refreshTokens.revoke(tx, record.id);
    });
  }

  async me(principal: Principal): Promise<MeResponse> {
    const subject =
      principal.scope === AuthScope.PLATFORM
        ? await this.platformSubjectById(principal.subjectId)
        : await this.tenantSubjectById(principal.tenantId, principal.subjectId);
    return { user: subject.user, access: await this.accessService.resolve(subject.principal) };
  }

  async changePassword(principal: Principal, dto: ChangePasswordDto): Promise<void> {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestError('La nueva contraseña debe ser distinta a la actual');
    }
    const newHash = await this.hasher.hash(dto.newPassword);

    if (principal.scope === AuthScope.PLATFORM) {
      await this.db.withGlobal(async (tx) => {
        const user = await this.platformUsers.findById(tx, principal.subjectId);
        if (!user || !(await this.hasher.verify(dto.currentPassword, user.passwordHash))) {
          throw new BadRequestError('La contraseña actual no es correcta');
        }
        await this.platformUsers.updatePassword(tx, user.id, newHash);
        await this.refreshTokens.revokeAllForSubject(tx, user.id);
      });
      return;
    }

    const tenantId = principal.tenantId;
    if (!tenantId) throw new UnauthorizedError();
    await this.db.withTenant(tenantId, async (tx) => {
      const user = await this.users.findById(tx, principal.subjectId);
      if (!user || !(await this.hasher.verify(dto.currentPassword, user.passwordHash))) {
        throw new BadRequestError('La contraseña actual no es correcta');
      }
      await this.users.update(tx, user.id, { passwordHash: newHash });
    });
    await this.db.withGlobal((tx) => this.refreshTokens.revokeAllForSubject(tx, principal.subjectId));
  }

  // ------------------------------------------------------------------ privados

  private async loginPlatform(dto: LoginDto): Promise<SessionSubject> {
    const user = await this.db.withGlobal((tx) => this.platformUsers.findByEmail(tx, dto.email));
    if (!user || !(await this.hasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS, 'Credenciales inválidas');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Usuario inactivo');
    }
    await this.db.withGlobal((tx) => this.platformUsers.touchLogin(tx, user.id));
    return {
      principal: { subjectId: user.id, scope: AuthScope.PLATFORM, tenantId: null, email: user.email, name: user.fullName },
      user: { id: user.id, email: user.email, fullName: user.fullName, scope: AuthScope.PLATFORM, isOwner: false, tenant: null },
    };
  }

  private async loginTenant(dto: LoginDto): Promise<SessionSubject> {
    const tenant = await this.db.withGlobal((tx) => this.tenants.findBySlug(tx, dto.tenantSlug ?? ''));
    if (!tenant) throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS, 'Credenciales inválidas');

    const user = await this.db.withTenant(tenant.id, (tx) => this.users.findByEmail(tx, dto.email));
    if (!user || !(await this.hasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedError(ErrorCode.INVALID_CREDENTIALS, 'Credenciales inválidas');
    }
    this.assertTenantUsable(tenant, user);
    await this.db.withTenant(tenant.id, (tx) => this.users.touchLogin(tx, user.id));
    return this.tenantSubject(tenant, user);
  }

  private async platformSubjectById(subjectId: string): Promise<SessionSubject> {
    const user = await this.db.withGlobal((tx) => this.platformUsers.findById(tx, subjectId));
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedError();
    return {
      principal: { subjectId: user.id, scope: AuthScope.PLATFORM, tenantId: null, email: user.email, name: user.fullName },
      user: { id: user.id, email: user.email, fullName: user.fullName, scope: AuthScope.PLATFORM, isOwner: false, tenant: null },
    };
  }

  private async tenantSubjectById(tenantId: string | null, userId: string): Promise<SessionSubject> {
    if (!tenantId) throw new UnauthorizedError();
    const tenant = await this.db.withGlobal((tx) => this.tenants.findById(tx, tenantId));
    const user = await this.db.withTenant(tenantId, (tx) => this.users.findById(tx, userId));
    if (!tenant || !user) throw new UnauthorizedError();
    this.assertTenantUsable(tenant, user);
    return this.tenantSubject(tenant, user);
  }

  private assertTenantUsable(tenant: TenantView, user: UserRecord): void {
    const expired = tenant.expiresAt !== null && new Date(tenant.expiresAt).getTime() <= Date.now();
    if (tenant.status !== TenantStatus.ACTIVE || expired) {
      throw new ForbiddenError(ErrorCode.TENANT_SUSPENDED, 'La tienda está suspendida. Contacte a su proveedor.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Usuario inactivo o bloqueado');
    }
  }

  private tenantSubject(tenant: TenantView, user: UserRecord): SessionSubject {
    return {
      principal: { subjectId: user.id, scope: AuthScope.TENANT, tenantId: tenant.id, email: user.email, name: user.fullName },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        scope: AuthScope.TENANT,
        isOwner: user.isOwner,
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      },
    };
  }

  private async issueSession(subject: SessionSubject, meta: ClientMeta, rotatedFromId?: string): Promise<AuthSession> {
    const accessToken = await this.tokens.signAccessToken(subject.principal);
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000);

    await this.db.withGlobal(async (tx) => {
      const newId = await this.refreshTokens.create(tx, {
        scope: subject.principal.scope,
        subjectId: subject.principal.subjectId,
        tenantId: subject.principal.tenantId,
        tokenHash: sha256(refreshToken),
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      });
      if (rotatedFromId) await this.refreshTokens.revoke(tx, rotatedFromId, newId);
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenTtlSeconds,
      user: subject.user,
      access: await this.accessService.resolve(subject.principal),
    };
  }
}
