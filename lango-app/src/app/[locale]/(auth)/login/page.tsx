import { headers } from 'next/headers';
import { LoginClient } from './login-client';

import { db } from '@/libs/DB';
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
        logoUrl: tenant.logoUrl,
      };
    }
  }

  return <LoginClient tenantSlug={tenantSlug} tenantData={tenantData} />;
}
