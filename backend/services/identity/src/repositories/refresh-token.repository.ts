import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { AuthScope } from '@market-pro/shared';

export interface RefreshTokenRecord {
  id: string;
  scope: AuthScope;
  subjectId: string;
  tenantId: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export interface NewRefreshToken {
  scope: AuthScope;
  subjectId: string;
  tenantId: string | null;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IRefreshTokenRepository {
  create(db: DbExecutor, data: NewRefreshToken): Promise<string>;
  findByHash(db: DbExecutor, tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(db: DbExecutor, id: string, replacedBy?: string): Promise<void>;
  revokeAllForSubject(db: DbExecutor, subjectId: string): Promise<void>;
}

@injectable()
export class PgRefreshTokenRepository implements IRefreshTokenRepository {
  async create(db: DbExecutor, data: NewRefreshToken): Promise<string> {
    const row = await db.one<{ id: string }>(
      `INSERT INTO refresh_tokens (scope, subject_id, tenant_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.scope,
        data.subjectId,
        data.tenantId,
        data.tokenHash,
        data.expiresAt,
        data.userAgent ?? null,
        data.ipAddress ?? null,
      ],
    );
    return row.id;
  }

  findByHash(db: DbExecutor, tokenHash: string): Promise<RefreshTokenRecord | null> {
    return db.maybeOne<RefreshTokenRecord>(
      `SELECT id, scope, subject_id AS "subjectId", tenant_id AS "tenantId",
              expires_at AS "expiresAt", revoked_at AS "revokedAt"
         FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revoke(db: DbExecutor, id: string, replacedBy?: string): Promise<void> {
    await db.execute(
      'UPDATE refresh_tokens SET revoked_at = coalesce(revoked_at, now()), replaced_by = $2 WHERE id = $1',
      [id, replacedBy ?? null],
    );
  }

  async revokeAllForSubject(db: DbExecutor, subjectId: string): Promise<void> {
    await db.execute('UPDATE refresh_tokens SET revoked_at = now() WHERE subject_id = $1 AND revoked_at IS NULL', [
      subjectId,
    ]);
  }
}
