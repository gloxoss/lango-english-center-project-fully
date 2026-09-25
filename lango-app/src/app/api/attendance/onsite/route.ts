import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { classes, classSections } from '@/models/Schema';

type HeadcountRow = {
  confirmed_arrivals: string;
  manual_unverified: string;
};

type SectionArrivalRow = {
  student_id: string;
  name: string;
  arrived_at: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');
    const today = casablancaTodayIso();
    const branchFilter = context.branchId ? sql`AND u.branch_id = ${context.branchId}::uuid` : sql``;

    // OPTIONAL SECTION DETAIL. The teacher's screen needs to know WHICH students
    // of its own section have reached the campus, not just how many people are
    // in the building. Absent the parameter the response is byte-for-byte what
    // it always was, because the campus-wide count and the section list are
    // different questions and only one of them is asked here.
    const classSectionId = new URL(request.url).searchParams.get('classSectionId');
    const sectionArrivals = classSectionId
      ? await loadSectionArrivals(tenantId, context.branchId, classSectionId, today, branchFilter)
      : null;

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
        // Only present when `?classSectionId=` was asked for. Everything above
        // is unchanged either way.
        ...(sectionArrivals ? { students: sectionArrivals } : {}),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * WHO, not how many. The campus headcount above answers "is the school full";
 * a classroom register needs "has Aya reached the building yet", which is a
 * different question with a different answer.
 *
 * Only students who genuinely produced an arrival signal appear, so the caller
 * can never read "absent from this list" as "absent from school" without
 * meaning to. The section is verified to belong to the caller's tenant (and to
 * their campus when they are campus-limited) before anything is read.
 */
async function loadSectionArrivals(
  tenantId: string,
  branchId: string | null,
  classSectionId: string,
  today: string,
  branchFilter: ReturnType<typeof sql>,
) {
  if (!UUID_PATTERN.test(classSectionId)) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'Section de classe invalide.');
  }

  const [section] = await db
    .select({ id: classSections.id, branchId: classes.branchId })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);

  if (!section) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'Section de classe introuvable pour cet établissement.');
  }
  if (branchId && section.branchId !== branchId) {
    throw new ApiError(403, 'FORBIDDEN', 'Cette section appartient à un autre campus.');
  }

  // Same two evidence sources as the headcount, and the same day bounds in the
  // school's own timezone: a badge read at 23:50 Casablanca belongs to that day.
  const result = await db.execute<SectionArrivalRow>(sql`
    WITH bounds AS (
      SELECT
        ((${today}::date::timestamp AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'UTC') AS start_at,
        ((((${today}::date + 1)::timestamp AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'UTC')) AS end_at,
        (now() AT TIME ZONE 'UTC') AS now_at
    ), roster AS (
      SELECT u.id, u.name FROM "user" u
      WHERE u.tenant_id = ${tenantId}::uuid AND u.role = 'student' AND u.user_status = 'active'
        AND u.class_section_id = ${classSectionId}::uuid
        ${branchFilter}
    ), arrivals_raw AS (
      SELECT q.student_id, q.scanned_at AS at
      FROM attendance_scan_events q
      JOIN roster r ON r.id = q.student_id
      CROSS JOIN bounds b
      WHERE q.tenant_id = ${tenantId}::uuid AND q.result_status = 'accepted'
        AND q.scanned_at >= b.start_at AND q.scanned_at < b.end_at AND q.scanned_at <= b.now_at
      UNION ALL
      SELECT g.student_id, g.scanned_at AS at
      FROM guard_gate_scan_events g
      JOIN roster r ON r.id = g.student_id
      CROSS JOIN bounds b
      WHERE g.tenant_id = ${tenantId}::uuid AND g.subject_type = 'student'
        AND g.direction = 'entry' AND g.result_status = 'accepted'
        AND g.scanned_at >= b.start_at AND g.scanned_at < b.end_at AND g.scanned_at <= b.now_at
    )
    SELECT
      r.id AS student_id,
      r.name,
      -- Explicit UTC, never the session's timezone: the database runs on
      -- Africa/Casablanca, so a bare ::text would hand the caller a local wall
      -- clock string that parses as an instant one hour earlier.
      to_char(min(a.at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS arrived_at
    FROM roster r
    JOIN arrivals_raw a ON a.student_id = r.id
    GROUP BY r.id, r.name
    ORDER BY r.name
  `);

  return result.rows.map(row => ({
    studentId: row.student_id,
    name: row.name,
    // The FIRST time the student was seen on campus today, not the last: a
    // student who badges in at 08:00 and again at 14:00 arrived at 08:00.
    arrivedAt: row.arrived_at ? new Date(row.arrived_at).toISOString() : null,
  }));
}
