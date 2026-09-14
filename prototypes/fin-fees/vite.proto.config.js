// Local-only Vite config for the FIN-FEES prototype. Used by run.sh inside a
// throw-away workspace. Binds 127.0.0.1 on PROTO_PORT with strictPort, so it can
// never silently take another server's port, and keeps Vite's cache inside the
// workspace instead of the salown-app node_modules it borrows.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'

const here = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PROTO_PORT || 5288)

export default defineConfig({
  root: fileURLToPath(new URL('./app', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./.vite-cache', import.meta.url)),
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    fs: { allow: [here, realpathSync(fileURLToPath(new URL('./node_modules', import.meta.url)))] },
  },
  test: { include: ['**/*.test.ts'] },
})
