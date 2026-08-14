CREATE TYPE "public"."assignment_submission_status" AS ENUM('pending', 'submitted', 'late', 'graded');--> statement-breakpoint
CREATE TYPE "public"."attendance_excuse_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attendance_flag_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."attendance_flag_type" AS ENUM('UNJUSTIFIED_ABSENCE', 'REPEATED_LATE', 'CONSECUTIVE_ABSENCE');--> statement-breakpoint
CREATE TYPE "public"."cndp_filing_status" AS ENUM('draft', 'submitted', 'approved');--> statement-breakpoint
CREATE TYPE "public"."exam_attempt_status" AS ENUM('in_progress', 'submitted', 'graded');--> statement-breakpoint
CREATE TYPE "public"."inquiry_follow_up_type" AS ENUM('call', 'email', 'meeting', 'note');--> statement-breakpoint
CREATE TYPE "public"."inquiry_interest_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."inquiry_source" AS ENUM('walk_in', 'phone', 'web', 'referral');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."meeting_slot_status" AS ENUM('open', 'booked', 'cancelled');--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_user_id_unique" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"target_role" "role",
	"target_class_section_id" uuid,
	"created_by_id" text NOT NULL,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"submitted_at" timestamp,
	"file_ext" varchar(10),
	"score" numeric(5, 2),
	"feedback" text,
	"status" "assignment_submission_status" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "assignment_submissions_assignment_student_unique" UNIQUE("assignment_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"max_score" numeric(5, 2) NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_excuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"document_url" varchar(500),
	"status" "attendance_excuse_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"type" "attendance_flag_type" NOT NULL,
	"status" "attendance_flag_status" DEFAULT 'OPEN' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attendance_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"academic_year_id" uuid,
	"total_present" integer DEFAULT 0 NOT NULL,
	"total_absent" integer DEFAULT 0 NOT NULL,
	"total_late" integer DEFAULT 0 NOT NULL,
	"total_excused" integer DEFAULT 0 NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"attendance_rate" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cndp_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filing_reference" varchar(100),
	"filed_at" date,
	"status" "cndp_filing_status" DEFAULT 'draft' NOT NULL,
	"document_upload_path" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cndp_filings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"source" "inquiry_source" DEFAULT 'walk_in' NOT NULL,
	"interest_level" "inquiry_interest_level" DEFAULT 'medium',
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"assigned_to_id" text,
	"notes" text,
	"converted_applicant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiry_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"type" "inquiry_follow_up_type" NOT NULL,
	"notes" text NOT NULL,
	"scheduled_for" timestamp,
	"completed_at" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"booked_by_guardian_id" uuid,
	"student_id" text,
	"status" "meeting_slot_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_exam_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid
);
--> statement-breakpoint
CREATE TABLE "online_exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"online_exam_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"score" numeric(5, 2),
	"status" "exam_attempt_status" DEFAULT 'in_progress' NOT NULL,
	CONSTRAINT "online_exam_attempts_exam_student_unique" UNIQUE("online_exam_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "online_exam_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"online_exam_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"marks" numeric(5, 2) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "online_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"total_marks" numeric(5, 2) NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "period" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "academic_year_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "academic_term_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_voided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_class_section_id_class_sections_id_fk" FOREIGN KEY ("target_class_section_id") REFERENCES "public"."class_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD CONSTRAINT "attendance_excuses_reviewed_by_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cndp_filings" ADD CONSTRAINT "cndp_filings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_converted_applicant_id_applicants_id_fk" FOREIGN KEY ("converted_applicant_id") REFERENCES "public"."applicants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_booked_by_guardian_id_guardians_id_fk" FOREIGN KEY ("booked_by_guardian_id") REFERENCES "public"."guardians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_attempt_id_online_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."online_exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_question_id_online_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."online_exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_selected_option_id_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."online_exam_question_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_online_exam_id_online_exams_id_fk" FOREIGN KEY ("online_exam_id") REFERENCES "public"."online_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_question_options" ADD CONSTRAINT "online_exam_question_options_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."online_exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_online_exam_id_online_exams_id_fk" FOREIGN KEY ("online_exam_id") REFERENCES "public"."online_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_excuses_student_idx" ON "attendance_excuses" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_excuses_tenant_idx" ON "attendance_excuses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "attendance_flags_student_tenant_idx" ON "attendance_flags" USING btree ("tenant_id","student_id");--> statement-breakpoint
CREATE INDEX "attendance_summary_student_idx" ON "attendance_summary" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_summary_tenant_idx" ON "attendance_summary" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_subject_id_courses_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;