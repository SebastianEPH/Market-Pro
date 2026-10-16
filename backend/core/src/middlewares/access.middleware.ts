import { inject, injectable } from 'inversify';
import { AuthScope, ErrorCode, TenantStatus } from '@market-pro/shared';
import { IAccessResolver } from '../access/access-resolver.js';
import { CoreToken } from '../di/core-token.enum.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/**
 * Carga el perfil de acceso EN TIEMPO REAL (no confía en lo que diga el JWT):
 * si el administrador de plataforma suspende un tenant, desactiva un módulo
 * o el comprador bloquea a un usuario, el cambio aplica en el siguiente request.
 */
@injectable()
export class AccessMiddleware implements Middleware {
  constructor(@inject(CoreToken.AccessResolver) private readonly resolver: IAccessResolver) {}

  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    if (!request.principal) return next();

    const access = await this.resolver.resolve(request.principal, request.requestId);

    if (!access.isActive) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'El usuario está inactivo o bloqueado');
    }
    if (access.scope === AuthScope.TENANT && access.tenantStatus !== TenantStatus.ACTIVE) {
      throw new ForbiddenError(ErrorCode.TENANT_SUSPENDED, 'La tienda está suspendida. Contacte a su proveedor.');
    }

    request.access = access;
    return next();
  }
}
