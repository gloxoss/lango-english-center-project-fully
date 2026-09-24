import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { announcements, user } from '@/models/Schema';
import { sendSmsMessages, type SmsInput } from '@/features/broadcast/services/sms-delivery';

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  targetRole: z.enum(['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'alumni', 'parent', 'receptionist', 'guard']).optional(),
  targetClassSectionId: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    // Fetch announcements targeted to viewer's role (or null/everyone)
    const list = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.tenantId, tenantId),
          or(
            isNull(announcements.targetRole),
            eq(announcements.targetRole, context.role as any)
          )
        )
      )
      .orderBy(desc(announcements.createdAt));

    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, createAnnouncementSchema);

    const [item] = await db
      .insert(announcements)
      .values({
        tenantId,
        title: body.title,
        body: body.body,
        targetRole: body.targetRole || null,
        targetClassSectionId: body.targetClassSectionId || null,
        createdById: context.userId,
      })
      .returning();

    if (item) {
      await recordAudit(context, 'create', 'announcement', item.id);

      // SMS notice to alumni, through the authoritative dispatch service. The
      // raw insert this replaced wrote status 'sent' with sentAt set and never
      // called a provider, which fabricated a send and skipped the consent and
      // suppression checks. The dispatcher records 'queued' with sentAt null when
      // no provider is configured, and only reports 'sent'/'delivered' on
      // provider evidence (NOTIFICATION TRUTH, see attendance/route.ts).
      if (body.targetRole === 'alumni') {
        const recipients = await db
          .select({ id: user.id, phone: user.phone })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.role, 'alumni')));
        const inputs: SmsInput[] = [];
        for (const recipient of recipients) {
          if (!recipient.phone) continue;
          inputs.push({
            to: recipient.phone,
            body: `${body.title} : ${body.body}`.slice(0, 300),
            studentId: recipient.id,
            createdById: context.userId,
          });
        }
        if (inputs.length > 0) await sendSmsMessages(tenantId, inputs);
      }
    }

    return NextResponse.json({
      success: true,
      data: item,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
