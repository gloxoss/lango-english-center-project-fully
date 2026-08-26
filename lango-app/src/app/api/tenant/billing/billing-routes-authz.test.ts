import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as checkout } from './checkout-session/route';
import { POST as portal } from './portal-session/route';

const { requireRequestContext } = vi.hoisted(() => ({ requireRequestContext: vi.fn() }));

vi.mock('@/libs/api/context', () => ({ requireRequestContext }));

describe('platform billing routes authorization', () => {
  beforeEach(() => {
    requireRequestContext.mockResolvedValue({
      userId: 'teacher-1',
      tenantId: '00000000-0000-4000-8000-000000000001',
      branchId: null,
      role: 'teacher',
      baseRole: 'teacher',
      name: 'Teacher',
      email: 'teacher@example.com',
    });
  });

  it.each([
    ['checkout-session', checkout],
    ['portal-session', portal],
  ])('returns 403 from %s for a non-admin tenant member', async (_name, handler) => {
    const response = await handler(new Request(`http://localhost/api/tenant/billing/${_name}`, { method: 'POST' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
  });
});
