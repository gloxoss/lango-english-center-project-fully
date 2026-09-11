import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';
import { SETTINGS_REGISTRY, getEffectiveValue } from '@/libs/settings/registry';
import { settingDefinitionVersions, settingDefinitions } from '@/features/settings/models/settings-schema';
import { getCatalogDefinitions, syncSettingDefinitions } from '../services/definitions-service';

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

describe.skipIf(!hasDb)('setting definitions sync', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Defs Sync Test', slug: `defs-${tenantId}` });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('is idempotent: second run creates nothing and bumps no versions', async () => {
    const first = await syncSettingDefinitions(tenantId);
    expect(first.created).toBe(SETTINGS_REGISTRY.length);
    expect(first.updated).toBe(0);
    expect(first.unchanged).toBe(0);

    const second = await syncSettingDefinitions(tenantId);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(SETTINGS_REGISTRY.length);

    const rows = await db.select().from(settingDefinitions).where(eq(settingDefinitions.tenantId, tenantId));
    expect(rows).toHaveLength(SETTINGS_REGISTRY.length);

    // Every definition has exactly one version row (v1) — nothing re-synced.
    const versions = await db.select().from(settingDefinitionVersions)
      .where(eq(settingDefinitionVersions.tenantId, tenantId));
    expect(versions).toHaveLength(SETTINGS_REGISTRY.length);
    expect(versions.every(v => v.version === 1)).toBe(true);
  });

  it('exposes the catalog merged with the code registry', async () => {
    const catalog = await getCatalogDefinitions(tenantId);
    expect(catalog.length).toBe(SETTINGS_REGISTRY.length);
    const byKey = new Map(catalog.map(c => [c.key, c]));
    for (const def of SETTINGS_REGISTRY) {
      expect(byKey.get(def.key)?.label).toBe(def.label);
    }
  });
});

// Regression: /api/settings/catalog answered 400 for a seeded tenant, which
// blanked the settings hub and the values page.
//
// seed-full.ts used to insert setting_definitions rows for 'general.schoolName'
// and 'general.locale'. There is no `general` namespace in SETTINGS_REGISTRY,
// so those rows had no code definition behind them. The catalog route resolves
// an effective value per definition, and getEffectiveValue calls getDefinition,
// which throws UNKNOWN_SETTING for an unknown key - so one orphan row 400'd the
// entire catalog, not just that entry.
describe.skipIf(!hasDb)('setting definitions — orphaned registry keys', () => {
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Orphan Defs Test', slug: `orphan-${tenantId}` });
    await db.insert(settingDefinitions).values({
      tenantId,
      key: 'general.locale',
      label: 'Langue',
      description: null,
      namespace: 'general',
      scope: 'tenant',
      sensitivity: 'public',
      defaultValue: { value: 'fr' },
      requiredPermission: null,
      legacyField: null,
      isActive: true,
      isCodeOwned: false,
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('drops definitions the code registry does not know, instead of 400ing the catalog', async () => {
    const catalog = await getCatalogDefinitions(tenantId);
    expect(catalog.map(c => c.key)).not.toContain('general.locale');
    expect(catalog.length).toBe(SETTINGS_REGISTRY.length);
  });

  it('returns only definitions that can actually be resolved', async () => {
    // This is the invariant the 400 violated: the catalog is consumed by
    // resolving an effective value for every entry it hands back.
    const catalog = await getCatalogDefinitions(tenantId);
    expect(catalog.length).toBeGreaterThan(0);

    for (const def of catalog) {
      await expect(
        getEffectiveValue(tenantId, null, def.key),
        `${def.key} is in the catalog but cannot be resolved`,
      ).resolves.toBeDefined();
    }
  });
});
