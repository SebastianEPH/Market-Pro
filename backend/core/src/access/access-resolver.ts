import { inject, injectable } from 'inversify';
import { AccessProfile } from '@market-pro/shared';
import { Principal } from '../auth/principal.js';
import { ServiceClient } from '../clients/service-client.js';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { ServiceName } from '../enums/core.enums.js';
import { TtlCache } from '../utils/ttl-cache.js';

/** Resuelve el perfil de acceso efectivo (módulos, permisos, features) de un principal. */
export interface IAccessResolver {
  resolve(principal: Principal, requestId?: string): Promise<AccessProfile>;
}

/**
 * Implementación por defecto para microservicios que no son identity:
 * consulta el endpoint interno de identity y cachea el resultado unos
 * segundos (ACCESS_CACHE_TTL_SECONDS). Con TTL 0 el control es inmediato.
 */
@injectable()
export class RemoteAccessResolver implements IAccessResolver {
  private readonly cache: TtlCache<AccessProfile>;

  constructor(
    @inject(CoreToken.ServiceClient) private readonly client: ServiceClient,
    @inject(CoreToken.Config) config: AppConfig,
  ) {
    this.cache = new TtlCache<AccessProfile>(config.accessCacheTtlSeconds * 1000);
  }

  async resolve(principal: Principal, requestId?: string): Promise<AccessProfile> {
    const key = `${principal.scope}:${principal.tenantId ?? '-'}:${principal.subjectId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const profile = await this.client.post<AccessProfile>(
      ServiceName.IDENTITY,
      '/internal/access/resolve',
      { scope: principal.scope, subjectId: principal.subjectId, tenantId: principal.tenantId },
      { requestId },
    );
    this.cache.set(key, profile);
    return profile;
  }
}
