import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { communicationConnections } from '@/models/Schema';
import { getWhatsAppQuota } from '@/features/broadcast/services/whatsapp-anti-spam-service';

export async function GET(req: Request) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(ctx);

    // Fetch active SMS or WhatsApp connections for tenant
    const connections = await db
      .select({
        id: communicationConnections.id,
        channel: communicationConnections.channel,
        name: communicationConnections.name,
        provider: communicationConnections.provider,
        status: communicationConnections.status,
        lastTestedAt: communicationConnections.lastTestedAt,
      })
      .from(communicationConnections)
      .where(
        and(
          eq(communicationConnections.tenantId, tenantId),
          inArray(communicationConnections.channel, ['sms', 'whatsapp']),
        ),
      );

    const activeSms = connections.find(c => c.channel === 'sms' && c.status === 'connected'
      && !['test', 'sms-log', 'email-log'].includes(c.provider));
    const activeWhatsapp = connections.find(c => c.channel === 'whatsapp' && c.status === 'connected'
      && !['test', 'sms-log', 'email-log'].includes(c.provider));

    const whatsappQuota = await getWhatsAppQuota(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        sms: activeSms
          ? {
              configured: true,
              id: activeSms.id,
              name: activeSms.name,
              provider: activeSms.provider,
              status: activeSms.status,
              lastTestedAt: activeSms.lastTestedAt,
              mode: 'live',
              quotaRemaining: 'Actif',
            }
          : {
              configured: false,
              id: undefined,
              name: 'Aucune passerelle SMS connectée',
              provider: 'simulation',
              status: 'simulated',
              mode: 'simulation',
              quotaRemaining: 'Indisponible',
            },
        whatsapp: activeWhatsapp
          ? {
              configured: true,
              id: activeWhatsapp.id,
              name: activeWhatsapp.name,
              provider: activeWhatsapp.provider,
              status: activeWhatsapp.status,
              lastTestedAt: activeWhatsapp.lastTestedAt,
              mode: 'live',
              dailyLimit: whatsappQuota.dailyLimit,
              usedToday: whatsappQuota.usedToday,
              remainingToday: whatsappQuota.remainingToday,
              antiBanDelayMs: whatsappQuota.antiBanDelayMs,
            }
          : {
              configured: false,
              id: undefined,
              name: 'WhatsApp WAHA (Non connecté)',
              provider: 'whatsapp-waha',
              status: 'disconnected',
              mode: 'disconnected',
              dailyLimit: whatsappQuota.dailyLimit,
              usedToday: whatsappQuota.usedToday,
              remainingToday: whatsappQuota.remainingToday,
              antiBanDelayMs: whatsappQuota.antiBanDelayMs,
            },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
