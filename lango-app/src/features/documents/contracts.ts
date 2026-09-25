import { z } from 'zod';

export const documentKindSchema = z.enum(['invoice', 'receipt', 'statement', 'student_profile', 'leadership_report', 'exam_seating', 'exam_attendance', 'timetable']);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const documentDesignSchema = z.object({
  variant: z.enum(['classique', 'minimal', 'moderne']),
  pageSize: z.enum(['a4', 'a5']),
  orientation: z.enum(['portrait', 'landscape']),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontScale: z.enum(['compact', 'normal', 'large']),
  showLogo: z.boolean(),
  showStamp: z.boolean(),
  showSignature: z.boolean(),
  optionalFields: z.array(z.enum(['contact', 'legal', 'note', 'guardian', 'class'])).max(5),
  sectionOrder: z.array(z.enum(['identity', 'details', 'lines', 'totals', 'footer'])).length(5),
  labels: z.record(z.string().max(40), z.string().trim().max(80)),
  footerText: z.string().trim().max(500),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.sectionOrder).size !== 5) {
    ctx.addIssue({ code: 'custom', path: ['sectionOrder'], message: 'Each section must appear once.' });
  }
});
export type DocumentDesign = z.infer<typeof documentDesignSchema>;

export const previewRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invoice'), sourceId: z.string().uuid(), useDraft: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('receipt'), sourceId: z.string().uuid(), useDraft: z.boolean().optional() }).strict(),
  z.object({
    kind: z.literal('statement'), sourceId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    useDraft: z.boolean().optional(),
  }).strict(),
  z.object({ kind: z.literal('student_profile'), sourceId: z.string().min(1), useDraft: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('leadership_report'), sourceId: z.literal('current'), range: z.enum(['30d', '6mo']), useDraft: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('exam_seating'), sourceId: z.literal('selected'), scheduleIds: z.array(z.string().uuid()).min(1).max(30), useDraft: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('exam_attendance'), sourceId: z.literal('selected'), scheduleIds: z.array(z.string().uuid()).min(1).max(30), useDraft: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('timetable'), sourceId: z.string().min(1), viewMode: z.enum(['class', 'teacher', 'room']), useDraft: z.boolean().optional() }).strict(),
]);
export type PreviewRequest = z.infer<typeof previewRequestSchema>;

export const DOCUMENT_DEFAULTS: Record<DocumentKind, DocumentDesign> = {
  invoice: { variant: 'classique', pageSize: 'a4', orientation: 'portrait', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact', 'legal', 'note', 'guardian', 'class'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  receipt: { variant: 'classique', pageSize: 'a5', orientation: 'portrait', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact', 'legal'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  statement: { variant: 'classique', pageSize: 'a4', orientation: 'portrait', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  student_profile: { variant: 'classique', pageSize: 'a4', orientation: 'portrait', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact', 'class', 'guardian'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  leadership_report: { variant: 'moderne', pageSize: 'a4', orientation: 'landscape', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  exam_seating: { variant: 'classique', pageSize: 'a4', orientation: 'landscape', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  exam_attendance: { variant: 'classique', pageSize: 'a4', orientation: 'landscape', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
  timetable: { variant: 'classique', pageSize: 'a4', orientation: 'landscape', accentColor: '#2487B8', fontScale: 'normal', showLogo: true, showStamp: false, showSignature: false, optionalFields: ['contact'], sectionOrder: ['identity', 'details', 'lines', 'totals', 'footer'], labels: {}, footerText: '' },
};

export type DocumentModel = {
  kind: DocumentKind;
  title: string;
  reference: string;
  filename: string;
  status?: string;
  school: { name: string; address?: string | null; city?: string | null; phone?: string | null; email?: string | null; legal?: string | null; logo?: string | null; stamp?: string | null; signature?: string | null };
  details: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string>>;
  totals: Array<{ label: string; value: string; strong?: boolean }>;
  note?: string | null;
};
