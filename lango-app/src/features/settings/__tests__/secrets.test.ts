import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { settingValues, tenants, user } from '@/models/Schema';
import { decryptSecret, encryptSecret, isEncrypted } from '@/libs/api/secrets';
import { getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import type { RequestContext } from '@/libs/api/context';
import { secretReferences } from '@/features/settings/models/settings-schema';
import { peekSecretValue, rotateSecretValue } from '../services/secrets-service';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

const SECRET_KEY = 'integrations.webhookSigningSecret';
const SECRET = 'whsec_0123456789abcdef0123456789abcdef';
const USER_ID = `USR-SECRET-${crypto.randomUUID()}`;

function fakeContext(tenantId: string): RequestContext {
  return {
    userId: USER_ID,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Secret Tester',
    email: 'secret.tester@example.com',
  };
}

describe('encryptSecret', () => {
  it('round-trips plaintext through encrypt -> decrypt', () => {
    const blob = encryptSecret(SECRET);
    expect(isEncrypted(blob)).toBe(true);
    expect(decryptSecret(blob)).toBe(SECRET);
  });

  it('produces a unique ciphertext per call (fresh IV)', () => {
    const a = encryptSecret(SECRET);
    const b = encryptSecret(SECRET);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(SECRET);
    expect(decryptSecret(b)).toBe(SECRET);
  });

  it('rejects tampered ciphertext', () => {
    const blob = encryptSecret(SECRET);
    const parts = blob.split(':');
    const corrupted = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]!.slice(0, -1)}x`;
    expect(() => decryptSecret(corrupted)).toThrow();
  });

  it('throws if neither ENCRYPTION_KEY nor BETTER_AUTH_SECRET is set', () => {
    const origEnc = process.env.ENCRYPTION_KEY;
    const origAuth = process.env.BETTER_AUTH_SECRET;
    try {
      delete process.env.ENCRYPTION_KEY;
      delete process.env.BETTER_AUTH_SECRET;
      expect(() => encryptSecret('test-secret')).toThrow(/Missing required encryption key/);
    } finally {
      process.env.ENCRYPTION_KEY = origEnc;
      process.env.BETTER_AUTH_SECRET = origAuth;
    }
  });
});

describe.skipIf(!hasDb)('secret storage at rest', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Secrets Test', slug: `secrets-${tenantId}` });
    await db.insert(user).values({
      id: USER_ID, tenantId, name: 'Secret Tester', email: `secret-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('stores secrets encrypted and masks them through the public read path', async () => {
    await setSettingValue(tenantId, null, SECRET_KEY, SECRET, fakeContext(tenantId));

    const [row] = await db.select().from(settingValues)
      .where(eq(settingValues.tenantId, tenantId))
      .limit(1);
    expect(row!.value).not.toBe(SECRET);
    expect(isEncrypted(row!.value as string)).toBe(true);

    const effective = await getEffectiveValue(tenantId, null, SECRET_KEY);
    expect(effective.value).toBe('********');
  });

  it('peek decrypts the stored value', async () => {
    const resolved = await peekSecretValue(fakeContext(tenantId), SECRET_KEY);
    expect(resolved.value).toBe(SECRET);
    expect(resolved.encrypted).toBe(true);
    expect(resolved.source).toBe('tenant');
  });

  it('rotate re-encrypts in place without a version bump and audits a secretReference', async () => {
    const before = await peekSecretValue(fakeContext(tenantId), SECRET_KEY);
    const [blobBefore] = await db.select({ value: settingValues.value }).from(settingValues)
      .where(eq(settingValues.tenantId, tenantId)).limit(1);

    const result = await rotateSecretValue(fakeContext(tenantId), SECRET_KEY);
    const after = await peekSecretValue(fakeContext(tenantId), SECRET_KEY);

    expect(result.version).toBe(before.version); // no version churn
    expect(result.settingValueId).toBe(before.settingValueId);

    const [row] = await db.select().from(settingValues)
      .where(eq(settingValues.tenantId, tenantId))
      .limit(1);
    expect(isEncrypted(row!.value as string)).toBe(true);

    // The blob must have changed (fresh IV); the plaintext must not.
    expect(row!.value).not.toBe(blobBefore!.value);
    expect(after.value).toBe(SECRET);

    const refs = await db.select().from(secretReferences)
      .where(eq(secretReferences.tenantId, tenantId));
    expect(refs).toHaveLength(1);
    expect(refs[0]!.key).toBe(SECRET_KEY);
    expect(refs[0]!.cipher).toBe('aes-256-gcm');
  });

  it('legacy plaintext secret rows still resolve through peek and encrypt on rotation', async () => {
    // Simulate a pre-encryption row: plaintext value stored directly.
    const plaintext = 'legacy-plaintext-secret-abcdef';
    await db.delete(settingValues).where(and(
      eq(settingValues.tenantId, tenantId),
      eq(settingValues.key, SECRET_KEY),
    ));
    await db.insert(settingValues).values({
      tenantId,
      branchId: null,
      key: SECRET_KEY,
      value: plaintext,
      version: 99,
      updatedBy: USER_ID,
    });

    const resolved = await peekSecretValue(fakeContext(tenantId), SECRET_KEY);
    expect(resolved.value).toBe(plaintext);
    expect(resolved.encrypted).toBe(false);

    await rotateSecretValue(fakeContext(tenantId), SECRET_KEY);
    const [row] = await db.select().from(settingValues)
      .where(eq(settingValues.tenantId, tenantId))
      .limit(1);
    expect(isEncrypted(row!.value as string)).toBe(true);
    const decrypted = await peekSecretValue(fakeContext(tenantId), SECRET_KEY);
    expect(decrypted.value).toBe(plaintext);
  });
});
