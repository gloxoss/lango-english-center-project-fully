import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { tenantInvitations, tenants } from '@/models/Schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [row] = await db
      .select({
        id: tenantInvitations.id,
        email: tenantInvitations.email,
        role: tenantInvitations.role,
        status: tenantInvitations.status,
        expiresAt: tenantInvitations.expiresAt,
        schoolName: tenants.name,
        schoolLogo: tenants.logoUrl,
      })
      .from(tenantInvitations)
      .innerJoin(tenants, eq(tenantInvitations.tenantId, tenants.id))
      .where(eq(tenantInvitations.token, token))
      .limit(1);

    if (!row) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: { code: 'INVALID_TOKEN', message: 'Ce lien d\'invitation est invalide.' },
      }, { status: 404 });
    }

    const isExpired = new Date(row.expiresAt).getTime() < Date.now();
    const isValid = row.status === 'pending' && !isExpired;

    return NextResponse.json({
      success: true,
      valid: isValid,
      data: {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        expiresAt: row.expiresAt,
        isExpired,
        schoolName: row.schoolName,
        schoolLogo: row.schoolLogo,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
