-- Migration 0060: Assessment and Examination System
-- Shared Core Assessment Ledger, Reworked Assignments/Homework, Exam Master, and Online Examinations Addon

-- 1. Shared Core Assessment Ledger
CREATE TABLE IF NOT EXISTS "assessment_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"class_subject_id" uuid,
	"session_year_id" uuid,
	"term_id" uuid,
	"type" text DEFAULT 'homework' NOT NULL, -- homework, quiz, paper_exam, online_exam, project, oral, practical
	"title" text NOT NULL,
	"description" text,
	"maximum_score" numeric(8, 2) DEFAULT '20.00' NOT NULL,
	"coefficient" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"pass_mark" numeric(8, 2) DEFAULT '10.00',
	"status" text DEFAULT 'draft' NOT NULL, -- draft, published, closed, archived
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assessment_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"class_offering_id" uuid,
	"section_id" uuid,
	"student_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assessment_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"student_id" text NOT NULL,
	"raw_score" numeric(8, 2),
	"maximum_score_snapshot" numeric(8, 2) DEFAULT '20.00' NOT NULL,
	"normalized_score" numeric(8, 2),
	"grade" text,
	"status" text DEFAULT 'pending' NOT NULL, -- pending, graded, exempted, absent, withheld
	"source_type" text DEFAULT 'paper_exam' NOT NULL, -- homework_submission, paper_exam, online_attempt
	"source_reference_id" text,
	"marker_id" text,
	"moderation_state" text DEFAULT 'draft' NOT NULL, -- draft, submitted, moderated, locked, published
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_outcomes_def_student_unique" UNIQUE("assessment_definition_id", "student_id")
);

CREATE TABLE IF NOT EXISTS "assessment_outcome_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_outcome_id" uuid NOT NULL REFERENCES "assessment_outcomes"("id") ON DELETE CASCADE,
	"previous_score" numeric(8, 2),
	"new_score" numeric(8, 2),
	"previous_status" text,
	"new_status" text,
	"reason" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Reworked Homework & Assignments
CREATE TABLE IF NOT EXISTS "homework_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"instructions" text,
	"allow_attachments" boolean DEFAULT true NOT NULL,
	"max_attachments" integer DEFAULT 3 NOT NULL,
	"late_submission_policy" text DEFAULT 'accept_flag' NOT NULL, -- reject, accept_flag, deduct_percentage
	"close_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homework_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"student_id" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"response_text" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL, -- submitted, returned, graded, resubmit_requested
	"score" numeric(8, 2),
	"feedback_text" text,
	"graded_by" text,
	"graded_at" timestamp,
	CONSTRAINT "homework_attempts_def_student_attempt_unique" UNIQUE("assessment_definition_id", "student_id", "attempt_number")
);

CREATE TABLE IF NOT EXISTS "homework_attempt_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL REFERENCES "homework_attempts"("id") ON DELETE CASCADE,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homework_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homework_rubric_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rubric_id" uuid NOT NULL REFERENCES "homework_rubrics"("id") ON DELETE CASCADE,
	"criterion_name" text NOT NULL,
	"description" text,
	"max_points" numeric(6, 2) DEFAULT '5.00' NOT NULL,
	"weight" numeric(4, 2) DEFAULT '1.00' NOT NULL
);

-- 3. Exam Master & Scheduling
CREATE TABLE IF NOT EXISTS "exam_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"session_year_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL, -- setup, scheduling, active, valuation, closed
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_halls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"capacity" integer DEFAULT 30 NOT NULL,
	"is_accessible" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"exam_term_id" uuid NOT NULL REFERENCES "exam_terms"("id") ON DELETE CASCADE,
	"exam_hall_id" uuid NOT NULL REFERENCES "exam_halls"("id") ON DELETE CASCADE,
	"student_id" text NOT NULL,
	"seat_number" integer NOT NULL,
	"desk_label" text,
	"candidate_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_seats_term_student_unique" UNIQUE("exam_term_id", "student_id")
);

CREATE TABLE IF NOT EXISTS "exam_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"exam_term_id" uuid NOT NULL REFERENCES "exam_terms"("id") ON DELETE CASCADE,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"exam_hall_id" uuid REFERENCES "exam_halls"("id") ON DELETE SET NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL, -- draft, published, cancelled
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_supervisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_schedule_id" uuid NOT NULL REFERENCES "exam_schedules"("id") ON DELETE CASCADE,
	"staff_id" text NOT NULL,
	"role" text DEFAULT 'invigilator' NOT NULL, -- invigilator, chief_invigilator, assistant
	"attendance_status" text DEFAULT 'assigned' NOT NULL, -- assigned, present, absent
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marksheet_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"columns_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_grades" boolean DEFAULT true NOT NULL,
	"show_rankings" boolean DEFAULT false NOT NULL,
	"rounding_method" text DEFAULT 'round_half_up' NOT NULL,
	"signature_labels_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "result_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"exam_term_id" uuid NOT NULL REFERENCES "exam_terms"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL, -- draft, published, withdrawn
	"published_at" timestamp,
	"published_by" text,
	"snapshot_checksum" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 4. Online Examinations Addon
CREATE TABLE IF NOT EXISTS "question_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'General' NOT NULL,
	"owner_id" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "question_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_bank_id" uuid NOT NULL REFERENCES "question_banks"("id") ON DELETE CASCADE,
	"type" text DEFAULT 'mcq_single' NOT NULL, -- mcq_single, mcq_multiple, true_false, short_text, numeric, essay, matching, ordering
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"explanation" text,
	"difficulty" text DEFAULT 'medium' NOT NULL, -- easy, medium, hard
	"default_marks" numeric(6, 2) DEFAULT '1.00' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL, -- draft, active, archived
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_item_id" uuid NOT NULL REFERENCES "question_items"("id") ON DELETE CASCADE,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"score_percentage" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"feedback" text
);

CREATE TABLE IF NOT EXISTS "online_exam_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"shuffle_questions" boolean DEFAULT true NOT NULL,
	"shuffle_options" boolean DEFAULT true NOT NULL,
	"show_results_immediately" boolean DEFAULT false NOT NULL,
	"negative_marking_percentage" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"pass_percentage" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "online_exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"assessment_definition_id" uuid NOT NULL REFERENCES "assessment_definitions"("id") ON DELETE CASCADE,
	"student_id" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL, -- not_started, in_progress, submitted, auto_graded, manual_grading, released, expired, abandoned
	"started_at" timestamp DEFAULT now() NOT NULL,
	"deadline_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"auto_score" numeric(8, 2),
	"final_score" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "online_exam_attempts_def_student_attempt_unique" UNIQUE("assessment_definition_id", "student_id", "attempt_number")
);

CREATE TABLE IF NOT EXISTS "online_exam_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"online_exam_attempt_id" uuid NOT NULL REFERENCES "online_exam_attempts"("id") ON DELETE CASCADE,
	"question_item_id" uuid NOT NULL REFERENCES "question_items"("id") ON DELETE CASCADE,
	"selected_option_ids_json" jsonb DEFAULT '[]'::jsonb,
	"response_text" text,
	"awarded_marks" numeric(8, 2),
	"is_graded" boolean DEFAULT false NOT NULL,
	"graded_by" text,
	"graded_at" timestamp,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "online_exam_responses_attempt_question_unique" UNIQUE("online_exam_attempt_id", "question_item_id")
);

-- Indices for high-frequency queries
CREATE INDEX IF NOT EXISTS "idx_assessment_defs_tenant_type" ON "assessment_definitions"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "idx_assessment_outcomes_student" ON "assessment_outcomes"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "idx_exam_schedules_term" ON "exam_schedules"("tenant_id", "exam_term_id");
CREATE INDEX IF NOT EXISTS "idx_online_attempts_student" ON "online_exam_attempts"("tenant_id", "student_id", "status");
