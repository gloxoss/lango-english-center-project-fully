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
