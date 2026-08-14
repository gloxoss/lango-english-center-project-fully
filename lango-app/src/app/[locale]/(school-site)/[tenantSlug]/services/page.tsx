import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicPage } from '@/features/website/services/website-service';

type ServicesContent = { items?: { title: string; description: string; imageUrl?: string; priceLabel?: string }[] };

export default async function SchoolServicesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'services');
  const content = (page?.content ?? {}) as ServicesContent;
  const items = content.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{page?.title || 'Nos services'}</h1>
      {items.length === 0 && <p style={{ color: theme.colorTextSecondary }}>Aucun service pour le moment.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <div key={i} style={{ borderRadius: `${theme.borderRadius}px` }} className="overflow-hidden border border-slate-200">
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover" />
            )}
            <div className="p-4 space-y-1">
              <h3 style={{ color: theme.colorText }} className="font-bold">{item.title}</h3>
              <p style={{ color: theme.colorTextSecondary }} className="text-sm">{item.description}</p>
              {item.priceLabel && (
                <p style={{ color: theme.colorPrimary }} className="text-sm font-bold pt-1">{item.priceLabel}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
