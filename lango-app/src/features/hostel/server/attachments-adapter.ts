// Attachments adapter — the ONLY boundary the hostel module uses to attach
// documents to hostel entities (leave-pass justification, consent PDFs, damage
// photos). Contract only in phases 0-3: the entity-linked document flow is a
// phase-4 deliverable, so every call here raises HostelAttachmentUnavailable.
// No phase 0-3 code path invokes this; it exists so the seam is explicit.
export class HostelAttachmentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostelAttachmentUnavailableError';
  }
}

export type HostelAttachmentPurpose = 'leave_pass_justification' | 'guardian_consent' | 'damage_evidence';

export type AttachDocumentInput = {
  tenantId: string;
  allocationId: string;
  purpose: HostelAttachmentPurpose;
  file: File;
};

export type AttachDocumentResult = { attachmentId: string };

/** Attach a document to an allocation. Phase 4: delegates to the attachments
 * feature (digitalAssets + digitalAssetTargets with targetKind 'user'). */
export async function attachDocument(_input: AttachDocumentInput): Promise<AttachDocumentResult> {
  throw new HostelAttachmentUnavailableError('La gestion des pièces jointes est prévue en phase 4.');
}
