import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'recharts', 'date-fns', 'clsx', 'tailwind-merge'],
          'excel': ['xlsx']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
