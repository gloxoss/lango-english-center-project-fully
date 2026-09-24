'use client';

import type { AppRole } from '@/libs/api/context';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BedDouble,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  CalendarCheck,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ConciergeBell,
  Copy,
  CreditCard,
  DollarSign,
  FileSearch,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Headphones,
  HeartHandshake,
  IdCard,
  LayoutDashboard,
  ListTodo,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  Navigation,
  Package,
  Puzzle,
  QrCode,
  Receipt,
  School,
  ScrollText,
  Server,
  Settings,
  Settings2,
  ShieldCheck,
  Siren,
  Sparkles,
  TrendingDown,
  Truck,
  User,
  UserCheck,
  UserCog,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { authClient } from '@/libs/auth-client';
import { PortalRoleSwitcher } from './portal-role-switcher';

// Local, not imported from models/Schema.ts (server-only, would pull drizzle
// pg-core into the client bundle for no reason). Matches src/models/userMapping.ts.
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Administrateur École',
  teacher: 'Enseignant',
  accountant: 'Comptable',
  student: 'Élève',
  parent: 'Tuteur',
  receptionist: 'Réceptionniste',
  guard: 'Gardien',
  librarian: 'Bibliothécaire',
};

type SubMenuItem = {
  label: string;
  href: string;
  /** Capability key from src/libs/api/permissions.ts. Undefined = always visible. */
  permission?: string;
  /**
   * Roles this entry belongs to, when a capability cannot express it. A
   * school_admin holds every capability (ALL_PERMISSIONS), so a duty-station
   * page gated on e.g. guard.portal.use still appears for them - but the guard
   * kiosk reads the viewer's own active shift, which no admin has. Undefined =
   * visible to every role that passes `permission`.
   */
  roles?: string[];
  /** Addon ID from src/addons/registry.ts. If set, requires this addon to be active for the school. */
  addon?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Capability key from src/libs/api/permissions.ts. Undefined = always visible. */
  permission?: string;
  /** See SubMenuItem.roles. */
  roles?: string[];
  /** Addon ID from src/addons/registry.ts. If set, requires this addon to be active for the school. */
  addon?: string;
  subItems?: SubMenuItem[];
};

// Shape of the server-owned manifest nav items (src/libs/api/portal-manifest.ts).
type ManifestItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  addonId?: string;
  children?: ManifestItem[];
};

// Manifest icons arrive as strings; map them to lucide components. Unknown
// icons fall back to LayoutDashboard rather than breaking the sidebar.
const MANIFEST_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  School,
  Calendar,
  FileText,
  Clock,
  CalendarClock,
  Copy,
  UserCheck,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  Award,
  Wallet,
  Receipt,
  CreditCard,
  TrendingDown,
  HeartHandshake,
  MessageSquare,
  BarChart3,
  Briefcase,
  User,
  DollarSign,
  QrCode,
  LogOut,
  AlertTriangle,
  Siren,
  Settings2,
  Bus,
  MapPin,
  Navigation,
  Truck,
  Settings,
  Building2,
  GitBranch,
  UserCog,
  Puzzle,
  FileSearch,
  CalendarCheck2,
  ConciergeBell,
  ListTodo,
  LogIn,
  MessageSquareText,
};

function manifestToNav(item: ManifestItem, locale: string, tNav?: any): NavItem {
  let label = item.label;
  if (tNav) {
    try {
      if (tNav.has(item.id)) {
        label = tNav(item.id);
      }
    } catch {
      // fallback to original label
    }
  }
  return {
    label,
    href: `/${locale}${item.href}`,
    icon: MANIFEST_ICONS[item.icon] ?? LayoutDashboard,
    addon: item.addonId,
    subItems: item.children?.map(c => {
      let subLabel = c.label;
      if (tNav) {
        try {
          if (tNav.has(c.id)) {
            subLabel = tNav(c.id);
          }
        } catch {
          // fallback
        }
      }
      return { label: subLabel, href: `/${locale}${c.href}`, addon: c.addonId };
    }),
  };
}

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const tNav = useTranslations('Navigation');
  const tAuth = useTranslations('Auth');
  const tRoles = useTranslations('Roles');
  const tStudents = useTranslations('Students');
  const tTeachers = useTranslations('Teachers');
  const tAttendance = useTranslations('Attendance');
  const tGrading = useTranslations('Grading');
  const tFinance = useTranslations('Finance');
  const tSettings = useTranslations('Settings');
  const tReports = useTranslations('Reports');
  const tSuperAdmin = useTranslations('SuperAdmin');
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role || '';

  // Capability-driven nav visibility (GET /api/me/permissions) - replaces the
  // earlier accountant-only hardcoded href check, which only stripped
  // Academics/Settings and left every other module fully visible.
  // null = not loaded yet (render nothing gated, avoid a flash of items the
  // user doesn't have); super_admin/school_admin get every permission from
  // the API itself (hasCapability short-circuits true for super_admin, and
  // school_admin's DEFAULT_ROLE_PERMISSIONS is ALL_PERMISSIONS), so this is
  // a no-op filter for them.
  const [myPermissions, setMyPermissions] = useState<Set<string> | null>(null);
  const [activeAddons, setActiveAddons] = useState<Set<string> | null>(null);
  // Server-owned active-role context (GET /api/portal/me) and the manifest nav
  // (GET /api/portal/manifest). The server is the source of truth for the
  // effective role and available roles; the session cookie only supplies the
  // base role. Refetched on `portal:role-changed` so stale nav/permissions are
  // dropped after a role switch.
  const [portalMe, setPortalMe] = useState<{ role: string; availableRoles: string[]; tenantId?: string | null } | null>(null);
  const [manifestNav, setManifestNav] = useState<NavItem[] | null>(null);
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState<boolean | null>(null);
  const [hasActiveEmergency, setHasActiveEmergency] = useState(false);

  const loadPortalContext = async () => {
    try {
      const [meRes, manifestRes, eligRes, emergencyRes] = await Promise.all([
        fetch('/api/portal/me'),
        fetch('/api/portal/manifest'),
        fetch('/api/hr/me/self-service-eligibility'),
        fetch('/api/guard/emergency/procedures').catch(() => null),
      ]);
      const meJson = await meRes.json();
      if (meJson.success) {
        setPortalMe(meJson.data);
        setMyPermissions(new Set<string>(meJson.data.permissions ?? []));
        setActiveAddons(new Set<string>(meJson.data.activeAddons ?? []));
      }
      const manifestJson = await manifestRes.json();
      if (manifestJson.success && Array.isArray(manifestJson.data.navigation)) {
        setManifestNav(manifestJson.data.navigation.map((n: ManifestItem) => manifestToNav(n, locale, tNav)));
      }
      const eligJson = await eligRes.json().catch(() => ({}));
      setHasEmployeeProfile(Boolean(eligJson?.data?.eligible));

      if (emergencyRes && emergencyRes.ok) {
        const emergencyJson = await emergencyRes.json().catch(() => ({}));
        setHasActiveEmergency(Boolean(emergencyJson?.data?.emergency?.active));
      } else {
        setHasActiveEmergency(false);
      }
    } catch {
      setMyPermissions(new Set());
      setActiveAddons(new Set());
      setHasEmployeeProfile(false);
      setHasActiveEmergency(false);
    }
  };

  useEffect(() => {
    loadPortalContext();
    const onChange = () => loadPortalContext();
    window.addEventListener('portal:role-changed', onChange);
    return () => window.removeEventListener('portal:role-changed', onChange);
  }, [locale]);
  const canSee = (permission?: string) => !permission || (myPermissions !== null && myPermissions.has(permission));

  // Effective role comes from the server-owned active context; falls back to
  // the session base role until /api/portal/me resolves.
  const effectiveRole = portalMe?.role ?? userRole;
  const isSuperAdmin = effectiveRole === 'super_admin';
  const hasSelectedTenant = Boolean(portalMe?.tenantId);
  const roleLabel = (tRoles as any).has(effectiveRole) ? tRoles(effectiveRole) : (ROLE_LABELS[effectiveRole] ?? effectiveRole);

  const canSeeAddon = (addon?: string) => {
    if (!addon) return true;
    if (isSuperAdmin && !hasSelectedTenant) return true;
    if (activeAddons === null) return false;
    return activeAddons.has(addon);
  };

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'super-admin': true,
    'school-modules': true,
    'section-daily': true,
    'section-academics': true,
    'section-finance': true,
    'section-communication': true,
    'section-administration': true,
    'section-my-space': true,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Super Admin Navigation Items (Platform Oversight)
  const superAdminNavItems: NavItem[] = [
    {
      label: tNav('superAdminPlatform'),
      href: `/${locale}/dashboard/super-admin`,
      icon: LayoutDashboard,
    },
    {
      label: tNav('schoolModules'),
      href: `/${locale}/dashboard/super-admin/schools`,
      icon: Building2,
      subItems: [
        { label: tSuperAdmin('allSchools'), href: `/${locale}/dashboard/super-admin/schools` },
        { label: tSuperAdmin('createSchool'), href: `/${locale}/dashboard/super-admin/schools/create` },
      ],
    },
    {
      label: tSuperAdmin('waitlist'),
      href: `/${locale}/dashboard/super-admin/waitlist`,
      icon: ClipboardList,
    },
    {
      label: tSuperAdmin('subscriptions'),
      href: `/${locale}/dashboard/super-admin/subscriptions`,
      icon: Package,
      subItems: [
        { label: tSuperAdmin('plansAndModules'), href: `/${locale}/dashboard/super-admin/subscriptions` },
        { label: tSuperAdmin('manageSubscriptions'), href: `/${locale}/dashboard/super-admin/subscriptions/list` },
      ],
    },
    {
      label: tNav('communication'),
      href: `/${locale}/dashboard/super-admin/sms`,
      icon: MessageSquare,
    },
    {
      label: tSuperAdmin('support'),
      href: `/${locale}/dashboard/super-admin/support`,
      icon: Headphones,
    },
    {
      label: tNav('reports'),
      href: `/${locale}/dashboard/super-admin/reports`,
      icon: BarChart3,
    },
    {
      label: tSuperAdmin('domains'),
      href: `/${locale}/dashboard/super-admin/domains`,
      icon: Server,
    },
    {
      label: tNav('settings'),
      href: `/${locale}/dashboard/super-admin/settings`,
      icon: Server,
    },
  ];

  // School OS Standard Operational Navigation Items
  const schoolNavItems: NavItem[] = [
    { label: tNav('dashboard'), href: `/${locale}/dashboard`, icon: LayoutDashboard },
    // Director-level cross-module dashboard (academic averages, HR presence,
    // institutional risk register) - confirmed via a live accountant session
    // that reports.read let it through and leaked grade averages. No single
    // existing capability maps to "director portal" cleanly; reusing
    // settings.organization.manage as the closest already-admin-only proxy
    // rather than inventing a new one for a single page.
    { label: tNav('analytics'), href: `/${locale}/dashboard/analytics`, icon: BarChart3, permission: 'settings.organization.manage' },
    {
      label: tNav('students'),
      href: `/${locale}/dashboard/students`,
      icon: Users,
      permission: 'students.read',
      subItems: [
        { label: tStudents('directory'), href: `/${locale}/dashboard/students`, permission: 'students.read' },
        { label: tStudents('admissions'), href: `/${locale}/dashboard/students/admissions`, permission: 'admissions.view' },
        { label: tStudents('addStudent'), href: `/${locale}/dashboard/students/add`, permission: 'students.create' },
        { label: tNav('guardians'), href: `/${locale}/dashboard/students/parents`, permission: 'guardians.read' },
        { label: tNav('bulk-import'), href: `/${locale}/dashboard/students/import`, permission: 'students.import' },
        { label: tStudents('matricule'), href: `/${locale}/dashboard/students/matricules`, permission: 'students.read' },
        { label: tNav('photos'), href: `/${locale}/dashboard/students/photos`, permission: 'students.read' },
        { label: tNav('transfers'), href: `/${locale}/dashboard/students/transfers`, permission: 'students.update' },
        { label: tNav('promotions'), href: `/${locale}/dashboard/students/promotions`, permission: 'students.placements.manage' },
        { label: tNav('alumni'), href: `/${locale}/dashboard/students/alumni`, permission: 'admissions.manage' },
        { label: tNav('alumni-events'), href: `/${locale}/dashboard/students/alumni/events`, permission: 'admissions.manage' },
        { label: tNav('alumni-requests'), href: `/${locale}/dashboard/students/alumni/requests`, permission: 'admissions.manage' },
      ],
    },
    {
      label: tNav('classes'),
      href: `/${locale}/dashboard/academics/classes`,
      icon: GraduationCap,
      permission: 'academics.read',
      subItems: [
        { label: tNav('classes'), href: `/${locale}/dashboard/academics/classes`, permission: 'academics.read' },
        { label: tNav('mediums'), href: `/${locale}/dashboard/academics/mediums`, permission: 'academics.read' },
        { label: tNav('sections'), href: `/${locale}/dashboard/academics/sections`, permission: 'academics.read' },
        { label: tNav('subjects'), href: `/${locale}/dashboard/academics/subjects`, permission: 'academics.read' },
        { label: tNav('semesters'), href: `/${locale}/dashboard/academics/semesters`, permission: 'academics.read' },
        { label: tNav('streams'), href: `/${locale}/dashboard/academics/streams`, permission: 'academics.read' },
        { label: tNav('shifts'), href: `/${locale}/dashboard/academics/shifts`, permission: 'academics.read' },
        { label: tNav('optional-subjects'), href: `/${locale}/dashboard/academics/optional-subjects`, permission: 'academics.read' },
        { label: tNav('question-bank'), href: `/${locale}/dashboard/academics/question-bank`, permission: 'academics.read' },
        { label: tNav('schedule'), href: `/${locale}/dashboard/academics/schedule`, permission: 'academics.read' },
        { label: tNav('teacher-schedule'), href: `/${locale}/dashboard/academics/teacher-schedule`, permission: 'academics.read' },
        { label: tNav('conflicts'), href: `/${locale}/dashboard/academics/conflicts`, permission: 'academics.read' },
        { label: tNav('session-copy'), href: `/${locale}/dashboard/academics/session-copy`, permission: 'academics.manage' },
        { label: tNav('assignments'), href: `/${locale}/dashboard/academics/assignments`, permission: 'academics.read' },
        { label: tNav('promotions'), href: `/${locale}/dashboard/academics/promotions`, permission: 'academics.manage' },
        { label: tNav('readiness'), href: `/${locale}/dashboard/academics/readiness`, permission: 'academics.read' },
        { label: tNav('rooms'), href: `/${locale}/dashboard/academics/rooms`, permission: 'academics.manage' },
        { label: tNav('teacher-availability'), href: `/${locale}/dashboard/academics/teacher-availability`, permission: 'academics.read' },
        { label: tNav('syllabus'), href: `/${locale}/dashboard/academics/syllabus`, permission: 'academics.manage' },
        { label: tNav('calendar'), href: `/${locale}/dashboard/academics/calendar`, permission: 'academics.manage' },
      ],
    },

    {
      label: tNav('live-classes'),
      href: `/${locale}/dashboard/academics/live-class`,
      icon: Video,
      permission: 'live.read',
      addon: 'live-classrooms',
      subItems: [
        { label: tNav('live-virtual'), href: `/${locale}/dashboard/academics/live-class`, permission: 'live.read', addon: 'live-classrooms' },
        { label: tNav('live-reports'), href: `/${locale}/dashboard/academics/live-class-reports`, permission: 'live.reports.read', addon: 'live-classrooms' },
      ],
    },

    {
      label: tNav('teachers'),
      href: `/${locale}/dashboard/teachers/manage`,
      icon: UserCheck,
      permission: 'teachers.read',
      subItems: [
        { label: tTeachers('manage'), href: `/${locale}/dashboard/teachers/manage`, permission: 'teachers.read' },
        { label: tNav('bulk-import'), href: `/${locale}/dashboard/teachers/bulk-import`, permission: 'teachers.create' },
      ],
    },
    {
      label: tNav('attendance'),
      href: `/${locale}/dashboard/attendance`,
      icon: CalendarCheck,
      permission: 'attendance.read',
      subItems: [
        { label: tAttendance('markAttendance'), href: `/${locale}/dashboard/attendance`, permission: 'attendance.read' },
        { label: tNav('attendance-badges'), href: `/${locale}/dashboard/attendance/badges`, permission: 'attendance.read' },
        { label: tNav('attendance-qr-reports'), href: `/${locale}/dashboard/attendance/qr-reports`, permission: 'attendance.read' },
        { label: tAttendance('qrKiosk'), href: `/${locale}/dashboard/attendance/scanner`, permission: 'attendance.manage' },
        { label: tNav('attendance-timeclock'), href: `/${locale}/dashboard/workforce/timeclock`, permission: 'attendance.read', addon: 'payroll-workforce' },
        { label: tAttendance('excuseDocument'), href: `/${locale}/dashboard/attendance/excuses`, permission: 'attendance.read' },
        { label: tNav('attendance-flags'), href: `/${locale}/dashboard/attendance/flags`, permission: 'attendance.read' },
        { label: tNav('attendance-audit'), href: `/${locale}/dashboard/attendance/audit`, permission: 'attendance.read' },
      ],
    },
    {
      label: tNav('cards-title'),
      href: `/${locale}/dashboard/cards/templates`,
      icon: IdCard,
      permission: 'cards.templates.manage',
      addon: 'card-management',
      subItems: [
        { label: tNav('cards-overview'), href: `/${locale}/dashboard/cards`, permission: 'cards.issue', addon: 'card-management' },
        { label: tNav('cards-templates'), href: `/${locale}/dashboard/cards/templates`, permission: 'cards.templates.manage', addon: 'card-management' },
        { label: tNav('cards-students'), href: `/${locale}/dashboard/cards/students`, permission: 'cards.issue', addon: 'card-management' },
        { label: tNav('cards-employees'), href: `/${locale}/dashboard/cards/employees`, permission: 'cards.issue', addon: 'card-management' },
        { label: tNav('cards-admit'), href: `/${locale}/dashboard/cards/admit-cards`, permission: 'cards.issue', addon: 'card-management' },
        { label: tNav('cards-jobs'), href: `/${locale}/dashboard/cards/jobs`, permission: 'cards.issue', addon: 'card-management' },
        { label: tNav('cards-issued'), href: `/${locale}/dashboard/cards/issued`, permission: 'cards.issue', addon: 'card-management' },
      ],
    },
    {
      label: tNav('certificates-title'),
      href: `/${locale}/dashboard/certificates`,
      icon: ScrollText,
      permission: 'certificates.issue',
      addon: 'certificate-management',
      subItems: [
        { label: tNav('certificates-overview'), href: `/${locale}/dashboard/certificates`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-definitions'), href: `/${locale}/dashboard/certificates/definitions`, permission: 'certificates.templates.manage', addon: 'certificate-management' },
        { label: tNav('certificates-templates'), href: `/${locale}/dashboard/certificates/templates`, permission: 'certificates.templates.manage', addon: 'certificate-management' },
        { label: tNav('certificates-issue-students'), href: `/${locale}/dashboard/certificates/issue/students`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-issue-employees'), href: `/${locale}/dashboard/certificates/issue/employees`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-requests'), href: `/${locale}/dashboard/certificates/requests`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-issued'), href: `/${locale}/dashboard/certificates/issued`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-jobs'), href: `/${locale}/dashboard/certificates/jobs`, permission: 'certificates.issue', addon: 'certificate-management' },
        { label: tNav('certificates-settings'), href: `/${locale}/dashboard/certificates/settings`, permission: 'certificates.templates.manage', addon: 'certificate-management' },
      ],
    },
    {
      label: tNav('grading'),
      href: `/${locale}/dashboard/academics/assessment/homework`,
      icon: Award,
      permission: 'academics.read',
      subItems: [
        { label: 'Devoirs & Évaluations', href: `/${locale}/dashboard/academics/assessment/homework`, permission: 'academics.read' },
        { label: 'Exam Master & Salles', href: `/${locale}/dashboard/academics/assessment/exam-master`, permission: 'academics.read' },
        { label: 'Examens en Ligne (Add-on)', href: `/${locale}/dashboard/academics/assessment/online-exams`, permission: 'academics.read', addon: 'online-examinations' },
        // The grade-entry path had no nav entry at all: a teacher could not reach
        // the screen they enter marks on.
        { label: tGrading('entry'), href: `/${locale}/dashboard/academics/grades/entry`, permission: 'grading.manage' },
        { label: 'Résultats par Classe', href: `/${locale}/dashboard/academics/results`, permission: 'grading.read' },
        { label: 'Barèmes & Mentions', href: `/${locale}/dashboard/academics/grading/policies`, permission: 'grading.manage' },
        { label: 'Planification des Épreuves', href: `/${locale}/dashboard/academics/evaluations`, permission: 'academics.manage' },
        { label: 'Épreuves & Calendrier', href: `/${locale}/dashboard/academics/exams`, permission: 'academics.manage' },
      ],
    },

    {
      label: tNav('events-title'),
      href: `/${locale}/dashboard/events`,
      icon: CalendarDays,
      permission: 'events.read',
      addon: 'event-management',
      subItems: [
        { label: tNav('events-calendar'), href: `/${locale}/dashboard/events`, permission: 'events.read', addon: 'event-management' },
      ],
    },

    {
      label: tNav('content-title'),
      href: `/${locale}/dashboard/content/library`,
      icon: FolderOpen,
      permission: 'academics.read',
      addon: 'attachments-book',
      subItems: [
        { label: tNav('content-library'), href: `/${locale}/dashboard/content/library`, permission: 'academics.read', addon: 'attachments-book' },
        { label: tNav('content-types'), href: `/${locale}/dashboard/content/types`, permission: 'content.types.manage', addon: 'attachments-book' },
      ],
    },

    {
      label: tNav('library'),
      href: `/${locale}/dashboard/portals/librarian`,
      icon: BookOpen,
      permission: 'library.catalog.read',
      addon: 'library',
      subItems: [
        { label: tNav('library-home'), href: `/${locale}/dashboard/portals/librarian`, permission: 'library.report.read', addon: 'library' },
        // "Comptoir de prêt" (the operational checkout counter) is a librarian
        // self-service action, not an admin oversight surface — deliberately
        // absent here so school_admin/super_admin don't get the raw circulation
        // desk in their everyday nav (PRODUCT-REVIEW §12.5). Librarians still
        // see it via the portal manifest.
        { label: tNav('library-catalog'), href: `/${locale}/dashboard/library/catalog`, permission: 'library.catalog.read', addon: 'library' },
      ],
    },

    {
      label: tNav('finance'),
      href: `/${locale}/dashboard/finance`,
      icon: CreditCard,
      permission: 'finance.read',
      subItems: [
        { label: tNav('finance'), href: `/${locale}/dashboard/finance`, permission: 'finance.read' },
        { label: tFinance('cashierDesk'), href: `/${locale}/dashboard/finance/collection-desk`, permission: 'finance.read' },
        { label: tNav('receivables'), href: `/${locale}/dashboard/finance/receivables`, permission: 'finance.read' },
        { label: tNav('reminders'), href: `/${locale}/dashboard/finance/reminders`, permission: 'finance.manage' },
        { label: tNav('invoices'), href: `/${locale}/dashboard/finance/invoices`, permission: 'finance.read' },
        { label: tFinance('receipt'), href: `/${locale}/dashboard/finance/receipts`, permission: 'finance.read' },
        { label: tNav('student-statements'), href: `/${locale}/dashboard/finance/statements`, permission: 'finance.read' },
        { label: tNav('cashier-sessions'), href: `/${locale}/dashboard/finance/cashier-sessions`, permission: 'finance.manage' },
        { label: tFinance('recordPayment'), href: `/${locale}/dashboard/finance/payments/new`, permission: 'finance.read' },
        { label: tNav('office-accounting'), href: `/${locale}/dashboard/finance/office-accounting`, permission: 'accounting.account.read' },
        { label: tNav('accounting-accounts'), href: `/${locale}/dashboard/finance/accounting/accounts`, permission: 'accounting.account.read' },
        { label: tNav('accounting-transactions'), href: `/${locale}/dashboard/finance/accounting/transactions`, permission: 'accounting.account.read' },
        { label: tNav('accounting-voucher-types'), href: `/${locale}/dashboard/finance/accounting/voucher-types`, permission: 'accounting.account.manage' },
        { label: tNav('accounting-deposit'), href: `/${locale}/dashboard/finance/accounting/deposits/new`, permission: 'accounting.deposit.create' },
        { label: tNav('accounting-expense'), href: `/${locale}/dashboard/finance/expenses/new`, permission: 'accounting.expense.prepare' },
        { label: tNav('accounting-expense-workflow'), href: `/${locale}/dashboard/finance/accounting/expenses`, permission: 'accounting.account.read' },
        { label: tNav('student-accounting'), href: `/${locale}/dashboard/finance/accounting/student-accounting`, permission: 'accounting.account.read' },
        { label: tNav('financial-statements'), href: `/${locale}/dashboard/finance/accounting/statements`, permission: 'accounting.statement.read' },
        { label: tNav('accounting-periods'), href: `/${locale}/dashboard/finance/accounting/periods`, permission: 'accounting.statement.read' },
        { label: tNav('fee-structures'), href: `/${locale}/dashboard/finance/fee-structures`, permission: 'finance.read' },
        { label: tNav('fee-types'), href: `/${locale}/dashboard/finance/fee-types`, permission: 'finance.read' },
        { label: tNav('fine-policies'), href: `/${locale}/dashboard/finance/fine-policies`, permission: 'finance.read' },
        { label: tNav('fee-assignments'), href: `/${locale}/dashboard/finance/fee-assignments`, permission: 'finance.read' },
        { label: tNav('fee-allocation'), href: `/${locale}/dashboard/finance/allocation`, permission: 'finance.read' },
        { label: tNav('fee-allocations'), href: `/${locale}/dashboard/finance/allocations`, permission: 'finance.read' },
        { label: tNav('credit-notes'), href: `/${locale}/dashboard/finance/credit-notes`, permission: 'finance.read' },
        { label: tNav('refunds'), href: `/${locale}/dashboard/finance/refunds`, permission: 'finance.read' },
        { label: tNav('finance-approvals'), href: `/${locale}/dashboard/finance/approvals`, permission: 'finance.read' },
        { label: tNav('finance-reports'), href: `/${locale}/dashboard/finance/reports`, permission: 'finance.read' },
      ],
    },
    {
      label: tNav('inventory-title'),
      href: `/${locale}/dashboard/inventory`,
      icon: Package,
      permission: 'inventory.read',
      addon: 'inventory',
      subItems: [
        { label: tNav('inventory-overview'), href: `/${locale}/dashboard/inventory/overview`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-products'), href: `/${locale}/dashboard/inventory/products`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-categories'), href: `/${locale}/dashboard/inventory/categories`, permission: 'inventory.catalog.manage', addon: 'inventory' },
        { label: tNav('inventory-units'), href: `/${locale}/dashboard/inventory/units`, permission: 'inventory.catalog.manage', addon: 'inventory' },
        { label: tNav('inventory-stores'), href: `/${locale}/dashboard/inventory/stores`, permission: 'inventory.catalog.manage', addon: 'inventory' },
        { label: tNav('inventory-suppliers'), href: `/${locale}/dashboard/inventory/suppliers`, permission: 'inventory.catalog.manage', addon: 'inventory' },
        { label: tNav('inventory-purchases'), href: `/${locale}/dashboard/inventory/purchases`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-sales'), href: `/${locale}/dashboard/inventory/sales`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-issues'), href: `/${locale}/dashboard/inventory/issues`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-adjustments'), href: `/${locale}/dashboard/inventory/adjustments`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-transfers'), href: `/${locale}/dashboard/inventory/transfers`, permission: 'inventory.read', addon: 'inventory' },
        { label: tNav('inventory-stock'), href: `/${locale}/dashboard/inventory/stock`, permission: 'inventory.read', addon: 'inventory' },
      ],
    },
    {
      label: tNav('communication'),
      href: `/${locale}/dashboard/communication/reminders`,
      icon: MessageSquare,
      permission: 'communication.read',
      subItems: [
        { label: tNav('reminders'), href: `/${locale}/dashboard/communication/reminders`, permission: 'communication.send' },
        { label: tNav('communication-templates'), href: `/${locale}/dashboard/communication/templates`, permission: 'communication.read' },
      ],
    },
    {
      label: tNav('broadcast-title'),
      href: `/${locale}/dashboard/broadcast`,
      icon: Megaphone,
      permission: 'broadcast.read',
      subItems: [
        { label: tNav('broadcast-crm'), href: `/${locale}/dashboard/communication/crm`, permission: 'crm.manage', addon: 'lead-crm' },
        { label: tNav('broadcast-overview'), href: `/${locale}/dashboard/broadcast`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-connections'), href: `/${locale}/dashboard/broadcast/connections`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-segments'), href: `/${locale}/dashboard/broadcast/segments`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-templates'), href: `/${locale}/dashboard/broadcast/templates`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-campaigns'), href: `/${locale}/dashboard/broadcast/campaigns`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-reports'), href: `/${locale}/dashboard/broadcast/reports`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
        { label: tNav('broadcast-automations'), href: `/${locale}/dashboard/broadcast/automations`, permission: 'broadcast.read', addon: 'broadcast-messaging' },
      ],
    },
    { label: tGrading('reportCards'), href: `/${locale}/dashboard/documents/generator`, icon: FileText, permission: 'grading.read' },
    {
      label: tNav('hr'),
      href: `/${locale}/dashboard/hr`,
      icon: Users,
      permission: 'hr.employee.read',
      addon: 'human-resources',
      subItems: [
        { label: tNav('hr-dashboard'), href: `/${locale}/dashboard/hr/overview`, permission: 'hr.employee.read', addon: 'human-resources' },
        { label: tNav('hr-employees'), href: `/${locale}/dashboard/hr/employees`, permission: 'hr.employee.read', addon: 'human-resources' },
        { label: tNav('hr-new-employee'), href: `/${locale}/dashboard/hr/employees/new`, permission: 'hr.employee.manage', addon: 'human-resources' },
        { label: tNav('hr-departments'), href: `/${locale}/dashboard/hr/departments`, permission: 'hr.organization.manage', addon: 'human-resources' },
        { label: tNav('hr-designations'), href: `/${locale}/dashboard/hr/designations`, permission: 'hr.organization.manage', addon: 'human-resources' },
        { label: tNav('hr-access'), href: `/${locale}/dashboard/hr/access`, permission: 'hr.access.manage', addon: 'human-resources' },
      ],
    },
    {
      label: tNav('workforce-title'),
      href: `/${locale}/dashboard/workforce`,
      icon: Briefcase,
      permission: 'payroll.review',
      addon: 'payroll-workforce',
      subItems: [
        { label: tNav('workforce-overview'), href: `/${locale}/dashboard/workforce`, permission: 'payroll.review', addon: 'payroll-workforce' },
        { label: tNav('hr-payroll'), href: `/${locale}/dashboard/workforce/payroll/runs`, permission: 'payroll.review', addon: 'payroll-workforce' },
        { label: tNav('workforce-components'), href: `/${locale}/dashboard/workforce/payroll/components`, permission: 'payroll.configure', addon: 'payroll-workforce' },
        { label: tNav('workforce-structures'), href: `/${locale}/dashboard/workforce/payroll/structures`, permission: 'payroll.configure', addon: 'payroll-workforce' },
        { label: tNav('workforce-assignments'), href: `/${locale}/dashboard/workforce/payroll/assignments`, permission: 'payroll.configure', addon: 'payroll-workforce' },
        { label: tNav('workforce-adjustments'), href: `/${locale}/dashboard/workforce/payroll/adjustments`, permission: 'payroll.review', addon: 'payroll-workforce' },
        { label: tNav('workforce-payments'), href: `/${locale}/dashboard/workforce/payroll/payments`, permission: 'payroll.payment.prepare', addon: 'payroll-workforce' },
        { label: tNav('hr-leave'), href: `/${locale}/dashboard/workforce/leave`, permission: 'payroll.leave.manage', addon: 'payroll-workforce' },
        { label: tNav('workforce-advances'), href: `/${locale}/dashboard/workforce/advances`, permission: 'payroll.advances.manage', addon: 'payroll-workforce' },
        { label: tNav('workforce-awards'), href: `/${locale}/dashboard/workforce/awards`, permission: 'payroll.awards.manage', addon: 'payroll-workforce' },
      ],
    },
    ...(hasEmployeeProfile ? [{ label: tNav('hr-self-service'), href: `/${locale}/dashboard/hr/self-service`, icon: UserCheck, addon: 'human-resources' }] : []),
    {
      label: tNav('guard'),
      href: `/${locale}/dashboard/portals/guard`,
      icon: ShieldCheck,
      permission: 'guard.portal.use',
      subItems: [
        // The four duty-station pages are the guard's own post: each one reads
        // the viewer's active shift/gate assignment and returns 403
        // NO_ACTIVE_SHIFT / NO_ACTIVE_GATE without one. Roles are listed
        // explicitly because school_admin holds guard.portal.use and
        // guard.visitors.manage (ALL_PERMISSIONS) but can never be on shift, so
        // the capability test alone would keep serving them a dead kiosk.
        // Incidents, Urgence and Configuration stay capability-gated: they are
        // meaningful to an admin and do load for one.
        { label: tNav('guard-home'), href: `/${locale}/dashboard/portals/guard`, permission: 'guard.portal.use', roles: ['guard'] },
        { label: tNav('guard-scanner'), href: `/${locale}/dashboard/portals/guard/scanner`, permission: 'guard.portal.use', roles: ['guard'] },
        { label: tNav('guard-visitors'), href: `/${locale}/dashboard/portals/guard/visitors`, permission: 'guard.visitors.manage', roles: ['guard'] },
        { label: tNav('guard-pickups'), href: `/${locale}/dashboard/portals/guard/pickups`, permission: 'guard.pickup.release', roles: ['guard'] },
        { label: tNav('guard-incidents'), href: `/${locale}/dashboard/portals/guard/incidents`, permission: 'guard.incidents.manage' },
        { label: tNav('guard-emergency'), href: `/${locale}/dashboard/portals/guard/emergency`, permission: 'guard.portal.use' },
        { label: tNav('guard-config'), href: `/${locale}/dashboard/portals/guard/config`, permission: 'guard.gates.manage' },
      ],
    },
    {
      label: tNav('hostel-title'),
      href: `/${locale}/dashboard/hostel`,
      icon: BedDouble,
      permission: 'hostel.read',
      addon: 'hostel',
      subItems: [
        { label: tNav('hostel-tonight'), href: `/${locale}/dashboard/hostel`, permission: 'hostel.read', addon: 'hostel' },
        { label: tNav('hostel-residences'), href: `/${locale}/dashboard/hostel/hostels`, permission: 'hostel.read', addon: 'hostel' },
        { label: tNav('hostel-zones'), href: `/${locale}/dashboard/hostel/zones`, permission: 'hostel.read', addon: 'hostel' },
        { label: tNav('hostel-categories'), href: `/${locale}/dashboard/hostel/categories`, permission: 'hostel.read', addon: 'hostel' },
        { label: tNav('hostel-rooms'), href: `/${locale}/dashboard/hostel/rooms`, permission: 'hostel.read', addon: 'hostel' },
        { label: tNav('hostel-occupancy'), href: `/${locale}/dashboard/hostel/board`, permission: 'hostel.allocation.read', addon: 'hostel' },
        { label: tNav('hostel-applications'), href: `/${locale}/dashboard/hostel/applications`, permission: 'hostel.allocation.read', addon: 'hostel' },
        { label: tNav('hostel-allocations'), href: `/${locale}/dashboard/hostel/allocations`, permission: 'hostel.allocation.manage', addon: 'hostel' },
        { label: tNav('hostel-rollcall'), href: `/${locale}/dashboard/hostel/roll-call`, permission: 'hostel.supervision.read', addon: 'hostel' },
        { label: tNav('hostel-leavepasses'), href: `/${locale}/dashboard/hostel/leave-passes`, permission: 'hostel.supervision.manage', addon: 'hostel' },
        { label: tNav('hostel-policies'), href: `/${locale}/dashboard/hostel/policies`, permission: 'hostel.policies.manage', addon: 'hostel' },
        { label: tNav('hostel-reports'), href: `/${locale}/dashboard/hostel/reports`, permission: 'hostel.read', addon: 'hostel' },
      ],
    },
    {
      label: tNav('transport'),
      href: `/${locale}/dashboard/transport`,
      icon: Bus,
      permission: 'transport.read',
      addon: 'transport',
      subItems: [
        { label: tNav('transport-dashboard'), href: `/${locale}/dashboard/transport`, permission: 'transport.read', addon: 'transport' },
        { label: tNav('transport-routes'), href: `/${locale}/dashboard/transport/routes`, permission: 'transport.route.manage', addon: 'transport' },
        { label: tNav('transport-stops'), href: `/${locale}/dashboard/transport/stops`, permission: 'transport.route.manage', addon: 'transport' },
        { label: tNav('transport-vehicles'), href: `/${locale}/dashboard/transport/vehicles`, permission: 'transport.vehicle.manage', addon: 'transport' },
        { label: tNav('transport-drivers'), href: `/${locale}/dashboard/transport/drivers`, permission: 'transport.driver.manage', addon: 'transport' },
        { label: tNav('transport-allocations'), href: `/${locale}/dashboard/transport/allocations`, permission: 'transport.assignment.read', addon: 'transport' },
        { label: tNav('transport-trips'), href: `/${locale}/dashboard/transport/trips`, permission: 'transport.trip.read', addon: 'transport' },
        { label: tNav('transport-boarding'), href: `/${locale}/dashboard/transport/boarding`, permission: 'transport.boarding.manage', addon: 'transport' },
        { label: tNav('transport-incidents'), href: `/${locale}/dashboard/transport/incidents`, permission: 'transport.incident.read', addon: 'transport' },
        { label: tNav('transport-reports'), href: `/${locale}/dashboard/transport/reports`, permission: 'transport.report', addon: 'transport' },
        { label: tNav('transport-policies'), href: `/${locale}/dashboard/transport/policies`, permission: 'transport.policy.manage', addon: 'transport' },
      ],
    },
    {
      label: tNav('reports'),
      href: `/${locale}/dashboard/reports`,
      icon: BarChart3,
      permission: 'reports.read',
      addon: 'advanced-reporting',
      subItems: [
        { label: tReports('reportCenter'), href: `/${locale}/dashboard/reports`, permission: 'reports.read', addon: 'advanced-reporting' },
        { label: tReports('myRuns'), href: `/${locale}/dashboard/reports/runs`, permission: 'reports.read', addon: 'advanced-reporting' },
        { label: tReports('schedules'), href: `/${locale}/dashboard/reports/schedules`, permission: 'reports.schedule', addon: 'advanced-reporting' },
        { label: tReports('adminConsole'), href: `/${locale}/dashboard/reports/admin`, permission: 'reports.manage', addon: 'advanced-reporting' },
      ],
    },
    {
      label: tNav('settings'),
      href: `/${locale}/dashboard/settings`,
      icon: Settings,
      permission: 'settings.read',
      subItems: [
        { label: tNav('settings-general'), href: `/${locale}/dashboard/settings`, permission: 'settings.organization.manage' },
        { label: 'Migration & Démarrage', href: `/${locale}/dashboard/settings/migration`, permission: 'settings.read' },
        { label: 'Politiques Académiques', href: `/${locale}/dashboard/settings/policies`, permission: 'settings.read' },
        { label: tNav('settings-users'), href: `/${locale}/dashboard/settings/users`, permission: 'users.manage' },
        { label: 'Sécurité & Sessions', href: `/${locale}/dashboard/settings/security`, permission: 'settings.security.manage' },
        { label: 'Journal de connexion', href: `/${locale}/dashboard/settings/security/login-events`, permission: 'settings.security.manage' },
        { label: 'Dispositifs de Scan', href: `/${locale}/dashboard/settings/scanner-devices`, permission: 'settings.attendance.manage' },
        { label: 'Connexions Externes', href: `/${locale}/dashboard/settings/providers`, permission: 'settings.read' },
        { label: 'Classes en Direct — Fournisseurs', href: `/${locale}/dashboard/settings/live-classrooms`, permission: 'live.providers.manage', addon: 'live-classrooms' },
        { label: 'Liaisons Comptables', href: `/${locale}/dashboard/settings/accounting-defaults`, permission: 'finance.manage' },
        { label: tNav('payment-methods'), href: `/${locale}/dashboard/settings/payment-methods`, permission: 'finance.manage' },
        { label: 'Traductions & Champs', href: `/${locale}/dashboard/settings/translations`, permission: 'settings.localization.manage' },
        { label: tNav('settings-audit'), href: `/${locale}/dashboard/settings/jobs`, permission: 'audit.read' },
        { label: 'Abonnement & Licence', href: `/${locale}/dashboard/settings/subscription`, permission: 'settings.read' },
        { label: tNav('settings-addons'), href: `/${locale}/dashboard/settings/entitlements`, permission: 'settings.read' },
        { label: 'Registre des paramètres', href: `/${locale}/dashboard/settings/values`, permission: 'settings.read' },
        { label: 'Approbation des paramètres', href: `/${locale}/dashboard/settings/drafts`, permission: 'settings.read' },
        { label: 'Séries de numérotation', href: `/${locale}/dashboard/settings/numbering`, permission: 'settings.read' },
        { label: 'Champs personnalisés', href: `/${locale}/dashboard/settings/custom-fields`, permission: 'settings.read' },
        { label: 'Tâches automatisées', href: `/${locale}/dashboard/settings/scheduled-jobs`, permission: 'settings.read' },
        { label: tNav('settings-permissions'), href: `/${locale}/dashboard/settings/permissions`, permission: 'users.permissions.manage' },
        { label: 'Boîte notifications', href: `/${locale}/dashboard/settings/notifications`, permission: 'settings.read' },
        { label: 'Exports & téléchargements', href: `/${locale}/dashboard/settings/exports`, permission: 'settings.read' },
        { label: tNav('settings-branches'), href: `/${locale}/dashboard/settings/branches`, permission: 'settings.organization.manage', addon: 'multi-branch' },
        { label: 'Domaine Personnalisé', href: `/${locale}/dashboard/settings/domain`, permission: 'settings.organization.manage' },
        { label: 'Site Web — Thème & Identité', href: `/${locale}/dashboard/settings/website`, permission: 'website.read', addon: 'school-website-cms' },
        { label: 'Site Web — Pages', href: `/${locale}/dashboard/settings/website/pages`, permission: 'website.pages.manage', addon: 'school-website-cms' },
        { label: 'Site Web — Menu', href: `/${locale}/dashboard/settings/website/menu`, permission: 'website.menu.manage', addon: 'school-website-cms' },
        { label: 'Site Web — Actualités', href: `/${locale}/dashboard/settings/website/news`, permission: 'website.news.manage', addon: 'school-website-cms' },
        { label: 'Réinitialisation Accès', href: `/${locale}/dashboard/settings/access-reset`, permission: 'users.manage' },
        { label: tNav('cndp'), href: `/${locale}/dashboard/settings/cndp`, permission: 'settings.read' },
      ],
    },
    { label: tNav('cndp'), href: `/${locale}/dashboard/settings/cndp`, icon: ShieldCheck, permission: 'settings.read' },
    { label: 'Assistance & Support', href: `/${locale}/dashboard/support`, icon: Headphones, permission: 'settings.read' },
  ];

  // Capability-driven: an item is visible if its own permission is granted,
  // AND (for parents with subItems) at least one child is visible too -
  // otherwise a parent like "Élèves & Profils" would show as a dead link
  // wrapping zero visible sub-pages once granular per-subitem gating narrows
  // it down further than the parent's own permission alone would.
  const canSeeRole = (roles?: string[]) => !roles || roles.includes(effectiveRole);

  const visibleSchoolNavItems = schoolNavItems
    .filter(item => canSee(item.permission) && canSeeRole(item.roles) && canSeeAddon(item.addon))
    .map((item) => {
      const subItems = item.subItems
        ? item.subItems.filter(sub => canSee(sub.permission) && canSeeRole(sub.roles) && canSeeAddon(sub.addon))
        : undefined;

      // The group label is a Link to item.href. When that landing page is one
      // of the group's own (now hidden) children, following it would dead-end
      // the user on a page their role cannot open, so send them to the first
      // child they can reach instead. Guard: "Sécurité & Gardiens" links to
      // the kiosk home, which is guard-only, but an admin still uses the
      // group for Incidents/Urgence/Configuration.
      const ownLandingHidden = Boolean(item.subItems?.some(
        sub => sub.href === item.href && (!canSee(sub.permission) || !canSeeRole(sub.roles) || !canSeeAddon(sub.addon)),
      ));
      const href = ownLandingHidden ? (subItems?.[0]?.href ?? item.href) : item.href;

      return { ...item, href, subItems };
    })
    .filter(item => item.subItems === undefined || item.subItems.length > 0);

  // Self-service links for student/parent roles. These roles never hold the
  // staff-side keys (hostel.read, live.read), and canSee() treats an undefined
  // permission as "always visible", so gating by role here (not by capability)
  // keeps them out of the staff nav for admin roles.
  const parentPortalNav: NavItem[] = [
    {
      label: (tRoles as any).has('parent') ? tRoles('parent') : 'Espace Parent',
      href: `/${locale}/dashboard/parent`,
      icon: LayoutDashboard,
      subItems: [
        // Family wording, not the staff menu labels (audit S-45).
        { label: tNav('parentHome'), href: `/${locale}/dashboard/parent` },
        { label: tNav('parentAttendance'), href: `/${locale}/dashboard/parent/attendance` },
        { label: tNav('parentFinance'), href: `/${locale}/dashboard/parent/finance` },
        { label: tNav('parentMessages'), href: `/${locale}/dashboard/parent/communication` },
        { label: tNav('parentRequests'), href: `/${locale}/dashboard/parent/requests` },
        { label: tNav('parentSettings'), href: `/${locale}/dashboard/parent/settings` },
      ],
    },
  ];

  // Self-service portal for teachers. Teachers hold staff-side capability keys
  // too, but this is the always-present entry point to their own workspace.
  const teacherPortalNav: NavItem[] = [
    {
      label: (tRoles as any).has('teacher') ? tRoles('teacher') : 'Espace Enseignant',
      href: `/${locale}/dashboard/teacher`,
      icon: GraduationCap,
      subItems: [
        { label: tNav('dashboard'), href: `/${locale}/dashboard/teacher` },
      ],
    },
  ];

  // Self-service portal for students.
  const studentPortalNav: NavItem[] = [
    {
      label: (tRoles as any).has('student') ? tRoles('student') : 'Espace Élève',
      href: `/${locale}/dashboard/student`,
      icon: School,
      subItems: [
        { label: tNav('dashboard'), href: `/${locale}/dashboard/student` },
      ],
    },
  ];

  const selfServiceNavItems: NavItem[]
    = userRole === 'student' || userRole === 'parent' || userRole === 'teacher'
      ? [
          ...(userRole === 'parent' ? parentPortalNav : []),
          ...(userRole === 'teacher' ? teacherPortalNav : []),
          ...(userRole === 'student' ? studentPortalNav : []),
          // These two links point at self-scoped student/parent pages
          // (hostel/me, hostel/guardian, student|parent/live-classes) - a
          // teacher has neither, so they're only relevant for those two roles.
          ...(userRole === 'student' || userRole === 'parent'
            ? [
                {
                  label: userRole === 'student' ? 'Mon Internat' : 'Internat de mon enfant',
                  href: userRole === 'student'
                    ? `/${locale}/dashboard/hostel/me`
                    : `/${locale}/dashboard/hostel/guardian`,
                  icon: BedDouble,
                  addon: 'hostel',
                },
                {
                  label: userRole === 'student' ? 'Mes classes en direct' : 'Classes en direct de mon enfant',
                  href: userRole === 'student'
                    ? `/${locale}/dashboard/student/live-classes`
                    : `/${locale}/dashboard/parent/live-classes`,
                  icon: Video,
                  addon: 'live-classrooms',
                },
              ]
            : []),
        ].filter(item => canSeeAddon(item.addon))
      : [];

  // Nav selection: admin roles keep the existing capability-filtered school
  // nav; staff-ish roles (teacher, accountant, receptionist, guard,
  // librarian) render the server-owned manifest nav (already capability- and
  // addon-filtered by /api/portal/manifest), plus any self-service links.
  // student/parent are excluded from the manifest nav entirely: several of
  // their granted permissions (students.read, attendance.read, grading.read,
  // finance.read, communication.read...) exist so they can read their OWN/
  // their child's data through otherwise-staff API routes, not to open the
  // staff-wide admin module for that domain - showing "Élèves"/"Finances"/
  // "Communication" etc. to a parent would open the school-wide staff view,
  // not their child's data (that already lives in Espace Parent/Espace
  // Élève, via selfServiceNavItems). Until the manifest loads, staff roles
  // render nothing (no flash of items the server will filter out).
  const isAdminRole = effectiveRole === 'super_admin' || effectiveRole === 'school_admin';
  const isSelfServiceOnlyRole = effectiveRole === 'student' || effectiveRole === 'parent';
  const navItems = isAdminRole
    ? [...visibleSchoolNavItems, ...selfServiceNavItems]
    : isSelfServiceOnlyRole
      ? selfServiceNavItems
      : [...(manifestNav ?? []), ...selfServiceNavItems];

  const activeMenuLabel = navItems.find(item =>
    pathname === item.href
    || item.subItems?.some(sub =>
      pathname === sub.href || pathname.startsWith(`${sub.href}/`),
    ),
  )?.label;

  const getCategoryForNavItem = (item: NavItem): 'daily' | 'academics' | 'finance' | 'communication' | 'administration' => {
    const h = item.href.toLowerCase();
    if (
      h.endsWith('/dashboard')
      || h.includes('/dashboard/attendance')
      || h.includes('/schedule')
      || h.includes('/timetable')
      || h.includes('/events')
      || h.includes('/calendar')
    ) {
      return 'daily';
    }
    if (
      h.includes('/students')
      || h.includes('/admissions')
      || h.includes('/academics')
      || h.includes('/teachers')
      || h.includes('/grading')
      || h.includes('/cards')
      || h.includes('/certificates')
      || h.includes('/live-class')
    ) {
      return 'academics';
    }
    if (
      h.includes('/finance')
      || h.includes('/invoices')
      || h.includes('/payments')
      || h.includes('/expenses')
      || h.includes('/accounting')
      || h.includes('/fee')
      || h.includes('/reports')
    ) {
      return 'finance';
    }
    if (
      h.includes('/communication')
      || h.includes('/broadcast')
      || h.includes('/crm')
      || h.includes('/parents')
      || h.includes('/messages')
    ) {
      return 'communication';
    }
    return 'administration';
  };

  // Families get one self-service section instead of staff headings such as
  // 'ADMINISTRATION' over their own pages (audit S-45).
  const isFamilyRole = userRole === 'parent' || userRole === 'student';
  const conceptualSections: { id: string; label: string; items: NavItem[] }[] = isFamilyRole
    ? [{ id: 'section-my-space', label: tNav('sectionMySpace'), items: navItems }]
    : [
    { id: 'section-daily', label: tNav('sectionDaily'), items: navItems.filter(i => getCategoryForNavItem(i) === 'daily') },
    { id: 'section-academics', label: tNav('sectionAcademics'), items: navItems.filter(i => getCategoryForNavItem(i) === 'academics') },
    { id: 'section-finance', label: tNav('sectionFinance'), items: navItems.filter(i => getCategoryForNavItem(i) === 'finance') },
    { id: 'section-communication', label: tNav('sectionCommunication'), items: navItems.filter(i => getCategoryForNavItem(i) === 'communication') },
    { id: 'section-administration', label: tNav('sectionAdministration'), items: navItems.filter(i => getCategoryForNavItem(i) === 'administration') },
  ];

  return (
    <aside className="
      sticky top-0 flex h-dvh max-h-dvh w-64 shrink-0 flex-col overflow-hidden
      border-r border-slate-200 bg-[#16212B] text-white
    "
    >
      {/* Brand Header */}
      <div className="
        flex shrink-0 items-center justify-between border-b border-slate-800 p-5
      "
      >
        <div className="flex items-center gap-3">
          <div className="
            flex size-9 items-center justify-center rounded-xl bg-[#0066FF]
            text-base font-extrabold text-white shadow-sm
          "
          >
            S
          </div>
          <div>
            <h1 className="
              flex items-center text-base font-extrabold tracking-tight
              text-white
            "
            >
              School
              <span className="text-[#0066FF]">OS</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-400">{tNav('platformTagline')}</p>
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-sidebar-scroll
      >
        {(!isSuperAdmin || hasSelectedTenant) && canSee('guard.portal.use') && (
          <div className="border-b border-slate-800 p-3">
            <Link
              href={`/${locale}/dashboard/portals/guard/emergency`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs transition-all ${
                hasActiveEmergency
                  ? 'border border-[#E5544B]/50 bg-[#E5544B]/15 font-extrabold text-white shadow-xs hover:bg-[#E5544B]/25'
                  : 'font-semibold text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-lg ${
                  hasActiveEmergency
                    ? 'bg-[#E5544B] text-white shadow-2xs'
                    : 'text-slate-400'
                }`}
              >
                <Siren className="size-4" />
              </span>
              <span>{hasActiveEmergency ? 'Urgence active' : 'Sécurité & urgence'}</span>
              {hasActiveEmergency && (
                <span className="ml-auto size-2 animate-pulse rounded-full bg-[#E5544B]" />
              )}
            </Link>
          </div>
        )}

        {/* Section 1: Super Admin Suite (Super Admin Role Only) */}
        {isSuperAdmin && (
          <div className="space-y-1 p-3">
            <div
              onClick={() => toggleMenu('super-admin')}
              className="
                flex cursor-pointer items-center justify-between px-3 py-1.5
                text-[11px] font-extrabold tracking-wider text-slate-400
                uppercase transition-colors
                hover:text-white
              "
            >
              <span className="flex items-center gap-1.5 text-[#0066FF]">
                <Sparkles className="size-3.5" />
                {tNav('superAdminPlatform')}
              </span>
              {openMenus['super-admin']
                ? (
                    <ChevronDown className="size-3.5" />
                  )
                : (
                    <ChevronRight className="size-3.5" />
                  )}
            </div>

            {openMenus['super-admin'] && (
              <div className="space-y-0.5 pt-1">
                {superAdminNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== `/${locale}/dashboard/super-admin` && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isSubOpen = openMenus[item.label];

                  return (
                    <div key={item.href}>
                      <div className="flex items-center justify-between">
                        <Link
                          href={item.href}
                          className={`
                            flex flex-1 items-center gap-3 rounded-lg px-3 py-2
                            text-xs font-semibold transition-all
                            ${
                    isActive
                      ? 'bg-[#0066FF] font-bold text-white shadow-xs'
                      : `
                        text-slate-300
                        hover:bg-slate-800/60 hover:text-white
                      `
                    }
                          `}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                        {hasSubItems && (
                          <button
                            onClick={() => toggleMenu(item.label)}
                            className="
                              p-2 text-slate-400
                              hover:text-white
                            "
                          >
                            {isSubOpen
                              ? <ChevronDown className="size-3" />
                              : (
                                  <ChevronRight className="size-3" />
                                )}
                          </button>
                        )}
                      </div>

                      {/* Submenu Items */}
                      {hasSubItems && isSubOpen && (
                        <div className="
                          my-1 ml-7 space-y-1 border-l border-slate-700/60 pl-2
                        "
                        >
                          {item.subItems?.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={`
                                  block rounded-md px-2.5 py-1.5 text-[11px]
                                  font-medium transition-all
                                  ${
                              isSubActive
                                ? 'bg-[#0066FF]/10 font-bold text-[#0066FF]'
                                : `
                                  text-slate-400
                                  hover:bg-slate-800/40 hover:text-white
                                `
                              }
                                `}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 2: School OS Operational Modules (Grouped into 5 Conceptual Domains) */}
        {(!isSuperAdmin || hasSelectedTenant) && (
          <div className="space-y-3 p-3">
            {conceptualSections
              .filter(sec => sec.items.length > 0)
              .map((section) => {
                const isOpen = openMenus[section.id] ?? true;
                const hasActiveChild = section.items.some(
                  i => pathname === i.href || (i.subItems && i.subItems.some(s => pathname === s.href)),
                );

                return (
                  <div key={section.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleMenu(section.id)}
                      className="
                        flex w-full cursor-pointer items-center justify-between px-3 py-1.5
                        text-[11px] font-extrabold tracking-wider text-slate-400 uppercase
                        transition-colors hover:text-white
                      "
                    >
                      <span className={hasActiveChild ? 'font-bold text-[#2487B8]' : ''}>
                        {section.label}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-0.5 pt-0.5">
                        {section.items.map((item) => {
                          const isActive = pathname === item.href;
                          const Icon = item.icon;
                          const hasSubItems = item.subItems && item.subItems.length > 0;
                          const isSubOpen = openMenus[item.label]
                            || activeMenuLabel === item.label;

                          return (
                            <div key={item.href}>
                              <div className="flex items-center justify-between">
                                <Link
                                  href={item.href}
                                  className={`
                                    flex flex-1 items-center gap-3 rounded-lg px-3 py-2
                                    text-xs font-semibold transition-all
                                    ${
                            isActive
                              ? 'bg-[#2487B8] font-bold text-white shadow-xs'
                              : `
                                text-slate-300
                                hover:bg-slate-800/60 hover:text-white
                              `
                            }
                                  `}
                                >
                                  <Icon className="size-4" />
                                  <span>{item.label}</span>
                                </Link>
                                {hasSubItems && (
                                  <button
                                    onClick={() => toggleMenu(item.label)}
                                    className="
                                      p-2 text-slate-400
                                      hover:text-white
                                    "
                                  >
                                    {isSubOpen
                                      ? <ChevronDown className="size-3" />
                                      : (
                                          <ChevronRight className="size-3" />
                                        )}
                                  </button>
                                )}
                              </div>

                              {/* Submenu Items */}
                              {hasSubItems && isSubOpen && (
                                <div className="
                                  my-1 ml-7 space-y-1 border-l border-slate-700/60 pl-2
                                "
                                >
                                  {item.subItems?.map((sub) => {
                                    const isSubActive = pathname === sub.href;
                                    return (
                                      <Link
                                        key={sub.href}
                                        href={sub.href}
                                        className={`
                                          block rounded-md px-2.5 py-1.5 text-[11px]
                                          font-medium transition-all
                                          ${
                                      isSubActive
                                        ? 'bg-[#2487B8]/10 font-bold text-[#2487B8]'
                                        : `
                                          text-slate-400
                                          hover:bg-slate-800/40 hover:text-white
                                        `
                                      }
                                        `}
                                      >
                                        {sub.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* User Profile & Role Footer */}
      <div className="
        shrink-0 space-y-3 border-t border-slate-800 bg-[#111A23] p-4
        shadow-[0_-12px_28px_rgba(0,0,0,0.16)]
      "
      >
        <div className="
          flex items-center justify-between text-xs text-slate-300
        "
        >
          <span>{tNav('activeRole')}</span>
          <span className="
            rounded-sm border border-[#2487B8]/40 bg-[#2487B8]/20 px-2 py-0.5
            text-[11px] font-bold text-[#2487B8]
          "
          >
            {roleLabel}
          </span>
        </div>
        <PortalRoleSwitcher
          availableRoles={(portalMe?.availableRoles ?? [effectiveRole]) as AppRole[]}
          activeRole={effectiveRole as AppRole}
          locale={locale}
        />
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = `/${locale}/login`;
          }}
          className="
            flex w-full cursor-pointer items-center justify-center gap-2
            rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5
            text-xs font-semibold text-red-400 transition-colors
            hover:bg-red-500/20
          "
        >
          <LogOut className="size-3.5" />
          {' '}
          {tAuth('signOut')}
        </button>
      </div>
    </aside>
  );
}
