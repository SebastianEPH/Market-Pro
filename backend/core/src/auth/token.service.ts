import { randomUUID } from 'node:crypto';
import { inject, injectable } from 'inversify';
import { SignJWT, errors, jwtVerify } from 'jose';
import { AuthScope, ErrorCode } from '@market-pro/shared';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { Principal } from './principal.js';

enum JwtAlgorithm {
  HS256 = 'HS256',
}

/**
 * Emite y valida access tokens (JWT HS256 con secreto compartido entre
 * microservicios). Para producción se puede migrar a RS256/JWKS cambiando
 * solo esta clase.
 */
@injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(@inject(CoreToken.Config) private readonly config: AppConfig) {
    this.secret = new TextEncoder().encode(config.jwtSecret);
  }

  async signAccessToken(principal: Principal): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return new SignJWT({
      scope: principal.scope,
      tid: principal.tenantId,
      email: principal.email,
      name: principal.name,
    })
      .setProtectedHeader({ alg: JwtAlgorithm.HS256, typ: 'JWT' })
      .setSubject(principal.subjectId)
      .setIssuer(this.config.jwtIssuer)
      .setAudience(this.config.jwtAudience)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + this.config.accessTokenTtlSeconds)
      .setJti(randomUUID())
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
        algorithms: [JwtAlgorithm.HS256],
      });
      const scope = payload['scope'];
      if (!payload.sub || (scope !== AuthScope.PLATFORM && scope !== AuthScope.TENANT)) {
        throw new UnauthorizedError();
      }
      return {
        subjectId: payload.sub,
        scope: scope as AuthScope,
        tenantId: typeof payload['tid'] === 'string' ? payload['tid'] : null,
        email: String(payload['email'] ?? ''),
        name: String(payload['name'] ?? ''),
      };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new UnauthorizedError(ErrorCode.TOKEN_EXPIRED, 'La sesión expiró');
      }
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Token inválido');
    }
  }
}
