import { and, desc, eq, max } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { moneyInput } from '@/libs/finance/validation';
import { db } from '@/libs/DB';
import { feeStructures, feeStructureVersions } from '@/models/Schema';

// amount goes through moneyInput (BigInt-cents) and is stored in the snapshot
// as a normalized decimal string (e.g. "1500.00") — the snapshot is immutable,
// so the string form is the stable record.
const versionComponent = z.object({
  name: z.string().trim().min(1).max(255),
  amount: moneyInput,
  recurrence: z.enum(['once', 'term', 'yearly']).default('once'),
  taxable: z.boolean().default(false),
  mandatory: z.boolean().default(true),
  dueOffsetDays: z.number().int().min(0).max(3650).default(0),
}).strict();

const versionSchema = z.object({
  componentsSnapshot: z.array(versionComponent).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['draft', 'published']).optional(),
}).strict();

// GET /api/finance/fee-structures/:id/versions — version history of a structure.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');
    const { id } = await params;

    const [structure] = await db
      .select({ id: feeStructures.id, name: feeStructures.name })
      .from(feeStructures)
      .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))
      .limit(1);
    if (!structure) {
      return NextResponse.json({ success: false, message: 'Structure tarifaire introuvable.' }, { status: 404 });
    }

    const versions = await db
      .select()
      .from(feeStructureVersions)
      .where(and(eq(feeStructureVersions.tenantId, tenantId), eq(feeStructureVersions.feeStructureId, id)))
      .orderBy(desc(feeStructureVersions.versionNumber));

    return NextResponse.json({ success: true, data: { structure, versions }, total: versions.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/fee-structures/:id/versions — create (and optionally
// publish) a new version. Publishing is immutable: later edits create a new
// draft version instead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;
    const body = await parseJson(request, versionSchema);

    const [structure] = await db
      .select({ id: feeStructures.id })
      .from(feeStructures)
      .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))
      .limit(1);
    if (!structure) {
      return NextResponse.json({ success: false, message: 'Structure tarifaire introuvable.' }, { status: 404 });
    }

    const [maxRow] = await db
      .select({ maxVersion: max(feeStructureVersions.versionNumber) })
      .from(feeStructureVersions)
      .where(and(eq(feeStructureVersions.tenantId, tenantId), eq(feeStructureVersions.feeStructureId, id)));
    const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

    const isPublish = body.status === 'published';
    const [inserted] = await db
      .insert(feeStructureVersions)
      .values({
        tenantId,
        feeStructureId: id,
        versionNumber: nextVersion,
        status: isPublish ? 'published' : 'draft',
        publishedById: isPublish ? context.userId : null,
        publishedAt: isPublish ? new Date().toISOString() : null,
        componentsSnapshot: body.componentsSnapshot ?? null,
        effectiveFrom: body.effectiveFrom ?? null,
      })
      .returning();

    recordAudit(context, 'create', 'fee_structure_version', inserted!.id, { version: nextVersion, publish: isPublish });

    return NextResponse.json({
      success: true,
      data: inserted,
      message: isPublish ? `Version ${nextVersion} publiée.` : `Version ${nextVersion} créée (brouillon).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
