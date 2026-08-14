import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicPage } from '@/features/website/services/website-service';

type AboutContent = { body?: string; missionText?: string; historyText?: string };

export default async function SchoolAboutPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'about');
  const content = (page?.content ?? {}) as AboutContent;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{page?.title || 'À propos'}</h1>
      {!page && <p style={{ color: theme.colorTextSecondary }}>Contenu à venir.</p>}
      {content.body && <p style={{ color: theme.colorTextSecondary }} className="whitespace-pre-line leading-relaxed">{content.body}</p>}
      {content.missionText && (
        <div>
          <h2 style={{ color: theme.colorText }} className="text-xl font-bold mb-2">Notre mission</h2>
          <p style={{ color: theme.colorTextSecondary }} className="whitespace-pre-line leading-relaxed">{content.missionText}</p>
        </div>
      )}
      {content.historyText && (
        <div>
          <h2 style={{ color: theme.colorText }} className="text-xl font-bold mb-2">Notre histoire</h2>
          <p style={{ color: theme.colorTextSecondary }} className="whitespace-pre-line leading-relaxed">{content.historyText}</p>
        </div>
      )}
    </div>
  );
}
