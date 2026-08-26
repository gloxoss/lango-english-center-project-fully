import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { addonDefinitions } from '@/models/Schema';

const addonId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Identifiant kebab-case attendu (minuscules, chiffres, tirets)');

const addonDefinitionCreateSchema = z.object({
  id: addonId,
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(2000),
  enabled: z.boolean().optional(),
  requires: z.array(addonId).max(20).optional(),
}).strict();

// POST /api/super-admin/addon-definitions
// Adds a row to the DB-driven addon catalog so a super-admin can introduce a
// new module type without touching code or the database directly.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);
    const body = await parseJson(request, addonDefinitionCreateSchema);

    const [existing] = await db
      .select({ id: addonDefinitions.id })
      .from(addonDefinitions)
      .where(eq(addonDefinitions.id, body.id))
      .limit(1);
    if (existing) {
      throw new ApiError(409, 'ALREADY_EXISTS', `Un module avec l'identifiant "${body.id}" existe déjà.`);
    }

    const [nextSort] = await db
      .select({ max: sql<number>`coalesce(max(${addonDefinitions.sortOrder}), -1)::int` })
      .from(addonDefinitions);

    const [row] = await db
      .insert(addonDefinitions)
      .values({
        id: body.id,
        name: body.name,
        description: body.description,
        enabled: body.enabled ?? false,
        requires: body.requires ?? [],
        sortOrder: (nextSort?.max ?? -1) + 1,
      })
      .returning();

    recordAudit(ctx, 'create', 'addon_definition', row!.id, { name: row!.name });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
