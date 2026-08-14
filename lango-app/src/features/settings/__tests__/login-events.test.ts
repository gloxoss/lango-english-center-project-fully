import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import { listLoginEvents, recordLoginEvent } from '../services/login-events-service';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const USER_ID = `USR-LOGIN-${crypto.randomUUID()}`;

describe.skipIf(!hasDb)('login events', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Login Events Test', slug: `login-${tenantId}` });
    await db.insert(user).values({
      id: USER_ID,
      tenantId,
      name: 'Login Tester',
      email: `login-${tenantId}@test.local`,
      role: 'school_admin',
      userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('records success and failure events and lists them with a tenant-wide summary', async () => {
    await recordLoginEvent({ tenantId, userId: USER_ID, email: 'admin@school.ma', method: 'email', success: true, ip: '10.0.0.1', userAgent: 'Chrome' });
    await recordLoginEvent({ tenantId, userId: USER_ID, email: 'admin@school.ma', method: 'email', success: false, failureReason: 'invalid_credentials', ip: '10.0.0.2', userAgent: 'Firefox' });
    await recordLoginEvent({ tenantId, userId: null, email: 'nobody@school.ma', method: 'email', success: false, failureReason: 'invalid_credentials', ip: '10.0.0.3', userAgent: 'Edge' });

    const result = await listLoginEvents(tenantId, {});
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.total).toBeGreaterThanOrEqual(3);
    expect(result.summary.failed).toBeGreaterThanOrEqual(2);
    expect(result.summary.success).toBeGreaterThanOrEqual(1);
  });

  it('filters failures and email substring; the summary stays tenant-wide', async () => {
    const failed = await listLoginEvents(tenantId, { success: false });
    expect(failed.rows.length).toBeGreaterThan(0);
    expect(failed.rows.every(r => r.success === false)).toBe(true);

    const byEmail = await listLoginEvents(tenantId, { email: 'nobody' });
    expect(byEmail.rows.every(r => r.email === 'nobody@school.ma')).toBe(true);
    expect(byEmail.total).toBe(byEmail.rows.length);
  });

  it('paginates and clamps limit to the allowed range', async () => {
    const page1 = await listLoginEvents(tenantId, { page: 1, limit: 2 });
    const page2 = await listLoginEvents(tenantId, { page: 2, limit: 2 });
    expect(page1.page).toBe(1);
    expect(page2.page).toBe(2);
    expect(page1.rows.length).toBeLessThanOrEqual(2);
    expect(page2.rows.length).toBeLessThanOrEqual(2);

    const clamped = await listLoginEvents(tenantId, { limit: 500 });
    expect(clamped.limit).toBe(100);
  });
});
