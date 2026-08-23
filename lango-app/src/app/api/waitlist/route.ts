import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson, waitlistSubmitSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { schoolAccessRequests } from '@/models/Schema';

// Public endpoint: the marketing "early access" form posts here without auth.
// Deliberately NOT requireRequestContext — a school requesting access is, by
// definition, not yet a user of the platform.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    checkRateLimit(`waitlist:${ip}`, 5, 60 * 1000);

    const body = await parseJson(request, waitlistSubmitSchema);

    await db.insert(schoolAccessRequests).values({
      schoolName: body.schoolName,
      contactName: body.contactName,
      city: body.city,
      studentCount: body.studentCount,
      phone: body.phone,
      email: body.email || null,
      status: 'new',
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
