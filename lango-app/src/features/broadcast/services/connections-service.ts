import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationConnections, smsMessages } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { decryptSecret, encryptSecret, isEncrypted } from '@/libs/api/secrets';
import { getProvider } from '../providers/provider';
import '../providers';
import type { broadcastChannel } from '../models/broadcast-schema';

type Channel = (typeof broadcastChannel.enumValues)[number];

// Secret config keys are encrypted at rest and never returned to the browser.
const SECRET_CONFIG_KEYS = [
  'apiKey', 'apiSecret', 'token', 'accessToken', 'phoneNumberId',
  'fromAddress', 'password', 'authToken', 'secretKey', 'appSecret',
];
const MASK = '••••••••';

/** Strip secret values before projecting to the browser; keep non-secret config. */
export function maskConfig(configJson: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(configJson ?? {})) {
    if (SECRET_CONFIG_KEYS.includes(k)) out[k] = v ? MASK : v;
    else out[k] = v;
  }
  return out;
}

export function connectionPublic(row: typeof communicationConnections.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    channel: row.channel,
    name: row.name,
    provider: row.provider,
    status: row.status,
    lastTestedAt: row.lastTestedAt,
    config: maskConfig(row.configJson as Record<string, unknown>),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listConnections(tenantId: string) {
  const rows = await db
    .select()
    .from(communicationConnections)
    .where(eq(communicationConnections.tenantId, tenantId))
    .orderBy(communicationConnections.createdAt);
  return rows.map(connectionPublic);
}

export async function getConnection(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(communicationConnections)
    .where(and(eq(communicationConnections.id, id), eq(communicationConnections.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Connexion introuvable.');
  return row;
}

export async function getConnectionWithSecrets(tenantId: string, id: string) {
  const row = await getConnection(tenantId, id);
  return { ...row, configJson: decryptConfig(row.configJson as Record<string, unknown>) };
}

function encryptConfig(configJson: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(configJson ?? {})) {
    if (SECRET_CONFIG_KEYS.includes(k) && typeof v === 'string' && v && v !== MASK) out[k] = encryptSecret(v);
    else out[k] = v;
  }
  return out;
}

function decryptConfig(configJson: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(configJson ?? {})) {
    if (typeof v === 'string' && isEncrypted(v)) out[k] = decryptSecret(v);
    else out[k] = v;
  }
  return out;
}

export type CreateConnectionInput = {
  channel: Channel;
  name: string;
  provider: string;
  config?: Record<string, unknown>;
};

export async function createConnection(tenantId: string, body: CreateConnectionInput, actorId: string | null) {
  if (!getProvider(body.provider)) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Fournisseur « ${body.provider} » inconnu.`);
  }
  const [inserted] = await db
    .insert(communicationConnections)
    .values({
      tenantId,
      channel: body.channel as any,
      name: body.name,
      provider: body.provider,
      configJson: encryptConfig(body.config ?? {}),
      status: 'connected',
      createdBy: actorId,
    })
    .returning();
  if (!inserted) throw new ApiError(500, 'INTERNAL', 'Création de la connexion impossible.');
  return connectionPublic(inserted);
}

export type UpdateConnectionInput = {
  name?: string;
  config?: Record<string, unknown>;
  status?: 'connected' | 'disconnected' | 'error';
};

export async function updateConnection(tenantId: string, id: string, body: UpdateConnectionInput) {
  const existing = await getConnection(tenantId, id);
  const mergedConfig = encryptConfig({ ...decryptConfig(existing.configJson as Record<string, unknown>), ...(body.config ?? {}) });
  const [updated] = await db
    .update(communicationConnections)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.status !== undefined && { status: body.status as any }),
      configJson: mergedConfig,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(communicationConnections.id, id), eq(communicationConnections.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Connexion introuvable.');
  return connectionPublic(updated);
}

export async function deleteConnection(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(communicationConnections)
    .where(and(eq(communicationConnections.id, id), eq(communicationConnections.tenantId, tenantId)))
    .returning({ id: communicationConnections.id });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Connexion introuvable.');
}

export async function testConnection(tenantId: string, id: string) {
  const withSecrets = await getConnectionWithSecrets(tenantId, id);
  const provider = getProvider(withSecrets.provider);
  const result = provider?.testConnection
    ? await provider.testConnection(withSecrets.configJson as Record<string, unknown>)
    : { ok: false, message: `Fournisseur « ${withSecrets.provider} » non testable.` };
  await db
    .update(communicationConnections)
    .set({ status: result.ok ? 'connected' : 'error', lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(communicationConnections.id, id), eq(communicationConnections.tenantId, tenantId)));
  return result;
}

export async function sendTestMessage(tenantId: string, id: string, to: string, messageText?: string) {
  const withSecrets = await getConnectionWithSecrets(tenantId, id);
  const provider = getProvider(withSecrets.provider);
  if (!provider) {
    throw new ApiError(400, 'BAD_REQUEST', `Fournisseur « ${withSecrets.provider} » introuvable.`);
  }

  const text = messageText?.trim() || `Test SchoolOS en direct via ${withSecrets.name} (${withSecrets.provider}) à ${new Date().toLocaleTimeString('fr-FR')}.`;

  let sendConfig = (withSecrets.configJson ? { ...withSecrets.configJson as Record<string, unknown> } : {}) as Record<string, unknown>;
  if (withSecrets.provider === 'whatsapp-waha') {
    const customSession = typeof sendConfig.session === 'string' && sendConfig.session.trim() && sendConfig.session !== 'default'
      ? sendConfig.session.trim()
      : `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    sendConfig.session = customSession;
  }

  const result = await provider.send({
    channel: withSecrets.channel as Channel,
    to: to.trim(),
    subject: 'Test SchoolOS',
    bodyText: text,
    config: sendConfig,
  });

  if (withSecrets.channel === 'sms') {
    await db.insert(smsMessages).values({
      tenantId,
      recipientPhone: to.trim(),
      body: text,
      status: result.ok ? 'sent' : 'failed',
      sentAt: result.ok ? new Date().toISOString() : null,
    }).catch(() => {});
  }

  return result;
}

