import { headers } from 'next/headers';
import { LoginClient } from './login-client';

import { db } from '@/libs/DB';
import { publicBrandingUrl } from '@/libs/api/uploads';
import { tenants } from '@/models/Schema';
import { eq } from 'drizzle-orm';

export default async function LoginPage() {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') || undefined;

  let tenantData = undefined;
  if (tenantSlug) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug));
    if (tenant) {
      tenantData = {
        name: tenant.name,
        // tenants.logoUrl is a bare filename, and this page used to hand it
        // straight to <img src>, so a tenant that uploaded a logo got a broken
        // image requesting /fr/logo.png. Resolved to the public endpoint that
        // serves the file, or to null so the client renders its fallback.
        logoUrl: await publicBrandingUrl(tenant, 'logo'),
      };
    }
  }

  return <LoginClient tenantSlug={tenantSlug} tenantData={tenantData} />;
}
