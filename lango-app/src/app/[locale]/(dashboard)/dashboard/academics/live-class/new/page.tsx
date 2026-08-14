import { and, eq, inArray } from 'drizzle-orm';
import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { SessionCreateForm } from '@/features/live-classrooms/ui/session-create-form';
import { requireServerPage } from '@/libs/api/page-guard';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { classes, classSections, classSubjects, liveClassProviderProfiles, sections, subjects, user } from '@/models/Schema';

export default async function LiveClassCreatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher', 'school_admin', 'super_admin'] });
  const ctx = await requireLivePage(locale, {
    allowedRoles: ['school_admin', 'super_admin', 'teacher'],
    requiredCapability: 'live.manage',
  });
  const tenantId = ctx.tenantId!;

  // A teacher may only schedule for their own assigned class sections.
  const teacherSectionIds = ctx.role === 'teacher' ? await getTeacherClassSectionIds(tenantId, ctx.userId) : null;

  const sectionConditions = [eq(classSections.tenantId, tenantId)];
  if (teacherSectionIds) {
    sectionConditions.push(inArray(classSections.id, teacherSectionIds));
  }

  const [profiles, sectionRows, classSubjectRows, teacherRows] = await Promise.all([
    db
      .select({
        id: liveClassProviderProfiles.id,
        name: liveClassProviderProfiles.name,
        providerType: liveClassProviderProfiles.providerType,
        enabled: liveClassProviderProfiles.enabled,
      })
      .from(liveClassProviderProfiles)
      .where(and(eq(liveClassProviderProfiles.tenantId, tenantId), eq(liveClassProviderProfiles.enabled, true)))
      .orderBy(liveClassProviderProfiles.name),
    db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(...sectionConditions))
      .orderBy(classes.name, sections.name),
    db
      .select({
        id: classSubjects.id,
        classId: classSubjects.classId,
        subjectName: subjects.name,
      })
      .from(classSubjects)
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(eq(classSubjects.tenantId, tenantId))
      .orderBy(subjects.name),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .orderBy(user.name),
  ]);

  // A teacher always hosts for themselves (admins may override via the teacher field).
  const defaultTeacherId = ctx.role === 'teacher' ? ctx.userId : (teacherRows[0]?.id ?? null);

  return (
    <SessionCreateForm
      locale={locale}
      profiles={profiles}
      sections={sectionRows}
      subjects={classSubjectRows}
      teachers={teacherRows}
      defaultTeacherId={defaultTeacherId}
      isTeacher={ctx.role === 'teacher'}
    />
  );
}
