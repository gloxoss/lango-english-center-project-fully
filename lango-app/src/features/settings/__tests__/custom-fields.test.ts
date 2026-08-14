import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';
import {
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  getCustomFieldValues,
  listCustomFieldDefinitions,
  setCustomFieldValue,
  updateCustomFieldDefinition,
} from '../services/custom-fields-service';

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
const USER_ID = `USR-CF-${crypto.randomUUID()}`;

function fakeContext(tenantId: string): RequestContext {
  return {
    userId: USER_ID,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Custom Field Tester',
    email: 'customfield.tester@example.com',
  };
}

describe.skipIf(!hasDb)('custom field registry', () => {
  const tenantId = crypto.randomUUID();
  const ctx = () => fakeContext(tenantId);

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Custom Field Test', slug: `custom-fields-${tenantId}` });
    await db.insert(user).values({
      id: USER_ID, tenantId, name: 'Custom Field Tester', email: `customfield-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('creates a definition and lists it filtered by entityType', async () => {
    const field = await createCustomFieldDefinition(ctx(), {
      key: 'cndp_number',
      label: 'Numéro CNDP',
      entityType: 'student',
      fieldType: 'text',
      required: false,
      sortOrder: 10,
    });
    expect(field.key).toBe('cndp_number');
    expect(field.isActive).toBe(true);

    const students = await listCustomFieldDefinitions(tenantId, 'student');
    expect(students.some(s => s.id === field.id)).toBe(true);

    const guardians = await listCustomFieldDefinitions(tenantId, 'guardian');
    expect(guardians.some(g => g.id === field.id)).toBe(false);
  });

  it('select requires options and non-select forbids them', async () => {
    await expect(
      createCustomFieldDefinition(ctx(), {
        key: 'bad-select',
        label: 'Sans options',
        entityType: 'employee',
        fieldType: 'select',
      }),
    ).rejects.toThrow(/option/i);

    await expect(
      createCustomFieldDefinition(ctx(), {
        key: 'bad-text',
        label: 'Avec options',
        entityType: 'employee',
        fieldType: 'text',
        options: ['A', 'B'],
      }),
    ).rejects.toThrow(/option/i);
  });

  it('sets and upserts a value per (definition, entityId) and reads it back', async () => {
    const field = await createCustomFieldDefinition(ctx(), {
      key: 'blood_group',
      label: 'Groupe sanguin',
      entityType: 'student',
      fieldType: 'select',
      options: ['A+', 'A-', 'B+', 'O+'],
      required: false,
    });

    await setCustomFieldValue(ctx(), field.id, 'STU-0001', 'A+');
    const stored = await getCustomFieldValues(ctx(), field.id, 'STU-0001');
    expect(stored?.value).toBe('A+');

    // Upsert overwrites the same (definition, entityId) row.
    await setCustomFieldValue(ctx(), field.id, 'STU-0001', 'O+');
    const overwritten = await getCustomFieldValues(ctx(), field.id, 'STU-0001');
    expect(overwritten?.value).toBe('O+');

    // A different entity is independent.
    const other = await getCustomFieldValues(ctx(), field.id, 'STU-0002');
    expect(other).toBeNull();
  });

  it('rejects an empty value for a required field and on an inactive definition', async () => {
    const field = await createCustomFieldDefinition(ctx(), {
      key: 'req-field',
      label: 'Champ obligatoire',
      entityType: 'student',
      fieldType: 'text',
      required: true,
    });

    await expect(
      setCustomFieldValue(ctx(), field.id, 'STU-0001', ''),
    ).rejects.toThrow(/requise/);

    await setCustomFieldValue(ctx(), field.id, 'STU-0001', 'ok');

    await deleteCustomFieldDefinition(ctx(), field.id);
    await expect(
      setCustomFieldValue(ctx(), field.id, 'STU-0002', 'valeur'),
    ).rejects.toThrow(/désactivé/);
  });

  it('update bumps metadata and keeps values intact', async () => {
    const field = await createCustomFieldDefinition(ctx(), {
      key: 'update-cf',
      label: 'Ancien libellé',
      entityType: 'employee',
      fieldType: 'number',
    });
    await setCustomFieldValue(ctx(), field.id, 'EMP-001', 42);

    const updated = await updateCustomFieldDefinition(ctx(), field.id, { label: 'Nouveau libellé' });
    expect(updated.label).toBe('Nouveau libellé');

    const value = await getCustomFieldValues(ctx(), field.id, 'EMP-001');
    expect(value?.value).toBe(42);
  });
});
