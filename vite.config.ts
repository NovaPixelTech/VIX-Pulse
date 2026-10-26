import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'VIX-Pulse'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // ECharts is loaded only on the chart-heavy routes, but it is still a
    // large shared chunk. Keep the warning threshold aligned with that split.
    chunkSizeWarningLimit: 1600,
  },
}))
