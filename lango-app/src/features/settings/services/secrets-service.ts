import { and, eq, isNull } from 'drizzle-orm';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { decryptSecret, encryptSecret, isEncrypted } from '@/libs/api/secrets';
import { db } from '@/libs/DB';
import { getDefinition } from '@/libs/settings/registry';
import { secretReferences, settingValues } from '@/models/Schema';

export type ResolvedSecret = {
  key: string;
  /** Decrypted value — legacy plaintext rows resolve as-is (migration path). */
  value: string;
  /** Whether the stored blob was encrypted at rest. */
  encrypted: boolean;
  source: 'tenant' | 'branch';
  settingValueId: string;
  version: number;
};

/**
 * Resolve the raw stored secret for the effective scope (branch override
 * first, then tenant-global) and decrypt it. Legacy plaintext values still
 * resolve unchanged; they get encrypted on the next write or rotation.
 */
async function resolveSecret(
  tenantId: string,
  branchId: string | null,
  key: string,
): Promise<ResolvedSecret> {
  const def = getDefinition(key);
  if (def.sensitivity !== 'secret') {
    throw new ApiError(400, 'NOT_SECRET', `Le paramètre "${key}" n'est pas un secret.`);
  }

  let row: typeof settingValues.$inferSelect | undefined;
  let source: 'tenant' | 'branch' = 'tenant';

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
      row = branchRow;
      source = 'branch';
    }
  }

  if (!row) {
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
      row = tenantRow;
      source = 'tenant';
    }
  }

  if (!row) {
    throw new ApiError(404, 'SECRET_NOT_FOUND', `Aucun secret configuré pour "${key}".`);
  }

  const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
  const encrypted = isEncrypted(raw);

  return {
    key,
    value: encrypted ? decryptSecret(raw) : raw,
    encrypted,
    source,
    settingValueId: row.id,
    version: row.version,
  };
}

export async function peekSecretValue(context: RequestContext, key: string): Promise<ResolvedSecret> {
  if (!context.tenantId) {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis pour cette opération.');
  }
  return resolveSecret(context.tenantId, context.branchId, key);
}

export async function rotateSecretValue(
  context: RequestContext,
  key: string,
): Promise<{ rotated: true; key: string; version: number; settingValueId: string }> {
  if (!context.tenantId) {
    throw new ApiError(403, 'TENANT_REQUIRED', 'Un établissement est requis pour cette opération.');
  }
  const resolved = await resolveSecret(context.tenantId, context.branchId, key);

  // Re-encrypt in place with a fresh IV: the ciphertext blob changes, the
  // version does not (no history churn). Legacy plaintext becomes encrypted
  // here, which is the documented "encrypted on next write" migration path.
  const newBlob = encryptSecret(resolved.value);
  await db
    .update(settingValues)
    .set({
      value: newBlob,
      updatedBy: context.userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(settingValues.id, resolved.settingValueId));

  await db.insert(secretReferences).values({
    tenantId: context.tenantId,
    key,
    settingValueId: resolved.settingValueId,
    cipher: 'aes-256-gcm',
    rotatedAt: new Date().toISOString(),
    rotatedBy: context.userId,
  });

  return { rotated: true, key, version: resolved.version, settingValueId: resolved.settingValueId };
}
