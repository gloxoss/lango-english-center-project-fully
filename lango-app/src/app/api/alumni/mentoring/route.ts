import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { isEligibleForDirectoryAndMentoring } from '@/libs/services/alumni-safeguarding';
import { db } from '@/libs/DB';
import { alumniMentorListings, user } from '@/models/Schema';

// Real mentor browse list, re-checked for safeguarding at read time too -
// never relies solely on write-time enforcement for a real child-safety
// property (future-implementation/alumni-portal).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({
        id: alumniMentorListings.id,
        alumnusId: alumniMentorListings.alumnusId,
        name: user.name,
        offering: alumniMentorListings.offering,
        contactPreference: alumniMentorListings.contactPreference,
        dateOfBirth: user.dateOfBirth,
      })
      .from(alumniMentorListings)
      .innerJoin(user, eq(alumniMentorListings.alumnusId, user.id))
      .where(and(eq(alumniMentorListings.tenantId, tenantId), eq(alumniMentorListings.isActive, true)));

    const results = rows
      .filter(r => isEligibleForDirectoryAndMentoring(r.dateOfBirth))
      .map(({ dateOfBirth: _dob, ...r }) => r);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
