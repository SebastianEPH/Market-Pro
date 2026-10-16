import { inject, injectable } from 'inversify';
import { ApiErrorBody, ErrorCode } from '@market-pro/shared';
import { CoreToken } from '../di/core-token.enum.js';
import { HttpStatus } from '../enums/core.enums.js';
import { AppError } from '../errors/app-error.js';
import { mapDatabaseError } from '../errors/database-error.mapper.js';
import { ApiRequest } from '../http/api-request.js';
import { ApiResponse, HttpResult } from '../http/http-result.js';
import { Middleware, NextFunction } from '../http/middleware.js';
import { Logger } from '../logging/logger.js';

/** Convierte cualquier excepción en una respuesta JSON homogénea. */
@injectable()
export class ErrorHandlerMiddleware implements Middleware {
  constructor(@inject(CoreToken.Logger) private readonly logger: Logger) {}

  async handle(request: ApiRequest, next: NextFunction): Promise<HttpResult> {
    try {
      return await next();
    } catch (error) {
      const appError = error instanceof AppError ? error : mapDatabaseError(error);

      if (appError) {
        if (appError.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
          this.logger.error(appError.message, { requestId: request.requestId, code: appError.code });
        }
        return ApiResponse.json(appError.status, this.body(request, appError.code, appError.message, appError.details));
      }

      this.logger.error('Error no controlado', {
        requestId: request.requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return ApiResponse.json(
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.body(request, ErrorCode.INTERNAL_ERROR, 'Error interno del servidor'),
      );
    }
  }

  private body(request: ApiRequest, code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
    return { error: { code, message, details }, requestId: request.requestId };
  }
}
