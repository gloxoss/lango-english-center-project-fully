import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      include: ['src/**/*'],
      exclude: ['src/**/*.stories.{js,jsx,ts,tsx}'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{js,ts}'],
          exclude: ['src/hooks/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        // Browser-only: inline the NEXT_PUBLIC_ subset of process.env for the
        // browser runtime. Kept out of the unit project — defining
        // 'process.env' globally compiles server-side env reads
        // (e.g. process.env.DATABASE_URL) to undefined and silently skips
        // every DB-gated test.
        define: {
          'process.env': JSON.stringify(loadEnv('', process.cwd(), 'NEXT_PUBLIC_')),
        },
        test: {
          name: 'ui',
          include: ['**/*.test.tsx', 'src/hooks/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            screenshotDirectory: 'vitest-test-results',
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
    ],
    reporters: [
      'default',
      // conditional reporter
      process.env.CI ? 'github-actions' : {},
    ],
    // Expose .env variables to Node.js tests. An explicitly exported
    // DATABASE_URL (shell/CI) wins over the .env value so a dedicated test
    // database can be targeted without editing files.
    env: {
      ...loadEnv('', process.cwd(), ''),
      ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
    },
  },
});
