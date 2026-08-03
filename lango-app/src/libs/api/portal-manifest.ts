import type { AppRole, RequestContext } from '@/libs/api/context';
import { hasCapability, type PermissionKey } from '@/libs/api/permissions';

// ---------------------------------------------------------------------------
// Portal Manifest — server-owned navigation + widget definitions.
//
// The client sidebar renders from this manifest instead of hardcoding
// navigation per role. APIs still reauthorize independently — hiding a
// menu is never authorization.
// ---------------------------------------------------------------------------

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  permission?: PermissionKey;
  children?: NavItem[];
  badge?: string;
  /** If true, this item only shows when the related addon is enabled. */
  addonId?: string;
};

export type PortalManifest = {
  role: AppRole;
  navigation: NavItem[];
  quickActions: NavItem[];
  homeWidgets: string[];
};

// ---------------------------------------------------------------------------
// Navigation definitions — shared across all portals.
// Items are filtered by the user's effective permissions.
// ---------------------------------------------------------------------------

const FULL_NAVIGATION: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: 'LayoutDashboard',
    href: '/dashboard',
  },
  {
    id: 'students',
    label: 'Élèves',
    icon: 'Users',
    href: '/dashboard/students',
    permission: 'students.read',
  },
  {
    id: 'teachers',
    label: 'Enseignants',
    icon: 'GraduationCap',
    href: '/dashboard/teachers',
    permission: 'teachers.read',
  },
  {
    id: 'academics',
    label: 'Structure académique',
    icon: 'BookOpen',
    href: '/dashboard/academics',
    permission: 'academics.read',
    children: [
      { id: 'session-years', label: 'Années scolaires', icon: 'Calendar', href: '/dashboard/academics/session-years', permission: 'academics.read' },
      { id: 'classes', label: 'Classes', icon: 'School', href: '/dashboard/academics/classes', permission: 'academics.read' },
      { id: 'subjects', label: 'Matières', icon: 'FileText', href: '/dashboard/academics/subjects', permission: 'academics.read' },
      { id: 'schedule', label: 'Emploi du temps', icon: 'Clock', href: '/dashboard/academics/schedule', permission: 'academics.read' },
    ],
  },
  {
    id: 'attendance',
    label: 'Présences',
    icon: 'ClipboardCheck',
    href: '/dashboard/attendance',
    permission: 'attendance.read',
  },
  {
    id: 'grading',
    label: 'Notes & évaluations',
    icon: 'Award',
    href: '/dashboard/grading',
    permission: 'grading.read',
  },
  {
    id: 'finance',
    label: 'Finances',
    icon: 'Wallet',
    href: '/dashboard/finance',
    permission: 'finance.read',
    children: [
      { id: 'invoices', label: 'Factures', icon: 'Receipt', href: '/dashboard/finance/invoices', permission: 'finance.read' },
      { id: 'payments', label: 'Paiements', icon: 'CreditCard', href: '/dashboard/finance/payments', permission: 'finance.read' },
      { id: 'expenses', label: 'Dépenses', icon: 'TrendingDown', href: '/dashboard/finance/expenses', permission: 'finance.read' },
    ],
  },
  {
    id: 'guardians',
    label: 'Parents / Tuteurs',
    icon: 'HeartHandshake',
    href: '/dashboard/guardians',
    permission: 'guardians.read',
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: 'MessageSquare',
    href: '/dashboard/communication',
    permission: 'communication.read',
  },
  {
    id: 'reports',
    label: 'Rapports',
    icon: 'BarChart3',
    href: '/dashboard/reports',
    permission: 'reports.read',
  },
  {
    id: 'hr',
    label: 'RH & Paie',
    icon: 'Briefcase',
    href: '/dashboard/hr',
    permission: 'hr.read',
    children: [
      { id: 'hr-dashboard', label: 'Tableau de bord RH', icon: 'LayoutDashboard', href: '/dashboard/hr', permission: 'hr.read' },
      { id: 'hr-self-service', label: 'Mon espace RH', icon: 'User', href: '/dashboard/hr/self-service' },
      { id: 'hr-employees', label: 'Profils employés', icon: 'Users', href: '/dashboard/hr/employees', permission: 'hr.manage' },
      { id: 'hr-salary-templates', label: 'Gabarits salariaux', icon: 'DollarSign', href: '/dashboard/hr/salary-templates', permission: 'hr.manage' },
      { id: 'hr-payroll', label: 'Paie mensuelle', icon: 'CreditCard', href: '/dashboard/hr/payroll', permission: 'hr.manage' },
      { id: 'hr-leave', label: 'Congés', icon: 'CalendarOff', href: '/dashboard/hr/leave', permission: 'hr.read' },
    ],
  },
  {
    id: 'settings',
    label: 'Paramètres',
    icon: 'Settings',
    href: '/dashboard/settings',
    permission: 'settings.read',
    children: [
      { id: 'settings-general', label: 'Général', icon: 'Building2', href: '/dashboard/settings', permission: 'settings.organization.manage' },
      { id: 'settings-branches', label: 'Filiales', icon: 'GitBranch', href: '/dashboard/settings/branches', permission: 'settings.organization.manage' },
      { id: 'settings-users', label: 'Utilisateurs', icon: 'UserCog', href: '/dashboard/settings/users', permission: 'users.manage' },
      { id: 'settings-permissions', label: 'Permissions', icon: 'Shield', href: '/dashboard/settings/permissions', permission: 'users.permissions.manage' },
      { id: 'settings-addons', label: 'Modules', icon: 'Puzzle', href: '/dashboard/settings/addons', permission: 'settings.read' },
      { id: 'settings-audit', label: 'Journal d\'audit', icon: 'FileSearch', href: '/dashboard/settings/audit', permission: 'audit.read' },
    ],
  },
];

const QUICK_ACTIONS: NavItem[] = [
  { id: 'quick-add-student', label: 'Ajouter un élève', icon: 'UserPlus', href: '/dashboard/students?action=create', permission: 'students.create' },
  { id: 'quick-attendance', label: 'Saisir les présences', icon: 'ClipboardCheck', href: '/dashboard/attendance?action=record', permission: 'attendance.manage' },
  { id: 'quick-payment', label: 'Enregistrer un paiement', icon: 'CreditCard', href: '/dashboard/finance/payments?action=create', permission: 'finance.manage' },
  { id: 'quick-payroll', label: 'Gérer la paie', icon: 'Briefcase', href: '/dashboard/hr', permission: 'hr.manage' },
];

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

async function filterByPermission(
  items: NavItem[],
  userId: string,
  tenantId: string,
  role: AppRole,
): Promise<NavItem[]> {
  const result: NavItem[] = [];

  for (const item of items) {
    // Check if the user has permission for this item.
    if (item.permission) {
      const allowed = await hasCapability(userId, tenantId, role, item.permission);
      if (!allowed) continue;
    }

    // Recursively filter children.
    let filteredChildren: NavItem[] | undefined;
    if (item.children) {
      filteredChildren = await filterByPermission(item.children, userId, tenantId, role);
      // If all children were filtered out, skip the parent too.
      if (filteredChildren.length === 0) continue;
    }

    result.push({
      ...item,
      children: filteredChildren,
    });
  }

  return result;
}

/**
 * Build the portal manifest for the authenticated user.
 * The client sidebar renders from this; APIs reauthorize independently.
 */
export async function getPortalManifest(context: RequestContext): Promise<PortalManifest> {
  const tenantId = context.tenantId ?? '';
  const navigation = await filterByPermission(FULL_NAVIGATION, context.userId, tenantId, context.role);
  const quickActions = await filterByPermission(QUICK_ACTIONS, context.userId, tenantId, context.role);

  // Determine home widgets based on role.
  const homeWidgets: string[] = [];
  if (['school_admin', 'super_admin'].includes(context.role)) {
    homeWidgets.push('stats-overview', 'recent-activity', 'quick-actions');
  }
  if (context.role === 'teacher') {
    homeWidgets.push('my-classes', 'today-schedule', 'pending-attendance');
  }
  if (context.role === 'student') {
    homeWidgets.push('my-schedule', 'my-grades', 'my-attendance');
  }
  if (context.role === 'accountant') {
    homeWidgets.push('finance-overview', 'pending-payments', 'recent-transactions', 'payroll-summary');
  }
  if (context.role === 'parent') {
    homeWidgets.push('children-overview', 'attendance-summary', 'payment-status');
  }
  if (context.role === 'receptionist') {
    homeWidgets.push('inquiry-intake', 'visitor-log', 'appointments');
  }


  return {
    role: context.role,
    navigation,
    quickActions,
    homeWidgets,
  };
}
