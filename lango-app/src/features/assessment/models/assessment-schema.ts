import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  boolean,
  integer,
  date,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// 1. Shared Core Assessment Ledger
export const assessmentDefinitions = pgTable(
  'assessment_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    classSubjectId: uuid('class_subject_id'),
    sessionYearId: uuid('session_year_id'),
    termId: uuid('term_id'),
    type: text('type').default('homework').notNull(), // homework, quiz, paper_exam, online_exam, project, oral, practical
    title: text('title').notNull(),
    description: text('description'),
    maximumScore: numeric('maximum_score', { precision: 8, scale: 2 }).default('20.00').notNull(),
    coefficient: numeric('coefficient', { precision: 5, scale: 2 }).default('1.00').notNull(),
    passMark: numeric('pass_mark', { precision: 8, scale: 2 }).default('10.00'),
    status: text('status').default('draft').notNull(), // draft, published, closed, archived
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_assessment_defs_tenant_type').on(table.tenantId, table.type),
  ]
);

export const assessmentAudiences = pgTable('assessment_audiences', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  assessmentDefinitionId: uuid('assessment_definition_id')
    .notNull()
    .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
  classOfferingId: uuid('class_offering_id'),
  sectionId: uuid('section_id'),
  studentId: text('student_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const assessmentOutcomes = pgTable(
  'assessment_outcomes',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    assessmentDefinitionId: uuid('assessment_definition_id')
      .notNull()
      .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    rawScore: numeric('raw_score', { precision: 8, scale: 2 }),
    maximumScoreSnapshot: numeric('maximum_score_snapshot', { precision: 8, scale: 2 })
      .default('20.00')
      .notNull(),
    normalizedScore: numeric('normalized_score', { precision: 8, scale: 2 }),
    grade: text('grade'),
    status: text('status').default('pending').notNull(), // pending, graded, exempted, absent, withheld
    sourceType: text('source_type').default('paper_exam').notNull(), // homework_submission, paper_exam, online_attempt
    sourceReferenceId: text('source_reference_id'),
    markerId: text('marker_id'),
    moderationState: text('moderation_state').default('draft').notNull(), // draft, submitted, moderated, locked, published
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    unique('assessment_outcomes_def_student_unique').on(
      table.assessmentDefinitionId,
      table.studentId
    ),
    index('idx_assessment_outcomes_student').on(table.tenantId, table.studentId),
  ]
);

export const assessmentOutcomeRevisions = pgTable('assessment_outcome_revisions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  assessmentOutcomeId: uuid('assessment_outcome_id')
    .notNull()
    .references(() => assessmentOutcomes.id, { onDelete: 'cascade' }),
  previousScore: numeric('previous_score', { precision: 8, scale: 2 }),
  newScore: numeric('new_score', { precision: 8, scale: 2 }),
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  reason: text('reason').notNull(),
  changedBy: text('changed_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

// 2. Reworked Homework & Assignments
export const homeworkDetails = pgTable('homework_details', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  assessmentDefinitionId: uuid('assessment_definition_id')
    .notNull()
    .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
  instructions: text('instructions'),
  allowAttachments: boolean('allow_attachments').default(true).notNull(),
  maxAttachments: integer('max_attachments').default(3).notNull(),
  lateSubmissionPolicy: text('late_submission_policy').default('accept_flag').notNull(),
  closeAt: timestamp('close_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const homeworkAttempts = pgTable(
  'homework_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assessmentDefinitionId: uuid('assessment_definition_id')
      .notNull()
      .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    attemptNumber: integer('attempt_number').default(1).notNull(),
    responseText: text('response_text'),
    submittedAt: timestamp('submitted_at', { mode: 'string' }).defaultNow().notNull(),
    isLate: boolean('is_late').default(false).notNull(),
    status: text('status').default('submitted').notNull(), // submitted, returned, graded, resubmit_requested
    score: numeric('score', { precision: 8, scale: 2 }),
    feedbackText: text('feedback_text'),
    gradedBy: text('graded_by'),
    gradedAt: timestamp('graded_at', { mode: 'string' }),
  },
  (table) => [
    unique('homework_attempts_def_student_attempt_unique').on(
      table.assessmentDefinitionId,
      table.studentId,
      table.attemptNumber
    ),
  ]
);

export const homeworkAttemptFiles = pgTable('homework_attempt_files', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => homeworkAttempts.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').default(0).notNull(),
  mimeType: text('mime_type').default('application/octet-stream').notNull(),
  uploadedAt: timestamp('uploaded_at', { mode: 'string' }).defaultNow().notNull(),
});

export const homeworkRubrics = pgTable('homework_rubrics', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  assessmentDefinitionId: uuid('assessment_definition_id')
    .notNull()
    .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const homeworkRubricCriteria = pgTable('homework_rubric_criteria', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  rubricId: uuid('rubric_id')
    .notNull()
    .references(() => homeworkRubrics.id, { onDelete: 'cascade' }),
  criterionName: text('criterion_name').notNull(),
  description: text('description'),
  maxPoints: numeric('max_points', { precision: 6, scale: 2 }).default('5.00').notNull(),
  weight: numeric('weight', { precision: 4, scale: 2 }).default('1.00').notNull(),
});

// 3. Exam Master & Scheduling
export const examTerms = pgTable('exam_terms', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  sessionYearId: uuid('session_year_id'),
  name: text('name').notNull(),
  code: text('code').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  status: text('status').default('setup').notNull(), // setup, scheduling, active, valuation, closed
  isPublished: boolean('is_published').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const examHalls = pgTable('exam_halls', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: text('name').notNull(),
  code: text('code').notNull(),
  capacity: integer('capacity').default(30).notNull(),
  isAccessible: boolean('is_accessible').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const examSeats = pgTable(
  'exam_seats',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    examTermId: uuid('exam_term_id')
      .notNull()
      .references(() => examTerms.id, { onDelete: 'cascade' }),
    examHallId: uuid('exam_hall_id')
      .notNull()
      .references(() => examHalls.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    seatNumber: integer('seat_number').notNull(),
    deskLabel: text('desk_label'),
    candidateNumber: text('candidate_number').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    unique('exam_seats_term_student_unique').on(table.examTermId, table.studentId),
  ]
);

export const examSchedules = pgTable('exam_schedules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  examTermId: uuid('exam_term_id')
    .notNull()
    .references(() => examTerms.id, { onDelete: 'cascade' }),
  assessmentDefinitionId: uuid('assessment_definition_id')
    .notNull()
    .references(() => assessmentDefinitions.id, { onDelete: 'cascade' }),
  examHallId: uuid('exam_hall_id').references(() => examHalls.id, { onDelete: 'set null' }),
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  status: text('status').default('draft').notNull(), // draft, published, cancelled
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const examSupervisors = pgTable('exam_supervisors', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  examScheduleId: uuid('exam_schedule_id')
    .notNull()
    .references(() => examSchedules.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').notNull(),
  role: text('role').default('invigilator').notNull(), // invigilator, chief_invigilator, assistant
  attendanceStatus: text('attendance_status').default('assigned').notNull(), // assigned, present, absent
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const marksheetTemplates = pgTable('marksheet_templates', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  columnsJson: jsonb('columns_json').default([]).notNull(),
  showGrades: boolean('show_grades').default(true).notNull(),
  showRankings: boolean('show_rankings').default(false).notNull(),
  roundingMethod: text('rounding_method').default('round_half_up').notNull(),
  signatureLabelsJson: jsonb('signature_labels_json').default([]).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const resultPublications = pgTable('result_publications', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  examTermId: uuid('exam_term_id')
    .notNull()
    .references(() => examTerms.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').default('draft').notNull(), // draft, published, withdrawn
  publishedAt: timestamp('published_at', { mode: 'string' }),
  publishedBy: text('published_by'),
  snapshotChecksum: text('snapshot_checksum'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

// 4. Online Examinations Addon — retired 2026-08-13. This block used to define
// questionBanks/questionItems/questionOptions/onlineExamPolicies/onlineExamAttempts/
// onlineExamResponses for the dead OnlineExamService (zero route consumers). Its
// onlineExamAttempts table name collided with the live online_exam_attempts table
// from migration 0025 (different column shape); because 0060 used
// CREATE TABLE IF NOT EXISTS, that table never actually existed with this shape on
// any real database. See migration 0117_retire_dead_online_exam_addon.sql and
// future-implementation/assessment-and-examination/EXECUTION-AUDIT-REPORT.md
// ("Online-Exam Table Collision — Decision Record") for the full writeup. The live
// online-exam flow is the legacy one: src/models/Schema.ts (onlineExams,
// onlineExamQuestions, onlineExamQuestionOptions, onlineExamAttempts,
// onlineExamAnswers), served by src/app/api/academics/online-exams/**.
