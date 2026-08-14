import { describe, expect, it } from 'vitest';
import {
  MIN_JOIN_SECRET_LENGTH, resolveJoinSecretConfig,
} from './signing-key';

const strong = 'a'.repeat(MIN_JOIN_SECRET_LENGTH + 8);

describe('join signing-key configuration (fails closed in production)', () => {
  it('dev/test mode uses the labeled dev fallback when no secret is set', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'test', joinSecret: undefined });
    expect(cfg).toMatchObject({ ok: true, mode: 'dev' });
    if (cfg.ok) {
      expect(cfg.current.startsWith('dev:')).toBe(true);
      expect(cfg.current).not.toContain('production');
    }
  });

  it('dev/test mode accepts an explicitly provided secret (never the raw value in responses)', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'development', joinSecret: strong });
    expect(cfg).toMatchObject({ ok: true, mode: 'dev', current: strong });
  });

  it('production fails closed when the secret is missing', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: undefined });
    expect(cfg).toEqual({ ok: false, reason: 'MISSING' });
  });

  it('production fails closed when the secret is too short', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: 'short' });
    expect(cfg).toEqual({ ok: false, reason: 'TOO_SHORT' });
  });

  it('production fails closed on known-insecure literals', () => {
    for (const known of [
      'dev-join-secret-do-not-use-in-prod',
      'dev:local-dev-signing-key-do-not-use-in-prod-0123456789abcdef',
    ]) {
      expect(resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: known }))
        .toEqual({ ok: false, reason: 'KNOWN_INSECURE' });
    }
  });

  it('production fails closed on any dev:-prefixed secret', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: `dev:${strong}` });
    expect(cfg).toEqual({ ok: false, reason: 'KNOWN_INSECURE' });
  });

  it('production accepts a strong secret and never exposes it', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: strong });
    expect(cfg).toMatchObject({ ok: true, mode: 'production', current: strong });
  });

  it('production carries the previous key for rotation grace', () => {
    const cfg = resolveJoinSecretConfig({ nodeEnv: 'production', joinSecret: strong, previousJoinSecret: 'p'.repeat(40) });
    expect(cfg).toMatchObject({ ok: true, mode: 'production', previous: 'p'.repeat(40) });
  });
});
