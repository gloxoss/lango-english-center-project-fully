import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { customFieldDefinitionVersions, customFieldDefinitions, customFieldValues } from '@/features/settings/models/settings-schema';
import {
  createCustomFieldDefinition,
  setCustomFieldValue,
  updateCustomFieldDefinition,
} from '@/features/settings/services/custom-fields-service';
import { tenants } from '@/models/Schema';

/**
 * SCF-08-01. The registry accepted any key and any value.
 *
 * Key: a custom `matricule` field shadowed the core one. Its values live in
 * `custom_field_values`, which no core reader consults, so the school ended up
 * with a second, different matricule next to the real one.
 *
 * Value: a "date" field could hold "oui". Nothing noticed until a screen
 * tried to render it.
 */

vi.mock('@/libs/api/context', () => ({
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
  requireRequestContext: vi.fn(),
}));

const tenantId = randomUUID();
const context = {
  userId: 'usr-cf-admin',
  tenantId,
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Directeur',
  email: 'directeur@cf.test',
  sessionId: null,
  impersonated: false,
};

describe('Custom field guards (SCF-08-01)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Custom Fields Tenant',
      slug: `cf-${tenantId.slice(0, 8)}`,
    });
  });

  afterAll(async () => {
    await db.delete(customFieldValues).where(eq(customFieldValues.tenantId, tenantId));
    await db.delete(customFieldDefinitionVersions).where(eq(customFieldDefinitionVersions.tenantId, tenantId));
    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.tenantId, tenantId));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId]));
  });

  it('1. a key that shadows a core field is refused with RESERVED_KEY', async () => {
    for (const key of ['matricule', 'MASSAR', 'first_name', 'cin']) {
      await expect(createCustomFieldDefinition(context as never, {
        key,
        label: 'Doublon',
        entityType: 'student',
        fieldType: 'text',
      })).rejects.toMatchObject({ code: 'RESERVED_KEY', status: 422 });
    }
  });

  it('2. renaming an existing definition onto a core key is refused too', async () => {
    const created = await createCustomFieldDefinition(context as never, {
      key: 'sport_pratique',
      label: 'Sport pratiqué',
      entityType: 'student',
      fieldType: 'text',
    });

    await expect(updateCustomFieldDefinition(context as never, created!.id, {
      key: 'matricule',
      label: 'Sport pratiqué',
      entityType: 'student',
      fieldType: 'text',
    })).rejects.toMatchObject({ code: 'RESERVED_KEY' });
  });

  it('3. a non-reserved key is still accepted', async () => {
    const created = await createCustomFieldDefinition(context as never, {
      key: 'langue_maternelle',
      label: 'Langue maternelle',
      entityType: 'student',
      fieldType: 'text',
    });
    expect(created!.key).toBe('langue_maternelle');
  });

  it('4. a value that does not match the declared type is refused', async () => {
    const numberField = await createCustomFieldDefinition(context as never, {
      key: 'taille_cm',
      label: 'Taille (cm)',
      entityType: 'student',
      fieldType: 'number',
    });
    await expect(setCustomFieldValue(context as never, numberField!.id, 'stu-1', 'grand'))
      .rejects.toMatchObject({ status: 422 });

    const dateField = await createCustomFieldDefinition(context as never, {
      key: 'date_inscription',
      label: 'Date d\'inscription',
      entityType: 'student',
      fieldType: 'date',
    });
    await expect(setCustomFieldValue(context as never, dateField!.id, 'stu-1', 'oui'))
      .rejects.toMatchObject({ status: 422 });
    await expect(setCustomFieldValue(context as never, dateField!.id, 'stu-1', '2026-09-01'))
      .resolves.toBeTruthy();

    const boolField = await createCustomFieldDefinition(context as never, {
      key: 'boursier',
      label: 'Boursier',
      entityType: 'student',
      fieldType: 'boolean',
    });
    await expect(setCustomFieldValue(context as never, boolField!.id, 'stu-1', 'oui'))
      .rejects.toMatchObject({ status: 422 });

    // A real ApiError with a message a director can act on, not a crash.
    const error = await setCustomFieldValue(context as never, numberField!.id, 'stu-2', 'grand').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('5. a select value outside its options is refused', async () => {
    const selectField = await createCustomFieldDefinition(context as never, {
      key: 'regime',
      label: 'Régime',
      entityType: 'student',
      fieldType: 'select',
      options: ['externe', 'demi-pension'],
    });

    await expect(setCustomFieldValue(context as never, selectField!.id, 'stu-1', 'interne'))
      .rejects.toMatchObject({ status: 422 });
    await expect(setCustomFieldValue(context as never, selectField!.id, 'stu-1', 'externe'))
      .resolves.toBeTruthy();
  });
});
