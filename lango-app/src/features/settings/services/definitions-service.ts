import { and, eq, inArray, sql } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  SETTINGS_REGISTRY,
  type SettingDefinition,
  type SettingScope,
  type SettingSensitivity,
} from '@/libs/settings/registry';
import {
  settingDefinitionVersions,
  settingDefinitions,
} from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// Runtime-editable catalog metadata for the code-owned SETTINGS_REGISTRY.
//
// The Zod valueSchema is a function and cannot be persisted — it stays in
// code. This service persists only the editable metadata (label, description,
// namespace, scope, sensitivity, default, permission, legacy field) so the
// catalog is runtime-editable without losing type-safe validation.
// ---------------------------------------------------------------------------

export type CatalogDefinition = {
  key: string;
  label: string;
  description: string | null;
  namespace: string;
  scope: SettingScope;
  sensitivity: SettingSensitivity;
  defaultValue: unknown;
  requiredPermission: string;
  legacyField: string | null;
  isActive: boolean;
  isCodeOwned: boolean;
  version: number;
  updatedAt: string | null;
};

function toCatalog(row: typeof settingDefinitions.$inferSelect): CatalogDefinition {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    namespace: row.namespace,
    scope: row.scope as SettingScope,
    sensitivity: row.sensitivity as SettingSensitivity,
    defaultValue: row.defaultValue,
    requiredPermission: row.requiredPermission ?? '',
    legacyField: row.legacyField,
    isActive: row.isActive,
    isCodeOwned: row.isCodeOwned,
    version: 0,
    updatedAt: row.updatedAt,
  };
}

// Small TTL cache: the catalog is read on admin settings screens, never in a
// hot path. 60s avoids stale rows during an editing session while keeping the
// sync/read cycle cheap. Cleared on every write (syncSettingDefinitions).
const cache = new Map<string, { at: number; defs: CatalogDefinition[] }>();
const CACHE_TTL_MS = 60_000;

async function latestVersion(tenantId: string, definitionId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`max(${settingDefinitionVersions.version})` })
    .from(settingDefinitionVersions)
    .where(and(
      eq(settingDefinitionVersions.tenantId, tenantId),
      eq(settingDefinitionVersions.definitionId, definitionId),
    ))
    .limit(1);
  return row?.max ?? 0;
}

/**
 * Upsert every code-owned registry entry for a tenant. Idempotent: creating a
 * fresh definition writes version 1; a metadata change bumps the version row;
 * unchanged entries are left untouched.
 */
export async function syncSettingDefinitions(
  tenantId: string,
  context?: RequestContext,
  reason?: string,
): Promise<{ created: number; updated: number; unchanged: number }> {
  const result = { created: 0, updated: 0, unchanged: 0 };

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('settings-sync:' || ${tenantId}))`);

    // Batch 1: resolve every code-owned definition in one query instead of one
    // SELECT per registry entry (the registry is ~45 keys, and this runs on
    // every sync including idempotent re-runs at startup).
    const existingRows = await tx
      .select({
        id: settingDefinitions.id,
        key: settingDefinitions.key,
        label: settingDefinitions.label,
        description: settingDefinitions.description,
        namespace: settingDefinitions.namespace,
        scope: settingDefinitions.scope,
        sensitivity: settingDefinitions.sensitivity,
        defaultValueIsNull: sql<boolean>`${settingDefinitions.defaultValue} IS NULL`,
        requiredPermission: settingDefinitions.requiredPermission,
        legacyField: settingDefinitions.legacyField,
      })
      .from(settingDefinitions)
      .where(and(
        eq(settingDefinitions.tenantId, tenantId),
        inArray(settingDefinitions.key, SETTINGS_REGISTRY.map(d => d.key)),
      ));
    const existingByKey = new Map(existingRows.map(r => [r.key, r]));

    // Batch 2: jsonb equality is order-insensitive for object keys and
    // distinguishes "20" (string) from 20 (number) — a plain JS comparison is
    // corrupted by drizzle's double-parse of scalar jsonb strings, so compare in
    // SQL. One VALUES-join query replaces ~45 per-row IS NOT DISTINCT FROM checks.
    const toCompare: Array<{ def: SettingDefinition; existing: (typeof existingRows)[number] }> = [];
    for (const row of existingRows) {
      const def = SETTINGS_REGISTRY.find(d => d.key === row.key);
      if (def && def.defaultValue !== null && def.defaultValue !== undefined) {
        toCompare.push({ def, existing: row });
      }
    }
    const sameByDefinitionId = new Map<string, boolean>();
    if (toCompare.length > 0) {
      const valueRows = toCompare.map(({ def, existing }) =>
        sql`(${existing.id}::uuid, ${JSON.stringify(def.defaultValue)}::jsonb)`);
      const values = sql.join(valueRows, sql`, `);
      const res = await tx.execute(sql`
        SELECT ${settingDefinitions.id} AS id,
               ${settingDefinitions.defaultValue} IS NOT DISTINCT FROM v.val AS same
        FROM ${settingDefinitions}
        JOIN (VALUES ${values}) AS v(id, val) ON v.id = ${settingDefinitions.id}
        WHERE ${settingDefinitions.tenantId} = ${tenantId}
      `);
      for (const r of res.rows as Array<{ id: string; same: boolean }>) {
        sameByDefinitionId.set(r.id, r.same);
      }
    }

    const actorId = context?.userId ?? null;
    const syncReason = reason ?? 'Synchronisé depuis le registre de code';

    const newDefinitions: (typeof settingDefinitions.$inferInsert)[] = [];
    const versionInserts: (typeof settingDefinitionVersions.$inferInsert)[] = [];

    for (const def of SETTINGS_REGISTRY) {
      const existing = existingByKey.get(def.key);

      if (!existing) {
        newDefinitions.push({
          tenantId,
          key: def.key,
          label: def.label,
          description: def.description,
          namespace: def.namespace,
          scope: def.scope,
          sensitivity: def.sensitivity,
          defaultValue: def.defaultValue as never,
          requiredPermission: def.requiredPermission,
          legacyField: def.legacyField,
          isCodeOwned: true,
        });
        result.created += 1;
        continue;
      }

      const codeDv = def.defaultValue === null || def.defaultValue === undefined
        ? null
        : JSON.stringify(def.defaultValue);
      const dvSame = codeDv === null
        ? existing.defaultValueIsNull
        : sameByDefinitionId.get(existing.id) ?? false;

      const changed = existing.label !== def.label
        || existing.description !== (def.description ?? null)
        || existing.namespace !== def.namespace
        || existing.scope !== def.scope
        || existing.sensitivity !== def.sensitivity
        || !dvSame
        || existing.requiredPermission !== def.requiredPermission
        || existing.legacyField !== (def.legacyField ?? null);

      if (changed) {
        const nextVersion = (await latestVersion(tenantId, existing.id)) + 1;
        await tx.update(settingDefinitions).set({
          label: def.label,
          description: def.description,
          namespace: def.namespace,
          scope: def.scope,
          sensitivity: def.sensitivity,
          defaultValue: def.defaultValue as never,
          requiredPermission: def.requiredPermission,
          legacyField: def.legacyField,
          updatedAt: new Date().toISOString(),
        }).where(eq(settingDefinitions.id, existing.id));
        versionInserts.push({
          tenantId,
          definitionId: existing.id,
          version: nextVersion,
          label: def.label,
          description: def.description,
          namespace: def.namespace,
          scope: def.scope,
          sensitivity: def.sensitivity,
          defaultValue: def.defaultValue as never,
          requiredPermission: def.requiredPermission,
          legacyField: def.legacyField,
          actorId,
          reason: syncReason,
        });
        result.updated += 1;
      } else {
        result.unchanged += 1;
      }
    }

    if (newDefinitions.length > 0) {
      const inserted = await tx.insert(settingDefinitions).values(newDefinitions).returning();
      for (let i = 0; i < inserted.length; i++) {
        const row = inserted[i]!;
        const def = newDefinitions[i]!;
        versionInserts.push({
          tenantId,
          definitionId: row.id,
          version: 1,
          label: def.label,
          description: def.description,
          namespace: def.namespace,
          scope: def.scope ?? 'school',
          sensitivity: def.sensitivity ?? 'internal',
          defaultValue: def.defaultValue,
          requiredPermission: def.requiredPermission,
          legacyField: def.legacyField,
          actorId,
          reason: syncReason,
        });
      }
    }

    if (versionInserts.length > 0) {
      await tx.insert(settingDefinitionVersions).values(versionInserts);
    }
  });

  cache.delete(tenantId);
  return result;
}

/**
 * Resolve catalog metadata for one key: DB row if present, otherwise the code
 * definition. Fail-open — a DB error never breaks settings resolution.
 */
export async function getCatalogDefinition(
  tenantId: string,
  key: string,
): Promise<CatalogDefinition | null> {
  try {
    const [row] = await db
      .select()
      .from(settingDefinitions)
      .where(and(
        eq(settingDefinitions.tenantId, tenantId),
        eq(settingDefinitions.key, key),
      ))
      .limit(1);
    if (row) return toCatalog(row);
  } catch {
    // fall through to code metadata
  }

  const def = SETTINGS_REGISTRY.find(d => d.key === key);
  if (!def) return null;
  return {
    key: def.key,
    label: def.label,
    description: def.description,
    namespace: def.namespace,
    scope: def.scope,
    sensitivity: def.sensitivity,
    defaultValue: def.defaultValue,
    requiredPermission: def.requiredPermission,
    legacyField: def.legacyField ?? null,
    isActive: true,
    isCodeOwned: true,
    version: 0,
    updatedAt: null,
  };
}

/**
 * All catalog definitions for a tenant, DB-backed with a 60s TTL cache.
 * Fails open to the code registry if the DB layer is unavailable.
 */
export async function getCatalogDefinitions(tenantId: string): Promise<CatalogDefinition[]> {
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.defs;

  try {
    const rows = await db
      .select()
      .from(settingDefinitions)
      .where(eq(settingDefinitions.tenantId, tenantId))
      .orderBy(settingDefinitions.namespace, settingDefinitions.key);

    const defs = rows.map(toCatalog);
    // Merge any code-only keys not yet synced (e.g. before the first seed).
    const synced = new Set(defs.map(d => d.key));
    const merged = [...defs];
    for (const code of SETTINGS_REGISTRY) {
      if (!synced.has(code.key)) merged.push({
        key: code.key,
        label: code.label,
        description: code.description,
        namespace: code.namespace,
        scope: code.scope,
        sensitivity: code.sensitivity,
        defaultValue: code.defaultValue,
        requiredPermission: code.requiredPermission,
        legacyField: code.legacyField ?? null,
        isActive: true,
        isCodeOwned: true,
        version: 0,
        updatedAt: null,
      });
    }
    merged.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.key.localeCompare(b.key));

    cache.set(tenantId, { at: Date.now(), defs: merged });
    return merged;
  } catch (err) {
    console.error('Failed to read setting definitions from DB, falling back to code registry', err);
    return SETTINGS_REGISTRY.map(def => ({
      key: def.key,
      label: def.label,
      description: def.description,
      namespace: def.namespace,
      scope: def.scope,
      sensitivity: def.sensitivity,
      defaultValue: def.defaultValue,
      requiredPermission: def.requiredPermission,
      legacyField: def.legacyField ?? null,
      isActive: true,
      isCodeOwned: true,
      version: 0,
      updatedAt: null,
    }));
  }
}

/** Run a sync for every tenant (startup + seed script). Never throws. */
export async function syncAllTenantDefinitions(): Promise<Record<string, { created: number; updated: number; unchanged: number }>> {
  const tenants = await db.execute(sql`SELECT id FROM tenants`);
  const summary: Record<string, { created: number; updated: number; unchanged: number }> = {};
  for (const t of tenants.rows as { id: string }[]) {
    try {
      summary[t.id] = await syncSettingDefinitions(t.id);
    } catch (err) {
      console.error(`Failed to sync setting definitions for tenant ${t.id}`, err);
      summary[t.id] = { created: 0, updated: 0, unchanged: 0 };
    }
  }
  return summary;
}
