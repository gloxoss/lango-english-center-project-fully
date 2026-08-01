// Addon registry - organizational only, no gating logic yet (by design, see
// AGENT-HANDOFF.md "Addon system" decision). Lists optional/future modules
// so their eventual code lives under src/addons/<id>/ from day one instead
// of getting mixed into core features and needing a painful split later.
//
// Nothing reads `enabled` to block access right now - every route/page still
// decides access purely via role/tenant checks like the rest of the app.
// When real plan-based gating is wanted, this is where it plugs in.

export type AddonDefinition = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const ADDONS: AddonDefinition[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Communication',
    description: 'WhatsApp inbox and campaign sending (design mockups exist in design/whatsapp/, not built).',
    enabled: false,
  },
  {
    id: 'hostel',
    name: 'Hostel Management',
    description: 'Residences, room/bed inventory, effective-dated allocations, roll call, leave/return, visitors, incidents, inspections, maintenance, charges and supervision reports. See future-implementation/hostel-management/. Not built.',
    enabled: false,
  },
  {
    id: 'transport',
    name: 'Transport Management',
    description: 'Versioned routes/stops, vehicles/crew, capacity-aware student allocations, trips, rider scans, live GPS/ETA, guardian alerts, incidents, maintenance, compliance and reports. See future-implementation/student-transport/. Not built.',
    enabled: false,
  },
  {
    id: 'library',
    name: 'Library Management',
    description: 'Bibliographic catalog, copy-level branch inventory, circulation, renewals, reservations, transfers, stocktake, configurable policies, member self-service, notifications and reports. See future-implementation/library-management/. Not built.',
    enabled: false,
  },
  {
    id: 'event-management',
    name: 'Event Management',
    description: 'School event types, recurrence, venues, audiences, approvals, publishing, RSVP, capacity/waitlists, reminders, check-in, unified calendar projection and reports. See future-implementation/event-management/. Not built.',
    enabled: false,
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Product catalog, suppliers, purchases, school-shop sales, and equipment loans. See future-implementation/inventory-management/. Not built.',
    enabled: false,
  },
  {
    id: 'human-resources',
    name: 'Human Resources & Employee Management',
    description: 'Departments, designations, rich employee profiles, employment lifecycle, HR documents, and workforce reporting. Basic staff accounts and access control remain core. See future-implementation/human-resources-employee-management/. Not built.',
    enabled: false,
  },
  {
    id: 'payroll-workforce',
    name: 'Payroll & Workforce Operations',
    description: 'Morocco-first payroll structures/runs/payslips/payments, salary advances, employee leave policies/balances/requests, awards, self-service, and statutory/accounting integrations. Depends on the Human Resources employee-profile foundation. See future-implementation/payroll-and-workforce-operations/. Not built.',
    enabled: false,
  },
  {
    id: 'card-management',
    name: 'Card & Admit Card Management',
    description: 'Visual templates, student/employee ID cards, exam admit cards, secure QR verification, bulk generation, print sheets, and issue/reprint/revocation history. See future-implementation/card-and-admit-card-management/. Not built.',
    enabled: false,
  },
  {
    id: 'certificate-management',
    name: 'Certificate Issuance & Verification',
    description: 'Student and employee certificate definitions, visual templates, evidence/approval workflows, bulk issuance, secure QR verification, delivery, correction, replacement, and revocation. Reuses a neutral document engine without requiring the Card addon. See future-implementation/certificate-management/. Not built.',
    enabled: false,
  },
  {
    id: 'live-classrooms',
    name: 'Live Classrooms & Reports',
    description: 'Provider-neutral virtual classroom scheduling, secure joins, participant-event reconciliation, recordings, and live-class reports. BigBlueButton is the recommended first provider. See future-implementation/live-classrooms/. Not built.',
    enabled: false,
  },
  {
    id: 'attachments-book',
    name: 'Attachments Book & Academic Resources',
    description: 'Reusable academic resource library with attachment taxonomy, resumable secure uploads, versioning, audience targeting, previews, quotas, and access analytics. See future-implementation/attachments-book/. Not built.',
    enabled: false,
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
    description: 'Enrollment lead pipeline (kanban, lead profile, ad-platform capture). Backend already real (inquiries/inquiryFollowUps tables, public capture endpoint, convert-to-student) - only the UI is missing. See future-implementation/lead-crm-and-broadcast-messaging/.',
    enabled: false,
  },
  {
    id: 'broadcast-messaging',
    name: 'Broadcast Messaging',
    description: 'Provider-neutral SMS/email/WhatsApp/Telegram/Messenger campaigns, channel templates, delivery reports, audience segments, consent/suppression and scheduled automations including student/staff birthday wishes. Fully unbuilt. See future-implementation/lead-crm-and-broadcast-messaging/.',
    enabled: false,
  },
  {
    id: 'advanced-reporting',
    name: 'Advanced Reporting',
    description: 'Governed cross-module report catalog with domain-owned queries, saved views, audited background CSV/XLSX/PDF exports, immutable snapshots, scheduled secure delivery, lineage, projections and operational monitoring. See future-implementation/advanced-reporting/. Not built.',
    enabled: false,
  },
];
