export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * Quién puede invocar una ruta.
 *  - PUBLIC:        sin autenticación (login, refresh).
 *  - INTERNAL:      solo otros microservicios (cabecera x-internal-key).
 *  - AUTHENTICATED: cualquier JWT válido (plataforma o tenant).
 *  - PLATFORM:      solo el administrador global.
 *  - TENANT:        solo usuarios de un tenant (comprador y sus empleados).
 */
export enum RouteScope {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  AUTHENTICATED = 'authenticated',
  PLATFORM = 'platform',
  TENANT = 'tenant',
}

export enum MetadataKey {
  CONTROLLER = 'market-pro:controller',
  ROUTES = 'market-pro:routes',
}

export enum ServiceName {
  IDENTITY = 'identity',
  CATALOG = 'catalog',
  SALES = 'sales',
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/** Variables de sesión de PostgreSQL que leen las políticas RLS. */
export enum DbSessionSetting {
  TENANT_ID = 'app.tenant_id',
  SCOPE = 'app.scope',
}

export enum DbScope {
  TENANT = 'tenant',
  PLATFORM = 'platform',
  GLOBAL = 'global',
}

/** Códigos SQLSTATE de PostgreSQL que se traducen a errores HTTP. */
export enum PgErrorCode {
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  CHECK_VIOLATION = '23514',
  INVALID_TEXT_REPRESENTATION = '22P02',
  NUMERIC_VALUE_OUT_OF_RANGE = '22003',
  INSUFFICIENT_PRIVILEGE = '42501',
}
