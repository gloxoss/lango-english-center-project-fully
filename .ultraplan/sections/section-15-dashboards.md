# Section 15: S-15 — one director dashboard

## Overview
`/dashboard` (home) and `/dashboard/analytics` (same view as `/dashboard/portals/leadership`) show overlapping KPIs over different periods (month vs 30 days / 6 months). IGP formula is already explained on screen.

## Risk: [green] Gate: owner decision D2.

## Dependencies
- Depends on: 08, D2 · Blocks: none · Batch 3 · Hub item: `task:up-15-dashboards` (then close finding S-15)

## Tasks

<task type="auto" id="15-01">
  <name>Apply D2 by deleting the duplicate, not by building a third</name>
  <files>the duplicate page.tsx, sidebar entry</files>
  <action>With the default D2: make /dashboard/analytics a redirect() to /dashboard/portals/leadership, remove its sidebar entry, keep /dashboard as home. State each KPI's period in its label where two screens still differ.</action>
  <verify>check:ui unchanged or better; hub.mjs done S-15 with the before/after routes; a second agent verifies on screen.</verify>
  <done>One place per KPI; S-15 closed.</done>
</task>
