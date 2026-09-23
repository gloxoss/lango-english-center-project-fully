import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { parseJson } from '@/libs/api/validation';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { assertAndConsumeWhatsAppQuota } from '@/features/broadcast/services/whatsapp-anti-spam-service';
import { recordAudit } from '@/libs/api/audit';
import { z } from 'zod';

type AudienceRow = {
  eligible_count: number;
  contactable_count: number;
  recipients: Array<{
    studentId: string;
    studentName: string;
    className: string;
    phone: string;
    phoneOwner: 'parent';
    guardianName: string;
    riskLevel: string | null;
  }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reminderSendSchema = z.object({
  studentId: z.string().min(1).max(100),
  recipientPhone: z.string().trim().min(1).max(50),
  body: z.string().trim().min(1).max(1000),
  channel: z.enum(['sms', 'whatsapp']),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'communication.send');
    const params = new URL(request.url).searchParams;
    const mode = params.get('mode') ?? 'atRisk';
    const classSectionId = params.get('classSectionId');
    const page = Number(params.get('page') ?? '1');
    const pageSize = Number(params.get('pageSize') ?? '100');
    if (!['atRisk', 'all'].includes(mode) ||
        (classSectionId && !UUID.test(classSectionId)) ||
        !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'INVALID_QUERY', 'Filtre ou pagination invalide.');
    }

    const today = casablancaTodayIso();
    const branchFilter = context.branchId ? sql`AND u.branch_id = ${context.branchId}::uuid` : sql``;
    const classFilter = classSectionId ? sql`AND u.class_section_id = ${classSectionId}::uuid` : sql``;
    const riskFilter = mode === 'atRisk' ? sql`WHERE absent_days >= 2 OR overdue_count > 0` : sql``;
    const result = await db.execute<AudienceRow>(sql`
      WITH base AS (
        SELECT u.id, u.name, u.class_section_id,
          coalesce(nullif(concat_ws(' ', c.name, s.name), ''), 'Sans classe') AS class_name
        FROM "user" u
        LEFT JOIN class_sections cs ON cs.id = u.class_section_id AND cs.tenant_id = ${tenantId}::uuid
        LEFT JOIN classes c ON c.id = cs.class_id AND c.tenant_id = ${tenantId}::uuid
        LEFT JOIN sections s ON s.id = cs.section_id AND s.tenant_id = ${tenantId}::uuid
        WHERE u.tenant_id = ${tenantId}::uuid AND u.role = 'student' AND u.user_status = 'active'
          ${branchFilter} ${classFilter}
      ), risk AS (
        SELECT b.*,
          (SELECT count(DISTINCT a.date)::int FROM attendance a
           WHERE a.tenant_id = ${tenantId}::uuid AND a.student_id = b.id
             AND a.status = 'absent' AND a.is_voided = false
             AND a.date >= ${today}::date - 30 AND a.date <= ${today}::date
             AND NOT EXISTS (
               SELECT 1 FROM attendance_excuses ex
               WHERE ex.tenant_id = ${tenantId}::uuid AND ex.student_id = b.id
                 AND ex.date = a.date AND ex.status = 'approved'
             )) AS absent_days,
          (SELECT count(*)::int FROM invoices i
           WHERE i.tenant_id = ${tenantId}::uuid AND i.student_id = b.id
             AND i.due_date < ${today}::date
             AND i.status IN ('pending', 'partial', 'overdue')
             AND i.net_amount > i.paid_amount) AS overdue_count
        FROM base b
      ), audience AS (
        SELECT * FROM risk ${riskFilter}
      ), contacts AS (
        SELECT a.*, g.first_name, g.last_name, g.phone
        FROM audience a
        JOIN LATERAL (
          SELECT g.first_name, g.last_name, g.phone
          FROM guardian_students gs
          JOIN guardians g ON g.id = gs.guardian_id AND g.tenant_id = ${tenantId}::uuid
          WHERE gs.tenant_id = ${tenantId}::uuid AND gs.student_id = a.id
            AND gs.status = 'active' AND gs.can_access_communication = true
            AND gs.custody_restriction IS NULL AND gs.sensitive_contact_hidden = false
            AND (gs.effective_from IS NULL OR gs.effective_from <= now())
            AND (gs.effective_to IS NULL OR gs.effective_to > now())
            AND g.sms_opt_in = true AND nullif(trim(g.phone), '') IS NOT NULL
          ORDER BY gs.is_primary_contact DESC, gs.id
          LIMIT 1
        ) g ON true
      ), page_rows AS (
        SELECT * FROM contacts ORDER BY name, id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      )
      SELECT
        (SELECT count(*)::int FROM audience) AS eligible_count,
        (SELECT count(*)::int FROM contacts) AS contactable_count,
        coalesce((SELECT json_agg(json_build_object(
          'studentId', id, 'studentName', name, 'className', class_name,
          'phone', phone, 'phoneOwner', 'parent',
          'guardianName', concat_ws(' ', first_name, last_name),
          'riskLevel', CASE WHEN absent_days >= 2 AND overdue_count > 0 THEN 'Absences et impayés'
                            WHEN absent_days >= 2 THEN 'Absences répétées'
                            WHEN overdue_count > 0 THEN 'Impayés' ELSE NULL END
        ) ORDER BY name, id) FROM page_rows), '[]'::json) AS recipients
    `);
    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: row?.recipients ?? [],
      total: row?.contactable_count ?? 0,
      eligibleCount: row?.eligible_count ?? 0,
      page,
      pageSize,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'communication.send');
    const body = await parseJson(request, reminderSendSchema);
    const today = casablancaTodayIso();
    const branchFilter = context.branchId ? sql`AND u.branch_id = ${context.branchId}::uuid` : sql``;

    // A preview can outlive a custody change, consent withdrawal or payment.
    // Recheck all three before each outbound message.
    const result = await db.execute<{ phone: string }>(sql`
      SELECT g.phone
      FROM "user" u
      JOIN guardian_students gs ON gs.student_id = u.id AND gs.tenant_id = ${tenantId}::uuid
      JOIN guardians g ON g.id = gs.guardian_id AND g.tenant_id = ${tenantId}::uuid
      WHERE u.id = ${body.studentId} AND u.tenant_id = ${tenantId}::uuid
        AND u.role = 'student' AND u.user_status = 'active' ${branchFilter}
        AND gs.status = 'active' AND gs.can_access_communication = true
        AND gs.custody_restriction IS NULL AND gs.sensitive_contact_hidden = false
        AND (gs.effective_from IS NULL OR gs.effective_from <= now())
        AND (gs.effective_to IS NULL OR gs.effective_to > now())
        AND g.sms_opt_in = true AND nullif(trim(g.phone), '') IS NOT NULL
        AND (
          (SELECT count(DISTINCT a.date) FROM attendance a
           WHERE a.tenant_id = ${tenantId}::uuid AND a.student_id = u.id
             AND a.status = 'absent' AND a.is_voided = false
             AND a.date >= ${today}::date - 30 AND a.date <= ${today}::date
             AND NOT EXISTS (
               SELECT 1 FROM attendance_excuses ex
               WHERE ex.tenant_id = ${tenantId}::uuid AND ex.student_id = u.id
                 AND ex.date = a.date AND ex.status = 'approved'
             )) >= 2
          OR EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.tenant_id = ${tenantId}::uuid AND i.student_id = u.id
              AND i.due_date < ${today}::date
              AND i.status IN ('pending', 'partial', 'overdue')
              AND i.net_amount > i.paid_amount
          )
        )
    `);
    const recipient = normalizeMoroccanPhone(body.recipientPhone);
    if (!result.rows.some((row) => normalizeMoroccanPhone(row.phone) === recipient)) {
      throw new ApiError(409, 'REMINDER_ELIGIBILITY_CHANGED', 'Le risque ou le droit de contact a changé. Actualisez les destinataires.');
    }

    const quota = body.channel === 'whatsapp' ? await assertAndConsumeWhatsAppQuota(tenantId, 1) : undefined;
    const sent = await sendSmsMessage(tenantId, {
      to: recipient,
      body: body.body,
      studentId: body.studentId,
      createdById: context.userId,
      channel: body.channel,
    }, body.channel);
    recordAudit(context, 'create', 'sms_message', sent.id);
    return NextResponse.json({
      success: true,
      data: { id: sent.id, delivery: sent.delivery, provider: sent.provider, quota },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
