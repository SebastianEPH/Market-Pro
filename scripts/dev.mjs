#!/usr/bin/env node
// ------------------------------------------------------------------
// npm start [-- <env>] -> levanta todo con recarga automática (env por defecto: dev):
//   1. Base de datos: roles/bases + migraciones Liquibase   [omitir con --no-db; nunca en PROD]
//   2. tsc --watch del backend (shared, core, servicios, gateway)
//   3. Gateway local con node --watch (se reinicia al recompilar)
//   4. Vite (HMR) para admin, backoffice y POS con --mode <env>
// Variables: config/.env.<env>
// ------------------------------------------------------------------
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, styleText } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_NAME = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? 'dev';
const SKIP_DB = process.argv.includes('--no-db');
const ENV_PATH = join(ROOT, 'config', `.env.${ENV_NAME}`);
if (!existsSync(ENV_PATH)) {
  console.error(styleText('red', `No existe ${ENV_PATH}. Copia config/.env.example y complétalo.`));
  process.exit(1);
}
const ENV_FILE = parseEnv(readFileSync(ENV_PATH, 'utf8'));
const GATEWAY_PORT = ENV_FILE.GATEWAY_PORT ?? '3000';

const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const FRONTENDS = [
  { name: 'admin', dir: 'frontend-admin', port: 5173, color: 'magenta', label: 'Admin plataforma' },
  { name: 'backoffice', dir: 'frontend-backoffice', port: 5174, color: 'blue', label: 'Backoffice tienda' },
  { name: 'pos', dir: 'frontend-pos', port: 5175, color: 'green', label: 'Punto de venta' },
];

const children = new Set();
const ready = new Set();
let shuttingDown = false;
let bannerShown = false;

// ------------------------------------------------------------------ utilidades

function log(name, color, line) {
  const prefix = styleText(color, `[${name.padEnd(10)}]`);
  process.stdout.write(`${prefix} ${line}\n`);
}

/** Lanza un proceso y antepone un prefijo de color a cada línea de su salida. */
function run(name, color, command, args, { cwd = ROOT, onLine } = {}) {
  const child = spawn(command, args, { cwd, env: { ...process.env, FORCE_COLOR: '1' } });
  children.add(child);

  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim() === '') continue;
        log(name, color, line);
        onLine?.(line);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    children.delete(child);
    if (!shuttingDown) log(name, 'red', `terminó con código ${code}`);
  });
  return child;
}

function banner() {
  const link = (url) => styleText(['cyan', 'underline'], url);
  const lines = [
    '',
    styleText('bold', `  Market Pro · entorno '${ENV_NAME}' (${ENV_FILE.APP_ENVIRONMENT ?? '?'})`),
    '',
    `  ${styleText('yellow', 'Backend (API Gateway)')}  ${link(`http://localhost:${GATEWAY_PORT}`)}   health: ${link(`http://localhost:${GATEWAY_PORT}/health`)}`,
    ...FRONTENDS.map((app) => `  ${styleText(app.color, app.label.padEnd(22))} ${link(`http://localhost:${app.port}`)}`),
    '',
    styleText('dim', '  Usuarios demo (contraseña Admin123*): admin@marketpro.local · owner@demo.local / cajero@demo.local (tienda "demo")'),
    styleText('dim', '  Cambios en frontends: HMR instantáneo · Cambios en backend: recompila y reinicia el gateway'),
    styleText('dim', '  Ctrl+C para detener todo'),
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function markReady(name) {
  if (ready.has(name)) return;
  ready.add(name);
  if (!bannerShown && ready.size === FRONTENDS.length + 1) {
    bannerShown = true;
    banner();
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(styleText('dim', '\nDeteniendo procesos...\n'));
  for (const child of children) child.kill();
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ------------------------------------------------------------------ verificaciones

if (!existsSync(TSC) || !existsSync(VITE)) {
  console.error(styleText('red', 'Faltan dependencias. Ejecuta primero: npm install'));
  process.exit(1);
}
// ------------------------------------------------------------------ 1. base de datos (Liquibase)

if (ENV_FILE.APP_ENVIRONMENT === 'PROD') {
  log('db', 'yellow', `PROD: no se migra automáticamente. Usa: npm run db -- ${ENV_NAME} update`);
} else if (!SKIP_DB) {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'db.mjs'), ENV_NAME, 'setup'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    log('db', 'red', 'La base de datos no quedó lista (revisa config/.env.' + ENV_NAME + '). Continuando sin ella...');
  }
}

// ------------------------------------------------------------------ 2 y 3. backend

let gatewayStarted = false;

function startGateway() {
  gatewayStarted = true;
  run(
    'gateway',
    'yellow',
    process.execPath,
    ['--watch', 'backend/local-gateway/dist/main.js', ENV_NAME],
    { onLine: (line) => line.includes('API Gateway local') && markReady('gateway') },
  );
}

run('backend', 'cyan', process.execPath, [TSC, '-b', 'backend/tsconfig.json', '--watch', '--preserveWatchOutput'], {
  onLine: (line) => {
    // tsc imprime "Found N errors. Watching for file changes." al terminar cada compilación
    if (!gatewayStarted && line.includes('Watching for file changes')) {
      if (existsSync(join(ROOT, 'backend', 'local-gateway', 'dist', 'main.js'))) startGateway();
      else log('backend', 'red', 'El gateway no compiló todavía; corrige los errores y se iniciará solo.');
    }
  },
});

// ------------------------------------------------------------------ 4. frontends

for (const app of FRONTENDS) {
  run(app.name, app.color, process.execPath, [VITE, '--mode', ENV_NAME, '--clearScreen', 'false'], {
    cwd: join(ROOT, app.dir),
    onLine: (line) => line.includes('Local:') && markReady(app.name),
  });
}
