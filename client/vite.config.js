import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolveFromClient = dep => path.resolve(__dirname, 'node_modules', dep);

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolveFromClient('react'),
      'react-dom': resolveFromClient('react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': process.env.VITE_API_PROXY ?? 'http://localhost:4000',
    },
  },
}));
