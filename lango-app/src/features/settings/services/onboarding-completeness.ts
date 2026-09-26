import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import { schoolSettings, tenants } from '@/models/Schema';

/** Core fields a newly provisioned school must supply before entering SchoolOS. */
export async function isSchoolOnboardingComplete(tenantId: string): Promise<boolean> {
  // The "has a school year" check reads `session_years`, the canonical store
  // (OD1). It used to read school_settings.academic_year, a second copy that
  // the Organisation page no longer writes — left as it was, onboarding would
  // have gone permanently incomplete for every school.
  const [row, currentYear] = await Promise.all([
    db
      .select({
        logoUrl: tenants.logoUrl,
        address: schoolSettings.address,
      })
      .from(tenants)
      .leftJoin(
        schoolSettings,
        and(eq(schoolSettings.tenantId, tenants.id), eq(schoolSettings.tenantId, tenantId)),
      )
      .where(eq(tenants.id, tenantId))
      .limit(1),
    getCurrentSessionYear(tenantId),
  ]);

  const settings = row[0];
  return Boolean(
    settings?.logoUrl?.trim()
    && settings.address?.trim()
    && currentYear,
  );
}
