import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationConnections, communicationSuppressions, smsMessages } from '@/models/Schema';
import { checkConsent } from './consent-service';
import { getConnectionWithSecrets } from './connections-service';
import { getProvider, type BroadcastProvider } from '../providers/provider';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';
import '../providers';

// Shared SMS send path for the smsMessages-based notifications (attendance
// reminders, flag-detail messages, bulk send, etc.). Always records the message
// row; additionally attempts a real outbound delivery when the tenant has an SMS
// connection with a real provider (e.g. `android-sms`, `smsto`, `twilio`, `webhook`).
// Without one, it checks for a platform-level fallback provider before degrading
// to the app's honest log-only simulation. `delivered` only ever reflects provider
// evidence, never a fabricated status.

const LOG_ONLY_PROVIDERS = new Set(['test', 'sms-log', 'email-log']);

export type SendSmsResult = {
  id: string;
  delivery: 'sent' | 'delivered' | 'failed' | 'simulated';
  provider: string | null;
  providerRef: string | null;
  failureReason: string | null;
};

export type SmsInput = {
  to: string;
  body: string;
  studentId?: string | null;
  createdById?: string | null;
  channel?: 'sms' | 'whatsapp';
};

type ResolvedSms = {
  provider: BroadcastProvider;
  providerName: string;
  config: Record<string, unknown> | null;
  isReal: boolean;
} | null;

function getPlatformDefault(channel: 'sms' | 'whatsapp' = 'sms'): ResolvedSms {
  if (channel === 'whatsapp') {
    const providerName = process.env.PLATFORM_DEFAULT_WHATSAPP_PROVIDER || 'whatsapp-waha';
    const provider = getProvider(providerName);
    if (!provider) return null;
    const apiKey = process.env.PLATFORM_WAHA_KEY || process.env.WAHA_API_KEY || '';
    // Security audit P0-A: no hardcoded key fallback. A platform WhatsApp
    // default without a configured key is treated as unavailable — sending
    // with the old literal would authenticate against whatever server knows
    // that public string.
    if (!apiKey) return null;
    const config: Record<string, unknown> = {
      endpointUrl: process.env.PLATFORM_WAHA_URL || process.env.WAHA_ENDPOINT_URL || 'http://schoolos-waha:3000',
      apiKey,
      session: process.env.PLATFORM_WAHA_SESSION || 'default',
    };
    const isReal = !LOG_ONLY_PROVIDERS.has(providerName);
    return { provider, providerName: `${providerName} (platform)`, config, isReal };
  }

  const providerName = process.env.PLATFORM_DEFAULT_SMS_PROVIDER || process.env.DEFAULT_SMS_PROVIDER;
  if (!providerName) return null;
  const provider = getProvider(providerName);
  if (!provider) return null;

  let config: Record<string, unknown> = {};
  if (providerName === 'android-sms') {
    config = {
      endpointUrl: process.env.PLATFORM_ANDROID_SMS_URL || process.env.ANDROID_SMS_GATEWAY_URL,
      apiKey: process.env.PLATFORM_ANDROID_SMS_KEY || process.env.ANDROID_SMS_API_KEY,
      deviceId: process.env.PLATFORM_ANDROID_SMS_DEVICE_ID,
    };
  } else if (providerName === 'smsto') {
    config = {
      apiKey: process.env.PLATFORM_SMSTO_KEY || process.env.SMSTO_API_KEY,
      senderId: process.env.PLATFORM_SMSTO_SENDER || process.env.SMSTO_SENDER_ID || 'SchoolOS',
    };
  } else if (providerName === 'twilio') {
    config = {
      accountSid: process.env.PLATFORM_TWILIO_SID || process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.PLATFORM_TWILIO_TOKEN || process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.PLATFORM_TWILIO_FROM || process.env.TWILIO_FROM_NUMBER,
    };
  } else if (providerName === 'whatsapp-waha') {
    config = {
      endpointUrl: process.env.PLATFORM_WAHA_URL || process.env.WAHA_ENDPOINT_URL,
      apiKey: process.env.PLATFORM_WAHA_KEY || process.env.WAHA_API_KEY,
      session: process.env.PLATFORM_WAHA_SESSION || 'default',
    };
  }

  const isReal = !LOG_ONLY_PROVIDERS.has(providerName);
  return { provider, providerName: `${providerName} (platform)`, config, isReal };
}

async function resolveProvider(tenantId: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<ResolvedSms> {
  const [connection] = await db
    .select()
    .from(communicationConnections)
    .where(and(eq(communicationConnections.tenantId, tenantId), eq(communicationConnections.channel, channel as any)))
    .limit(1);

  if (connection) {
    const provider = getProvider(connection.provider);
    if (provider) {
      const isReal = !LOG_ONLY_PROVIDERS.has(provider.provider);
      let config = isReal
        ? ((await getConnectionWithSecrets(tenantId, connection.id)).configJson as Record<string, unknown> | null)
        : null;
      if (connection.provider === 'whatsapp-waha' && config) {
        const customSession = typeof config.session === 'string' && config.session.trim() && config.session !== 'default'
          ? config.session.trim()
          : `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        config = { ...config, session: customSession };
      }
      return { provider, providerName: connection.provider, config, isReal };
    }
  }

  // Fallback to platform-default if school has no custom provider
  return getPlatformDefault(channel);
}

/**
 * Returns the reason a message must not be sent, or null when it may go out.
 * Phone-level suppressions are stored as recipientKind 'external' keyed by the
 * normalized number (that is what an inbound STOP creates); a student-level
 * revoked consent or suppression also blocks messages about that student.
 */
export async function findSendBlock(
  tenantId: string,
  normalizedPhone: string,
  studentId: string | null,
  channel: 'sms' | 'whatsapp',
): Promise<'suppressed' | 'consent_revoked' | null> {
  const phoneSuppressed = await db
    .select({ id: communicationSuppressions.id })
    .from(communicationSuppressions)
    .where(and(
      eq(communicationSuppressions.tenantId, tenantId),
      eq(communicationSuppressions.recipientKind, 'external'),
      eq(communicationSuppressions.recipientId, normalizedPhone),
      or(isNull(communicationSuppressions.channel), eq(communicationSuppressions.channel, channel)),
    ))
    .limit(1);
  if (phoneSuppressed.length > 0) return 'suppressed';

  if (studentId) {
    const decision = await checkConsent(tenantId, 'student', studentId, channel);
    if (!decision.allowed) return decision.reason === 'consent_revoked' ? 'consent_revoked' : 'suppressed';
  }
  return null;
}

async function dispatch(
  tenantId: string,
  resolved: ResolvedSms,
  input: SmsInput,
  channel: 'sms' | 'whatsapp' = 'sms',
): Promise<SendSmsResult> {
  const normalizedPhone = normalizeMoroccanPhone(input.to) || input.to;
  let status: 'queued' | 'sent' | 'failed' = 'sent';
  let delivery: SendSmsResult['delivery'] = 'simulated';
  let providerRef: string | null = null;
  let failureReason: string | null = null;
  let sentAt: string | null = new Date().toISOString();

  // Every direct send (attendance alerts, bulk send, reminders) honours STOP /
  // opt-out exactly like broadcast campaigns do. The blocked attempt is still
  // recorded so staff can see who was skipped and why.
  const block = await findSendBlock(tenantId, normalizedPhone, input.studentId ?? null, channel);
  if (block) {
    status = 'failed';
    delivery = 'failed';
    failureReason = block;
    sentAt = null;
  } else if (resolved?.isReal) {
    const result = await resolved.provider.send({
      channel,
      to: normalizedPhone,
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
      recipientPhone: normalizedPhone,
      body: input.body,
      studentId: input.studentId ?? null,
      status,
      sentAt,
      createdById: input.createdById ?? null,
    })
    .returning();

  return { id: inserted!.id, delivery, provider: resolved?.providerName ?? null, providerRef, failureReason };
}

export async function sendSmsMessage(
  tenantId: string,
  input: SmsInput,
  channel: 'sms' | 'whatsapp' = 'sms',
): Promise<SendSmsResult> {
  const targetChannel = input.channel ?? channel;
  return dispatch(tenantId, await resolveProvider(tenantId, targetChannel), input, targetChannel);
}

export async function sendSmsMessages(
  tenantId: string,
  inputs: SmsInput[],
  channel: 'sms' | 'whatsapp' = 'sms',
): Promise<SendSmsResult[]> {
  const out: SendSmsResult[] = [];
  for (const input of inputs) {
    const targetChannel = input.channel ?? channel;
    const resolved = await resolveProvider(tenantId, targetChannel);
    out.push(await dispatch(tenantId, resolved, input, targetChannel));
  }
  return out;
}
