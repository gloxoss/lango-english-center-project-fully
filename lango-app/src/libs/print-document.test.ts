import { describe, expect, it, vi } from 'vitest';
import { printInvoiceDocument, printReceiptDocument, printStatementDocument } from '@/features/finance/ui/finance-document-print';
import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';

vi.mock('@/features/documents/ui/pdf-preview', () => ({ openDocumentPreview: vi.fn() }));

describe('finance document actions', () => {
  it('passes only source identifiers and filters to the protected PDF preview', () => {
    printInvoiceDocument({ id: 'invoice-id' }, {}, 'fr');
    printReceiptDocument({ id: 'receipt-id' }, {}, 'fr');
    printStatementDocument({ studentId: 'student-id', period: { startDate: '2026-01-01', endDate: '2026-01-31' } }, {}, 'fr');

    expect(openDocumentPreview).toHaveBeenNthCalledWith(1, { kind: 'invoice', sourceId: 'invoice-id' }, 'fr');
    expect(openDocumentPreview).toHaveBeenNthCalledWith(2, { kind: 'receipt', sourceId: 'receipt-id' }, 'fr');
    expect(openDocumentPreview).toHaveBeenNthCalledWith(3, { kind: 'statement', sourceId: 'student-id', startDate: '2026-01-01', endDate: '2026-01-31' }, 'fr');
  });
});
