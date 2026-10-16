import { inject, injectable } from 'inversify';
import { HeaderName, HttpMethod } from '@market-pro/shared';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { HttpStatus } from '../enums/core.enums.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/**
 * CORS a nivel de función. Si se configura CORS en el API Gateway real,
 * se puede dejar CORS_ORIGINS vacío y este middleware no agrega cabeceras.
 */
@injectable()
export class CorsMiddleware implements Middleware {
  constructor(@inject(CoreToken.Config) private readonly config: AppConfig) {}

  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    const headers = this.corsHeaders(request.header(HeaderName.ORIGIN));

    if (request.method === HttpMethod.OPTIONS) {
      return { statusCode: HttpStatus.NO_CONTENT, headers };
    }

    const result = await next();
    return { ...result, headers: { ...result.headers, ...headers } };
  }

  private corsHeaders(origin: string | undefined): Record<string, string> {
    const allowed = this.config.corsOrigins;
    if (allowed.length === 0 || !origin) return {};
    const allowOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : null;
    if (!allowOrigin) return {};
    return {
      'access-control-allow-origin': allowOrigin,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': `${HeaderName.AUTHORIZATION},${HeaderName.CONTENT_TYPE},${HeaderName.REQUEST_ID}`,
      'access-control-max-age': '600',
      vary: 'Origin',
    };
  }
}
