import { injectable } from 'inversify';
import { ErrorCode, PermissionWildcard, hasPermission, permissionCode } from '@market-pro/shared';
import { ForbiddenError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/**
 * Verifica los permisos CRUD declarados con @Permission (basta uno).
 * Distingue entre "módulo deshabilitado para la tienda" y "usuario sin permiso".
 */
@injectable()
export class PermissionMiddleware implements Middleware {
  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    const required = request.route?.permissions ?? [];
    if (required.length === 0) return next();

    const access = request.requireAccess();
    if (access.permissions.includes(PermissionWildcard.ALL)) return next();

    if (required.some((req) => hasPermission(access, req.module, req.action))) {
      return next();
    }

    const anyModuleEnabled = required.some((req) => access.enabledModules.includes(req.module));
    if (!anyModuleEnabled) {
      throw new ForbiddenError(ErrorCode.MODULE_DISABLED, 'El módulo no está habilitado para esta tienda', {
        modules: [...new Set(required.map((req) => req.module))],
      });
    }

    throw new ForbiddenError(ErrorCode.PERMISSION_DENIED, 'No tienes permiso para realizar esta acción', {
      required: required.map((req) => permissionCode(req.module, req.action)),
    });
  }
}
