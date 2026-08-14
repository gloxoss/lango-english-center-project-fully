import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import type { PermissionKey } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getDefinition, getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import { db } from '@/libs/DB';
import { settingValueVersions, settingValues } from '@/models/Schema';

type RouteParams = { params: Promise<{ key: string }> };

// GET /api/settings/values/[key] — single key with full metadata.
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const def = getDefinition(key);
    const effective = await getEffectiveValue(tenantId, context.branchId, key);

    return NextResponse.json({
      success: true,
      data: {
        ...effective,
        definition: {
          label: def.label,
          description: def.description,
          namespace: def.namespace,
          scope: def.scope,
          sensitivity: def.sensitivity,
        },
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const patchSchema = z.object({
  value: z.unknown(),
  reason: z.string().max(500).optional(),
  expectedVersion: z.number().int().min(0).optional(),
}).strict();

// PATCH /api/settings/values/[key] — update a single setting with
// optional optimistic concurrency via expectedVersion.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    // getDefinition() throws 400 for unknown keys.
    await requireCapability(context, getDefinition(key).requiredPermission as PermissionKey);
    const body = await parseJson(request, patchSchema);

    // Optimistic concurrency is enforced inside the write transaction
    // (compare-and-set on the locked version), not as a separate pre-check —
    // otherwise two concurrent PATCHes could both pass the pre-check and then
    // both write, losing one update and duplicating history.
    const version = await setSettingValue(
      tenantId,
      context.branchId,
      key,
      body.value,
      context,
      body.reason,
      body.expectedVersion,
    );

    recordAudit(context, 'update', 'setting', key, { version });

    return NextResponse.json({
      success: true,
      data: { key, version },
      message: 'Paramètre mis à jour.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/settings/values/[key] — rollback to a previous version.
// Body: { targetVersion: number }
const rollbackSchema = z.object({
  targetVersion: z.number().int().min(1),
}).strict();

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, getDefinition(key).requiredPermission as PermissionKey);
    const body = await parseJson(request, rollbackSchema);

    // Secrets are masked in version history, so a previous secret can never be
    // reconstructed — rollback would silently store encrypt('********').
    const def = getDefinition(key);
    if (def.sensitivity === 'secret') {
      throw new ApiError(400, 'SECRET_ROLLBACK_NOT_SUPPORTED',
        `Le secret "${key}" ne peut pas être restauré : les anciennes valeurs sont masquées par sécurité.`);
    }

    // Resolve the exact scope row that holds this tenant/branch's history.
    // A branch-scoped request must roll back from ITS OWN override row; a
    // tenant-scoped request from the tenant-global row. A branch can never
    // resolve a version from another branch's or the tenant-global history.
    const branchScoped = def.scope === 'branch' && context.branchId != null;

    const [targetRow] = await db
      .select({ id: settingValues.id })
      .from(settingValues)
      .where(and(
        eq(settingValues.tenantId, tenantId),
        branchScoped ? eq(settingValues.branchId, context.branchId!) : isNull(settingValues.branchId),
        eq(settingValues.key, key),
      ))
      .limit(1);

    if (!targetRow) {
      throw new ApiError(404, 'VERSION_NOT_FOUND',
        `Version ${body.targetVersion} introuvable pour le paramètre "${key}" dans ce périmètre.`);
    }

    // Find the version record for exactly this scope row + version.
    const [versionRow] = await db
      .select()
      .from(settingValueVersions)
      .where(and(
        eq(settingValueVersions.settingValueId, targetRow.id),
        eq(settingValueVersions.version, body.targetVersion),
      ))
      .limit(1);

    if (!versionRow) {
      throw new ApiError(404, 'VERSION_NOT_FOUND',
        `Version ${body.targetVersion} introuvable pour le paramètre "${key}" dans ce périmètre.`);
    }

    // Rollback means creating a NEW version with the old value.
    const rollbackValue = versionRow.newValue;
    const newVersion = await setSettingValue(
      tenantId,
      context.branchId,
      key,
      rollbackValue,
      context,
      `Rollback to version ${body.targetVersion}`,
    );

    recordAudit(context, 'update', 'setting_rollback', key, {
      fromVersion: body.targetVersion,
      newVersion,
    });

    return NextResponse.json({
      success: true,
      data: { key, version: newVersion, rolledBackTo: body.targetVersion },
      message: `Paramètre restauré à la version ${body.targetVersion}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
