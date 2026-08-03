import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { settingValues } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Setting definition types
// ---------------------------------------------------------------------------

export type SettingSensitivity = 'public' | 'internal' | 'secret';
export type SettingScope = 'tenant' | 'branch';

export type SettingDefinition = {
  /** Stable key: namespace.name, e.g. 'organization.establishmentName'. */
  key: string;
  /** Human-readable label for the settings UI. */
  label: string;
  /** Short description shown in help text. */
  description: string;
  /** Grouping namespace for the settings UI navigation. */
  namespace: string;
  /** Zod schema that validates the value. */
  valueSchema: z.ZodType;
  /** Platform-level default when no tenant/branch override exists. */
  defaultValue: unknown;
  /** Whether branches may override this setting. */
  scope: SettingScope;
  /** Controls read-access masking and audit redaction. */
  sensitivity: SettingSensitivity;
  /** Permission key required to read/write this setting. */
  requiredPermission: string;
  /** Whether this key was migrated from the legacy schoolSettings table. */
  legacyField?: string;
};

// ---------------------------------------------------------------------------
// Registry - V1 settings (matches current schoolSettings columns)
// ---------------------------------------------------------------------------

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  // -- Organization --
  {
    key: 'organization.establishmentName',
    label: 'Nom de l\'établissement',
    description: 'Nom officiel de l\'établissement scolaire.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(255).optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'establishmentName',
  },
  {
    key: 'organization.city',
    label: 'Ville',
    description: 'Ville de l\'établissement.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(255).optional().nullable(),
    defaultValue: null,
    scope: 'branch',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'city',
  },
  {
    key: 'organization.address',
    label: 'Adresse',
    description: 'Adresse postale complète.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(2000).optional().nullable(),
    defaultValue: null,
    scope: 'branch',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'address',
  },
  {
    key: 'organization.phone',
    label: 'Téléphone',
    description: 'Numéro de téléphone principal.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(50).optional().nullable(),
    defaultValue: null,
    scope: 'branch',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'phone',
  },
  {
    key: 'organization.email',
    label: 'Email',
    description: 'Adresse email officielle de l\'établissement.',
    namespace: 'organization',
    valueSchema: z.string().email().max(255).optional().nullable(),
    defaultValue: null,
    scope: 'branch',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'email',
  },
  {
    key: 'organization.ice',
    label: 'ICE',
    description: 'Identifiant Commun de l\'Entreprise.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(50).optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'ice',
  },
  {
    key: 'organization.legalStatus',
    label: 'Statut juridique',
    description: 'Forme juridique de l\'établissement (SA, SARL, etc.).',
    namespace: 'organization',
    valueSchema: z.string().trim().max(100).optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'legalStatus',
  },
  {
    key: 'organization.directorName',
    label: 'Nom du directeur',
    description: 'Nom complet du directeur de l\'établissement.',
    namespace: 'organization',
    valueSchema: z.string().trim().max(255).optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'directorName',
  },

  // -- Academic calendar --
  {
    key: 'academic.academicYear',
    label: 'Année scolaire',
    description: 'Libellé de l\'année scolaire en cours (ex: 2025-2026).',
    namespace: 'academic',
    valueSchema: z.string().trim().max(50).optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'academicYear',
  },
  {
    key: 'academic.startDate',
    label: 'Date de début',
    description: 'Date de début de l\'année scolaire.',
    namespace: 'academic',
    valueSchema: z.string().optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'startDate',
  },
  {
    key: 'academic.endDate',
    label: 'Date de fin',
    description: 'Date de fin de l\'année scolaire.',
    namespace: 'academic',
    valueSchema: z.string().optional().nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'endDate',
  },
  {
    key: 'academic.allowOperations',
    label: 'Opérations autorisées',
    description: 'Autoriser les opérations académiques (présence, notes, etc.).',
    namespace: 'academic',
    valueSchema: z.boolean(),
    defaultValue: true,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'allowOperations',
  },

  // -- Attendance modes --
  {
    key: 'attendance.presenceModes',
    label: 'Modes de présence',
    description: 'Statuts de présence activés (présent, retard, absence justifiée, etc.).',
    namespace: 'attendance',
    valueSchema: z.record(z.string(), z.boolean()),
    defaultValue: { presence: true, retard: true, absenceJustifiee: true, absenceNonJustifiee: true, sortieAnticipee: true },
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.attendance.manage',
    legacyField: 'presenceModes',
  },

  // -- Localization --
  {
    key: 'localization.languages',
    label: 'Langues activées',
    description: 'Langues disponibles dans l\'interface.',
    namespace: 'localization',
    valueSchema: z.record(z.string(), z.boolean()),
    defaultValue: { francais: true, arabe: true, anglais: false },
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.localization.manage',
    legacyField: 'languages',
  },

  // -- Security --
  {
    key: 'security.policies',
    label: 'Politiques de sécurité',
    description: 'Activation des politiques de sécurité (2FA, mot de passe fort, etc.).',
    namespace: 'security',
    valueSchema: z.record(z.string(), z.boolean()),
    defaultValue: { twoFa: true, strongPassword: true, auditLog: true, autoBackup: true },
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.security.manage',
    legacyField: 'security',
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const registryByKey = new Map(SETTINGS_REGISTRY.map(d => [d.key, d]));

export function getDefinition(key: string): SettingDefinition {
  const def = registryByKey.get(key);
  if (!def) {
    throw new ApiError(400, 'UNKNOWN_SETTING', `Clé de paramètre inconnue: ${key}`);
  }
  return def;
}

export function getDefinitionsByNamespace(namespace: string): SettingDefinition[] {
  return SETTINGS_REGISTRY.filter(d => d.namespace === namespace);
}

export function getNamespaces(): string[] {
  return [...new Set(SETTINGS_REGISTRY.map(d => d.namespace))];
}

// ---------------------------------------------------------------------------
// Effective value resolver
//
// Resolution order: branch override → tenant override → platform default.
// Returns the value together with the source scope so the UI can show
// "inherited from tenant" / "overridden at branch" indicators.
// ---------------------------------------------------------------------------

export type EffectiveValue = {
  key: string;
  value: unknown;
  source: 'default' | 'tenant' | 'branch';
  version: number;
  /** true when this value can be reset to the parent scope. */
  inherited: boolean;
  /** Sensitivity of this key — drives masking in the UI. */
  sensitivity: SettingSensitivity;
};

/**
 * Resolve the effective value for a single key.
 * Secrets are never returned through this path — callers that need to
 * *use* a secret value should call getSecretValue() (not yet implemented).
 */
export async function getEffectiveValue(
  tenantId: string,
  branchId: string | null,
  key: string,
): Promise<EffectiveValue> {
  const def = getDefinition(key);

  // 1. Try branch override (only if the key allows branch scope).
  if (branchId && def.scope === 'branch') {
    const [branchRow] = await db
      .select()
      .from(settingValues)
      .where(and(
        eq(settingValues.tenantId, tenantId),
        eq(settingValues.branchId, branchId),
        eq(settingValues.key, key),
      ))
      .limit(1);

    if (branchRow) {
      return {
        key,
        value: def.sensitivity === 'secret' ? '********' : branchRow.value,
        source: 'branch',
        version: branchRow.version,
        inherited: false,
        sensitivity: def.sensitivity,
      };
    }
  }

  // 2. Try tenant override.
  const [tenantRow] = await db
    .select()
    .from(settingValues)
    .where(and(
      eq(settingValues.tenantId, tenantId),
      isNull(settingValues.branchId),
      eq(settingValues.key, key),
    ))
    .limit(1);

  if (tenantRow) {
    return {
      key,
      value: def.sensitivity === 'secret' ? '********' : tenantRow.value,
      source: 'tenant',
      version: tenantRow.version,
      inherited: branchId ? true : false,
      sensitivity: def.sensitivity,
    };
  }

  // 3. Platform default.
  return {
    key,
    value: def.defaultValue,
    source: 'default',
    version: 0,
    inherited: true,
    sensitivity: def.sensitivity,
  };
}

/**
 * Resolve effective values for all registry keys at once.
 */
export async function getAllEffectiveValues(
  tenantId: string,
  branchId: string | null,
): Promise<EffectiveValue[]> {
  return Promise.all(
    SETTINGS_REGISTRY.map(def => getEffectiveValue(tenantId, branchId, def.key)),
  );
}

/**
 * Write a setting value and create a version record.
 * Returns the new version number.
 */
export async function setSettingValue(
  tenantId: string,
  branchId: string | null,
  key: string,
  value: unknown,
  context: RequestContext,
  reason?: string,
): Promise<number> {
  const def = getDefinition(key);

  // Validate value against the definition schema.
  const result = def.valueSchema.safeParse(value);
  if (!result.success) {
    const msg = result.error.issues
      .slice(0, 3)
      .map(i => `${i.path.join('.') || 'value'}: ${i.message}`)
      .join('; ');
    throw new ApiError(422, 'VALIDATION_ERROR', msg);
  }

  // Branch overrides only for branch-scoped keys.
  if (branchId && def.scope !== 'branch') {
    throw new ApiError(400, 'SCOPE_ERROR', `Le paramètre "${key}" ne peut pas être surchargé au niveau filiale.`);
  }

  // Upsert the value. The UNIQUE constraint on (tenant_id, branch_id_coalesced, key) prevents duplicates.
  const effectiveBranchId = branchId || null;

  const existing = await db
    .select()
    .from(settingValues)
    .where(and(
      eq(settingValues.tenantId, tenantId),
      effectiveBranchId ? eq(settingValues.branchId, effectiveBranchId) : isNull(settingValues.branchId),
      eq(settingValues.key, key),
    ))
    .limit(1);

  const previousValue = existing[0]?.value ?? null;
  const previousVersion = existing[0]?.version ?? 0;
  const newVersion = previousVersion + 1;

  if (existing[0]) {
    await db
      .update(settingValues)
      .set({
        value: result.data,
        version: newVersion,
        updatedBy: context.userId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(settingValues.id, existing[0].id));
  } else {
    await db.insert(settingValues).values({
      tenantId,
      branchId: effectiveBranchId,
      key,
      value: result.data,
      version: 1,
      updatedBy: context.userId,
    });
  }

  // Create version record for audit/rollback.
  const { settingValueVersions } = await import('@/models/Schema');
  await db.insert(settingValueVersions).values({
    settingValueId: existing[0]?.id ?? (await db
      .select({ id: settingValues.id })
      .from(settingValues)
      .where(and(
        eq(settingValues.tenantId, tenantId),
        effectiveBranchId ? eq(settingValues.branchId, effectiveBranchId) : isNull(settingValues.branchId),
        eq(settingValues.key, key),
      ))
      .limit(1)
      .then(rows => rows[0]!.id)),
    version: existing[0] ? newVersion : 1,
    previousValue: def.sensitivity === 'secret' ? '********' : previousValue,
    newValue: def.sensitivity === 'secret' ? '********' : result.data,
    actorId: context.userId,
    reason: reason ?? null,
  });

  return existing[0] ? newVersion : 1;
}
