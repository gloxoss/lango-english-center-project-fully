-- 0131_teacher_question_bank.sql — teacher question bank for devoir authoring
-- (Part 5, item 5). Distinct from the retired Academics question bank. A
-- teacher stores reusable question/instruction snippets (title, content,
-- optional attachment, tags) and can pick them into the "Créer un Devoir"
-- dialog. tenant_id is text to match the rest of the assessment domain
-- (assessment_definitions.tenant_id), no FK. Hand-written, idempotent.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS teacher_question_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  created_by_id text NOT NULL,
  title text NOT NULL,
  content text,
  attachment_url text,
  tags jsonb NOT NULL DEFAULT '[]',
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teacher_qbank_tenant ON teacher_question_bank_items (tenant_id);
