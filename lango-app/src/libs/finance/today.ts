// today.ts — Audit 5, item 6: "today" for money and attendance is the
// school's calendar day in Casablanca, not the server's UTC date. A UTC
// midnight ISO slice reports yesterday evening during Moroccan mornings.
export function casablancaTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Wall-clock "HH:MM" in Casablanca, for comparing against a timetable slot's
// stored start/end text. The server's own clock is UTC, so comparing a lesson
// end time against it would misjudge every session for most of the working day.
export function casablancaTimeHm(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

const CASABLANCA_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Casablanca',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** The Casablanca UTC offset (ms) in effect at `instant` (handles the DST/Ramadan shift). */
function casablancaOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(CASABLANCA_PARTS.formatToParts(instant).map(p => [p.type, p.value]));
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return asUtc - instant.getTime();
}

/**
 * UTC instant for a Casablanca wall-clock date+time ("YYYY-MM-DD", "HH:MM").
 * Two-pass offset resolution keeps the answer exact on the hours the offset
 * changes (e.g. the Ramadan switch) without pulling in a tz library.
 */
export function casablancaWallTimeUtc(dateIso: string, hhmm: string): Date {
  const [year, month, day] = dateIso.split('-').map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(':').map(Number) as [number, number];
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const first = new Date(naive.getTime() - casablancaOffsetMs(naive));
  const second = new Date(naive.getTime() - casablancaOffsetMs(first));
  return second;
}

/** [start, end) UTC instants of the Casablanca calendar day containing `now`. */
export function casablancaDayBoundsUtc(now: Date = new Date()): { start: Date; end: Date } {
  const dateIso = casablancaTodayIso(now);
  const start = casablancaWallTimeUtc(dateIso, '00:00');
  const [year, month, day] = dateIso.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return { start, end: casablancaWallTimeUtc(nextIso, '00:00') };
}
