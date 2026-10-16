import { z } from 'zod';
import { ErrorCode, FeatureCode, HttpMethod } from '@market-pro/shared';
import { HttpStatus, RouteScope } from '../enums/core.enums.js';
import { AppError } from '../errors/app-error.js';
import { Constructor } from '../utils/constructor.js';
import { PermissionRequirement, getControllerMetadata, getRoutesMetadata } from './decorators.js';

export interface CompiledRoute {
  controller: Constructor;
  handlerName: string;
  method: HttpMethod;
  path: string;
  /** routeKey estilo API Gateway, ej. `GET /catalog/products/{id}`. */
  routeKey: string;
  scope: RouteScope;
  permissions: PermissionRequirement[];
  features: FeatureCode[];
  bodySchema?: z.ZodType;
  querySchema?: z.ZodType;
  pattern: RegExp;
  paramNames: string[];
}

export interface RouteMatch {
  route: CompiledRoute;
  params: Record<string, string>;
}

function joinPaths(...parts: string[]): string {
  const segments = parts.map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean);
  return `/${segments.join('/')}`;
}

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const source = path
    .split('/')
    .map((segment) => {
      const match = /^\{(\w+)\}$/.exec(segment);
      if (match) {
        paramNames.push(match[1] as string);
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${source}$`), paramNames };
}

/**
 * Router propio: resuelve método + rawPath sobre las rutas declaradas con
 * decoradores. Funciona igual con una Lambda por servicio (`ANY /catalog/{proxy+}`)
 * o con una Lambda por ruta.
 */
export class Router {
  private readonly routes: CompiledRoute[] = [];

  constructor(private readonly basePath: string) {}

  register(controllers: Constructor[]): void {
    for (const controller of controllers) {
      const controllerMeta = getControllerMetadata(controller);
      if (!controllerMeta) {
        throw new Error(`[router] ${controller.name} no tiene el decorador @Controller`);
      }
      for (const meta of getRoutesMetadata(controller)) {
        if (!meta.method) continue;
        const path = joinPaths(this.basePath, controllerMeta.basePath, meta.path ?? '');
        const { pattern, paramNames } = compilePath(path);
        this.routes.push({
          controller,
          handlerName: meta.handlerName,
          method: meta.method,
          path,
          routeKey: `${meta.method} ${path}`,
          scope: meta.scope ?? controllerMeta.scope,
          permissions: meta.permissions,
          features: meta.features,
          bodySchema: meta.bodySchema,
          querySchema: meta.querySchema,
          pattern,
          paramNames,
        });
      }
    }
    // Las rutas con menos parámetros ganan: /cash-sessions/current antes que /cash-sessions/{id}
    this.routes.sort((a, b) => a.paramNames.length - b.paramNames.length);
  }

  match(method: HttpMethod, rawPath: string): RouteMatch {
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
    let pathMatched = false;

    for (const route of this.routes) {
      const result = route.pattern.exec(path);
      if (!result) continue;
      pathMatched = true;
      if (route.method !== method) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(result[index + 1] ?? '');
      });
      return { route, params };
    }

    if (pathMatched) {
      throw new AppError(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED, `Método ${method} no permitido`);
    }
    throw new AppError(HttpStatus.NOT_FOUND, ErrorCode.ROUTE_NOT_FOUND, `Ruta ${method} ${path} no encontrada`);
  }

  list(): CompiledRoute[] {
    return [...this.routes];
  }
}
