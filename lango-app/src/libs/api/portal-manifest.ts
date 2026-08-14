import type { AppRole, RequestContext } from '@/libs/api/context';
import { hasCapability, type PermissionKey } from '@/libs/api/permissions';
import { hasAddon } from '@/libs/api/entitlements';
import { listAvailableRoles } from '@/features/portal/services/active-context';
import { HOME_WIDGETS } from '@/features/portal/services/portal-home';

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
  baseRole: AppRole;
  navigation: NavItem[];
  quickActions: NavItem[];
  homeWidgets: string[];
  availableRoles: AppRole[];
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
      { id: 'teacher-schedule', label: 'Emploi du temps enseignant', icon: 'CalendarClock', href: '/dashboard/academics/teacher-schedule', permission: 'academics.read' },
      { id: 'session-copy', label: 'Copie de session', icon: 'Copy', href: '/dashboard/academics/session-copy', permission: 'academics.manage' },
      { id: 'assignments', label: 'Espace d\'affectations', icon: 'UserCheck', href: '/dashboard/academics/assignments', permission: 'academics.read' },
      { id: 'promotions', label: 'Promotion & Réinscription', icon: 'Sparkles', href: '/dashboard/academics/promotions', permission: 'academics.manage' },
      { id: 'readiness', label: 'Bilan de rentrée', icon: 'ShieldCheck', href: '/dashboard/academics/readiness', permission: 'academics.read' },
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
      { id: 'accounting-accounts', label: 'Plan comptable', icon: 'BookOpen', href: '/dashboard/finance/accounting/accounts', permission: 'accounting.account.read' },
      { id: 'accounting-transactions', label: 'Grand livre', icon: 'FileText', href: '/dashboard/finance/accounting/transactions', permission: 'accounting.account.read' },
      { id: 'accounting-voucher-types', label: 'Journaux & pièces', icon: 'Settings2', href: '/dashboard/finance/accounting/voucher-types', permission: 'accounting.account.manage' },
      { id: 'accounting-deposit', label: 'Nouvel encaissement', icon: 'Receipt', href: '/dashboard/finance/accounting/deposits/new', permission: 'accounting.deposit.create' },
      { id: 'accounting-expense', label: 'Nouvelle dépense', icon: 'TrendingDown', href: '/dashboard/finance/expenses/new', permission: 'accounting.expense.prepare' },
      { id: 'accounting-expense-workflow', label: 'Dépenses à traiter', icon: 'ClipboardCheck', href: '/dashboard/finance/accounting/expenses', permission: 'accounting.account.read' },
      { id: 'fee-structures', label: 'Structures de frais', icon: 'FileText', href: '/dashboard/finance/fee-structures', permission: 'finance.read' },
      { id: 'fee-types', label: 'Types de frais', icon: 'Copy', href: '/dashboard/finance/fee-types', permission: 'finance.read' },
      { id: 'fine-policies', label: 'Politiques d\'amendes', icon: 'AlertTriangle', href: '/dashboard/finance/fine-policies', permission: 'finance.read' },
      { id: 'payment-methods', label: 'Méthodes de paiement', icon: 'CreditCard', href: '/dashboard/settings/payment-methods', permission: 'finance.manage' },
    ],
  },
  {
    id: 'guardians',
    label: 'Parents / Tuteurs',
    icon: 'HeartHandshake',
    href: '/dashboard/students/parents',
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
    id: 'guard',
    label: 'Sécurité & Gardiens',
    icon: 'ShieldCheck',
    href: '/dashboard/portals/guard',
    permission: 'guard.portal.use',
    children: [
      { id: 'guard-home', label: 'Accueil du portail', icon: 'LayoutDashboard', href: '/dashboard/portals/guard', permission: 'guard.portal.use' },
      { id: 'guard-scanner', label: 'Scanner (Kiosque)', icon: 'QrCode', href: '/dashboard/portals/guard/scanner', permission: 'guard.portal.use' },
      { id: 'guard-visitors', label: 'Visiteurs', icon: 'Users', href: '/dashboard/portals/guard/visitors', permission: 'guard.visitors.manage' },
      { id: 'guard-pickups', label: 'Sorties', icon: 'LogOut', href: '/dashboard/portals/guard/pickups', permission: 'guard.pickup.release' },
      { id: 'guard-incidents', label: 'Incidents', icon: 'AlertTriangle', href: '/dashboard/portals/guard/incidents', permission: 'guard.incidents.manage' },
      { id: 'guard-emergency', label: 'Urgence', icon: 'Siren', href: '/dashboard/portals/guard/emergency', permission: 'guard.portal.use' },
      { id: 'guard-config', label: 'Configuration', icon: 'Settings2', href: '/dashboard/portals/guard/config', permission: 'guard.gates.manage' },
    ],
  },
  {
    id: 'reception',
    label: 'Accueil & Réception',
    icon: 'ConciergeBell',
    href: '/dashboard/receptionist',
    permission: 'reception.portal.use',
    children: [
      { id: 'reception-home', label: 'Accueil du portail', icon: 'LayoutDashboard', href: '/dashboard/receptionist', permission: 'reception.portal.use' },
      { id: 'reception-inquiries', label: 'Renseignements', icon: 'MessageSquareText', href: '/dashboard/receptionist/inquiries', permission: 'reception.inquiry.manage' },
      { id: 'reception-appointments', label: 'Rendez-vous', icon: 'CalendarCheck2', href: '/dashboard/receptionist/appointments', permission: 'reception.appointment.manage' },
      { id: 'reception-visitors', label: 'Visiteurs', icon: 'Users', href: '/dashboard/receptionist/visitors', permission: 'reception.visitor.manage' },
      { id: 'reception-pickups', label: 'Retraits', icon: 'LogOut', href: '/dashboard/receptionist/pickups', permission: 'reception.portal.use' },
      { id: 'reception-handoffs', label: 'Transferts & tâches', icon: 'ListTodo', href: '/dashboard/receptionist/handoffs', permission: 'reception.handoff.manage' },
    ],
  },
  {
    id: 'transport',
    label: 'Transport Scolaire',
    icon: 'Bus',
    href: '/dashboard/transport',
    permission: 'transport.read',
    addonId: 'transport',
    children: [
      { id: 'transport-dashboard', label: 'Vue d\'ensemble', icon: 'LayoutDashboard', href: '/dashboard/transport', permission: 'transport.read' },
      { id: 'transport-routes', label: 'Itinéraires & Arrêts', icon: 'MapPin', href: '/dashboard/transport/routes', permission: 'transport.route.manage' },
      { id: 'transport-stops', label: 'Arrêts de Bus', icon: 'Navigation', href: '/dashboard/transport/stops', permission: 'transport.route.manage' },
      { id: 'transport-vehicles', label: 'Parc de Véhicules', icon: 'Truck', href: '/dashboard/transport/vehicles', permission: 'transport.vehicle.manage' },
      { id: 'transport-drivers', label: 'Chauffeurs & Convoyeurs', icon: 'UserCheck', href: '/dashboard/transport/drivers', permission: 'transport.driver.manage' },
      { id: 'transport-allocations', label: 'Affectations Élèves', icon: 'Users', href: '/dashboard/transport/allocations', permission: 'transport.assignment.read' },
      { id: 'transport-trips', label: 'Trajets du Jour', icon: 'Calendar', href: '/dashboard/transport/trips', permission: 'transport.trip.read' },
      { id: 'transport-boarding', label: 'Pointage / Montée', icon: 'QrCode', href: '/dashboard/transport/boarding', permission: 'transport.boarding.manage' },
      { id: 'transport-incidents', label: 'Incidents & Signalements', icon: 'AlertTriangle', href: '/dashboard/transport/incidents', permission: 'transport.incident.read' },
      { id: 'transport-reports', label: 'Rapports & Exports', icon: 'BarChart3', href: '/dashboard/transport/reports', permission: 'transport.report' },
      { id: 'transport-policies', label: 'Configuration & Règles', icon: 'Settings2', href: '/dashboard/transport/policies', permission: 'transport.policy.manage' },
    ],
  },
  {
    id: 'library',
    label: 'Bibliothèque',
    icon: 'BookOpen',
    href: '/dashboard/portals/librarian',
    permission: 'library.catalog.read',
    addonId: 'library',
    children: [
      { id: 'library-home', label: 'Vue d’ensemble', icon: 'LayoutDashboard', href: '/dashboard/portals/librarian', permission: 'library.report.read' },
      { id: 'library-desk', label: 'Comptoir de prêt', icon: 'BookCheck', href: '/dashboard/portals/librarian/desk', permission: 'library.circulation.operate' },
      { id: 'library-catalog', label: 'Catalogue', icon: 'BookOpen', href: '/dashboard/library/catalog', permission: 'library.catalog.read' },
      { id: 'library-taxonomy', label: 'Taxonomie', icon: 'FileText', href: '/dashboard/library/categories', permission: 'library.catalog.read' },
      { id: 'library-copies', label: 'Exemplaires & Stock', icon: 'Copy', href: '/dashboard/portals/librarian/copies', permission: 'library.copy.manage' },
      { id: 'library-members', label: 'Adhérents', icon: 'Users', href: '/dashboard/portals/librarian/members', permission: 'library.circulation.operate' },
      { id: 'library-holds', label: 'Réservations', icon: 'CalendarClock', href: '/dashboard/portals/librarian/holds', permission: 'library.hold.manage' },
      { id: 'library-transfers', label: 'Transferts', icon: 'Truck', href: '/dashboard/portals/librarian/transfers', permission: 'library.copy.manage' },
      { id: 'library-stocktake', label: 'Inventaire', icon: 'ClipboardCheck', href: '/dashboard/portals/librarian/stocktake', permission: 'library.stocktake.manage' },
      { id: 'library-policies', label: 'Politiques & Fermetures', icon: 'Settings2', href: '/dashboard/portals/librarian/policies', permission: 'library.policy.manage' },
      { id: 'library-reports', label: 'Rapports', icon: 'BarChart3', href: '/dashboard/portals/librarian/reports', permission: 'library.report.read' },
      { id: 'library-charges', label: 'Frais', icon: 'Receipt', href: '/dashboard/portals/librarian/charges', permission: 'library.circulation.operate' },
    ],
  },
  {
    id: 'leadership',
    label: 'Direction',
    icon: 'Building2',
    href: '/dashboard/portals/leadership',
    permission: 'leadership.portal.use',
    children: [
      { id: 'leadership-home', label: 'Accueil du portail', icon: 'LayoutDashboard', href: '/dashboard/portals/leadership', permission: 'leadership.portal.use' },
      { id: 'leadership-approvals', label: 'Approbations', icon: 'ClipboardCheck', href: '/dashboard/portals/leadership/approvals', permission: 'leadership.portal.use' },
      { id: 'leadership-exceptions', label: 'Exceptions & supervision', icon: 'AlertTriangle', href: '/dashboard/portals/leadership/exceptions', permission: 'leadership.portal.use' },
      { id: 'leadership-admin', label: 'Administration', icon: 'Settings2', href: '/dashboard/portals/leadership/admin', permission: 'leadership.scope.manage' },
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

    // Addon-gated items show only when the tenant is entitled. A super_admin
    // (tenantId === '') has no entitlement row and is shown every addon item.
    if (item.addonId) {
      const enabled = tenantId ? await hasAddon(tenantId, item.addonId) : true;
      if (!enabled) continue;
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

  // Widget contract: the exact same role → widgets map drives /api/portal/home,
  // so the manifest and the home endpoint agree by construction.
  const homeWidgets = HOME_WIDGETS[context.role] ?? [];
  const availableRoles = await listAvailableRoles(context.tenantId, context.baseRole, context.userId);

  return {
    role: context.role,
    baseRole: context.baseRole,
    navigation,
    quickActions,
    homeWidgets,
    availableRoles,
  };
}
