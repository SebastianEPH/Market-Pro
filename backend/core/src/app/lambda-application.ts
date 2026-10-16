import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { Container } from 'inversify';
import { ErrorCode } from '@market-pro/shared';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { HttpStatus } from '../enums/core.enums.js';
import { ApiRequest } from '../http/api-request.js';
import { ApiResponse, HttpResult } from '../http/http-result.js';
import { Middleware, runPipeline } from '../http/middleware.js';
import { Logger } from '../logging/logger.js';
import { AccessMiddleware } from '../middlewares/access.middleware.js';
import { AuthenticationMiddleware } from '../middlewares/authentication.middleware.js';
import { CorsMiddleware } from '../middlewares/cors.middleware.js';
import { ErrorHandlerMiddleware } from '../middlewares/error-handler.middleware.js';
import { FeatureMiddleware } from '../middlewares/feature.middleware.js';
import { JsonBodyMiddleware } from '../middlewares/json-body.middleware.js';
import { PermissionMiddleware } from '../middlewares/permission.middleware.js';
import { RequestLoggerMiddleware } from '../middlewares/request-logger.middleware.js';
import { ValidationMiddleware } from '../middlewares/validation.middleware.js';
import { Router } from '../routing/router.js';
import { Constructor } from '../utils/constructor.js';

/** Firma de un handler Lambda para API Gateway HTTP API (payload v2). */
export interface LambdaHttpHandler {
  (event: APIGatewayProxyEventV2, context: Context): Promise<HttpResult>;
}

export interface LambdaApplicationOptions {
  controllers: Constructor[];
  /** Middlewares adicionales que corren justo antes del controlador. */
  middlewares?: Constructor<Middleware>[];
}

/**
 * Aplicación de un microservicio. Convierte el evento de API Gateway v2 en un
 * ApiRequest, ejecuta la cadena de middlewares y despacha al controlador.
 *
 *   logger -> cors -> errores -> [router] -> json -> auth -> acceso
 *          -> permisos -> features -> validación -> (custom) -> controlador
 */
export class LambdaApplication {
  private readonly router: Router;
  private readonly globalMiddlewares: Middleware[];
  private readonly routeMiddlewares: Middleware[];
  private readonly logger: Logger;

  constructor(
    private readonly container: Container,
    options: LambdaApplicationOptions,
  ) {
    const config = container.get<AppConfig>(CoreToken.Config);
    this.logger = container.get<Logger>(CoreToken.Logger);

    for (const controller of options.controllers) {
      if (!container.isBound(controller)) container.bind(controller).toSelf().inSingletonScope();
    }
    for (const middleware of options.middlewares ?? []) {
      if (!container.isBound(middleware)) container.bind(middleware).toSelf().inSingletonScope();
    }

    this.router = new Router(config.basePath);
    this.router.register(options.controllers);

    this.globalMiddlewares = [
      container.get(RequestLoggerMiddleware),
      container.get(CorsMiddleware),
      container.get(ErrorHandlerMiddleware),
    ];
    this.routeMiddlewares = [
      container.get(JsonBodyMiddleware),
      container.get(AuthenticationMiddleware),
      container.get(AccessMiddleware),
      container.get(PermissionMiddleware),
      container.get(FeatureMiddleware),
      container.get(ValidationMiddleware),
      ...(options.middlewares ?? []).map((middleware) => container.get<Middleware>(middleware)),
    ];

    this.logger.debug('Rutas registradas', { routes: this.router.list().map((route) => route.routeKey) });
  }

  /** Handler exportable directamente como `export const handler = app.handler`. */
  readonly handler: LambdaHttpHandler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
      const request = new ApiRequest(event, context);
      return await runPipeline(this.globalMiddlewares, request, async () => {
        const match = this.router.match(request.method, request.path);
        request.route = match.route;
        request.params = match.params;
        return runPipeline(this.routeMiddlewares, request, () => this.dispatch(request));
      });
    } catch (error) {
      this.logger.error('Fallo fuera del pipeline', { error: error instanceof Error ? error.message : String(error) });
      return ApiResponse.json(HttpStatus.INTERNAL_SERVER_ERROR, {
        error: { code: ErrorCode.INTERNAL_ERROR, message: 'Error interno del servidor' },
      });
    }
  };

  private async dispatch(request: ApiRequest): Promise<HttpResult> {
    const route = request.route;
    if (!route) throw new Error('Ruta no resuelta');
    const controller = this.container.get<object>(route.controller) as Record<string, unknown>;
    const method = controller[route.handlerName];
    if (typeof method !== 'function') {
      throw new Error(`${route.controller.name}.${route.handlerName} no es un método`);
    }
    return (await method.call(controller, request)) as HttpResult;
  }
}
