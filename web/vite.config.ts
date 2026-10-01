/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Emits sw.js with this build's own file list and a version taken from the
 * files' contents (REACH-01). The worker itself is sw/service-worker.js.
 */
function serviceWorker(): Plugin {
  let base = '/'
  let root = ''
  let publicDir = ''
  return {
    name: 'carma-service-worker',
    apply: 'build',
    // After Vite has written index.html into the bundle.
    enforce: 'post',
    configResolved(config) {
      base = config.base
      root = config.root
      publicDir = config.publicDir
    },
    generateBundle(_options, bundle) {
      const hash = createHash('sha256')
      const files: string[] = []
      const code = Object.values(bundle)
        .map((item) => (item.type === 'chunk' ? item.code : ''))
        .join('\n')
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (name.endsWith('.map')) continue
        // Browsers that run service workers take .woff2; a .woff is kept only
        // when the code asks for it by name — the PDF engine's fonts.
        if (name.endsWith('.woff') && !code.includes(path.basename(name))) continue
        files.push(name)
        hash.update(name).update(item.type === 'chunk' ? item.code : item.source)
      }
      const fromPublic = publicDir && existsSync(publicDir) ? readdirSync(publicDir).sort() : []
      for (const name of fromPublic) hash.update(name).update(readFileSync(path.join(publicDir, name)))
      const precache = [...files, ...fromPublic].map((name) => `${base}${name}`)
      const source = readFileSync(path.join(root, 'sw/service-worker.js'), 'utf8')
        .replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__BASE__', JSON.stringify(base))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The admin/ Next.js app serves /api/v1/*. Proxying it keeps the browser on
  // one origin in development, so no CORS setup is needed locally.
  const proxy = {
    '/api': { target: env.API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
  }
  return {
    plugins: [react(), serviceWorker()],
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
