import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { inquiries, tenants } from '@/models/Schema';

const publicInquirySchema = z.object({
  contactName: z.string().trim().min(1, 'Le nom est requis').max(255),
  phone: z.string().trim().optional(),
  email: z.string().email('Email non valide').optional().or(z.literal('')),
  notes: z.string().trim().optional(),
  // Basic bot honeypot field - must be empty
  website_hp: z.string().optional(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const resolvedParams = await params;
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Strict public rate limit: max 5 submissions per hour per IP
    checkRateLimit(`public-inquiry:${clientIp}:${resolvedParams.tenantSlug}`, 5, 60 * 60 * 1000);

    const body = await parseJson(request, publicInquirySchema);

    // Bot honeypot check
    if (body.website_hp && body.website_hp.length > 0) {
      // Quietly reject bot submissions
      return NextResponse.json({ success: true, message: 'Demande reçue.' });
    }

    const [tenant] = await db
      .select({ id: tenants.id, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.slug, resolvedParams.tenantSlug))
      .limit(1);

    if (!tenant || !tenant.isActive) {
      throw new ApiError(404, 'NOT_FOUND', 'Établissement introuvable ou inactif.');
    }

    await db
      .insert(inquiries)
      .values({
        tenantId: tenant.id,
        contactName: body.contactName,
        phone: body.phone || null,
        email: body.email || null,
        notes: body.notes || null,
        source: 'web',
        status: 'new',
        interestLevel: 'medium',
      });

    return NextResponse.json({
      success: true,
      message: 'Votre demande de renseignements a été envoyée avec succès. Notre équipe vous contactera sous peu.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
