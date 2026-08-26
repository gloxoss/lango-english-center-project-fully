import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenantInvitations, user } from '@/models/Schema';

const createInvitationSchema = z
  .object({
    email: z.string().trim().email('Adresse email invalide').max(255),
    role: z.enum([
      'school_admin',
      'teacher',
      'accountant',
      'receptionist',
      'librarian',
      'guard',
    ]),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');

    const invitations = await db
      .select({
        id: tenantInvitations.id,
        email: tenantInvitations.email,
        role: tenantInvitations.role,
        status: tenantInvitations.status,
        token: tenantInvitations.token,
        expiresAt: tenantInvitations.expiresAt,
        createdAt: tenantInvitations.createdAt,
      })
      .from(tenantInvitations)
      .where(eq(tenantInvitations.tenantId, tenantId))
      .orderBy(desc(tenantInvitations.createdAt))
      .limit(100);

    return NextResponse.json({
      success: true,
      data: invitations,
      total: invitations.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'users.manage');

    const body = await parseJson(request, createInvitationSchema);
    const email = body.email.toLowerCase().trim();

    // Check if user is already an active member of this tenant
    const [existingMember] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.email, email)))
      .limit(1);

    if (existingMember) {
      throw new ApiError(409, 'ALREADY_MEMBER', 'Cet utilisateur est déjà membre de votre établissement.');
    }

    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [invitation] = await db
      .insert(tenantInvitations)
      .values({
        tenantId,
        email,
        role: body.role,
        token,
        status: 'pending',
        invitedById: context.userId,
        expiresAt,
      })
      .returning();

    if (!invitation) {
      throw new ApiError(500, 'INVITE_FAILED', "Échec de l'envoi de l'invitation.");
    }

    recordAudit(context, 'create', 'invitation', invitation.id, {
      email,
      role: body.role,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: invitation,
      inviteUrl: `/invitations/${token}`,
      message: `Invitation générée avec succès pour ${email}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
