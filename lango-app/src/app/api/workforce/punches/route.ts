import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { isCredentialExpired } from '@/libs/api/badge-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { branchWhere } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { identityBadgeCredentials, user, workforcePunchEvents } from '@/models/Schema';

const punchSchema = z.object({
  rawToken: z.string().trim().min(1),
  // Optional on purpose. The server derives the legal next action from the
  // employee's own last punch; a caller may state what it believes the action is,
  // and will be refused if it contradicts. It may not decide.
  punchType: z.enum(['in', 'out']).optional(),
  notes: z.string().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'hr.read');

    const items = await db
      .select({
        id: workforcePunchEvents.id,
        employeeId: workforcePunchEvents.employeeId,
        punchType: workforcePunchEvents.punchType,
        scannedAt: workforcePunchEvents.scannedAt,
        employeeName: user.name,
      })
      .from(workforcePunchEvents)
      .leftJoin(user, eq(workforcePunchEvents.employeeId, user.id))
      .where(and(eq(workforcePunchEvents.tenantId, tenantId), branchWhere(context, user.branchId)))
      .orderBy(desc(workforcePunchEvents.scannedAt))
      .limit(50);

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
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    // Recording staff time is not implied by being able to open the page: a
    // teacher session must not be able to clock any employee in or out.
    await requireCapability(context, 'workforce.punch');
    const body = await parseJson(request, punchSchema);

    // Compute HMAC hash of raw badge token
    const tokenHash = computeHmacHash(body.rawToken);

    // Resolve staff badge
    const [badge] = await db
      .select()
      .from(identityBadgeCredentials)
      .where(
        and(
          eq(identityBadgeCredentials.tenantId, tenantId),
          eq(identityBadgeCredentials.tokenHash, tokenHash),
          eq(identityBadgeCredentials.status, 'active')
        )
      )
      .limit(1);

    if (!badge) {
      throw new ApiError(404, 'STAFF_BADGE_INVALID', 'Badge employé non reconnu ou inactif.');
    }

    // The lookup above filters on status='active', which cannot express expiry.
    if (isCredentialExpired(badge)) {
      throw new ApiError(422, 'BADGE_EXPIRED', 'Ce badge employé a expiré.');
    }

    const [staffUser] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, badge.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    if (!staffUser) {
      throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Employé introuvable.');
    }

    // THE STATE MACHINE. The employee's own last punch decides what may happen
    // next: an open shift can only be closed, and a closed one only opened. The
    // client cannot choose, so two arrivals in a row or a departure without an
    // arrival are not merely rejected — they are unrepresentable.
    //
    // Not restricted to today: someone who arrived at 22:00 and leaves at 06:00
    // is a normal night shift, not an error.
    const [lastPunch] = await db
      .select({ punchType: workforcePunchEvents.punchType })
      .from(workforcePunchEvents)
      .where(and(
        eq(workforcePunchEvents.tenantId, tenantId),
        eq(workforcePunchEvents.employeeId, staffUser.id),
      ))
      .orderBy(desc(workforcePunchEvents.scannedAt))
      .limit(1);

    const hasOpenShift = lastPunch?.punchType === 'in';
    const nextAction = hasOpenShift ? 'out' : 'in';

    if (body.punchType && body.punchType !== nextAction) {
      throw new ApiError(
        409,
        'INVALID_PUNCH_SEQUENCE',
        hasOpenShift
          ? 'Une arrivée est déjà enregistrée. Le prochain pointage doit être un départ.'
          : 'Aucune arrivée enregistrée. Le prochain pointage doit être une arrivée.',
      );
    }

    const [punch] = await db
      .insert(workforcePunchEvents)
      .values({
        tenantId,
        employeeId: staffUser.id,
        credentialId: badge.id,
        punchType: nextAction,
        notes: body.notes || null,
      })
      .returning();

    await recordAudit(context, 'create', 'workforce_punch', punch!.id, {
      punchType: nextAction,
      derived: body.punchType === undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        punch,
        employeeName: staffUser.name,
        // Told plainly so a kiosk can render "Arrivée" or "Départ" without
        // guessing, and can show the refusal reason before it happens.
        action: nextAction,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
