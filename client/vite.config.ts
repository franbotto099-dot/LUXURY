import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  define: {
    // En producción usa VITE_API_URL, en dev usa proxy local
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
});
