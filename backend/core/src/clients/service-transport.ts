import { inject, injectable } from 'inversify';
import { HeaderName, HttpMethod } from '@market-pro/shared';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { ServiceName } from '../enums/core.enums.js';

export interface ServiceRequest {
  service: ServiceName;
  method: HttpMethod;
  path: string;
  body?: unknown;
  requestId?: string;
}

export interface ServiceResponse {
  status: number;
  body: unknown;
}

/**
 * Transporte entre microservicios. La implementación por defecto usa HTTP
 * (local: gateway; AWS: API Gateway). Para invocar Lambdas directamente se
 * puede crear un `LambdaInvokeTransport` que arme un evento APIGW v2 y use
 * @aws-sdk/client-lambda, y registrarlo en CoreToken.ServiceTransport.
 */
export interface IServiceTransport {
  send(request: ServiceRequest): Promise<ServiceResponse>;
}

@injectable()
export class HttpServiceTransport implements IServiceTransport {
  constructor(@inject(CoreToken.Config) private readonly config: AppConfig) {}

  async send(request: ServiceRequest): Promise<ServiceResponse> {
    const baseUrl = this.config.serviceUrls[request.service].replace(/\/+$/, '');
    const headers: Record<string, string> = {
      [HeaderName.CONTENT_TYPE]: 'application/json',
      [HeaderName.INTERNAL_KEY]: this.config.internalApiKey,
    };
    if (request.requestId) headers[HeaderName.REQUEST_ID] = request.requestId;

    const response = await fetch(`${baseUrl}${request.path}`, {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(this.config.serviceTimeoutMs),
    });

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    return { status: response.status, body };
  }
}
