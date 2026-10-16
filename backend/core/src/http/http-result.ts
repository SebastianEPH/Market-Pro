import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { HeaderName } from '@market-pro/shared';
import { HttpStatus } from '../enums/core.enums.js';

/** Respuesta de API Gateway v2 (payload 2.0). */
export interface HttpResult extends APIGatewayProxyStructuredResultV2 {}

export class ApiResponse {
  static json(statusCode: HttpStatus, data: unknown, headers: Record<string, string> = {}): HttpResult {
    return {
      statusCode,
      headers: { [HeaderName.CONTENT_TYPE]: 'application/json; charset=utf-8', ...headers },
      body: JSON.stringify(data),
    };
  }

  static ok(data: unknown): HttpResult {
    return ApiResponse.json(HttpStatus.OK, data);
  }

  static created(data: unknown): HttpResult {
    return ApiResponse.json(HttpStatus.CREATED, data);
  }

  static noContent(): HttpResult {
    return { statusCode: HttpStatus.NO_CONTENT, headers: {} };
  }
}
