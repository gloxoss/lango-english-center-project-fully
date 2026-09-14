import { and, avg, eq, inArray, isNull } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import {
  assessmentResults,
  classes,
  classSections,
  sections,
  sessionYears,
  user,
} from '@/models/Schema';

const autoPlacementSchema = z.object({
  sessionYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  classSectionIds: z.array(z.string().uuid()).optional(),
  method: z.enum(['random', 'balanced_headcount', 'gender_parity', 'academic_balance']).default('balanced_headcount'),
  studentIds: z.array(z.string()).optional(),
  targetClassSectionId: z.string().uuid().optional(),
  dryRun: z.boolean().default(false),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.placements.manage');

    const body = await parseJson(req, autoPlacementSchema);

    // 1. Resolve Session Year
    let targetSessionYearId = body.sessionYearId;
    if (!targetSessionYearId) {
      const [activeSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionYearId = activeSession?.id;
    }

    if (!targetSessionYearId) {
      throw new ApiError(422, 'MISSING_SESSION', 'Aucune année scolaire active trouvée.');
    }

    // 2. Resolve Target Sections
    const sectionConditions = [eq(classSections.tenantId, tenantId)];
    if (body.classId) {
      sectionConditions.push(eq(classSections.classId, body.classId));
    }
    if (body.classSectionIds && body.classSectionIds.length > 0) {
      sectionConditions.push(inArray(classSections.id, body.classSectionIds));
    }

    const targetSections = await db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        sectionName: sections.name,
        maxStudents: classSections.maxStudents,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(...sectionConditions));

    if (targetSections.length === 0) {
      throw new ApiError(422, 'NO_SECTIONS', 'Aucune section cible disponible pour l\'affectation.');
    }

    // 3. Resolve Students to Place
    const studentConditions = [
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
    ];

    if (body.studentIds && body.studentIds.length > 0) {
      studentConditions.push(inArray(user.id, body.studentIds));
    } else {
      // By default, select unplaced students (classSectionId is null)
      studentConditions.push(isNull(user.classSectionId));
    }

    const eligibleStudents = await db
      .select({
        id: user.id,
        name: user.name,
        matricule: user.matricule,
        gender: user.gender,
        classSectionId: user.classSectionId,
        className: user.className,
      })
      .from(user)
      .where(and(...studentConditions));

    if (eligibleStudents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          placedCount: 0,
          assignments: [],
          breakdown: {},
        },
        message: 'Aucun élève à affecter.',
      });
    }

    // 4. Count current students in each section
    const currentCounts = await db
      .select({
        classSectionId: user.classSectionId,
      })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    const sectionHeadcounts = new Map<string, number>();
    targetSections.forEach(s => sectionHeadcounts.set(s.id, 0));
    currentCounts.forEach(c => {
      if (c.classSectionId && sectionHeadcounts.has(c.classSectionId)) {
        sectionHeadcounts.set(c.classSectionId, (sectionHeadcounts.get(c.classSectionId) || 0) + 1);
      }
    });

    // 5. Distribution Strategy
    type Assignment = {
      studentId: string;
      studentName: string;
      matricule: string | null;
      gender: string | null;
      targetClassSectionId: string;
      targetClassName: string;
      targetSectionName: string;
      score?: number | null;
    };

    const assignments: Assignment[] = [];

    if (body.targetClassSectionId) {
      // Direct assignment into single selected section
      const targetSec = targetSections.find(s => s.id === body.targetClassSectionId);
      if (!targetSec) {
        throw new ApiError(404, 'SECTION_NOT_FOUND', 'Section cible spécifiée introuvable.');
      }
      for (const st of eligibleStudents) {
        assignments.push({
          studentId: st.id,
          studentName: st.name,
          matricule: st.matricule,
          gender: st.gender,
          targetClassSectionId: targetSec.id,
          targetClassName: targetSec.className,
          targetSectionName: targetSec.sectionName,
        });
      }
    } else if (body.method === 'gender_parity') {
      // Gender parity: split into males, females, and others, then distribute evenly
      const males = eligibleStudents.filter(s => s.gender === 'male');
      const females = eligibleStudents.filter(s => s.gender === 'female');
      const others = eligibleStudents.filter(s => s.gender !== 'male' && s.gender !== 'female');

      let secIdx = 0;
      const distributeGroup = (grp: typeof eligibleStudents) => {
        for (const st of grp) {
          const sec = targetSections[secIdx % targetSections.length]!;
          secIdx++;
          assignments.push({
            studentId: st.id,
            studentName: st.name,
            matricule: st.matricule,
            gender: st.gender,
            targetClassSectionId: sec.id,
            targetClassName: sec.className,
            targetSectionName: sec.sectionName,
          });
        }
      };

      distributeGroup(males);
      distributeGroup(females);
      distributeGroup(others);
    } else if (body.method === 'academic_balance') {
      // Academic GPA balance: fetch grades, sort students, and snake-draft across sections
      const studentIds = eligibleStudents.map(s => s.id);
      const gradeRows = await db
        .select({
          studentId: assessmentResults.studentId,
          avgPct: avg(assessmentResults.finalPercentage),
        })
        .from(assessmentResults)
        .where(and(
          eq(assessmentResults.tenantId, tenantId),
          inArray(assessmentResults.studentId, studentIds),
        ))
        .groupBy(assessmentResults.studentId);

      const gradeMap = new Map(gradeRows.map(r => [r.studentId, r.avgPct ? Number(r.avgPct) : 50]));

      const sortedStudents = [...eligibleStudents].sort((a, b) => {
        const gradeA = gradeMap.get(a.id) ?? 50;
        const gradeB = gradeMap.get(b.id) ?? 50;
        return gradeB - gradeA; // descending
      });

      // Snake-draft distribution: 0, 1, 2, 2, 1, 0, 0, 1, 2...
      const numSections = targetSections.length;
      sortedStudents.forEach((st, idx) => {
        const round = Math.floor(idx / numSections);
        const posInRound = idx % numSections;
        const secIndex = round % 2 === 0 ? posInRound : (numSections - 1 - posInRound);
        const sec = targetSections[secIndex]!;
        const avgScore = gradeMap.get(st.id) ?? null;

        assignments.push({
          studentId: st.id,
          studentName: st.name,
          matricule: st.matricule,
          gender: st.gender,
          targetClassSectionId: sec.id,
          targetClassName: sec.className,
          targetSectionName: sec.sectionName,
          score: avgScore !== null ? Math.round((avgScore / 5) * 100) / 100 : null,
        });
      });
    } else {
      // Default: balanced headcount / random
      const workingCounts = new Map(sectionHeadcounts);
      // Shuffle students if random
      const studentsToDistribute = body.method === 'random'
        ? [...eligibleStudents].sort(() => Math.random() - 0.5)
        : [...eligibleStudents];

      for (const st of studentsToDistribute) {
        // Pick section with lowest headcount that hasn't exceeded max
        let bestSec = targetSections[0]!;
        let lowestCount = Infinity;

        for (const sec of targetSections) {
          const current = workingCounts.get(sec.id) || 0;
          if (current < lowestCount) {
            lowestCount = current;
            bestSec = sec;
          }
        }

        workingCounts.set(bestSec.id, (workingCounts.get(bestSec.id) || 0) + 1);
        assignments.push({
          studentId: st.id,
          studentName: st.name,
          matricule: st.matricule,
          gender: st.gender,
          targetClassSectionId: bestSec.id,
          targetClassName: bestSec.className,
          targetSectionName: bestSec.sectionName,
        });
      }
    }

    // 6. Section Breakdown Summary
    const breakdown: Record<string, { className: string; sectionName: string; count: number }> = {};
    for (const a of assignments) {
      if (!breakdown[a.targetClassSectionId]) {
        breakdown[a.targetClassSectionId] = {
          className: a.targetClassName,
          sectionName: a.targetSectionName,
          count: 0,
        };
      }
      breakdown[a.targetClassSectionId]!.count++;
    }

    // 7. Commit Placements (if not dryRun)
    if (!body.dryRun) {
      for (const a of assignments) {
        await recordStudentPlacement({
          tenantId,
          studentId: a.studentId,
          sessionYearId: targetSessionYearId,
          classSectionId: a.targetClassSectionId,
          notes: `Affectation automatique (${body.method})`,
        });
      }

      recordAudit(ctx, 'create', 'student_placements_auto', targetSessionYearId, {
        totalPlaced: assignments.length,
        method: body.method,
        breakdown,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isDryRun: body.dryRun,
        placedCount: assignments.length,
        method: body.method,
        breakdown,
        assignments,
      },
      message: body.dryRun
        ? `Simulation prête : ${assignments.length} élève(s) réparti(s).`
        : `${assignments.length} élève(s) affecté(s) avec succès.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
