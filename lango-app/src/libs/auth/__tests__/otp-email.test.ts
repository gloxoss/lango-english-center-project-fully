// Audit 3 P1-L: 2FA email codes are either really delivered or refused with a
// clear message in production, never silently dropped.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverOtpEmail, isOtpEmailConfigured } from '@/libs/auth/otp-email';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

describe('deliverOtpEmail', () => {
  it('refuses in production when no mail key is configured', async () => {
    delete process.env.PLATFORM_RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    vi.stubEnv('NODE_ENV', 'production');
    expect(isOtpEmailConfigured()).toBe(false);
    await expect(deliverOtpEmail('a@b.ma', '123456')).rejects.toThrow(/pas configuré/);
    vi.unstubAllEnvs();
  });

  it('is log-only outside production without a key', async () => {
    delete process.env.PLATFORM_RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    await expect(deliverOtpEmail('a@b.ma', '123456')).resolves.toBe('log_only');
  });

  it('sends through Resend when the key is set, with the code in the body', async () => {
    process.env.PLATFORM_RESEND_API_KEY = 're_test';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deliverOtpEmail('a@b.ma', '654321')).resolves.toBe('sent');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(body.to).toEqual(['a@b.ma']);
    expect(body.text).toContain('654321');
  });

  it('surfaces a provider failure instead of claiming success', async () => {
    process.env.PLATFORM_RESEND_API_KEY = 're_test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"bad"}', { status: 422 })));
    await expect(deliverOtpEmail('a@b.ma', '111111')).rejects.toThrow(/pas pu être envoyé/);
  });
});
