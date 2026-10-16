import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessProfile,
  AuthScope,
  AuthSession,
  AuthUserView,
  ErrorCode,
  FeatureCode,
  LoginRequest,
  MeResponse,
  ModuleCode,
  PermissionAction,
  hasModule,
  hasPermission,
  isFeatureEnabled,
} from '@market-pro/shared';
import { ApiClient, ApiError } from '../api/api-client';

export interface AuthConfig {
  apiUrl: string;
  /** Clave de localStorage (cada frontend guarda su propia sesión). */
  storageKey: string;
  /** Tipo de usuario permitido en este frontend. */
  expectedScope: AuthScope;
  /** Cada cuánto se refrescan permisos en segundo plano (ms). */
  accessPollMs?: number;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUserView;
}

export interface AuthContextValue {
  api: ApiClient;
  user: AuthUserView | null;
  access: AccessProfile | null;
  ready: boolean;
  notice: string | null;
  login(request: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  reloadAccess(): Promise<void>;
  can(module: ModuleCode, action?: PermissionAction): boolean;
  hasModule(module: ModuleCode): boolean;
  feature(code: FeatureCode): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(key: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(key: string, session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(key, JSON.stringify(session));
    else localStorage.removeItem(key);
  } catch {
    // almacenamiento no disponible (modo privado): la sesión vive solo en memoria
  }
}

/**
 * Maneja la sesión y el perfil de acceso. Los permisos se vuelven a pedir
 * periódicamente y al recuperar el foco, así los cambios que hace el
 * administrador (módulos, roles, suspensión) se reflejan en tiempo real.
 */
export function AuthProvider({ config, children }: { config: AuthConfig; children: ReactNode }) {
  const sessionRef = useRef<StoredSession | null>(loadSession(config.storageKey));
  const refreshPromise = useRef<Promise<boolean> | null>(null);
  const [user, setUser] = useState<AuthUserView | null>(sessionRef.current?.user ?? null);
  const [access, setAccess] = useState<AccessProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSession = useCallback(
    (message: string | null) => {
      sessionRef.current = null;
      saveSession(config.storageKey, null);
      setUser(null);
      setAccess(null);
      setNotice(message);
    },
    [config.storageKey],
  );

  const applySession = useCallback(
    (session: AuthSession) => {
      sessionRef.current = { accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user };
      saveSession(config.storageKey, sessionRef.current);
      setUser(session.user);
      setAccess(session.access);
      setNotice(null);
    },
    [config.storageKey],
  );

  const api = useMemo(() => {
    let client: ApiClient;
    const refreshSession = (): Promise<boolean> => {
      const current = sessionRef.current;
      if (!current) return Promise.resolve(false);
      refreshPromise.current ??= client
        .post<AuthSession>(
          '/identity/auth/refresh',
          { refreshToken: current.refreshToken },
          { auth: false, retryOnUnauthorized: false },
        )
        .then((session) => {
          applySession(session);
          return true;
        })
        .catch(() => false)
        .finally(() => {
          refreshPromise.current = null;
        });
      return refreshPromise.current;
    };

    client = new ApiClient(config.apiUrl, {
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshSession,
      onAuthFailure: (error: ApiError) =>
        clearSession(error.code === ErrorCode.TENANT_SUSPENDED ? error.message : 'Tu sesión terminó. Ingresa nuevamente.'),
    });
    return client;
  }, [config.apiUrl, applySession, clearSession]);

  const reloadAccess = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      const me = await api.get<MeResponse>('/identity/auth/me');
      setUser(me.user);
      setAccess(me.access);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) return; // sin red: se reintenta luego
    }
  }, [api]);

  // Carga inicial
  useEffect(() => {
    void reloadAccess().finally(() => setReady(true));
  }, [reloadAccess]);

  // Refresco de permisos en tiempo real
  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => void reloadAccess(), config.accessPollMs ?? 30_000);
    const onFocus = () => void reloadAccess();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, reloadAccess, config.accessPollMs]);

  const login = useCallback(
    async (request: LoginRequest) => {
      const session = await api.post<AuthSession>('/identity/auth/login', request, { auth: false });
      if (session.user.scope !== config.expectedScope) {
        await api.post('/identity/auth/logout', { refreshToken: session.refreshToken }, { auth: false });
        throw new ApiError(403, ErrorCode.FORBIDDEN, 'Este usuario no puede ingresar a esta aplicación');
      }
      applySession(session);
    },
    [api, applySession, config.expectedScope],
  );

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    clearSession(null);
    if (current) {
      await api.post('/identity/auth/logout', { refreshToken: current.refreshToken }, { auth: false }).catch(() => undefined);
    }
  }, [api, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      user,
      access,
      ready,
      notice,
      login,
      logout,
      reloadAccess,
      can: (module, action = PermissionAction.READ) => hasPermission(access, module, action),
      hasModule: (module) => hasModule(access, module),
      feature: (code) => isFeatureEnabled(access, code),
    }),
    [api, user, access, ready, notice, login, logout, reloadAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}

export function useApi(): ApiClient {
  return useAuth().api;
}
