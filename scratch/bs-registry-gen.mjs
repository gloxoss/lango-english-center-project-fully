// One-off generator for src/libs/api/branch-scope-registry.ts
// (BRANCH-SCOPE-01 B3-01). Run from lango-app/: node ../scratch/bs-registry-gen.mjs
//
// Prefills route -> branch mode for every API route on the filesystem, using
// the module segment and the same import-closure scan as
// .ultraplan/branch-scope/inventory/scan.mjs. Modes: see
// .ultraplan/branch-scope/PLAN.md section 5.
//   own      row carries branch_id directly
//   student  row belongs to a student (filter through user.branch_id)
//   employee row belongs to an employee (employee_profiles/user.branch_id)
//   shared   tenant-wide configuration or legal books (no branch filter)
//   personal self/relationship data (no branch filter)
//   platform super-admin/public/health/webhooks (no branch filter)
//
// Heuristics only assign the DEFAULT for a route; every entry that the
// heuristics were not confident about is emitted with review: true. Waves
// W1-W6 correct wrong entries (one-line reason in the done note).

import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');
const OUT = path.join(process.cwd(), 'src', 'libs', 'api', 'branch-scope-registry.ts');

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.ts') out.push(p);
  }
  return out;
};

const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const resolveImp = (spec) => {
  if (!spec.startsWith('@/')) return null;
  const b = `src/${spec.slice(2)}`;
  for (const x of [`${b}.ts`, `${b}/index.ts`, `${b}.tsx`]) if (fs.existsSync(x)) return x;
  return null;
};

// --- module -> default mode / column -------------------------------------
// `student`-mode modules key on the student's user.branch_id.
// `own`-mode modules key on their own table's branch_id.
// `employee`-mode modules key on the employee's user.branch_id (teachers,
// HR staff) — one per module, written here per plan section 5.
const MODULE_MODES = {
  // platform
  'super-admin': ['platform'],
  public: ['platform'],
  health: ['platform'],
  webhooks: ['platform'],
  tenant: ['platform'],
  waitlist: ['platform'],
  support: ['platform'],
  auth: ['platform'],
  dev: ['platform'],
  cron: ['platform'],
  // personal (self / relationship)
  portal: ['personal'],
  student: ['personal'],
  students: ['student', 'user.branchId via studentId'],
  guardian: ['personal'],
  parent: ['personal'],
  alumni: ['personal'],
  employee: ['personal'],
  leadership: ['personal'],
  addons: ['review'],
  // own modules (tables carry branch_id — verified in the DB, 2026-09-25)
  library: ['own', 'library rows branchId (copies/members/policies/stocktakes/closure)'],
  hostel: ['own', 'hostels.branchId via room hierarchy'],
  transport: ['own', 'transport_routes.branchId'],
  reception: ['own', 'reception_appointments/reception_handoffs.branchId'],
  guard: ['own', 'guard_* .branchId'],
  events: ['own', 'events.branchId'],
  scanner: ['own', 'scanner_devices.branchId'],
  'scanner-devices': ['own', 'scanner_devices.branchId'],
  communication: ['own', 'communication_*.branchId'],
  crm: ['own', 'leadership_scope_assignments.branchId'],
  // student-mode (row belongs to a student / applicant)
  attendance: ['student', 'user.branchId via studentId'],
  admissions: ['own', 'applicants.branchId'],
  academics: ['review'],
  assessment: ['student', 'user.branchId via studentId'],
  finance: ['review'],
  hr: ['employee', 'employee_profiles.branchId'],
  workforce: ['employee', 'employee_profiles.branchId'],
  payroll: ['employee', 'employee_profiles.branchId'],
  teachers: ['employee', 'user.branchId (teacher)'],
  // mixed / reporting / settings
  dashboard: ['review'],
  analytics: ['review'],
  reports: ['review'],
  reporting: ['review'],
  search: ['review'],
  settings: ['review'],
  documents: ['student', 'student_documents via studentId'],
  files: ['own', 'files.branchId'],
  notifications: ['personal'],
  inventory: ['review'],
};

const PLATFORM_SEGMENTS = new Set(['super-admin', 'public', 'health', 'webhooks', 'waitlist', 'support', 'auth', 'dev', 'cron']);
const SHARED_PATH_PATTERNS = [
  /academic-years/, /session-years/, /semesters/, /mediums/, /sections(\/|$)/,
  /subjects/, /streams/, /shifts/, /optional-subjects/, /question-bank/,
  /fee-types/, /chart-of-accounts/, /journals/, /accounting\/periods/,
  /payment-methods/, /voucher-types/, /templates/, /roles/, /permissions/,
  /syllabus/, /website/, /class-results/, /timetable-versions/, /evaluations/,
  /grading\/policies/, /assessment-definitions/, /fine-policies/, /leave\/categories/,
  /settings\/general/, /settings\/cndp/, /settings\/scheduled-jobs/, /settings\/providers/,
  /settings\/custom-fields/, /settings\/documents/, /settings\/export/,
  /communication_connections/, /loan-policies/,
];
const PERSONAL_PATTERNS = [
  /\/me(\/|$)/, /\/self-service/, /\/my-/, /portal\/(role|home|manifest|preferences|activity|branch|me|search)/,
  /\/kiosk/, /resident\/me/,
];

// Sub-prefix overrides applied after personal/shared patterns and before the
// module preset. Format: [regex on the route, mode, column, review].
const SUBPREFIX = [
  // Already-implemented student-mode scoping (B1 foundation; verified).
  [/^\/api\/dashboard\/summary/, 'student', 'user.branchId / classes.branchId', false],
  [/^\/api\/portal\/search/, 'student', 'user.branchId via studentId', true],
  // W5 resolutions:
  // bibliographic records are tenant-wide titles; the campus lives on copies.
  [/^\/api\/addons\/library\/catalog/, 'shared', undefined, false],
  // W4 resolutions:
  // DB3: the payroll legal entity is whole-school — runs, periods, payments
  // and payroll config are never split by campus.
  [/^\/api\/workforce\/payroll\//, 'shared', undefined, false],
  [/^\/api\/hr\/payroll\//, 'shared', undefined, false],
  // designations carry no branch column (tenant-wide job taxonomy).
  [/^\/api\/hr\/designations/, 'shared', undefined, false],
  // hr/payroll periods handled above; departments carry their own branch.
  [/^\/api\/hr\/departments/, 'own', 'departments.branchId', false],
  // W1 resolutions (review entries closed with reasons):
  // alumni programming tables carry no branch column — school-wide.
  [/^\/api\/students\/alumni\/(events|requests)/, 'shared', undefined, false],
  // promotion_batches carries no branch column; class scope lives on the
  // preview payload and target classes.
  [/^\/api\/students\/promotions/, 'shared', undefined, false],
  // whole-school per-branch analytics board is the route's purpose.
  [/^\/api\/students\/transfer-stats/, 'shared', undefined, false],
  // academic_rooms carries no branch column.
  [/^\/api\/academics\/rooms/, 'shared', undefined, false],
  // timetable/exception rows are campus data through their class.
  [/^\/api\/academics\/timetable-slots/, 'own', 'classes.branchId (via class_sections)', false],
  [/^\/api\/academics\/timetable-conflicts/, 'own', 'classes.branchId (via class_sections)', false],
  [/^\/api\/attendance\/session-exceptions/, 'own', 'classes.branchId (via class_schedule_slots)', false],
  // kiosk device sessions self-scope; the campus is the gate's, not the caller's.
  [/^\/api\/attendance\/qr\/scanner-sessions/, 'personal', undefined, false],
  // W3 resolutions:
  // certificate TEMPLATES/config/jobs are tenant-wide; issued docs follow the
  // recipient (student mode); requests are the requester's own.
  [/^\/api\/certificates\/(definitions|settings|signatories|overview|jobs)/, 'shared', undefined, false],
  [/^\/api\/certificates\/requests/, 'personal', undefined, false],
  [/^\/api\/cards\/(jobs|overview)/, 'shared', undefined, false],
  [/^\/api\/cards\/admit-seats/, 'own', 'exam_halls.branchId', false],
  [/^\/api\/cards\/employees/, 'employee', 'user.branchId (staff member)', false],
  // document studio designs are tenant-wide templates.
  [/^\/api\/documents\/designs/, 'shared', undefined, false],
  // exam term rows carry no branch; stage lifecycle is tenant-wide. The
  // marksheet/rankings/seats child operations are class/hall-gated in code.
  [/^\/api\/academics\/exam-terms$/, 'shared', undefined, false],
  [/^\/api\/academics\/exam-terms\/\[id\]\/stage/, 'shared', undefined, false],
  // student self-service paths (audience-checked: own attempts/submissions).
  [/^\/api\/academics\/online-exams\/(take|submit)/, 'personal', undefined, false],
  [/^\/api\/academics\/homework\/(upload|\[id\]\/submit)/, 'personal', undefined, false],
  // live classrooms: participation-scoped (own sessions), not campus data.
  [/^\/api\/addons\/live-classrooms/, 'personal', undefined, false],
  // finance: money follows the student (DB3 keeps the legal books shared)
  [/^\/api\/finance\/accounting/, 'shared', undefined, false],
  [/^\/api\/finance\/bank-reconciliation/, 'shared', undefined, false],
  [/^\/api\/finance\/expenses/, 'shared', undefined, false],
  [/^\/api\/finance\/exports/, 'shared', undefined, false],
  [/^\/api\/finance\/fee-types/, 'shared', undefined, false],
  [/^\/api\/finance\/fee-structures/, 'own', 'fee_structures.branchId', false],
  [/^\/api\/finance\/fee-allocations?/, 'own', 'fee_allocation_runs.branchId', true],
  [/^\/api\/finance\/fee-assignments/, 'student', 'user.branchId via studentId', false],
  [/^\/api\/finance\/(payments|invoices|receipts|refunds|credit-notes|statements|reminders|fines|cashier-sessions|collection-desk|online-payments|payment-reversals)/, 'student', 'user.branchId via studentId', false],
  // students sub-modules
  [/^\/api\/students\/admissions/, 'own', 'applicants.branchId', false],
  [/^\/api\/students\/alumni/, 'student', 'user.branchId via studentId', true],
  [/^\/api\/students\/(parents|guardians)/, 'student', 'user.branchId via studentId', false],
  // academics structure is own-via-class; results are student
  [/^\/api\/academics\/(classes|class-sections|class-subjects|class-teachers|class-offerings)/, 'own', 'classes.branchId (via class_sections.classId)', false],
  [/^\/api\/academics\/(online-exams|homework|assignments|grade-entry|grades)/, 'student', 'user.branchId via studentId', false],
  [/^\/api\/academics\/exam-terms/, 'student', 'user.branchId via studentId', true],
  // settings: values/drafts carry their own branch column
  [/^\/api\/settings\/(values|drafts)/, 'own', 'setting_values.branchId', false],
  [/^\/api\/settings\/branches/, 'shared', undefined, false],
  [/^\/api\/settings\//, 'shared', undefined, false],
  // student-facing documents/cards/certificates
  [/^\/api\/(certificates|cards)/, 'student', 'user.branchId via studentId', false],
  [/^\/api\/documents/, 'student', 'student_documents via studentId', false],
  // content assets are file rows with their own branch column
  [/^\/api\/content\/assets/, 'own', 'files.branchId', true],
  // addons/live-classrooms: class-scoped sessions (W3/W5 to confirm the join)
  [/^\/api\/addons\/live-classrooms/, 'student', 'class branch via classroom', true],
  // addons/reporting: W6
  [/^\/api\/addons\/reporting/, 'review', undefined, true],
];

// Addons with their own branch-carrying tables (verified in the DB).
const OWN_ADDONS = new Set(['library', 'hostel', 'transport', 'inventory', 'broadcast', 'guard', 'events']);
// Personal/self-service addons.
const PERSONAL_ADDON_PATTERNS = [/resident\/me/, /\/me(\/|$)/];

function classify(route, mod, src, all) {
  const segments = route.split('/').filter(Boolean);
  if (PLATFORM_SEGMENTS.has(mod)) return { mode: 'platform', review: false };
  if (mod === 'addons') {
    // route = /api/addons/<name>/... ; segments: [api, addons, name, ...]
    const addon = segments[2] ?? '';
    const inner = segments.slice(3).join('/');
    if (PERSONAL_ADDON_PATTERNS.some(p => p.test(route))) return { mode: 'personal', review: false };
    if (OWN_ADDONS.has(addon)) {
      // W5: bibliographic catalog records are tenant-wide titles; the campus
      // lives on the copies.
      if (addon === 'library' && /^catalog(\/|$)/.test(inner)) {
        return { mode: 'shared', review: false };
      }
      return { mode: 'own', column: `${addon} tables branchId`, review: false };
    }
    return { mode: 'review', review: true };
  }

  // personal: anything /me-ish or portal self data.
  if (PERSONAL_PATTERNS.some(p => p.test(route))) {
    return { mode: 'personal', review: false };
  }
  // shared reference data / legal books.
  if (SHARED_PATH_PATTERNS.some(p => p.test(route))) {
    return { mode: 'shared', review: false };
  }

  for (const [re, mode, column, review] of SUBPREFIX) {
    if (re.test(route)) return { mode, column, review: Boolean(review) };
  }

  const preset = MODULE_MODES[mod];
  if (preset && preset[0] !== 'review' && preset[0] !== 'personal') {
    return { mode: preset[0], column: preset[1], review: false };
  }

  // Reviews: anything whose module has no confident default.
  const usesCtxBranch = /(ctx|context)\.branchId|principal\.branchId/.test(all);
  return { mode: 'review', column: preset?.[1], review: true, usesCtxBranch };
}


function main() {
  const files = walk(API_DIR);
  const entries = [];
  for (const f of files) {
    const src = read(f);
    const imps = [...src.matchAll(/from '(@\/(?:features|libs\/services|addons)[^']+)'/g)].map(m => resolveImp(m[1])).filter(Boolean);
    const all = src + imps.map(read).join('\n');
    const route = `/${path.relative('src/app', path.dirname(f)).split(path.sep).join('/')}`;
    const parts = route.split('/');
    const mod = parts[2] === 'addons' ? 'addons' : (parts[2] ?? '');
    const c = classify(route, mod, src, all);
    const writes = /export (?:async )?function (POST|PUT|PATCH|DELETE)/.test(src);
    entries.push({ route, mod, mode: c.mode, column: c.column, review: c.review, writes, usesCtxBranch: /(ctx|context)\.branchId|principal\.branchId/.test(all) });
  }

  const counts = {};
  for (const e of entries) counts[e.mode] = (counts[e.mode] ?? 0) + 1;
  console.log('counts:', JSON.stringify(counts));
  console.log('total:', entries.length, 'review:', entries.filter(e => e.review).length);

  const lines = entries
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((e) => {
      const col = e.column ? `, column: '${e.column}'` : '';
      const rev = e.review ? ', review: true' : '';
      return `  '${e.route}': { mode: '${e.mode}'${col}${rev} },`;
    });

  const header = `// BRANCH-SCOPE-01 B3-01: every API route -> its branch mode (plan section 5).
//
// Modes:
//   own      the row has its own branch_id            -> branchWhere(ctx, table.branchId)
//   student  the row belongs to a student             -> filter through the student's user.branchId
//   employee the row belongs to an employee           -> via employee_profiles.branchId or the employee's user.branchId
//   shared   tenant-wide configuration or legal books -> none; UI says "Commun à tous les sites"
//   personal self or relationship data                -> none
//   platform super-admin, public, health, webhooks    -> none
//
// review: true marks entries the prefill heuristics were NOT confident about;
// a wave (W1-W6) must resolve each one before scoping that route.
//
// Prefilled by script (scratch/bs-registry-gen.mjs) from the filesystem plus
// the module/table scan. scripts/check-branch-scope.ts enforces that this
// registry covers every route on the filesystem and that own/student/employee
// routes use the branch helpers (or are listed in
// scripts/branch-scope-baseline.json, which may only shrink).

export type BranchRouteMode = 'own' | 'student' | 'employee' | 'shared' | 'personal' | 'platform' | 'review';

export type BranchRouteEntry = {
  mode: BranchRouteMode;
  /** For own/student/employee: the column (or joined column) the branch
   *  filter keys on. One per module, decided in the registry — not per route. */
  column?: string;
  /** Heuristic prefill was unsure; the owning wave must resolve this. */
  review?: boolean;
};

export const BRANCH_SCOPE_REGISTRY: Record<string, BranchRouteEntry> = {
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${header}${lines.join('\n')}\n};\n`);
  console.log('written:', OUT);
}

main();
