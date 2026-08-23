import { and, count, eq, ilike, inArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { guardianCreateSchema, guardianUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, user } from '@/models/Schema';

// Response shape matches the previous in-memory mock so parents-guardians-view.tsx
// keeps working untouched.
function toApiGuardian(row: typeof guardians.$inferSelect, linkedStudents: string[]) {
  return {
    id: row.id,
    userId: row.userId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    relation: row.defaultRelation ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    linkedStudents,
    address: row.address ?? '',
    occupation: row.occupation ?? '',
    emailOptIn: row.emailOptIn,
    smsOptIn: row.smsOptIn,
    preferredLanguage: row.preferredLanguage ?? '',
    // No portal_access column exists; a linked user account is what portal login
    // actually requires, so its presence is the real signal, not a stored flag.
    portalAccess: row.userId !== null,
    schoolId: row.tenantId,
  };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? fullName, lastName: parts.slice(1).join(' ') || '-' };
}

/**
 * guardian_students is the real link table, but the current UI only ever sends
 *  free-text names (no student ids), so nothing writes to it yet - see
 *  MIGRATION-NOTES.md. Every guardian therefore reads back with linkedStudents: []
 *  until a real student-picker + linking endpoint exists.
 */
async function loadLinkedStudentNames(guardianIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (guardianIds.length === 0) {
    return map;
  }

  const links = await db
    .select({ guardianId: guardianStudents.guardianId, studentName: user.name })
    .from(guardianStudents)
    .innerJoin(user, eq(guardianStudents.studentId, user.id))
    .where(inArray(guardianStudents.guardianId, guardianIds));

  for (const link of links) {
    const names = map.get(link.guardianId) ?? [];
    names.push(link.studentName);
    map.set(link.guardianId, names);
  }
  return map;
}

export async function GET(request: Request) {
  try {
    // accountant has guardians.read (needs guardian contact info for
    // billing) - write actions below stay school_admin/receptionist only,
    // matching guardians.manage which accountant does not have.
    const context = await requireRequestContext(request, ['school_admin', 'receptionist', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.read');
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const filters = [eq(guardians.tenantId, tenantId)];
    if (search) {
      const term = `%${search}%`;
      filters.push(
        or(
          ilike(guardians.firstName, term),
          ilike(guardians.lastName, term),
          ilike(guardians.phone, term),
          ilike(guardians.email, term),
        )!,
      );
    }

    const pagination = parsePagination(searchParams);
    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
      db.select().from(guardians).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(guardians).where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;

    const linkedByGuardian = await loadLinkedStudentNames(rows.map(r => r.id));

    return NextResponse.json({
      success: true,
      data: rows.map(row => toApiGuardian(row, linkedByGuardian.get(row.id) ?? [])),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const body = await parseJson(request, guardianCreateSchema);
    const { firstName, lastName } = splitName(body.name);

    const [inserted] = await db
      .insert(guardians)
      .values({
        tenantId,
        firstName,
        lastName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        occupation: body.occupation,
        emailOptIn: body.emailOptIn ?? true,
        smsOptIn: body.smsOptIn ?? true,
        preferredLanguage: body.preferredLanguage,
        defaultRelation: body.relation || 'Père',
      })
      .returning();

    recordAudit(context, 'create', 'guardian', inserted!.id);

    return NextResponse.json({
      success: true,
      data: toApiGuardian(inserted!, []),
      message: 'Tuteur créé avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const body = await parseJson(request, guardianUpdateSchema);
    const { firstName, lastName } = body.name ? splitName(body.name) : {};

    const [updated] = await db
      .update(guardians)
      .set({
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        phone: body.phone,
        email: body.email,
        address: body.address,
        occupation: body.occupation,
        emailOptIn: body.emailOptIn,
        smsOptIn: body.smsOptIn,
        preferredLanguage: body.preferredLanguage,
        defaultRelation: body.relation,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(guardians.id, body.id), eq(guardians.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Tuteur non trouvé' }, { status: 404 });
    }

    recordAudit(context, 'update', 'guardian', body.id);

    const linked = await loadLinkedStudentNames([updated.id]);
    return NextResponse.json({
      success: true,
      data: toApiGuardian(updated, linked.get(updated.id) ?? []),
      message: 'Tuteur mis à jour avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'guardians.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await db.delete(guardians).where(and(eq(guardians.id, id), eq(guardians.tenantId, tenantId)));
      recordAudit(context, 'delete', 'guardian', id);
      return NextResponse.json({
        success: true,
        message: 'Tuteur supprimé avec succès',
        id,
      });
    }

    return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
