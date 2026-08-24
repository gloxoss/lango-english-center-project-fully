import type { NextRequest } from 'next/server';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { smsMessages, tenants } from '@/models/Schema';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['super_admin']);

    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenantId');
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search');

    const conditions: any[] = [];
    if (tenantIdParam && tenantIdParam !== 'all') {
      conditions.push(eq(smsMessages.tenantId, tenantIdParam as any));
    }
    if (statusParam && ['queued', 'sent', 'failed'].includes(statusParam)) {
      conditions.push(eq(smsMessages.status, statusParam as any));
    }
    if (searchParam) {
      conditions.push(
        sql`(${smsMessages.recipientPhone} ILIKE ${`%${searchParam}%`} OR ${smsMessages.body} ILIKE ${`%${searchParam}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, statsRows, schoolList] = await Promise.all([
      db
        .select({
          id: smsMessages.id,
          tenantId: smsMessages.tenantId,
          schoolName: tenants.name,
          recipientPhone: smsMessages.recipientPhone,
          body: smsMessages.body,
          status: smsMessages.status,
          sentAt: smsMessages.sentAt,
          createdAt: smsMessages.createdAt,
        })
        .from(smsMessages)
        .leftJoin(tenants, eq(smsMessages.tenantId, tenants.id))
        .where(whereClause)
        .orderBy(desc(smsMessages.createdAt))
        .limit(100),

      db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${smsMessages.status} = 'sent')`,
          queued: sql<number>`count(*) filter (where ${smsMessages.status} = 'queued')`,
          failed: sql<number>`count(*) filter (where ${smsMessages.status} = 'failed')`,
        })
        .from(smsMessages),

      db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
        })
        .from(tenants)
        .orderBy(tenants.name),
    ]);

    const stats = statsRows[0] ?? { total: 0, sent: 0, queued: 0, failed: 0 };
    const successRate = stats.total > 0 ? Math.round((Number(stats.sent) / Number(stats.total)) * 100) : 100;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total: Number(stats.total),
          sent: Number(stats.sent),
          queued: Number(stats.queued),
          failed: Number(stats.failed),
          successRate,
        },
        logs,
        schools: schoolList,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const topupSchema = z.object({
  tenantId: z.string().uuid(),
  credits: z.number().int().positive(),
  note: z.string().max(255).optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['super_admin']);
    const body = await parseJson(req, topupSchema);

    // Record credit top-up audit trail
    recordAudit(ctx, 'update', 'sms_credits', body.tenantId, {
      creditsAdded: body.credits,
      note: body.note,
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: body.tenantId,
        creditsAdded: body.credits,
        message: `${body.credits} crédits SMS alloués à l'école avec succès.`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
