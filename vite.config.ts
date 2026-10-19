import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    watch: {
      ignored: [
        '**/android/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/.tools/**',
        '**/artifacts/**',
      ],
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2022' },
});
