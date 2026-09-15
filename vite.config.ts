import react from '@vitejs/plugin-react'
// defineConfig vient de vitest/config (et non de vite) pour que la section `test` soit typée.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
