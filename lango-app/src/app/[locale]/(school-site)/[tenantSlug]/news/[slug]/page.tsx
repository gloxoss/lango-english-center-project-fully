import { notFound } from 'next/navigation';
import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicNewsBySlug } from '@/features/website/services/website-service';

export default async function SchoolNewsDetailPage({ params }: { params: Promise<{ tenantSlug: string; slug: string }> }) {
  const { tenantSlug, slug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const item = await getPublicNewsBySlug(site.tenant.id, slug);
  if (!item) {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-16 space-y-6">
      {item.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverImageUrl}
          alt={item.title}
          style={{ borderRadius: `${theme.borderRadius}px` }}
          className="w-full h-72 object-cover border border-slate-200"
        />
      )}
      <div>
        <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{item.title}</h1>
        {item.publishedAt && (
          <p style={{ color: theme.colorTextSecondary }} className="text-sm mt-1">
            {new Date(item.publishedAt).toLocaleDateString('fr-FR')}
          </p>
        )}
      </div>
      {item.body && (
        <div style={{ color: theme.colorTextSecondary }} className="whitespace-pre-line leading-relaxed">{item.body}</div>
      )}
    </article>
  );
}
