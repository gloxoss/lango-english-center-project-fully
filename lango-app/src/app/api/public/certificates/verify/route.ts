import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';
import {
  certificateDefinitions,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

const verifySchema = z.object({
  token: z.string().trim().min(1).max(128),
  website_hp: z.string().optional(),
}).strict();

// Public, no-login certificate verification. The response never distinguishes a
// revoked/replaced certificate from a token that was never issued (identical
// {valid:false} shape - no enumeration difference), and it never echoes
// evidenceSnapshot (no DOB/NID/salary/guardian/internal notes).
export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    checkRateLimit(`public-cert-verify:${clientIp}`, 10, 60 * 60 * 1000);

    const body = await parseJson(request, verifySchema);

    if (body.website_hp && body.website_hp.length > 0) {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    const hash = createHash('sha256').update(body.token).digest('hex');

    const [row] = await db.select({
      status: issuedCertificates.status,
      serialNumber: issuedCertificates.serialNumber,
      issuedAt: issuedCertificates.issuedAt,
      definitionTitle: certificateDefinitions.title,
      recipientName: user.name,
      schoolName: tenants.name,
    })
      .from(issuedCertificates)
      .innerJoin(certificateDefinitions, eq(certificateDefinitions.id, issuedCertificates.definitionId))
      .innerJoin(tenants, eq(issuedCertificates.tenantId, tenants.id))
      .leftJoin(user, eq(user.id, issuedCertificates.recipientId))
      .where(and(
        eq(issuedCertificates.verificationTokenHash, hash),
        eq(issuedCertificates.tenantId, tenants.id),
      ))
      .limit(1);

    if (!row || row.status !== 'valid') {
      return NextResponse.json({ success: true, data: { valid: false } });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        recipientName: row.recipientName ?? '',
        certificateTitle: row.definitionTitle,
        serialNumber: row.serialNumber,
        issuedAt: row.issuedAt,
        schoolName: row.schoolName,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
