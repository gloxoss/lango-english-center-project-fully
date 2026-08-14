import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, classSubjects, onlineExams, user } from '@/models/Schema';

const createExamSchema = z.object({
  classSubjectId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.union([z.number(), z.string()]).transform(v => String(v)),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    // Real audience scoping (future-implementation/assessment-and-examination
    // remediation, section-01): a student only sees online exams for their
    // own real class, resolved via user.classSectionId -> classSections.classId
    // -> classSubjects.classId. Previously tenant-scoped only, so any student
    // saw every online exam in the school. Staff still see the full tenant list.
    if (context.role === 'student') {
      const [me] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, context.userId)).limit(1);
      if (!me?.classSectionId) {
        return NextResponse.json({ success: true, data: [] });
      }
      const [section] = await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, me.classSectionId)).limit(1);
      if (!section) {
        return NextResponse.json({ success: true, data: [] });
      }
      const myClassSubjectIds = await db.select({ id: classSubjects.id }).from(classSubjects).where(eq(classSubjects.classId, section.classId));
      const ids = myClassSubjectIds.map(c => c.id);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      const items = await db
        .select()
        .from(onlineExams)
        .where(and(eq(onlineExams.tenantId, tenantId), inArray(onlineExams.classSubjectId, ids)))
        .orderBy(desc(onlineExams.createdAt));
      return NextResponse.json({ success: true, data: items });
    }

    const items = await db
      .select()
      .from(onlineExams)
      .where(eq(onlineExams.tenantId, tenantId))
      .orderBy(desc(onlineExams.createdAt));

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createExamSchema);

    const [exam] = await db
      .insert(onlineExams)
      .values({
        tenantId,
        classSubjectId: body.classSubjectId,
        title: body.title,
        durationMinutes: body.durationMinutes,
        totalMarks: body.totalMarks,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        createdById: context.userId,
      })
      .returning();

    if (exam) {
      recordAudit(context, 'create', 'online_exam', exam.id);
    }

    return NextResponse.json({
      success: true,
      data: exam,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
