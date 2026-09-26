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
  // Why the definition was changed. Optional — staff editing a catalogue do
  // not always have a reason to give — but stored when supplied so the
  // version history explains itself (SCF-10-01).
  reason: z.string().trim().max(500).optional(),
}).strict();

export type CustomFieldInput = z.input<typeof customFieldInputSchema>;

/**
 * Columns the core `user` record already owns. A custom field may not reuse one
 * of these keys: its values live in `custom_field_values`, a table no core
 * reader consults, so a "matricule" custom field would silently hold a second,
 * different matricule next to the real one (found on Atlas by the settings
 * audit, DISC-SETTINGS-CORE-01).
 */
const RESERVED_CUSTOM_FIELD_KEYS = new Set([
  'matricule',
  'massar',
  'massar_code',
  'cin',
  'name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'birth_date',
  'gender',
  'class',
  'section',
]);

function assertKeyIsFree(key: string) {
  if (RESERVED_CUSTOM_FIELD_KEYS.has(key.trim().toLowerCase())) {
    throw new ApiError(
      422,
      'RESERVED_KEY',
      `La clé "${key}" est réservée : elle désigne déjà un champ natif de l'élève. Choisissez une autre clé.`,
    );
  }
}

/**
 * A stored value must match its definition's declared type. Without this the
 * registry accepted anything, so a "date" field could hold "oui" and only the
 * screen rendering it would notice.
 */
function assertValueMatchesType(fieldType: CustomFieldType, options: string[] | null, value: unknown) {
  switch (fieldType) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Ce champ attend un nombre.');
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Ce champ attend vrai ou faux.');
      }
      break;
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Ce champ attend une date au format AAAA-MM-JJ.');
      }
      break;
    case 'select':
      if (typeof value !== 'string' || !(options ?? []).includes(value)) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Cette valeur ne fait pas partie des options de ce champ.');
      }
      break;
    case 'text':
      if (typeof value !== 'string') {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Ce champ attend du texte.');
      }
      break;
  }
}

function validateInput(input: z.input<typeof customFieldInputSchema>) {
  assertKeyIsFree(input.key);
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
  // `reason` describes the change, not the field: it belongs to the version
  // row, never to the definition itself.
  const { reason, ...fields } = input;
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(customFieldDefinitions).values({
      tenantId,
      ...fields,
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
      reason: reason ?? 'Création du champ',
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

  // Renaming onto a core key is the same mistake as creating one — the audit
  // found the shadowing `matricule` field already in place, so the guard has
  // to hold on the update path too.
  if (input.key !== undefined) {
    assertKeyIsFree(input.key);
  }
  const { reason, ...fields } = input;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(customFieldDefinitions)
      .set({
        ...fields,
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
      reason: reason ?? 'Mise à jour du champ',
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

  // field_type is a varchar column, so the union is asserted rather than
  // inferred. An unknown value falls through the switch and is accepted.
  assertValueMatchesType(def.fieldType as CustomFieldType, def.options as string[] | null, value);

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
