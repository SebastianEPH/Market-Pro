import { LogLevel, ServiceName } from '../enums/core.enums.js';
import { AppEnvironment, ENV } from './env.enum.js';
import { Environment } from './environment.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  ssl: boolean;
  poolMax: number;
}

export interface AppConfig {
  serviceName: ServiceName;
  environment: AppEnvironment;
  /** Prefijo de rutas del servicio (ej. `/catalog`). Coincide con la ruta `ANY /catalog/{proxy+}` del API Gateway. */
  basePath: string;
  database: DatabaseConfig;
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

/** Cada microservicio tiene su propia base de datos. */
const DATABASE_BY_SERVICE: Record<ServiceName, ENV> = {
  [ServiceName.IDENTITY]: ENV.DATABASE_IDENTITY,
  [ServiceName.CATALOG]: ENV.DATABASE_CATALOG,
  [ServiceName.SALES]: ENV.DATABASE_SALES,
};

const COMMON_REQUIRED: ENV[] = [
  ENV.APP_ENVIRONMENT,
  ENV.LOG_LEVEL,
  ENV.JWT_SECRET,
  ENV.JWT_ISSUER,
  ENV.JWT_AUDIENCE,
  ENV.ACCESS_TOKEN_TTL_SECONDS,
  ENV.REFRESH_TOKEN_TTL_SECONDS,
  ENV.INTERNAL_API_KEY,
  ENV.ACCESS_CACHE_TTL_SECONDS,
  ENV.CORS_ORIGINS,
  ENV.DATABASE_POSTGRESQL_HOST,
  ENV.DATABASE_POSTGRESQL_PORT,
  ENV.DATABASE_POSTGRESQL_USER,
  ENV.DATABASE_POSTGRESQL_PASSWORD,
  ENV.DATABASE_POSTGRESQL_SSL,
  ENV.DATABASE_POSTGRESQL_CONNECTION_LIMIT,
  ENV.IDENTITY_SERVICE_URL,
  ENV.CATALOG_SERVICE_URL,
  ENV.SALES_SERVICE_URL,
  ENV.SERVICE_TIMEOUT_MS,
];

/** Construye la configuración del microservicio validando todas sus variables de una vez. */
export function loadConfig(serviceName: ServiceName): AppConfig {
  const databaseKey = DATABASE_BY_SERVICE[serviceName];
  Environment.require([...COMMON_REQUIRED, databaseKey]);

  const jwtSecret = Environment.get(ENV.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error(`[ENV] ${ENV.JWT_SECRET} debe tener al menos 32 caracteres`);
  }

  return {
    serviceName,
    environment: Environment.get(ENV.APP_ENVIRONMENT) as AppEnvironment,
    basePath: Environment.optional(ENV.BASE_PATH, `/${serviceName}`),
    database: {
      host: Environment.get(ENV.DATABASE_POSTGRESQL_HOST),
      port: Environment.number(ENV.DATABASE_POSTGRESQL_PORT),
      user: Environment.get(ENV.DATABASE_POSTGRESQL_USER),
      password: Environment.get(ENV.DATABASE_POSTGRESQL_PASSWORD),
      name: Environment.get(databaseKey),
      ssl: Environment.boolean(ENV.DATABASE_POSTGRESQL_SSL),
      poolMax: Environment.number(ENV.DATABASE_POSTGRESQL_CONNECTION_LIMIT),
    },
    jwtSecret,
    jwtIssuer: Environment.get(ENV.JWT_ISSUER),
    jwtAudience: Environment.get(ENV.JWT_AUDIENCE),
    accessTokenTtlSeconds: Environment.number(ENV.ACCESS_TOKEN_TTL_SECONDS),
    refreshTokenTtlSeconds: Environment.number(ENV.REFRESH_TOKEN_TTL_SECONDS),
    internalApiKey: Environment.get(ENV.INTERNAL_API_KEY),
    accessCacheTtlSeconds: Environment.number(ENV.ACCESS_CACHE_TTL_SECONDS),
    corsOrigins: Environment.get(ENV.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    serviceUrls: {
      [ServiceName.IDENTITY]: Environment.get(ENV.IDENTITY_SERVICE_URL),
      [ServiceName.CATALOG]: Environment.get(ENV.CATALOG_SERVICE_URL),
      [ServiceName.SALES]: Environment.get(ENV.SALES_SERVICE_URL),
    },
    serviceTimeoutMs: Environment.number(ENV.SERVICE_TIMEOUT_MS),
    logLevel: Environment.get(ENV.LOG_LEVEL) as LogLevel,
  };
}
