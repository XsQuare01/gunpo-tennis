import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeApiOrigin } from './scripts/public-config.mjs';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const apiOrigin = normalizeApiOrigin(env.VITE_API_BASE_URL || '', {
    required: command === 'build',
    allowLocal: !env.CI,
  });
  return {
    base: env.VITE_BASE_PATH || './',
    plugins: [react()],
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiOrigin) },
    server: {
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
    },
    preview: {
      proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } },
    },
  };
});
