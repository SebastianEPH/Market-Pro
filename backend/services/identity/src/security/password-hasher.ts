import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { injectable } from 'inversify';

enum HashAlgorithm {
  SCRYPT = 'scrypt',
}

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keyLength: number;
}

const DEFAULT_PARAMS: ScryptParams = { N: 16_384, r: 8, p: 1, keyLength: 64 };
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, params.keyLength, { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

/**
 * Hash de contraseñas con scrypt nativo de Node (sin dependencias).
 * Formato: scrypt$N$r$p$salt$hash (base64url).
 */
@injectable()
export class ScryptPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, DEFAULT_PARAMS);
    return [
      HashAlgorithm.SCRYPT,
      DEFAULT_PARAMS.N,
      DEFAULT_PARAMS.r,
      DEFAULT_PARAMS.p,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [algorithm, n, r, p, saltText, hashText] = stored.split('$');
    if (algorithm !== HashAlgorithm.SCRYPT || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, 'base64url');
    const key = await derive(password, Buffer.from(saltText, 'base64url'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      keyLength: expected.length,
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
}

/** Hash SHA-256 para refresh tokens (no se guardan en texto plano). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
