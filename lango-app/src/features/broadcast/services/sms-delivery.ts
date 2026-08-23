import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationConnections, smsMessages } from '@/models/Schema';
import { getConnectionWithSecrets } from './connections-service';
import { getProvider, type BroadcastProvider } from '../providers/provider';
import '../providers';

// Shared SMS send path for the smsMessages-based notifications (attendance
// reminders, flag-detail messages, bulk send, etc.). Always records the message
// row; additionally attempts a real outbound delivery when the tenant has an SMS
// connection with a real provider (e.g. `webhook`). Without one, it stays in the
// app's honest log-only simulation. `delivered` only ever reflects provider
// evidence, never a fabricated status.

const LOG_ONLY_PROVIDERS = new Set(['test', 'sms-log', 'email-log']);

export type SendSmsResult = {
  id: string;
  delivery: 'sent' | 'delivered' | 'failed' | 'simulated';
  provider: string | null;
  providerRef: string | null;
  failureReason: string | null;
};

export type SmsInput = { to: string; body: string; studentId?: string | null; createdById?: string | null };

type ResolvedSms = {
  provider: BroadcastProvider;
  providerName: string;
  config: Record<string, unknown> | null;
  isReal: boolean;
} | null;

async function resolveSms(tenantId: string): Promise<ResolvedSms> {
  const [connection] = await db
    .select()
    .from(communicationConnections)
    .where(and(eq(communicationConnections.tenantId, tenantId), eq(communicationConnections.channel, 'sms' as any)))
    .limit(1);
  if (!connection) return null;
  const provider = getProvider(connection.provider);
  if (!provider) return null;
  const isReal = !LOG_ONLY_PROVIDERS.has(provider.provider);
  const config = isReal
    ? ((await getConnectionWithSecrets(tenantId, connection.id)).configJson as Record<string, unknown> | null)
    : null;
  return { provider, providerName: connection.provider, config, isReal };
}

async function dispatch(tenantId: string, resolved: ResolvedSms, input: SmsInput): Promise<SendSmsResult> {
  let status: 'queued' | 'sent' | 'failed' = 'sent';
  let delivery: SendSmsResult['delivery'] = 'simulated';
  let providerRef: string | null = null;
  let failureReason: string | null = null;
  let sentAt: string | null = new Date().toISOString();

  if (resolved?.isReal) {
    const result = await resolved.provider.send({
      channel: 'sms',
      to: input.to,
      bodyText: input.body,
      ...(resolved.config ? { config: resolved.config } : {}),
    });
    if (result.ok) {
      status = 'sent';
      delivery = result.status === 'delivered' ? 'delivered' : 'sent';
      providerRef = result.providerRef ?? null;
    } else {
      status = 'failed';
      delivery = 'failed';
      failureReason = result.failureReason ?? 'provider_failure';
      sentAt = null;
    }
  }

  const [inserted] = await db
    .insert(smsMessages)
    .values({
      tenantId,
      recipientPhone: input.to,
      body: input.body,
      studentId: input.studentId ?? null,
      status,
      sentAt,
      createdById: input.createdById ?? null,
    })
    .returning();

  return { id: inserted!.id, delivery, provider: resolved?.providerName ?? null, providerRef, failureReason };
}

export async function sendSmsMessage(tenantId: string, input: SmsInput): Promise<SendSmsResult> {
  return dispatch(tenantId, await resolveSms(tenantId), input);
}

export async function sendSmsMessages(tenantId: string, inputs: SmsInput[]): Promise<SendSmsResult[]> {
  const resolved = await resolveSms(tenantId);
  const out: SendSmsResult[] = [];
  for (const input of inputs) {
    out.push(await dispatch(tenantId, resolved, input));
  }
  return out;
}
