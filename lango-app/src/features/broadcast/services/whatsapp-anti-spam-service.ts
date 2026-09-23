import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { communicationConnections, tenants } from '@/models/Schema';

export type WhatsAppQuotaStatus = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  isAllowed: boolean;
  antiBanDelayMs: number;
  planTier: string;
};

const PLAN_DAILY_LIMITS: Record<string, number> = {
  trial: 25,
  basic: 50,
  standard: 100,
  premium: 250,
};

const DEFAULT_DAILY_LIMIT = 50;
const RECOMMENDED_DELAY_MS = 1200; // 1.2s delay between messages to avoid Meta spam detection

/** In-memory fallback usage cache when no communication_connections row exists */
const memoryUsageMap = new Map<string, { date: string; used: number }>();

function getTodayString(): string {
  // YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

export async function getWhatsAppQuota(tenantId: string): Promise<WhatsAppQuotaStatus> {
  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const planTier = tenant?.planTier || 'trial';
  let dailyLimit = PLAN_DAILY_LIMITS[planTier] ?? DEFAULT_DAILY_LIMIT;

  const [conn] = await db
    .select({
      id: communicationConnections.id,
      configJson: communicationConnections.configJson,
    })
    .from(communicationConnections)
    .where(
      and(
        eq(communicationConnections.tenantId, tenantId),
        eq(communicationConnections.channel, 'whatsapp' as any)
      )
    )
    .limit(1);

  const todayStr = getTodayString();
  let usedToday = 0;

  if (conn) {
    const config = (conn.configJson ?? {}) as Record<string, any>;
    if (typeof config.customDailyLimit === 'number' && config.customDailyLimit > 0) {
      dailyLimit = config.customDailyLimit;
    }
    const usage = config.whatsappUsage as { date: string; used: number } | undefined;
    if (usage && usage.date === todayStr) {
      usedToday = Number(usage.used) || 0;
    }
  } else {
    const mem = memoryUsageMap.get(tenantId);
    if (mem && mem.date === todayStr) {
      usedToday = mem.used;
    }
  }

  const remainingToday = Math.max(0, dailyLimit - usedToday);

  return {
    dailyLimit,
    usedToday,
    remainingToday,
    isAllowed: remainingToday > 0,
    antiBanDelayMs: RECOMMENDED_DELAY_MS,
    planTier,
  };
}

export async function assertAndConsumeWhatsAppQuota(
  tenantId: string,
  count: number = 1
): Promise<WhatsAppQuotaStatus> {
  const quota = await getWhatsAppQuota(tenantId);

  if (quota.remainingToday < count) {
    throw new ApiError(
      429,
      'WHATSAPP_DAILY_QUOTA_EXCEEDED',
      `Protection Anti-Ban Meta : Quota quotidien WhatsApp atteint (${quota.usedToday}/${quota.dailyLimit} messages envoyés aujourd'hui). ` +
        `Pour protéger le numéro de l'établissement contre un bannissement pour spam, les envois supplémentaires sont suspendus. Utilisez les SMS directs pour les urgences.`
    );
  }

  const todayStr = getTodayString();
  const newUsed = quota.usedToday + count;

  const [conn] = await db
    .select({
      id: communicationConnections.id,
      configJson: communicationConnections.configJson,
    })
    .from(communicationConnections)
    .where(
      and(
        eq(communicationConnections.tenantId, tenantId),
        eq(communicationConnections.channel, 'whatsapp' as any)
      )
    )
    .limit(1);

  if (conn) {
    const currentConfig = (conn.configJson ?? {}) as Record<string, any>;
    const updatedConfig = {
      ...currentConfig,
      whatsappUsage: {
        date: todayStr,
        used: newUsed,
      },
    };

    await db
      .update(communicationConnections)
      .set({
        configJson: updatedConfig,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(communicationConnections.tenantId, tenantId),
          eq(communicationConnections.id, conn.id)
        )
      );
  } else {
    memoryUsageMap.set(tenantId, { date: todayStr, used: newUsed });
  }

  return {
    ...quota,
    usedToday: newUsed,
    remainingToday: Math.max(0, quota.dailyLimit - newUsed),
    isAllowed: quota.dailyLimit - newUsed > 0,
  };
}
