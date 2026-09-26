// BRANCH-SCOPE-01 B5-01: what the campus switcher MEANS on the current page.
//
// Derived from src/libs/api/branch-scope-registry.ts (the page's main API
// mode, plan section 5) but curated per DASHBOARD module, because whole
// modules are mixed (e.g. academics = shared subjects + own classes):
//   'scoped'   the page honours the campus choice  -> dropdown (or locked pill)
//   'shared'   tenant-wide configuration or books  -> "Commun à tous les sites" pill
//   'personal' self/relationship data              -> no switcher at all
// Everything not listed is 'scoped': a dropdown on a mixed page is harmless;
// a wrong pill or a hidden selector is not.

export type BranchPageMode = 'scoped' | 'shared' | 'personal';

// Personal pages, highest priority.
const PERSONAL_PAGE_PATTERNS = [
  /^\/dashboard\/portals(\/|$)/, // role portals (student/teacher/parent/guard kiosks)
  /^\/dashboard\/parent(\/|$)/,
  /^\/dashboard\/alumni(\/|$)/,
  /^\/dashboard\/leadership(\/|$)/,
  /^\/dashboard\/hr\/self-service(\/|$)/,
];

// Shared pages: tenant-wide configuration and the legal books (DB3).
const SHARED_PAGE_PATTERNS = [
  /^\/dashboard\/finance\/accounting(\/|$)/, // chart of accounts, journals, periods, statements
  /^\/dashboard\/settings(\/|$)/, // tenant configuration reference
  /^\/dashboard\/hr\/designations(\/|$)/,
  /^\/dashboard\/academics\/(?:subjects|mediums|sections|semesters|streams|shifts|optional-subjects|academic-years|session-years|evaluations|question-bank|syllabus)(\/|$)/,
];

export function getBranchPageMode(pathname: string | null): BranchPageMode {
  if (!pathname) return 'scoped';
  // Strip the locale prefix: /fr/dashboard/... -> /dashboard/...
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=(\/|$))/, '');
  if (PERSONAL_PAGE_PATTERNS.some(p => p.test(withoutLocale))) return 'personal';
  if (SHARED_PAGE_PATTERNS.some(p => p.test(withoutLocale))) return 'shared';
  return 'scoped';
}
