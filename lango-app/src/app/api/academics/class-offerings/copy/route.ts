import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  auditLogs,
  classSubjects,
  classTeachers,
  sessionYears,
  subjectTeachers,
} from '@/models/Schema';

export const copySessionSetupSchema = z.object({
  sourceSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session source est requis.' }),
  targetSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session cible est requis.' }),
  mode: z.enum(['preview', 'commit']),
  idempotencyKey: z.string().optional(),
}).strict().refine((data) => data.sourceSessionYearId !== data.targetSessionYearId, {
  message: 'La session source et la session cible doivent être différentes.',
  path: ['targetSessionYearId'],
}).refine((data) => data.mode !== 'commit' || (data.idempotencyKey && data.idempotencyKey.length > 0), {
  message: 'Une clé d\'idempotence est requise pour confirmer la copie.',
  path: ['idempotencyKey'],
});

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, copySessionSetupSchema);

    // Validate sessions belong to tenant
    const [sourceSession] = await db
      .select({ id: sessionYears.id, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.sourceSessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!sourceSession) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session source est introuvable pour cet établissement.');
    }

    const [targetSession] = await db
      .select({ id: sessionYears.id, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.targetSessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!targetSession) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session cible est introuvable pour cet établissement.');
    }

    // Idempotency check for commit mode
    if (body.mode === 'commit' && body.idempotencyKey) {
      const copyEntityId = `${body.sourceSessionYearId}:${body.targetSessionYearId}:${body.idempotencyKey}`;
      const [existingAudit] = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.action, 'create'),
          eq(auditLogs.entityType, 'academic_class_offering_copy'),
          eq(auditLogs.entityId, copyEntityId),
        ))
        .limit(1);

      if (existingAudit) {
        return NextResponse.json({
          success: true,
          mode: 'commit',
          idempotent: true,
          message: 'La configuration a déjà été copiée vers cette session avec la même clé d\'idempotence.',
        });
      }
    }

    // Fetch active offerings from source session
    const sourceOfferings = await db
      .select()
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, body.sourceSessionYearId),
        eq(academicClassOfferings.status, 'active'),
      ));

    if (sourceOfferings.length === 0) {
      throw new ApiError(400, 'BAD_REQUEST', 'La session source ne contient aucune offre de classe active.');
    }

    // Fetch existing offerings in target session
    const targetOfferings = await db
      .select()
      .from(academicClassOfferings)
      .where(and(
        eq(academicClassOfferings.tenantId, tenantId),
        eq(academicClassOfferings.sessionYearId, body.targetSessionYearId),
      ));

    const existingTargetKeyMap = new Set(
      targetOfferings.map((o) => `${o.classId}:${o.sectionId}`)
    );

    const offeringsToCreate = sourceOfferings.filter(
      (o) => !existingTargetKeyMap.has(`${o.classId}:${o.sectionId}`)
    );
    const offeringsSkippedCount = sourceOfferings.length - offeringsToCreate.length;

    const sourceOfferingIds = sourceOfferings.map((o) => o.id);

    // Fetch linked classSubjects for source offerings
    const linkedSubjects = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(classSubjects)
          .where(and(
            eq(classSubjects.tenantId, tenantId),
            inArray(classSubjects.offeringId, sourceOfferingIds),
          ))
      : [];

    // Fetch linked classTeachers for source offerings
    const linkedClassTeachers = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(classTeachers)
          .where(and(
            eq(classTeachers.tenantId, tenantId),
            inArray(classTeachers.offeringId, sourceOfferingIds),
          ))
      : [];

    // Fetch linked subjectTeachers for source offerings
    const linkedSubjectTeachers = sourceOfferingIds.length > 0
      ? await db
          .select()
          .from(subjectTeachers)
          .where(and(
            eq(subjectTeachers.tenantId, tenantId),
            inArray(subjectTeachers.offeringId, sourceOfferingIds),
          ))
      : [];

    if (body.mode === 'preview') {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        summary: {
          sourceSessionName: sourceSession.name,
          targetSessionName: targetSession.name,
          sourceOfferingsCount: sourceOfferings.length,
          offeringsToCreateCount: offeringsToCreate.length,
          offeringsSkippedCount,
          classSubjectsToCreateCount: linkedSubjects.length,
          classTeachersToCreateCount: linkedClassTeachers.length,
          subjectTeachersToCreateCount: linkedSubjectTeachers.length,
        },
      });
    }

    // COMMIT MODE: Execute transactional copy
    const resultSummary = await db.transaction(async (tx) => {
      const createdOfferingMap = new Map<string, string>(); // sourceOfferingId -> targetOfferingId

      // Map existing target offerings first
      for (const targetOff of targetOfferings) {
        const sourceMatching = sourceOfferings.find(
          (so) => so.classId === targetOff.classId && so.sectionId === targetOff.sectionId
        );
        if (sourceMatching) {
          createdOfferingMap.set(sourceMatching.id, targetOff.id);
        }
      }

      // Insert new target offerings
      for (const offToCreate of offeringsToCreate) {
        const [inserted] = await tx
          .insert(academicClassOfferings)
          .values({
            tenantId,
            sessionYearId: body.targetSessionYearId,
            classId: offToCreate.classId,
            sectionId: offToCreate.sectionId,
            capacity: offToCreate.capacity,
            status: 'active',
            displayOrder: offToCreate.displayOrder,
          })
          .returning();

        createdOfferingMap.set(offToCreate.id, inserted!.id);
      }

      let createdSubjectsCount = 0;
      let createdClassTeachersCount = 0;
      let createdSubjectTeachersCount = 0;

      // Copy classSubjects
      for (const subj of linkedSubjects) {
        if (!subj.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(subj.offeringId);
        if (!targetOfferingId) continue;

        await tx.insert(classSubjects).values({
          tenantId,
          classId: subj.classId,
          subjectId: subj.subjectId,
          type: subj.type,
          semesterId: subj.semesterId,
          offeringId: targetOfferingId,
        });
        createdSubjectsCount++;
      }

      // Copy classTeachers
      for (const ct of linkedClassTeachers) {
        if (!ct.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(ct.offeringId);
        if (!targetOfferingId) continue;

        await tx.insert(classTeachers).values({
          tenantId,
          classSectionId: ct.classSectionId,
          teacherId: ct.teacherId,
          offeringId: targetOfferingId,
        });
        createdClassTeachersCount++;
      }

      // Copy subjectTeachers
      for (const st of linkedSubjectTeachers) {
        if (!st.offeringId) continue;
        const targetOfferingId = createdOfferingMap.get(st.offeringId);
        if (!targetOfferingId) continue;

        // Ensure linked classSubject has been created or matched
        const targetClassSubj = await tx
          .select({ id: classSubjects.id })
          .from(classSubjects)
          .where(and(
            eq(classSubjects.tenantId, tenantId),
            eq(classSubjects.offeringId, targetOfferingId),
            eq(classSubjects.subjectId, st.subjectId),
          ))
          .limit(1);

        if (targetClassSubj.length > 0) {
          await tx.insert(subjectTeachers).values({
            tenantId,
            classSectionId: st.classSectionId,
            subjectId: st.subjectId,
            classSubjectId: targetClassSubj[0]!.id,
            teacherId: st.teacherId,
            offeringId: targetOfferingId,
          });
          createdSubjectTeachersCount++;
        }
      }

      recordAudit(
        context,
        'create',
        'academic_class_offering_copy',
        `${body.sourceSessionYearId}:${body.targetSessionYearId}:${body.idempotencyKey}`,
        {
          sourceSessionYearId: body.sourceSessionYearId,
          targetSessionYearId: body.targetSessionYearId,
          idempotencyKey: body.idempotencyKey,
        }
      );

      return {
        sourceSessionName: sourceSession.name,
        targetSessionName: targetSession.name,
        offeringsCreated: offeringsToCreate.length,
        offeringsSkipped: offeringsSkippedCount,
        classSubjectsCreated: createdSubjectsCount,
        classTeachersCreated: createdClassTeachersCount,
        subjectTeachersCreated: createdSubjectTeachersCount,
      };
    });

    return NextResponse.json({
      success: true,
      mode: 'commit',
      data: resultSummary,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
