import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Playwright drives a real browser and would otherwise be picked up here.
    exclude: ['node_modules/**', 'e2e/**', 'dist/**'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**/*.{js,jsx}'] },
  },
});
