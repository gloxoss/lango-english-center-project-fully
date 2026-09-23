// One CSV cell writer for every export. Names and notes can come from public
// forms (admission inquiries), so a value starting with = + - @ tab or CR is
// prefixed with ' to stop Excel/LibreOffice evaluating it as a formula.
// Plain numbers (e.g. -120.50 in a trial balance) are left as numbers.

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function csvSafeCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str) && !NUMERIC.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function csvSafeRow(values: unknown[]): string {
  return values.map(csvSafeCell).join(',');
}
