/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run demo` prints example suggestions from test data instead of running the test suite.
const isDemo = process.env.npm_lifecycle_event === 'demo';

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; overridden in CI via BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: isDemo ? ['src/**/*.demo.ts'] : ['src/**/*.test.ts'],
  },
});
