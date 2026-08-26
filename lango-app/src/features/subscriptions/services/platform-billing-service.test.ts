import type { RequestContext } from '@/libs/api/context';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import { isPlatformBillingMetadata } from '@/libs/payments/platform-billing-provider';
import { requirePlatformBillingAdmin } from './platform-billing-service';

function context(role: RequestContext['role'], baseRole = role): RequestContext {
  return {
    userId: 'user-1',
    tenantId: '00000000-0000-4000-8000-000000000001',
    branchId: null,
    role,
    baseRole,
    name: 'Test',
    email: 'test@example.com',
  };
}

describe('platform billing authorization', () => {
  it.each(['teacher', 'accountant', 'receptionist'] as const)('returns 403 semantics for non-admin role %s', (role) => {
    try {
      requirePlatformBillingAdmin(context(role));
      throw new Error('expected authorization to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
    }
  });

  it('rejects a non-admin base account even if an active role claims school_admin', () => {
    expect(() => requirePlatformBillingAdmin(context('school_admin', 'teacher'))).toThrow(ApiError);
  });

  it('allows only the tenant school administrator', () => {
    expect(requirePlatformBillingAdmin(context('school_admin'))).toBe('00000000-0000-4000-8000-000000000001');
  });
});

describe('Stripe concern separation', () => {
  it('accepts only explicit platform-billing metadata', () => {
    expect(isPlatformBillingMetadata({ billingConcern: 'schoolos_platform' })).toBe(true);
    expect(isPlatformBillingMetadata({ tenant_id: 'tenant', invoice_id: 'invoice' })).toBe(false);
    expect(isPlatformBillingMetadata(null)).toBe(false);
  });
});
