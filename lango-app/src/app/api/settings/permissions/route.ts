import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import {
  DEFAULT_ROLE_PERMISSIONS,
  getEffectivePermissions,
  PERMISSIONS,
  type PermissionKey,
} from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { rolePermissions, userPermissionOverrides } from '@/models/Schema';

// GET /api/settings/permissions — list all permissions and the role matrix.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    // Get tenant-level role overrides.
    const overrides = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.tenantId, tenantId));

    // Build a matrix: { role: { permission: granted } }.
    const allPerms = Object.keys(PERMISSIONS) as PermissionKey[];
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const [role, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (role === 'super_admin') continue; // Never configurable.
      matrix[role] = {};
      for (const perm of allPerms) {
        // An override row decides in either direction; only fall back to the
        // default when the tenant has expressed nothing. Must mirror
        // hasCapability() or the matrix shown will not be what is enforced.
        const override = overrides.find(o => o.roleId === role && o.permissionId === perm);
        matrix[role]![perm] = override ? override.granted : defaults.includes(perm as PermissionKey);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        permissions: PERMISSIONS,
        matrix,
        overrideCount: overrides.length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const grantSchema = z.object({
  roleId: z.string().min(1).max(50),
  permissionId: z.string().min(1).max(128),
  granted: z.boolean(),
}).strict();

// POST /api/settings/permissions — grant or revoke a permission for a role.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, grantSchema);

    // Validate the permission exists.
    if (!(body.permissionId in PERMISSIONS)) {
      throw new ApiError(400, 'UNKNOWN_PERMISSION', `Permission inconnue: ${body.permissionId}`);
    }

    // Reject unknown roles: an arbitrary string would write a row that can
    // never match a caller's role, so the admin would see a saved setting that
    // silently does nothing.
    if (!(body.roleId in DEFAULT_ROLE_PERMISSIONS) || body.roleId === 'super_admin') {
      throw new ApiError(400, 'UNKNOWN_ROLE', `Rôle inconnu ou non configurable: ${body.roleId}`);
    }

    // Store the decision in both directions. Deleting the row on revoke would
    // fall back to the role default, so revoking a permission that is granted
    // by default used to report success and change nothing.
    await db
      .insert(rolePermissions)
      .values({
        tenantId,
        roleId: body.roleId,
        permissionId: body.permissionId,
        granted: body.granted,
      })
      .onConflictDoUpdate({
        target: [rolePermissions.tenantId, rolePermissions.roleId, rolePermissions.permissionId],
        set: { granted: body.granted },
      });

    recordAudit(context, 'update', 'role_permission', body.permissionId, {
      roleId: body.roleId,
      granted: body.granted,
    });

    return NextResponse.json({
      success: true,
      message: body.granted
        ? `Permission "${body.permissionId}" accordée au rôle "${body.roleId}".`
        : `Permission "${body.permissionId}" révoquée du rôle "${body.roleId}".`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
