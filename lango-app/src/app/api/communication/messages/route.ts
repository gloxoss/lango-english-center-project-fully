import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, smsMessageCreateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { smsMessages } from '@/models/Schema';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';

// POST records the message row and, when the tenant has a real SMS connection
// (e.g. a webhook provider), attempts a real outbound send. Without one it stays
// in honest log-only simulation — the UI banner reflects that state.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const rows = await db
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.tenantId, tenantId))
      .orderBy(desc(smsMessages.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ success: true, data: rows, total: rows.length, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, smsMessageCreateSchema);

    const result = await sendSmsMessage(tenantId, {
      to: body.recipientPhone,
      body: body.body,
      studentId: body.studentId,
      createdById: context.userId,
    });

    recordAudit(context, 'create', 'sms_message', result.id);

    const message = result.delivery === 'simulated'
      ? `Message enregistré pour ${body.recipientPhone} (mode simulation, aucun SMS réel envoyé).`
      : result.delivery === 'failed'
        ? `Échec de l'envoi vers ${body.recipientPhone}${result.failureReason ? ` (${result.failureReason})` : ''}.`
        : `Message envoyé vers ${body.recipientPhone}.`;

    return NextResponse.json({
      success: true,
      data: { id: result.id, delivery: result.delivery, simulated: result.delivery === 'simulated' },
      message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
