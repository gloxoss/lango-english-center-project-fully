export function formatMad(amount: number): string {
  if (Number.isNaN(amount)) {
    return '0 MAD';
  }
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

export function formatPercentage(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) {
    return '—';
  }
  return `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

export function formatStudentCount(count: number): string {
  return count.toLocaleString('fr-FR');
}

// Raw DB timestamps ("2026-09-11 00:00:00") must never reach the screen:
// directors read "Aujourd'hui · 09:42" or "11 sept. 2026 · 14:20".
export function formatPaymentDateTime(value: string, locale: string): string {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  const time = date.toLocaleTimeString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const hasTime = !(time === '00:00' || time === '١٢:٠٠ ص');

  if (dayDiff === 0) {
    return hasTime ? `Aujourd'hui · ${time}` : 'Aujourd\'hui';
  }
  if (dayDiff === 1) {
    return hasTime ? `Hier · ${time}` : 'Hier';
  }
  const dateLabel = date.toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return hasTime ? `${dateLabel} · ${time}` : dateLabel;
}
