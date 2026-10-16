import { z } from 'zod';
import { FeatureCode, HttpMethod, ModuleCode, PermissionAction } from '@market-pro/shared';
import { MetadataKey, RouteScope } from '../enums/core.enums.js';

export interface PermissionRequirement {
  module: ModuleCode;
  action: PermissionAction;
}

export interface ControllerMetadata {
  basePath: string;
  scope: RouteScope;
}

export interface RouteMetadata {
  handlerName: string;
  method?: HttpMethod;
  path?: string;
  scope?: RouteScope;
  /** Basta con cumplir UNO de los permisos listados (OR). */
  permissions: PermissionRequirement[];
  /** Deben estar habilitadas TODAS las features listadas (AND). */
  features: FeatureCode[];
  bodySchema?: z.ZodType;
  querySchema?: z.ZodType;
}

function upsertRoute(target: object, propertyKey: string | symbol, apply: (route: RouteMetadata) => void): void {
  const ctor = target.constructor;
  let routes = Reflect.getOwnMetadata(MetadataKey.ROUTES, ctor) as Map<string, RouteMetadata> | undefined;
  if (!routes) {
    routes = new Map<string, RouteMetadata>();
    Reflect.defineMetadata(MetadataKey.ROUTES, routes, ctor);
  }
  const handlerName = String(propertyKey);
  let route = routes.get(handlerName);
  if (!route) {
    route = { handlerName, permissions: [], features: [] };
    routes.set(handlerName, route);
  }
  apply(route);
}

/** Declara un controlador con su prefijo de ruta y su ámbito por defecto. */
export function Controller(basePath = '', scope: RouteScope = RouteScope.TENANT): ClassDecorator {
  return (target) => {
    const metadata: ControllerMetadata = { basePath, scope };
    Reflect.defineMetadata(MetadataKey.CONTROLLER, metadata, target);
  };
}

/** Las rutas usan la sintaxis de API Gateway para parámetros: `/products/{id}`. */
export function Route(method: HttpMethod, path = ''): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.method = method;
      route.path = path;
    });
}

export function Get(path = ''): MethodDecorator {
  return Route(HttpMethod.GET, path);
}

export function Post(path = ''): MethodDecorator {
  return Route(HttpMethod.POST, path);
}

export function Put(path = ''): MethodDecorator {
  return Route(HttpMethod.PUT, path);
}

export function Patch(path = ''): MethodDecorator {
  return Route(HttpMethod.PATCH, path);
}

export function Delete(path = ''): MethodDecorator {
  return Route(HttpMethod.DELETE, path);
}

/** Sobrescribe el ámbito del controlador para una ruta concreta. */
export function Scope(scope: RouteScope): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.scope = scope;
    });
}

export function Public(): MethodDecorator {
  return Scope(RouteScope.PUBLIC);
}

export function Internal(): MethodDecorator {
  return Scope(RouteScope.INTERNAL);
}

/**
 * Exige un permiso CRUD sobre un módulo. Se puede apilar: con varios
 * decoradores basta con tener uno (OR).
 */
export function Permission(module: ModuleCode, action: PermissionAction): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.permissions.push({ module, action });
    });
}

/** Exige que una característica esté habilitada para el tenant. */
export function RequireFeature(feature: FeatureCode): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.features.push(feature);
    });
}

/** Valida (y transforma) el cuerpo JSON con un esquema zod. */
export function Body(schema: z.ZodType): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.bodySchema = schema;
    });
}

/** Valida (y transforma) la query string con un esquema zod. */
export function Query(schema: z.ZodType): MethodDecorator {
  return (target, propertyKey) =>
    upsertRoute(target, propertyKey, (route) => {
      route.querySchema = schema;
    });
}

export function getControllerMetadata(ctor: object): ControllerMetadata | undefined {
  return Reflect.getOwnMetadata(MetadataKey.CONTROLLER, ctor) as ControllerMetadata | undefined;
}

export function getRoutesMetadata(ctor: object): RouteMetadata[] {
  const routes = Reflect.getOwnMetadata(MetadataKey.ROUTES, ctor) as Map<string, RouteMetadata> | undefined;
  return routes ? [...routes.values()] : [];
}
