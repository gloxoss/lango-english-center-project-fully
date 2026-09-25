import { and, eq, inArray } from 'drizzle-orm';
import { GET as getStudentResponse } from '@/app/api/students/route';
import { GET as getAnalyticsResponse } from '@/app/api/analytics/route';
import { GET as getTimetableResponse } from '@/app/api/academics/timetable-slots/route';
import { assessmentDefinitions, examHalls, examSchedules, examSeats, examTerms } from '@/features/assessment/models/assessment-schema';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSections, classes, user } from '@/models/Schema';
import type { DocumentModel, PreviewRequest } from '../contracts';
import { loadSchoolBrand } from './finance-loaders';

type OtherInput = Extract<PreviewRequest, { kind: 'student_profile' | 'leadership_report' | 'exam_seating' | 'exam_attendance' | 'timetable' }>;

async function routeData<T>(response: Response): Promise<T> {
  const body = await response.json() as { success?: boolean; data?: T; message?: string };
  if (!response.ok || !body.success || !body.data) throw new ApiError(response.status, 'DOCUMENT_SOURCE_UNAVAILABLE', body.message || 'Données indisponibles.');
  return body.data;
}

export async function loadOtherDocument(request: Request, context: RequestContext, input: OtherInput): Promise<DocumentModel> {
  const tenantId = context.tenantId;
  if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Établissement requis.');
  const school = await loadSchoolBrand(tenantId);

  if (input.kind === 'student_profile') {
    const url = new URL('/api/students', request.url);
    url.searchParams.set('id', input.sourceId);
    const student = await routeData<{
      fullName: string; matricule: string | null; className: string | null; academicYearName: string | null;
      dateOfBirth: string | null; phone: string | null; email: string | null; address: string | null; status: string;
      guardians: Array<{ firstName: string; lastName: string; relationshipType: string; phone: string | null }>;
    }>(await getStudentResponse(new Request(url, { headers: request.headers })));
    return {
      kind: input.kind, title: 'Fiche élève', reference: student.fullName, filename: `fiche-eleve-${input.sourceId}.pdf`, status: student.status, school,
      details: [
        { label: 'Nom', value: student.fullName }, { label: 'Matricule', value: student.matricule ?? '' },
        { label: 'Classe', value: student.className ?? '' }, { label: 'Année scolaire', value: student.academicYearName ?? '' },
        { label: 'Date de naissance', value: student.dateOfBirth ?? '' }, { label: 'Téléphone', value: student.phone ?? '' },
        { label: 'Email', value: student.email ?? '' }, { label: 'Adresse', value: student.address ?? '' },
      ],
      columns: [{ key: 'name', label: 'Responsable' }, { key: 'relationship', label: 'Lien' }, { key: 'phone', label: 'Téléphone' }],
      rows: (student.guardians ?? []).map(guardian => ({ name: `${guardian.firstName} ${guardian.lastName}`.trim(), relationship: guardian.relationshipType, phone: guardian.phone ?? '' })),
      totals: [],
    };
  }

  if (input.kind === 'leadership_report') {
    const url = new URL('/api/analytics', request.url);
    url.searchParams.set('range', input.range);
    const report = await routeData<{
      period: { from: string; to: string }; totalStudents: number; attendanceRate30d: number | null;
      finance: { collectionRate: number | null }; averageGrade: number | null;
      alerts: { priorityActions: Array<{ task: string; priority: string }> };
    }>(await getAnalyticsResponse(new Request(url, { headers: request.headers })));
    return {
      kind: input.kind, title: 'Rapport de direction', reference: `${report.period.from} – ${report.period.to}`,
      filename: `rapport-direction-${report.period.from}-${report.period.to}.pdf`, school,
      details: [{ label: 'Période', value: `${report.period.from} – ${report.period.to}` }],
      columns: [{ key: 'indicator', label: 'Indicateur' }, { key: 'value', label: 'Valeur', numeric: true }],
      rows: [
        { indicator: 'Élèves inscrits', value: String(report.totalStudents) },
        { indicator: 'Présence (30 jours)', value: report.attendanceRate30d == null ? 'Non disponible' : `${report.attendanceRate30d.toFixed(1)} %` },
        { indicator: 'Taux de recouvrement', value: report.finance.collectionRate == null ? 'Non disponible' : `${report.finance.collectionRate.toFixed(1)} %` },
        { indicator: 'Moyenne générale', value: report.averageGrade == null ? 'Non disponible' : `${report.averageGrade.toFixed(1)} %` },
        ...report.alerts.priorityActions.map(action => ({ indicator: `Action: ${action.task}`, value: action.priority })),
      ], totals: [],
    };
  }

  if (input.kind === 'timetable') {
    if (input.viewMode === 'teacher' && context.role === 'teacher' && input.sourceId !== context.userId) throw new ApiError(403, 'FORBIDDEN', 'Emploi du temps non autorisé.');
    if (input.viewMode === 'room' && context.branchId) throw new ApiError(403, 'FORBIDDEN', 'Filtre de salle indisponible pour cette succursale.');
    const url = new URL('/api/academics/timetable-slots', request.url);
    url.searchParams.set(input.viewMode === 'class' ? 'classSectionId' : input.viewMode === 'teacher' ? 'teacherId' : 'roomLabel', input.sourceId);
    const slots = await routeData<Array<{
      classSectionId: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string;
      subjectName: string | null; teacherName: string | null; roomLabel: string | null; className: string | null; sectionName: string | null;
    }>>(await getTimetableResponse(new Request(url, { headers: request.headers })));
    const sectionIds = [...new Set(slots.map(slot => slot.classSectionId))];
    const sectionRows = sectionIds.length ? await db.select({ id: classSections.id, branchId: classes.branchId }).from(classSections)
      .innerJoin(classes, and(eq(classSections.classId, classes.id), eq(classes.tenantId, tenantId)))
      .where(and(eq(classSections.tenantId, tenantId), inArray(classSections.id, sectionIds))) : [];
    const permittedSections = new Set(sectionRows.filter(row => !context.branchId || row.branchId === context.branchId).map(row => row.id));
    const visible = slots.filter(slot => permittedSections.has(slot.classSectionId));
    if (input.viewMode === 'class' && !permittedSections.has(input.sourceId)) throw new ApiError(404, 'NOT_FOUND', 'Classe introuvable.');
    return {
      kind: input.kind, title: 'Emploi du temps', reference: input.sourceId, filename: `emploi-du-temps-${input.viewMode}-${input.sourceId}.pdf`, school,
      details: [{ label: 'Vue', value: input.viewMode }, { label: 'Référence', value: input.sourceId }],
      columns: [{ key: 'day', label: 'Jour' }, { key: 'time', label: 'Horaire' }, { key: 'subject', label: 'Matière' }, { key: 'teacher', label: 'Enseignant' }, { key: 'class', label: 'Classe' }, { key: 'room', label: 'Salle' }],
      rows: visible.sort((a, b) => `${a.dayOfWeek}${a.startTime}`.localeCompare(`${b.dayOfWeek}${b.startTime}`)).map(slot => ({ day: slot.dayOfWeek, time: `${slot.startTime} – ${slot.endTime}`, subject: slot.subjectName ?? '', teacher: slot.teacherName ?? '', class: [slot.className, slot.sectionName].filter(Boolean).join(' '), room: slot.roomLabel ?? '' })),
      totals: [{ label: 'Séances', value: String(visible.length) }],
    };
  }

  const sessions = [];
  for (const id of input.scheduleIds) {
    const [schedule] = await db.select({ id: examSchedules.id, termId: examSchedules.examTermId, hallId: examSchedules.examHallId, subjectId: examSchedules.assessmentDefinitionId, startTime: examSchedules.startTime, endTime: examSchedules.endTime, status: examSchedules.status })
      .from(examSchedules).where(and(eq(examSchedules.tenantId, tenantId), eq(examSchedules.id, id))).limit(1);
    if (!schedule) throw new ApiError(404, 'NOT_FOUND', 'Examen introuvable.');
    const [[term], [hall], [subject]] = await Promise.all([
      db.select({ name: examTerms.name }).from(examTerms).where(and(eq(examTerms.tenantId, tenantId), eq(examTerms.id, schedule.termId))).limit(1),
      schedule.hallId ? db.select({ name: examHalls.name, branchId: examHalls.branchId }).from(examHalls).where(and(eq(examHalls.tenantId, tenantId), eq(examHalls.id, schedule.hallId))).limit(1) : Promise.resolve([]),
      db.select({ title: assessmentDefinitions.title }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.tenantId, tenantId), eq(assessmentDefinitions.id, schedule.subjectId))).limit(1),
    ]);
    if (context.branchId && hall?.branchId !== context.branchId) throw new ApiError(403, 'FORBIDDEN', 'Examen hors de votre succursale.');
    const seats = schedule.hallId ? await db.select({ desk: examSeats.deskLabel, candidate: examSeats.candidateNumber, matricule: user.matricule, studentName: user.name })
      .from(examSeats).innerJoin(user, and(eq(examSeats.studentId, user.id), eq(user.tenantId, tenantId)))
      .where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.examTermId, schedule.termId), eq(examSeats.examHallId, schedule.hallId))) : [];
    sessions.push({ schedule, term, hall, subject, seats });
  }
  const attendance = input.kind === 'exam_attendance';
  return {
    kind: input.kind, title: attendance ? 'Feuille de présence' : 'Plan de salle', reference: `${sessions.length} examen(s)`,
    filename: `${attendance ? 'presence' : 'placement'}-examens.pdf`, school,
    status: sessions.some(session => session.schedule.status !== 'published') ? 'Brouillon' : 'Publié',
    details: sessions.map((session, index) => ({ label: `Examen ${index + 1}`, value: `${session.subject?.title ?? ''} · ${session.term?.name ?? ''} · ${session.hall?.name ?? ''} · ${session.schedule.startTime}` })),
    columns: [{ key: 'exam', label: 'Examen' }, { key: 'desk', label: 'Place' }, { key: 'name', label: 'Candidat' }, { key: 'matricule', label: 'Matricule' }, ...(attendance ? [{ key: 'signature', label: 'Signature' }] : [])],
    rows: sessions.flatMap((session, index) => session.seats.map(seat => ({ exam: `${index + 1}. ${session.subject?.title ?? ''}`, desk: seat.desk ?? '', name: seat.studentName, matricule: seat.matricule ?? seat.candidate, signature: '' }))),
    totals: [{ label: 'Candidats', value: String(sessions.reduce((sum, session) => sum + session.seats.length, 0)) }],
  };
}
