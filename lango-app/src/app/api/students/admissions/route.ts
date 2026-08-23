import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { hashSetupToken } from '@/libs/setup-token';
import { parseJson } from '@/libs/api/validation';
import { copyUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { reserveMatricule } from '@/libs/services/matricule';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import {
  account, accountSetupTokens, applicantDocuments, applicants, guardians, guardianStudents,
  smsMessages, studentDocuments, user,
} from '@/models/Schema';

const applicantCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().trim().min(1).max(50),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().trim().max(255).optional(),
  guardianPhone: z.string().trim().max(50).optional(),
  guardianEmail: z.string().email().max(255).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  nationality: z.string().max(100).optional(),
  motherTongue: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  bloodGroup: z.string().max(10).optional(),
  academicYearId: z.string().uuid().optional(),
}).strict();

// Editable fields on an already-created, still-pending applicant. Separate
// from the PUT status-transition handler below - PATCH never touches status.
const applicantPatchSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(255).optional(),
  lastName: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().trim().max(255).optional(),
  guardianPhone: z.string().trim().max(50).optional(),
  guardianEmail: z.string().email().max(255).optional(),
  occupation: z.string().trim().max(255).optional(),
  address: z.string().trim().max(1000).optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  preferredLanguage: z.string().max(10).optional(),
  guardianId: z.string().uuid().optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  nationality: z.string().max(100).optional(),
  motherTongue: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  bloodGroup: z.string().max(10).optional(),
  academicYearId: z.string().uuid().optional(),
}).strict();

const applicantUpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['applied', 'approved', 'rejected', 'in_review']),
  classSectionId: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.view');

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const rows = await db
      .select()
      .from(applicants)
      .where(
        statusFilter
          ? and(eq(applicants.tenantId, tenantId), eq(applicants.status, statusFilter))
          : eq(applicants.tenantId, tenantId),
      );

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, applicantCreateSchema);

    // campaignId/targetProgramId intentionally omitted - see the comment on
    // applicants.campaignId in Schema.ts. Direct applicant entry, no campaign.
    const [inserted] = await db
      .insert(applicants)
      .values({
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        guardianEmail: body.guardianEmail,
        gender: body.gender,
        nationality: body.nationality,
        motherTongue: body.motherTongue,
        city: body.city,
        bloodGroup: body.bloodGroup,
        academicYearId: body.academicYearId,
        status: 'applied',
      })
      .returning();

    recordAudit(context, 'create', 'admission_request', inserted!.id);

    return NextResponse.json({
      success: true,
      data: inserted,
      message: 'Demande d\'admission créée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, applicantPatchSchema);

    const [existing] = await db
      .select({ id: applicants.id, status: applicants.status })
      .from(applicants)
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande d\'admission introuvable.');
    }
    if (existing.status !== 'applied' && existing.status !== 'in_review') {
      throw new ApiError(409, 'ALREADY_DECIDED', 'Cette demande d\'admission a déjà été traitée et ne peut plus être modifiée.');
    }

    if (body.guardianId) {
      const [guardianRow] = await db
        .select({ id: guardians.id })
        .from(guardians)
        .where(and(eq(guardians.id, body.guardianId), eq(guardians.tenantId, tenantId)))
        .limit(1);
      if (!guardianRow) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Le tuteur indiqué n\'existe pas pour cet établissement.');
      }
    }

    const { id: _id, ...fields } = body;
    const [updated] = await db
      .update(applicants)
      .set(fields)
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', body.id);

    return NextResponse.json({ success: true, data: updated, message: 'Demande d\'admission mise à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');
    const body = await parseJson(request, applicantUpdateStatusSchema);

    // Fetch existing applicant (pre-transaction check for the reject/in_review
    // path and 404 handling; the approval branch below re-fetches inside the
    // transaction to close the concurrent-approval race window).
    const [applicant] = await db
      .select()
      .from(applicants)
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      return NextResponse.json({ success: false, message: 'Demande d\'admission introuvable' }, { status: 404 });
    }

    if (body.status === 'approved') {
      const result = await db.transaction(async (tx) => {
        // Re-check status inside the transaction - closes the window where two
        // concurrent approval requests for the same applicant could both pass
        // the outer check and both create a student.
        const [current] = await tx
          .select()
          .from(applicants)
          .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
          .limit(1);
        if (!current) {
          throw new ApiError(404, 'NOT_FOUND', 'Demande d\'admission introuvable.');
        }
        if (current.status !== 'applied' && current.status !== 'in_review') {
          throw new ApiError(409, 'ALREADY_DECIDED', 'Cette demande d\'admission a déjà été traitée.');
        }

        // 1. Real sequential matricule, same series /api/students/matricules
        // reserves from - reuses the shared helper with `tx` so it's part of
        // this same transaction.
        const matricule = await reserveMatricule(tx, tenantId);

        // 2. Generate new student record, including the new admission fields.
        const studentId = `STD-${Date.now().toString().slice(-6)}`;
        const fullName = `${current.firstName} ${current.lastName}`.trim();

        const [newStudent] = await tx
          .insert(user)
          .values({
            id: studentId,
            tenantId,
            name: fullName,
            firstName: current.firstName,
            lastName: current.lastName,
            email: current.email,
            phone: current.phone,
            dateOfBirth: current.dateOfBirth,
            guardianName: current.guardianName,
            guardianPhone: current.guardianPhone,
            guardianEmail: current.guardianEmail,
            gender: current.gender,
            nationality: current.nationality,
            motherTongue: current.motherTongue,
            city: current.city,
            bloodGroup: current.bloodGroup,
            academicYearId: current.academicYearId,
            matricule,
            role: 'student',
            userStatus: 'active',
            classSectionId: body.classSectionId || null,
          })
          .returning();

        // 3. Copy uploaded documents from applicant to student, set photoUrl.
        const uploadedDocs = await tx
          .select()
          .from(applicantDocuments)
          .where(and(eq(applicantDocuments.tenantId, tenantId), eq(applicantDocuments.applicantId, current.id)));

        let photoUrl: string | null = null;
        for (const doc of uploadedDocs) {
          await copyUploadedFile(
            tenantId,
            `applicant-documents/${current.id}/${doc.documentType}.${doc.fileExt}`,
            `${studentId}/${doc.documentType}.${doc.fileExt}`,
          );
          await tx.insert(studentDocuments).values({
            tenantId,
            studentId: newStudent!.id,
            documentType: doc.documentType,
            fileExt: doc.fileExt,
          });
          if (doc.documentType === 'photo') {
            photoUrl = `${studentId}.${doc.fileExt}`;
          }
        }
        if (photoUrl) {
          await tx.update(user).set({ photoUrl }).where(eq(user.id, newStudent!.id));
          // newStudent was captured by the earlier .returning(), before this
          // update - keep the in-memory object (used in the response below)
          // in sync with what's now actually in the database.
          newStudent!.photoUrl = photoUrl;
        }

        // 4. Link (or create-then-link) the guardian.
        if (current.guardianId) {
          await tx.insert(guardianStudents).values({
            tenantId,
            guardianId: current.guardianId,
            studentId: newStudent!.id,
            relationshipType: 'Parent',
          });
        } else if (current.guardianName) {
          const parts = current.guardianName.trim().split(/\s+/);
          const guardianFirstName = parts[0] ?? current.guardianName;
          const guardianLastName = parts.slice(1).join(' ') || '-';
          const [newGuardian] = await tx
            .insert(guardians)
            .values({
              tenantId,
              firstName: guardianFirstName,
              lastName: guardianLastName,
              phone: current.guardianPhone,
              email: current.guardianEmail,
              occupation: current.occupation,
              address: current.address,
              emailOptIn: current.emailOptIn ?? true,
              smsOptIn: current.smsOptIn ?? true,
              preferredLanguage: current.preferredLanguage,
              defaultRelation: 'Parent',
            })
            .returning();
          await tx.insert(guardianStudents).values({
            tenantId,
            guardianId: newGuardian!.id,
            studentId: newStudent!.id,
            relationshipType: 'Parent',
          });
        }

        // 5. Real login access, per the tenant's chosen mechanism. Resolved via
        // the settings registry with a legacy schoolSettings fallback.
        const { value: loginAccessMethodValue } = await getEffectiveValueWithLegacyFallback(tenantId, null, 'security.loginAccessMethod');
        const loginAccessMethod = (loginAccessMethodValue as string) || 'invite_link';

        let tempPassword: string | null = null;
        let loginAccessDeliveryStatus: string | null = null;

        if (loginAccessMethod === 'temp_password') {
          tempPassword = randomBytes(9).toString('base64url');
          const hashed = await hashPassword(tempPassword);
          await tx.insert(account).values({
            id: randomUUID(),
            accountId: newStudent!.id,
            providerId: 'credential',
            userId: newStudent!.id,
            password: hashed,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          const token = randomBytes(32).toString('base64url');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await tx.insert(accountSetupTokens).values({
            tenantId,
            userId: newStudent!.id,
            token: hashSetupToken(token),
            expiresAt,
          });

          const guardianPhoneForDelivery = current.guardianPhone
            ?? (current.guardianId
              ? (await tx.select({ phone: guardians.phone }).from(guardians).where(eq(guardians.id, current.guardianId)).limit(1))[0]?.phone
              : null);

          if (guardianPhoneForDelivery) {
            await tx.insert(smsMessages).values({
              tenantId,
              recipientPhone: guardianPhoneForDelivery,
              studentId: newStudent!.id,
              body: `Bienvenue ! Activez le compte de ${fullName} via ce lien : /setup-account?token=${token}`,
              status: 'sent',
              sentAt: new Date().toISOString(),
              createdById: context.userId,
            });
            loginAccessDeliveryStatus = 'sent';
          } else {
            loginAccessDeliveryStatus = 'no_guardian_phone';
          }
        }

        // 6. Update applicant status and link converted user.
        const [updatedApplicant] = await tx
          .update(applicants)
          .set({
            status: 'approved',
            convertedUserId: newStudent!.id,
          })
          .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
          .returning();

        return {
          student: newStudent,
          applicant: updatedApplicant,
          tempPassword,
          loginAccessMethod,
          loginAccessDeliveryStatus,
        };
      });

      // recordAudit metadata deliberately omits tempPassword - a live
      // credential has no business sitting in an audit log other admins read.
      recordAudit(context, 'update', 'admission_request', body.id, { action: 'approve' });

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Demande approuvée. L\'élève a été inscrit avec succès dans l\'annuaire.',
      });
    }

    // For rejection or in_review updates
    const [updated] = await db
      .update(applicants)
      .set({ status: body.status })
      .where(and(eq(applicants.id, body.id), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', body.id);

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Statut mis à jour : ${body.status}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
