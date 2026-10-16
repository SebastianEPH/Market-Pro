import { Container } from 'inversify';
import { IAccessResolver, RemoteAccessResolver } from '../access/access-resolver.js';
import { TokenService } from '../auth/token.service.js';
import { ServiceClient } from '../clients/service-client.js';
import { HttpServiceTransport, IServiceTransport } from '../clients/service-transport.js';
import { AppConfig, loadConfig } from '../config/app-config.js';
import { Database } from '../db/database.js';
import { CoreToken } from '../di/core-token.enum.js';
import { ServiceName } from '../enums/core.enums.js';
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
import { Constructor } from '../utils/constructor.js';

export interface CoreContainerOptions {
  serviceName: ServiceName;
  /** Permite inyectar configuración en tests. */
  config?: AppConfig;
  /** Identity usa su resolvedor local (consulta directa a BD). */
  accessResolver?: Constructor<IAccessResolver>;
  /** Permite cambiar HTTP por invocación directa de Lambda u otro transporte. */
  serviceTransport?: Constructor<IServiceTransport>;
}

/**
 * Crea el contenedor de inversify con todas las dependencias del núcleo.
 * Cada microservicio agrega luego sus repositorios, servicios y controladores.
 */
export function createCoreContainer(options: CoreContainerOptions): Container {
  const container = new Container();
  const config = options.config ?? loadConfig(options.serviceName);

  container.bind<AppConfig>(CoreToken.Config).toConstantValue(config);
  container.bind<Logger>(CoreToken.Logger).to(Logger).inSingletonScope();
  container.bind<Database>(CoreToken.Database).to(Database).inSingletonScope();
  container.bind<TokenService>(CoreToken.TokenService).to(TokenService).inSingletonScope();
  container
    .bind<IServiceTransport>(CoreToken.ServiceTransport)
    .to(options.serviceTransport ?? HttpServiceTransport)
    .inSingletonScope();
  container.bind<ServiceClient>(CoreToken.ServiceClient).to(ServiceClient).inSingletonScope();
  container
    .bind<IAccessResolver>(CoreToken.AccessResolver)
    .to(options.accessResolver ?? RemoteAccessResolver)
    .inSingletonScope();

  const middlewares: Constructor[] = [
    RequestLoggerMiddleware,
    CorsMiddleware,
    ErrorHandlerMiddleware,
    JsonBodyMiddleware,
    AuthenticationMiddleware,
    AccessMiddleware,
    PermissionMiddleware,
    FeatureMiddleware,
    ValidationMiddleware,
  ];
  for (const middleware of middlewares) {
    container.bind(middleware).toSelf().inSingletonScope();
  }

  return container;
}
