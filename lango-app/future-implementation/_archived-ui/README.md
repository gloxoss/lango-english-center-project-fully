# Archived UI

Most screens parked here were **orphaned**: nothing in `src/app` imported them.
Five Communication screens were reachable by direct URL and were archived after
the 2026-09-23 visual sweep found invented contacts and metrics. The layouts are
kept for reuse, not because the workflows worked.

Each one renders **hardcoded constants, not API data**. That is the main reason
they were never wired up, and it is the work any restore has to do.

Keep the original filenames so `git log --follow` can find their history after commit.

## What is here

| File | Was | Mock data it renders |
| --- | --- | --- |
| `features/academics/ui/teacher-profile-view.tsx` | Teacher dashboard | `TEACHER_SCHEDULE`, `TEACHER_CLASSES`, `HOMEWORK_TO_GRADE`, `SUBMITTED_COPIES`, `TEACHER_MESSAGES`, `PERFORMANCE_STATS` |
| `features/students/ui/student-profile-view.tsx` | Student dashboard | `STUDENT_COURSES_TODAY`, `PENDING_HOMEWORK`, `RECENT_GRADES`, `SUBJECT_PROGRESS`, `ANNOUNCEMENTS`, `TEACHER_COMMENTS` |
| `features/crm/ui/librarian-portal-view.tsx` | Librarian portal | `ACTIVE_BORROWS`, `UPCOMING_RETURNS`, `MOST_BORROWED_BOOKS` |
| `features/crm/ui/hr-directory-view.tsx` | HR directory | `HR_EMPLOYEES`, `DEPT_DISTRIBUTION`, `RECENT_HR_ACTIONS`, `PENDING_HR_APPROVALS`, `CONTRACT_TYPES` |
| `features/finance/ui/financial-reports-view.tsx` | Financial reports | `INITIAL_CHECKLIST_ITEMS`, `ANOMALIES`, `GENERAL_LEDGER_BALANCES`, `RECENT_CLOSE_EVENTS`, `AVAILABLE_STATEMENTS` |
| `components/teacher/GradeEntryGrid.tsx` | A second grade-entry grid | 4 students inline in `useState`; `handleSave` sets a flag for 3s and calls no API |
| `components/teacher/TeacherTodaySchedule.tsx` | Teacher's day view | class list inline in `useState` |
| `features/crm/{ui,data}/{lead-pipeline,audience-segments,form-intake,milestone-triggers,templates-automation}*` | Five direct-URL Communication pages | Imported fixture records used as live client state |

Between them they hold ~44 controls with no handler at all — pagination bars that
paginate nothing, row `⋮` menus, and "see all" links that go nowhere. Treat every
button as unwired until proven otherwise.

**Do not revive `GradeEntryGrid.tsx`.** The live keyboard grid is
`src/features/assessment/ui/marksheet-grid-view.tsx`, backed by
`src/features/assessment/services/marksheet-grid.ts` and used by both
`dashboard/academics/grades/entry` and the exam-term marksheet. This archived copy
predates it and saves nothing; it is kept only so the layout is not lost.

Note that live screens already exist for some of this ground: the librarian portal
pages under `src/app/[locale]/(dashboard)/dashboard/portals/librarian/`, and the
real teacher portal at `dashboard/teacher`. Check those before reviving a file
here, so you do not end up with two versions of the same screen.

## Why they are excluded from the build

`tsconfig.json` (`exclude`) and `eslint.config.mjs` (`ignores`) both skip this
directory. Parked code should never be able to fail a typecheck or block a
refactor of the live app.

The cost of that is real: these files **will rot**. They import from `@/components/ui/*`
and `@/features/*`, and nothing now checks those imports still resolve. Expect to
fix imports and prop signatures on restore.

## Restoring one

```bash
# from lango-app/
git mv future-implementation/_archived-ui/features/<area>/ui/<file>.tsx \
       src/features/<area>/ui/<file>.tsx
```

Then, before wiring it to a page:

1. `npx tsc --noEmit` — expect broken imports after time away.
2. Replace every `const SCREAMING_CASE = [...]` with a real fetch. The tables above
   list what to replace.
3. Give every control a handler, or delete it. A button that does nothing is worse
   than no button.
4. Add the page's nav entry with a `permission` that **matches the page's own
   `requireServerPage` guard** — `src/libs/api/__tests__/nav-page-guard-parity.test.ts`
   enforces this, and a mismatch bounces the user to the public marketing site.
