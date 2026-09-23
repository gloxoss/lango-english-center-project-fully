import Link from 'next/link';
import type { getEventDetail } from '@/features/events/services/event-operations-service';

type Detail = Awaited<ReturnType<typeof getEventDetail>>;

const copy = {
  fr: { back: 'Événements', when: 'Date', where: 'Lieu', noDate: 'Date à confirmer', noVenue: 'Lieu à confirmer' },
  en: { back: 'Events', when: 'Date', where: 'Location', noDate: 'Date to be confirmed', noVenue: 'Location to be confirmed' },
  ar: { back: 'الفعاليات', when: 'التاريخ', where: 'المكان', noDate: 'التاريخ سيحدد لاحقاً', noVenue: 'المكان سيحدد لاحقاً' },
};

export function EventFamilyDetailView({ detail, locale }: { detail: Detail; locale: string }) {
  const labels = copy[locale as keyof typeof copy] ?? copy.fr;
  const firstOccurrence = detail.occurrences[0];
  const firstVenue = detail.venues[0];
  const date = firstOccurrence
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(firstOccurrence.startTime))
    : labels.noDate;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Link href={`/${locale}/dashboard/events`} className="text-sm text-primary hover:underline">
        ← {labels.back}
      </Link>
      <article className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{detail.event.title}</h1>
        {detail.event.description && <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{detail.event.description}</p>}
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">{labels.when}</dt><dd className="font-medium">{date}</dd></div>
          <div><dt className="text-sm text-muted-foreground">{labels.where}</dt><dd className="font-medium">{firstVenue?.name || labels.noVenue}</dd></div>
        </dl>
      </article>
    </main>
  );
}
