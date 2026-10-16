import { inject, injectable } from 'inversify';
import { ApiErrorBody, ErrorCode, HttpMethod } from '@market-pro/shared';
import { CoreToken } from '../di/core-token.enum.js';
import { HttpStatus, ServiceName } from '../enums/core.enums.js';
import { AppError } from '../errors/app-error.js';
import { Logger } from '../logging/logger.js';
import { IServiceTransport, ServiceResponse } from './service-transport.js';

export interface ServiceCallOptions {
  requestId?: string;
}

/**
 * Cliente para llamar endpoints `@Internal()` de otros microservicios.
 * Propaga errores 4xx del servicio remoto (ej. INSUFFICIENT_STOCK) y
 * convierte fallos de red / 5xx en 502 UPSTREAM_ERROR.
 */
@injectable()
export class ServiceClient {
  constructor(
    @inject(CoreToken.ServiceTransport) private readonly transport: IServiceTransport,
    @inject(CoreToken.Logger) private readonly logger: Logger,
  ) {}

  get<T>(service: ServiceName, path: string, options: ServiceCallOptions = {}): Promise<T> {
    return this.call<T>(service, HttpMethod.GET, path, undefined, options);
  }

  post<T>(service: ServiceName, path: string, body: unknown, options: ServiceCallOptions = {}): Promise<T> {
    return this.call<T>(service, HttpMethod.POST, path, body, options);
  }

  private async call<T>(
    service: ServiceName,
    method: HttpMethod,
    path: string,
    body: unknown,
    options: ServiceCallOptions,
  ): Promise<T> {
    let response: ServiceResponse;
    try {
      response = await this.transport.send({ service, method, path, body, requestId: options.requestId });
    } catch (error) {
      this.logger.error('Fallo de comunicación entre servicios', {
        service,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.UPSTREAM_ERROR, `El servicio ${service} no respondió`);
    }

    if (response.status >= 200 && response.status < 300) {
      return response.body as T;
    }

    const remote = (response.body as Partial<ApiErrorBody> | null)?.error;
    if (response.status >= 400 && response.status < 500 && remote) {
      throw new AppError(response.status as HttpStatus, remote.code, remote.message, remote.details);
    }

    this.logger.error('Error en servicio remoto', { service, path, status: response.status });
    throw new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.UPSTREAM_ERROR, `El servicio ${service} falló`);
  }
}
