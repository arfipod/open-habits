import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react') || id.includes('/react-dom')) return 'react-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('/jszip')) return 'zip-vendor'
          return 'vendor'
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 10000,
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key'
    },
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/types.ts',
        'src/vite-env.d.ts',
        'src/lib/supabase/database.types.ts'
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85
      }
    }
  }
})
