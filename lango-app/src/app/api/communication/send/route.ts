/**
 * POST /api/communication/send
 *
 * Broadcast dispatcher: sends SMS (real via a configured provider, else log-only) or an announcement.
 *
 * Body shape:
 *   channel:      'sms' | 'announcement'
 *   recipientType: 'all' | 'section' | 'ids'
 *   recipientIds?: string[]     — user IDs for channel='sms' | 'ids'
 *   classSectionId?: string     — for recipientType='section'
 *   templateId?: string         — optional template to use as body
 *   title?: string              — required for channel='announcement'
 *   body: string                — message text
 *   targetRole?: string         — for announcement: restrict to role
 *
 * SMS goes through the shared send path: real when a provider connection exists,
 * honest log-only simulation otherwise.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { announcements, studentPlacements, user } from '@/models/Schema';
import { sendSmsMessages } from '@/features/broadcast/services/sms-delivery';

const sendSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('announcement'),
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1),
    targetRole: z.string().optional(),
    classSectionId: z.string().uuid().optional(),
  }),
  z.object({
    channel: z.literal('sms'),
    body: z.string().trim().min(1).max(1600),
    recipientType: z.enum(['all', 'section', 'ids']),
    recipientIds: z.array(z.string()).optional(),
    classSectionId: z.string().uuid().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'communication.send');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, sendSchema);

    if (body.channel === 'announcement') {
      const [inserted] = await db
        .insert(announcements)
        .values({
          tenantId,
          title: body.title,
          body: body.body,
          targetRole: (body.targetRole as any) ?? null,
          targetClassSectionId: body.classSectionId ?? null,
          createdById: ctx.userId,
        })
        .returning({ id: announcements.id });

      recordAudit(ctx, 'create', 'announcement', inserted!.id);
      return NextResponse.json({ success: true, data: { id: inserted!.id, channel: 'announcement', sent: 1 } }, { status: 201 });
    }

    // channel === 'sms' — resolve recipient phones
    let phones: { phone: string; studentId: string }[] = [];

    if (body.recipientType === 'all') {
      const rows = await db
        .select({ phone: user.phone, studentId: user.id })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));
      phones = rows.filter(r => !!r.phone) as typeof phones;
    } else if (body.recipientType === 'section' && body.classSectionId) {
      // Get currently enrolled students in the section, then fetch their phones
      const enrolled = await db
        .select({ studentId: studentPlacements.studentId })
        .from(studentPlacements)
        .where(and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.classSectionId, body.classSectionId),
          eq(studentPlacements.isCurrent, true),
        ));
      const studentIds = enrolled.map(e => e.studentId);
      if (studentIds.length > 0) {
        const rows = await db
          .select({ phone: user.phone, studentId: user.id })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), inArray(user.id, studentIds)));
        phones = rows.filter(r => !!r.phone) as typeof phones;
      }
    } else if (body.recipientType === 'ids' && body.recipientIds?.length) {
      const rows = await db
        .select({ phone: user.phone, studentId: user.id })
        .from(user)
        .where(and(eq(user.tenantId, tenantId)));
      const idSet = new Set(body.recipientIds);
      phones = rows.filter(r => idSet.has(r.studentId) && !!r.phone) as typeof phones;
    }

    if (phones.length === 0) {
      return NextResponse.json({ success: true, data: { channel: 'sms', sent: 0, warning: 'Aucun destinataire avec un numéro de téléphone trouvé.' } });
    }

    const results = await sendSmsMessages(tenantId, phones.map(p => ({
      to: p.phone,
      body: body.body,
      studentId: p.studentId,
      createdById: ctx.userId,
    })));

    const failed = results.filter(r => r.delivery === 'failed').length;
    const realSent = results.filter(r => r.delivery === 'sent' || r.delivery === 'delivered').length;

    recordAudit(ctx, 'create', 'sms_broadcast', ctx.userId, { count: phones.length, realSent, failed });
    return NextResponse.json({ success: true, data: { channel: 'sms', sent: phones.length, simulated: realSent === 0, realSent, failed } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
