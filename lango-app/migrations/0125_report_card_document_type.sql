-- 0125_report_card_document_type.sql — §16.1: report cards (bulletins) become a
-- 4th document-template type in the shared documentTemplates/pdfme pipeline,
-- alongside student_id / employee_id / admit_card. Hand-written. Idempotent.
-- ALTER TYPE ... ADD VALUE (PG 17) must be its own autocommit statement — never
-- wrapped in a DO block or combined with other statements in one transaction.
--> statement-breakpoint
ALTER TYPE "document_template_type" ADD VALUE IF NOT EXISTS 'report_card';
