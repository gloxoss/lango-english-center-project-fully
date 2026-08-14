import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from 'better-auth/crypto';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, employeeProfileEditRequests, employeeProfiles, user } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

const patchProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  dependantsCount: z.number().int().min(0).max(20).optional(),
  // Sensitive financial / identity fields require reauthentication and HR approval
  bankRib: z.string().trim().max(34).optional(),
  cnssNumber: z.string().trim().max(50).optional(),
  amoNumber: z.string().trim().max(50).optional(),
  reason: z.string().trim().max(500).optional(),
  currentPassword: z.string().min(1).max(200).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    const employee = await resolveEmployeeContext(tenantId, ctx.userId);

    const [userRow] = await db
      .select({
        name: user.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
      })
      .from(user)
      .where(and(eq(user.id, ctx.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    return NextResponse.json({ success: true, data: { user: userRow ?? null, employee } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    const employee = await resolveEmployeeContext(tenantId, ctx.userId);

    const body = await parseJson(request, patchProfileSchema);

    const changeKeys = ['firstName', 'lastName', 'phone', 'address', 'dependantsCount', 'bankRib', 'cnssNumber', 'amoNumber'] as const;
    if (!changeKeys.some(key => body[key] !== undefined)) {
      throw new ApiError(422, 'EMPTY_PATCH', 'Aucun champ à modifier.');
    }

    const isSensitiveEdit = body.bankRib !== undefined || body.cnssNumber !== undefined || body.amoNumber !== undefined;

    if (isSensitiveEdit) {
      if (!body.currentPassword) {
        throw new ApiError(403, 'REAUTH_REQUIRED', 'La modification des données bancaires ou d\'immatriculation exige une re-authentification par mot de passe.');
      }

      const [cred] = await db
        .select({ password: account.password })
        .from(account)
        .where(and(eq(account.userId, ctx.userId), eq(account.providerId, 'credential')))
        .limit(1);

      if (!cred?.password) {
        throw new ApiError(400, 'NO_CREDENTIAL', 'Aucun mot de passe enregistré pour ce compte.');
      }

      const valid = await verifyPassword({ hash: cred.password, password: body.currentPassword });
      if (!valid) {
        throw new ApiError(403, 'REAUTH_FAILED', 'Mot de passe incorrect.');
      }

      // Create a sensitive edit approval request for HR review
      const proposed: Record<string, string> = {};
      if (body.bankRib !== undefined) proposed.bankRib = body.bankRib;
      if (body.cnssNumber !== undefined) proposed.cnssNumber = body.cnssNumber;
      if (body.amoNumber !== undefined) proposed.amoNumber = body.amoNumber;

      let editReq: { id: string } | undefined;
      try {
        [editReq] = await db.insert(employeeProfileEditRequests).values({
          tenantId,
          employeeId: employee.id,
          userId: ctx.userId,
          requestType: body.bankRib ? 'bank_rib' : 'tax_cnss',
          proposedChanges: proposed,
          reason: body.reason ?? null,
          status: 'pending',
          reauthenticatedAt: new Date().toISOString(),
        }).returning({ id: employeeProfileEditRequests.id });
      } catch (error) {
        const pg = error as { code?: string; cause?: { code?: string } };
        if ((pg.code ?? pg.cause?.code) === '23505') throw new ApiError(409, 'PENDING_EDIT_EXISTS', 'Une demande similaire est déjà en attente.');
        throw error;
      }

      recordAudit(ctx, 'create', 'employee_profile_edit_request', editReq!.id);
    }

    // Direct safe updates (contact / dependants)
    const userUpdates: Partial<typeof user.$inferInsert> = {};
    for (const field of ['firstName', 'lastName', 'phone', 'address'] as const) {
      if (body[field] !== undefined) {
        (userUpdates as Record<string, string | null>)[field] = body[field] ?? null;
      }
    }
    if (Object.keys(userUpdates).length > 0) {
      await db
        .update(user)
        .set({ ...userUpdates, updatedAt: new Date().toISOString() })
        .where(and(eq(user.id, ctx.userId), eq(user.tenantId, tenantId)));
    }

    const profileUpdates: Partial<typeof employeeProfiles.$inferInsert> = {};
    if (body.dependantsCount !== undefined) {
      profileUpdates.dependantsCount = body.dependantsCount;
    }
    if (Object.keys(profileUpdates).length > 0) {
      await db
        .update(employeeProfiles)
        .set({ ...profileUpdates, updatedAt: new Date().toISOString() })
        .where(and(eq(employeeProfiles.tenantId, tenantId), eq(employeeProfiles.userId, ctx.userId)));
    }

    recordAudit(ctx, 'update', 'employee_profile', employee.id);

    return NextResponse.json({
      success: true,
      data: {
        applied: { ...userUpdates, ...profileUpdates },
        pendingApproval: isSensitiveEdit,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
