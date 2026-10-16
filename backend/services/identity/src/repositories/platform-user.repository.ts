import { injectable } from 'inversify';
import { DbExecutor } from '@market-pro/core';
import { UserStatus } from '@market-pro/shared';

export interface PlatformUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
}

/** Administradores globales (tabla sin RLS). */
export interface IPlatformUserRepository {
  findByEmail(db: DbExecutor, email: string): Promise<PlatformUserRecord | null>;
  findById(db: DbExecutor, id: string): Promise<PlatformUserRecord | null>;
  touchLogin(db: DbExecutor, id: string): Promise<void>;
  updatePassword(db: DbExecutor, id: string, passwordHash: string): Promise<void>;
}

const COLUMNS = `id, email, password_hash AS "passwordHash", full_name AS "fullName", status`;

@injectable()
export class PgPlatformUserRepository implements IPlatformUserRepository {
  findByEmail(db: DbExecutor, email: string): Promise<PlatformUserRecord | null> {
    return db.maybeOne<PlatformUserRecord>(`SELECT ${COLUMNS} FROM platform_users WHERE lower(email) = lower($1)`, [
      email,
    ]);
  }

  findById(db: DbExecutor, id: string): Promise<PlatformUserRecord | null> {
    return db.maybeOne<PlatformUserRecord>(`SELECT ${COLUMNS} FROM platform_users WHERE id = $1`, [id]);
  }

  async touchLogin(db: DbExecutor, id: string): Promise<void> {
    await db.execute('UPDATE platform_users SET last_login_at = now() WHERE id = $1', [id]);
  }

  async updatePassword(db: DbExecutor, id: string, passwordHash: string): Promise<void> {
    await db.execute('UPDATE platform_users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
  }
}
