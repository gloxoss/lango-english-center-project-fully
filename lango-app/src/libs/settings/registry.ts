import { and, eq, isNull, sql, type SQLWrapper } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { encryptSecret } from '@/libs/api/secrets';
import { db } from '@/libs/DB';
import { schoolSettings, settingValues, settingValueVersions } from '@/models/Schema';

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
  {
    key: 'attendance.smsAlerts',
    label: 'Alertes absences SMS automatiques',
    description: 'Notification immédiate au tuteur en cas d\'absence non justifiée.',
    namespace: 'attendance',
    valueSchema: z.boolean(),
    defaultValue: true,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.attendance.manage',
  },
  {
    key: 'attendance.lateGraceMinutes',
    label: 'Minutes de grâce pour retard',
    description: 'Un scan de badge avant (début de séance + grâce) est stage en « présent », après en « retard ».',
    namespace: 'attendance',
    valueSchema: z.number().int().min(0).max(300),
    defaultValue: 15,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.attendance.manage',
    legacyField: 'attendanceLateGraceMinutes',
  },
  {
    key: 'attendance.periodStartTime',
    label: 'Heure de début de séance',
    description: 'Heure de référence (HH:MM) pour déterminer le retard à l\'entrée par scan de badge.',
    namespace: 'attendance',
    valueSchema: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    defaultValue: '08:00',
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.attendance.manage',
    legacyField: 'attendancePeriodStartTime',
  },

  // -- Academic policies --
  {
    key: 'academic.autoPromotion',
    label: 'Promotion automatique',
    description: 'Promouvoir automatiquement les élèves ayant une moyenne supérieure ou égale au seuil de réussite.',
    namespace: 'academic',
    valueSchema: z.boolean(),
    defaultValue: false,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
  },
  {
    key: 'academic.passThreshold',
    label: 'Seuil de réussite',
    description: 'Moyenne minimale (sur le barème configuré) requise pour être considéré admis.',
    namespace: 'academic',
    valueSchema: z.number().min(0).max(100),
    defaultValue: 10,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
  },
  {
    key: 'academic.gradingScale',
    label: 'Barème de notation officiel',
    description: 'Échelle utilisée pour la notation: note sur 20 (système marocain standard) ou pourcentage sur 100.',
    namespace: 'academic',
    valueSchema: z.enum(['20', '100']),
    defaultValue: '20',
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.organization.manage',
  },

  // -- Portal access --
  {
    key: 'portal.guardianEnabled',
    label: 'Portail tuteurs/parents',
    description: 'Permet aux tuteurs d\'accéder aux bulletins, absences et solde des frais via le portail.',
    namespace: 'portal',
    valueSchema: z.boolean(),
    defaultValue: true,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
  },
  {
    key: 'portal.studentEnabled',
    label: 'Portail élèves',
    description: 'Permet aux élèves d\'accéder à l\'emploi du temps, aux devoirs et au cahier de texte via le portail.',
    namespace: 'portal',
    valueSchema: z.boolean(),
    defaultValue: true,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
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
  {
    key: 'localization.timezone',
    label: 'Fuseau horaire',
    description: 'Fuseau horaire de l\'établissement pour les horaires et les scans de présence.',
    namespace: 'localization',
    valueSchema: z.string().min(1).max(100),
    defaultValue: 'Africa/Casablanca',
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
    legacyField: 'localeTimezone',
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
  {
    key: 'security.sessionTimeoutMinutes',
    label: "Durée d'expiration de session",
    description: "Minutes d'inactivité avant fermeture automatique des sessions.",
    namespace: 'security',
    valueSchema: z.number().int().min(5).max(1440),
    defaultValue: 60,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.security.manage',
  },
  {
    key: 'security.dismissedAlerts',
    label: 'Alertes de sécurité masquées',
    description: 'Identifiants des alertes de sécurité que l\'établissement a ignorées.',
    namespace: 'security',
    valueSchema: z.array(z.string()).max(200),
    defaultValue: [],
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.security.manage',
  },
  {
    key: 'security.requireTwoFactorForAdmins',
    label: 'Obligation 2FA pour les administrateurs',
    description: 'Exige l\'authentification à deux facteurs pour les comptes d\'administration (school_admin) de l\'établissement. Les super-admins sont toujours soumis à l\'obligation.',
    namespace: 'security',
    valueSchema: z.boolean(),
    defaultValue: false,
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.security.manage',
  },
  {
    key: 'security.loginAccessMethod',
    label: 'Mode de création des accès de connexion',
    description: 'Comment les accès élèves sont générés à l\'approbation d\'admission : mot de passe temporaire ou lien d\'invitation.',
    namespace: 'security',
    valueSchema: z.enum(['temp_password', 'invite_link']),
    defaultValue: 'invite_link',
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.security.manage',
    legacyField: 'loginAccessMethod',
  },

  // -- Integrations / providers --
  {
    key: 'integrations.providers',
    label: 'Connexions et fournisseurs externes',
    description: 'Liste des intégrations configurées (SMS, SMTP, stockage, paiement, etc.).',
    namespace: 'integrations',
    valueSchema: z.array(z.record(z.string(), z.unknown())).max(100),
    defaultValue: [],
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.integrations.manage',
  },
  {
    key: 'integrations.connectionLogs',
    label: 'Journal des pings et connexions',
    description: 'Historique récent des health checks de connexion (derniers 50).',
    namespace: 'integrations',
    valueSchema: z.array(z.record(z.string(), z.unknown())).max(50),
    defaultValue: [],
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.integrations.manage',
  },

  // -- Accounting --
  {
    key: 'accounting.defaults',
    label: 'Paramètres comptables (PCG)',
    description: 'Journaux, taux de TVA, préfixes de facturation et mappings du Plan Comptable Général.',
    namespace: 'accounting',
    valueSchema: z.record(z.string(), z.unknown()),
    defaultValue: {},
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
  },

  // -- Finance --
  {
    key: 'finance.currency',
    label: 'Devise',
    description: 'Devise de facturation de l\'établissement (code ISO 4217). Les clients marocains utilisent par défaut MAD ; les clients hors Maroc configurent leur propre devise.',
    namespace: 'finance',
    valueSchema: z.enum(['MAD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'DZD', 'TND', 'CAD', 'CHF']),
    defaultValue: 'MAD',
    scope: 'tenant',
    sensitivity: 'public',
    requiredPermission: 'settings.finance_mapping.manage',
  },

  // -- Finance (payment gateway secrets) --
  {
    key: 'finance.stripeSecretKey',
    label: 'Clé secrète Stripe',
    description: 'Clé secrète Stripe (sk_test_… ou sk_live_…) pour les paiements en ligne. Chiffrée au repos, jamais affichée en clair.',
    namespace: 'finance',
    valueSchema: z.string().trim().min(1).max(512).nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'secret',
    requiredPermission: 'settings.finance_mapping.manage',
  },
  {
    key: 'finance.stripeWebhookSecret',
    label: 'Secret de signature webhook Stripe',
    description: 'Secret de signature des webhooks Stripe (whsec_…). Chiffré au repos, jamais affiché en clair.',
    namespace: 'finance',
    valueSchema: z.string().trim().min(1).max(512).nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'secret',
    requiredPermission: 'settings.finance_mapping.manage',
  },

  // -- Localization / i18n --
  {
    key: 'i18n.translations',
    label: 'Dictionnaire de traductions et champs sur mesure',
    description: 'Clés de traduction FR/AR/EN et définitions de champs personnalisés.',
    namespace: 'i18n',
    valueSchema: z.record(z.string(), z.unknown()),
    defaultValue: { keys: [], fields: [] },
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.localization.manage',
  },

  // -- Scheduled jobs --
  {
    key: 'jobs.definitions',
    label: 'Tâches planifiées',
    description: 'Définitions des tâches planifiées et leurs horaires.',
    namespace: 'jobs',
    valueSchema: z.array(z.record(z.string(), z.unknown())).max(50),
    defaultValue: [],
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.jobs.manage',
  },

  // -- Migration --
  {
    key: 'migration.state',
    label: 'État du centre de migration',
    description: 'Mapping des colonnes, étapes et tâches du centre de migration.',
    namespace: 'migration',
    valueSchema: z.record(z.string(), z.unknown()),
    defaultValue: {},
    scope: 'tenant',
    sensitivity: 'internal',
    requiredPermission: 'settings.organization.manage',
  },

  // -- Integrations (secrets) --
  {
    key: 'integrations.webhookSigningSecret',
    label: 'Secret de signature webhook',
    description: 'Secret partagé pour signer et vérifier les payloads webhook. Chiffré au repos, jamais affiché en clair dans l\'interface.',
    namespace: 'integrations',
    valueSchema: z.string().trim().min(16).max(512).nullable(),
    defaultValue: null,
    scope: 'tenant',
    sensitivity: 'secret',
    requiredPermission: 'settings.secret.rotate',
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

// ---------------------------------------------------------------------------
// Legacy schoolSettings fallback (settings-platform, Phase F)
// ---------------------------------------------------------------------------
// Columns in the legacy single-row school_settings table that a registry key
// maps to via `legacyField`. When a tenant has no override in settingValues,
// the legacy column is read so existing tenants keep their values after the
// split. Only keys that migrated in this phase are listed; anything else falls
// back to the registry default.
export const LEGACY_SETTING_COLUMNS = {
  loginAccessMethod: schoolSettings.loginAccessMethod,
  localeTimezone: schoolSettings.localeTimezone,
  attendanceLateGraceMinutes: schoolSettings.attendanceLateGraceMinutes,
  attendancePeriodStartTime: schoolSettings.attendancePeriodStartTime,
  presenceModes: schoolSettings.presenceModes,
  languages: schoolSettings.languages,
  security: schoolSettings.security,
} satisfies Record<string, SQLWrapper>;

/**
 * Resolve a setting as `getEffectiveValue`, but when no tenant/branch override
 * exists fall back to the legacy `schoolSettings` column (when the key maps to
 * one). Mirrors the historical `?? default` reads without losing tenant data.
 */
export async function getEffectiveValueWithLegacyFallback(
  tenantId: string,
  branchId: string | null,
  key: string,
): Promise<{ value: unknown; source: 'branch' | 'tenant' | 'legacy' | 'default' }> {
  const effective = await getEffectiveValue(tenantId, branchId, key);
  if (effective.source !== 'default') {
    return { value: effective.value, source: effective.source };
  }
  const def = getDefinition(key);
  const legacyColumn = def.legacyField
    ? LEGACY_SETTING_COLUMNS[def.legacyField as keyof typeof LEGACY_SETTING_COLUMNS]
    : undefined;
  if (legacyColumn) {
    const [row] = await db
      .select({ legacy: legacyColumn })
      .from(schoolSettings)
      .where(eq(schoolSettings.tenantId, tenantId))
      .limit(1);
    if (row?.legacy != null) {
      return { value: row.legacy, source: 'legacy' };
    }
  }
  return { value: effective.value, source: 'default' };
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
 * Write a setting value and create a version record, atomically.
 *
 * Runs inside one transaction:
 *   1. Locks the current row for the exact (tenantId, effective branch, key)
 *      scope with SELECT ... FOR UPDATE (compare-and-set on the version).
 *   2. Validates `expectedVersion` against the locked version — the CAS is part
 *      of the write, never a separate pre-check, so concurrent PATCHes cannot
 *      both succeed on the same base version.
 *   3. Upserts the value row and inserts exactly one version row.
 *   4. Returns the committed version.
 *
 * When two callers race with the same `expectedVersion`, one commits and the
 * other receives 409 (VERSION_CONFLICT); no update is lost and no version
 * history is duplicated. A concurrent first-insert is detected via the unique
 * (tenantId, branchId, key) constraint and surfaced as the same 409.
 */
export async function setSettingValue(
  tenantId: string,
  branchId: string | null,
  key: string,
  value: unknown,
  context: RequestContext,
  reason?: string,
  expectedVersion?: number,
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

  // Secrets are never stored in plaintext. The schema-validated value is
  // encrypted at rest (AES-256-GCM); string secrets stay raw strings so they
  // round-trip exactly (non-strings are JSON-encoded). The version row still
  // masks it as '********', and getEffectiveValue() never surfaces the blob.
  const storedValue = def.sensitivity === 'secret'
    ? encryptSecret(typeof result.data === 'string' ? result.data : JSON.stringify(result.data))
    : result.data;

  // Upsert the value. The UNIQUE constraint on (tenant_id, branch_id, key) prevents duplicates.
  const effectiveBranchId = branchId || null;
  const scope = and(
    eq(settingValues.tenantId, tenantId),
    effectiveBranchId ? eq(settingValues.branchId, effectiveBranchId) : isNull(settingValues.branchId),
    eq(settingValues.key, key),
  );

  const newVersion = await db.transaction(async (tx) => {
    // Postgres UNIQUE treats NULL as distinct, so the (tenant, branch, key)
    // constraint does not dedupe tenant-global rows (branch IS NULL). Serialize
    // writers for the exact scope with a transaction-level advisory lock so a
    // concurrent first-insert converges instead of creating duplicate rows.
    await tx.execute(sql`
      select pg_advisory_xact_lock(hashtext(
        coalesce(${tenantId}::text, '') || '|' || coalesce(${effectiveBranchId}::text, '') || '|' || ${key}
      ))
    `);

    // Lock the current row for this exact scope, if one exists.
    const [existing] = await tx
      .select()
      .from(settingValues)
      .where(scope)
      .for('update')
      .limit(1);

    const previousValue = existing?.value ?? null;
    const currentVersion = existing?.version ?? 0;

    // Compare-and-set: expected-version validation is part of the write.
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new ApiError(409, 'VERSION_CONFLICT',
        `Le paramètre a été modifié par un autre utilisateur (version actuelle: ${currentVersion}, attendue: ${expectedVersion}).`);
    }

    const nextVersion = currentVersion + 1;

    let settingValueId: string;
    if (existing) {
      await tx
        .update(settingValues)
        .set({
          value: storedValue,
          version: nextVersion,
          updatedBy: context.userId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(settingValues.id, existing.id));
      settingValueId = existing.id;
    } else {
      try {
        const [inserted] = await tx.insert(settingValues).values({
          tenantId,
          branchId: effectiveBranchId,
          key,
          value: storedValue,
          version: nextVersion,
          updatedBy: context.userId,
        }).returning();
        settingValueId = inserted!.id;
      } catch (err) {
        // 23505 = unique_violation on (tenantId, branchId, key): a concurrent
        // transaction created the row between our SELECT and INSERT.
        if ((err as { code?: string })?.code === '23505') {
          throw new ApiError(409, 'VERSION_CONFLICT',
            `Le paramètre a été modifié par un autre utilisateur (création concurrente).`);
        }
        throw err;
      }
    }

    // Create exactly one version record for audit/rollback.
    await tx.insert(settingValueVersions).values({
      settingValueId,
      version: nextVersion,
      previousValue: def.sensitivity === 'secret' ? '********' : previousValue,
      newValue: def.sensitivity === 'secret' ? '********' : result.data,
      actorId: context.userId,
      reason: reason ?? null,
    });

    return nextVersion;
  });

  return newVersion;
}
