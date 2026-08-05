import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { creditNotes } from '@/models/Schema';

export type DecideCreditNoteInput = {
  tenantId: string;
  id: string;
  decision: 'approved' | 'rejected';
  decidedById: string;
  rejectionReason?: string;
};

/** Shared by POST /api/finance/credit-notes/[approve] and the accountant approvals queue - one state transition, two entry points. */
export async function decideCreditNote(input: DecideCreditNoteInput) {
  const [existing] = await db.select().from(creditNotes)
    .where(and(eq(creditNotes.id, input.id), eq(creditNotes.tenantId, input.tenantId))).limit(1);
  if (!existing) {
    throw new ApiError(404, 'CREDIT_NOTE_NOT_FOUND', 'Note de crédit introuvable.');
  }
  if (existing.status !== 'pending') {
    throw new ApiError(409, 'ALREADY_DECIDED', `Cette note de crédit est déjà ${existing.status === 'approved' ? 'approuvée' : 'rejetée'}.`);
  }
  if (input.decision === 'rejected' && !input.rejectionReason) {
    throw new ApiError(422, 'REASON_REQUIRED', 'Un motif est requis pour rejeter une note de crédit.');
  }

  const [updated] = await db.update(creditNotes).set({
    status: input.decision,
    approvedById: input.decidedById,
    approvedAt: new Date().toISOString(),
    rejectionReason: input.decision === 'rejected' ? input.rejectionReason : null,
  }).where(and(eq(creditNotes.id, input.id), eq(creditNotes.tenantId, input.tenantId))).returning();

  return updated;
}
