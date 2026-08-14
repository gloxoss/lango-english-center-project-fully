import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicPage } from '@/features/website/services/website-service';

type FaqContent = { items?: { question: string; answer: string }[] };

export default async function SchoolFaqPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'faq');
  const content = (page?.content ?? {}) as FaqContent;
  const items = content.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{page?.title || 'Questions fréquentes'}</h1>
      {items.length === 0 && <p style={{ color: theme.colorTextSecondary }}>Aucune question pour le moment.</p>}
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} style={{ borderRadius: `${theme.borderRadius}px` }} className="border border-slate-200 p-5">
            <h3 style={{ color: theme.colorText }} className="font-bold mb-2">{item.question}</h3>
            <p style={{ color: theme.colorTextSecondary }} className="text-sm whitespace-pre-line">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
