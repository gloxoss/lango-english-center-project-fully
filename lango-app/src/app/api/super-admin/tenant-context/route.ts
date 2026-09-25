import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';

// Super-admin tenant switch (audit 2026-09-22, P1-2).
//
// The switch used to be a client-side `document.cookie` write with a 1-year
// expiry: no server validation, no audit record, no time bound. Law 09-08 /
// CNDP expects platform staff access to a school's data (minors') to be
// logged per tenant. Switching now goes through this route:
//   - the tenant is validated server-side,
//   - the cookie is httpOnly and expires after 8 hours,
//   - every start/exit is recorded in audit_logs with the stated reason,
//   - audit rows written while impersonating are marked (see recordAudit).

const TENANT_COOKIE = 'schoolos_active_tenant_id';
const TENANT_COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours

const switchTenantSchema = z.object({
  // null = return to global platform scope
  tenantId: z.string().uuid().nullable(),
  reason: z.string().min(3).max(255).optional(),
}).strict();

function tenantCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TENANT_COOKIE_MAX_AGE,
  };
}

async function resolveTenantName(tenantId: string | null): Promise<string | null> {
  if (!tenantId) {
    return null;
  }
  const [row] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.name ?? null;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    const activeTenantId = context.tenantId;
    const tenantName = await resolveTenantName(activeTenantId);
    return NextResponse.json({
      success: true,
      data: {
        activeTenantId,
        tenantName,
        impersonated: activeTenantId !== null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    const body = await parseJson(request, switchTenantSchema);

    if (body.tenantId === null) {
      // Exit impersonation: clear the cookie and restore global scope.
      const previousTenantId = context.tenantId;
      const response = NextResponse.json({
        success: true,
        data: { activeTenantId: null, tenantName: null },
      });
      response.cookies.set(TENANT_COOKIE, '', { ...tenantCookieOptions(), maxAge: 0 });
      recordAudit(context, 'impersonate_end', 'tenant', previousTenantId ?? 'global', {
        reason: body.reason ?? null,
      });
      return response;
    }

    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.id, body.tenantId))
      .limit(1);
    if (!tenant) {
      throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable.');
    }
    if (!tenant.isActive) {
      throw new ApiError(409, 'TENANT_DISABLED', 'Cet établissement est désactivé : accès refusé.');
    }

    const response = NextResponse.json({
      success: true,
      data: { activeTenantId: tenant.id, tenantName: tenant.name },
    });
    response.cookies.set(TENANT_COOKIE, tenant.id, tenantCookieOptions());
    recordAudit(context, 'impersonate_start', 'tenant', tenant.id, {
      tenantName: tenant.name,
      reason: body.reason ?? null,
      cookieMaxAgeHours: TENANT_COOKIE_MAX_AGE / 3600,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
