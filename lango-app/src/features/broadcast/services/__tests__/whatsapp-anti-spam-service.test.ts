import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getWhatsAppQuota,
  assertAndConsumeWhatsAppQuota,
} from '../whatsapp-anti-spam-service';
import { ApiError } from '@/libs/api/errors';

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  },
}));

describe('WhatsApp Anti-Spam & Quota Control Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default quota for trial tier when no tenant row found', async () => {
    const quota = await getWhatsAppQuota('test-tenant-1');
    expect(quota.dailyLimit).toBe(25); // trial tier default
    expect(quota.antiBanDelayMs).toBe(1200);
    expect(quota.isAllowed).toBe(true);
    expect(quota.remainingToday).toBeGreaterThan(0);
  });

  it('asserts and consumes quota successfully within limit', async () => {
    const updated = await assertAndConsumeWhatsAppQuota('test-tenant-2', 5);
    expect(updated.usedToday).toBe(5);
    expect(updated.remainingToday).toBe(20);
    expect(updated.isAllowed).toBe(true);
  });

  it('throws 429 when attempting to consume more than remaining daily limit', async () => {
    const tenantId = 'test-tenant-burst';
    // Consume 25 (the entire limit)
    await assertAndConsumeWhatsAppQuota(tenantId, 25);

    // Next consume attempt should throw 429 ApiError
    await expect(assertAndConsumeWhatsAppQuota(tenantId, 1)).rejects.toThrow(ApiError);

    try {
      await assertAndConsumeWhatsAppQuota(tenantId, 1);
    } catch (err: any) {
      expect(err.status).toBe(429);
      expect(err.code).toBe('WHATSAPP_DAILY_QUOTA_EXCEEDED');
      expect(err.message).toContain('Anti-Ban Meta');
    }
  });
});
