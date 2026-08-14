import { APIError } from 'better-auth/api';
import { sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { resolveTenantByDomain } from '@/features/platform/services/domains-service';
import { user } from '@/models/Schema';

export const SIGN_IN_EMAIL_PATH = '/sign-in/email';

type ScopedSignInContext = {
  path: string;
  body?: { email?: string };
  request?: Request;
};

function hostnameFromHost(host: string | null): string | null {
  if (!host) return null;
  // tenant_domains stores bare hostnames; a Host header carries an optional port.
  return host.split(':')[0]?.toLowerCase() ?? null;
}

// Scopes the password sign-in to the tenant whose approved domain the browser
// is actually hitting. The Host header is set by the browser/TLS layer, not by
// page JavaScript, so it cannot be spoofed from the login form.
//
// Fails OPEN: when the hostname does not map to an approved tenant domain (the
// default platform experience, local dev, an unregistered custom domain) we do
// nothing and better-auth proceeds exactly as before. Scoping only DENIES a
// mismatched tenant; it never grants. The boundary that actually matters — every
// DB query filtered by the authenticated session's tenantId — is enforced
// downstream regardless, so an unknown host is at worst the status-quo behavior.
export async function scopeSignInToTenant(ctx: ScopedSignInContext): Promise<void> {
  if (ctx.path !== SIGN_IN_EMAIL_PATH || !ctx.body?.email) {
    return;
  }

  const hostname = hostnameFromHost(ctx.request?.headers?.get('host') ?? null);
  if (!hostname) return;

  const resolved = await resolveTenantByDomain(hostname);
  if (!resolved) return;

  const [row] = await db
    .select({ tenantId: user.tenantId })
    .from(user)
    .where(sql`lower(${user.email}) = ${ctx.body.email.trim().toLowerCase()}`)
    .limit(1);

  // Generic message on mismatch: revealing that the account exists but belongs
  // to another school would leak which tenants and emails are registered.
  if (!row || row.tenantId !== resolved.tenantId) {
    throw new APIError('UNAUTHORIZED', {
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Identifiants incorrects. Veuillez réessayer.',
    });
  }
}
