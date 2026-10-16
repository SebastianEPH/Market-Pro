import { injectable } from 'inversify';
import { HeaderName, HttpMethod } from '@market-pro/shared';
import { BadRequestError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

/** Parsea el body JSON del evento (API Gateway entrega siempre un string). */
@injectable()
export class JsonBodyMiddleware implements Middleware {
  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    if (request.method === HttpMethod.GET || request.method === HttpMethod.HEAD || !request.rawBody) {
      return next();
    }

    const contentType = request.header(HeaderName.CONTENT_TYPE) ?? 'application/json';
    if (!contentType.includes('json')) {
      throw new BadRequestError('Solo se acepta Content-Type application/json');
    }

    try {
      request.body = JSON.parse(request.rawBody);
    } catch {
      throw new BadRequestError('El cuerpo no es un JSON válido');
    }
    return next();
  }
}
