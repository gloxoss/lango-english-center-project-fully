import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { issuedDocuments } from '@/features/cards/models/cards-schema';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/report-cards — list officially issued report cards (bulletins)
// for the session student. Scoped strictly by studentId and tenantId.
// Only status = 'active' and revokedAt IS NULL are returned.
// Safe projection from render_data_snapshot only. Newest first.

export async function GET(request: Request) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;

    const rows = await db
      .select({
        id: issuedDocuments.id,
        issuedAt: issuedDocuments.issuedAt,
        renderDataSnapshot: issuedDocuments.renderDataSnapshot,
      })
      .from(issuedDocuments)
      .where(
        and(
          eq(issuedDocuments.tenantId, tenantId),
          eq(issuedDocuments.type, 'report_card'),
          eq(issuedDocuments.subjectId, studentId),
          eq(issuedDocuments.status, 'active'),
          isNull(issuedDocuments.revokedAt),
        ),
      )
      .orderBy(desc(issuedDocuments.issuedAt));

    const data = rows.map((row) => {
      const snap = (row.renderDataSnapshot ?? {}) as Record<string, any>;

      let generalAverage: number | null = null;
      if (typeof snap.generalAverageValue === 'number' || typeof snap.generalAverageValue === 'string') {
        const val = Number(snap.generalAverageValue);
        if (Number.isFinite(val)) generalAverage = val;
      } else if (typeof snap.generalAverage === 'number') {
        generalAverage = snap.generalAverage;
      } else if (typeof snap.generalAverage === 'string') {
        const match = snap.generalAverage.match(/(\d+(?:\.\d+)?)/);
        if (match) generalAverage = Number(match[1]);
      }

      let mention: string | null = snap.mention ?? null;
      if (typeof mention === 'string') {
        mention = mention.replace(/^Mention\s*:\s*/i, '').trim() || null;
      }

      let decision: string | null = snap.decision ?? snap.status ?? null;
      if (!decision && generalAverage !== null) {
        decision = generalAverage >= 10 ? 'Admis' : 'Ajourné';
      }

      let rank: number | null = null;
      let classSize: number | null = null;
      if (typeof snap.rankValue === 'number' || typeof snap.rankValue === 'string') {
        const val = Number(snap.rankValue);
        if (Number.isFinite(val)) rank = val;
      }
      if (typeof snap.classSize === 'number' || typeof snap.classSize === 'string') {
        const val = Number(snap.classSize);
        if (Number.isFinite(val)) classSize = val;
      }
      if (typeof snap.rank === 'string') {
        const match = snap.rank.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          if (rank === null) rank = Number(match[1]);
          if (classSize === null) classSize = Number(match[2]);
        } else {
          const singleMatch = snap.rank.match(/(\d+)/);
          if (singleMatch && rank === null) rank = Number(singleMatch[1]);
        }
      }

      const termLabel = snap.termLabel ?? snap.term ?? snap.title ?? 'Bulletin scolaire';
      const schoolYear = snap.schoolYear ?? snap.year ?? snap.className ?? null;

      return {
        id: row.id,
        termLabel,
        schoolYear,
        generalAverage,
        mention,
        decision,
        rank,
        classSize,
        issuedDate: row.issuedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
