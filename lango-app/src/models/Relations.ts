import { relations } from "drizzle-orm/relations";
import { tenants, branches, academicTerms, academicYears, user, account, admissionCampaigns, applicants, programs, assessmentCriteria, assessmentPlans, courses, gradingScales, assessmentPlanCriteria, assessmentResults, assessments, assessmentResultDetails, attendance, attendanceSummary, attendanceExcuses, attendanceFlags, attendanceFlagNotes, attendanceRegisters, classes, studentGroups, buildings, certificates, chapters, courseAttachments, courseEnrollments, programEnrollments, enrollments, expenses, feeCategories, feeComponents, feeStructures, feeSchedules, gradingScaleIntervals, guardianStudents, guardians, invoiceItems, invoices, namingSeries, payments, rooms, session, studentDiscipline, studentLeaves, timetableSlots, userProgress, quizAttempts, quizzes, quizQuestions } from "./Schema";

export const branchesRelations = relations(branches, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [branches.tenantId],
		references: [tenants.id]
	}),
	users: many(user),
	classes: many(classes),
}));

export const academicTermsRelations = relations(academicTerms, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [academicTerms.tenantId],
		references: [tenants.id]
	}),
	academicYear: one(academicYears, {
		fields: [academicTerms.academicYearId],
		references: [academicYears.id]
	}),
	admissionCampaigns: many(admissionCampaigns),
	programEnrollments: many(programEnrollments),
	feeSchedules: many(feeSchedules),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	academicTerms: many(academicTerms),
	academicYears: many(academicYears),
	users: many(user),
	admissionCampaigns: many(admissionCampaigns),
	applicants: many(applicants),
	programs: many(programs),
	assessmentCriteria: many(assessmentCriteria),
	assessmentPlans: many(assessmentPlans),
	courses: many(courses),
	gradingScales: many(gradingScales),
	assessmentResults: many(assessmentResults),
	assessments: many(assessments),
	attendances: many(attendance),
	studentGroups: many(studentGroups),
	buildings: many(buildings),
	certificates: many(certificates),
	chapters: many(chapters),
	courseAttachments: many(courseAttachments),
	courseEnrollments: many(courseEnrollments),
	programEnrollments: many(programEnrollments),
	enrollments: many(enrollments),
	expenses: many(expenses),
	feeCategories: many(feeCategories),
	feeComponents: many(feeComponents),
	feeStructures: many(feeStructures),
	feeSchedules: many(feeSchedules),
	guardianStudents: many(guardianStudents),
	guardians: many(guardians),
	invoiceItems: many(invoiceItems),
	invoices: many(invoices),
	namingSeries: many(namingSeries),
	payments: many(payments),
	rooms: many(rooms),
	studentDisciplines: many(studentDiscipline),
	studentLeaves: many(studentLeaves),
	timetableSlots: many(timetableSlots),
	userProgresses: many(userProgress),
	quizAttempts: many(quizAttempts),
	quizzes: many(quizzes),
	quizQuestions: many(quizQuestions),
}));

export const academicYearsRelations = relations(academicYears, ({one, many}) => ({
	academicTerms: many(academicTerms),
	tenant: one(tenants, {
		fields: [academicYears.tenantId],
		references: [tenants.id]
	}),
	studentGroups: many(studentGroups),
}));

export const userRelations = relations(user, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [user.tenantId],
		references: [tenants.id]
	}),
	accounts: many(account),
	applicants: many(applicants),
	assessmentResults: many(assessmentResults),
	attendances_studentId: many(attendance, {
		relationName: "attendance_studentId_user_id"
	}),
	attendances_markedById: many(attendance, {
		relationName: "attendance_markedById_user_id"
	}),
	certificates: many(certificates),
	programEnrollments: many(programEnrollments),
	enrollments: many(enrollments),
	expenses: many(expenses),
	guardianStudents: many(guardianStudents),
	guardians: many(guardians),
	invoices: many(invoices),
	payments_studentId: many(payments, {
		relationName: "payments_studentId_user_id"
	}),
	payments_receivedById: many(payments, {
		relationName: "payments_receivedById_user_id"
	}),
	sessions: many(session),
	studentDisciplines_studentId: many(studentDiscipline, {
		relationName: "studentDiscipline_studentId_user_id"
	}),
	studentDisciplines_reportedById: many(studentDiscipline, {
		relationName: "studentDiscipline_reportedById_user_id"
	}),
	studentLeaves: many(studentLeaves),
	timetableSlots: many(timetableSlots),
	userProgresses: many(userProgress),
	quizAttempts: many(quizAttempts),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const admissionCampaignsRelations = relations(admissionCampaigns, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [admissionCampaigns.tenantId],
		references: [tenants.id]
	}),
	academicTerm: one(academicTerms, {
		fields: [admissionCampaigns.academicTermId],
		references: [academicTerms.id]
	}),
	applicants: many(applicants),
}));

export const applicantsRelations = relations(applicants, ({one}) => ({
	tenant: one(tenants, {
		fields: [applicants.tenantId],
		references: [tenants.id]
	}),
	admissionCampaign: one(admissionCampaigns, {
		fields: [applicants.campaignId],
		references: [admissionCampaigns.id]
	}),
	program: one(programs, {
		fields: [applicants.targetProgramId],
		references: [programs.id]
	}),
	user: one(user, {
		fields: [applicants.convertedUserId],
		references: [user.id]
	}),
}));

export const programsRelations = relations(programs, ({one, many}) => ({
	applicants: many(applicants),
	tenant: one(tenants, {
		fields: [programs.tenantId],
		references: [tenants.id]
	}),
	courses: many(courses),
	programEnrollments: many(programEnrollments),
	feeStructures: many(feeStructures),
	feeSchedules: many(feeSchedules),
}));

export const assessmentCriteriaRelations = relations(assessmentCriteria, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [assessmentCriteria.tenantId],
		references: [tenants.id]
	}),
	assessmentPlanCriteria: many(assessmentPlanCriteria),
}));

export const assessmentPlansRelations = relations(assessmentPlans, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [assessmentPlans.tenantId],
		references: [tenants.id]
	}),
	course: one(courses, {
		fields: [assessmentPlans.courseId],
		references: [courses.id]
	}),
	gradingScale: one(gradingScales, {
		fields: [assessmentPlans.gradingScaleId],
		references: [gradingScales.id]
	}),
	assessmentPlanCriteria: many(assessmentPlanCriteria),
	assessments: many(assessments),
}));

export const coursesRelations = relations(courses, ({one, many}) => ({
	assessmentPlans: many(assessmentPlans),
	tenant: one(tenants, {
		fields: [courses.tenantId],
		references: [tenants.id]
	}),
	program: one(programs, {
		fields: [courses.programId],
		references: [programs.id]
	}),
	studentGroups: many(studentGroups),
	certificates: many(certificates),
	chapters: many(chapters),
	courseAttachments: many(courseAttachments),
	courseEnrollments: many(courseEnrollments),
	enrollments: many(enrollments),
}));

export const gradingScalesRelations = relations(gradingScales, ({one, many}) => ({
	assessmentPlans: many(assessmentPlans),
	tenant: one(tenants, {
		fields: [gradingScales.tenantId],
		references: [tenants.id]
	}),
	gradingScaleIntervals: many(gradingScaleIntervals),
}));

export const assessmentPlanCriteriaRelations = relations(assessmentPlanCriteria, ({one, many}) => ({
	assessmentPlan: one(assessmentPlans, {
		fields: [assessmentPlanCriteria.assessmentPlanId],
		references: [assessmentPlans.id]
	}),
	assessmentCriterion: one(assessmentCriteria, {
		fields: [assessmentPlanCriteria.criteriaId],
		references: [assessmentCriteria.id]
	}),
	assessmentResultDetails: many(assessmentResultDetails),
}));

export const assessmentResultsRelations = relations(assessmentResults, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [assessmentResults.tenantId],
		references: [tenants.id]
	}),
	assessment: one(assessments, {
		fields: [assessmentResults.assessmentId],
		references: [assessments.id]
	}),
	user: one(user, {
		fields: [assessmentResults.studentId],
		references: [user.id]
	}),
	assessmentResultDetails: many(assessmentResultDetails),
}));

export const assessmentsRelations = relations(assessments, ({one, many}) => ({
	assessmentResults: many(assessmentResults),
	tenant: one(tenants, {
		fields: [assessments.tenantId],
		references: [tenants.id]
	}),
	assessmentPlan: one(assessmentPlans, {
		fields: [assessments.assessmentPlanId],
		references: [assessmentPlans.id]
	}),
}));

export const assessmentResultDetailsRelations = relations(assessmentResultDetails, ({one}) => ({
	assessmentResult: one(assessmentResults, {
		fields: [assessmentResultDetails.assessmentResultId],
		references: [assessmentResults.id]
	}),
	assessmentPlanCriterion: one(assessmentPlanCriteria, {
		fields: [assessmentResultDetails.assessmentPlanCriteriaId],
		references: [assessmentPlanCriteria.id]
	}),
}));

export const attendanceRelations = relations(attendance, ({one}) => ({
	tenant: one(tenants, {
		fields: [attendance.tenantId],
		references: [tenants.id]
	}),
	user_studentId: one(user, {
		fields: [attendance.studentId],
		references: [user.id],
		relationName: "attendance_studentId_user_id"
	}),
	class: one(classes, {
		fields: [attendance.studentGroupId],
		references: [classes.id]
	}),
	course_subjectId: one(courses, {
		fields: [attendance.subjectId],
		references: [courses.id]
	}),
	user_markedById: one(user, {
		fields: [attendance.markedById],
		references: [user.id],
		relationName: "attendance_markedById_user_id"
	}),
	register: one(attendanceRegisters, {
		fields: [attendance.registerId],
		references: [attendanceRegisters.id]
	}),
}));

export const attendanceRegistersRelations = relations(attendanceRegisters, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [attendanceRegisters.tenantId],
		references: [tenants.id]
	}),
	class: one(classes, {
		fields: [attendanceRegisters.classId],
		references: [classes.id]
	}),
	submittedBy: one(user, {
		fields: [attendanceRegisters.submittedById],
		references: [user.id],
		relationName: "attendance_registers_submittedById_user_id"
	}),
	reopenedBy: one(user, {
		fields: [attendanceRegisters.reopenedById],
		references: [user.id],
		relationName: "attendance_registers_reopenedById_user_id"
	}),
	entries: many(attendance),
}));

export const attendanceSummaryRelations = relations(attendanceSummary, ({one}) => ({
	tenant: one(tenants, {
		fields: [attendanceSummary.tenantId],
		references: [tenants.id]
	}),
	student: one(user, {
		fields: [attendanceSummary.studentId],
		references: [user.id]
	}),
}));

export const attendanceExcusesRelations = relations(attendanceExcuses, ({one}) => ({
	tenant: one(tenants, {
		fields: [attendanceExcuses.tenantId],
		references: [tenants.id]
	}),
	student: one(user, {
		fields: [attendanceExcuses.studentId],
		references: [user.id]
	}),
	reviewedBy: one(user, {
		fields: [attendanceExcuses.reviewedById],
		references: [user.id]
	}),
}));

export const attendanceFlagsRelations = relations(attendanceFlags, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [attendanceFlags.tenantId],
		references: [tenants.id]
	}),
	student: one(user, {
		fields: [attendanceFlags.studentId],
		references: [user.id],
		relationName: "attendance_flags_studentId_user_id"
	}),
	assignedTo: one(user, {
		fields: [attendanceFlags.assignedToId],
		references: [user.id],
		relationName: "attendance_flags_assignedToId_user_id"
	}),
	notes: many(attendanceFlagNotes),
}));

export const attendanceFlagNotesRelations = relations(attendanceFlagNotes, ({one}) => ({
	tenant: one(tenants, {
		fields: [attendanceFlagNotes.tenantId],
		references: [tenants.id]
	}),
	flag: one(attendanceFlags, {
		fields: [attendanceFlagNotes.flagId],
		references: [attendanceFlags.id]
	}),
	author: one(user, {
		fields: [attendanceFlagNotes.authorId],
		references: [user.id]
	}),
}));

export const classesAttendanceRelations = relations(classes, ({many}) => ({
	attendances: many(attendance),
	registers: many(attendanceRegisters),
}));

export const studentGroupsRelations = relations(studentGroups, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [studentGroups.tenantId],
		references: [tenants.id]
	}),
	course: one(courses, {
		fields: [studentGroups.courseId],
		references: [courses.id]
	}),
	academicYear: one(academicYears, {
		fields: [studentGroups.academicYearId],
		references: [academicYears.id]
	}),
	feeSchedules: many(feeSchedules),
	timetableSlots: many(timetableSlots),
}));

export const buildingsRelations = relations(buildings, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [buildings.tenantId],
		references: [tenants.id]
	}),
	rooms: many(rooms),
}));

export const certificatesRelations = relations(certificates, ({one}) => ({
	tenant: one(tenants, {
		fields: [certificates.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [certificates.studentId],
		references: [user.id]
	}),
	course: one(courses, {
		fields: [certificates.courseId],
		references: [courses.id]
	}),
}));

export const chaptersRelations = relations(chapters, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [chapters.tenantId],
		references: [tenants.id]
	}),
	course: one(courses, {
		fields: [chapters.courseId],
		references: [courses.id]
	}),
	userProgresses: many(userProgress),
	quizzes: many(quizzes),
}));

export const courseAttachmentsRelations = relations(courseAttachments, ({one}) => ({
	tenant: one(tenants, {
		fields: [courseAttachments.tenantId],
		references: [tenants.id]
	}),
	course: one(courses, {
		fields: [courseAttachments.courseId],
		references: [courses.id]
	}),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({one}) => ({
	tenant: one(tenants, {
		fields: [courseEnrollments.tenantId],
		references: [tenants.id]
	}),
	programEnrollment: one(programEnrollments, {
		fields: [courseEnrollments.programEnrollmentId],
		references: [programEnrollments.id]
	}),
	course: one(courses, {
		fields: [courseEnrollments.courseId],
		references: [courses.id]
	}),
}));

export const programEnrollmentsRelations = relations(programEnrollments, ({one, many}) => ({
	courseEnrollments: many(courseEnrollments),
	tenant: one(tenants, {
		fields: [programEnrollments.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [programEnrollments.studentId],
		references: [user.id]
	}),
	program: one(programs, {
		fields: [programEnrollments.programId],
		references: [programs.id]
	}),
	academicTerm: one(academicTerms, {
		fields: [programEnrollments.academicTermId],
		references: [academicTerms.id]
	}),
}));

export const enrollmentsRelations = relations(enrollments, ({one}) => ({
	tenant: one(tenants, {
		fields: [enrollments.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [enrollments.studentId],
		references: [user.id]
	}),
	course: one(courses, {
		fields: [enrollments.courseId],
		references: [courses.id]
	}),
}));

export const expensesRelations = relations(expenses, ({one}) => ({
	tenant: one(tenants, {
		fields: [expenses.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [expenses.recordedById],
		references: [user.id]
	}),
}));

export const feeCategoriesRelations = relations(feeCategories, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [feeCategories.tenantId],
		references: [tenants.id]
	}),
	feeComponents: many(feeComponents),
	invoiceItems: many(invoiceItems),
}));

export const feeComponentsRelations = relations(feeComponents, ({one}) => ({
	tenant: one(tenants, {
		fields: [feeComponents.tenantId],
		references: [tenants.id]
	}),
	feeStructure: one(feeStructures, {
		fields: [feeComponents.feeStructureId],
		references: [feeStructures.id]
	}),
	feeCategory: one(feeCategories, {
		fields: [feeComponents.feeCategoryId],
		references: [feeCategories.id]
	}),
}));

export const feeStructuresRelations = relations(feeStructures, ({one, many}) => ({
	feeComponents: many(feeComponents),
	tenant: one(tenants, {
		fields: [feeStructures.tenantId],
		references: [tenants.id]
	}),
	program: one(programs, {
		fields: [feeStructures.programId],
		references: [programs.id]
	}),
	feeSchedules: many(feeSchedules),
	invoices: many(invoices),
}));

export const feeSchedulesRelations = relations(feeSchedules, ({one}) => ({
	tenant: one(tenants, {
		fields: [feeSchedules.tenantId],
		references: [tenants.id]
	}),
	academicTerm: one(academicTerms, {
		fields: [feeSchedules.academicTermId],
		references: [academicTerms.id]
	}),
	program: one(programs, {
		fields: [feeSchedules.programId],
		references: [programs.id]
	}),
	studentGroup: one(studentGroups, {
		fields: [feeSchedules.studentGroupId],
		references: [studentGroups.id]
	}),
	feeStructure: one(feeStructures, {
		fields: [feeSchedules.feeStructureId],
		references: [feeStructures.id]
	}),
}));

export const gradingScaleIntervalsRelations = relations(gradingScaleIntervals, ({one}) => ({
	gradingScale: one(gradingScales, {
		fields: [gradingScaleIntervals.gradingScaleId],
		references: [gradingScales.id]
	}),
}));

export const guardianStudentsRelations = relations(guardianStudents, ({one}) => ({
	tenant: one(tenants, {
		fields: [guardianStudents.tenantId],
		references: [tenants.id]
	}),
	guardian: one(guardians, {
		fields: [guardianStudents.guardianId],
		references: [guardians.id]
	}),
	user: one(user, {
		fields: [guardianStudents.studentId],
		references: [user.id]
	}),
}));

export const guardiansRelations = relations(guardians, ({one, many}) => ({
	guardianStudents: many(guardianStudents),
	tenant: one(tenants, {
		fields: [guardians.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [guardians.userId],
		references: [user.id]
	}),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({one}) => ({
	tenant: one(tenants, {
		fields: [invoiceItems.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [invoiceItems.invoiceId],
		references: [invoices.id]
	}),
	feeCategory: one(feeCategories, {
		fields: [invoiceItems.feeCategoryId],
		references: [feeCategories.id]
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	invoiceItems: many(invoiceItems),
	tenant: one(tenants, {
		fields: [invoices.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [invoices.studentId],
		references: [user.id]
	}),
	feeStructure: one(feeStructures, {
		fields: [invoices.feeStructureId],
		references: [feeStructures.id]
	}),
	payments: many(payments),
}));

export const namingSeriesRelations = relations(namingSeries, ({one}) => ({
	tenant: one(tenants, {
		fields: [namingSeries.tenantId],
		references: [tenants.id]
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	tenant: one(tenants, {
		fields: [payments.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [payments.invoiceId],
		references: [invoices.id]
	}),
	user_studentId: one(user, {
		fields: [payments.studentId],
		references: [user.id],
		relationName: "payments_studentId_user_id"
	}),
	user_receivedById: one(user, {
		fields: [payments.receivedById],
		references: [user.id],
		relationName: "payments_receivedById_user_id"
	}),
}));

export const roomsRelations = relations(rooms, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [rooms.tenantId],
		references: [tenants.id]
	}),
	building: one(buildings, {
		fields: [rooms.buildingId],
		references: [buildings.id]
	}),
	timetableSlots: many(timetableSlots),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const studentDisciplineRelations = relations(studentDiscipline, ({one}) => ({
	tenant: one(tenants, {
		fields: [studentDiscipline.tenantId],
		references: [tenants.id]
	}),
	user_studentId: one(user, {
		fields: [studentDiscipline.studentId],
		references: [user.id],
		relationName: "studentDiscipline_studentId_user_id"
	}),
	user_reportedById: one(user, {
		fields: [studentDiscipline.reportedById],
		references: [user.id],
		relationName: "studentDiscipline_reportedById_user_id"
	}),
}));

export const studentLeavesRelations = relations(studentLeaves, ({one}) => ({
	tenant: one(tenants, {
		fields: [studentLeaves.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [studentLeaves.studentId],
		references: [user.id]
	}),
}));

export const timetableSlotsRelations = relations(timetableSlots, ({one}) => ({
	tenant: one(tenants, {
		fields: [timetableSlots.tenantId],
		references: [tenants.id]
	}),
	studentGroup: one(studentGroups, {
		fields: [timetableSlots.studentGroupId],
		references: [studentGroups.id]
	}),
	user: one(user, {
		fields: [timetableSlots.teacherId],
		references: [user.id]
	}),
	room: one(rooms, {
		fields: [timetableSlots.roomId],
		references: [rooms.id]
	}),
}));

export const userProgressRelations = relations(userProgress, ({one}) => ({
	tenant: one(tenants, {
		fields: [userProgress.tenantId],
		references: [tenants.id]
	}),
	user: one(user, {
		fields: [userProgress.userId],
		references: [user.id]
	}),
	chapter: one(chapters, {
		fields: [userProgress.chapterId],
		references: [chapters.id]
	}),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({one}) => ({
	tenant: one(tenants, {
		fields: [quizAttempts.tenantId],
		references: [tenants.id]
	}),
	quiz: one(quizzes, {
		fields: [quizAttempts.quizId],
		references: [quizzes.id]
	}),
	user: one(user, {
		fields: [quizAttempts.studentId],
		references: [user.id]
	}),
}));

export const quizzesRelations = relations(quizzes, ({one, many}) => ({
	quizAttempts: many(quizAttempts),
	tenant: one(tenants, {
		fields: [quizzes.tenantId],
		references: [tenants.id]
	}),
	chapter: one(chapters, {
		fields: [quizzes.chapterId],
		references: [chapters.id]
	}),
	quizQuestions: many(quizQuestions),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({one}) => ({
	tenant: one(tenants, {
		fields: [quizQuestions.tenantId],
		references: [tenants.id]
	}),
	quiz: one(quizzes, {
		fields: [quizQuestions.quizId],
		references: [quizzes.id]
	}),
}));
