import type { ColumnDefinition } from '../../types/reporting-types';

export class CsvExporter {
  /**
   * Sanitizes a string value to prevent CSV formula injection.
   * If a value starts with =, +, -, or @, it is prefixed with a single quote.
   */
  static sanitizeValue(val: any): string {
    if (val === null || val === undefined) {
      return '';
    }
    const str = String(val).trim();
    if (str.length > 0 && ['=', '+', '-', '@'].includes(str.charAt(0))) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Generates CSV string content from columns schema and dataset rows.
   */
  static generateCsv(columns: ColumnDefinition[], data: Record<string, any>[]): string {
    const headers = columns.map(c => this.escapeCsvCell(c.label)).join(',');
    const rows = data.map(row => {
      return columns
        .map(c => {
          const rawVal = row[c.key];
          const sanitized = this.sanitizeValue(rawVal);
          return this.escapeCsvCell(sanitized);
        })
        .join(',');
    });

    return [headers, ...rows].join('\n');
  }

  private static escapeCsvCell(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
