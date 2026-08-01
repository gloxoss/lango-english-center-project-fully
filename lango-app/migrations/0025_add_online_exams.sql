CREATE TYPE "public"."exam_attempt_status" AS ENUM('in_progress', 'submitted', 'graded');

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

CREATE TABLE "online_exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"online_exam_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"marks" numeric(5, 2) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "online_exam_question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);

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

CREATE TABLE "online_exam_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid
);

ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subjects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exams" ADD CONSTRAINT "online_exams_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exam_questions" ADD CONSTRAINT "online_exam_questions_online_exam_id_online_exams_id_fk" FOREIGN KEY ("online_exam_id") REFERENCES "public"."online_exams"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "online_exam_question_options" ADD CONSTRAINT "online_exam_question_options_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."online_exam_questions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_online_exam_id_online_exams_id_fk" FOREIGN KEY ("online_exam_id") REFERENCES "public"."online_exams"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exam_attempts" ADD CONSTRAINT "online_exam_attempts_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_attempt_id_online_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."online_exam_attempts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_question_id_online_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."online_exam_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "online_exam_answers" ADD CONSTRAINT "online_exam_answers_selected_option_id_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."online_exam_question_options"("id") ON DELETE set null ON UPDATE no action;
