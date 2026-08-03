import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { employeeProfiles, user } from '@/models/Schema';

const HR_ROLES = ['school_admin', 'accountant'] as const;

const upsertSchema = z.object({
  userId: z.string().min(1),
  cnssNumber: z.string().max(20).nullable().optional(),
  amoNumber: z.string().max(20).nullable().optional(),
  bankRib: z.string().max(34).nullable().optional(),
  contractType: z.enum(['cdi', 'cdd', 'vacation']).default('cdi'),
  dependantsCount: z.number().int().min(0).max(20).default(0),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, HR_ROLES);
    const tenantId = requireTenant(ctx);
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? '';

    const rows = await db
      .select({
        id: employeeProfiles.id,
        userId: employeeProfiles.userId,
        cnssNumber: employeeProfiles.cnssNumber,
        amoNumber: employeeProfiles.amoNumber,
        bankRib: employeeProfiles.bankRib,
        contractType: employeeProfiles.contractType,
        dependantsCount: employeeProfiles.dependantsCount,
        createdAt: employeeProfiles.createdAt,
        updatedAt: employeeProfiles.updatedAt,
        employeeName: user.name,
        employeeEmail: user.email,
        employeeRole: user.role,
        employeeStatus: user.userStatus,
        salary: user.salary,
      })
      .from(employeeProfiles)
      .innerJoin(user, eq(employeeProfiles.userId, user.id))
      .where(
        and(
          eq(employeeProfiles.tenantId, tenantId),
          search
            ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))
            : undefined,
        ),
      )
      .orderBy(desc(employeeProfiles.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, HR_ROLES);
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, upsertSchema);

    // Verify target user belongs to this tenant
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, body.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!targetUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable dans cet établissement.');
    }

    const [profile] = await db
      .insert(employeeProfiles)
      .values({
        tenantId,
        userId: body.userId,
        cnssNumber: body.cnssNumber ?? null,
        amoNumber: body.amoNumber ?? null,
        bankRib: body.bankRib ?? null,
        contractType: body.contractType,
        dependantsCount: body.dependantsCount,
      })
      .onConflictDoUpdate({
        target: [employeeProfiles.tenantId, employeeProfiles.userId],
        set: {
          cnssNumber: body.cnssNumber ?? null,
          amoNumber: body.amoNumber ?? null,
          bankRib: body.bankRib ?? null,
          contractType: body.contractType,
          dependantsCount: body.dependantsCount,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
