import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assignments, classSubjects } from '@/models/Schema';

const createAssignmentSchema = z.object({
  classSubjectId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  dueDate: z.string().min(1),
  maxScore: z.union([z.number(), z.string()]).transform(v => String(v)),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);

    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get('classSubjectId');

    const conditions = [eq(assignments.tenantId, tenantId)];
    if (classSubjectId) {
      conditions.push(eq(assignments.classSubjectId, classSubjectId));
    }

    const items = await db
      .select()
      .from(assignments)
      .where(and(...conditions))
      .orderBy(desc(assignments.createdAt));

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
    const body = await parseJson(request, createAssignmentSchema);

    // Validate classSubjectId belongs to tenant
    const [cs] = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(and(eq(classSubjects.id, body.classSubjectId), eq(classSubjects.tenantId, tenantId)))
      .limit(1);

    if (!cs) {
      throw new Error('Matière de classe non valide pour cet établissement.');
    }

    const [item] = await db
      .insert(assignments)
      .values({
        tenantId,
        classSubjectId: body.classSubjectId,
        title: body.title,
        description: body.description || null,
        dueDate: body.dueDate,
        maxScore: body.maxScore,
        createdById: context.userId,
      })
      .returning();

    if (item) {
      await recordAudit(context, 'create', 'assignment', item.id);
    }

    return NextResponse.json({
      success: true,
      data: item,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
