import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenants } from '@/models/Schema';
import { issuedDocuments } from '@/features/cards/models/cards-schema';

const verifySchema = z.object({
  token: z.string().trim().min(1).max(128),
  // Basic bot honeypot field - must be empty, same pattern as the public
  // alumni-documents verifier and the public inquiries endpoint.
  website_hp: z.string().optional(),
}).strict();

// Real, public, no-login card verification. The response never distinguishes a
// revoked/superseded card from a token that was never issued (identical
// {valid:false} shape - no enumeration difference), and it never echoes the
// renderDataSnapshot (which can contain DOB/NID/guardian data).
export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    checkRateLimit(`public-card-verify:${clientIp}`, 10, 60 * 60 * 1000);

    const body = await parseJson(request, verifySchema);

    if (body.website_hp && body.website_hp.length > 0) {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    const hash = createHash('sha256').update(body.token).digest('hex');

    const [row] = await db
      .select({
        status: issuedDocuments.status,
        subjectType: issuedDocuments.subjectType,
        type: issuedDocuments.type,
        issuedAt: issuedDocuments.issuedAt,
        validUntil: issuedDocuments.validUntil,
        subjectName: issuedDocuments.renderDataSnapshot,
        schoolName: tenants.name,
      })
      .from(issuedDocuments)
      .innerJoin(tenants, eq(issuedDocuments.tenantId, tenants.id))
      .where(eq(issuedDocuments.publicTokenHash, hash))
      .limit(1);

    if (!row || row.status !== 'active') {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    const snapshot = row.subjectName as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        subjectName: typeof snapshot?.subjectName === 'string' ? snapshot.subjectName : '',
        subjectType: row.subjectType,
        documentType: row.type,
        issuedAt: row.issuedAt,
        validUntil: row.validUntil,
        schoolName: row.schoolName,
      },
    });
  } catch (error) {
    // Real errors (rate limit, validation) surface honestly with their real
    // status code - only a genuine "not found/revoked" lookup result uses the
    // {valid:false} shape above, never a swallowed error.
    return apiErrorResponse(error);
  }
}
