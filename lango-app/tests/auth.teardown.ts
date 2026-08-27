import { test as teardown } from '@playwright/test';

teardown('global e2e teardown and resource cleanup', async () => {
  console.log('Playwright E2E suite completed.');
});
