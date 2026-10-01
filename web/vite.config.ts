/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The admin/ Next.js app serves /api/v1/*. Proxying it keeps the browser on
  // one origin in development, so no CORS setup is needed locally.
  const proxy = {
    '/api': { target: env.API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
  }
  return {
    plugins: [react()],
    // react-pdf is the one large chunk; it's split out and only loaded when a report is exported.
    build: { chunkSizeWarningLimit: 1400 },
    server: { port: 5180, proxy },
    preview: { port: 5180, proxy },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
