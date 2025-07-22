import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite conexiones desde fuera del localhost
    allowedHosts: true, // permite cualquier dominio (solo para desarrollo)
  },
})
