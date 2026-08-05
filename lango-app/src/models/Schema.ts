import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

// ponytail: fixed business categories get pgEnum; school-configurable lists
// (mediums, sections, streams, shifts, semesters) get plain tables instead - see
// the sessionYears/mediums/etc. tables below.
export const subjectType = pgEnum('subject_type', ['theory', 'practical']);
export const classSubjectType = pgEnum('class_subject_type', ['compulsory', 'elective']);
export const classTeacherRole = pgEnum('class_teacher_role', ['primary', 'assistant', 'support']);
export const timetableVersionStatus = pgEnum('timetable_version_status', ['draft', 'published', 'archived']);
export const promotionBatchStatus = pgEnum('promotion_batch_status', ['committed', 'reverted']);
export const promotionDecisionType = pgEnum('promotion_decision_type', ['promote', 'repeat', 'graduate', 'transfer', 'withdraw', 'hold']);

export const attendanceStatus = pgEnum('attendance_status', ['present', 'absent', 'late', 'excused']);
export const attendanceExcuseStatus = pgEnum('attendance_excuse_status', ['pending', 'approved', 'rejected']);
export const attendanceFlagType = pgEnum('attendance_flag_type', ['UNJUSTIFIED_ABSENCE', 'REPEATED_LATE', 'CONSECUTIVE_ABSENCE']);
export const attendanceFlagStatus = pgEnum('attendance_flag_status', ['OPEN', 'RESOLVED']);
export const attendanceFlagSeverity = pgEnum('attendance_flag_severity', ['CRITIQUE', 'ELEVE', 'MOYEN']);
export const attendanceRegisterStatus = pgEnum('attendance_register_status', ['LOCKED', 'REOPENED']);
export const dayOfWeek = pgEnum('day_of_week', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
export const enrollmentStatus = pgEnum('enrollment_status', ['enrolled', 'dropped', 'graduated']);
export const expenseCategory = pgEnum('expense_category', ['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']);
export const gender = pgEnum('gender', ['female', 'male', 'other']);
export const invoiceStatus = pgEnum('invoice_status', ['pending', 'partial', 'paid', 'overdue', 'cancelled']);
export const leaveStatus = pgEnum('leave_status', ['pending', 'approved', 'rejected']);
export const paymentMethod = pgEnum('payment_method', ['cash', 'card', 'transfer', 'check']);
export const role = pgEnum('role', ['super_admin', 'school_admin', 'teacher', 'accountant', 'student', 'parent', 'receptionist', 'guard']);
export const status = pgEnum('status', ['active', 'inactive', 'archived']);
export const planTier = pgEnum('plan_tier', ['trial', 'basic', 'standard', 'premium']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'suspended', 'cancelled']);
export const cndpFilingStatus = pgEnum('cndp_filing_status', ['draft', 'submitted', 'approved']);
export const inquirySource = pgEnum('inquiry_source', ['walk_in', 'phone', 'web', 'referral']);
export const inquiryInterestLevel = pgEnum('inquiry_interest_level', ['low', 'medium', 'high']);
export const inquiryStatus = pgEnum('inquiry_status', ['new', 'contacted', 'qualified', 'converted', 'lost']);
export const inquiryFollowUpType = pgEnum('inquiry_follow_up_type', ['call', 'email', 'meeting', 'note']);
export const assignmentSubmissionStatus = pgEnum('assignment_submission_status', ['pending', 'submitted', 'late', 'graded']);
export const meetingSlotStatus = pgEnum('meeting_slot_status', ['open', 'booked', 'cancelled']);
export const examAttemptStatus = pgEnum('exam_attempt_status', ['in_progress', 'submitted', 'graded']);
export const accountType = pgEnum('account_type', ['asset', 'liability', 'equity', 'revenue', 'expense']);
export const fiscalPeriodStatus = pgEnum('fiscal_period_status', ['open', 'closed']);
export const discountApprovalStatus = pgEnum('discount_approval_status', ['pending', 'approved', 'rejected']);
export const journalStatus = pgEnum('journal_status', ['posted', 'reversed']);

export const verification = pgTable('verification', {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
});

export const tenants = pgTable('tenants', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 100 }).notNull(),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  isActive: boolean('is_active').default(true).notNull(),
  planTier: planTier('plan_tier').default('trial').notNull(),
  subscriptionStatus: subscriptionStatus('subscription_status').default('active').notNull(),
  hasMultiBranchAddon: boolean('has_multi_branch_addon').default(false).notNull(),
  maxBranches: integer('max_branches').default(1).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('tenants_slug_unique').on(table.slug),
]);

export const branches = pgTable('branches', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  code: varchar({ length: 50 }).notNull(),
  city: varchar({ length: 100 }),
  address: text(),
  phone: varchar({ length: 50 }),
  email: varchar({ length: 255 }),
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'branches_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('branches_tenant_id_code_unique').on(table.tenantId, table.code),
]);

// ==========================================================================
// Academic structure (ESchool-aligned - see the repo's Plan doc for context).
// academicYears/academicTerms/programs/courses/studentGroups below are NOT
// used by this structure - they belong to a dead LMS/course-platform chain
// nothing in src/ reads or writes. Do not build on them.
// ==========================================================================

export const sessionYears = pgTable('session_years', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'session_years_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('session_years_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const semesters = pgTable('semesters', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  startMonth: integer('start_month').notNull(),
  endMonth: integer('end_month').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'semesters_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('semesters_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const mediums = pgTable('mediums', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'mediums_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('mediums_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const sections = pgTable('sections', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 50 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'sections_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('sections_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const streams = pgTable('streams', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'streams_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('streams_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const shifts = pgTable('shifts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  // HH:MM, matching the existing varchar(5) time-of-day convention used by
  // timetableSlots.startTime/endTime rather than introducing a `time` column.
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'shifts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('shifts_tenant_id_name_unique').on(table.tenantId, table.name),
]);

export const classes = pgTable('classes', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar({ length: 100 }).notNull(),
  includeSemesters: boolean('include_semesters').default(false).notNull(),
  mediumId: uuid('medium_id').notNull(),
  shiftId: uuid('shift_id'),
  streamId: uuid('stream_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'classes_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  // No onDelete: mediumId is reference data, not part of the class's own
  // lifecycle - deleting a medium while classes still use it must be blocked
  // (surfaced as a clean 409 IN_USE by apiErrorResponse), never silently
  // cascade-delete a school's whole class structure.
  foreignKey({
    columns: [table.mediumId],
    foreignColumns: [mediums.id],
    name: 'classes_medium_id_mediums_id_fk',
  }),
  foreignKey({
    columns: [table.shiftId],
    foreignColumns: [shifts.id],
    name: 'classes_shift_id_shifts_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.streamId],
    foreignColumns: [streams.id],
    name: 'classes_stream_id_streams_id_fk',
  }).onDelete('set null'),
  unique('classes_tenant_id_name_medium_id_unique').on(table.tenantId, table.name, table.mediumId),
]);

export const classSections = pgTable('class_sections', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classId: uuid('class_id').notNull(),
  sectionId: uuid('section_id').notNull(),
  // Denormalized copy of classes.mediumId, matching ESchool's class_sections
  // table exactly - always derived server-side from classId, never client-set.
  mediumId: uuid('medium_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'class_sections_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'class_sections_class_id_classes_id_fk',
  }).onDelete('cascade'),
  // sectionId/mediumId are reference data - see the note on classes.mediumId above.
  foreignKey({
    columns: [table.sectionId],
    foreignColumns: [sections.id],
    name: 'class_sections_section_id_sections_id_fk',
  }),
  foreignKey({
    columns: [table.mediumId],
    foreignColumns: [mediums.id],
    name: 'class_sections_medium_id_mediums_id_fk',
  }),
  unique('class_sections_class_section_medium_unique').on(table.classId, table.sectionId, table.mediumId),
]);

export const subjects = pgTable('subjects', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  code: varchar({ length: 50 }),
  mediumId: uuid('medium_id').notNull(),
  type: subjectType().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'subjects_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  // Reference data - see the note on classes.mediumId above.
  foreignKey({
    columns: [table.mediumId],
    foreignColumns: [mediums.id],
    name: 'subjects_medium_id_mediums_id_fk',
  }),
  unique('subjects_tenant_id_name_medium_id_unique').on(table.tenantId, table.name, table.mediumId),
]);

// No DB-level unique constraint on (classId, subjectId, semesterId): semesterId
// is nullable and NULL-distinctness would let duplicate whole-year rows through
// anyway. Duplicate-assignment prevention happens at the API layer.
export const classSubjects = pgTable('class_subjects', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classId: uuid('class_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  type: classSubjectType().notNull(),
  semesterId: uuid('semester_id'),
  offeringId: uuid('offering_id'),
  weeklyMinutes: integer('weekly_minutes'),
  displayOrder: integer('display_order').default(0).notNull(),
  coefficient: numeric('coefficient', { precision: 4, scale: 2 }).default('1.00').notNull(),
  passThreshold: numeric('pass_threshold', { precision: 5, scale: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  curriculumLabel: varchar('curriculum_label', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.offeringId],
    foreignColumns: [academicClassOfferings.id],
    name: 'class_subjects_offering_id_academic_class_offerings_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'class_subjects_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'class_subjects_class_id_classes_id_fk',
  }).onDelete('cascade'),
  // subjectId is reference data - see the note on classes.mediumId above.
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [subjects.id],
    name: 'class_subjects_subject_id_subjects_id_fk',
  }),
  foreignKey({
    columns: [table.semesterId],
    foreignColumns: [semesters.id],
    name: 'class_subjects_semester_id_semesters_id_fk',
  }).onDelete('set null'),
]);

export const classTeachers = pgTable('class_teachers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSectionId: uuid('class_section_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  offeringId: uuid('offering_id'),
  role: classTeacherRole('role').default('primary').notNull(),
  startsOn: date('starts_on').defaultNow().notNull(),
  endsOn: date('ends_on'),
  status: status('status').default('active').notNull(),
  assignedBy: text('assigned_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.offeringId],
    foreignColumns: [academicClassOfferings.id],
    name: 'class_teachers_offering_id_academic_class_offerings_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'class_teachers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'class_teachers_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [user.id],
    name: 'class_teachers_teacher_id_user_id_fk',
  }),
  foreignKey({
    columns: [table.assignedBy],
    foreignColumns: [user.id],
    name: 'class_teachers_assigned_by_user_id_fk',
  }).onDelete('set null'),
  uniqueIndex('class_teachers_single_active_primary_idx').on(table.tenantId, table.offeringId).where(sql`role = 'primary' AND ends_on IS NULL`),
]);

export const subjectTeachers = pgTable('subject_teachers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSectionId: uuid('class_section_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  offeringId: uuid('offering_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.offeringId],
    foreignColumns: [academicClassOfferings.id],
    name: 'subject_teachers_offering_id_academic_class_offerings_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'subject_teachers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'subject_teachers_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  // subjectId is reference data - see the note on classes.mediumId above.
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [subjects.id],
    name: 'subject_teachers_subject_id_subjects_id_fk',
  }),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'subject_teachers_class_subject_id_class_subjects_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [user.id],
    name: 'subject_teachers_teacher_id_user_id_fk',
  }),
  unique('subject_teachers_class_section_id_class_subject_id_teacher_id_unique').on(table.classSectionId, table.classSubjectId, table.teacherId),
]);

export const academicTerms = pgTable('academic_terms', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  startDate: timestamp('start_date', { mode: 'string' }).notNull(),
  endDate: timestamp('end_date', { mode: 'string' }).notNull(),
  isCurrent: boolean('is_current').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'academic_terms_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.academicYearId],
    foreignColumns: [academicYears.id],
    name: 'academic_terms_academic_year_id_academic_years_id_fk',
  }).onDelete('cascade'),
]);

export const academicYears = pgTable('academic_years', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  startDate: timestamp('start_date', { mode: 'string' }).notNull(),
  endDate: timestamp('end_date', { mode: 'string' }).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'academic_years_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const user = pgTable('user', {
  id: text().primaryKey().notNull(),
  tenantId: uuid('tenant_id'),
  branchId: uuid('branch_id'),
  email: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  role: role().default('student').notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar({ length: 50 }),
  dateOfBirth: date('date_of_birth'),
  gender: gender(),
  address: text(),
  guardianName: varchar('guardian_name', { length: 255 }),
  guardianPhone: varchar('guardian_phone', { length: 50 }),
  guardianEmail: varchar('guardian_email', { length: 255 }),
  photoUrl: text('photo_url'),
  nationalId: varchar('national_id', { length: 100 }),
  // ponytail: stopgap columns carrying what the students/users API already
  // returns. Each belongs elsewhere long-term - see MIGRATION-NOTES.md.
  matricule: varchar({ length: 50 }),
  userStatus: status('user_status').default('active').notNull(),
  qualification: varchar({ length: 255 }),
  salary: numeric({ precision: 10, scale: 2 }),
  lastLogin: timestamp('last_login', { mode: 'string' }),
  // DEPRECATED: superseded by classSectionId below. Kept as a read-only fallback
  // for rows written before classSectionId existed - see MIGRATION-NOTES.md.
  level: varchar({ length: 100 }),
  className: varchar('class_name', { length: 100 }),
  paymentStatus: varchar('payment_status', { length: 50 }),
  employeeId: varchar('employee_id', { length: 50 }),
  specialization: varchar({ length: 255 }),
  cycle: varchar({ length: 100 }),
  // DEPRECATED: superseded by the classTeachers/subjectTeachers join tables.
  // Kept as a read-only fallback for rows written before those existed.
  subjects: varchar({ length: 100 }).array(),
  assignedClasses: varchar('assigned_classes', { length: 100 }).array(),
  workloadHours: integer('workload_hours'),
  hireDate: date('hire_date'),
  documents: jsonb(),
  // Real FK replacing level/className for students. Nullable: not every user
  // row is a student, and existing students may not be placed yet.
  classSectionId: uuid('class_section_id'),
  failedLoginCount: integer('failed_login_count').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { mode: 'string' }),
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  // Owned by the Better Auth two-factor plugin - shape must match
  // better-auth/plugins/two-factor/schema.mjs exactly.
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'user_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'user_class_section_id_class_sections_id_fk',
  }).onDelete('set null'),
  unique('user_email_unique').on(table.email),
  unique('user_matricule_unique').on(table.matricule),
  unique('user_employee_id_unique').on(table.employeeId),
]);

// Records who did what to which record. tenantId/actorId are not foreign keys so a
// row survives a tenant or user deletion - audit history must outlive its subjects.
export const auditLogs = pgTable('audit_logs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id'),
  actorId: text('actor_id').notNull(),
  action: varchar({ length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('audit_logs_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
]);

export const account = pgTable('account', {
  id: text().primaryKey().notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'account_user_id_user_id_fk',
  }),
]);

export const admissionCampaigns = pgTable('admission_campaigns', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  academicTermId: uuid('academic_term_id').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'admission_campaigns_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.academicTermId],
    foreignColumns: [academicTerms.id],
    name: 'admission_campaigns_academic_term_id_academic_terms_id_fk',
  }),
]);

export const applicants = pgTable('applicants', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  // Nullable: admissionCampaigns/programs are the dead LMS-chain tables (see
  // AGENT-HANDOFF.md - do not build real features on them). There is no
  // campaign-management or program-selection UI/data in this app, so the
  // POST /api/students/admissions handler never sets these. They were
  // originally NOT NULL, which made every admission POST fail with a Postgres
  // constraint violation - the code silenced the resulting type error with an
  // `as unknown as` cast instead of fixing the schema.
  campaignId: uuid('campaign_id'),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 50 }).notNull(),
  dateOfBirth: date('date_of_birth'),
  targetProgramId: uuid('target_program_id'),
  status: varchar({ length: 50 }).default('applied').notNull(),
  guardianName: varchar('guardian_name', { length: 255 }),
  guardianPhone: varchar('guardian_phone', { length: 50 }),
  guardianEmail: varchar('guardian_email', { length: 255 }),
  applicationDate: timestamp('application_date', { mode: 'string' }).defaultNow().notNull(),
  convertedUserId: varchar('converted_user_id', { length: 255 }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'applicants_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.campaignId],
    foreignColumns: [admissionCampaigns.id],
    name: 'applicants_campaign_id_admission_campaigns_id_fk',
  }),
  foreignKey({
    columns: [table.targetProgramId],
    foreignColumns: [programs.id],
    name: 'applicants_target_program_id_programs_id_fk',
  }),
  foreignKey({
    columns: [table.convertedUserId],
    foreignColumns: [user.id],
    name: 'applicants_converted_user_id_user_id_fk',
  }),
]);

export const programs = pgTable('programs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  status: status().default('active').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'programs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const assessmentCriteria = pgTable('assessment_criteria', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assessment_criteria_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const assessmentPlans = pgTable('assessment_plans', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  courseId: uuid('course_id'),
  // ponytail: courseId points at the dead LMS `courses` table - it was the
  // only link an assessment plan had to "what class/subject is this for",
  // which meant nothing could ever create a valid plan against the real
  // ESchool-aligned model. classSubjectId is the real link.
  classSubjectId: uuid('class_subject_id'),
  gradingScaleId: uuid('grading_scale_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assessment_plans_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'assessment_plans_course_id_courses_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'assessment_plans_class_subject_id_class_subjects_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.gradingScaleId],
    foreignColumns: [gradingScales.id],
    name: 'assessment_plans_grading_scale_id_grading_scales_id_fk',
  }),
]);

export const assessmentPlanCriteria = pgTable('assessment_plan_criteria', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  assessmentPlanId: uuid('assessment_plan_id').notNull(),
  criteriaId: uuid('criteria_id').notNull(),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }).notNull(),
  weightPercentage: numeric('weight_percentage', { precision: 5, scale: 2 }).notNull(),
}, table => [
  foreignKey({
    columns: [table.assessmentPlanId],
    foreignColumns: [assessmentPlans.id],
    name: 'assessment_plan_criteria_assessment_plan_id_assessment_plans_id',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.criteriaId],
    foreignColumns: [assessmentCriteria.id],
    name: 'assessment_plan_criteria_criteria_id_assessment_criteria_id_fk',
  }).onDelete('cascade'),
]);

export const courses = pgTable('courses', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  programId: uuid('program_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  courseCode: varchar('course_code', { length: 50 }),
  description: text(),
  thumbnailUrl: text('thumbnail_url'),
  price: doublePrecision(),
  isPublished: boolean('is_published').default(false).notNull(),
  isFree: boolean('is_free').default(false).notNull(),
  durationHours: integer('duration_hours').default(5),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'courses_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.programId],
    foreignColumns: [programs.id],
    name: 'courses_program_id_programs_id_fk',
  }).onDelete('cascade'),
]);

export const gradingScales = pgTable('grading_scales', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'grading_scales_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const assessmentResults = pgTable('assessment_results', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  assessmentId: uuid('assessment_id').notNull(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  finalPercentage: numeric('final_percentage', { precision: 5, scale: 2 }),
  gradeCode: varchar('grade_code', { length: 20 }),
  feedback: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('idx_student_assessment').using('btree', table.studentId.asc().nullsLast().op('text_ops'), table.assessmentId.asc().nullsLast().op('text_ops')),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assessment_results_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assessmentId],
    foreignColumns: [assessments.id],
    name: 'assessment_results_assessment_id_assessments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'assessment_results_student_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const assessmentResultDetails = pgTable('assessment_result_details', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  assessmentResultId: uuid('assessment_result_id').notNull(),
  assessmentPlanCriteriaId: uuid('assessment_plan_criteria_id').notNull(),
  score: numeric({ precision: 5, scale: 2 }).notNull(),
}, table => [
  foreignKey({
    columns: [table.assessmentResultId],
    foreignColumns: [assessmentResults.id],
    name: 'assessment_result_details_assessment_result_id_assessment_resul',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assessmentPlanCriteriaId],
    foreignColumns: [assessmentPlanCriteria.id],
    name: 'assessment_result_details_assessment_plan_criteria_id_assessmen',
  }).onDelete('cascade'),
]);

export const assessments = pgTable('assessments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  assessmentPlanId: uuid('assessment_plan_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  assessmentDate: timestamp('assessment_date', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assessments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assessmentPlanId],
    foreignColumns: [assessmentPlans.id],
    name: 'assessments_assessment_plan_id_assessment_plans_id_fk',
  }),
]);

export const attendanceRegisters = pgTable('attendance_registers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classId: uuid('class_id').notNull(),
  subjectId: uuid('subject_id'),
  date: date().notNull(),
  period: integer('period').notNull().default(1),
  reference: varchar('reference', { length: 50 }).notNull(),
  status: attendanceRegisterStatus().notNull().default('LOCKED'),
  submittedAt: timestamp('submitted_at', { mode: 'string' }).defaultNow().notNull(),
  submittedById: text('submitted_by_id'),
  reopenedAt: timestamp('reopened_at', { mode: 'string' }),
  reopenedById: text('reopened_by_id'),
  reopenReason: text('reopen_reason'),
  correctionNote: text('correction_note'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('attendance_registers_class_date_period_unique').on(table.tenantId, table.classId, table.date, table.period),
  index('attendance_registers_tenant_date_idx').on(table.tenantId, table.date),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_registers_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'attendance_registers_class_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.submittedById],
    foreignColumns: [user.id],
    name: 'attendance_registers_submitted_by_id_fk',
  }),
  foreignKey({
    columns: [table.reopenedById],
    foreignColumns: [user.id],
    name: 'attendance_registers_reopened_by_id_fk',
  }),
]);

export const attendance = pgTable('attendance', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  studentGroupId: uuid('student_group_id'),
  subjectId: uuid('subject_id'),
  period: integer('period').notNull().default(1),
  academicYearId: uuid('academic_year_id'),
  academicTermId: uuid('academic_term_id'),
  date: date().notNull(),
  status: attendanceStatus().notNull(),
  lateMinutes: integer('late_minutes'),
  markedById: text('marked_by_id'),
  note: text(),
  isVoided: boolean('is_voided').notNull().default(false),
  voidReason: text('void_reason'),
  registerId: uuid('register_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('attendance_student_date_idx').using('btree', table.studentId.asc().nullsLast().op('date_ops'), table.date.asc().nullsLast().op('text_ops')),
  index('attendance_tenant_date_idx').using('btree', table.tenantId.asc().nullsLast().op('uuid_ops'), table.date.asc().nullsLast().op('date_ops')),
  index('attendance_register_idx').on(table.registerId),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'attendance_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentGroupId],
    foreignColumns: [classes.id],
    name: 'attendance_student_group_id_classes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.markedById],
    foreignColumns: [user.id],
    name: 'attendance_marked_by_id_user_id_fk',
  }),
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [courses.id],
    name: 'attendance_subject_id_courses_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.registerId],
    foreignColumns: [attendanceRegisters.id],
    name: 'attendance_register_id_fk',
  }).onDelete('set null'),
]);

export const attendanceSummary = pgTable('attendance_summary', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  academicYearId: uuid('academic_year_id'),
  totalPresent: integer('total_present').notNull().default(0),
  totalAbsent: integer('total_absent').notNull().default(0),
  totalLate: integer('total_late').notNull().default(0),
  totalExcused: integer('total_excused').notNull().default(0),
  totalSessions: integer('total_sessions').notNull().default(0),
  attendanceRate: numeric('attendance_rate', { precision: 5, scale: 2 }).notNull().default('100.00'),
  lastUpdated: timestamp('last_updated', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('attendance_summary_student_idx').on(table.studentId),
  index('attendance_summary_tenant_idx').on(table.tenantId),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_summary_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'attendance_summary_student_id_fk',
  }).onDelete('cascade'),
]);

export const attendanceExcuses = pgTable('attendance_excuses', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  date: date().notNull(),
  reason: text().notNull(),
  documentUrl: varchar('document_url', { length: 500 }),
  documentFileExt: varchar('document_file_ext', { length: 10 }),
  status: attendanceExcuseStatus().notNull().default('pending'),
  reviewedById: text('reviewed_by_id'),
  reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('attendance_excuses_student_idx').on(table.studentId),
  index('attendance_excuses_tenant_idx').on(table.tenantId),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_excuses_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'attendance_excuses_student_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.reviewedById],
    foreignColumns: [user.id],
    name: 'attendance_excuses_reviewed_by_id_fk',
  }),
]);

export const attendanceFlags = pgTable('attendance_flags', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  type: attendanceFlagType('type').notNull(),
  status: attendanceFlagStatus('status').notNull().default('OPEN'),
  severity: attendanceFlagSeverity('severity').notNull().default('MOYEN'),
  assignedToId: text('assigned_to_id'),
  detectedAt: timestamp('detected_at', { mode: 'string' }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
}, table => [
  index('attendance_flags_student_tenant_idx').on(table.tenantId, table.studentId),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_flags_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'attendance_flags_student_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assignedToId],
    foreignColumns: [user.id],
    name: 'attendance_flags_assigned_to_id_fk',
  }),
]);

export const attendanceFlagNotes = pgTable('attendance_flag_notes', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  flagId: uuid('flag_id').notNull(),
  authorId: text('author_id').notNull(),
  body: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('attendance_flag_notes_flag_idx').on(table.flagId),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_flag_notes_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.flagId],
    foreignColumns: [attendanceFlags.id],
    name: 'attendance_flag_notes_flag_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.authorId],
    foreignColumns: [user.id],
    name: 'attendance_flag_notes_author_id_fk',
  }),
]);

export const studentGroups = pgTable('student_groups', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  courseId: uuid('course_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  maxCapacity: varchar('max_capacity', { length: 10 }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_groups_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'student_groups_course_id_courses_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.academicYearId],
    foreignColumns: [academicYears.id],
    name: 'student_groups_academic_year_id_academic_years_id_fk',
  }),
]);

export const buildings = pgTable('buildings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  code: varchar({ length: 50 }).notNull(),
  address: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'buildings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const certificates = pgTable('certificates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  courseId: uuid('course_id').notNull(),
  issueDate: date('issue_date').defaultNow().notNull(),
  templateName: varchar('template_name', { length: 255 }).default('Standard Completion').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'certificates_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'certificates_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'certificates_course_id_courses_id_fk',
  }).onDelete('cascade'),
]);

export const chapters = pgTable('chapters', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  courseId: uuid('course_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  content: text(),
  position: integer().default(0).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  isFree: boolean('is_free').default(false).notNull(),
  videoUrl: text('video_url'),
  muxDataId: text('mux_data_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'chapters_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'chapters_course_id_courses_id_fk',
  }).onDelete('cascade'),
]);

export const courseAttachments = pgTable('course_attachments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  courseId: uuid('course_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  url: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'course_attachments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'course_attachments_course_id_courses_id_fk',
  }).onDelete('cascade'),
]);

export const courseEnrollments = pgTable('course_enrollments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  programEnrollmentId: uuid('program_enrollment_id').notNull(),
  courseId: uuid('course_id').notNull(),
  status: varchar({ length: 50 }).default('enrolled').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'course_enrollments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.programEnrollmentId],
    foreignColumns: [programEnrollments.id],
    name: 'course_enrollments_program_enrollment_id_program_enrollments_id',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'course_enrollments_course_id_courses_id_fk',
  }),
]);

export const programEnrollments = pgTable('program_enrollments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  programId: uuid('program_id').notNull(),
  academicTermId: uuid('academic_term_id').notNull(),
  enrollmentDate: timestamp('enrollment_date', { mode: 'string' }).defaultNow().notNull(),
  status: varchar({ length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'program_enrollments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'program_enrollments_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.programId],
    foreignColumns: [programs.id],
    name: 'program_enrollments_program_id_programs_id_fk',
  }),
  foreignKey({
    columns: [table.academicTermId],
    foreignColumns: [academicTerms.id],
    name: 'program_enrollments_academic_term_id_academic_terms_id_fk',
  }),
]);

export const enrollments = pgTable('enrollments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  courseId: uuid('course_id').notNull(),
  status: varchar({ length: 50 }).default('active').notNull(),
  enrolledAt: timestamp('enrolled_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('idx_enrollments_student_course').using('btree', table.studentId.asc().nullsLast().op('text_ops'), table.courseId.asc().nullsLast().op('text_ops')),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'enrollments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'enrollments_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.courseId],
    foreignColumns: [courses.id],
    name: 'enrollments_course_id_courses_id_fk',
  }),
]);

export const expenses = pgTable('expenses', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  category: expenseCategory().default('other').notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  expenseDate: date('expense_date').notNull(),
  description: text().notNull(),
  receiptUrl: text('receipt_url'),
  recordedById: text('recorded_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'expenses_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recordedById],
    foreignColumns: [user.id],
    name: 'expenses_recorded_by_id_user_id_fk',
  }),
]);

export const feeCategories = pgTable('fee_categories', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_categories_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const feeComponents = pgTable('fee_components', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  feeStructureId: uuid('fee_structure_id').notNull(),
  feeCategoryId: uuid('fee_category_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  isMandatory: boolean('is_mandatory').default(true).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_components_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'fee_components_fee_structure_id_fee_structures_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeCategoryId],
    foreignColumns: [feeCategories.id],
    name: 'fee_components_fee_category_id_fee_categories_id_fk',
  }),
]);

export const feeStructures = pgTable('fee_structures', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  programId: uuid('program_id'),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  description: text(),
  isActive: boolean('is_active').default(true).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_structures_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.programId],
    foreignColumns: [programs.id],
    name: 'fee_structures_program_id_programs_id_fk',
  }).onDelete('cascade'),
]);

export const feeStructureAssignments = pgTable('fee_structure_assignments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  feeStructureId: uuid('fee_structure_id').notNull(),
  classId: uuid('class_id').notNull(),
  effectiveDate: date('effective_date').defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_structure_assignments_tenant_id_fkey',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'fee_structure_assignments_fee_structure_id_fkey',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'fee_structure_assignments_class_id_fkey',
  }).onDelete('cascade'),
  unique('fee_structure_assignments_tenant_id_fee_structure_id_class__key').on(table.tenantId, table.feeStructureId, table.classId),
]);

export const feeSchedules = pgTable('fee_schedules', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  academicTermId: uuid('academic_term_id'),
  programId: uuid('program_id'),
  studentGroupId: uuid('student_group_id'),
  feeStructureId: uuid('fee_structure_id').notNull(),
  postingDate: timestamp('posting_date', { mode: 'string' }).notNull(),
  dueDate: date('due_date').notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_schedules_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.academicTermId],
    foreignColumns: [academicTerms.id],
    name: 'fee_schedules_academic_term_id_academic_terms_id_fk',
  }),
  foreignKey({
    columns: [table.programId],
    foreignColumns: [programs.id],
    name: 'fee_schedules_program_id_programs_id_fk',
  }),
  foreignKey({
    columns: [table.studentGroupId],
    foreignColumns: [studentGroups.id],
    name: 'fee_schedules_student_group_id_student_groups_id_fk',
  }),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'fee_schedules_fee_structure_id_fee_structures_id_fk',
  }),
]);

export const gradingScaleIntervals = pgTable('grading_scale_intervals', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  gradingScaleId: uuid('grading_scale_id').notNull(),
  gradeCode: varchar('grade_code', { length: 20 }).notNull(),
  minScore: numeric('min_score', { precision: 5, scale: 2 }).notNull(),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }).notNull(),
  description: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.gradingScaleId],
    foreignColumns: [gradingScales.id],
    name: 'grading_scale_intervals_grading_scale_id_grading_scales_id_fk',
  }).onDelete('cascade'),
]);

export const guardianStudents = pgTable('guardian_students', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  guardianId: uuid('guardian_id').notNull(),
  studentId: text('student_id').notNull(),
  relationshipType: varchar('relationship_type', { length: 100 }).notNull(),
  isPrimaryContact: boolean('is_primary_contact').default(false).notNull(),
  isEmergencyContact: boolean('is_emergency_contact').default(false).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guardian_students_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.guardianId],
    foreignColumns: [guardians.id],
    name: 'guardian_students_guardian_id_guardians_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'guardian_students_student_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const guardians = pgTable('guardians', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id'),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar({ length: 255 }),
  phone: varchar({ length: 50 }),
  occupation: varchar({ length: 255 }),
  address: text(),
  // ponytail: stopgap - see MIGRATION-NOTES.md. The real per-child relation lives on
  // guardian_students.relationship_type; this is only a fallback for guardians with
  // no linked student yet.
  defaultRelation: varchar('default_relation', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guardians_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'guardians_user_id_user_id_fk',
  }),
]);

export const invoiceItems = pgTable('invoice_items', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  feeCategoryId: uuid('fee_category_id'),
  description: varchar({ length: 255 }).notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'invoice_items_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'invoice_items_invoice_id_invoices_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeCategoryId],
    foreignColumns: [feeCategories.id],
    name: 'invoice_items_fee_category_id_fee_categories_id_fk',
  }),
]);

export const invoices = pgTable('invoices', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  feeStructureId: uuid('fee_structure_id'),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  netAmount: numeric('net_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  paidAmount: numeric('paid_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  status: invoiceStatus().default('pending').notNull(),
  dueDate: date('due_date').notNull(),
  issueDate: date('issue_date').defaultNow().notNull(),
  note: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'invoices_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'invoices_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'invoices_fee_structure_id_fee_structures_id_fk',
  }),
]);

export const namingSeries = pgTable('naming_series', {
  prefix: varchar({ length: 50 }).primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  currentVal: integer('current_val').default(0).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'naming_series_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const payments = pgTable('payments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  studentId: text('student_id').notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  paymentMethod: paymentMethod('payment_method').default('cash').notNull(),
  paymentDate: timestamp('payment_date', { mode: 'string' }).defaultNow().notNull(),
  referenceId: varchar('reference_id', { length: 100 }),
  receivedById: text('received_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'payments_invoice_id_invoices_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'payments_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.receivedById],
    foreignColumns: [user.id],
    name: 'payments_received_by_id_user_id_fk',
  }),
]);

export const rooms = pgTable('rooms', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  buildingId: uuid('building_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  capacity: integer().notNull(),
  roomType: varchar('room_type', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'rooms_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.buildingId],
    foreignColumns: [buildings.id],
    name: 'rooms_building_id_buildings_id_fk',
  }).onDelete('cascade'),
]);

export const session = pgTable('session', {
  id: text().primaryKey().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  token: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull(),
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'session_user_id_user_id_fk',
  }),
  unique('session_token_unique').on(table.token),
]);

export const studentDiscipline = pgTable('student_discipline', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  date: date().notNull(),
  infraction: text().notNull(),
  actionTaken: text('action_taken'),
  reportedById: text('reported_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_discipline_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_discipline_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.reportedById],
    foreignColumns: [user.id],
    name: 'student_discipline_reported_by_id_user_id_fk',
  }),
]);

export const studentLeaves = pgTable('student_leaves', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text().notNull(),
  status: leaveStatus().default('pending').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_leaves_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_leaves_student_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const timetableSlots = pgTable('timetable_slots', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentGroupId: uuid('student_group_id').notNull(),
  dayOfWeek: dayOfWeek('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  teacherId: text('teacher_id').notNull(),
  roomId: uuid('room_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'timetable_slots_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentGroupId],
    foreignColumns: [studentGroups.id],
    name: 'timetable_slots_student_group_id_student_groups_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [user.id],
    name: 'timetable_slots_teacher_id_user_id_fk',
  }),
  foreignKey({
    columns: [table.roomId],
    foreignColumns: [rooms.id],
    name: 'timetable_slots_room_id_rooms_id_fk',
  }).onDelete('cascade'),
]);

export const userProgress = pgTable('user_progress', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  chapterId: uuid('chapter_id').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'user_progress_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'user_progress_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.chapterId],
    foreignColumns: [chapters.id],
    name: 'user_progress_chapter_id_chapters_id_fk',
  }).onDelete('cascade'),
]);

export const quizAttempts = pgTable('quiz_attempts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  quizId: uuid('quiz_id').notNull(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  startTime: timestamp('start_time', { mode: 'string' }).defaultNow().notNull(),
  endTime: timestamp('end_time', { mode: 'string' }),
  answers: text(),
  score: numeric({ precision: 5, scale: 2 }),
  isPass: boolean('is_pass'),
  status: varchar({ length: 50 }).default('IN_PROGRESS').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'quiz_attempts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.quizId],
    foreignColumns: [quizzes.id],
    name: 'quiz_attempts_quiz_id_quizzes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'quiz_attempts_student_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const quizzes = pgTable('quizzes', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  chapterId: uuid('chapter_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  timeLimitMinutes: integer('time_limit_minutes'),
  passingScore: numeric('passing_score', { precision: 5, scale: 2 }).notNull(),
  maxAttempts: integer('max_attempts').default(1).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'quizzes_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.chapterId],
    foreignColumns: [chapters.id],
    name: 'quizzes_chapter_id_chapters_id_fk',
  }).onDelete('cascade'),
]);

export const quizQuestions = pgTable('quiz_questions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  quizId: uuid('quiz_id').notNull(),
  text: text().notNull(),
  type: varchar({ length: 50 }).default('MCQ').notNull(),
  points: numeric({ precision: 5, scale: 2 }).default('1.0').notNull(),
  options: text(),
  correctAnswer: text('correct_answer').notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'quiz_questions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.quizId],
    foreignColumns: [quizzes.id],
    name: 'quiz_questions_quiz_id_quizzes_id_fk',
  }).onDelete('cascade'),
]);

// ponytail: one row per tenant. Replaces a `let memorySettings` module-level
// object that was shared across every tenant in the process (unauthenticated
// cross-tenant read/write bug - see FULL-APP-AUDIT.md Section 1.2).
export const schoolSettings = pgTable('school_settings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  establishmentName: varchar('establishment_name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 100 }),
  city: varchar({ length: 255 }),
  address: text(),
  phone: varchar({ length: 50 }),
  email: varchar({ length: 255 }),
  website: varchar({ length: 500 }),
  country: varchar({ length: 100 }),
  // Legal / fiscal
  rc: varchar({ length: 100 }),
  ice: varchar({ length: 50 }),
  taxId: varchar('tax_id', { length: 100 }),
  legalStatus: varchar('legal_status', { length: 100 }),
  // Director contact
  directorName: varchar('director_name', { length: 255 }),
  directorEmail: varchar('director_email', { length: 255 }),
  directorPhone: varchar('director_phone', { length: 50 }),
  // Institutional contacts
  financialContactName: varchar('financial_contact_name', { length: 255 }),
  financialContactEmail: varchar('financial_contact_email', { length: 255 }),
  financialContactPhone: varchar('financial_contact_phone', { length: 50 }),
  admissionsContactName: varchar('admissions_contact_name', { length: 255 }),
  admissionsContactEmail: varchar('admissions_contact_email', { length: 255 }),
  admissionsContactPhone: varchar('admissions_contact_phone', { length: 50 }),
  // Operational
  academicYear: varchar('academic_year', { length: 50 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  allowOperations: boolean('allow_operations').default(true).notNull(),
  presenceModes: jsonb('presence_modes'),
  languages: jsonb(),
  security: jsonb(),
  // Locale / branding preferences
  localeTimezone: varchar('locale_timezone', { length: 100 }),
  dateFormat: varchar('date_format', { length: 50 }),
  documentHeaderStyle: varchar('document_header_style', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [

  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'school_settings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('school_settings_tenant_id_unique').on(table.tenantId),
]);

// ==========================================================================
// Optional subjects (elective groups) - models real student choice among a
// set of subjects, unlike classSubjects.type = 'elective' which only marks a
// subject as choosable, not which students actually picked what.
// ==========================================================================

export const electiveGroups = pgTable('elective_groups', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classId: uuid('class_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  maxChoices: integer('max_choices').default(1).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'elective_groups_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'elective_groups_class_id_classes_id_fk',
  }).onDelete('cascade'),
]);

export const electiveGroupSubjects = pgTable('elective_group_subjects', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  electiveGroupId: uuid('elective_group_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
}, table => [
  foreignKey({
    columns: [table.electiveGroupId],
    foreignColumns: [electiveGroups.id],
    name: 'elective_group_subjects_elective_group_id_elective_groups_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [subjects.id],
    name: 'elective_group_subjects_subject_id_subjects_id_fk',
  }).onDelete('cascade'),
  unique('elective_group_subjects_group_subject_unique').on(table.electiveGroupId, table.subjectId),
]);

// No DB-level unique constraint on (studentId, electiveGroupId) - maxChoices
// can be > 1 (e.g. "pick any 2 of these 3 enrichment electives"), so the
// limit is enforced at the API layer (count existing choices, reject past
// the group's maxChoices), same "app-layer, not DB-layer" pattern already
// used for classSubjects duplicate-assignment prevention.
export const studentElectiveChoices = pgTable('student_elective_choices', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  electiveGroupId: uuid('elective_group_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_elective_choices_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_elective_choices_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.electiveGroupId],
    foreignColumns: [electiveGroups.id],
    name: 'student_elective_choices_elective_group_id_elective_groups_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [subjects.id],
    name: 'student_elective_choices_subject_id_subjects_id_fk',
  }).onDelete('cascade'),
]);

// ==========================================================================
// Communication (SMS): real schema, log-only send (no external provider
// wired up yet - see FULL-APP-AUDIT.md / the plan for why). smsMessages is
// the send-log - `status` is always written 'sent' immediately by the API,
// never actually dispatched to a carrier.
// ==========================================================================

export const smsMessageStatus = pgEnum('sms_message_status', ['queued', 'sent', 'failed']);

export const smsTemplates = pgTable('sms_templates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  body: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'sms_templates_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const smsMessages = pgTable('sms_messages', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recipientPhone: varchar('recipient_phone', { length: 50 }).notNull(),
  studentId: text('student_id'),
  body: text().notNull(),
  status: smsMessageStatus().default('queued').notNull(),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'sms_messages_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'sms_messages_student_id_user_id_fk',
  }).onDelete('set null'),
]);

// ==========================================================================
// Student documents (admission wizard step 3: photo + PDFs). Separate from
// `user.photoUrl` (one photo, no "kind") - a student can have several
// documents of different types, each stored at
// {tenantId}/{studentId}/{documentType}.{ext} via src/libs/api/uploads.ts.
// ==========================================================================

export const studentDocumentType = pgEnum('student_document_type', ['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin']);

export const studentDocuments = pgTable('student_documents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  documentType: studentDocumentType('document_type').notNull(),
  fileExt: varchar('file_ext', { length: 10 }).notNull(),
  uploadedAt: timestamp('uploaded_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('student_documents_student_id_document_type_unique').on(table.studentId, table.documentType),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_documents_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_documents_student_id_user_id_fk',
  }).onDelete('cascade'),
]);

// ==========================================================================
// Access-reset: real temp-password rotation for a guardian's parent-portal
// account (creates the account on first use if the guardian has none yet -
// `guardians.userId` is nullable and nothing populated it before this).
// The plaintext temp password is never stored - only its hash, on `account`
// (same pattern as super-admin school creation) - this table just tracks
// request status/history for the UI.
// ==========================================================================

export const accessResetStatus = pgEnum('access_reset_status', ['code_generated', 'sms_sent']);

export const accessResetRequests = pgTable('access_reset_requests', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  guardianId: uuid('guardian_id').notNull(),
  status: accessResetStatus().default('code_generated').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'access_reset_requests_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'access_reset_requests_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.guardianId],
    foreignColumns: [guardians.id],
    name: 'access_reset_requests_guardian_id_guardians_id_fk',
  }).onDelete('cascade'),
]);

// ==========================================================================
// Class schedule (weekly timetable) + conflict detection.
// ponytail: the pre-existing `timetableSlots`/`rooms` tables are dead LMS
// boilerplate (studentGroupId -> studentGroups -> courses/academicYears,
// roomId -> rooms -> buildings - none of that chain is populated by this
// app's real ESchool-aligned model, same as `courses`/`programs` elsewhere -
// see MIGRATION-NOTES.md). Reusing them would mean resurrecting 4 more dead
// tables just to satisfy NOT NULL FKs. classScheduleSlots links directly to
// the real classSections/classSubjects/user model instead, same pattern as
// assessmentPlans.classSubjectId (Section 9). Room is a plain text label,
// not a separate rooms table - room *management* is out of scope, only
// conflict detection on the label matters here.
// ==========================================================================

export const timetableVersions = pgTable('timetable_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionYearId: uuid('session_year_id').notNull(),
  status: timetableVersionStatus('status').default('draft').notNull(),
  versionNumber: integer('version_number').default(1).notNull(),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  createdBy: text('created_by').notNull(),
  publishedBy: text('published_by'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  copiedFromVersionId: uuid('copied_from_version_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'timetable_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionYearId],
    foreignColumns: [sessionYears.id],
    name: 'timetable_versions_session_year_id_session_years_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'timetable_versions_created_by_user_id_fk',
  }),
  foreignKey({
    columns: [table.publishedBy],
    foreignColumns: [user.id],
    name: 'timetable_versions_published_by_user_id_fk',
  }),
  uniqueIndex('timetable_versions_single_published_idx').on(table.tenantId, table.sessionYearId).where(sql`status = 'published'`),
]);

export const classScheduleSlots = pgTable('class_schedule_slots', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSectionId: uuid('class_section_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  dayOfWeek: dayOfWeek('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  roomLabel: varchar('room_label', { length: 100 }),
  offeringId: uuid('offering_id'),
  versionId: uuid('version_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.versionId],
    foreignColumns: [timetableVersions.id],
    name: 'class_schedule_slots_version_id_timetable_versions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.offeringId],
    foreignColumns: [academicClassOfferings.id],
    name: 'class_schedule_slots_offering_id_academic_class_offerings_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'class_schedule_slots_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'class_schedule_slots_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'class_schedule_slots_class_subject_id_class_subjects_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [user.id],
    name: 'class_schedule_slots_teacher_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const cndpFilings = pgTable('cndp_filings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  filingReference: varchar('filing_reference', { length: 100 }),
  filedAt: date('filed_at'),
  status: cndpFilingStatus().default('draft').notNull(),
  documentUploadPath: varchar('document_upload_path', { length: 255 }),
  notes: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'cndp_filings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('cndp_filings_tenant_id_unique').on(table.tenantId),
]);

export const inquiries = pgTable('inquiries', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  phone: varchar({ length: 50 }),
  email: varchar({ length: 255 }),
  source: inquirySource().default('walk_in').notNull(),
  interestLevel: inquiryInterestLevel('interest_level').default('medium'),
  status: inquiryStatus().default('new').notNull(),
  assignedToId: text('assigned_to_id'),
  notes: text(),
  convertedApplicantId: uuid('converted_applicant_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inquiries_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assignedToId],
    foreignColumns: [user.id],
    name: 'inquiries_assigned_to_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.convertedApplicantId],
    foreignColumns: [applicants.id],
    name: 'inquiries_converted_applicant_id_applicants_id_fk',
  }).onDelete('set null'),
]);

export const inquiryFollowUps = pgTable('inquiry_follow_ups', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  inquiryId: uuid('inquiry_id').notNull(),
  type: inquiryFollowUpType().notNull(),
  notes: text().notNull(),
  scheduledFor: timestamp('scheduled_for', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inquiry_follow_ups_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.inquiryId],
    foreignColumns: [inquiries.id],
    name: 'inquiry_follow_ups_inquiry_id_inquiries_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'inquiry_follow_ups_created_by_id_user_id_fk',
  }).onDelete('set null'),
]);

export const announcements = pgTable('announcements', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  body: text().notNull(),
  targetRole: role('target_role'),
  targetClassSectionId: uuid('target_class_section_id'),
  createdById: text('created_by_id').notNull(),
  publishedAt: timestamp('published_at', { mode: 'string' }).defaultNow(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'announcements_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.targetClassSectionId],
    foreignColumns: [classSections.id],
    name: 'announcements_target_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'announcements_created_by_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const announcementReads = pgTable('announcement_reads', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  announcementId: uuid('announcement_id').notNull(),
  userId: text('user_id').notNull(),
  readAt: timestamp('read_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.announcementId],
    foreignColumns: [announcements.id],
    name: 'announcement_reads_announcement_id_announcements_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'announcement_reads_user_id_user_id_fk',
  }).onDelete('cascade'),
  unique('announcement_reads_announcement_id_user_id_unique').on(table.announcementId, table.userId),
]);

export const assignments = pgTable('assignments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  dueDate: timestamp('due_date', { mode: 'string' }).notNull(),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }).notNull(),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assignments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'assignments_class_subject_id_class_subjects_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'assignments_created_by_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  studentId: text('student_id').notNull(),
  submittedAt: timestamp('submitted_at', { mode: 'string' }),
  fileExt: varchar('file_ext', { length: 10 }),
  score: numeric({ precision: 5, scale: 2 }),
  feedback: text(),
  status: assignmentSubmissionStatus().default('pending').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'assignment_submissions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assignmentId],
    foreignColumns: [assignments.id],
    name: 'assignment_submissions_assignment_id_assignments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'assignment_submissions_student_id_user_id_fk',
  }).onDelete('cascade'),
  unique('assignment_submissions_assignment_student_unique').on(table.assignmentId, table.studentId),
]);

export const meetingSlots = pgTable('meeting_slots', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  bookedByGuardianId: uuid('booked_by_guardian_id'),
  studentId: text('student_id'),
  status: meetingSlotStatus().default('open').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'meeting_slots_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [user.id],
    name: 'meeting_slots_teacher_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.bookedByGuardianId],
    foreignColumns: [guardians.id],
    name: 'meeting_slots_booked_by_guardian_id_guardians_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'meeting_slots_student_id_user_id_fk',
  }).onDelete('set null'),
]);

export const onlineExams = pgTable('online_exams', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  title: varchar({ length: 255 }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  totalMarks: numeric('total_marks', { precision: 5, scale: 2 }).notNull(),
  startsAt: timestamp('starts_at', { mode: 'string' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'string' }).notNull(),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'online_exams_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'online_exams_class_subject_id_class_subjects_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'online_exams_created_by_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const onlineExamQuestions = pgTable('online_exam_questions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  onlineExamId: uuid('online_exam_id').notNull(),
  questionText: text('question_text').notNull(),
  marks: numeric({ precision: 5, scale: 2 }).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'online_exam_questions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.onlineExamId],
    foreignColumns: [onlineExams.id],
    name: 'online_exam_questions_online_exam_id_online_exams_id_fk',
  }).onDelete('cascade'),
]);

export const onlineExamQuestionOptions = pgTable('online_exam_question_options', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  questionId: uuid('question_id').notNull(),
  optionText: text('option_text').notNull(),
  isCorrect: boolean('is_correct').default(false).notNull(),
}, table => [
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [onlineExamQuestions.id],
    name: 'online_exam_question_options_question_id_fk',
  }).onDelete('cascade'),
]);

export const onlineExamAttempts = pgTable('online_exam_attempts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  onlineExamId: uuid('online_exam_id').notNull(),
  studentId: text('student_id').notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }).notNull(),
  submittedAt: timestamp('submitted_at', { mode: 'string' }),
  score: numeric({ precision: 5, scale: 2 }),
  status: examAttemptStatus().default('in_progress').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'online_exam_attempts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.onlineExamId],
    foreignColumns: [onlineExams.id],
    name: 'online_exam_attempts_online_exam_id_online_exams_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'online_exam_attempts_student_id_user_id_fk',
  }).onDelete('cascade'),
  unique('online_exam_attempts_exam_student_unique').on(table.onlineExamId, table.studentId),
]);

export const onlineExamAnswers = pgTable('online_exam_answers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  attemptId: uuid('attempt_id').notNull(),
  questionId: uuid('question_id').notNull(),
  selectedOptionId: uuid('selected_option_id'),
}, table => [
  foreignKey({
    columns: [table.attemptId],
    foreignColumns: [onlineExamAttempts.id],
    name: 'online_exam_answers_attempt_id_online_exam_attempts_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.questionId],
    foreignColumns: [onlineExamQuestions.id],
    name: 'online_exam_answers_question_id_online_exam_questions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.selectedOptionId],
    foreignColumns: [onlineExamQuestionOptions.id],
    name: 'online_exam_answers_selected_option_id_options_id_fk',
  }).onDelete('set null'),
]);

// ==========================================================================
// Addon entitlements — per-tenant module grants (Roadmap phase 1 "entitlement
// core"). One row per (tenant, addon). No row = not entitled. `isEnabled`
// is the emergency kill switch: a tenant can be entitled but switched off
// without losing the grant/expiry record.
//
// ponytail: no plan/price/billing tables here. Grants are set by super-admin
// directly; commercial billing is roadmap phase 13. `addonId` is a plain
// varchar matching src/addons/registry.ts ids, not a pgEnum, so adding an
// addon doesn't need a migration.
// ==========================================================================
export const addonEntitlements = pgTable('addon_entitlements', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  addonId: varchar('addon_id', { length: 64 }).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  grantedById: text('granted_by_id'),
  note: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'addon_entitlements_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.grantedById],
    foreignColumns: [user.id],
    name: 'addon_entitlements_granted_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('addon_entitlements_tenant_addon_unique').on(table.tenantId, table.addonId),
]);

// ==========================================================================
// Two-factor authentication (Better Auth `two-factor` plugin).
// Column names/types are dictated by the plugin - see
// node_modules/better-auth/dist/plugins/two-factor/schema.mjs. `secret` and
// `backupCodes` are stored encrypted by the plugin using BETTER_AUTH_SECRET.
// ==========================================================================
export const twoFactor = pgTable('two_factor', {
  id: text().primaryKey().notNull(),
  secret: text().notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id').notNull(),
  verified: boolean().default(true).notNull(),
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'two_factor_user_id_user_id_fk',
  }).onDelete('cascade'),
  index('two_factor_user_id_idx').on(table.userId),
  index('two_factor_secret_idx').on(table.secret),
]);

export const settingValues = pgTable('setting_values', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  key: varchar({ length: 128 }).notNull(),
  value: jsonb().notNull(),
  version: integer().default(1).notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'setting_values_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.updatedBy],
    foreignColumns: [user.id],
    name: 'setting_values_updated_by_user_id_fk',
  }).onDelete('set null'),
  unique('setting_values_tenant_branch_key_unique').on(table.tenantId, table.branchId, table.key),
  index('setting_values_tenant_key_idx').on(table.tenantId, table.key),
]);

export const settingValueVersions = pgTable('setting_value_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  settingValueId: uuid('setting_value_id').notNull(),
  version: integer().notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  actorId: text('actor_id'),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.settingValueId],
    foreignColumns: [settingValues.id],
    name: 'setting_value_versions_setting_value_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'setting_value_versions_actor_id_user_id_fk',
  }).onDelete('set null'),
  index('setting_value_versions_setting_value_id_idx').on(table.settingValueId),
]);

// ==========================================================================
// Capability-based permissions.
// Extends the role-enum auth with granular, per-tenant overridable permissions.
// Default mappings live in src/libs/api/permissions.ts; these tables store
// tenant and user-level overrides only.
// ==========================================================================

export const rolePermissions = pgTable('role_permissions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  roleId: varchar('role_id', { length: 50 }).notNull(),
  permissionId: varchar('permission_id', { length: 128 }).notNull(),
  // A row must be able to say "no", not just "yes". Without this the table is
  // grant-only and a school cannot take a default permission away from a role,
  // which is the main thing schools actually want to do with it.
  granted: boolean().default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'role_permissions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('role_permissions_tenant_role_perm_unique').on(table.tenantId, table.roleId, table.permissionId),
  index('role_permissions_tenant_role_idx').on(table.tenantId, table.roleId),
]);

export const userPermissionOverrides = pgTable('user_permission_overrides', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  permissionId: varchar('permission_id', { length: 128 }).notNull(),
  granted: boolean().default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'user_perm_overrides_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'user_perm_overrides_user_id_user_id_fk',
  }).onDelete('cascade'),
  unique('user_perm_overrides_tenant_user_perm_unique').on(table.tenantId, table.userId, table.permissionId),
  index('user_perm_overrides_tenant_user_idx').on(table.tenantId, table.userId),
]);

// ==========================================================================
// Shared services � files, notifications, export jobs.
// Used by all modules instead of each building its own.
// ==========================================================================

export const files = pgTable('files', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  module: varchar({ length: 64 }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadedBy: text('uploaded_by'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { mode: 'string' }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'files_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.uploadedBy],
    foreignColumns: [user.id],
    name: 'files_uploaded_by_user_id_fk',
  }).onDelete('set null'),
  index('files_tenant_module_idx').on(table.tenantId, table.module),
]);

export const notificationStatus = pgEnum('notification_status', ['pending', 'sent', 'failed']);

export const notifications = pgTable('notifications', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  channel: varchar({ length: 32 }).default('in_app').notNull(),
  template: varchar({ length: 128 }).notNull(),
  data: jsonb(),
  status: notificationStatus().default('pending').notNull(),
  readAt: timestamp('read_at', { mode: 'string' }),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  error: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'notifications_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recipientId],
    foreignColumns: [user.id],
    name: 'notifications_recipient_id_user_id_fk',
  }).onDelete('cascade'),
  index('notifications_recipient_unread_idx').on(table.recipientId, table.status),
]);

export const exportJobStatus = pgEnum('export_job_status', ['pending', 'processing', 'complete', 'failed']);

export const exportJobs = pgTable('export_jobs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reportType: varchar('report_type', { length: 128 }).notNull(),
  params: jsonb(),
  status: exportJobStatus().default('pending').notNull(),
  resultPath: text('result_path'),
  requestedBy: text('requested_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'string' }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'export_jobs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.requestedBy],
    foreignColumns: [user.id],
    name: 'export_jobs_requested_by_user_id_fk',
  }).onDelete('set null'),
  index('export_jobs_tenant_status_idx').on(table.tenantId, table.status),
]);

// ==========================================================================
// Effective-Dated Student Placement History (Phase 2).
// Preserves historical class section placements across academic session years.
// ==========================================================================
export const studentPlacements = pgTable('student_placements', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  sessionYearId: uuid('session_year_id').notNull(),
  classSectionId: uuid('class_section_id').notNull(),
  status: enrollmentStatus().default('enrolled').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isCurrent: boolean('is_current').default(true).notNull(),
  promotedFromPlacementId: uuid('promoted_from_placement_id'),
  notes: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_placements_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_placements_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionYearId],
    foreignColumns: [sessionYears.id],
    name: 'student_placements_session_year_id_session_years_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'student_placements_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.promotedFromPlacementId],
    foreignColumns: [table.id],
    name: 'student_placements_promoted_from_placement_id_fk',
  }).onDelete('set null'),
  check('student_placements_date_range_check', sql`${table.endDate} IS NULL OR ${table.endDate} > ${table.startDate}`),
  check('student_placements_current_date_check', sql`(${table.isCurrent} = true AND ${table.endDate} IS NULL) OR (${table.isCurrent} = false AND ${table.endDate} IS NOT NULL)`),
  uniqueIndex('student_placements_unique_current_idx').on(table.tenantId, table.studentId).where(sql`${table.isCurrent} = true`),
  index('student_placements_tenant_student_idx').on(table.tenantId, table.studentId),
  index('student_placements_student_session_idx').on(table.studentId, table.sessionYearId),
  index('student_placements_tenant_student_start_idx').on(table.tenantId, table.studentId, table.startDate),
  index('student_placements_tenant_session_idx').on(table.tenantId, table.sessionYearId),
]);

// ==========================================================================
// Promotion ledger: immutable batch + per-student decision trail.
// Placements themselves stay in studentPlacements (recordStudentPlacement) -
// these two tables only record *why* a placement changed and let a batch be
// looked up idempotently, they never duplicate placement data.
// ==========================================================================

export const promotionBatches = pgTable('promotion_batches', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sourceClassSectionId: uuid('source_class_section_id').notNull(),
  targetSessionYearId: uuid('target_session_year_id').notNull(),
  status: promotionBatchStatus().default('committed').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
  operatorId: text('operator_id').notNull(),
  revertedAt: timestamp('reverted_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'promotion_batches_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sourceClassSectionId],
    foreignColumns: [classSections.id],
    name: 'promotion_batches_source_class_section_id_class_sections_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.targetSessionYearId],
    foreignColumns: [sessionYears.id],
    name: 'promotion_batches_target_session_year_id_session_years_id_fk',
  }).onDelete('cascade'),
  unique('promotion_batches_tenant_id_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
  index('promotion_batches_tenant_idx').on(table.tenantId, table.createdAt),
]);

export const promotionDecisions = pgTable('promotion_decisions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  batchId: uuid('batch_id').notNull(),
  studentId: text('student_id').notNull(),
  decision: promotionDecisionType().notNull(),
  targetClassSectionId: uuid('target_class_section_id'),
  placementId: uuid('placement_id'),
  averagePercentageAtDecision: numeric('average_percentage_at_decision', { precision: 5, scale: 2 }),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'promotion_decisions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.batchId],
    foreignColumns: [promotionBatches.id],
    name: 'promotion_decisions_batch_id_promotion_batches_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'promotion_decisions_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.targetClassSectionId],
    foreignColumns: [classSections.id],
    name: 'promotion_decisions_target_class_section_id_class_sections_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.placementId],
    foreignColumns: [studentPlacements.id],
    name: 'promotion_decisions_placement_id_student_placements_id_fk',
  }).onDelete('set null'),
  unique('promotion_decisions_batch_id_student_id_unique').on(table.batchId, table.studentId),
  index('promotion_decisions_tenant_student_idx').on(table.tenantId, table.studentId),
]);

// ==========================================================================
// Phase 4: Financial & Accounting Ledgers Tables
// ==========================================================================

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  paymentId: uuid('payment_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  invoiceItemId: uuid('invoice_item_id'),
  allocatedAmount: numeric('allocated_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payment_allocations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.paymentId],
    foreignColumns: [payments.id],
    name: 'payment_allocations_payment_id_payments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'payment_allocations_invoice_id_invoices_id_fk',
  }).onDelete('cascade'),
  index('payment_allocations_tenant_payment_idx').on(table.tenantId, table.paymentId),
  index('payment_allocations_invoice_idx').on(table.invoiceId),
]);

export const creditNotes = pgTable('credit_notes', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  invoiceId: uuid('invoice_id'),
  creditNoteNumber: varchar('credit_note_number', { length: 50 }).notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  reason: text().notNull(),
  issuedById: text('issued_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  // Maker-checker: reuses discountApprovalStatus (already exactly
  // pending/approved/rejected) rather than a near-duplicate enum. A creator
  // with finance.approve is auto-approved (an approver proposing their own
  // note doesn't need a second approval); everyone else lands pending.
  status: discountApprovalStatus().default('pending').notNull(),
  approvedById: text('approved_by_id'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  rejectionReason: text('rejection_reason'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'credit_notes_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'credit_notes_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.issuedById],
    foreignColumns: [user.id],
    name: 'credit_notes_issued_by_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.approvedById],
    foreignColumns: [user.id],
    name: 'credit_notes_approved_by_id_user_id_fk',
  }).onDelete('set null'),
  index('credit_notes_tenant_student_idx').on(table.tenantId, table.studentId),
  index('credit_notes_tenant_status_idx').on(table.tenantId, table.status),
]);

export const refunds = pgTable('refunds', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  paymentId: uuid('payment_id'),
  refundNumber: varchar('refund_number', { length: 50 }).notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  refundMethod: paymentMethod('refund_method').default('cash').notNull(),
  reason: text().notNull(),
  approvedById: text('approved_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'refunds_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'refunds_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.paymentId],
    foreignColumns: [payments.id],
    name: 'refunds_payment_id_payments_id_fk',
  }).onDelete('set null'),
  index('refunds_tenant_student_idx').on(table.tenantId, table.studentId),
]);

export const feeDiscounts = pgTable('fee_discounts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  feeStructureId: uuid('fee_structure_id'),
  discountName: varchar('discount_name', { length: 150 }).notNull(),
  discountType: varchar('discount_type', { length: 20 }).default('percentage').notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  approvalStatus: discountApprovalStatus('approval_status').default('pending').notNull(),
  approvedById: text('approved_by_id'),
  note: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_discounts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'fee_discounts_student_id_user_id_fk',
  }).onDelete('cascade'),
  index('fee_discounts_tenant_student_idx').on(table.tenantId, table.studentId),
]);

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  code: varchar({ length: 50 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  accountType: accountType('account_type').notNull(),
  parentAccountId: uuid('parent_account_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'chart_of_accounts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('chart_of_accounts_tenant_code_unique').on(table.tenantId, table.code),
  index('chart_of_accounts_tenant_type_idx').on(table.tenantId, table.accountType),
]);

export const fiscalPeriods = pgTable('fiscal_periods', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: fiscalPeriodStatus().default('open').notNull(),
  closedAt: timestamp('closed_at', { mode: 'string' }),
  closedById: text('closed_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fiscal_periods_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('fiscal_periods_tenant_name_unique').on(table.tenantId, table.name),
  index('fiscal_periods_tenant_dates_idx').on(table.tenantId, table.startDate, table.endDate),
]);

export const journalEntries = pgTable('journal_entries', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  entryNumber: varchar('entry_number', { length: 50 }).notNull(),
  entryDate: date('entry_date').notNull(),
  description: text().notNull(),
  sourceModule: varchar('source_module', { length: 50 }).default('finance').notNull(),
  sourceId: uuid('source_id'),
  postedById: text('posted_by_id'),
  status: journalStatus().default('posted').notNull(),
  reversedByEntryId: uuid('reversed_by_entry_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'journal_entries_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.reversedByEntryId],
    foreignColumns: [table.id],
    name: 'journal_entries_reversed_by_entry_id_fk',
  }).onDelete('restrict'),
  unique('journal_entries_tenant_number_unique').on(table.tenantId, table.entryNumber),
  index('journal_entries_tenant_date_idx').on(table.tenantId, table.entryDate),
]);

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  journalEntryId: uuid('journal_entry_id').notNull(),
  accountId: uuid('account_id').notNull(),
  debitAmount: numeric('debit_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  creditAmount: numeric('credit_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  memo: text(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'journal_entry_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.journalEntryId],
    foreignColumns: [journalEntries.id],
    name: 'journal_entry_lines_journal_entry_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [chartOfAccounts.id],
    name: 'journal_entry_lines_account_id_fk',
  }).onDelete('cascade'),
  index('journal_entry_lines_journal_idx').on(table.journalEntryId),
]);

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  bankName: varchar('bank_name', { length: 150 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  currency: varchar({ length: 10 }).default('MAD').notNull(),
  currentBalance: numeric('current_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'bank_accounts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('bank_accounts_tenant_idx').on(table.tenantId),
]);

export const bankReconciliations = pgTable('bank_reconciliations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  bankAccountId: uuid('bank_account_id').notNull(),
  statementDate: date('statement_date').notNull(),
  statementBalance: numeric('statement_balance', { precision: 12, scale: 2 }).notNull(),
  reconciledBalance: numeric('reconciled_balance', { precision: 12, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).default('completed').notNull(),
  reconciledById: text('reconciled_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'bank_reconciliations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.bankAccountId],
    foreignColumns: [bankAccounts.id],
    name: 'bank_reconciliations_bank_account_id_fk',
  }).onDelete('cascade'),
  index('bank_reconciliations_tenant_bank_idx').on(table.tenantId, table.bankAccountId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Workforce Operations, HR & Payroll
// Migration 0041_add_hr_payroll_tables.sql
// ─────────────────────────────────────────────────────────────────────────────

export const employeeProfiles = pgTable('employee_profiles', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  cnssNumber: varchar('cnss_number', { length: 20 }),
  amoNumber: varchar('amo_number', { length: 20 }),
  bankRib: varchar('bank_rib', { length: 34 }),
  contractType: varchar('contract_type', { length: 20 }).default('cdi').notNull(),
  dependantsCount: integer('dependants_count').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_profiles_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'employee_profiles_user_id_fk',
  }).onDelete('cascade'),
  unique('employee_profiles_tenant_user_unique').on(table.tenantId, table.userId),
]);

export const salaryComponents = pgTable('salary_components', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  type: varchar({ length: 20 }).notNull(), // earning | deduction
  rateType: varchar('rate_type', { length: 20 }).notNull(), // fixed | percent | formula
  fixedValue: numeric('fixed_value', { precision: 12, scale: 4 }),
  formulaKey: varchar('formula_key', { length: 50 }),
  isStatutory: boolean('is_statutory').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'salary_components_tenant_id_fk',
  }).onDelete('cascade'),
]);

export const salaryTemplates = pgTable('salary_templates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'salary_templates_tenant_id_fk',
  }).onDelete('cascade'),
]);

export const salaryTemplateComponents = pgTable('salary_template_components', {
  templateId: uuid('template_id').notNull(),
  componentId: uuid('component_id').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
}, table => [
  foreignKey({
    columns: [table.templateId],
    foreignColumns: [salaryTemplates.id],
    name: 'salary_template_components_template_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.componentId],
    foreignColumns: [salaryComponents.id],
    name: 'salary_template_components_component_id_fk',
  }).onDelete('cascade'),
]);

export const employeeSalaryAssignments = pgTable('employee_salary_assignments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  templateId: uuid('template_id').notNull(),
  baseSalary: numeric('base_salary', { precision: 12, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_salary_assignments_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'employee_salary_assignments_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.templateId],
    foreignColumns: [salaryTemplates.id],
    name: 'employee_salary_assignments_template_id_fk',
  }),
  index('employee_salary_assignments_user_idx').on(table.tenantId, table.userId, table.effectiveDate),
]);

export const payrollPeriods = pgTable('payroll_periods', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: varchar({ length: 20 }).default('draft').notNull(), // draft | locked
  lockedAt: timestamp('locked_at', { mode: 'string' }),
  lockedById: text('locked_by_id'),
  journalEntryId: uuid('journal_entry_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payroll_periods_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.lockedById],
    foreignColumns: [user.id],
    name: 'payroll_periods_locked_by_id_fk',
  }),
  unique('payroll_periods_tenant_year_month_unique').on(table.tenantId, table.year, table.month),
]);

export const payrollRunLines = pgTable('payroll_run_lines', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  periodId: uuid('period_id').notNull(),
  userId: text('user_id').notNull(),
  grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).notNull(),
  cnssEmployee: numeric('cnss_employee', { precision: 12, scale: 2 }).notNull(),
  amoEmployee: numeric('amo_employee', { precision: 12, scale: 2 }).notNull(),
  irTax: numeric('ir_tax', { precision: 12, scale: 2 }).notNull(),
  netSalary: numeric('net_salary', { precision: 12, scale: 2 }).notNull(),
  cnssEmployer: numeric('cnss_employer', { precision: 12, scale: 2 }).notNull(),
  amoEmployer: numeric('amo_employer', { precision: 12, scale: 2 }).notNull(),
  totalEmployerCost: numeric('total_employer_cost', { precision: 12, scale: 2 }).notNull(),
  calculationSnapshot: jsonb('calculation_snapshot'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payroll_run_lines_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.periodId],
    foreignColumns: [payrollPeriods.id],
    name: 'payroll_run_lines_period_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'payroll_run_lines_user_id_fk',
  }),
  unique('payroll_run_lines_period_user_unique').on(table.periodId, table.userId),
]);

export const payslips = pgTable('payslips', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  periodId: uuid('period_id').notNull(),
  runLineId: uuid('run_line_id').notNull(),
  userId: text('user_id').notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).defaultNow().notNull(),
  pdfStorageKey: text('pdf_storage_key'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payslips_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.periodId],
    foreignColumns: [payrollPeriods.id],
    name: 'payslips_period_id_fk',
  }),
  foreignKey({
    columns: [table.runLineId],
    foreignColumns: [payrollRunLines.id],
    name: 'payslips_run_line_id_fk',
  }),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'payslips_user_id_fk',
  }),
  unique('payslips_run_line_unique').on(table.runLineId),
  index('payslips_user_period_idx').on(table.tenantId, table.userId, table.periodId),
]);

export const leaveCategories = pgTable('leave_categories', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 100 }).notNull(),
  daysPerYear: integer('days_per_year'),
  isPaid: boolean('is_paid').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'leave_categories_tenant_id_fk',
  }).onDelete('cascade'),
]);

export const employeeLeaveBalances = pgTable('employee_leave_balances', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  categoryId: uuid('category_id').notNull(),
  year: integer('year').notNull(),
  accruedDays: numeric('accrued_days', { precision: 5, scale: 2 }).default('0').notNull(),
  usedDays: numeric('used_days', { precision: 5, scale: 2 }).default('0').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_leave_balances_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'employee_leave_balances_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.categoryId],
    foreignColumns: [leaveCategories.id],
    name: 'employee_leave_balances_category_id_fk',
  }),
  unique('employee_leave_balances_unique').on(table.tenantId, table.userId, table.categoryId, table.year),
]);

export const leaveRequests = pgTable('leave_requests', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  categoryId: uuid('category_id').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  daysRequested: numeric('days_requested', { precision: 5, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(), // pending | approved | rejected
  reviewedById: text('reviewed_by_id'),
  reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'leave_requests_tenant_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'leave_requests_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.categoryId],
    foreignColumns: [leaveCategories.id],
    name: 'leave_requests_category_id_fk',
  }),
  foreignKey({
    columns: [table.reviewedById],
    foreignColumns: [user.id],
    name: 'leave_requests_reviewed_by_id_fk',
  }),
  index('leave_requests_user_status_idx').on(table.tenantId, table.userId, table.status),
]);

export const academicClassOfferings = pgTable('academic_class_offerings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionYearId: uuid('session_year_id').notNull(),
  classId: uuid('class_id').notNull(),
  sectionId: uuid('section_id').notNull(),
  capacity: integer('capacity'),
  status: status().default('active').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'academic_class_offerings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionYearId],
    foreignColumns: [sessionYears.id],
    name: 'academic_class_offerings_session_year_id_session_years_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [classes.id],
    name: 'academic_class_offerings_class_id_classes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sectionId],
    foreignColumns: [sections.id],
    name: 'academic_class_offerings_section_id_sections_id_fk',
  }).onDelete('cascade'),
  unique('academic_class_offerings_unique').on(table.tenantId, table.sessionYearId, table.classId, table.sectionId),
]);

export const academicRooms = pgTable('academic_rooms', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  capacity: integer('capacity'),
  roomType: varchar('room_type', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'academic_rooms_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('academic_rooms_tenant_name_unique').on(table.tenantId, table.name),
]);

export const cashierSessionStatus = pgEnum('cashier_session_status', ['open', 'closed', 'reconciled']);

export const cashierSessions = pgTable('cashier_sessions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  cashierId: text('cashier_id').notNull(),
  openedAt: timestamp('opened_at', { mode: 'string' }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { mode: 'string' }),
  startingFloat: numeric('starting_float', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  expectedCash: numeric('expected_cash', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  actualCash: numeric('actual_cash', { precision: 14, scale: 2, mode: 'number' }).default(0),
  totalCollected: numeric('total_collected', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  status: cashierSessionStatus().default('open').notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'cashier_sessions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.cashierId],
    foreignColumns: [user.id],
    name: 'cashier_sessions_cashier_id_user_id_fk',
  }).onDelete('cascade'),
  index('cashier_sessions_tenant_cashier_idx').on(table.tenantId, table.cashierId),
  index('cashier_sessions_status_idx').on(table.status),
]);


