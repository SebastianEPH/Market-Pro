import { ApiErrorBody, ErrorCode, HeaderName, HttpMethod } from '@market-pro/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface QueryParams {
  [key: string]: string | number | boolean | null | undefined;
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  /** Enviar el access token (por defecto true). */
  auth?: boolean;
  /** Reintentar una vez tras refrescar la sesión si responde 401 (por defecto true). */
  retryOnUnauthorized?: boolean;
}

export interface ApiClientHooks {
  getAccessToken(): string | null;
  /** Intenta renovar la sesión; devuelve true si lo logró. */
  refreshSession(): Promise<boolean>;
  /** Sesión irrecuperable (401 tras refrescar, tienda suspendida...). */
  onAuthFailure(error: ApiError): void;
}

/** Cliente HTTP mínimo sobre fetch para el API Gateway (local o AWS). */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly hooks: ApiClientHooks,
  ) {}

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>(HttpMethod.GET, path, { query });
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(HttpMethod.POST, path, { ...options, body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(HttpMethod.PUT, path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(HttpMethod.PATCH, path, { body });
  }

  delete<T = void>(path: string): Promise<T> {
    return this.request<T>(HttpMethod.DELETE, path);
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, retryOnUnauthorized = true } = options;
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers[HeaderName.CONTENT_TYPE] = 'application/json';
    const token = auth ? this.hooks.getAccessToken() : null;
    if (token) headers[HeaderName.AUTHORIZATION] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError(0, ErrorCode.UPSTREAM_ERROR, 'No se pudo conectar con el servidor');
    }

    if (response.status === 401 && auth && retryOnUnauthorized && (await this.hooks.refreshSession())) {
      return this.request<T>(method, path, { ...options, retryOnUnauthorized: false });
    }

    if (response.status === 204) return undefined as T;

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const body = (payload as Partial<ApiErrorBody> | null)?.error;
      const error = new ApiError(
        response.status,
        body?.code ?? ErrorCode.INTERNAL_ERROR,
        body?.message ?? response.statusText,
        body?.details,
      );
      if (auth && (response.status === 401 || body?.code === ErrorCode.TENANT_SUSPENDED)) {
        this.hooks.onAuthFailure(error);
      }
      throw error;
    }
    return payload as T;
  }
}
