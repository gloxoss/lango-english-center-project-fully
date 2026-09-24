// One display format for money everywhere a family or staff member reads an
// amount: grouped thousands, at most two decimals, currency last. Screens used
// to mix "24000 MAD", "146.746,00" and "146 746,00" for the same kind of value.
// Latin digits and fr-FR grouping are the Moroccan convention on invoices, so
// the Arabic UI keeps them too.
const amountFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatAmount(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return amountFormat.format(Number.isFinite(n) ? (n as number) : 0);
}

export function formatMoney(value: number | string | null | undefined, currency = 'MAD'): string {
  return `${formatAmount(value)} ${currency}`;
}
