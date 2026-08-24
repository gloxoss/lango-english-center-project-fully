import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { consumeDocumentNumber } from '@/libs/finance/document-number';
import { centsToMoney } from '@/libs/finance/money';
import { receipts } from '@/features/finance/models/student-accounting-schema';

type ReceiptClient = Pick<typeof db, 'execute' | 'select' | 'insert' | 'update'>;

export interface ReceiptAllocation {
  invoiceId: string;
  invoiceNumber: string;
  amount: string; // decimal string, e.g. "1250.00"
}

export interface CreateReceiptOptions {
  tenantId: string;
  studentId: string;
  amountCents: bigint;
  paymentDate: string; // YYYY-MM-DD
  allocations: ReceiptAllocation[];
  createdById: string | null;
}

// Persists a receipt with an atomically-issued RC-{year}- number. MUST be called
// inside the caller's db.transaction so the number and the payment it documents
// commit or roll back together — a receipt never exists without its payment.
export async function createReceipt(client: ReceiptClient, opts: CreateReceiptOptions) {
  const receiptNumber = await consumeDocumentNumber(client, { tenantId: opts.tenantId, prefix: `RC-${new Date().getFullYear()}-` });
  const [row] = await client
    .insert(receipts)
    .values({
      tenantId: opts.tenantId,
      receiptNumber,
      studentId: opts.studentId,
      amount: Number(centsToMoney(opts.amountCents)),
      paymentDate: opts.paymentDate,
      allocations: opts.allocations,
      createdById: opts.createdById,
    })
    .returning();
  if (!row) {
    throw new ApiError(500, 'RECEIPT_INSERT_FAILED', 'Reçu non enregistré.');
  }
  return row;
}
