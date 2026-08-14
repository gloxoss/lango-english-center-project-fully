import { count, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { account, applicants, classSections, classes, guardianStudents, guardians, inquiries, sections, user } from '@/models/Schema';

export class StudentAdapter {
  /**
   * 1. Credential Status Report: User account provisioning state (masked email, zero plain passwords).
   * isProvisioned reflects a real credential row in `account` (the same
   * table Better Auth uses everywhere else in this app), not a hardcoded
   * constant.
   */
  static async getCredentialStatusReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        studentId: user.id,
        fullName: user.name,
        role: user.role,
        maskedEmail: user.email,
        isProvisioned: sql<boolean>`EXISTS (SELECT 1 FROM ${account} WHERE ${account.userId} = ${user.id})`,
        lastLoginAt: user.updatedAt,
      })
      .from(user)
      .where(sql`${user.tenantId} = ${tenantId} AND ${user.role} = 'student'`);

    return list.map(item => ({
      ...item,
      maskedEmail: item.maskedEmail ? item.maskedEmail.replace(/(.{2})(.*)(?=@)/, '$1***') : 'N/A',
    }));
  }

  /**
   * 2. Admission Conversion Funnel Report.
   */
  static async getAdmissionFunnelReport(tenantId: string, params?: any) {
    const [inquiriesCount] = await db
      .select({ count: count() })
      .from(inquiries)
      .where(eq(inquiries.tenantId, tenantId));

    const [applicantsCount] = await db
      .select({ count: count() })
      .from(applicants)
      .where(eq(applicants.tenantId, tenantId));

    const [enrolledCount] = await db
      .select({ count: count() })
      .from(user)
      .where(sql`${user.tenantId} = ${tenantId} AND ${user.role} = 'student'`);

    const totalInquiries = inquiriesCount?.count || 0;
    const totalApplicants = applicantsCount?.count || 0;
    const totalEnrolled = enrolledCount?.count || 0;

    return [
      { stage: '1. Demandes & Inquiries', count: totalInquiries, conversionRate: 100, avgProcessingDays: 1 },
      { stage: '2. Dossiers Candidats', count: totalApplicants, conversionRate: totalInquiries > 0 ? Math.round((totalApplicants / totalInquiries) * 100) : 0, avgProcessingDays: 3 },
      { stage: '3. Élèves Inscrits', count: totalEnrolled, conversionRate: totalApplicants > 0 ? Math.round((totalEnrolled / totalApplicants) * 100) : 0, avgProcessingDays: 5 },
    ];
  }

  /**
   * 3. Class & Section Occupancy Report.
   */
  static async getClassSectionOccupancyReport(tenantId: string, params?: any) {
    const rows = await db
      .select({
        className: classes.name,
        sectionName: sections.name,
        capacity: classSections.maxStudents,
        enrolled: sql<number>`(SELECT COUNT(*) FROM ${user} WHERE ${user.classSectionId} = ${classSections.id} AND ${user.role} = 'student')`,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(eq(classes.tenantId, tenantId));

    return rows.map(r => {
      const cap = r.capacity || 30;
      const enrolled = Number(r.enrolled);
      const rate = Math.round((enrolled / cap) * 100);
      return {
        className: r.className,
        sectionName: r.sectionName,
        enrolledCount: enrolled,
        capacity: cap,
        occupancyRate: rate,
      };
    });
  }

  /**
   * 4. Sibling & Household Distribution Report.
   */
  static async getSiblingReport(tenantId: string, params?: any) {
    const list = await db
      .select({
        guardianId: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        studentCount: count(guardianStudents.studentId),
      })
      .from(guardians)
      .innerJoin(guardianStudents, eq(guardians.id, guardianStudents.guardianId))
      .where(eq(guardians.tenantId, tenantId))
      .groupBy(guardians.id, guardians.firstName, guardians.lastName, guardians.phone);

    return list.map(g => ({
      householdId: `HH-${g.guardianId.substring(0, 8)}`,
      guardianName: `${g.firstName} ${g.lastName}`,
      guardianPhone: g.phone || 'N/A',
      studentCount: g.studentCount,
      studentNames: `${g.studentCount} enfant(s) inscrit(s)`,
    }));
  }
}
