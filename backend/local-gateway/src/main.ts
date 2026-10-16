import { createServer } from 'node:http';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { handler as catalogHandler } from '@market-pro/catalog-service';
import { handler as identityHandler } from '@market-pro/identity-service';
import { handler as salesHandler } from '@market-pro/sales-service';
import { createLambdaContext, readBody, toApiGatewayEvent, writeLambdaResult } from './api-gateway-v2.js';

interface LambdaFunction {
  (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2>;
}

interface GatewayRoute {
  /** Equivale a la ruta `ANY /<prefix>/{proxy+}` del API Gateway real. */
  prefix: string;
  functionName: string;
  handler: LambdaFunction;
}

/**
 * Mapa de rutas -> funciones. En AWS se replica con un HTTP API y una
 * integración Lambda por microservicio (mismo handler, mismo evento).
 */
const routes: GatewayRoute[] = [
  { prefix: '/identity', functionName: 'market-pro-identity', handler: identityHandler },
  { prefix: '/catalog', functionName: 'market-pro-catalog', handler: catalogHandler },
  { prefix: '/sales', functionName: 'market-pro-sales', handler: salesHandler },
];

const port = Number(process.env.GATEWAY_PORT ?? 3000);

const server = createServer(async (request, response) => {
  const started = Date.now();
  const path = (request.url ?? '/').split('?')[0] ?? '/';

  if (path === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', functions: routes.map((route) => route.functionName) }));
    return;
  }

  const route = routes.find((candidate) => path === candidate.prefix || path.startsWith(`${candidate.prefix}/`));
  if (!route) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'ROUTE_NOT_FOUND', message: `Sin integración para ${path}` } }));
    return;
  }

  try {
    const body = await readBody(request);
    const event = toApiGatewayEvent(request, body, `ANY ${route.prefix}/{proxy+}`);
    const context = createLambdaContext(route.functionName, event.requestContext.requestId);
    const result = await route.handler(event, context);
    writeLambdaResult(response, result);
  } catch (error) {
    console.error('[gateway] La función lanzó una excepción', error);
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'UPSTREAM_ERROR', message: 'Internal server error' } }));
  } finally {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[gateway] ${request.method} ${request.url} -> ${route.functionName} ${response.statusCode} (${Date.now() - started}ms)`);
    }
  }
});

server.listen(port, () => {
  console.log(`[gateway] API Gateway local (HTTP API v2) en http://localhost:${port}`);
  for (const route of routes) console.log(`[gateway]   ANY ${route.prefix}/{proxy+} -> ${route.functionName}`);
});
