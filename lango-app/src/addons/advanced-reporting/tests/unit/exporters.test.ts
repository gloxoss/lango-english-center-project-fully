import { describe, expect, it } from 'vitest';
import { CsvExporter } from '../../services/exporters/csv-exporter';
import type { ColumnDefinition } from '../../types/reporting-types';

describe('CsvExporter Formula Injection Defense', () => {
  it('prefixes leading =, +, -, @ characters with single quote', () => {
    expect(CsvExporter.sanitizeValue('=1+2')).toBe("'=1+2");
    expect(CsvExporter.sanitizeValue('+CMD')).toBe("'+CMD");
    expect(CsvExporter.sanitizeValue('-MINUS')).toBe("'-MINUS");
    expect(CsvExporter.sanitizeValue('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(CsvExporter.sanitizeValue('Normal String')).toBe('Normal String');
  });

  it('escapes cells containing commas and double quotes', () => {
    const columns: ColumnDefinition[] = [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'val', label: 'Value', type: 'string' },
    ];
    const data = [
      { name: 'Alami, Yassine', val: '=SUM(10,20)' },
    ];

    const csv = CsvExporter.generateCsv(columns, data);
    expect(csv).toContain('"Alami, Yassine"');
    expect(csv).toContain("'=SUM(10,20)");
  });
});
