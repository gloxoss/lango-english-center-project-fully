import { resolveSite } from '@/features/website/ui/public/site-resolver';
import Link from 'next/link';
import { getPublicPage, listPublicNews } from '@/features/website/services/website-service';

// Public-site wording; these pages do not load the app's message files.
const NEWS_LABELS: Record<string, { title: string; all: string }> = {
  fr: { title: 'Actualités', all: 'Toutes les actualités' },
  en: { title: 'News', all: 'All news' },
  ar: { title: 'الأخبار', all: 'كل الأخبار' },
};

type HomeContent = {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  slides?: { imageUrl: string; headline: string; subtext?: string }[];
  features?: { icon: string; title: string; description: string }[];
  testimonials?: { quote: string; author: string; role?: string }[];
};

export default async function SchoolHomePage({ params }: { params: Promise<{ locale: string; tenantSlug: string }> }) {
  const { locale, tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) {
    return null; // layout renders 404 / coming-soon for these cases
  }
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'home');
  // Published news belongs on the home page too; it was only reachable by URL (audit S-55).
  const { rows: latestNews } = await listPublicNews(site.tenant.id, { limit: 3, offset: 0 });
  const newsLabels = NEWS_LABELS[locale] ?? NEWS_LABELS.fr!;
  const content = (page?.content ?? {}) as HomeContent;
  const radius = `${theme.borderRadius}px`;

  return (
    <div>
      <section style={{ backgroundColor: theme.colorPrimary }} className="px-6 py-20 text-white text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Explicit white: a global heading colour overrode the section's text-white (audit S-55). */}
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">{content.heroTitle || page?.title || theme.siteTitle}</h1>
          {content.heroSubtitle && <p className="text-lg opacity-90">{content.heroSubtitle}</p>}
        </div>
      </section>

      {content.heroImageUrl && (
        <div className="max-w-5xl mx-auto px-6 -mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.heroImageUrl} alt={content.heroTitle ?? ''} style={{ borderRadius: radius }} className="w-full h-72 object-cover shadow-lg border border-slate-200" />
        </div>
      )}

      {content.slides && content.slides.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.slides.map((s, i) => (
            <div key={i} style={{ borderRadius: radius }} className="overflow-hidden border border-slate-200">
              {s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt={s.headline} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 style={{ color: theme.colorText }} className="font-bold">{s.headline}</h3>
                {s.subtext && <p style={{ color: theme.colorTextSecondary }} className="text-sm mt-1">{s.subtext}</p>}
              </div>
            </div>
          ))}
        </section>
      )}

      {content.features && content.features.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {content.features.map((f, i) => (
            <div key={i} className="text-center space-y-2">
              <div style={{ backgroundColor: theme.colorPrimary, borderRadius: radius }} className="w-12 h-12 mx-auto flex items-center justify-center text-white text-sm font-bold">
                {f.icon?.slice(0, 2).toUpperCase()}
              </div>
              <h3 style={{ color: theme.colorText }} className="font-bold">{f.title}</h3>
              <p style={{ color: theme.colorTextSecondary }} className="text-sm">{f.description}</p>
            </div>
          ))}
        </section>
      )}

      {content.testimonials && content.testimonials.length > 0 && (
        <section style={{ backgroundColor: `${theme.colorMenuBackground}0d` }} className="px-6 py-16">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.testimonials.map((t, i) => (
              <div key={i} style={{ borderRadius: radius }} className="bg-white p-6 border border-slate-200">
                <p style={{ color: theme.colorText }} className="italic">&ldquo;{t.quote}&rdquo;</p>
                <p style={{ color: theme.colorTextSecondary }} className="text-sm font-bold mt-3">{t.author}{t.role ? ` — ${t.role}` : ''}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {latestNews.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 style={{ color: theme.colorText }} className="text-2xl font-extrabold">{newsLabels.title}</h2>
            <Link href={`/${locale}/${tenantSlug}/news`} style={{ color: theme.colorPrimary }} className="text-sm font-bold hover:underline">{newsLabels.all}</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {latestNews.map(item => (
              <Link key={item.id} href={`/${locale}/${tenantSlug}/news/${item.slug}`} style={{ borderRadius: radius }} className="block border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <h3 style={{ color: theme.colorText }} className="font-bold">{item.title}</h3>
                {item.excerpt && <p style={{ color: theme.colorTextSecondary }} className="text-sm mt-1">{item.excerpt}</p>}
                {item.publishedAt && <p style={{ color: theme.colorTextSecondary }} className="text-xs mt-3">{new Date(item.publishedAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR')}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
