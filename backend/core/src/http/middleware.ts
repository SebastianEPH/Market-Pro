import { ApiRequest } from './api-request.js';
import { HttpResult } from './http-result.js';

export interface NextFunction {
  (): Promise<HttpResult>;
}

/**
 * Contrato de middleware (patrón cebolla). Cada middleware es una clase
 * @injectable registrada en el contenedor, por lo que puede recibir
 * dependencias (logger, config, resolvers, etc.).
 */
export interface Middleware {
  handle(request: ApiRequest, next: NextFunction): Promise<HttpResult>;
}

export function runPipeline(middlewares: Middleware[], request: ApiRequest, terminal: NextFunction): Promise<HttpResult> {
  const dispatch = (index: number): Promise<HttpResult> => {
    const middleware = middlewares[index];
    if (!middleware) return terminal();
    return middleware.handle(request, () => dispatch(index + 1));
  };
  return dispatch(0);
}
