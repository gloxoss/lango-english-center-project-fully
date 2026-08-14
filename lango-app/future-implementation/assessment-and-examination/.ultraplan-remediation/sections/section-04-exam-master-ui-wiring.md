# Section 04: Exam Master UI Wiring

## Overview
Replaces the Exam Master page's hardcoded French demo state and fake `setTimeout()`-based "success" actions with real `fetch()` calls against section-03's routes.

## Risk: green - UI wiring against already-correct visual design and now-real backend routes

## Dependencies
- Depends on: section-03
- Blocks: section-06
- Parallel batch: 2

## TDD Test Stubs
- Test: Loading the page shows real exam terms/halls from the database, not hardcoded demo rows.
- Test: "Enregistrer la Grille" (save marksheet) genuinely posts to the real route and the UI reflects a real success/failure based on the actual response, not always showing a fake success toast.
- Test: "Lancer l'Attribution Automatique" (seat allocation) genuinely calls the real route and shows real allocation results.

## Tasks

<task type="auto" id="04-01">
  <name>Wire real data fetching and mutations into the Exam Master page</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/exam-master/page.tsx</files>
  <action>
    Read the file in full (443 lines). Replace every hardcoded demo array (exam terms, halls, marksheet rows, seat allocations) with real `useEffect`-driven `fetch()` calls to section-03's routes on mount and on relevant user actions. Replace "Enregistrer la Grille"'s `setTimeout()`-based fake success with a real `POST` to the marksheet route, showing success/failure based on the real response. Replace "Lancer l'Attribution Automatique"'s boolean-flip with a real `POST` to the seat-allocation route, rendering the real returned allocation counts/seats. Match this codebase's existing fetch/loading/error-state patterns used correctly elsewhere (e.g. the reporting workspace view fixed earlier this session).
  </action>
  <verify>Load the page against a real tenant with real exam terms and confirm they render. Save a real marksheet entry and confirm it persists (reload the page, confirm the value is still there, sourced from the database not local state).</verify>
  <done>Every action on the Exam Master page genuinely reads from and writes to the real database through section-03's routes.</done>
</task>
