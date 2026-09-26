import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { addonDefinitions, addonEntitlements, tenants } from '@/models/Schema';

/**
 * SCF-09-02. `/api/settings/addons` listed every row of `addon_definitions`,
 * including the ones with `enabled = false` — modules that are not built. On the
 * VPS that put the retired `test` definition in front of a school admin as a
 * module they could ask for.
 *
 * The rule: an unbuilt module is hidden UNLESS the tenant already holds a grant.
 * The exception is the point of the test — a school that is paying for a module
 * must never stop seeing it because the definition was flipped off.
 */

const requireRequestContext = vi.fn();
vi.mock('@/libs/api/context', () => ({
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
  requireRequestContext: (...args: unknown[]) => requireRequestContext(...args),
}));

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const BUILT_ADDON = `built-${tenantId.slice(0, 8)}`;
const UNBUILT_ADDON = `unbuilt-${tenantId.slice(0, 8)}`;
const GRANTED_UNBUILT_ADDON = `granted-unbuilt-${tenantId.slice(0, 8)}`;

function ctx() {
  return {
    userId: 'usr-addon-admin',
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Directeur',
    email: 'directeur@addon.test',
    sessionId: null,
    impersonated: false,
  };
}

const get = () => new Request('http://localhost:3000/api/settings/addons');

describe('Addon catalogue visibility (SCF-09-02)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Addon Visibility Tenant', slug: `av-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Addon Visibility Other', slug: `avo-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(addonDefinitions).values([
      { id: BUILT_ADDON, name: 'Module Construit', description: 'Disponible.', enabled: true, sortOrder: 901 },
      { id: UNBUILT_ADDON, name: 'Module Non Construit', description: 'Pas encore développé.', enabled: false, sortOrder: 902 },
      { id: GRANTED_UNBUILT_ADDON, name: 'Module Accordé', description: 'Définition désactivée mais déjà accordé.', enabled: false, sortOrder: 903 },
    ]);
    // The tenant holds a grant for the third one only.
    await db.insert(addonEntitlements).values({
      tenantId,
      addonId: GRANTED_UNBUILT_ADDON,
      isEnabled: true,
    });
  });

  afterAll(async () => {
    await db.delete(addonEntitlements).where(inArray(addonEntitlements.tenantId, [tenantId, otherTenantId]));
    await db.delete(addonDefinitions).where(inArray(addonDefinitions.id, [BUILT_ADDON, UNBUILT_ADDON, GRANTED_UNBUILT_ADDON]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('1. hides an unbuilt module the school is not entitled to', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { GET } = await import('@/app/api/settings/addons/route');

    const res = await GET(get());
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = json.data.map((a: { addonId: string }) => a.addonId);

    expect(ids).toContain(BUILT_ADDON);
    expect(ids).not.toContain(UNBUILT_ADDON);
  });

  it('2. keeps an unbuilt module the school already holds', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { GET } = await import('@/app/api/settings/addons/route');

    const json = await (await GET(get())).json();
    const granted = json.data.find((a: { addonId: string }) => a.addonId === GRANTED_UNBUILT_ADDON);

    expect(granted).toBeDefined();
    expect(granted.active).toBe(true);
    // `built` stays honest: hidden from the catalogue, but not claimed as built.
    expect(granted.built).toBe(false);
  });

  it('3. the other tenant\'s grant does not leak into this school\'s catalogue', async () => {
    await db.insert(addonEntitlements).values({
      tenantId: otherTenantId,
      addonId: UNBUILT_ADDON,
      isEnabled: true,
    });

    requireRequestContext.mockResolvedValue(ctx());
    const { GET } = await import('@/app/api/settings/addons/route');
    const json = await (await GET(get())).json();
    const ids = json.data.map((a: { addonId: string }) => a.addonId);

    expect(ids).not.toContain(UNBUILT_ADDON);
    await db.delete(addonEntitlements).where(eq(addonEntitlements.tenantId, otherTenantId));
  });
});
