import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { onlineExams } from '@/models/Schema';

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
      await recordAudit(context, 'create', 'online_exam', exam.id);
    }

    return NextResponse.json({
      success: true,
      data: exam,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
