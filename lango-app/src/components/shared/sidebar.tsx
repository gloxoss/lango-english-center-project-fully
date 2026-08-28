'use client';

import {
  Award,
  BarChart3,
  BedDouble,
  Building2,
  Bus,
  Cable,
  CalendarCheck,
  CalendarCheck2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ConciergeBell,
  CreditCard,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
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
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  CalendarDays,
  Video,
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Copy,
  DollarSign,
  FileSearch,
  GitBranch,
  HeartHandshake,
  Puzzle,
  QrCode,
  Receipt,
  School,
  Settings2,
  Siren,
  TrendingDown,
  User,
  UserCog,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/libs/auth-client';
import type { AppRole } from '@/libs/api/context';
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
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Capability key from src/libs/api/permissions.ts. Undefined = always visible. */
  permission?: string;
  subItems?: SubMenuItem[];
};

// Shape of the server-owned manifest nav items (src/libs/api/portal-manifest.ts).
type ManifestItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  children?: ManifestItem[];
};

// Manifest icons arrive as strings; map them to lucide components. Unknown
// icons fall back to LayoutDashboard rather than breaking the sidebar.
const MANIFEST_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Users, GraduationCap, BookOpen, School, Calendar, FileText, Clock,
  CalendarClock, Copy, UserCheck, Sparkles, ShieldCheck, ClipboardCheck, Award, Wallet,
  Receipt, CreditCard, TrendingDown, HeartHandshake, MessageSquare, BarChart3, Briefcase,
  User, DollarSign, QrCode, LogOut, AlertTriangle, Siren, Settings2, Bus, MapPin, Navigation,
  Truck, Settings, Building2, GitBranch, UserCog, Puzzle, FileSearch, CalendarCheck2,
  ConciergeBell, ListTodo, LogIn, MessageSquareText,
};

function manifestToNav(item: ManifestItem, locale: string): NavItem {
  return {
    label: item.label,
    href: `/${locale}${item.href}`,
    icon: MANIFEST_ICONS[item.icon] ?? LayoutDashboard,
    subItems: item.children?.map((c) => ({ label: c.label, href: `/${locale}${c.href}` })),
  };
}

export function Sidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const tNav = useTranslations('Navigation');
  const tAuth = useTranslations('Auth');
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role || 'school_admin';

  // Capability-driven nav visibility (GET /api/me/permissions) - replaces the
  // earlier accountant-only hardcoded href check, which only stripped
  // Academics/Settings and left every other module fully visible.
  // null = not loaded yet (render nothing gated, avoid a flash of items the
  // user doesn't have); super_admin/school_admin get every permission from
  // the API itself (hasCapability short-circuits true for super_admin, and
  // school_admin's DEFAULT_ROLE_PERMISSIONS is ALL_PERMISSIONS), so this is
  // a no-op filter for them.
  const [myPermissions, setMyPermissions] = useState<Set<string> | null>(null);
  // Server-owned active-role context (GET /api/portal/me) and the manifest nav
  // (GET /api/portal/manifest). The server is the source of truth for the
  // effective role and available roles; the session cookie only supplies the
  // base role. Refetched on `portal:role-changed` so stale nav/permissions are
  // dropped after a role switch.
  const [portalMe, setPortalMe] = useState<{ role: string; availableRoles: string[] } | null>(null);
  const [manifestNav, setManifestNav] = useState<NavItem[] | null>(null);
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState<boolean | null>(null);

  const loadPortalContext = async () => {
    try {
      const [meRes, manifestRes, eligRes] = await Promise.all([
        fetch('/api/portal/me'),
        fetch('/api/portal/manifest'),
        fetch('/api/hr/me/self-service-eligibility'),
      ]);
      const meJson = await meRes.json();
      if (meJson.success) {
        setPortalMe(meJson.data);
        setMyPermissions(new Set<string>(meJson.data.permissions ?? []));
      }
      const manifestJson = await manifestRes.json();
      if (manifestJson.success && Array.isArray(manifestJson.data.navigation)) {
        setManifestNav(manifestJson.data.navigation.map((n: ManifestItem) => manifestToNav(n, locale)));
      }
      const eligJson = await eligRes.json().catch(() => ({}));
      setHasEmployeeProfile(Boolean(eligJson?.data?.eligible));
    } catch {
      setMyPermissions(new Set());
      setHasEmployeeProfile(false);
    }
  };

  useEffect(() => {
    loadPortalContext();
    const onChange = () => loadPortalContext();
    window.addEventListener('portal:role-changed', onChange);
    return () => window.removeEventListener('portal:role-changed', onChange);
  }, []);
  const canSee = (permission?: string) => !permission || (myPermissions !== null && myPermissions.has(permission));

  // Effective role comes from the server-owned active context; falls back to
  // the session base role until /api/portal/me resolves.
  const effectiveRole = portalMe?.role ?? userRole;
  const isSuperAdmin = effectiveRole === 'super_admin';
  const roleLabel = ROLE_LABELS[effectiveRole] ?? effectiveRole;

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'super-admin': true,
    'school-modules': true,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Super Admin Suite Navigation Items
  const superAdminNavItems: NavItem[] = [
    {
      label: 'Tableau de bord Super Admin',
      href: `/${locale}/dashboard/super-admin`,
      icon: LayoutDashboard,
    },
    {
      label: 'Écoles Clients',
      href: `/${locale}/dashboard/super-admin/schools`,
      icon: Building2,
      subItems: [
        { label: 'Toutes les écoles', href: `/${locale}/dashboard/super-admin/schools` },
        { label: '+ Créer une école', href: `/${locale}/dashboard/super-admin/schools/create` },
      ],
    },
    {
      label: 'Liste accès prioritaire',
      href: `/${locale}/dashboard/super-admin/waitlist`,
      icon: ClipboardList,
    },
    {
      label: 'Abonnements & Tarifs',
      href: `/${locale}/dashboard/super-admin/subscriptions`,
      icon: Package,
      subItems: [
        { label: 'Plans & Modules', href: `/${locale}/dashboard/super-admin/subscriptions` },
        { label: 'Gestion Abonnements', href: `/${locale}/dashboard/super-admin/subscriptions/list` },
      ],
    },
    {
      label: 'Consommation SMS',
      href: `/${locale}/dashboard/super-admin/sms`,
      icon: MessageSquare,
    },
    {
      label: 'Support & Incidents',
      href: `/${locale}/dashboard/super-admin/support`,
      icon: Headphones,
    },
    {
      label: 'Rapports Plateforme',
      href: `/${locale}/dashboard/super-admin/reports`,
      icon: BarChart3,
    },
    {
      label: 'Domaines Personnalisés',
      href: `/${locale}/dashboard/super-admin/domains`,
      icon: Server,
    },
    {
      label: 'Santé & Infrastructure',
      href: `/${locale}/dashboard/super-admin/settings`,
      icon: Server,
    },
  ];

  // School OS Standard Operational Navigation Items
  const schoolNavItems: NavItem[] = [
    { label: 'Tableau de bord École', href: `/${locale}/dashboard`, icon: LayoutDashboard },
    // Director-level cross-module dashboard (academic averages, HR presence,
    // institutional risk register) - confirmed via a live accountant session
    // that reports.read let it through and leaked grade averages. No single
    // existing capability maps to "director portal" cleanly; reusing
    // settings.organization.manage as the closest already-admin-only proxy
    // rather than inventing a new one for a single page.
    { label: 'Analytics & Croissance', href: `/${locale}/dashboard/analytics`, icon: BarChart3, permission: 'settings.organization.manage' },
    {
      label: 'Élèves & Profils',
      href: `/${locale}/dashboard/students`,
      icon: Users,
      permission: 'students.read',
      subItems: [
        { label: 'Répertoire Élèves', href: `/${locale}/dashboard/students`, permission: 'students.read' },
        { label: 'Demandes Admission', href: `/${locale}/dashboard/students/admissions`, permission: 'admissions.view' },
        { label: '+ Inscrire un élève', href: `/${locale}/dashboard/students/add`, permission: 'students.create' },
        { label: 'Parents & Tuteurs', href: `/${locale}/dashboard/students/parents`, permission: 'guardians.read' },
        { label: 'Importer Élèves', href: `/${locale}/dashboard/students/import`, permission: 'students.import' },
        { label: 'Matricules & N°', href: `/${locale}/dashboard/students/matricules`, permission: 'students.read' },
        { label: 'Photos Élèves', href: `/${locale}/dashboard/students/photos`, permission: 'students.read' },
        { label: 'Transferts', href: `/${locale}/dashboard/students/transfers`, permission: 'students.update' },
        { label: 'Promotions', href: `/${locale}/dashboard/students/promotions`, permission: 'students.placements.manage' },
        { label: 'Anciens Élèves', href: `/${locale}/dashboard/students/alumni`, permission: 'admissions.manage' },
        { label: 'Événements Anciens Élèves', href: `/${locale}/dashboard/students/alumni/events`, permission: 'admissions.manage' },
        { label: 'Demandes Anciens Élèves', href: `/${locale}/dashboard/students/alumni/requests`, permission: 'admissions.manage' },
      ],
    },
    {
      label: 'Matières & Classes',
      href: `/${locale}/dashboard/academics/classes`,
      icon: GraduationCap,
      permission: 'academics.read',
      subItems: [
        { label: 'Classes', href: `/${locale}/dashboard/academics/classes`, permission: 'academics.read' },
        { label: 'Mediums', href: `/${locale}/dashboard/academics/mediums`, permission: 'academics.read' },
        { label: 'Sections', href: `/${locale}/dashboard/academics/sections`, permission: 'academics.read' },
        { label: 'Matières', href: `/${locale}/dashboard/academics/subjects`, permission: 'academics.read' },
        { label: 'Semestres', href: `/${locale}/dashboard/academics/semesters`, permission: 'academics.read' },
        { label: 'Filières', href: `/${locale}/dashboard/academics/streams`, permission: 'academics.read' },
        { label: 'Shifts', href: `/${locale}/dashboard/academics/shifts`, permission: 'academics.read' },
        { label: 'Matières Optionnelles', href: `/${locale}/dashboard/academics/optional-subjects`, permission: 'academics.read' },
        { label: 'Banque de questions', href: `/${locale}/dashboard/academics/question-bank`, permission: 'academics.read' },
        { label: 'Emploi du temps', href: `/${locale}/dashboard/academics/schedule`, permission: 'academics.read' },
        { label: 'Emploi du temps enseignant', href: `/${locale}/dashboard/academics/teacher-schedule`, permission: 'academics.read' },
        { label: 'Conflits horaires', href: `/${locale}/dashboard/academics/conflicts`, permission: 'academics.read' },
        { label: 'Copie de Session', href: `/${locale}/dashboard/academics/session-copy`, permission: 'academics.manage' },
        { label: 'Espace d\'affectations', href: `/${locale}/dashboard/academics/assignments`, permission: 'academics.read' },
        { label: 'Promotion & Réinscription', href: `/${locale}/dashboard/academics/promotions`, permission: 'academics.manage' },
        { label: 'Bilan de Rentrée', href: `/${locale}/dashboard/academics/readiness`, permission: 'academics.read' },
      ],
    },

    {
      label: 'Classes en Direct',
      href: `/${locale}/dashboard/academics/live-class`,
      icon: Video,
      permission: 'live.read',
      subItems: [
        { label: 'Classes virtuelles', href: `/${locale}/dashboard/academics/live-class`, permission: 'live.read' },
        { label: 'Rapports en direct', href: `/${locale}/dashboard/academics/live-class-reports`, permission: 'live.reports.read' },
      ],
    },

    {
      label: 'Corps Enseignant',
      href: `/${locale}/dashboard/teachers/manage`,
      icon: UserCheck,
      permission: 'teachers.read',
      subItems: [
        { label: 'Gestion Enseignants', href: `/${locale}/dashboard/teachers/manage`, permission: 'teachers.read' },
        { label: 'Import Massif', href: `/${locale}/dashboard/teachers/bulk-import`, permission: 'teachers.create' },
      ],
    },
    {
      label: 'Présence',
      href: `/${locale}/dashboard/attendance`,
      icon: CalendarCheck,
      permission: 'attendance.read',
      subItems: [
        { label: 'Présence Mobile', href: `/${locale}/dashboard/attendance`, permission: 'attendance.read' },
        { label: 'Badges QR', href: `/${locale}/dashboard/attendance/badges`, permission: 'attendance.read' },
        { label: 'Audit & Rapports QR', href: `/${locale}/dashboard/attendance/qr-reports`, permission: 'attendance.read' },
        { label: 'Scanner Élèves (Kiosque)', href: `/${locale}/dashboard/attendance/scanner`, permission: 'attendance.manage' },
        { label: 'Pointeuse Employés', href: `/${locale}/dashboard/workforce/timeclock`, permission: 'attendance.read' },
        { label: 'Justificatifs', href: `/${locale}/dashboard/attendance/excuses`, permission: 'attendance.read' },
        { label: 'Signalements', href: `/${locale}/dashboard/attendance/flags`, permission: 'attendance.read' },
        { label: 'Audit & Alertes', href: `/${locale}/dashboard/attendance/audit`, permission: 'attendance.read' },
      ],
    },
    {
      label: 'Cartes & Convocations',
      href: `/${locale}/dashboard/cards/templates`,
      icon: IdCard,
      permission: 'cards.templates.manage',
      subItems: [
        { label: 'Vue d\'ensemble', href: `/${locale}/dashboard/cards`, permission: 'cards.issue' },
        { label: 'Modèles de cartes', href: `/${locale}/dashboard/cards/templates`, permission: 'cards.templates.manage' },
        { label: 'Élèves', href: `/${locale}/dashboard/cards/students`, permission: 'cards.issue' },
        { label: 'Employés', href: `/${locale}/dashboard/cards/employees`, permission: 'cards.issue' },
        { label: 'Convocations', href: `/${locale}/dashboard/cards/admit-cards`, permission: 'cards.issue' },
        { label: 'Émissions en lot', href: `/${locale}/dashboard/cards/jobs`, permission: 'cards.issue' },
        { label: 'Documents émis', href: `/${locale}/dashboard/cards/issued`, permission: 'cards.issue' },
      ],
    },
    {
      label: 'Certificats',
      href: `/${locale}/dashboard/certificates`,
      icon: ScrollText,
      permission: 'certificates.issue',
      subItems: [
        { label: 'Vue d\'ensemble', href: `/${locale}/dashboard/certificates`, permission: 'certificates.issue' },
        { label: 'Définitions', href: `/${locale}/dashboard/certificates/definitions`, permission: 'certificates.templates.manage' },
        { label: 'Modèles de certificats', href: `/${locale}/dashboard/certificates/templates`, permission: 'certificates.templates.manage' },
        { label: 'Émettre — Élèves', href: `/${locale}/dashboard/certificates/issue/students`, permission: 'certificates.issue' },
        { label: 'Émettre — Employés', href: `/${locale}/dashboard/certificates/issue/employees`, permission: 'certificates.issue' },
        { label: 'Demandes & Approbations', href: `/${locale}/dashboard/certificates/requests`, permission: 'certificates.issue' },
        { label: 'Certificats émis', href: `/${locale}/dashboard/certificates/issued`, permission: 'certificates.issue' },
        { label: 'Émissions en lot', href: `/${locale}/dashboard/certificates/jobs`, permission: 'certificates.issue' },
        { label: 'Paramètres & Signataires', href: `/${locale}/dashboard/certificates/settings`, permission: 'certificates.templates.manage' },
      ],
    },
    {
      label: 'Examens & Évaluations',
      href: `/${locale}/dashboard/academics/assessment/homework`,
      icon: Award,
      permission: 'academics.read',
      subItems: [
        { label: 'Devoirs & Évaluations', href: `/${locale}/dashboard/academics/assessment/homework`, permission: 'academics.read' },
        { label: 'Exam Master & Salles', href: `/${locale}/dashboard/academics/assessment/exam-master`, permission: 'academics.read' },
        { label: 'Examens en Ligne (Add-on)', href: `/${locale}/dashboard/academics/assessment/online-exams`, permission: 'academics.read' },
      ],
    },

    {
      label: 'Événements & Calendrier',
      href: `/${locale}/dashboard/events`,
      icon: CalendarDays,
      permission: 'events.read',
      subItems: [
        { label: 'Calendrier des Événements', href: `/${locale}/dashboard/events`, permission: 'events.read' },
      ],
    },

    {
      label: 'Ressources Pédagogiques',
      href: `/${locale}/dashboard/content/library`,
      icon: FolderOpen,
      permission: 'academics.read',
      subItems: [
        { label: 'Médiathèque', href: `/${locale}/dashboard/content/library`, permission: 'academics.read' },
        { label: 'Types de Pièces Jointes', href: `/${locale}/dashboard/content/types`, permission: 'content.types.manage' },
      ],
    },

    {
      label: 'Bibliothèque & Prêt d’Ouvrages',
      href: `/${locale}/dashboard/portals/librarian`,
      icon: BookOpen,
      permission: 'library.catalog.read',
      subItems: [
        { label: 'Vue d’ensemble', href: `/${locale}/dashboard/portals/librarian`, permission: 'library.report.read' },
        // "Comptoir de prêt" (the operational checkout counter) is a librarian
        // self-service action, not an admin oversight surface — deliberately
        // absent here so school_admin/super_admin don't get the raw circulation
        // desk in their everyday nav (PRODUCT-REVIEW §12.5). Librarians still
        // see it via the portal manifest.
        { label: 'Catalogue & Ouvrages', href: `/${locale}/dashboard/library/catalog`, permission: 'library.catalog.read' },
      ],
    },

    {
      label: 'Finance & Invoicing',
      href: `/${locale}/dashboard/finance`,
      icon: CreditCard,
      permission: 'finance.read',
      subItems: [
        { label: 'Tableau de bord Finance', href: `/${locale}/dashboard/finance`, permission: 'finance.read' },
        { label: 'Guichet de Caisse', href: `/${locale}/dashboard/finance/collection-desk`, permission: 'finance.read' },
        { label: 'Créances Élèves', href: `/${locale}/dashboard/finance/receivables`, permission: 'finance.read' },
        { label: 'Rappels de frais', href: `/${locale}/dashboard/finance/reminders`, permission: 'finance.manage' },
        { label: 'Factures', href: `/${locale}/dashboard/finance/invoices`, permission: 'finance.read' },
        { label: 'Reçus', href: `/${locale}/dashboard/finance/receipts`, permission: 'finance.read' },
        { label: 'Relevés élèves', href: `/${locale}/dashboard/finance/statements`, permission: 'finance.read' },
        { label: 'Sessions de caisse', href: `/${locale}/dashboard/finance/cashier-sessions`, permission: 'finance.manage' },
        { label: 'Enregistrer un paiement', href: `/${locale}/dashboard/finance/payments/new`, permission: 'finance.read' },
        { label: 'Dépenses & Journal', href: `/${locale}/dashboard/finance/office-accounting`, permission: 'finance.read' },
        { label: 'Plan comptable', href: `/${locale}/dashboard/finance/accounting/accounts`, permission: 'accounting.account.read' },
        { label: 'Grand livre', href: `/${locale}/dashboard/finance/accounting/transactions`, permission: 'accounting.account.read' },
        { label: 'Journaux & pièces', href: `/${locale}/dashboard/finance/accounting/voucher-types`, permission: 'accounting.account.manage' },
        { label: 'Nouvel encaissement', href: `/${locale}/dashboard/finance/accounting/deposits/new`, permission: 'accounting.deposit.create' },
        { label: 'Nouvelle dépense', href: `/${locale}/dashboard/finance/expenses/new`, permission: 'accounting.expense.prepare' },
        { label: 'Dépenses à traiter', href: `/${locale}/dashboard/finance/accounting/expenses`, permission: 'accounting.account.read' },
        { label: 'Comptabilisation étudiants', href: `/${locale}/dashboard/finance/accounting/student-accounting`, permission: 'accounting.account.read' },
        { label: 'États financiers', href: `/${locale}/dashboard/finance/accounting/statements`, permission: 'accounting.statement.read' },
        { label: 'Périodes comptables', href: `/${locale}/dashboard/finance/accounting/periods`, permission: 'accounting.statement.read' },
        { label: 'Structures de frais', href: `/${locale}/dashboard/finance/fee-structures`, permission: 'finance.read' },
        { label: 'Types de frais', href: `/${locale}/dashboard/finance/fee-types`, permission: 'finance.read' },
        { label: 'Politiques d\'amendes', href: `/${locale}/dashboard/finance/fine-policies`, permission: 'finance.read' },
        { label: 'Assignations tarifaires', href: `/${locale}/dashboard/finance/fee-assignments`, permission: 'finance.read' },
        { label: 'Affectation des frais', href: `/${locale}/dashboard/finance/allocation`, permission: 'finance.read' },
        { label: 'Allocations de frais', href: `/${locale}/dashboard/finance/allocations`, permission: 'finance.read' },
        { label: 'Notes de crédit', href: `/${locale}/dashboard/finance/credit-notes`, permission: 'finance.read' },
        { label: 'Remboursements', href: `/${locale}/dashboard/finance/refunds`, permission: 'finance.read' },
        { label: 'Approbations', href: `/${locale}/dashboard/finance/approvals`, permission: 'finance.read' },
        { label: 'Rapports & Exports', href: `/${locale}/dashboard/finance/reports`, permission: 'finance.read' },
      ],
    },
    {
      label: 'Inventaire',
      href: `/${locale}/dashboard/inventory`,
      icon: Package,
      permission: 'inventory.read',
      subItems: [
        { label: 'Aperçu', href: `/${locale}/dashboard/inventory/overview`, permission: 'inventory.read' },
        { label: 'Produits', href: `/${locale}/dashboard/inventory/products`, permission: 'inventory.read' },
        { label: 'Catégories', href: `/${locale}/dashboard/inventory/categories`, permission: 'inventory.catalog.manage' },
        { label: 'Unités', href: `/${locale}/dashboard/inventory/units`, permission: 'inventory.catalog.manage' },
        { label: 'Magasins', href: `/${locale}/dashboard/inventory/stores`, permission: 'inventory.catalog.manage' },
        { label: 'Fournisseurs', href: `/${locale}/dashboard/inventory/suppliers`, permission: 'inventory.catalog.manage' },
        { label: 'Achats', href: `/${locale}/dashboard/inventory/purchases`, permission: 'inventory.read' },
        { label: 'Ventes', href: `/${locale}/dashboard/inventory/sales`, permission: 'inventory.read' },
        { label: 'Prêts', href: `/${locale}/dashboard/inventory/issues`, permission: 'inventory.read' },
        { label: 'Ajustements', href: `/${locale}/dashboard/inventory/adjustments`, permission: 'inventory.read' },
        { label: 'Transferts', href: `/${locale}/dashboard/inventory/transfers`, permission: 'inventory.read' },
        { label: 'Stock', href: `/${locale}/dashboard/inventory/stock`, permission: 'inventory.read' },
      ],
    },
    {
      label: 'SMS Communication',
      href: `/${locale}/dashboard/communication/reminders`,
      icon: MessageSquare,
      permission: 'communication.read',
      subItems: [
        { label: 'Envoyer des rappels', href: `/${locale}/dashboard/communication/reminders`, permission: 'communication.send' },
        { label: 'Modèles de messages', href: `/${locale}/dashboard/communication/templates`, permission: 'communication.read' },
      ],
    },
    {
      label: 'CRM & Diffusion',
      href: `/${locale}/dashboard/broadcast`,
      icon: Megaphone,
      permission: 'broadcast.read',
      subItems: [
        { label: 'Pipeline CRM', href: `/${locale}/dashboard/communication/crm`, permission: 'crm.manage' },
        { label: 'Vue d’ensemble', href: `/${locale}/dashboard/broadcast`, permission: 'broadcast.read' },
        { label: 'Connexions', href: `/${locale}/dashboard/broadcast/connections`, permission: 'broadcast.read' },
        { label: 'Segments', href: `/${locale}/dashboard/broadcast/segments`, permission: 'broadcast.read' },
        { label: 'Modèles', href: `/${locale}/dashboard/broadcast/templates`, permission: 'broadcast.read' },
        { label: 'Campagnes', href: `/${locale}/dashboard/broadcast/campaigns`, permission: 'broadcast.read' },
        { label: 'Rapports', href: `/${locale}/dashboard/broadcast/reports`, permission: 'broadcast.read' },
        { label: 'Automations', href: `/${locale}/dashboard/broadcast/automations`, permission: 'broadcast.read' },
      ],
    },
    { label: 'Bulletins Massar', href: `/${locale}/dashboard/documents/generator`, icon: FileText, permission: 'grading.read' },
    {
      label: 'Ressources Humaines',
      href: `/${locale}/dashboard/hr`,
      icon: Users,
      permission: 'hr.employee.read',
      subItems: [
        { label: 'Aperçu', href: `/${locale}/dashboard/hr/overview`, permission: 'hr.employee.read' },
        { label: 'Employés', href: `/${locale}/dashboard/hr/employees`, permission: 'hr.employee.read' },
        { label: 'Nouvel employé', href: `/${locale}/dashboard/hr/employees/new`, permission: 'hr.employee.manage' },
        { label: 'Départements', href: `/${locale}/dashboard/hr/departments`, permission: 'hr.organization.manage' },
        { label: 'Postes', href: `/${locale}/dashboard/hr/designations`, permission: 'hr.organization.manage' },
        { label: 'Accès & Sorties', href: `/${locale}/dashboard/hr/access`, permission: 'hr.access.manage' },
      ],
    },
    {
      label: 'Paie & Workforce',
      href: `/${locale}/dashboard/workforce`,
      icon: Briefcase,
      permission: 'payroll.review',
      subItems: [
        { label: 'Vue d\'ensemble', href: `/${locale}/dashboard/workforce`, permission: 'payroll.review' },
        { label: 'Cycles de paie', href: `/${locale}/dashboard/workforce/payroll/runs`, permission: 'payroll.review' },
        { label: 'Composantes', href: `/${locale}/dashboard/workforce/payroll/components`, permission: 'payroll.configure' },
        { label: 'Structures', href: `/${locale}/dashboard/workforce/payroll/structures`, permission: 'payroll.configure' },
        { label: 'Affectations', href: `/${locale}/dashboard/workforce/payroll/assignments`, permission: 'payroll.configure' },
        { label: 'Ajustements', href: `/${locale}/dashboard/workforce/payroll/adjustments`, permission: 'payroll.review' },
        { label: 'Paiements', href: `/${locale}/dashboard/workforce/payroll/payments`, permission: 'payroll.payment.prepare' },
        { label: 'Congés', href: `/${locale}/dashboard/workforce/leave`, permission: 'payroll.leave.manage' },
        { label: 'Avances', href: `/${locale}/dashboard/workforce/advances`, permission: 'payroll.advances.manage' },
        { label: 'Récompenses', href: `/${locale}/dashboard/workforce/awards`, permission: 'payroll.awards.manage' },
      ],
    },
    ...(hasEmployeeProfile ? [{ label: 'Portail Employé', href: `/${locale}/dashboard/hr/self-service`, icon: UserCheck }] : []),
    {
      label: 'Sécurité & Gardiens',
      href: `/${locale}/dashboard/portals/guard`,
      icon: ShieldCheck,
      permission: 'guard.portal.use',
      subItems: [
        { label: 'Accueil du portail', href: `/${locale}/dashboard/portals/guard`, permission: 'guard.portal.use' },
        { label: 'Scanner (Kiosque)', href: `/${locale}/dashboard/portals/guard/scanner`, permission: 'guard.portal.use' },
        { label: 'Visiteurs', href: `/${locale}/dashboard/portals/guard/visitors`, permission: 'guard.visitors.manage' },
        { label: 'Sorties', href: `/${locale}/dashboard/portals/guard/pickups`, permission: 'guard.pickup.release' },
        { label: 'Incidents', href: `/${locale}/dashboard/portals/guard/incidents`, permission: 'guard.incidents.manage' },
        { label: 'Urgence', href: `/${locale}/dashboard/portals/guard/emergency`, permission: 'guard.portal.use' },
        { label: 'Configuration', href: `/${locale}/dashboard/portals/guard/config`, permission: 'guard.gates.manage' },
      ],
    },
    {
      label: 'Internat',
      href: `/${locale}/dashboard/hostel`,
      icon: BedDouble,
      permission: 'hostel.read',
      subItems: [
        { label: 'Ce soir', href: `/${locale}/dashboard/hostel`, permission: 'hostel.read' },
        { label: 'Résidences', href: `/${locale}/dashboard/hostel/hostels`, permission: 'hostel.read' },
        { label: 'Zones', href: `/${locale}/dashboard/hostel/zones`, permission: 'hostel.read' },
        { label: 'Catégories', href: `/${locale}/dashboard/hostel/categories`, permission: 'hostel.read' },
        { label: 'Chambres & Lits', href: `/${locale}/dashboard/hostel/rooms`, permission: 'hostel.read' },
        { label: 'Occupancy', href: `/${locale}/dashboard/hostel/board`, permission: 'hostel.allocation.read' },
        { label: 'Applications', href: `/${locale}/dashboard/hostel/applications`, permission: 'hostel.allocation.read' },
        { label: 'Affectations', href: `/${locale}/dashboard/hostel/allocations`, permission: 'hostel.allocation.manage' },
        { label: 'Appel du soir', href: `/${locale}/dashboard/hostel/roll-call`, permission: 'hostel.supervision.read' },
        { label: 'Sorties', href: `/${locale}/dashboard/hostel/leave-passes`, permission: 'hostel.supervision.manage' },
        { label: 'Politiques', href: `/${locale}/dashboard/hostel/policies`, permission: 'hostel.policies.manage' },
        { label: 'Rapports', href: `/${locale}/dashboard/hostel/reports`, permission: 'hostel.read' },
      ],
    },
    {
      label: 'Transport Scolaire',
      href: `/${locale}/dashboard/transport`,
      icon: Bus,
      permission: 'transport.read',
      subItems: [
        { label: 'Vue d\'ensemble', href: `/${locale}/dashboard/transport`, permission: 'transport.read' },
        { label: 'Itinéraires', href: `/${locale}/dashboard/transport/routes`, permission: 'transport.route.manage' },
        { label: 'Arrêts de Bus', href: `/${locale}/dashboard/transport/stops`, permission: 'transport.route.manage' },
        { label: 'Parc de Véhicules', href: `/${locale}/dashboard/transport/vehicles`, permission: 'transport.vehicle.manage' },
        { label: 'Chauffeurs & Équipage', href: `/${locale}/dashboard/transport/drivers`, permission: 'transport.driver.manage' },
        { label: 'Affectations Élèves', href: `/${locale}/dashboard/transport/allocations`, permission: 'transport.assignment.read' },
        { label: 'Trajets du Jour', href: `/${locale}/dashboard/transport/trips`, permission: 'transport.trip.read' },
        { label: 'Pointage / Montée', href: `/${locale}/dashboard/transport/boarding`, permission: 'transport.boarding.manage' },
        { label: 'Incidents & Signalements', href: `/${locale}/dashboard/transport/incidents`, permission: 'transport.incident.read' },
        { label: 'Rapports & Exports', href: `/${locale}/dashboard/transport/reports`, permission: 'transport.report' },
        { label: 'Règles & Politiques', href: `/${locale}/dashboard/transport/policies`, permission: 'transport.policy.manage' },
      ],
    },
    {
      label: 'Rapports & Analytics',
      href: `/${locale}/dashboard/reports`,
      icon: BarChart3,
      permission: 'reports.read',
      subItems: [
        { label: 'Centre de Rapports', href: `/${locale}/dashboard/reports`, permission: 'reports.read' },
        { label: 'Mes Exécutions', href: `/${locale}/dashboard/reports/runs`, permission: 'reports.read' },
        { label: 'Planifications', href: `/${locale}/dashboard/reports/schedules`, permission: 'reports.schedule' },
        { label: 'Console Admin', href: `/${locale}/dashboard/reports/admin`, permission: 'reports.manage' },
      ],
    },
    {
      label: 'Paramètres École',
      href: `/${locale}/dashboard/settings`,
      icon: Settings,
      permission: 'settings.read',
      subItems: [
        { label: 'Paramètres Généraux', href: `/${locale}/dashboard/settings`, permission: 'settings.organization.manage' },
        { label: 'Migration & Démarrage', href: `/${locale}/dashboard/settings/migration`, permission: 'settings.read' },
        { label: 'Politiques Académiques', href: `/${locale}/dashboard/settings/policies`, permission: 'settings.read' },
        { label: 'Utilisateurs & Rôles', href: `/${locale}/dashboard/settings/users`, permission: 'users.manage' },
        { label: 'Sécurité & Sessions', href: `/${locale}/dashboard/settings/security`, permission: 'settings.security.manage' },
        { label: 'Journal de connexion', href: `/${locale}/dashboard/settings/security/login-events`, permission: 'settings.security.manage' },
        { label: 'Dispositifs de Scan', href: `/${locale}/dashboard/settings/scanner-devices`, permission: 'settings.attendance.manage' },
        { label: 'Connexions Externes', href: `/${locale}/dashboard/settings/providers`, permission: 'settings.read' },
        { label: 'Classes en Direct — Fournisseurs', href: `/${locale}/dashboard/settings/live-classrooms`, permission: 'live.providers.manage' },
        { label: 'Liaisons Comptables', href: `/${locale}/dashboard/settings/accounting-defaults`, permission: 'finance.manage' },
        { label: 'Méthodes de paiement', href: `/${locale}/dashboard/settings/payment-methods`, permission: 'finance.manage' },
        { label: 'Traductions & Champs', href: `/${locale}/dashboard/settings/translations`, permission: 'settings.localization.manage' },
        { label: 'Tâches & Audit', href: `/${locale}/dashboard/settings/jobs`, permission: 'audit.read' },
        { label: 'Abonnement & Licence', href: `/${locale}/dashboard/settings/subscription`, permission: 'settings.read' },
        { label: 'Modules & Licences', href: `/${locale}/dashboard/settings/entitlements`, permission: 'settings.read' },
        { label: 'Registre des paramètres', href: `/${locale}/dashboard/settings/values`, permission: 'settings.read' },
        { label: 'Approbation des paramètres', href: `/${locale}/dashboard/settings/drafts`, permission: 'settings.read' },
        { label: 'Séries de numérotation', href: `/${locale}/dashboard/settings/numbering`, permission: 'settings.read' },
        { label: 'Champs personnalisés', href: `/${locale}/dashboard/settings/custom-fields`, permission: 'settings.read' },
        { label: 'Tâches automatisées', href: `/${locale}/dashboard/settings/scheduled-jobs`, permission: 'settings.read' },
        { label: 'Matrice des permissions', href: `/${locale}/dashboard/settings/permissions`, permission: 'users.permissions.manage' },
        { label: 'Boîte notifications', href: `/${locale}/dashboard/settings/notifications`, permission: 'settings.read' },
        { label: 'Exports & téléchargements', href: `/${locale}/dashboard/settings/exports`, permission: 'settings.read' },
        { label: 'Succursales & Campus', href: `/${locale}/dashboard/settings/branches`, permission: 'settings.organization.manage' },
        { label: 'Domaine Personnalisé', href: `/${locale}/dashboard/settings/domain`, permission: 'settings.organization.manage' },
        { label: 'Site Web — Thème & Identité', href: `/${locale}/dashboard/settings/website`, permission: 'website.read' },
        { label: 'Site Web — Pages', href: `/${locale}/dashboard/settings/website/pages`, permission: 'website.pages.manage' },
        { label: 'Site Web — Menu', href: `/${locale}/dashboard/settings/website/menu`, permission: 'website.menu.manage' },
        { label: 'Site Web — Actualités', href: `/${locale}/dashboard/settings/website/news`, permission: 'website.news.manage' },
        { label: 'Réinitialisation Accès', href: `/${locale}/dashboard/settings/access-reset`, permission: 'users.manage' },
        { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp`, permission: 'settings.read' },
      ],
    },
    { label: 'Statut CNDP F211', href: `/${locale}/dashboard/settings/cndp`, icon: ShieldCheck, permission: 'settings.read' },
  ];

  // Capability-driven: an item is visible if its own permission is granted,
  // AND (for parents with subItems) at least one child is visible too -
  // otherwise a parent like "Élèves & Profils" would show as a dead link
  // wrapping zero visible sub-pages once granular per-subitem gating narrows
  // it down further than the parent's own permission alone would.
  const visibleSchoolNavItems = schoolNavItems
    .filter(item => canSee(item.permission))
    .map(item => ({
      ...item,
      subItems: item.subItems ? item.subItems.filter(sub => canSee(sub.permission)) : undefined,
    }))
    .filter(item => item.subItems === undefined || item.subItems.length > 0);

  // Self-service links for student/parent roles. These roles never hold the
  // staff-side keys (hostel.read, live.read), and canSee() treats an undefined
  // permission as "always visible", so gating by role here (not by capability)
  // keeps them out of the staff nav for admin roles.
  const parentPortalNav: NavItem[] = [
    {
      label: 'Espace Parent',
      href: `/${locale}/dashboard/parent`,
      icon: LayoutDashboard,
      subItems: [
        { label: 'Tableau de bord', href: `/${locale}/dashboard/parent` },
        { label: 'Présence', href: `/${locale}/dashboard/parent/attendance` },
        { label: 'Finance', href: `/${locale}/dashboard/parent/finance` },
        { label: 'Communication', href: `/${locale}/dashboard/parent/communication` },
        { label: 'Demandes & documents', href: `/${locale}/dashboard/parent/requests` },
        { label: 'Paramètres', href: `/${locale}/dashboard/parent/settings` },
      ],
    },
  ];

  // Self-service portal for teachers. Teachers hold staff-side capability keys
  // too, but this is the always-present entry point to their own workspace.
  const teacherPortalNav: NavItem[] = [
    {
      label: 'Espace Enseignant',
      href: `/${locale}/dashboard/teacher`,
      icon: GraduationCap,
      subItems: [
        { label: 'Tableau de bord', href: `/${locale}/dashboard/teacher` },
      ],
    },
  ];

  // Self-service portal for students.
  const studentPortalNav: NavItem[] = [
    {
      label: 'Espace Élève',
      href: `/${locale}/dashboard/student`,
      icon: School,
      subItems: [
        { label: 'Tableau de bord', href: `/${locale}/dashboard/student` },
      ],
    },
  ];

  const selfServiceNavItems: NavItem[] =
    userRole === 'student' || userRole === 'parent' || userRole === 'teacher'
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
                },
                {
                  label: userRole === 'student' ? 'Mes classes en direct' : 'Classes en direct de mon enfant',
                  href: userRole === 'student'
                    ? `/${locale}/dashboard/student/live-classes`
                    : `/${locale}/dashboard/parent/live-classes`,
                  icon: Video,
                },
              ]
            : []),
        ]
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
        {canSee('guard.portal.use') && (
          <div className="border-b border-slate-800 p-3">
            <Link href={`/${locale}/dashboard/portals/guard/emergency`} className="flex items-center gap-3 rounded-xl border border-[#E5544B]/50 bg-[#E5544B]/15 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#E5544B]/25">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#E5544B] text-white"><Siren className="size-4" /></span>
              <span>{tNav('emergencySecurity')}</span>
              <span className="ml-auto size-2 animate-pulse rounded-full bg-[#E5544B]" />
            </Link>
          </div>
        )}

        {/* Section 1: Super Admin Suite (Super Admin Role Only) */}
        {isSuperAdmin && (
          <div className="space-y-1 border-b border-slate-800/80 p-3">
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

        {/* Section 2: School OS Operational Modules */}
        <div className="space-y-1 p-3">
          <div
            onClick={() => toggleMenu('school-modules')}
            className="
              flex cursor-pointer items-center justify-between px-3 py-1.5
              text-[11px] font-extrabold tracking-wider text-slate-400 uppercase
              transition-colors
              hover:text-white
            "
          >
            <span>{tNav('schoolModules')}</span>
            {openMenus['school-modules']
              ? (
                  <ChevronDown className="size-3.5" />
                )
              : (
                  <ChevronRight className="size-3.5" />
                )}
          </div>

          {openMenus['school-modules'] && (
            <div className="space-y-0.5 pt-1">
              {navItems.map((item) => {
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
