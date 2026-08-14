import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  customFieldDefinitionVersions,
  customFieldDefinitions,
  customFieldValues,
} from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// Custom field registry: tenant-defined extra attributes for students,
// guardians, or employees. Definitions are typed (text/number/date/select/
// boolean) with an options list, required/default flags and sort order.
// Values live per (definitionId, entityId) with a unique constraint.
// Wiring the registry into student/guardian/invoice forms is out of scope —
// this establishes the catalog and the value store.
// ---------------------------------------------------------------------------

export const customFieldTypeEnum = ['text', 'number', 'date', 'select', 'boolean'] as const;
export const customFieldEntityEnum = ['student', 'guardian', 'employee'] as const;
export type CustomFieldType = (typeof customFieldTypeEnum)[number];
export type CustomFieldEntity = (typeof customFieldEntityEnum)[number];

export const customFieldInputSchema = z.object({
  key: z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Clé invalide (lettres, chiffres, . _ -)'),
  label: z.string().trim().min(1).max(255),
  entityType: z.enum(customFieldEntityEnum),
  fieldType: z.enum(customFieldTypeEnum),
  options: z.array(z.string().max(255)).min(1).max(100).optional(),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
}).strict();

export type CustomFieldInput = z.input<typeof customFieldInputSchema>;

function validateInput(input: z.input<typeof customFieldInputSchema>) {
  if (input.fieldType === 'select' && (!input.options || input.options.length === 0)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Un champ de type "select" doit définir au moins une option.');
  }
  if (input.fieldType !== 'select' && input.options) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Seuls les champs "select" acceptent une liste d\'options.');
  }
}

async function requireDefinition(tenantId: string, id: string) {
  const [def] = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(
      eq(customFieldDefinitions.tenantId, tenantId),
      eq(customFieldDefinitions.id, id),
    ))
    .limit(1);
  if (!def) {
    throw new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND', 'Champ personnalisé introuvable.');
  }
  return def;
}

export async function listCustomFieldDefinitions(tenantId: string, entityType?: string) {
  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(
      eq(customFieldDefinitions.tenantId, tenantId),
      entityType ? eq(customFieldDefinitions.entityType, entityType as CustomFieldEntity) : undefined,
    ))
    .orderBy(desc(customFieldDefinitions.sortOrder), customFieldDefinitions.createdAt);
  return rows;
}

export async function getCustomFieldDefinition(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  return requireDefinition(tenantId, id);
}

export async function createCustomFieldDefinition(context: RequestContext, input: CustomFieldInput) {
  const tenantId = requireTenant(context);
  validateInput(input);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(customFieldDefinitions).values({
      tenantId,
      ...input,
      options: input.options ?? null,
      defaultValue: input.defaultValue ?? null,
    }).returning();
    if (!row) throw new ApiError(500, 'CUSTOM_FIELD_CREATE_FAILED', 'Impossible de créer le champ.');
    await tx.insert(customFieldDefinitionVersions).values({
      tenantId,
      definitionId: row.id,
      version: 1,
      label: row.label,
      entityType: row.entityType,
      fieldType: row.fieldType,
      options: row.options,
      required: row.required,
      defaultValue: row.defaultValue,
      sortOrder: row.sortOrder,
      actorId: context.userId,
      reason: 'Création du champ',
    });
    return row;
  });
  return created;
}

export async function updateCustomFieldDefinition(
  context: RequestContext,
  id: string,
  input: Partial<CustomFieldInput>,
) {
  const tenantId = requireTenant(context);
  await requireDefinition(tenantId, id);

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(customFieldDefinitions)
      .set({
        ...input,
        options: input.options ?? null,
        defaultValue: input.defaultValue ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(customFieldDefinitions.tenantId, tenantId),
        eq(customFieldDefinitions.id, id),
      ))
      .returning();
    if (!row) throw new ApiError(404, 'CUSTOM_FIELD_NOT_FOUND', 'Champ personnalisé introuvable.');
    const [latest] = await tx.select({ v: customFieldDefinitionVersions.version })
      .from(customFieldDefinitionVersions)
      .where(eq(customFieldDefinitionVersions.definitionId, row.id))
      .orderBy(desc(customFieldDefinitionVersions.version))
      .limit(1);
    await tx.insert(customFieldDefinitionVersions).values({
      tenantId,
      definitionId: row.id,
      version: (latest?.v ?? 0) + 1,
      label: row.label,
      entityType: row.entityType,
      fieldType: row.fieldType,
      options: row.options,
      required: row.required,
      defaultValue: row.defaultValue,
      sortOrder: row.sortOrder,
      actorId: context.userId,
      reason: 'Mise à jour du champ',
    });
    return row;
  });
  return updated;
}

export async function deleteCustomFieldDefinition(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  const def = await requireDefinition(tenantId, id);
  await db.update(customFieldDefinitions)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(
      eq(customFieldDefinitions.tenantId, tenantId),
      eq(customFieldDefinitions.id, id),
    ));
  return { id: def.id, deactivated: true };
}

// --- Values ----------------------------------------------------------------

export async function getCustomFieldValues(context: RequestContext, definitionId: string, entityId: string) {
  const tenantId = requireTenant(context);
  await requireDefinition(tenantId, definitionId);
  const rows = await db
    .select()
    .from(customFieldValues)
    .where(and(
      eq(customFieldValues.tenantId, tenantId),
      eq(customFieldValues.definitionId, definitionId),
      eq(customFieldValues.entityId, entityId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function setCustomFieldValue(
  context: RequestContext,
  definitionId: string,
  entityId: string,
  value: unknown,
) {
  const tenantId = requireTenant(context);
  const def = await requireDefinition(tenantId, definitionId);
  if (!def.isActive) throw new ApiError(409, 'CUSTOM_FIELD_INACTIVE', 'Ce champ personnalisé est désactivé.');
  if (def.required && (value === undefined || value === null || value === '')) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Une valeur est requise pour ce champ.');
  }
  if (value === undefined || value === null) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Une valeur est requise.');
  }

  const [row] = await db
    .insert(customFieldValues)
    .values({
      tenantId,
      definitionId,
      entityId,
      value,
      updatedBy: context.userId,
    })
    .onConflictDoUpdate({
      target: [customFieldValues.tenantId, customFieldValues.definitionId, customFieldValues.entityId],
      set: { value, updatedBy: context.userId, updatedAt: new Date().toISOString() },
    })
    .returning();

  return row;
}

export async function deleteCustomFieldValue(context: RequestContext, definitionId: string, entityId: string) {
  const tenantId = requireTenant(context);
  await requireDefinition(tenantId, definitionId);
  await db.delete(customFieldValues).where(and(
    eq(customFieldValues.tenantId, tenantId),
    eq(customFieldValues.definitionId, definitionId),
    eq(customFieldValues.entityId, entityId),
  ));
  return { definitionId, entityId, deleted: true };
}
