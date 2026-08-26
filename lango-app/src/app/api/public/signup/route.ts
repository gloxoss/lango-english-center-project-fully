import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, auditLogs, schoolLicenses, schoolSettings, tenants, user } from '@/models/Schema';

export const publicSignupSchema = z
  .object({
    schoolName: z.string().trim().min(2, "Nom de l'établissement trop court").max(255),
    slug: z
      .string()
      .trim()
      .min(2, 'Le slug doit contenir au moins 2 caractères')
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets')
      .optional(),
    adminName: z.string().trim().min(2, "Nom de l'administrateur requis").max(255),
    adminEmail: z.string().trim().email('Adresse email invalide').max(255),
    adminPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  })
  .strict();

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ecole';
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    checkRateLimit(`public_signup:${ip}`, 10, 60 * 1000);

    const body = await parseJson(request, publicSignupSchema);

    const email = body.adminEmail.toLowerCase().trim();
    let computedSlug = body.slug ? body.slug.toLowerCase().trim() : slugify(body.schoolName);

    const existingUsers = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'Un compte avec cette adresse email existe déjà.');
    }

    const existingTenants = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, computedSlug))
      .limit(1);

    if (existingTenants.length > 0) {
      if (body.slug) {
        throw new ApiError(409, 'SLUG_EXISTS', 'Cet identifiant (slug) est déjà utilisé par une autre école.');
      }
      computedSlug = `${computedSlug}-${Date.now().toString().slice(-4)}`;
    }

    const hashedPassword = await hashPassword(body.adminPassword);
    const now = new Date();
    const adminUserId = `SCH-ADMIN-${Date.now()}`;
    const trialDays = 30;
    const trialExpiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const trialLicenseKey = `LIC-TRIAL-${randomBytes(6).toString('hex').toUpperCase()}`;

    const result = await db.transaction(async (tx) => {
      // Double check in transaction to prevent race conditions
      const [slugConflict] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, computedSlug))
        .limit(1);

      if (slugConflict) {
        throw new ApiError(409, 'SLUG_EXISTS', 'Cet identifiant (slug) est déjà utilisé.');
      }

      const [emailConflict] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (emailConflict) {
        throw new ApiError(409, 'EMAIL_EXISTS', 'Un compte avec cette adresse email existe déjà.');
      }

      // 1. Create Tenant
      const [newTenant] = await tx
        .insert(tenants)
        .values({
          name: body.schoolName,
          slug: computedSlug,
          planTier: 'trial',
          subscriptionStatus: 'active',
          isActive: true,
        })
        .returning();

      if (!newTenant) {
        throw new ApiError(500, 'CREATION_FAILED', "Échec de la création de l'établissement.");
      }

      // 2. Create School Admin User
      const [adminUser] = await tx
        .insert(user)
        .values({
          id: adminUserId,
          tenantId: newTenant.id,
          name: body.adminName,
          email,
          role: 'school_admin',
          userStatus: 'active',
        })
        .returning();

      if (!adminUser) {
        throw new ApiError(500, 'CREATION_FAILED', "Échec de la création du compte administrateur.");
      }

      // 3. Create Better Auth Credential Account
      await tx.insert(account).values({
        id: `credential-${adminUserId.toLowerCase()}`,
        accountId: adminUserId,
        providerId: 'credential',
        userId: adminUserId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      // 4. Create 30-Day School License
      await tx.insert(schoolLicenses).values({
        tenantId: newTenant.id,
        licenseKey: trialLicenseKey,
        status: 'active',
        issuedAt: now.toISOString(),
        expiresAt: trialExpiresAt,
        issuedById: adminUserId,
        notes: 'Self-serve 30-day trial registration',
      });

      // 5. Create Default School Settings
      await tx.insert(schoolSettings).values({
        tenantId: newTenant.id,
        establishmentName: body.schoolName,
        academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      });

      // 6. Record Audit Log
      await tx.insert(auditLogs).values({
        tenantId: newTenant.id,
        actorId: adminUserId,
        action: 'create',
        entityType: 'tenant',
        entityId: newTenant.id,
        metadata: { source: 'self_serve_signup', planTier: 'trial' },
      });

      return { tenant: newTenant, admin: adminUser };
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: result.tenant.id,
        schoolName: result.tenant.name,
        slug: result.tenant.slug,
        adminEmail: result.admin.email,
        adminName: result.admin.name,
        trialExpiresAt,
      },
      message: 'Votre établissement a été créé avec succès. Bienvenue sur SchoolOS !',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
