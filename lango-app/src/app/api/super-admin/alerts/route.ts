import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { listSchoolsWithLicenses } from '@/features/subscriptions/services/subscription-service';

// GET /api/super-admin/alerts - tenants needing attention. Reuses the existing
// license-derivation logic (listSchoolsWithLicenses) so expiry data is not
// re-derived here: subscription issues come from tenants.subscriptionStatus /
// isActive, license expirations from the already-computed licenseStatus.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { schools } = await listSchoolsWithLicenses();

    const subscriptionIssues = schools
      .filter(s => s.subscriptionStatus !== 'active' || !s.isActive)
      .map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        subscriptionStatus: s.subscriptionStatus,
        isActive: s.isActive,
      }));

    const expiringLicenses = schools
      .filter(s => s.licenseStatus === 'expiring' || s.licenseStatus === 'expired')
      .map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        licenseStatus: s.licenseStatus,
        expiresAt: s.license?.expiresAt ?? null,
      }));

    return NextResponse.json({
      success: true,
      data: { subscriptionIssues, expiringLicenses },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
