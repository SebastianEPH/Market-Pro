import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { AccessProfile, ErrorCode, HeaderName, HttpMethod } from '@market-pro/shared';
import { Principal } from '../auth/principal.js';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { CompiledRoute } from '../routing/router.js';

/**
 * Envoltorio del evento de API Gateway v2 + contexto Lambda.
 * Es lo que reciben middlewares y controladores (no hay Express).
 */
export class ApiRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly query: Record<string, string | undefined>;
  readonly rawBody: string | undefined;
  readonly requestId: string;
  readonly sourceIp: string;
  readonly startedAt = Date.now();

  /** Cuerpo parseado (JSON) y, si la ruta tiene @Body, ya validado. */
  body: unknown = undefined;
  /** Query validada por @Query (si existe). */
  parsedQuery: unknown = undefined;
  params: Record<string, string> = {};
  route: CompiledRoute | null = null;
  principal: Principal | null = null;
  access: AccessProfile | null = null;

  constructor(
    readonly event: APIGatewayProxyEventV2,
    readonly context: Context,
  ) {
    this.method = event.requestContext.http.method.toUpperCase() as HttpMethod;
    this.path = ApiRequest.stripStage(event.rawPath, event.requestContext.stage);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.headers ?? {})) {
      if (value !== undefined) headers[key.toLowerCase()] = value;
    }
    this.headers = headers;
    this.query = { ...(event.queryStringParameters ?? {}) };
    this.rawBody =
      event.body && event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    this.requestId = headers[HeaderName.REQUEST_ID] ?? event.requestContext.requestId ?? context.awsRequestId;
    this.sourceIp = event.requestContext.http.sourceIp;
  }

  /** Con stages con nombre, API Gateway incluye `/<stage>` en rawPath. */
  private static stripStage(rawPath: string, stage: string | undefined): string {
    if (stage && stage !== '$default' && rawPath.startsWith(`/${stage}/`)) {
      return rawPath.slice(stage.length + 1);
    }
    return rawPath;
  }

  header(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }

  param(name: string): string {
    const value = this.params[name];
    if (!value) throw new BadRequestError(`Falta el parámetro de ruta '${name}'`);
    return value;
  }

  getBody<T>(): T {
    return this.body as T;
  }

  getQuery<T>(): T {
    return (this.parsedQuery ?? this.query) as T;
  }

  get userId(): string {
    if (!this.principal) throw new UnauthorizedError();
    return this.principal.subjectId;
  }

  get tenantId(): string {
    const tenantId = this.principal?.tenantId;
    if (!tenantId) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Se requiere un usuario de tienda (tenant)');
    return tenantId;
  }

  requirePrincipal(): Principal {
    if (!this.principal) throw new UnauthorizedError();
    return this.principal;
  }

  requireAccess(): AccessProfile {
    if (!this.access) throw new UnauthorizedError();
    return this.access;
  }
}
