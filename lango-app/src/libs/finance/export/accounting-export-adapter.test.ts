// Accounting export adapters fail closed. The certified CSV/XLSX journal exports
// are wired; the DAMANCOM/INP and Sage connectors stay disabled until their filing
// specs are confirmed, and they must reject with ERP_NOT_IMPLEMENTED rather than
// fabricate a compliant-looking file. Unknown adapter ids resolve to null.
import { describe, expect, it } from 'vitest';
import { getAccountingExportAdapter } from './accounting-export-adapter';

describe('accounting export adapters (fail closed)', () => {
  it('resolves the certified csv and xlsx adapters', () => {
    expect(getAccountingExportAdapter('csv')?.id).toBe('csv');
    expect(getAccountingExportAdapter('xlsx')?.id).toBe('xlsx');
  });

  it('returns null for an unknown adapter id', () => {
    expect(getAccountingExportAdapter('not-a-real-erp')).toBeNull();
  });

  it('DAMANCOM/INP fails closed with ERP_NOT_IMPLEMENTED', async () => {
    const adapter = getAccountingExportAdapter('dammancom');
    expect(adapter).not.toBeNull();
    await expect(adapter!.exportJournal('t', [])).rejects.toMatchObject({ code: 'ERP_NOT_IMPLEMENTED' });
  });

  it('Sage fails closed with ERP_NOT_IMPLEMENTED', async () => {
    const adapter = getAccountingExportAdapter('sage');
    expect(adapter).not.toBeNull();
    await expect(adapter!.exportJournal('t', [])).rejects.toMatchObject({ code: 'ERP_NOT_IMPLEMENTED' });
  });
});
