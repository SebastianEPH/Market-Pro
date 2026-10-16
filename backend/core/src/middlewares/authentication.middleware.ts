import { timingSafeEqual } from 'node:crypto';
import { inject, injectable } from 'inversify';
import { AuthScope, ErrorCode, HeaderName } from '@market-pro/shared';
import { TokenService } from '../auth/token.service.js';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { RouteScope } from '../enums/core.enums.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/**
 * Autenticación según el ámbito de la ruta:
 *  - PUBLIC: nada.
 *  - INTERNAL: valida la clave compartida entre microservicios.
 *  - resto: valida el JWT Bearer y el tipo de usuario (plataforma / tenant).
 */
@injectable()
export class AuthenticationMiddleware implements Middleware {
  private readonly internalKey: Buffer;

  constructor(
    @inject(CoreToken.TokenService) private readonly tokens: TokenService,
    @inject(CoreToken.Config) config: AppConfig,
  ) {
    this.internalKey = Buffer.from(config.internalApiKey);
  }

  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    const scope = request.route?.scope ?? RouteScope.TENANT;

    if (scope === RouteScope.PUBLIC) return next();

    if (scope === RouteScope.INTERNAL) {
      this.assertInternalKey(request.header(HeaderName.INTERNAL_KEY));
      return next();
    }

    const authorization = request.header(HeaderName.AUTHORIZATION);
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Falta el token de acceso');
    }
    const principal = await this.tokens.verifyAccessToken(authorization.slice('Bearer '.length).trim());

    if (scope === RouteScope.PLATFORM && principal.scope !== AuthScope.PLATFORM) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Solo disponible para el administrador de plataforma');
    }
    if (scope === RouteScope.TENANT && principal.scope !== AuthScope.TENANT) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Solo disponible para usuarios de una tienda');
    }

    request.principal = principal;
    return next();
  }

  private assertInternalKey(received: string | undefined): void {
    const candidate = Buffer.from(received ?? '');
    if (candidate.length !== this.internalKey.length || !timingSafeEqual(candidate, this.internalKey)) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Llamada interna no autorizada');
    }
  }
}
