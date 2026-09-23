export function formatMad(amount: number): string {
  if (isNaN(amount)) return '0 MAD';
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

export function formatPercentage(rate: number | null): string {
  if (rate === null || isNaN(rate)) return '—';
  return `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

export function formatStudentCount(count: number): string {
  return count.toLocaleString('fr-FR');
}
