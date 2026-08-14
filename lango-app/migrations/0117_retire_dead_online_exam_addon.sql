-- Retire the dead online-exam addon (Path A decision).
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
--
-- Migration 0060_assessment_and_examination.sql shipped a second "online exam"
-- schema (question_banks, question_items, question_options,
-- online_exam_policies, online_exam_attempts, online_exam_responses) behind
-- OnlineExamService (src/features/assessment/services/online-exam-service.ts).
-- That service was never wired to any route (grep -rn "OnlineExamService"
-- src/app/api returned zero matches) and has now been deleted as dead code.
-- The live, production online-exam flow is the separate, older one from
-- migration 0025_add_online_exams.sql (online_exams, online_exam_questions,
-- online_exam_question_options, online_exam_attempts, online_exam_answers),
-- served by src/app/api/academics/online-exams/**. See
-- future-implementation/assessment-and-examination/EXECUTION-AUDIT-REPORT.md
-- ("Online-Exam Table Collision — Decision Record") for the full history.
--
-- IMPORTANT — why "online_exam_attempts" is deliberately NOT dropped here:
-- 0060 named one of its tables "online_exam_attempts", identical to the table
-- already created by 0025. 0060 used CREATE TABLE IF NOT EXISTS, so on every
-- real database (dev and prod) that no-op'd against the 0025 table — the 0060
-- shape (assessment_definition_id, attempt_number, deadline_at, auto_score,
-- final_score, ...) was NEVER actually created anywhere. The physical
-- "online_exam_attempts" table that exists today IS the live 0025 table
-- (online_exam_id, student_id, started_at, submitted_at, score, status) that
-- the legacy submit/route.ts flow depends on. Dropping it here would destroy
-- live production data and break the working feature. Only the tables below
-- are genuinely orphaned (no name collision, created fine by 0060, but never
-- written to because the only writer, OnlineExamService, was unreachable).
--
-- Drop order respects FK dependencies: responses -> (attempts kept, items),
-- policies (standalone), options -> items -> banks.

--> statement-breakpoint
DROP TABLE IF EXISTS "online_exam_responses";
--> statement-breakpoint
DROP TABLE IF EXISTS "online_exam_policies";
--> statement-breakpoint
DROP TABLE IF EXISTS "question_options";
--> statement-breakpoint
DROP TABLE IF EXISTS "question_items";
--> statement-breakpoint
DROP TABLE IF EXISTS "question_banks";
