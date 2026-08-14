import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniDocuments, tenants, user } from '@/models/Schema';

const verifyDocumentSchema = z.object({
  code: z.string().trim().min(1).max(32),
  // Basic bot honeypot field - must be empty, same pattern as the public
  // inquiries endpoint.
  website_hp: z.string().optional(),
}).strict();

// Real, public, no-login document verification (future-implementation
// /alumni-portal) - never exposes the file itself, never distinguishes a
// wrong code from a superseded one in its response shape (avoids leaking
// which codes were ever real).
export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    // Tighter than the inquiry endpoint's 5/hour - this is a lookup, not a
    // submission, but still real friction against brute-forcing codes.
    checkRateLimit(`public-doc-verify:${clientIp}`, 10, 60 * 60 * 1000);

    const body = await parseJson(request, verifyDocumentSchema);

    if (body.website_hp && body.website_hp.length > 0) {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    const [row] = await db
      .select({
        alumnusName: user.name,
        documentType: alumniDocuments.documentType,
        issuedAt: alumniDocuments.issuedAt,
        status: alumniDocuments.status,
        schoolName: tenants.name,
      })
      .from(alumniDocuments)
      .innerJoin(user, eq(alumniDocuments.alumnusId, user.id))
      .innerJoin(tenants, eq(alumniDocuments.tenantId, tenants.id))
      .where(eq(alumniDocuments.verificationCode, body.code))
      .limit(1);

    if (!row || row.status !== 'active') {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        alumnusName: row.alumnusName,
        documentType: row.documentType,
        issuedAt: row.issuedAt,
        schoolName: row.schoolName,
      },
    });
  } catch (error) {
    // Real errors (rate limit, validation) surface honestly with their real
    // status code - only a genuine "code not found/superseded" lookup result
    // uses the {valid:false} shape above, never a swallowed error.
    return apiErrorResponse(error);
  }
}
