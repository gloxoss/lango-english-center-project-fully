import type { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { passingScoreToPercentage } from '@/libs/grading/pass-threshold';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  classes,
  classSections,
  invoices,
  sections,
  sessionYears,
  user,
} from '@/models/Schema';

const MOROCCAN_PROGRESSION: string[] = [
  '1ère AP',
  '1AP',
  'CP',
  '2ème AP',
  '2AP',
  'CE1',
  '3ème AP',
  '3AP',
  'CE2',
  '4ème AP',
  '4AP',
  'CM1',
  '5ème AP',
  '5AP',
  'CM2',
  '6ème AP',
  '6AP',
  '1AC',
  '7ème',
  '2AC',
  '8ème',
  '3AC',
  '9ème',
  '3ème',
  'Tronc Commun',
  'TC',
  '2nde',
  '1BAC',
  '1ère',
  '2BAC',
  'Terminale',
];

function findNextClassName(currentClassName: string, availableClassNames: string[]): string | null {
  const normCurrent = currentClassName.trim().toLowerCase();

  // Find index in standard Moroccan progression
  const progIndex = MOROCCAN_PROGRESSION.findIndex(
    p => p.toLowerCase() === normCurrent,
  );

  if (progIndex !== -1) {
    // Look ahead in progression for the next available class in this school
    for (let i = progIndex + 1; i < MOROCCAN_PROGRESSION.length; i++) {
      const candidate = MOROCCAN_PROGRESSION[i]!.toLowerCase();
      const match = availableClassNames.find(c => c.trim().toLowerCase() === candidate);
      if (match) {
        return match;
      }
    }
  }

  // Fallback heuristic: find by cycle or alphabetical
  return null;
}

function recommend(
  avgPct: number | null,
  passThresholdPct: number,
  bulletinStatus: 'Admis' | 'Ajourné' | null,
): 'promote' | 'retain' | 'defer' {
  if (avgPct === null) {
    return 'defer';
  } // no grades recorded yet
  // The bulletin decision already applies the eliminatory mark; a student
  // above the pass mark but under an eliminatory subject mark is retained.
  if (bulletinStatus === 'Ajourné') {
    return 'retain';
  }
  if (avgPct >= passThresholdPct) {
    return 'promote';
  }
  return 'retain';
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.placements.manage');

    const { searchParams } = new URL(req.url);
    const sourceSectionId = searchParams.get('sourceSectionId');
    const targetSectionId = searchParams.get('targetSectionId');

    if (!sourceSectionId) {
      throw new ApiError(400, 'MISSING_PARAM', 'sourceSectionId requis.');
    }

    // The pass threshold is the tenant's stored grading policy
    // (academic.passThreshold — edited on /dashboard/academics/grading/policies,
    // shared with report cards). assessmentResults.finalPercentage is always a
    // 0-100 percentage, so the threshold goes through the one shared
    // conversion before comparing.
    const [{ value: passThresholdValue }, { value: gradingScaleValue }] = await Promise.all([
      getEffectiveValueWithLegacyFallback(tenantId, null, 'academic.passThreshold'),
      getEffectiveValueWithLegacyFallback(tenantId, null, 'academic.gradingScale'),
    ]);
    const gradingScale = gradingScaleValue === '100' ? '100' : '20';
    const passThresholdRaw = Number(passThresholdValue) || 10;
    const passThresholdPct = passingScoreToPercentage(passThresholdRaw, gradingScale);

    // 1. Fetch source class section details
    const [sourceSection] = await db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        cycle: classes.cycle,
        sectionName: sections.name,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(classSections.id, sourceSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!sourceSection) {
      throw new ApiError(404, 'NOT_FOUND', 'Section source introuvable.');
    }

    // 2. Fetch all class sections in tenant for progression mapping
    const allSections = await db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        sectionName: sections.name,
        cycle: classes.cycle,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(eq(classSections.tenantId, tenantId));

    const distinctClassNames = Array.from(new Set(allSections.map(s => s.className)));
    const nextClassName = findNextClassName(sourceSection.className, distinctClassNames);
    const isTerminalClass = !nextClassName && (
      sourceSection.className.toLowerCase().includes('term')
      || sourceSection.className.toLowerCase().includes('2bac')
    );

    const nextClassSections = nextClassName
      ? allSections.filter(s => s.className === nextClassName)
      : [];
    const currentClassSections = allSections.filter(s => s.className === sourceSection.className);

    // 3. All active students in the source section
    const students = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        userStatus: user.userStatus,
      })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, sourceSectionId),
      ));

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          sourceSection,
          nextClassName,
          isTerminalClass,
          passThreshold: passThresholdPct,
          gradingScale,
          passThresholdRaw,
          total: 0,
          toPromote: 0,
          toRetain: 0,
          toDefer: 0,
          borderlineCount: 0,
          availableSections: allSections,
        },
      });
    }

    const studentIds = students.map(s => s.id);

    // 4. Year result per student = the same computation as the bulletin
    // (coefficient-weighted, current class subjects, default session-year
    // window, stored pass mark AND eliminatory mark). Previously this averaged
    // every mark the student ever had, unweighted, across all years.
    const [year] = await db
      .select({ startDate: sessionYears.startDate, endDate: sessionYears.endDate })
      .from(sessionYears)
      .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
      .limit(1);
    const { cards } = await getClassReportCards(
      tenantId,
      sourceSection.id,
      year ? { termStart: year.startDate, termEnd: year.endDate } : {},
    );
    const cardByStudent = new Map(cards.map(c => [c.student.id, c]));
    const gradeMap = new Map<string, number | null>(
      studentIds.map((id) => {
        const card = cardByStudent.get(id);
        return [id, card && card.status !== null ? card.generalAverage * 5 : null];
      }),
    );
    const statusMap = new Map(studentIds.map(id => [id, cardByStudent.get(id)?.status ?? null]));

    // 5. Authoritative Finance ledger read: open invoices per student
    const studentInvoices = studentIds.length > 0
      ? await db
          .select({
            studentId: invoices.studentId,
            netAmount: invoices.netAmount,
            paidAmount: invoices.paidAmount,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              inArray(invoices.studentId, studentIds),
              inArray(invoices.status, ['pending', 'partial', 'overdue']),
            ),
          )
      : [];

    const unpaidBalanceByStudent = new Map<string, number>();
    for (const inv of studentInvoices) {
      const net = Number(inv.netAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const rem = Math.max(0, net - paid);
      if (rem > 0) {
        unpaidBalanceByStudent.set(inv.studentId, (unpaidBalanceByStudent.get(inv.studentId) || 0) + rem);
      }
    }

    // Default target section for repeaters: same section or first section of current class
    const defaultRepeatSectionId = sourceSection.id;

    // Default target section for promoted: matching section letter in next class if available, else first in next class
    const matchingPromoteSection = nextClassSections.find(s => s.sectionName === sourceSection.sectionName)
      ?? nextClassSections[0]
      ?? null;

    const preview = students.map((s) => {
      const avgPct = gradeMap.get(s.id) ?? null;
      const rec = recommend(avgPct, passThresholdPct, statusMap.get(s.id) ?? null);
      const grade20 = avgPct !== null ? Math.round((avgPct / 5) * 100) / 100 : null;

      // Borderline deliberation flag (within 1 point on /20 scale, e.g. 9.00 - 9.99/20)
      const isBorderline = avgPct !== null && avgPct >= (passThresholdPct - 5) && avgPct < passThresholdPct;

      const unpaidBalance = unpaidBalanceByStudent.get(s.id) || 0;
      const hasUnpaidFees = unpaidBalance > 0;

      let decision: 'promote' | 'repeat' | 'graduate' | 'hold' = 'hold';
      let recommendedTargetSectionId: string | null = null;

      if (rec === 'promote') {
        if (isTerminalClass) {
          decision = 'graduate';
          recommendedTargetSectionId = null;
        } else {
          decision = 'promote';
          recommendedTargetSectionId = targetSectionId || matchingPromoteSection?.id || null;
        }
      } else if (rec === 'retain') {
        decision = 'repeat';
        recommendedTargetSectionId = defaultRepeatSectionId;
      } else {
        decision = 'hold';
        recommendedTargetSectionId = null;
      }

      return {
        studentId: s.id,
        studentName: s.name,
        matricule: s.matricule,
        averagePercentage: avgPct !== null ? Math.round(avgPct * 100) / 100 : null,
        grade20,
        recommendation: rec,
        decision,
        recommendedTargetSectionId,
        isBorderline,
        currentStatus: s.userStatus,
        hasUnpaidFees,
        unpaidBalance,
      };
    });

    // Sort: promote first, retain second, defer last
    const order = { promote: 0, repeat: 1, graduate: 0, hold: 2 } as const;
    preview.sort((a, b) => order[a.decision] - order[b.decision]);

    return NextResponse.json({
      success: true,
      data: preview,
      meta: {
        sourceSection,
        nextClassName: nextClassName ?? null,
        isTerminalClass,
        targetSectionId: targetSectionId ?? null,
        passThreshold: passThresholdPct,
        gradingScale,
        passThresholdRaw,
        total: preview.length,
        toPromote: preview.filter(p => p.decision === 'promote' || p.decision === 'graduate').length,
        toRetain: preview.filter(p => p.decision === 'repeat').length,
        toDefer: preview.filter(p => p.decision === 'hold').length,
        borderlineCount: preview.filter(p => p.isBorderline).length,
        availableSections: allSections,
        nextClassSections,
        currentClassSections,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
