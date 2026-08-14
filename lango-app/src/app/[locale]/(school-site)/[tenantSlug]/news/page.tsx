import Link from 'next/link';
import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { listPublicNews } from '@/features/website/services/website-service';

const PAGE_SIZE = 12;

export default async function SchoolNewsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; tenantSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, tenantSlug } = await params;
  const { page: pageParam } = await searchParams;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const { rows, total } = await listPublicNews(site.tenant.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">Actualités</h1>
      {rows.length === 0 && <p style={{ color: theme.colorTextSecondary }}>Aucune actualité pour le moment.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rows.map(item => (
          <Link
            key={item.id}
            href={`/${locale}/${tenantSlug}/news/${item.slug}`}
            style={{ borderRadius: `${theme.borderRadius}px` }}
            className="overflow-hidden border border-slate-200 block hover:shadow-md transition-shadow"
          >
            {item.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverImageUrl} alt={item.title} className="w-full h-40 object-cover" />
            )}
            <div className="p-4 space-y-1">
              <h3 style={{ color: theme.colorText }} className="font-bold">{item.title}</h3>
              {item.excerpt && <p style={{ color: theme.colorTextSecondary }} className="text-sm">{item.excerpt}</p>}
              {item.publishedAt && (
                <p style={{ color: theme.colorTextSecondary }} className="text-xs opacity-70">
                  {new Date(item.publishedAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/${locale}/${tenantSlug}/news?page=${p}`}
              style={p === page ? { backgroundColor: theme.colorPrimary, color: '#fff' } : undefined}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200"
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
