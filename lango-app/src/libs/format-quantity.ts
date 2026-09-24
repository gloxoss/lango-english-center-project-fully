// Stock quantities are stored as numeric(…,3), so the API returns strings like
// "12.000". Rendered raw, a French reader takes that for twelve thousand. Show
// the value with fr-FR grouping and only the decimals it really has.
const quantityFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export function formatQuantity(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return quantityFormat.format(Number.isFinite(n) ? (n as number) : 0);
}
