/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  test: {
    include: ['tests/core/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
