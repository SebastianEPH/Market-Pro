#!/usr/bin/env node
// ------------------------------------------------------------------
// npm run start -> levanta todo el entorno de desarrollo con recarga automática:
//   1. PostgreSQL (docker compose)            [omitir con: npm start -- --no-db]
//   2. tsc --watch del backend (shared, core, servicios, gateway)
//   3. Gateway local con node --watch (se reinicia al recompilar)
//   4. Vite (HMR) para admin, backoffice y POS
// Sin dependencias externas: solo Node 24+.
// ------------------------------------------------------------------
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { styleText } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DB = process.argv.includes('--no-db');
const GATEWAY_PORT = process.env.GATEWAY_PORT ?? '3000';

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
    styleText('bold', '  Market Pro · entorno de desarrollo'),
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
if (!existsSync(join(ROOT, '.env'))) {
  console.warn(styleText('yellow', 'No existe .env: copia .env.example a .env (el backend necesita JWT_SECRET, URLs de BD, etc.)'));
}

// ------------------------------------------------------------------ 1. base de datos

if (!SKIP_DB) {
  log('db', 'yellow', 'docker compose up -d postgres');
  const result = spawnSync('docker', ['compose', 'up', '-d', 'postgres'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    log('db', 'red', 'No se pudo levantar PostgreSQL con Docker (¿Docker Desktop está abierto?). Continuando...');
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
    ['--watch', '--env-file-if-exists=.env', 'backend/local-gateway/dist/main.js'],
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
  run(app.name, app.color, process.execPath, [VITE, '--clearScreen', 'false'], {
    cwd: join(ROOT, app.dir),
    onLine: (line) => line.includes('Local:') && markReady(app.name),
  });
}
