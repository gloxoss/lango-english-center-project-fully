import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { publicBrandingUrl } from '@/libs/api/uploads';
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
        // Raw column, resolved below into something the invitee's browser can
        // fetch. It is a bare filename, not a URL.
        schoolLogo: tenants.logoUrl,
        tenantId: tenants.id,
        tenantSlug: tenants.slug,
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

    const schoolLogo = await publicBrandingUrl(
      { id: row.tenantId, slug: row.tenantSlug, logoUrl: row.schoolLogo },
      'logo',
    );

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
        // A fetchable URL, or null when nothing is uploaded - never the bare
        // filename the column holds.
        schoolLogo,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
