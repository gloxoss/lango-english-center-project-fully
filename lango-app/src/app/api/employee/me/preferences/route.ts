import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

const preferenceSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  preferredLanguage: z.enum(['fr', 'ar', 'en']).optional(),
  weeklySummaryEmail: z.boolean().optional(),
  defaultTab: z.enum(['overview', 'leave', 'payroll', 'time', 'documents']).optional(),
}).strict();

// Simple in-memory fallback for session context preference or default
const defaultPreferences = {
  notificationsEnabled: true,
  preferredLanguage: 'fr',
  weeklySummaryEmail: true,
  defaultTab: 'overview',
};

// GET /api/employee/me/preferences — Get employee workspace preferences
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    return NextResponse.json({
      success: true,
      data: defaultPreferences,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// PATCH /api/employee/me/preferences — Update preferences
export async function PATCH(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId);

    const body = await parseJson(request, preferenceSchema);

    if (Object.keys(body).length === 0) {
      throw new ApiError(422, 'EMPTY_PATCH', 'Aucun champ de préférence à modifier.');
    }

    const updated = {
      ...defaultPreferences,
      ...body,
    };

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
