import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Se usa el código fuente de los paquetes compartidos (sin compilarlos antes)
    alias: [
      { find: /^@market-pro\/shared$/, replacement: fromRoot('../shared/src/index.ts') },
      { find: /^@market-pro\/frontend-common$/, replacement: fromRoot('../frontend-common/src/index.ts') },
      { find: /^@market-pro\/frontend-common\/styles\.css$/, replacement: fromRoot('../frontend-common/src/styles/theme.css') },
    ],
  },
  server: { port: 5174, strictPort: true },
});
