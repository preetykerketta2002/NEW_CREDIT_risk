import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: ['violet-greeter-size.ngrok-free.dev'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
