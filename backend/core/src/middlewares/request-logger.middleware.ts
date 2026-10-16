import { inject, injectable } from 'inversify';
import { CoreToken } from '../di/core-token.enum.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';
import { Logger } from '../logging/logger.js';

/** Registra cada request con su duración, estado y contexto de tenant/usuario. */
@injectable()
export class RequestLoggerMiddleware implements Middleware {
  constructor(@inject(CoreToken.Logger) private readonly logger: Logger) {}

  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    try {
      const result = await next();
      this.log(request, result.statusCode ?? 200);
      return result;
    } catch (error) {
      this.log(request, 500);
      throw error;
    }
  }

  private log(request: ApiRequest, status: number): void {
    this.logger.info('request', {
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      route: request.route?.routeKey,
      status,
      durationMs: Date.now() - request.startedAt,
      tenantId: request.principal?.tenantId ?? undefined,
      userId: request.principal?.subjectId,
    });
  }
}
