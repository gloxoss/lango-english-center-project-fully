import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson, schoolCreateSchema, schoolUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { account, tenants, user } from '@/models/Schema';

// ponytail: super-admin routes check role === 'super_admin' and deliberately
// never call requireTenant - a super_admin manages every tenant, not one.

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'school';
}

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url');
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      if (!tenant) {
        throw new ApiError(404, 'NOT_FOUND', 'École non trouvée');
      }
      const roleCounts = await db
        .select({ role: user.role, count: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.tenantId, id))
        .groupBy(user.role);
      return NextResponse.json({
        success: true,
        data: {
          ...tenant,
          studentCount: roleCounts.find(r => r.role === 'student')?.count ?? 0,
          teacherCount: roleCounts.find(r => r.role === 'teacher')?.count ?? 0,
          staffCount: roleCounts.reduce((sum, r) => sum + (r.role !== 'student' ? r.count : 0), 0),
        },
      });
    }

    const [rows, userCounts] = await Promise.all([
      db.select().from(tenants),
      db.select({ tenantId: user.tenantId, count: sql<number>`count(*)::int` }).from(user).groupBy(user.tenantId),
    ]);
    const countByTenant = new Map(userCounts.filter(c => c.tenantId).map(c => [c.tenantId as string, c.count]));

    return NextResponse.json({
      success: true,
      data: rows.map(t => ({ ...t, userCount: countByTenant.get(t.id) ?? 0 })),
      total: rows.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);
    const body = await parseJson(request, schoolCreateSchema);

    let slug = slugify(body.name);
    const [existingSlug] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`;
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const now = new Date();
    const adminUserId = `SCH-ADMIN-${Date.now()}`;

    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({ name: body.name, slug, planTier: body.planTier ?? 'trial' })
        .returning();

      const [admin] = await tx
        .insert(user)
        .values({
          id: adminUserId,
          tenantId: tenant!.id,
          name: body.adminName,
          email: body.adminEmail,
          role: 'school_admin',
          userStatus: 'active',
        })
        .returning();

      await tx.insert(account).values({
        id: `credential-${adminUserId.toLowerCase()}`,
        accountId: adminUserId,
        providerId: 'credential',
        userId: adminUserId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      return { tenant, admin };
    });

    recordAudit(context, 'create', 'tenant', result.tenant!.id);

    return NextResponse.json({
      success: true,
      data: { ...result.tenant, adminEmail: body.adminEmail, tempPassword },
      message: `École "${body.name}" créée. Mot de passe temporaire de l'administrateur (à communiquer une seule fois) : ${tempPassword}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    requireSuperAdmin(context);
    const body = await parseJson(request, schoolUpdateSchema);

    const [updated] = await db
      .update(tenants)
      .set({
        name: body.name,
        planTier: body.planTier,
        subscriptionStatus: body.subscriptionStatus,
        isActive: body.isActive,
      })
      .where(eq(tenants.id, body.id))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'École non trouvée');
    }

    recordAudit(context, 'update', 'tenant', body.id);

    return NextResponse.json({ success: true, data: updated, message: 'École mise à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
