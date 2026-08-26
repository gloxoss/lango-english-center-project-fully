import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, auditLogs, tenantInvitations, user } from '@/models/Schema';

const acceptInvitationSchema = z
  .object({
    name: z.string().trim().min(2, 'Le nom complet doit contenir au moins 2 caractères').max(255),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await parseJson(request, acceptInvitationSchema);

    // Pre-flight: resolve the invitation and handle expiry outside the main
    // transaction so the status update survives even when the accept fails.
    const [invitation] = await db
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new ApiError(404, 'INVALID_TOKEN', 'Invitation introuvable.');
    }

    if (invitation.status !== 'pending') {
      throw new ApiError(
        400,
        'INVITATION_NOT_PENDING',
        invitation.status === 'accepted'
          ? 'Cette invitation a déjà été acceptée.'
          : 'Cette invitation a été révoquée.'
      );
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      await db
        .update(tenantInvitations)
        .set({ status: 'expired', updatedAt: new Date().toISOString() })
        .where(eq(tenantInvitations.id, invitation.id));
      throw new ApiError(400, 'INVITATION_EXPIRED', 'Cette invitation a expiré.');
    }

    const hashedPassword = await hashPassword(body.password);
    const now = new Date();
    const userId = `USR-INV-${Date.now()}`;

    const result = await db.transaction(async (tx) => {
      const email = invitation.email.toLowerCase().trim();

      // Check if user already exists
      const [existingUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.tenantId, invitation.tenantId), eq(user.email, email)))
        .limit(1);

      if (existingUser) {
        throw new ApiError(409, 'USER_EXISTS', 'Un compte avec cette adresse email existe déjà pour cet établissement.');
      }

      // 1. Create User
      const [newUser] = await tx
        .insert(user)
        .values({
          id: userId,
          tenantId: invitation.tenantId,
          name: body.name,
          email,
          role: invitation.role as 'super_admin' | 'school_admin' | 'teacher' | 'accountant' | 'student' | 'alumni' | 'parent' | 'receptionist' | 'guard' | 'librarian',
          userStatus: 'active',
        })
        .returning();

      if (!newUser) {
        throw new ApiError(500, 'CREATION_FAILED', 'Échec de la création du compte utilisateur.');
      }

      // 2. Create Credential Account
      await tx.insert(account).values({
        id: `credential-${userId.toLowerCase()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Mark Invitation Accepted
      await tx
        .update(tenantInvitations)
        .set({
          status: 'accepted',
          updatedAt: now.toISOString(),
        })
        .where(eq(tenantInvitations.id, invitation.id));

      // 4. Record Audit Log
      await tx.insert(auditLogs).values({
        tenantId: invitation.tenantId,
        actorId: userId,
        action: 'create',
        entityType: 'user',
        entityId: userId,
        metadata: {
          source: 'invitation_accept',
          role: invitation.role,
          invitationId: invitation.id,
        },
      });

      return { user: newUser, email, role: invitation.role };
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.id,
        email: result.email,
        role: result.role,
      },
      message: 'Compte activé avec succès. Bienvenue dans votre établissement !',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
