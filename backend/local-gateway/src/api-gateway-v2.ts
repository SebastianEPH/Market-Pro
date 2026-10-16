import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';

const TEXT_CONTENT = /^(application\/(json|xml|x-www-form-urlencoded)|text\/)/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formato de requestContext.time de API Gateway: 16/Oct/2026:10:43:00 +0000 */
function gatewayTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${MONTHS[date.getUTCMonth()]}/${date.getUTCFullYear()}:${pad(date.getUTCHours())}:${pad(
    date.getUTCMinutes(),
  )}:${pad(date.getUTCSeconds())} +0000`;
}

export function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

/** Construye un evento idéntico al que API Gateway HTTP API envía a Lambda (payload 2.0). */
export function toApiGatewayEvent(request: IncomingMessage, body: Buffer, routeKey: string): APIGatewayProxyEventV2 {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const now = new Date();

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || key === 'cookie') continue;
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value;
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = query[key] === undefined ? value : `${query[key]},${value}`;
  });

  const cookies = request.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  const isText = TEXT_CONTENT.test(headers['content-type'] ?? 'application/json');
  const hasBody = body.length > 0;

  return {
    version: '2.0',
    routeKey,
    rawPath: url.pathname,
    rawQueryString: url.search.replace(/^\?/, ''),
    cookies,
    headers,
    queryStringParameters: Object.keys(query).length > 0 ? query : undefined,
    requestContext: {
      accountId: '000000000000',
      apiId: 'local',
      domainName: url.host,
      domainPrefix: url.hostname.split('.')[0] ?? 'localhost',
      http: {
        method: (request.method ?? 'GET').toUpperCase(),
        path: url.pathname,
        protocol: `HTTP/${request.httpVersion}`,
        sourceIp: request.socket.remoteAddress ?? '127.0.0.1',
        userAgent: headers['user-agent'] ?? '',
      },
      requestId: randomUUID(),
      routeKey,
      stage: '$default',
      time: gatewayTime(now),
      timeEpoch: now.getTime(),
    },
    body: hasBody ? (isText ? body.toString('utf8') : body.toString('base64')) : undefined,
    isBase64Encoded: hasBody && !isText,
  };
}

/** Contexto Lambda simulado. */
export function createLambdaContext(functionName: string, requestId: string, timeoutMs = 30_000): Context {
  const deadline = Date.now() + timeoutMs;
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName,
    functionVersion: '$LATEST',
    invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${functionName}`,
    memoryLimitInMB: '512',
    awsRequestId: requestId,
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: 'local',
    getRemainingTimeInMillis: () => Math.max(0, deadline - Date.now()),
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

/** Escribe la respuesta Lambda (estructurada o string) en la respuesta HTTP. */
export function writeLambdaResult(response: ServerResponse, result: APIGatewayProxyResultV2): void {
  const structured: APIGatewayProxyStructuredResultV2 =
    typeof result === 'string'
      ? { statusCode: 200, body: result, headers: { 'content-type': 'application/json' } }
      : result;

  for (const [key, value] of Object.entries(structured.headers ?? {})) {
    response.setHeader(key, String(value));
  }
  if (structured.cookies?.length) response.setHeader('set-cookie', structured.cookies);

  response.statusCode = structured.statusCode ?? 200;
  if (!structured.body) {
    response.end();
    return;
  }
  response.end(structured.isBase64Encoded ? Buffer.from(structured.body, 'base64') : structured.body);
}
