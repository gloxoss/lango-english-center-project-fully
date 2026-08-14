import { and, eq, ilike, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { isEligibleForDirectoryAndMentoring } from '@/libs/services/alumni-safeguarding';
import { db } from '@/libs/DB';
import { alumniDirectoryConsent, sessionYears, user } from '@/models/Schema';

// Real, alumni-to-alumni directory search (future-implementation
// /alumni-portal) - excludes ineligible (under-18/unknown-age) alumni from
// the result set entirely, and projects ONLY the fields each row opted
// into, never more.
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const cohort = searchParams.get('cohort');

    const conditions = [
      eq(user.tenantId, tenantId),
      eq(user.role, 'alumni'),
      or(
        eq(alumniDirectoryConsent.showName, true),
        eq(alumniDirectoryConsent.showCohort, true),
        eq(alumniDirectoryConsent.showCurrentEmployer, true),
        eq(alumniDirectoryConsent.showContactInfo, true),
      )!,
    ];
    if (search) {
      conditions.push(ilike(user.name, `%${search}%`));
    }
    if (cohort) {
      conditions.push(eq(sessionYears.name, cohort));
    }

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cohortName: sessionYears.name,
        showName: alumniDirectoryConsent.showName,
        showCohort: alumniDirectoryConsent.showCohort,
        showCurrentEmployer: alumniDirectoryConsent.showCurrentEmployer,
        showContactInfo: alumniDirectoryConsent.showContactInfo,
        currentEmployer: alumniDirectoryConsent.currentEmployer,
      })
      .from(alumniDirectoryConsent)
      .innerJoin(user, eq(alumniDirectoryConsent.alumnusId, user.id))
      .leftJoin(sessionYears, eq(user.graduationCohortSessionYearId, sessionYears.id))
      .where(and(...conditions));

    const results = rows
      .filter(r => isEligibleForDirectoryAndMentoring(r.dateOfBirth))
      .map(r => ({
        id: r.id,
        name: r.showName ? r.name : null,
        cohortName: r.showCohort ? r.cohortName : null,
        currentEmployer: r.showCurrentEmployer ? r.currentEmployer : null,
        email: r.showContactInfo ? r.email : null,
        phone: r.showContactInfo ? r.phone : null,
      }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
