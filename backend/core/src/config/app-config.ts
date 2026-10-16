import { LogLevel, ServiceName } from '../enums/core.enums.js';

export interface AppConfig {
  serviceName: ServiceName;
  stage: string;
  /** Prefijo de rutas del servicio (ej. `/catalog`). Coincide con la ruta `ANY /catalog/{proxy+}` del API Gateway. */
  basePath: string;
  databaseUrl: string;
  dbPoolMax: number;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  internalApiKey: string;
  accessCacheTtlSeconds: number;
  corsOrigins: string[];
  serviceUrls: Record<ServiceName, string>;
  serviceTimeoutMs: number;
  logLevel: LogLevel;
}

/**
 * Lee la configuración desde variables de entorno.
 * Prioridad: `<SERVICIO>_<VAR>` > `<VAR>` > valor por defecto.
 * Así un solo proceso local (gateway) puede alojar varios servicios y en
 * Lambda cada función recibe solo sus variables sin prefijo.
 */
export function loadConfig(serviceName: ServiceName): AppConfig {
  const prefix = serviceName.toUpperCase();

  const read = (key: string, fallback?: string): string => {
    const value = process.env[`${prefix}_${key}`] ?? process.env[key] ?? fallback;
    if (value === undefined || value === '') {
      throw new Error(`[config] Falta la variable de entorno ${prefix}_${key} o ${key}`);
    }
    return value;
  };

  const readNumber = (key: string, fallback: number): number => {
    const value = Number(read(key, String(fallback)));
    if (Number.isNaN(value)) throw new Error(`[config] ${key} debe ser numérico`);
    return value;
  };

  const jwtSecret = read('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('[config] JWT_SECRET debe tener al menos 32 caracteres');
  }

  return {
    serviceName,
    stage: read('STAGE', 'local'),
    basePath: process.env[`${prefix}_BASE_PATH`] ?? process.env.BASE_PATH ?? `/${serviceName}`,
    databaseUrl: read('DATABASE_URL'),
    dbPoolMax: readNumber('DB_POOL_MAX', 5),
    jwtSecret,
    jwtIssuer: read('JWT_ISSUER', 'market-pro'),
    jwtAudience: read('JWT_AUDIENCE', 'market-pro-api'),
    accessTokenTtlSeconds: readNumber('ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTokenTtlSeconds: readNumber('REFRESH_TOKEN_TTL_SECONDS', 1_209_600),
    internalApiKey: read('INTERNAL_API_KEY'),
    accessCacheTtlSeconds: readNumber('ACCESS_CACHE_TTL_SECONDS', 15),
    corsOrigins: read('CORS_ORIGINS', '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    serviceUrls: {
      [ServiceName.IDENTITY]: read('IDENTITY_SERVICE_URL', 'http://localhost:3000/identity'),
      [ServiceName.CATALOG]: read('CATALOG_SERVICE_URL', 'http://localhost:3000/catalog'),
      [ServiceName.SALES]: read('SALES_SERVICE_URL', 'http://localhost:3000/sales'),
    },
    serviceTimeoutMs: readNumber('SERVICE_TIMEOUT_MS', 8000),
    logLevel: read('LOG_LEVEL', LogLevel.INFO) as LogLevel,
  };
}
