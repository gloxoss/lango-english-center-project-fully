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
