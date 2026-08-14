import { describe, expect, it } from 'vitest';
import { maskConfig } from '../connections-service';

describe('Provider secret masking (maskConfig)', () => {
  it('masks secret keys so secrets never reach the browser', () => {
    const out = maskConfig({ apiKey: 'sk-live-123', token: 'tok', accessToken: 'at', phoneNumberId: '111', fromAddress: 'a@b.c', password: 'p' });
    expect(out.apiKey).toBe('••••••••');
    expect(out.token).toBe('••••••••');
    expect(out.accessToken).toBe('••••••••');
    expect(out.phoneNumberId).toBe('••••••••');
    expect(out.fromAddress).toBe('••••••••');
    expect(out.password).toBe('••••••••');
  });

  it('keeps non-secret config untouched', () => {
    const out = maskConfig({ senderName: 'SchoolOS', region: 'eu', apiKey: 'sk-1' });
    expect(out.senderName).toBe('SchoolOS');
    expect(out.region).toBe('eu');
    expect(out.apiKey).toBe('••••••••');
  });

  it('leaves empty secret values as-is (nothing to hide)', () => {
    const out = maskConfig({ apiKey: '' });
    expect(out.apiKey).toBe('');
  });

  it('handles an empty config', () => {
    expect(maskConfig({})).toEqual({});
  });
});
