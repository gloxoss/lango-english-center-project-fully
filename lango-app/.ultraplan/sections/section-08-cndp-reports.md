# Section 08: CNDP Compliance & Generated Report Cards / Certificates

## Overview
Implements the CNDP Moroccan Data Protection Compliance Tracker (`src/features/cndp/`) matching `cndp_declarations` table in `pre-dev/05-database-schema.md` (Form F211 status), and PDF Report Cards / Certificate Generator using `jspdf` and HTML templates.

## Risk: `green` — PDF generation & compliance UI

## Tasks

<task type="auto" id="08-01">
  <name>Create CNDP Declaration Tracker Feature</name>
  <files>src/features/cndp/ui/cndp-declaration-section.tsx, src/features/cndp/server/cndp.service.ts</files>
  <action>
    Build CNDP Form F211 declaration tracker UI displaying compliance status (Not Started, Pending, Filed) and auto-generating the CNDP data residency declaration document.
  </action>
  <verify>CNDP card displays compliance badge and declaration status</verify>
  <done>CNDP Declaration Tracker feature created</done>
</task>

<task type="auto" id="08-02">
  <name>Create Trilingual PDF Report Card Generator</name>
  <files>src/features/grading/lib/report-card-pdf.ts, src/features/grading/ui/report-card-preview.tsx</files>
  <action>
    Build PDF Report Card generator creating printable student trimester report cards with subject scores out of 20, coefficients, moyenne, class rank, and mention. Supports French and Arabic layouts.
  </action>
  <verify>Export PDF button downloads valid printable report card document</verify>
  <done>PDF Report Card generator completed</done>
</task>

<task type="auto" id="08-03">
  <name>Create Student Enrollment Certificate Generator</name>
  <files>src/features/students/lib/certificate-pdf.ts, src/features/students/ui/certificate-modal.tsx</files>
  <action>
    Build official student enrollment certificate PDF generator with school header, student details, and official seal placeholder.
  </action>
  <verify>Certificate modal generates downloadable PDF document</verify>
  <done>Enrollment Certificate generator created</done>
</task>

<task type="auto" id="08-04">
  <name>Create Settings & CNDP Compliance Page Route</name>
  <files>src/app/[locale]/(dashboard)/settings/page.tsx, src/app/[locale]/(dashboard)/settings/cndp/page.tsx</files>
  <action>
    Assemble Settings and CNDP Compliance page routes inside Next.js App Router dashboard shell.
  </action>
  <verify>Navigate to /fr/dashboard/settings and view tenant CNDP status</verify>
  <done>Settings & CNDP page routes active</done>
</task>
