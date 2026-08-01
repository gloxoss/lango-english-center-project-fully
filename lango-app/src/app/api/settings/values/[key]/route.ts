import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
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
    const body = await parseJson(request, patchSchema);

    // Optimistic concurrency check.
    if (body.expectedVersion !== undefined) {
      const current = await getEffectiveValue(tenantId, context.branchId, key);
      if (current.version !== body.expectedVersion) {
        throw new ApiError(409, 'VERSION_CONFLICT',
          `Le paramètre a été modifié par un autre utilisateur (version actuelle: ${current.version}, attendue: ${body.expectedVersion}).`);
      }
    }

    const version = await setSettingValue(
      tenantId,
      context.branchId,
      key,
      body.value,
      context,
      body.reason,
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
    const body = await parseJson(request, rollbackSchema);

    // Find the version record to rollback to.
    const [versionRow] = await db
      .select()
      .from(settingValueVersions)
      .innerJoin(settingValues, eq(settingValueVersions.settingValueId, settingValues.id))
      .where(and(
        eq(settingValues.tenantId, tenantId),
        eq(settingValues.key, key),
        eq(settingValueVersions.version, body.targetVersion),
      ))
      .limit(1);

    if (!versionRow) {
      throw new ApiError(404, 'VERSION_NOT_FOUND',
        `Version ${body.targetVersion} introuvable pour le paramètre "${key}".`);
    }

    // Rollback means creating a NEW version with the old value.
    const rollbackValue = versionRow.setting_value_versions.newValue;
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
