import { injectable } from 'inversify';
import { ErrorCode, isFeatureEnabled } from '@market-pro/shared';
import { ForbiddenError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/** Verifica las características exigidas con @RequireFeature (todas). */
@injectable()
export class FeatureMiddleware implements Middleware {
  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    const features = request.route?.features ?? [];
    if (features.length === 0) return next();

    const access = request.requireAccess();
    const disabled = features.filter((feature) => !isFeatureEnabled(access, feature));
    if (disabled.length > 0) {
      throw new ForbiddenError(ErrorCode.FEATURE_DISABLED, 'Esta característica no está habilitada para la tienda', {
        features: disabled,
      });
    }
    return next();
  }
}
