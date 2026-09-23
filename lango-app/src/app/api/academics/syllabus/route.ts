import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { classSubjects, classSubjectSyllabi } from '@/models/Schema';
import type { Chapter } from '@/features/academics/data/syllabus-config';

// ponytail: self-healing DDL so syllabus tables exist without manual migrations
async function ensureSyllabusTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS class_subject_syllabi (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      class_subject_id UUID NOT NULL,
      chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT class_subject_syllabi_tenant_subj_uq UNIQUE (tenant_id, class_subject_id)
    );
  `);
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get('classSubjectId');

    if (!classSubjectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'classSubjectId est requis.');
    }

    // Verify class-subject belongs to this tenant
    const [subjectOffering] = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(and(eq(classSubjects.id, classSubjectId), eq(classSubjects.tenantId, tenantId)))
      .limit(1);

    if (!subjectOffering) {
      throw new ApiError(404, 'NOT_FOUND', 'Matière de classe introuvable.');
    }

    await ensureSyllabusTable();

    const [syllabus] = await db
      .select()
      .from(classSubjectSyllabi)
      .where(and(eq(classSubjectSyllabi.tenantId, tenantId), eq(classSubjectSyllabi.classSubjectId, classSubjectId)))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        classSubjectId,
        chapters: (syllabus?.chapters ?? []) as Chapter[],
        updatedAt: syllabus?.updatedAt ?? null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const body = await request.json().catch(() => ({}));
    const { classSubjectId, chapters } = body as { classSubjectId?: string; chapters?: Chapter[] };

    if (!classSubjectId || !Array.isArray(chapters)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'classSubjectId et un tableau de chapitres sont requis.');
    }

    // Tenant isolation verification
    const [subjectOffering] = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(and(eq(classSubjects.id, classSubjectId), eq(classSubjects.tenantId, tenantId)))
      .limit(1);

    if (!subjectOffering) {
      throw new ApiError(404, 'NOT_FOUND', 'Matière de classe introuvable.');
    }

    await ensureSyllabusTable();

    const now = new Date().toISOString();
    await db
      .insert(classSubjectSyllabi)
      .values({
        tenantId,
        classSubjectId,
        chapters,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [classSubjectSyllabi.tenantId, classSubjectSyllabi.classSubjectId],
        set: {
          chapters,
          updatedAt: now,
        },
      });

    recordAudit(
      context,
      'update',
      'class_subject_syllabi',
      classSubjectId,
      { chaptersCount: chapters.length },
    );

    return NextResponse.json({
      success: true,
      data: {
        classSubjectId,
        chapters,
        updatedAt: now,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
