# Section 03: Hardcoded-French ratchet regression

## Overview
`npm run check:i18n:hardcoded` fails: 1 246 strings vs a baseline of 1 211. The +35 came from the new document system (codex-4, `task:pdf-document-system`): `app/pages` 120→152 (mostly `settings/documents/page.client.tsx`, 41 strings), `features/documents` 0→5 (`features/documents/ui/pdf-preview.tsx`), `components/shared` 49→50.

## Risk: [green] Translation only.

## Dependencies
- Depends on: codex-4 releasing `task:pdf-document-system` (do not edit its files while claimed; ask it via hub say to do this itself if still active) · Blocks: 10, 13 · Batch 1
- Hub item: `task:up-03-ratchet`

## TDD Test Stubs
- Test: `node scripts/check-hardcoded-french.mjs` exits 0.

## Tasks

<task type="auto" id="03-01">
  <name>Translate the new document-system strings</name>
  <files>lango-app/src/app/[locale]/(dashboard)/dashboard/settings/documents/page.client.tsx, lango-app/src/features/documents/ui/pdf-preview.tsx, lango-app/locales/{fr,en,ar}.json</files>
  <action>
    List with: node scripts/check-hardcoded-french.mjs --list app/pages (and features/documents, components/shared).
    Move each visible string to a new namespace (DocumentSettings, PdfPreview) in all three locales. Obey PLAN.md rule 8 for locale edits. Use ICU plurals with identical structure in fr/en/ar.
  </action>
  <verify>npm run check:i18n (pass), npm run check:i18n:keys (0 missing), node scripts/check-hardcoded-french.mjs (exit 0, total ≤ 1 211).</verify>
  <done>The ratchet passes again.</done>
</task>
