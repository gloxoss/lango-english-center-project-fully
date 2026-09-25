# Section 14: Post-merge on-screen sweep

## Overview
140 pages are "fixed, waiting for a re-sweep"; only 21 are confirmed on screen. After the merge, re-check them as the right role and record results with the hub `swept` command.

## Risk: [yellow]

## Dependencies
- Depends on: 13 (and 12 helps) · Blocks: release · Batch 4 · Hub item: `task:up-14-sweep-<module>` (split by module across agents)

## Tasks

<task type="auto" id="14-01">
  <name>Sweep each fixed page as its role</name>
  <files>none</files>
  <action>For each page in lango-app/docs/audit/page-audit/STATUS.md marked fixed-awaiting-sweep: open it as the role named in its finding, in fr and ar, check the finding's "Done when", then node .agent-hub/hub.mjs swept page:<route> --ok|--fail --note "<role> + what you saw". A --fail reopens the finding.</action>
  <verify>STATUS.md: "confirmed on screen" count rises; every --fail has a reopened finding.</verify>
  <done>Every fixed page seen working by an agent.</done>
</task>
