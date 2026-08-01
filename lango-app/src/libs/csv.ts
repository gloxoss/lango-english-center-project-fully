// ponytail: a small hand-rolled CSV parser (handles quoted fields with
// embedded commas) rather than a new dependency - CSV is a simple enough
// format that this is genuinely less code than adding papaparse for two
// import features (students, teachers).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      field = '';
      if (row.some(c => c.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(c => c.trim() !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

export function findCsvColumn(header: string[], candidates: string[]): number {
  const normalized = header.map(h => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) {
      return idx;
    }
  }
  return -1;
}
