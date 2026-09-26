import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { schoolSettings, sessionYears, tenants } from '@/models/Schema';
import { isSchoolOnboardingComplete } from '../services/onboarding-completeness';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('onboarding completeness verification', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Onboarding Test School',
      slug: `onboarding-test-${tenantId}`,
      subscriptionStatus: 'active',
      isActive: true,
      logoUrl: null,
    });
    await db.insert(schoolSettings).values({
      tenantId,
      establishmentName: 'Onboarding Test School',
      address: null,
      academicYear: null,
    });
  });

  afterAll(async () => {
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(schoolSettings).where(eq(schoolSettings.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('reports incomplete when logo, address, and the current school year are missing', async () => {
    const complete = await isSchoolOnboardingComplete(tenantId);
    expect(complete).toBe(false);
  });

  it('reports incomplete when only logo is present', async () => {
    await db.update(tenants).set({ logoUrl: 'https://example.com/logo.png' }).where(eq(tenants.id, tenantId));
    const complete = await isSchoolOnboardingComplete(tenantId);
    expect(complete).toBe(false);
  });

  it('reports incomplete when logo and address are present but no current session year exists', async () => {
    await db.update(schoolSettings).set({ address: '123 Main St, Casablanca' }).where(eq(schoolSettings.tenantId, tenantId));
    const complete = await isSchoolOnboardingComplete(tenantId);
    expect(complete).toBe(false);
  });

  it('reports complete once logo, address, and a current session year are filled', async () => {
    // SCF-03-01: the year now lives in session_years (is_default), not in
    // school_settings.academic_year — writing the old column proves nothing.
    await db.insert(sessionYears).values({
      tenantId,
      name: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    });
    const complete = await isSchoolOnboardingComplete(tenantId);
    expect(complete).toBe(true);
  });
});
