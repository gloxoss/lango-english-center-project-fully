// Broadcast provider degrade-honestly contract. Real carriers (WhatsApp/Telegram/
// SMTP/SMS gateways) are intentionally not wired; the registry resolves a provider
// by name and returns null for anything unknown so call sites must degrade rather
// than fabricate delivery. The deterministic test provider's outcomes are driven
// by the recipient address, never real I/O.
import { describe, expect, it } from 'vitest';
import { getProvider, listProviders } from '../../providers/provider';
import { TestProvider } from '../../providers/test-provider';

describe('broadcast provider registry + test provider (degrade honestly)', () => {
  it('resolves the registered test provider but returns null for an unknown provider', () => {
    const test = getProvider('test');
    expect(test).not.toBeNull();
    expect(test?.provider).toBe('test');
    // Unknown / unbuilt carriers must resolve to null so callers degrade.
    expect(getProvider('whatsapp')).toBeNull();
    expect(getProvider('smtp')).toBeNull();
    expect(listProviders()).toContain('test');
  });

  it('the test provider declares every channel but performs no real I/O', async () => {
    const p = new TestProvider();
    expect(p.channels).toEqual(expect.arrayContaining(['sms', 'email', 'whatsapp', 'telegram', 'messenger']));
    const conn = await p.testConnection();
    expect(conn.ok).toBe(true);
    expect(conn.message).toContain('aucun envoi réel');
  });

  it('maps BOUNCE addresses to a permanent, non-retryable failure', async () => {
    const p = new TestProvider();
    const result = await p.send({ channel: 'sms', to: 'BOUNCE +212600000000', bodyText: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('bounced');
      expect(result.retryable).toBe(false);
    }
  });

  it('maps RETRY addresses to a transient, retryable failure', async () => {
    const p = new TestProvider();
    const result = await p.send({ channel: 'email', to: 'retryfail@example.com', bodyText: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('failed');
      expect(result.retryable).toBe(true);
    }
  });

  it('maps DELIVERED addresses to a delivered outcome and others to sent', async () => {
    const p = new TestProvider();
    const delivered = await p.send({ channel: 'sms', to: 'DELIVERED +212600000001', bodyText: 'hi' });
    expect(delivered).toMatchObject({ ok: true, status: 'delivered' });

    const sent = await p.send({ channel: 'sms', to: '+212600000002', bodyText: 'hi' });
    expect(sent).toMatchObject({ ok: true, status: 'sent' });
  });
});
