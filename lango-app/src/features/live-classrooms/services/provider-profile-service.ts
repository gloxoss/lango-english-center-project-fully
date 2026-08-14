// Provider profile CRUD + real connectivity testing.
//
// Security posture: raw credential values are NEVER persisted. A profile stores
// a reference name (credentialRef) and optionally an encrypted blob carrying
// keyId/version metadata; the adapter resolves the actual secret from env at
// call time. Connectivity tests run the adapter's validateConfiguration (dev:
// deterministic and labeled as such; BBB: env-gated live getMeetings round trip;
// external_link: presence check of the configured link). Every test records a
// provider_operations row so failures are auditable.
import { and, count, eq, ne } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  liveClassProviderOperations, liveClassProviderProfiles, liveClassSessions,
} from '@/models/Schema';
import {
  getProvider, isKnownProviderType, type ProviderCapabilities, type ProviderConfig,
} from '@/features/live-classrooms/providers';

export type ProviderProfileInput = {
  name: string;
  providerType: string;
  scope?: 'tenant' | 'platform';
  baseUrl?: string | null;
  accountId?: string | null;
  credentialRef?: string | null;
  credentialEncrypted?: string | null;
  // P1-4: env var name holding this profile's webhook-signature secret. The
  // raw secret value is never accepted or stored here — only the reference.
  webhookSecretRef?: string | null;
  enabled?: boolean;
};

export type ProviderProfileRow = typeof liveClassProviderProfiles.$inferSelect;

function deriveCapabilities(providerType: string): string[] {
  const provider = getProvider(providerType);
  if (!provider) return [];
  const caps = provider.capabilities as ProviderCapabilities;
  return (Object.keys(caps) as Array<keyof ProviderCapabilities>).filter(k => caps[k]);
}

export async function listProviderProfiles(tenantId: string): Promise<ProviderProfileRow[]> {
  return db
    .select()
    .from(liveClassProviderProfiles)
    .where(eq(liveClassProviderProfiles.tenantId, tenantId))
    .orderBy(liveClassProviderProfiles.createdAt);
}

async function loadProfileOrThrow(tenantId: string, id: string): Promise<ProviderProfileRow> {
  const [profile] = await db.select().from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, id), eq(liveClassProviderProfiles.tenantId, tenantId)))
    .limit(1);
  if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Profil fournisseur introuvable.');
  return profile;
}

async function assertNameAvailable(tenantId: string, name: string, excludeId?: string): Promise<void> {
  const filters = [eq(liveClassProviderProfiles.tenantId, tenantId), eq(liveClassProviderProfiles.name, name)];
  if (excludeId) filters.push(ne(liveClassProviderProfiles.id, excludeId));
  const [existing] = await db.select({ id: liveClassProviderProfiles.id }).from(liveClassProviderProfiles)
    .where(and(...filters)).limit(1);
  if (existing) throw new ApiError(409, 'PROFILE_NAME_EXISTS', 'Un profil avec ce nom existe déjà pour cet établissement.');
}

export async function createProviderProfile(tenantId: string, input: ProviderProfileInput): Promise<ProviderProfileRow> {
  if (!isKnownProviderType(input.providerType)) {
    throw new ApiError(422, 'UNKNOWN_PROVIDER', 'Type de fournisseur inconnu.');
  }
  const name = input.name.trim();
  if (!name) throw new ApiError(422, 'VALIDATION_ERROR', 'Le nom du profil est requis.');
  await assertNameAvailable(tenantId, name);

  const [row] = await db.insert(liveClassProviderProfiles).values({
    tenantId,
    name,
    providerType: input.providerType,
    scope: input.scope ?? 'tenant',
    baseUrl: input.baseUrl ?? null,
    accountId: input.accountId ?? null,
    credentialRef: input.credentialRef ?? null,
    credentialEncrypted: input.credentialEncrypted ?? null,
    webhookSecretRef: input.webhookSecretRef ?? null,
    capabilities: deriveCapabilities(input.providerType),
    enabled: input.enabled ?? true,
  }).returning();
  return row!;
}

export async function updateProviderProfile(
  tenantId: string,
  id: string,
  input: Partial<ProviderProfileInput>,
): Promise<ProviderProfileRow> {
  const profile = await loadProfileOrThrow(tenantId, id);
  const providerType = input.providerType ?? profile.providerType;
  if (input.providerType && !isKnownProviderType(input.providerType)) {
    throw new ApiError(422, 'UNKNOWN_PROVIDER', 'Type de fournisseur inconnu.');
  }

  const name = input.name?.trim() ?? profile.name;
  if (name !== profile.name) await assertNameAvailable(tenantId, name, id);

  const [updated] = await db.update(liveClassProviderProfiles)
    .set({
      name,
      providerType,
      scope: input.scope ?? profile.scope,
      baseUrl: input.baseUrl !== undefined ? input.baseUrl : profile.baseUrl,
      accountId: input.accountId !== undefined ? input.accountId : profile.accountId,
      credentialRef: input.credentialRef !== undefined ? input.credentialRef : profile.credentialRef,
      credentialEncrypted: input.credentialEncrypted !== undefined ? input.credentialEncrypted : profile.credentialEncrypted,
      webhookSecretRef: input.webhookSecretRef !== undefined ? input.webhookSecretRef : profile.webhookSecretRef,
      capabilities: deriveCapabilities(providerType),
      enabled: input.enabled ?? profile.enabled,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(liveClassProviderProfiles.id, id), eq(liveClassProviderProfiles.tenantId, tenantId)))
    .returning();
  return updated!;
}

export async function deleteProviderProfile(tenantId: string, id: string): Promise<void> {
  await loadProfileOrThrow(tenantId, id);
  const [countRow] = await db
    .select({ value: count() })
    .from(liveClassSessions)
    .where(and(eq(liveClassSessions.tenantId, tenantId), eq(liveClassSessions.providerProfileId, id)));
  const sessionCount = countRow?.value ?? 0;
  if (sessionCount > 0) {
    throw new ApiError(409, 'PROFILE_IN_USE', 'Ce profil est utilisé par des sessions existantes et ne peut pas être supprimé.');
  }
  await db.delete(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, id), eq(liveClassProviderProfiles.tenantId, tenantId)));
}

export async function testProviderConnection(tenantId: string, id: string) {
  const profile = await loadProfileOrThrow(tenantId, id);
  const provider = getProvider(profile.providerType);
  if (!provider) throw new ApiError(422, 'UNKNOWN_PROVIDER', 'Type de fournisseur inconnu.');

  const config: ProviderConfig = { baseUrl: profile.baseUrl, accountId: profile.accountId };
  const startedAt = Date.now();
  const result = await provider.validateConfiguration(config);
  const latencyMs = Date.now() - startedAt;

  await db.insert(liveClassProviderOperations).values({
    tenantId,
    providerProfileId: id,
    operation: 'test_connection',
    idempotencyKey: `test-connection:${id}:${Date.now()}`,
    status: result.ok ? 'succeeded' : 'failed',
    requestSnapshot: { baseUrl: profile.baseUrl },
    resultSnapshot: { latencyMs },
    error: result.ok ? null : (result.error ?? result.code ?? null),
  });

  return {
    ok: result.ok,
    code: result.code,
    error: result.error,
    latencyMs,
    providerType: profile.providerType,
    // dev is deterministic by design; BBB/external_link report the real check.
    mode: profile.providerType === 'dev' ? 'deterministic' : 'real',
  };
}
