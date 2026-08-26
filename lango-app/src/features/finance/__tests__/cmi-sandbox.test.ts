import { describe, expect, it } from 'vitest';
import { CmiNapsProvider, isSandboxPaymentAllowed } from '@/libs/payments/cmi-naps-provider';
import { ApiError } from '@/libs/api/errors';

describe('H-1: CMI NAPS sandbox security guards', () => {
  const provider = new CmiNapsProvider();
  const env = process.env as Record<string, string | undefined>;

  it('validates isSandboxPaymentAllowed logic based on NODE_ENV and ALLOW_PAYMENT_SANDBOX', () => {
    const originalNodeEnv = env.NODE_ENV;
    const originalAllowSandbox = env.ALLOW_PAYMENT_SANDBOX;

    try {
      env.NODE_ENV = 'test';
      delete env.ALLOW_PAYMENT_SANDBOX;
      expect(isSandboxPaymentAllowed()).toBe(true);

      env.NODE_ENV = 'production';
      delete env.ALLOW_PAYMENT_SANDBOX;
      expect(isSandboxPaymentAllowed()).toBe(false);

      env.ALLOW_PAYMENT_SANDBOX = 'true';
      expect(isSandboxPaymentAllowed()).toBe(true);

      env.ALLOW_PAYMENT_SANDBOX = 'false';
      expect(isSandboxPaymentAllowed()).toBe(false);
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.ALLOW_PAYMENT_SANDBOX = originalAllowSandbox;
    }
  });

  it('rejects sandbox verification when production mode is set without allow flag', async () => {
    const originalNodeEnv = env.NODE_ENV;
    const originalAllowSandbox = env.ALLOW_PAYMENT_SANDBOX;

    try {
      env.NODE_ENV = 'production';
      delete env.ALLOW_PAYMENT_SANDBOX;

      await expect(
        provider.verifyCallback({
          rawBody: { externalReference: 'GW-123', amount: 100, status: 'paid' },
          signature: null,
          mode: 'sandbox',
        }),
      ).rejects.toThrow(ApiError);
    } finally {
      env.NODE_ENV = originalNodeEnv;
      env.ALLOW_PAYMENT_SANDBOX = originalAllowSandbox;
    }
  });

  it('rejects malformed sandbox verification bodies (missing externalReference or invalid amount)', async () => {
    await expect(
      provider.verifyCallback({
        rawBody: { externalReference: '', amount: 100, status: 'paid' },
        signature: null,
        mode: 'sandbox',
      }),
    ).rejects.toThrow(ApiError);

    await expect(
      provider.verifyCallback({
        rawBody: { externalReference: 'GW-123', amount: -50, status: 'paid' },
        signature: null,
        mode: 'sandbox',
      }),
    ).rejects.toThrow(ApiError);
  });
});
