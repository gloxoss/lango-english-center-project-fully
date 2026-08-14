import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicPage } from '@/features/website/services/website-service';

type GalleryContent = {
  categories?: { name: string }[];
  items?: { imageUrl: string; caption?: string; category?: string }[];
};

export default async function SchoolGalleryPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'gallery');
  const content = (page?.content ?? {}) as GalleryContent;
  const items = content.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{page?.title || 'Galerie'}</h1>
      {items.length === 0 && <p style={{ color: theme.colorTextSecondary }}>Aucune photo pour le moment.</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <figure key={i} style={{ borderRadius: `${theme.borderRadius}px` }} className="overflow-hidden border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.caption ?? ''} className="w-full h-40 object-cover" />
            {item.caption && (
              <figcaption style={{ color: theme.colorTextSecondary }} className="text-xs p-2">{item.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
