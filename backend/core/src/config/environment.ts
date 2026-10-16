import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENV } from './env.enum.js';

/**
 * Carga de variables de entorno por archivo:
 *
 *   config/.env.example   plantilla versionada
 *   config/.env.dev       desarrollo   (no versionado)
 *   config/.env.prod      producción   (no versionado)
 *
 * El entorno se indica como argumento del proceso: `node dist/main.js dev`
 * (o con APP_ENV). En AWS Lambda no hay archivo: se usan las variables
 * configuradas en la función.
 */
export class Environment {
  private static readonly MIN_VALUE_LENGTH = 1;
  private static loaded = false;
  private static envName: string | null = null;

  static load(): void {
    if (this.loaded) return;
    this.loaded = true;

    if (this.isLambda()) {
      console.log('[ENV] AWS Lambda: usando variables de la función');
      return;
    }

    const envName = this.nameFromArgument();
    const envPath = resolve('config', `.env.${envName}`);
    if (!existsSync(envPath)) {
      this.abort(`[ENV] No existe el archivo: ${envPath}`);
    }
    process.loadEnvFile(envPath);
    this.envName = envName;
    console.log(`[ENV] Entorno '${envName}' -> ${envPath}`);
  }

  /** Valida que las variables existan y no estén vacías; lista todas las que falten. */
  static require(keys: ENV[]): void {
    this.load();
    const missing = keys.filter((key) => (process.env[key]?.trim().length ?? 0) < this.MIN_VALUE_LENGTH);
    if (missing.length === 0) return;
    const source = this.envName ? `config/.env.${this.envName}` : 'las variables de la función';
    this.abort(`[ENV] Faltan variables en ${source}:\n${missing.join('\n')}`);
  }

  static get(key: ENV): string {
    this.require([key]);
    return (process.env[key] as string).trim();
  }

  static optional(key: ENV, fallback: string): string {
    this.load();
    return process.env[key]?.trim() || fallback;
  }

  static number(key: ENV): number {
    const value = Number(this.get(key));
    if (Number.isNaN(value)) this.abort(`[ENV] ${key} debe ser numérico`);
    return value;
  }

  static boolean(key: ENV): boolean {
    return this.get(key).toLowerCase() === 'true';
  }

  static get name(): string | null {
    return this.envName;
  }

  private static isLambda(): boolean {
    return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  }

  private static nameFromArgument(): string {
    const envName = process.argv[2] ?? process.env.APP_ENV;
    if (!envName || envName.startsWith('-')) {
      this.abort('[ENV] Debes indicar el entorno: node <script> <dev|prod|...>  (o npm start -- <env>)');
    }
    return envName as string;
  }

  /** En local termina el proceso; en Lambda lanza para que falle el cold start con el detalle. */
  private static abort(message: string): never {
    console.error(message);
    if (this.isLambda()) throw new Error(message);
    process.exit(1);
  }
}
