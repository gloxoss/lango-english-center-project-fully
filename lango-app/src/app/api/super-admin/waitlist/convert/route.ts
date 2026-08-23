import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson, waitlistConvertSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, schoolAccessRequests, tenants, user } from '@/models/Schema';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'school';
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    const body = await parseJson(request, waitlistConvertSchema);

    const [entry] = await db.select().from(schoolAccessRequests).where(eq(schoolAccessRequests.id, id)).limit(1);
    if (!entry) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable');
    }
    if (entry.status === 'converted' && entry.convertedTenantId) {
      throw new ApiError(409, 'ALREADY_CONVERTED', 'Cette demande a déjà été convertie en école.');
    }

    const adminEmail = body.adminEmail ?? entry.email;
    const adminName = body.adminName ?? entry.contactName;
    if (!adminEmail) {
      throw new ApiError(422, 'EMAIL_REQUIRED', 'Aucun email associé à cette demande. Fournissez un email pour créer le compte administrateur.');
    }

    let slug = slugify(entry.schoolName);
    const [existingSlug] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`;
    }

    const tempPassword = randomBytes(9).toString('base64url');
    const hashedPassword = await hashPassword(tempPassword);
    const now = new Date();
    const adminUserId = `SCH-ADMIN-${Date.now()}`;

    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({ name: entry.schoolName, slug, planTier: body.planTier ?? 'trial' })
        .returning();

      await tx.insert(user).values({
        id: adminUserId,
        tenantId: tenant!.id,
        name: adminName,
        email: adminEmail,
        role: 'school_admin',
        userStatus: 'active',
      });

      await tx.insert(account).values({
        id: `credential-${adminUserId.toLowerCase()}`,
        accountId: adminUserId,
        providerId: 'credential',
        userId: adminUserId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(schoolAccessRequests)
        .set({ status: 'converted', convertedTenantId: tenant!.id, updatedAt: now.toISOString() })
        .where(eq(schoolAccessRequests.id, id));

      return tenant;
    });

    recordAudit(context, 'update', 'school_access_request', id, { action: 'convert', tenantId: result!.id });

    return NextResponse.json({
      success: true,
      data: { tenantId: result!.id, adminEmail, tempPassword },
      message: `École "${entry.schoolName}" créée. Mot de passe temporaire de l'administrateur (à communiquer une seule fois) : ${tempPassword}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
