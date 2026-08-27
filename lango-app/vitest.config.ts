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
          // Real Postgres transaction tests exceed Vitest's 5000ms default under
          // 12-way parallel load: `library-accounting-adapter.test.ts` disables/
          // re-enables accounting triggers via ALTER TABLE, which takes an
          // AccessExclusiveLock that blocks concurrent DML on the shared
          // accounting tables for seconds on a cold DB. Raise the ceiling rather
          // than cap concurrency — every suite passes, only wall-clock headroom
          // is missing (see VERIFICATION-EVIDENCE / D-4).
          testTimeout: 30_000,
          // Worker pool. Vitest 4's default `forks` pool intermittently kills a
          // worker under parallel load on Windows ("Worker forks emitted error
          // / Worker exited unexpectedly"), failing `npm run test` with exit 1
          // even though every test passes. `threads` (worker_threads) is stable
          // at full parallelism here — see VERIFICATION-EVIDENCE / D-4.
          pool: 'threads',
          // Hard precondition: a reachable Postgres DB, or ALLOW_DB_SKIP=1
          // explicitly. Fails the run immediately (before any suite skips)
          // when the DB is down. Scoped to the unit project — browser (ui)
          // tests are pure component tests and do not need a database.
          globalSetup: ['vitest.global-setup.ts'],
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
