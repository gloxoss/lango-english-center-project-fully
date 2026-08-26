import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { listPublicEvents } from '@/features/events/services/events-service';

export default async function SchoolEventsPage({
  params,
}: {
  params: Promise<{ locale: string; tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);
  if (!site || !site.theme) return null;
  const { theme } = site;

  const events = await listPublicEvents(site.tenant.id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <h1 style={{ color: theme.colorText }} className="text-3xl font-extrabold">Événements</h1>
      {events.length === 0 && (
        <p style={{ color: theme.colorTextSecondary }}>Aucun événement public annoncé pour le moment.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map(event => {
          const next = event.occurrences[0];
          return (
            <div
              key={event.id}
              style={{ borderRadius: `${theme.borderRadius}px` }}
              className="overflow-hidden border border-slate-200 p-5 space-y-3"
            >
              <h3 style={{ color: theme.colorText }} className="font-bold text-lg">{event.title}</h3>
              {event.description && (
                <p style={{ color: theme.colorTextSecondary }} className="text-sm leading-relaxed">{event.description}</p>
              )}
              {next && (
                <p style={{ color: theme.colorTextSecondary }} className="text-xs">
                  {new Date(next.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}
                  {new Date(next.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(next.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {event.venueName && (
                <p style={{ color: theme.colorTextSecondary }} className="text-xs">{event.venueName}</p>
              )}
              {event.onlineLink && (
                <a
                  href={event.onlineLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: theme.colorPrimary }}
                  className="text-xs font-bold underline"
                >
                  Rejoindre en ligne
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
