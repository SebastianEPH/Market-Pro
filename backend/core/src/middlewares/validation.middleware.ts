import { injectable } from 'inversify';
import { z } from 'zod';
import { ApiErrorDetail } from '@market-pro/shared';
import { ValidationError } from '../errors/app-error.js';
import { ApiRequest } from '../http/api-request.js';
import { HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';

function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || undefined,
    message: issue.message,
  }));
}

/** Valida body y query con los esquemas zod declarados con @Body / @Query. */
@injectable()
export class ValidationMiddleware implements Middleware {
  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    const route = request.route;

    if (route?.querySchema) {
      const parsed = route.querySchema.safeParse(request.query);
      if (!parsed.success) throw new ValidationError(toDetails(parsed.error), 'Parámetros de consulta inválidos');
      request.parsedQuery = parsed.data;
    }

    if (route?.bodySchema) {
      const parsed = route.bodySchema.safeParse(request.body ?? {});
      if (!parsed.success) throw new ValidationError(toDetails(parsed.error));
      request.body = parsed.data;
    }

    return next();
  }
}
