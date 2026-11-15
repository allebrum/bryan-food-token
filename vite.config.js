import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: { '/api': 'http://localhost:5181' },
  },
  // `npx vite preview` serves the production build (with the service worker).
  preview: {
    port: 5183,
    proxy: { '/api': 'http://localhost:5181' },
  },
})
