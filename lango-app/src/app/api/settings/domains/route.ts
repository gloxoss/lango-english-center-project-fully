import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requirePlanTier } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';

const RESERVED_SUBDOMAINS = new Set([
  'app', 'api', 'auth', 'admin', 'mail', 'support', 'static', 'cdn',
  'demo', 'staging', 'dev', 'super-admin', 'billing', 'gateway', 'schoolos'
]);

const requestDomainSchema = z.object({
  domain: z.string().min(3).max(255),
  domainType: z.enum(['subdomain', 'custom']),
}).strict();

const deleteDomainSchema = z.object({
  domainId: z.string().uuid(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    const domains = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId))
      .orderBy(desc(tenantDomains.createdAt));

    return NextResponse.json({ success: true, data: domains });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    // Gate on plan tier
    await requirePlanTier(context, ['standard', 'premium']);

    const parsed = await parseJson(request, requestDomainSchema);
    const domainClean = parsed.domain.trim().toLowerCase();

    // Basic validation for subdomain vs custom domain format
    if (parsed.domainType === 'subdomain') {
      if (!/^[a-z0-9-]+$/.test(domainClean)) {
        throw new ApiError(400, 'BAD_REQUEST', 'Un sous-domaine ne peut contenir que des lettres minuscules, des chiffres et des tirets.');
      }
      if (RESERVED_SUBDOMAINS.has(domainClean)) {
        throw new ApiError(400, 'BAD_REQUEST', `Le sous-domaine "${domainClean}" est un terme réservé de la plateforme.`);
      }
    } else {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domainClean)) {
        throw new ApiError(400, 'BAD_REQUEST', 'Format de domaine personnalisé invalide. Exemple : www.monecole.ma');
      }
    }

    // Check if domain already exists
    const [existing] = await db
      .select({ id: tenantDomains.id })
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, domainClean))
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'DOMAIN_EXISTS', 'Ce nom de domaine ou sous-domaine est déjà enregistré.');
    }

    const verificationToken = parsed.domainType === 'custom'
      ? `schoolos-verify-${crypto.randomBytes(12).toString('hex')}`
      : null;

    const [created] = await db.insert(tenantDomains).values({
      tenantId,
      domain: domainClean,
      domainType: parsed.domainType,
      status: 'pending',
      verificationToken,
      requestedById: context.userId,
    }).returning();

    if (created) {
      recordAudit(context, 'create', 'tenant_domain', created.id, {
        domain: created.domain,
        domainType: created.domainType,
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    const parsed = await parseJson(request, deleteDomainSchema);

    const [existing] = await db
      .select()
      .from(tenantDomains)
      .where(
        and(
          eq(tenantDomains.id, parsed.domainId),
          eq(tenantDomains.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Domaine introuvable.');
    }

    await db
      .delete(tenantDomains)
      .where(
        and(
          eq(tenantDomains.id, parsed.domainId),
          eq(tenantDomains.tenantId, tenantId)
        )
      );

    recordAudit(context, 'delete', 'tenant_domain', parsed.domainId, {
      domain: existing.domain,
    });

    return NextResponse.json({ success: true, message: 'Demande supprimée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

