import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';

type HeadcountRow = {
  confirmed_arrivals: string;
  manual_unverified: string;
};

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const today = casablancaTodayIso();
    const branchFilter = context.branchId ? sql`AND u.branch_id = ${context.branchId}::uuid` : sql``;

    // A classroom mark alone is a presence signal, not a verified gate entry.
    // Any later exit overrides it; a later accepted entry starts a new stay.
    const result = await db.execute<HeadcountRow>(sql`
      WITH bounds AS (
        SELECT
          ((${today}::date::timestamp AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'UTC') AS start_at,
          ((((${today}::date + 1)::timestamp AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'UTC')) AS end_at,
          (now() AT TIME ZONE 'UTC') AS now_at
      ), eligible_students AS (
        SELECT u.id FROM "user" u
        WHERE u.tenant_id = ${tenantId}::uuid AND u.role = 'student' AND u.user_status = 'active'
          ${branchFilter}
      ), manual_latest AS (
        SELECT DISTINCT ON (a.student_id) a.student_id, a.status
        FROM attendance a
        JOIN eligible_students e ON e.id = a.student_id
        WHERE a.tenant_id = ${tenantId}::uuid
          AND a.date = ${today}::date AND a.is_voided = false
        ORDER BY a.student_id, a.updated_at DESC, a.created_at DESC, a.id DESC
      ), arrivals_raw AS (
        SELECT q.student_id, q.scanned_at AS at
        FROM attendance_scan_events q
        JOIN eligible_students e ON e.id = q.student_id
        CROSS JOIN bounds b
        WHERE q.tenant_id = ${tenantId}::uuid AND q.result_status = 'accepted'
          AND q.scanned_at >= b.start_at AND q.scanned_at < b.end_at AND q.scanned_at <= b.now_at
        UNION ALL
        SELECT g.student_id, g.scanned_at AS at
        FROM guard_gate_scan_events g
        JOIN eligible_students e ON e.id = g.student_id
        CROSS JOIN bounds b
        WHERE g.tenant_id = ${tenantId}::uuid AND g.subject_type = 'student'
          AND g.direction = 'entry' AND g.result_status = 'accepted'
          AND g.scanned_at >= b.start_at AND g.scanned_at < b.end_at AND g.scanned_at <= b.now_at
      ), arrivals AS (
        SELECT student_id, max(at) AS at FROM arrivals_raw GROUP BY student_id
      ), departures_raw AS (
        SELECT g.student_id, g.scanned_at AS at
        FROM guard_gate_scan_events g
        JOIN eligible_students e ON e.id = g.student_id
        CROSS JOIN bounds b
        WHERE g.tenant_id = ${tenantId}::uuid AND g.subject_type = 'student'
          AND g.direction = 'exit' AND g.result_status IN ('accepted', 'released')
          AND g.scanned_at >= b.start_at AND g.scanned_at < b.end_at AND g.scanned_at <= b.now_at
        UNION ALL
        SELECT r.student_id, r.released_at AS at
        FROM guard_release_events r
        JOIN eligible_students e ON e.id = r.student_id
        CROSS JOIN bounds b
        WHERE r.tenant_id = ${tenantId}::uuid
          AND r.released_at >= b.start_at AND r.released_at < b.end_at AND r.released_at <= b.now_at
      ), departures AS (
        SELECT student_id, max(at) AS at FROM departures_raw GROUP BY student_id
      ), evidence_students AS (
        SELECT student_id FROM manual_latest UNION SELECT student_id FROM arrivals
      )
      SELECT
        count(*) FILTER (WHERE ar.at IS NOT NULL AND (de.at IS NULL OR ar.at > de.at))::text AS confirmed_arrivals,
        count(*) FILTER (WHERE ar.at IS NULL AND de.at IS NULL AND ml.status IN ('present', 'late'))::text AS manual_unverified
      FROM evidence_students es
      LEFT JOIN manual_latest ml ON ml.student_id = es.student_id
      LEFT JOIN arrivals ar ON ar.student_id = es.student_id
      LEFT JOIN departures de ON de.student_id = es.student_id
    `);
    const row = result.rows[0];
    const confirmedArrivals = Number(row?.confirmed_arrivals ?? 0);
    const manualUnverified = Number(row?.manual_unverified ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        headcount: confirmedArrivals + manualUnverified,
        confirmedArrivals,
        manualUnverified,
        date: today,
        asOf: new Date().toISOString(),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
