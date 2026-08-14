import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { getPublicPage } from '@/features/website/services/website-service';

type ContactContent = { intro?: string; mapEmbedUrl?: string };

export default async function SchoolContactPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const page = await getPublicPage(site.tenant.id, 'contact');
  const content = (page?.content ?? {}) as ContactContent;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">{page?.title || 'Contact'}</h1>
      {content.intro && <p style={{ color: theme.colorTextSecondary }} className="whitespace-pre-line leading-relaxed">{content.intro}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ul style={{ color: theme.colorTextSecondary }} className="space-y-2 text-sm">
          {theme.address && <li><strong style={{ color: theme.colorText }}>Adresse:</strong> {theme.address}</li>}
          {theme.phone && <li><strong style={{ color: theme.colorText }}>Téléphone:</strong> {theme.phone}</li>}
          {theme.email && <li><strong style={{ color: theme.colorText }}>Email:</strong> {theme.email}</li>}
          {theme.workingHours && <li><strong style={{ color: theme.colorText }}>Horaires:</strong> {theme.workingHours}</li>}
        </ul>
        {content.mapEmbedUrl && (
          <iframe
            src={content.mapEmbedUrl}
            style={{ borderRadius: `${theme.borderRadius}px`, border: 0 }}
            className="w-full h-64"
            loading="lazy"
            title="Carte"
          />
        )}
      </div>
    </div>
  );
}
