import { inject, injectable } from 'inversify';
import pg from 'pg';
import { Pool, PoolClient } from 'pg';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { DbScope, DbSessionSetting } from '../enums/core.enums.js';
import { NotFoundError } from '../errors/app-error.js';
import { Logger } from '../logging/logger.js';

// numeric/bigint -> number y timestamps -> ISO string (lo que espera el contrato JSON)
const { builtins } = pg.types;
pg.types.setTypeParser(builtins.INT8, (value: string) => Number(value));
pg.types.setTypeParser(builtins.NUMERIC, (value: string) => Number(value));
pg.types.setTypeParser(builtins.TIMESTAMPTZ, (value: string) => new Date(value).toISOString());
pg.types.setTypeParser(builtins.TIMESTAMP, (value: string) => new Date(`${value}Z`).toISOString());

/** Ejecutor de consultas ligado a una transacción concreta. */
export interface DbExecutor {
  query<R>(sql: string, params?: unknown[]): Promise<R[]>;
  maybeOne<R>(sql: string, params?: unknown[]): Promise<R | null>;
  one<R>(sql: string, params?: unknown[], notFoundResource?: string): Promise<R>;
  execute(sql: string, params?: unknown[]): Promise<number>;
}

class PgExecutor implements DbExecutor {
  constructor(private readonly client: PoolClient) {}

  async query<R>(sql: string, params: unknown[] = []): Promise<R[]> {
    const result = await this.client.query(sql, params);
    return result.rows as R[];
  }

  async maybeOne<R>(sql: string, params: unknown[] = []): Promise<R | null> {
    const rows = await this.query<R>(sql, params);
    return rows[0] ?? null;
  }

  async one<R>(sql: string, params: unknown[] = [], notFoundResource = 'Registro'): Promise<R> {
    const row = await this.maybeOne<R>(sql, params);
    if (!row) throw new NotFoundError(notFoundResource);
    return row;
  }

  async execute(sql: string, params: unknown[] = []): Promise<number> {
    const result = await this.client.query(sql, params);
    return result.rowCount ?? 0;
  }
}

/**
 * Acceso a PostgreSQL. Toda operación corre dentro de una transacción que
 * fija las variables de sesión que usan las políticas RLS, de modo que un
 * tenant jamás puede leer datos de otro aunque una consulta olvide filtrar.
 *
 * El pool se crea al cargar el módulo (cold start de Lambda) y se reutiliza
 * mientras el contenedor siga caliente.
 */
@injectable()
export class Database {
  private readonly pool: Pool;

  constructor(
    @inject(CoreToken.Config) config: AppConfig,
    @inject(CoreToken.Logger) private readonly logger: Logger,
  ) {
    this.pool = new pg.Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      // En RDS usar NODE_EXTRA_CA_CERTS con el bundle de AWS para validar el certificado
      ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
      max: config.database.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: `market-pro-${config.serviceName}`,
    });
    this.pool.on('error', (error) => this.logger.error('Error en el pool de PostgreSQL', { error: error.message }));
  }

  /** Transacción aislada al tenant indicado (RLS). */
  withTenant<T>(tenantId: string, work: (db: DbExecutor) => Promise<T>): Promise<T> {
    return this.transaction(work, {
      [DbSessionSetting.TENANT_ID]: tenantId,
      [DbSessionSetting.SCOPE]: DbScope.TENANT,
    });
  }

  /** Transacción con alcance de plataforma (solo administrador global). */
  withPlatform<T>(work: (db: DbExecutor) => Promise<T>): Promise<T> {
    return this.transaction(work, {
      [DbSessionSetting.TENANT_ID]: '',
      [DbSessionSetting.SCOPE]: DbScope.PLATFORM,
    });
  }

  /** Transacción sin tenant: solo ve tablas globales (sin RLS). */
  withGlobal<T>(work: (db: DbExecutor) => Promise<T>): Promise<T> {
    return this.transaction(work, {
      [DbSessionSetting.TENANT_ID]: '',
      [DbSessionSetting.SCOPE]: DbScope.GLOBAL,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async transaction<T>(work: (db: DbExecutor) => Promise<T>, settings: Record<string, string>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(settings)) {
        await client.query('SELECT set_config($1, $2, true)', [key, value]);
      }
      const result = await work(new PgExecutor(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
