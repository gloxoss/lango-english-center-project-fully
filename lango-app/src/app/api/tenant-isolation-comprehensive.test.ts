import { describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'dummy-secret-for-testing-123456789',
  },
}));

vi.mock('@/libs/DB', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  },
}));

import type { RequestContext } from '@/libs/api/context';
import { requireTenant } from '@/libs/api/context';
import { hasCapability } from '@/libs/api/permissions';

describe('Tenant Isolation & Safety Tests', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const USER_A = 'USER_A_ID';

  it('requireTenant throws when tenantId is missing', () => {
    const ctxWithoutTenant: RequestContext = {
      userId: 'admin1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'school_admin',
      baseRole: 'school_admin',
      tenantId: null,
      branchId: null,
    };
    expect(() => requireTenant(ctxWithoutTenant)).toThrow('Un établissement est requis pour cette opération.');
  });

  it('requireTenant returns tenantId when present', () => {
    const ctx: RequestContext = {
      userId: 'admin1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'school_admin',
      baseRole: 'school_admin',
      tenantId: TENANT_A,
      branchId: null,
    };
    expect(requireTenant(ctx)).toBe(TENANT_A);
  });

  it('super_admin bypasses tenant restrictions in permission checks', async () => {
    const isAllowed = await hasCapability('super_admin_id', TENANT_A, 'super_admin', 'students.delete');
    expect(isAllowed).toBe(true);
  });

  it('student role cannot delete student records in any tenant', async () => {
    const allowedInA = await hasCapability('student_user', TENANT_A, 'student', 'students.delete');
    const allowedInB = await hasCapability('student_user', TENANT_B, 'student', 'students.delete');
    expect(allowedInA).toBe(false);
    expect(allowedInB).toBe(false);
  });

  it('parent role cannot create or modify student records', async () => {
    const createAllowed = await hasCapability('parent_user', TENANT_A, 'parent', 'students.create');
    const updateAllowed = await hasCapability('parent_user', TENANT_A, 'parent', 'students.update');
    expect(createAllowed).toBe(false);
    expect(updateAllowed).toBe(false);
  });

  it('guard role cannot modify financial records or settings', async () => {
    const finAllowed = await hasCapability('guard_user', TENANT_A, 'guard', 'finance.manage');
    const setAllowed = await hasCapability('guard_user', TENANT_A, 'guard', 'settings.organization.manage');
    expect(finAllowed).toBe(false);
    expect(setAllowed).toBe(false);
  });
});
