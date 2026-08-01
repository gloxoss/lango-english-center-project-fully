import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { branches } from '@/models/Schema';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(ctx);
    const { id } = await params;

    const body = await request.json();
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
