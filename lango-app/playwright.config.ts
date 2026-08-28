import type { ChromaticConfig } from '@chromatic-com/playwright';
import { defineConfig, devices } from '@playwright/test';

// Use process.env.PORT by default and fallback to port 3008
// to avoid conflicts with the Next.js default port 3000.
const PORT = process.env.PORT ?? '3008';

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<ChromaticConfig>({
  testDir: './tests',
  // Look for files with the .integ.js or .e2e.js extension
  testMatch: '*.@(integ|e2e).?(c|m)[jt]s?(x)',
  // Timeout per test. Dev-mode on-demand compilation of a dashboard page can
  // exceed 30s (verified 2026-08-27) and parallel first-hits queue behind one
  // Turbopack compiler (verified 2026-08-28: 7 cold-page timeouts, all green
  // once warm), so 90s locally; CI runs a production build where pages are fast.
  timeout: 90 * 1000,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Reporter to use. See https://playwright.dev/docs/test-reporters
  reporter: process.env.CI ? 'github' : 'list',

  expect: {
    // Set timeout for async expect matchers
    timeout: 15 * 1000,
  },

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  // W6: this used to boot a pglite-socket server via `--run '...'`, but that
  // command never worked: pglite-socket's parseArgs rejects the split positional
  // on Windows quoting (verified 2026-08-27 — the suite had never executed), and
  // scripts/run-db-migrate.cjs referenced by db-server:* does not exist. The
  // suite now uses DATABASE_URL directly: the local dev DB (docker schoolos-db,
  // migrated + seeded) locally, and the CI job's Postgres service in CI.
  webServer: {
    command: process.env.CI ? 'run-s start' : 'run-s dev:next',
    url: baseURL,
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 2 * 1000 },
    env: {
      BROWSER_TO_TERMINAL_DISABLED: 'true',
      NEXT_PUBLIC_SENTRY_DISABLED: 'true',
      NEXT_PUBLIC_APP_URL: baseURL,
      // The webServer runs on PORT (3008), but .env pins BETTER_AUTH_URL to
      // :3000 — better-auth then rejects the sign-in POST as INVALID_ORIGIN
      // (verified 2026-08-27). Pin it to the test server origin instead.
      BETTER_AUTH_URL: baseURL,
      PORT,
    },
  },

  // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions.
  use: {
    // Use baseURL so to make navigations relative.
    // More information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: process.env.CI ? 'on' : 'retain-on-failure',

    // Record videos when retrying the failed test.
    video: process.env.CI ? 'retain-on-failure' : undefined,

    // Disable automatic screenshots at test completion when using Chromatic test fixture.
    disableAutoSnapshot: true,
  },

  projects: [
    // `setup` and `teardown` are used to run code before and after all E2E tests.
    // These functions can be used to configure Clerk for testing purposes. For example, bypassing bot detection.
    // In the `setup` file, you can create an account in `Test mode`.
    // For each test, an organization can be created within this account to ensure total isolation.
    // After all tests are completed, the `teardown` file can delete the account and all associated organizations.
    // You can find the `setup` and `teardown` files at: https://nextjs-boilerplate.com/pro-saas-starter-kit
    // Or, need a Self-hosted auth stack (Better Auth)? Try Next.js Boilerplate Max: https://nextjs-boilerplate.com/nextjs-multi-tenant-saas-boilerplate
    { name: 'setup', testMatch: /.*\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /.*\.teardown\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
});
