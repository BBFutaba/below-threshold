/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  // Cross-origin isolation gives performance.now() microsecond resolution for decoder timing.
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  test: {
    include: ['tests/core/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
