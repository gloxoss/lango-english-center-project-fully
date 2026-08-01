import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson, smsMessageCreateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { smsMessages } from '@/models/Schema';

// ponytail: no SMS provider is wired up - see the Schema.ts comment on
// smsMessages. POST logs a real row and marks it 'sent' immediately, it
// never calls an external carrier. The UI must show this is a simulation -
// do not remove that banner if you touch the caller.

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

    const now = new Date().toISOString();
    const [inserted] = await db
      .insert(smsMessages)
      .values({
        tenantId,
        recipientPhone: body.recipientPhone,
        studentId: body.studentId,
        body: body.body,
        status: 'sent',
        sentAt: now,
        createdById: context.userId,
      })
      .returning();

    recordAudit(context, 'create', 'sms_message', inserted!.id);

    return NextResponse.json({
      success: true,
      data: inserted,
      message: `Message simulé enregistré pour ${body.recipientPhone} (mode simulation, aucun SMS réel envoyé).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
