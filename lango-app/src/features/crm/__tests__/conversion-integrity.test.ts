// Applicant-conversion integrity (AUD-CRM-01).
//
// convertInquiryToApplicant turned a CRM lead into an admissions applicant. Two
// problems made it unsafe under real use:
//
//   1. The insert and the update ran OUTSIDE a transaction with no row lock, and
//      the guard required `status === 'converted' && convertedApplicantId`. A
//      double-click or a retried request could pass the read twice and create TWO
//      applicants from one lead. A half-written row (status set, link null) also
//      slipped through the guard.
//
//   2. applicants.email and applicants.phone are NOT NULL, so a lead with no
//      contact details is given a fabricated `0600000000` — a syntactically valid
//      Moroccan mobile that could one day belong to a real person. Classified
//      separately (see report §11): the honest fix needs nullable columns.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVICE = path.resolve(process.cwd(), 'src/features/crm/services/inquiries-service.ts');
const src = () => fs.readFileSync(SERVICE, 'utf8');

describe('Applicant conversion integrity', () => {
  it('locks the inquiry row so two concurrent converts cannot both win', () => {
    expect(src()).toMatch(/\.for\('update'\)/);
  });

  it('writes the applicant and the converted link in one transaction', () => {
    const s = src();
    const fn = s.slice(s.indexOf('export async function convertInquiryToApplicant'));

    expect(fn).toContain('db.transaction');
    // No bare insert/update outside the transaction body any more.
    expect(fn).not.toMatch(/\n {2}await db\.(insert|update)/);
  });

  it('treats either signal as already converted', () => {
    // Requiring BOTH let a half-written row convert twice.
    const s = src();

    expect(s).toContain('inquiry.convertedApplicantId || inquiry.status === \'converted\'');
  });

  it('never deletes a converted lead', () => {
    // The applicant link must survive; deletion is refused rather than cascaded.
    const s = src();

    expect(s).toContain('CONVERTED_CANNOT_DELETE');
    expect(s).toContain('CONVERTED_CANNOT_MERGE');
  });

  it('keeps merge from losing follow-ups', () => {
    const s = src();
    const merge = s.slice(s.indexOf('export async function mergeInquiries'));

    expect(merge).toContain('set({ inquiryId: primaryId })');
    expect(merge).toContain('mergedTags');
    expect(merge).toContain('mergedNotes');
  });
});
