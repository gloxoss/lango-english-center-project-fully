import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { hostels } from '@/features/hostel/models/hostel-schema';
import { transportRoutes } from '@/features/transport/models/transport-schema';
import { branches, classes, user } from '@/models/Schema';

/** Roles that count as "pinned staff" on a campus. */
const STAFF_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian'] as const;

type BranchUsage = {
  activeStudents: number;
  classes: number;
  pinnedStaff: number;
  activeHostels: number;
  activeTransportRoutes: number;
};

/**
 * What still lives on this campus.
 *
 * Deactivating a branch used to be a one-column update: the campus vanished
 * from the switcher while its students, classes, staff and bus routes stayed
 * attached to it, so records became unreachable from every screen that filters
 * by the active branch. The counts are returned rather than just a boolean so
 * the admin can see WHICH kind of record is in the way.
 *
 * Every count filters tenantId as well as branchId: branch ids are only unique
 * per tenant, so an unscoped count would report another school's usage.
 */
async function branchUsage(tenantId: string, branchId: string): Promise<BranchUsage> {
  const [students, classRows, staff, hostelRows, routeRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.branchId, branchId),
        eq(user.role, 'student'),
        eq(user.userStatus, 'active'),
      )),
    db
      .select({ total: count() })
      .from(classes)
      .where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, branchId))),
    db
      .select({ total: count() })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.branchId, branchId),
        eq(user.userStatus, 'active'),
        inArray(user.role, [...STAFF_ROLES]),
      )),
    db
      .select({ total: count() })
      .from(hostels)
      .where(and(
        eq(hostels.tenantId, tenantId),
        eq(hostels.branchId, branchId),
        eq(hostels.status, 'active'),
      )),
    db
      .select({ total: count() })
      .from(transportRoutes)
      .where(and(
        eq(transportRoutes.tenantId, tenantId),
        eq(transportRoutes.branchId, branchId),
        eq(transportRoutes.status, 'active'),
      )),
  ]);

  return {
    activeStudents: students[0]?.total ?? 0,
    classes: classRows[0]?.total ?? 0,
    pinnedStaff: staff[0]?.total ?? 0,
    activeHostels: hostelRows[0]?.total ?? 0,
    activeTransportRoutes: routeRows[0]?.total ?? 0,
  };
}

/** 409 with the counts when anything is still attached. No force flag: that
 *  would only move the problem to the screens the records disappear from. */
async function inUseResponse(tenantId: string, branchId: string) {
  const usage = await branchUsage(tenantId, branchId);
  if (Object.values(usage).every(n => n === 0)) {
    return null;
  }
  return NextResponse.json({
    success: false,
    error: {
      code: 'BRANCH_IN_USE',
      message: 'Cette succursale est encore utilisée : élèves, classes, personnel ou services y sont rattachés.',
      details: usage,
    },
  }, { status: 409 });
}

const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  code: z.string().trim().min(1).max(50).optional(),
  city: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(ctx);
    const { id } = await params;

    const body = await parseJson(request, updateBranchSchema);
    const { name, code, city, address, phone, email, isActive } = body;

    const [existing] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Succursale introuvable.' } },
        { status: 404 },
      );
    }

    // Turning a branch off through PUT is the same deactivation as DELETE.
    const deactivating = isActive === false && existing.isActive;
    if (deactivating) {
      const blocked = await inUseResponse(tenantId, id);
      if (blocked) {
        return blocked;
      }
    }

    const [updated] = await db
      .update(branches)
      .set({
        name: name ? name.trim() : existing.name,
        code: code ? code.trim().toUpperCase() : existing.code,
        city: city !== undefined ? (city?.trim() || null) : existing.city,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        phone: phone !== undefined ? (phone?.trim() || null) : existing.phone,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(ctx);
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Succursale introuvable.' } },
        { status: 404 },
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE_DEFAULT', message: 'La succursale principale par défaut ne peut pas être supprimée.' } },
        { status: 400 },
      );
    }

    const blocked = await inUseResponse(tenantId, id);
    if (blocked) {
      return blocked;
    }

    const [deactivated] = await db
      .update(branches)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(branches.id, id), eq(branches.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      data: deactivated,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
