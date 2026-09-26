import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { sessionYears, tenants } from '@/models/Schema';

/**
 * Migration 0166 (SCF-02-02). "Which year is current" used to be enforced only
 * by app code, so a second `is_default` row or two overlapping years could be
 * inserted straight into the database and quietly split the school in two.
 * These are the database-level guards; the 409 mapping is what the API returns.
 */
describe('Session year guards (0166)', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const firstYearId = randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Guards Tenant', slug: `sg-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Guards Tenant B', slug: `sg-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(sessionYears).values({
      id: firstYearId,
      tenantId,
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-06-30',
      isDefault: true,
    });
  });

  afterAll(async () => {
    await db.delete(sessionYears).where(inArray(sessionYears.tenantId, [tenantId, otherTenantId]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('1. a second default year for the same tenant is refused (23505 -> 409)', async () => {
    const insertion = db.insert(sessionYears).values({
      id: randomUUID(),
      tenantId,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
      isDefault: true,
    });

    await expect(insertion).rejects.toThrow();

    // The API turns that into a 409, not a 500: it is a refused operation.
    // apiErrorResponse unwraps drizzle's DrizzleQueryError to the pg code.
    const response = apiErrorResponse(await insertion.catch((e: unknown) => e));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('ALREADY_EXISTS');
  });

  it('2. an overlapping year is refused (23P01 -> 409)', async () => {
    const insertion = db.insert(sessionYears).values({
      id: randomUUID(),
      tenantId,
      name: 'Chevauchement',
      startDate: '2025-06-01',
      endDate: '2026-06-30',
      isDefault: false,
    });

    await expect(insertion).rejects.toThrow();

    const response = apiErrorResponse(await insertion.catch((e: unknown) => e));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('SCHEDULE_CONFLICT');
  });

  it('3. a non-overlapping year is accepted (the guard is not a blanket refusal)', async () => {
    const nextYearId = randomUUID();
    await db.insert(sessionYears).values({
      id: nextYearId,
      tenantId,
      name: '2025-2026',
      startDate: '2025-07-01',
      endDate: '2026-06-30',
      isDefault: false,
    });

    const [row] = await db.select().from(sessionYears).where(eq(sessionYears.id, nextYearId));
    expect(row?.name).toBe('2025-2026');

    await db.delete(sessionYears).where(eq(sessionYears.id, nextYearId));
  });

  it('4. the overlap guard is per tenant: another school may use the same dates', async () => {
    await db.insert(sessionYears).values({
      id: randomUUID(),
      tenantId: otherTenantId,
      name: '2024-2025',
      startDate: '2024-09-01',
      endDate: '2025-06-30',
      isDefault: true,
    });

    const rows = await db.select().from(sessionYears).where(eq(sessionYears.tenantId, otherTenantId));
    expect(rows).toHaveLength(1);
  });
});
