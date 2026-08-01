export function exportToCsv<T extends object>(
  rows: T[],
  filename: string
): void {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]!);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map((header) => {
          const val = (row as Record<string, any>)[header];
          const escaped = String(val ?? '').replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
