import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: true,
    // Let app.localhost (the staff console) through Vite's host check in dev.
    allowedHosts: ['localhost', 'app.localhost'],
    proxy: {
      // Talk to the NestJS backend in dev without CORS gymnastics.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  /**
   * Nothing readable ships.
   *
   * "I can see every .ts file in the Network tab" is TRUE — of `npm run dev`. The Vite dev
   * server serves your raw TypeScript modules over HTTP so it can hot-reload them; that is
   * what a dev server IS, and no setting turns it off without turning off development.
   *
   * `npm run build` is a different thing entirely: bundled, minified, tree-shaken, chunked,
   * with no source maps and no `console`. Verify it yourself:
   *
   *     npm run build
   *     find dist -name '*.ts' -o -name '*.map'      # → nothing
   *     grep -r console.log dist/                     # → nothing
   *
   * NEVER serve the dev server to anyone but yourself. Ship `dist/`.
   *
   * And be honest about the limit: a browser must download executable code to run it, so
   * JavaScript can never be *hidden*. Minification raises the cost of reading it; it does not
   * make it secret. Anything that must stay secret — a key, a rule, a price — belongs on the
   * server, and every one of them here does.
   */
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Strip debug code even if somebody forgot to. A stray console.log in production leaks
    // whatever it was printing to anyone who opens the console.
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries so app updates stay small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios'],
          charts: ['recharts'],
        },
      },
    },
  },
  esbuild: {
    // Belt and braces: drop() removes these at build time regardless of where they came from.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
