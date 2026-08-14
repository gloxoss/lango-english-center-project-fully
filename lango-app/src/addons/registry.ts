// Addon registry - organizational only, no gating logic yet (by design, see
// AGENT-HANDOFF.md "Addon system" decision). Lists optional/future modules
// so their eventual code lives under src/addons/<id>/ from day one instead
// of getting mixed into core features and needing a painful split later.
//
// `enabled` here means "the module is built", not "this tenant may use it".
// Per-tenant access lives in the addon_entitlements table and is enforced by
// requireAddon() in src/libs/api/entitlements.ts. Only `multi-branch` is wired
// to that gate today; the rest are unbuilt, so there is nothing yet to gate.

export type AddonDefinition = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /**
   * Add-on ids that must be entitled (active) before this add-on can be
   * activated. Enforced at activation (super-admin grant + school_admin toggle)
   * and by `requireWorkforceAddon` at runtime for `payroll-workforce`.
   */
  requires?: string[];
};

export const ADDONS: AddonDefinition[] = [
  {
    id: 'multi-branch',
    name: 'Multi-Succursales',
    description: 'Plusieurs succursales/campus par établissement. The only addon actually built and gated today - see POST /api/settings/branches.',
    enabled: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Communication',
    description: 'WhatsApp inbox and campaign sending (design mockups exist in design/whatsapp/, not built).',
    enabled: false,
  },
  {
    id: 'hostel',
    name: 'Hostel Management',
    description: 'Residences, room/bed inventory, effective-dated allocations, roll call, leave/return, visitors, incidents, inspections, maintenance, charges and supervision reports. See future-implementation/hostel-management/.',
    enabled: true,
  },
  {
    id: 'transport',
    name: 'Transport Management',
    description: 'Versioned routes/stops, vehicles/crew, capacity-aware student allocations, trips, rider scans, live GPS/ETA, guardian alerts, incidents, maintenance, compliance and reports. See future-implementation/student-transport/.',
    enabled: true,
  },
  {
    id: 'library',
    name: 'Library Management',
    description: 'Bibliographic catalog, copy-level branch inventory, circulation, renewals, reservations, transfers, stocktake, configurable policies, member self-service, notifications and reports. See future-implementation/library-management/.',
    enabled: true,
  },
  {
    id: 'event-management',
    name: 'Event Management',
    description: 'School event types, draft/publish/cancel lifecycle, bounded recurrence, venues/capacity/audiences, RSVP/waitlist offers, check-in, tasks/incidents/feedback/communications, unified calendar projection, iCalendar export and reports. See future-implementation/event-management/. Built.',
    enabled: true,
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Product catalog, suppliers, purchases, school-shop sales, and equipment loans. See future-implementation/inventory-management/. Built.',
    enabled: true,
  },
  {
    id: 'human-resources',
    name: 'Human Resources & Employee Management',
    description: 'Departments, designations, rich employee profiles, employment lifecycle, HR documents, and workforce reporting. Basic staff accounts and access control remain core. See future-implementation/human-resources-employee-management/. Built.',
    enabled: true,
  },
  {
    id: 'payroll-workforce',
    name: 'Payroll & Workforce Operations',
    description: 'Morocco-first payroll structures/runs/payslips/payments, salary advances, employee leave policies/balances/requests, awards, self-service, and statutory/accounting integrations. Depends on the Human Resources employee-profile foundation. See future-implementation/payroll-and-workforce-operations/. Built (backend); DAMANCOM and bank export adapters stay disabled until certified.',
    enabled: true,
    requires: ['human-resources'],
  },
  {
    id: 'card-management',
    name: 'Card & Admit Card Management',
    description: 'Visual templates, student/employee ID cards, exam admit cards, secure QR verification, bulk generation, print sheets, and issue/reprint/revocation history. See future-implementation/card-and-admit-card-management/. Built.',
    enabled: true,
  },
  {
    id: 'certificate-management',
    name: 'Certificate Issuance & Verification',
    description: 'Student and employee certificate definitions, visual templates, evidence/approval workflows, bulk issuance, secure QR verification, delivery, correction, replacement, and revocation. Reuses a neutral document engine without requiring the Card addon. See future-implementation/certificate-management/. Built.',
    enabled: true,
  },
  {
    id: 'live-classrooms',
    name: 'Live Classrooms & Reports',
    description: 'Provider-neutral virtual classroom scheduling, secure joins, participant-event reconciliation, recordings, and live-class reports. Ships with the deterministic dev provider; the BigBlueButton adapter is implemented to contract but not certified. See future-implementation/live-classrooms/. Built.',
    enabled: true,
  },
  {
    id: 'attachments-book',
    name: 'Attachments Book & Academic Resources',
    description: 'Reusable academic resource library with attachment taxonomy, resumable secure uploads, versioning, audience targeting, previews, quotas, and access analytics. See future-implementation/attachments-book/. Built.',
    enabled: true,
  },
  {
    id: 'online-examinations',
    name: 'Online Examinations',
    description: 'Versioned question banks, exam blueprints/forms, secure timed delivery, autosave/recovery, accommodations, objective/manual grading, monitoring, integrity events, and online result analysis. Uses the core assessment/result ledger. See future-implementation/assessment-and-examination/. Not built.',
    enabled: false,
  },
  {
    id: 'lead-crm',
    name: 'Lead CRM',
    description: 'Enrollment lead pipeline (kanban, lead profile, ad-platform capture). Backend and UI both built (inquiries/inquiryFollowUps tables, public capture endpoint, convert-to-student). See future-implementation/lead-crm-and-broadcast-messaging/.',
    enabled: true,
  },
  {
    id: 'broadcast-messaging',
    name: 'Broadcast Messaging',
    description: 'Provider-neutral SMS/email/WhatsApp/Telegram/Messenger campaigns, channel templates, delivery reports, audience segments, consent/suppression and scheduled automations including student/staff birthday wishes. Built (test provider only; real SMS/email provider pending). See future-implementation/lead-crm-and-broadcast-messaging/.',
    enabled: true,
  },
  {
    id: 'advanced-reporting',
    name: 'Advanced Reporting',
    description: 'Governed cross-module report catalog with domain-owned queries, saved views, audited background CSV/XLSX/PDF exports, immutable snapshots, scheduled secure delivery, lineage, projections and operational monitoring. See future-implementation/advanced-reporting/. Built.',
    enabled: true,
  },
  {
    id: 'school-website-cms',
    name: 'Site Web École',
    description: 'Per-school public marketing website: theme/site identity, fixed page types (Home/About/Gallery/FAQ/Contact/Services), a flat ordered menu, and a minimal news/blog. Public route resolved by tenant slug. See future-implementation/school-website-cms/. Built and verified end-to-end (fresh-DB migration, live tenant-isolation smoke test, npx next build).',
    enabled: true,
  },
];
