import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { customFieldDefinitions, customFieldValues } from '@/features/settings/models/settings-schema';
import { tenants } from '@/models/Schema';

/**
 * SCF-08-02. The student detail page shows the tenant's active student custom
 * fields and lets a school_admin edit them inline. Reading is allowed to any
 * role that can see the student (students.read) so the card is read-only for
 * teachers; writing stays school_admin + settings.custom_field.manage.
 *
 * Real capabilities (requireCapability is NOT mocked): the assertions are about
 * the actual role defaults.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().slice(0, 8);
const tenantId = randomUUID();
const otherTenantId = randomUUID();
const definitionId = randomUUID();
const STUDENT = `STU-CF-${suffix}`;

function ctxFor(role: 'school_admin' | 'teacher', tenant = tenantId) {
  return {
    userId: `USR-CF-${role}-${suffix}`,
    tenantId: tenant,
    branchId: null,
    role,
    baseRole: role,
    name: role,
    email: `${role}@cf.test`,
    sessionId: null,
    impersonated: false,
  };
}

async function as(role: 'school_admin' | 'teacher', tenant = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue(ctxFor(role, tenant) as never);
}

const params = () => ({ params: Promise.resolve({ id: definitionId }) });

function getValue(entityId = STUDENT) {
  return import('@/app/api/settings/custom-fields/[id]/values/route').then(({ GET }) => GET(
    new Request(`http://localhost:3000/api/settings/custom-fields/${definitionId}/values?entityId=${encodeURIComponent(entityId)}`),
    params(),
  ));
}

function putValue(value: unknown, entityId = STUDENT) {
  return import('@/app/api/settings/custom-fields/[id]/values/route').then(({ PUT }) => PUT(
    new Request(`http://localhost:3000/api/settings/custom-fields/${definitionId}/values`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityId, value }),
    }),
    params(),
  ));
}

describe.skipIf(!dbReachable)('Student custom fields read/write (SCF-08-02)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `CF Tenant ${suffix}`, slug: `cf-${suffix}` },
      { id: otherTenantId, name: `CF Other ${suffix}`, slug: `cfo-${suffix}` },
    ]);
    await db.insert(customFieldDefinitions).values({
      id: definitionId,
      tenantId,
      key: `sport_${suffix}`,
      label: 'Sport pratiqué',
      entityType: 'student',
      fieldType: 'text',
      isActive: true,
    });
  });

  afterAll(async () => {
    await db.delete(customFieldValues).where(eq(customFieldValues.tenantId, tenantId));
    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('a school_admin saves a value and reloads it', async () => {
    await as('school_admin');
    const saved = await putValue('Natation');
    expect(saved.status).toBe(200);

    const reloaded = await (await getValue()).json();
    expect(reloaded.data.value).toBe('Natation');
  });

  it('a teacher reads the value but cannot write it', async () => {
    await as('teacher');
    const read = await getValue();
    expect(read.status).toBe(200);
    expect((await read.json()).data.value).toBe('Natation');

    const refused = await putValue('Tennis');
    expect(refused.status).toBe(403);

    // The refused write moved nothing.
    await as('school_admin');
    const reloaded = await (await getValue()).json();
    expect(reloaded.data.value).toBe('Natation');
  });

  it('another tenant cannot read the value through this definition id', async () => {
    await as('school_admin', otherTenantId);
    const res = await getValue();
    expect(res.status).toBe(404);
  });
});
