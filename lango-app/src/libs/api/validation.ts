import { z } from 'zod';
import { ApiError } from './errors';
import { moneyInput } from '@/libs/finance/validation';

export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Le corps de la requête doit être un JSON valide.');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .slice(0, 3)
      .map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new ApiError(422, 'VALIDATION_ERROR', message);
  }
  return result.data;
}

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const studentCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  matricule: z.string().trim().min(1).max(50).regex(/^[\w/-]+$/).optional(),
  // classSectionId replaces the old free-text level/className. Optional: a
  // student can exist before being placed in a section (real onboarding flow),
  // and level/className remain readable as a fallback for pre-migration rows -
  // see MIGRATION-NOTES.md.
  classSectionId: z.uuid().optional().nullable(),
  guardianName: optionalText(255),
  phone: optionalText(50),
  status: z.enum(['Actif', 'Inactif', 'Archivé', 'active', 'inactive', 'archived']).optional(),
  paymentStatus: optionalText(50),
}).strict();

export const studentUpdateSchema = studentCreateSchema
  .omit({ email: true, matricule: true })
  .partial()
  .extend({ id: z.string().trim().min(1).max(100) })
  .strict();

// Import rows carry a free-text class label (e.g. "2nde A") instead of a
// classSectionId - the server resolves it against the tenant's real
// classSections by name, since a CSV export has no concept of our internal
// UUIDs. Unmatched labels are not a hard error - the student is inserted
// unclassified, same tolerance the manual creation form already has.
export const studentImportRowSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  phone: optionalText(50),
  classLabel: optionalText(100),
  dateOfBirth: z.iso.date().optional(),
  guardianName: optionalText(255),
  guardianPhone: optionalText(50),
}).strict();

export const studentImportSchema = z.object({
  rows: z.array(studentImportRowSchema).min(1).max(500),
}).strict();

export const teacherImportRowSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  phone: optionalText(50),
  specialization: optionalText(255),
}).strict();

export const teacherImportSchema = z.object({
  rows: z.array(teacherImportRowSchema).min(1).max(500),
}).strict();

export const expenseCreateSchema = z.object({
  category: z.enum(['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']),
  amount: z.number().positive(),
  expenseDate: z.iso.date(),
  description: z.string().trim().min(1).max(1000),
  receiptUrl: z.string().trim().max(2000).optional(),
}).strict();

export const expenseUpdateSchema = expenseCreateSchema
  .partial()
  .extend({ id: z.uuid() })
  .strict();

export const feeStructureCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  amount: moneyInput,
  description: optionalText(2000),
  isActive: z.boolean().optional(),
  academicTermId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
}).strict();

export const feeStructureUpdateSchema = feeStructureCreateSchema
  .partial()
  .extend({ id: z.uuid() })
  .strict();

const staffRole = z.enum(['Admin', 'Enseignant', 'Comptable', 'school_admin', 'teacher', 'accountant']);
const staffStatus = z.enum(['Actif', 'Inactif', 'Archivé', 'active', 'inactive', 'archived']);

export const userCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255),
  phone: optionalText(50),
  role: staffRole,
  status: staffStatus.optional(),
  qualification: optionalText(255),
  salary: z.coerce.number().finite().min(0).max(10000000).optional().nullable(),
}).strict();

export const userUpdateSchema = userCreateSchema
  .omit({ qualification: true, salary: true })
  .partial()
  .extend({ id: z.string().trim().min(1).max(100) })
  .strict();

export const guardianCreateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  relation: optionalText(50),
  phone: optionalText(50),
  email: z.email().max(255).optional(),
  address: optionalText(255),
  // Free-text names, not student ids - the current UI has no student picker.
  // See MIGRATION-NOTES.md: this is never written to guardian_students.
  linkedStudents: z.array(z.string().trim().max(255)).max(20).optional(),
  portalAccess: z.boolean().optional(),
}).strict();

export const guardianUpdateSchema = guardianCreateSchema
  .omit({ linkedStudents: true, portalAccess: true })
  .partial()
  .extend({ id: z.string().trim().min(1).max(100) })
  .strict();

const documentsSchema = z.object({
  contract: z.boolean().optional(),
  cin: z.boolean().optional(),
  diploma: z.boolean().optional(),
}).strict().optional();

// subjects/assignedClasses removed: assignment now goes exclusively through
// POST /api/academics/class-teachers and /api/academics/subject-teachers, so
// there is only one write path for this concept - see MIGRATION-NOTES.md.
export const teacherCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.email().max(255).optional(),
  phone: optionalText(50),
  employeeId: optionalText(50),
  specialization: optionalText(255),
  cycle: optionalText(100),
  workloadHours: z.coerce.number().int().min(0).max(80).optional(),
  hireDate: optionalText(50),
  status: staffStatus.optional(),
  documents: documentsSchema,
}).strict();

export const teacherUpdateSchema = teacherCreateSchema
  .omit({ email: true, employeeId: true })
  .partial()
  .extend({ id: z.string().trim().min(1).max(100) })
  .strict();

// ==========================================================================
// Academic structure (see the repo's Plan doc). id fields for these tables are
// real Postgres uuids, unlike user.id (a text id like "TCH-..."), so they use
// z.uuid() rather than the plain-string id validator used above.
// ==========================================================================

const idSchema = z.uuid();

export const sessionYearCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  isDefault: z.boolean().optional(),
}).strict();

export const sessionYearUpdateSchema = sessionYearCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

export const semesterCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startMonth: z.coerce.number().int().min(1).max(12),
  endMonth: z.coerce.number().int().min(1).max(12),
}).strict();

export const semesterUpdateSchema = semesterCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

// mediums/sections/streams share the exact same { name } shape.
const namedEntitySchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();
const namedEntityUpdateSchema = namedEntitySchema
  .partial()
  .extend({ id: idSchema })
  .strict();

export const mediumCreateSchema = namedEntitySchema;
export const mediumUpdateSchema = namedEntityUpdateSchema;
export const sectionCreateSchema = namedEntitySchema;
export const sectionUpdateSchema = namedEntityUpdateSchema;
export const streamCreateSchema = namedEntitySchema;
export const streamUpdateSchema = namedEntityUpdateSchema;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM attendu');

export const shiftCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startTime: timeOfDay,
  endTime: timeOfDay,
  isActive: z.boolean().optional(),
}).strict();

export const shiftUpdateSchema = shiftCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

export const classCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  includeSemesters: z.boolean().optional(),
  mediumId: idSchema,
  shiftId: idSchema.optional().nullable(),
  streamId: idSchema.optional().nullable(),
  cycle: z.enum(['maternelle', 'primaire', 'college', 'lycee']).optional().nullable(),
}).strict();

export const classUpdateSchema = classCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

// mediumId is never accepted here - the route derives it server-side from
// classId. See MIGRATION-NOTES.md / the academic-structure plan.
export const classSectionCreateSchema = z.object({
  classId: idSchema,
  sectionId: idSchema,
  maxStudents: z.number().int().positive().optional().nullable(),
  homeRoomId: idSchema.optional().nullable(),
}).strict();

export const classSectionUpdateSchema = classSectionCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: optionalText(50),
  mediumId: idSchema,
  type: z.enum(['theory', 'practical']),
}).strict();

export const subjectUpdateSchema = subjectCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

export const classSubjectCreateSchema = z.object({
  classId: idSchema,
  subjectId: idSchema,
  type: z.enum(['compulsory', 'elective']),
  semesterId: idSchema.optional().nullable(),
  offeringId: idSchema.optional().nullable(),
  weeklyMinutes: z.number().int().positive().optional().nullable(),
  displayOrder: z.number().int().optional().default(0),
  coefficient: z.number().positive().optional().default(1),
  passThreshold: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  curriculumLabel: z.string().max(100).optional().nullable(),
}).strict();

export const classSubjectUpdateSchema = classSubjectCreateSchema
  .partial()
  .extend({ id: idSchema })
  .strict();

// Pure join records: no PUT (reassignment is delete + recreate), so only a
// create schema exists for these two.
export const classTeacherCreateSchema = z.object({
  classSectionId: idSchema,
  teacherId: z.string().trim().min(1).max(100),
  offeringId: z.string().uuid().optional().nullable(),
  role: z.enum(['primary', 'assistant', 'support']).optional().default('primary'),
  notes: z.string().max(1000).optional().nullable(),
}).strict();

export const subjectTeacherCreateSchema = z.object({
  classSectionId: idSchema,
  subjectId: idSchema,
  classSubjectId: idSchema,
  teacherId: z.string().trim().min(1).max(100),
}).strict();

export const settingsUpdateSchema = z.object({
  // Core identity
  establishmentName: z.string().trim().min(1).max(255),
  shortName: optionalText(100),
  city: optionalText(255),
  address: optionalText(2000),
  phone: optionalText(50),
  email: z.email().max(255).optional().nullable(),
  website: optionalText(500),
  country: optionalText(100),
  // Legal / fiscal
  rc: optionalText(100),
  ice: optionalText(50),
  taxId: optionalText(100),
  legalStatus: optionalText(100),
  // Director contact
  directorName: optionalText(255),
  directorEmail: z.email().max(255).optional().nullable(),
  directorPhone: optionalText(50),
  // Institutional contacts
  financialContactName: optionalText(255),
  financialContactEmail: z.email().max(255).optional().nullable(),
  financialContactPhone: optionalText(50),
  admissionsContactName: optionalText(255),
  admissionsContactEmail: z.email().max(255).optional().nullable(),
  admissionsContactPhone: optionalText(50),
  // Operational flags
  allowOperations: z.boolean().optional(),
  // JSONB fields — key-count limits prevent DoS via oversized payloads
  presenceModes: z.record(z.string().max(50), z.boolean()).refine(val => !val || Object.keys(val).length <= 20, 'Maximum 20 clés autorisées').optional(),
  languages: z.record(z.string().max(20), z.boolean()).refine(val => !val || Object.keys(val).length <= 10, 'Maximum 10 clés autorisées').optional(),
  security: z.record(z.string().max(50), z.boolean()).refine(val => !val || Object.keys(val).length <= 20, 'Maximum 20 clés autorisées').optional(),
  // Locale preferences
  localeTimezone: optionalText(100),
  dateFormat: optionalText(50),
  documentHeaderStyle: z.enum(['classique', 'minimal', 'moderne']).optional().nullable(),
  // Attendance QR staging: grace period (minutes) and period start time (HH:MM)
  // used to decide whether a scan stages `present` or `late`.
  attendanceLateGraceMinutes: z.number().int().min(0).max(300).optional().nullable(),
  attendancePeriodStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM attendu').optional().nullable(),
}).strict();

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(50).regex(/^[\w-]+$/, 'Code doit être alphanumérique'),
  city: optionalText(100),
  address: optionalText(2000),
  phone: optionalText(50),
  email: z.email().max(255).optional().nullable(),
}).strict();


// ==========================================================================
// Assessment/grading engine
// ==========================================================================

export const assessmentPlanCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  classSubjectId: z.uuid(),
}).strict();

export const assessmentCreateSchema = z.object({
  assessmentPlanId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  assessmentDate: z.iso.date(),
}).strict();

// ==========================================================================
// Super-admin: schools + plan tier
// ==========================================================================

export const schoolCreateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  adminEmail: z.email().max(255),
  adminName: z.string().trim().min(2).max(255),
  planTier: z.enum(['trial', 'basic', 'standard', 'premium']).optional(),
}).strict();

export const schoolUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(255).optional(),
  planTier: z.enum(['trial', 'basic', 'standard', 'premium']).optional(),
  subscriptionStatus: z.enum(['active', 'suspended', 'cancelled']).optional(),
  isActive: z.boolean().optional(),
}).strict();

// ==========================================================================
// Optional subjects (elective groups)
// ==========================================================================

export const electiveGroupCreateSchema = z.object({
  classId: z.uuid(),
  name: z.string().trim().min(1).max(255),
  subjectIds: z.array(z.uuid()).min(2),
  maxChoices: z.coerce.number().int().min(1).max(10).optional(),
}).strict();

export const electiveChoiceCreateSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  electiveGroupId: z.uuid(),
  subjectId: z.uuid(),
}).strict();

// ==========================================================================
// Communication (SMS) - log-only send, see Schema.ts smsMessages comment.
// ==========================================================================

export const smsTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(1000),
}).strict();

export const smsTemplateUpdateSchema = smsTemplateCreateSchema
  .partial()
  .extend({ id: z.uuid() })
  .strict();

export const smsMessageCreateSchema = z.object({
  recipientPhone: z.string().trim().min(1).max(50),
  studentId: z.string().trim().min(1).max(100).optional(),
  body: z.string().trim().min(1).max(1000),
}).strict();

// ==========================================================================
// Class schedule (weekly timetable)
// ==========================================================================

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM attendu');

export const scheduleSlotCreateSchema = z.object({
  classSectionId: z.uuid(),
  classSubjectId: z.uuid(),
  teacherId: z.string().min(1),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  startTime: timeString,
  endTime: timeString,
  roomLabel: optionalText(100),
  offeringId: z.uuid().optional().nullable(),
  versionId: z.uuid().optional().nullable(),
}).strict().refine(data => data.startTime < data.endTime, { message: 'L\'heure de fin doit être après l\'heure de début.', path: ['endTime'] });

export const scheduleSlotUpdateSchema = z.object({
  id: z.uuid(),
  classSectionId: z.uuid().optional(),
  classSubjectId: z.uuid().optional(),
  teacherId: z.string().min(1).optional(),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  roomLabel: optionalText(100),
  offeringId: z.uuid().optional().nullable(),
  versionId: z.uuid().optional().nullable(),
}).strict();
