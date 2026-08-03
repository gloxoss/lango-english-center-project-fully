# Open-source reference repositories

Research verified on **2026-08-01**. Re-check versions, security advisories, and
licenses immediately before adding any dependency or copying any code/assets.
Repository code may be reused only under its license; screenshots, logos,
sample identities, and third-party artwork are not automatically reusable just
because source code is open.

## Primary technical reference — pdfme

- Repository: https://github.com/pdfme/pdfme
- Documentation: https://pdfme.com/docs/supported-features
- License: MIT (`LICENSE.md` in the repository)
- Stack/fit: TypeScript, React UI, JSON templates, browser and Node generation.
- Verified useful capabilities: WYSIWYG designer, viewer, text, images, SVG,
  shapes, custom fonts/fallbacks, QR, Code 128, PDF417 and other barcodes,
  tables, lists, plugin mechanism, template validation/CLI, and a sample
  template gallery.
- Intended use in SchoolOS: preferred designer/generation foundation or source
  of implementation patterns. Wrap it with SchoolOS persistence, tenant-safe
  data binding, RBAC, audit, card lifecycle, and batch jobs.
- Do not copy: pdfme Cloud behavior, its entire playground UI, unrelated sample
  templates, or assets whose provenance is unclear.

## Badge workflow inspiration — LibreBadge

- Repository: https://github.com/LibreBadge/LibreBadge
- License: MIT
- Status: archived/read-only since 2025.
- Stack: old Django/Bootstrap application.
- Intended use: understand badge record/template/print workflow and historical
  problems web-based badge tools tried to solve.
- Do not use as a dependency or architecture base; it is archived and does not
  match the Next.js/TypeScript stack.

## Batch-card inspiration — ID-Cards-Generator

- Repository: https://github.com/RedaElmar/ID-Cards-Generator
- License: MIT
- Stack: Python/Jupyter, HTML/CSS, `wkhtmltopdf`, Code 128.
- Intended use: simple reference for dataset ingestion, field substitution,
  barcode creation, and one-PDF-per-record batch flow.
- Do not use as the production engine: it is small, old, Windows-path-specific,
  and lacks multi-tenant security, template versioning, lifecycle, and job
  reliability.

## Optional low-level canvas reference — React Konva

- Repository: https://github.com/konvajs/react-konva
- License: MIT
- Intended use: fallback/reference only if pdfme's designer cannot support a
  required card-editor interaction. It provides React bindings for interactive
  canvas shapes and works with modern Next.js via client-side/dynamic loading.
- Recommendation: do not combine two designer engines in version 1. Start with
  pdfme; adopt Konva only after a focused proof shows a real blocker.

## Reference hierarchy

1. **pdfme** — primary technical engine and designer reference.
2. **Our SchoolOS design system and domain model** — source of truth for UI,
   permissions, tenant data, workflows, and terminology.
3. **LibreBadge** — domain inspiration only.
4. **ID-Cards-Generator** — batch-flow inspiration only.
5. **React Konva** — contingency for missing editor behavior.

