#!/usr/bin/env node
// ------------------------------------------------------------------
// Base de datos con Liquibase, por entorno:
//
//   npm run db -- <env> <comando>        ej: npm run db -- dev setup
//
// Comandos:
//   bootstrap  crea/actualiza roles (market_owner, market_app) y las 3 bases (usa el superusuario)
//   update     aplica los changesets pendientes (sql/<servicio>/changelog.yaml)
//   setup      bootstrap + update
//   status     changesets pendientes          history   changesets aplicados
//   validate   valida los changelogs          update-sql  muestra el SQL sin ejecutarlo
//   reset      BORRA las 3 bases y ejecuta setup (bloqueado si APP_ENVIRONMENT=PROD)
//
// Variables: config/.env.<env>  (DATABASE_POSTGRESQL_*, DATABASE_<SERVICIO>, LIQUIBASE_CONTEXTS)
// ------------------------------------------------------------------
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, styleText } from 'node:util';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICES = [
  { name: 'identity', databaseKey: 'DATABASE_IDENTITY' },
  { name: 'catalog', databaseKey: 'DATABASE_CATALOG' },
  { name: 'sales', databaseKey: 'DATABASE_SALES' },
];
const LIQUIBASE_COMMANDS = {
  update: ['update'],
  status: ['status', '--verbose'],
  history: ['history'],
  validate: ['validate'],
  'update-sql': ['update-sql'],
};
const LIQUIBASE_BIN = join(
  ROOT,
  'node_modules',
  'liquibase',
  'dist',
  'liquibase',
  process.platform === 'win32' ? 'liquibase.bat' : 'liquibase',
);

const [envName, command] = process.argv.slice(2);

function fail(message) {
  console.error(styleText('red', message));
  process.exit(1);
}

function info(message) {
  console.log(styleText('cyan', `[db] ${message}`));
}

// ------------------------------------------------------------------ entorno

if (!envName || !command) {
  fail('Uso: npm run db -- <env> <bootstrap|update|setup|status|history|validate|update-sql|reset>');
}

const envPath = join(ROOT, 'config', `.env.${envName}`);
if (!existsSync(envPath)) fail(`No existe el archivo: ${envPath}`);
const env = parseEnv(readFileSync(envPath, 'utf8'));

function required(keys) {
  const missing = keys.filter((key) => !env[key]?.trim());
  if (missing.length > 0) fail(`[db] Faltan variables en config/.env.${envName}:\n${missing.join('\n')}`);
}

required([
  'APP_ENVIRONMENT',
  'DATABASE_POSTGRESQL_HOST',
  'DATABASE_POSTGRESQL_PORT',
  'DATABASE_POSTGRESQL_SSL',
  'DATABASE_POSTGRESQL_USER',
  'DATABASE_POSTGRESQL_PASSWORD',
  'DATABASE_POSTGRESQL_OWNER_USER',
  'DATABASE_POSTGRESQL_OWNER_PASSWORD',
  'LIQUIBASE_CONTEXTS',
  ...SERVICES.map((service) => service.databaseKey),
]);

const ssl = env.DATABASE_POSTGRESQL_SSL === 'true';
const isProd = env.APP_ENVIRONMENT === 'PROD';

// ------------------------------------------------------------------ bootstrap (superusuario)

async function withAdmin(work) {
  required(['DATABASE_POSTGRESQL_ADMIN_USER', 'DATABASE_POSTGRESQL_ADMIN_PASSWORD']);
  const client = new pg.Client({
    host: env.DATABASE_POSTGRESQL_HOST,
    port: Number(env.DATABASE_POSTGRESQL_PORT),
    user: env.DATABASE_POSTGRESQL_ADMIN_USER,
    password: env.DATABASE_POSTGRESQL_ADMIN_PASSWORD,
    database: 'postgres',
    ssl: ssl ? { rejectUnauthorized: true } : false,
  });
  try {
    await client.connect();
  } catch (error) {
    fail(`[db] No se pudo conectar como ${env.DATABASE_POSTGRESQL_ADMIN_USER}: ${error.message}`);
  }
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Ejecuta DDL con identificadores/literales escapados por PostgreSQL (format %I / %L). */
async function executeFormatted(client, template, ...values) {
  const placeholders = values.map((_, index) => `$${index + 1}::text`).join(', ');
  const { rows } = await client.query(`SELECT format('${template}', ${placeholders}) AS sql`, values);
  await client.query(rows[0].sql);
}

async function bootstrap() {
  info(`bootstrap en ${env.DATABASE_POSTGRESQL_HOST}:${env.DATABASE_POSTGRESQL_PORT}`);
  await withAdmin(async (client) => {
    const roles = [
      [env.DATABASE_POSTGRESQL_OWNER_USER, env.DATABASE_POSTGRESQL_OWNER_PASSWORD],
      [env.DATABASE_POSTGRESQL_USER, env.DATABASE_POSTGRESQL_PASSWORD],
    ];
    for (const [role, password] of roles) {
      const exists = (await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount > 0;
      // Si ya existe se sincroniza la contraseña con la del archivo de entorno
      await executeFormatted(client, exists ? 'ALTER ROLE %I LOGIN PASSWORD %L' : 'CREATE ROLE %I LOGIN PASSWORD %L', role, password);
      info(`rol ${role} ${exists ? 'actualizado' : 'creado'}`);
    }

    for (const service of SERVICES) {
      const database = env[service.databaseKey];
      const exists = (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])).rowCount > 0;
      if (!exists) {
        await executeFormatted(client, 'CREATE DATABASE %I OWNER %I', database, env.DATABASE_POSTGRESQL_OWNER_USER);
        info(`base ${database} creada`);
      }
      await executeFormatted(client, 'GRANT CONNECT ON DATABASE %I TO %I', database, env.DATABASE_POSTGRESQL_USER);
    }
  });
}

async function reset() {
  if (isProd) fail('[db] reset está bloqueado en PROD');
  await withAdmin(async (client) => {
    for (const service of SERVICES) {
      const database = env[service.databaseKey];
      await executeFormatted(client, 'DROP DATABASE IF EXISTS %I WITH (FORCE)', database);
      info(`base ${database} eliminada`);
    }
  });
}

// ------------------------------------------------------------------ liquibase (rol dueño)

function liquibase(service, args) {
  const database = env[service.databaseKey];
  const sslQuery = ssl ? '?sslmode=require' : '';
  info(`liquibase ${args.join(' ')} -> ${database} (contextos: ${env.LIQUIBASE_CONTEXTS})`);

  return new Promise((resolvePromise) => {
    // En Windows un .bat solo se puede lanzar mediante shell (args fijos, sin datos del usuario)
    const binary = process.platform === 'win32' ? `"${LIQUIBASE_BIN}"` : LIQUIBASE_BIN;
    const child = spawn(binary, args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      // Credenciales por variables de entorno (no quedan en la línea de comandos)
      env: {
        ...process.env,
        LIQUIBASE_COMMAND_URL: `jdbc:postgresql://${env.DATABASE_POSTGRESQL_HOST}:${env.DATABASE_POSTGRESQL_PORT}/${database}${sslQuery}`,
        LIQUIBASE_COMMAND_USERNAME: env.DATABASE_POSTGRESQL_OWNER_USER,
        LIQUIBASE_COMMAND_PASSWORD: env.DATABASE_POSTGRESQL_OWNER_PASSWORD,
        LIQUIBASE_COMMAND_CHANGELOG_FILE: 'changelog.yaml',
        LIQUIBASE_COMMAND_CONTEXTS: env.LIQUIBASE_CONTEXTS,
        LIQUIBASE_SEARCH_PATH: join(ROOT, 'sql', service.name),
        LIQUIBASE_SHOW_BANNER: 'false',
      },
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
    child.on('error', (error) => {
      console.error(error.message);
      resolvePromise(1);
    });
  });
}

async function runLiquibase(args) {
  if (!existsSync(LIQUIBASE_BIN)) fail('[db] Liquibase no está instalado. Ejecuta: npm install');
  for (const service of SERVICES) {
    const code = await liquibase(service, args);
    if (code !== 0) fail(`[db] Liquibase falló en ${service.name} (código ${code})`);
  }
}

// ------------------------------------------------------------------ main

info(`entorno '${envName}' -> ${envPath}`);

switch (command) {
  case 'bootstrap':
    await bootstrap();
    break;
  case 'setup':
    await bootstrap();
    await runLiquibase(LIQUIBASE_COMMANDS.update);
    break;
  case 'reset':
    await reset();
    await bootstrap();
    await runLiquibase(LIQUIBASE_COMMANDS.update);
    break;
  default:
    if (!LIQUIBASE_COMMANDS[command]) fail(`[db] Comando desconocido: ${command}`);
    await runLiquibase(LIQUIBASE_COMMANDS[command]);
}

info(styleText('green', 'listo'));
