# Section 06: Fee Structures, Invoices & Payment Feature Module

## Overview
Implements the Finance feature module (`src/features/finance/`): Fee Structure Definitions (tuition, registration, transport), Automatic Invoice Generation per class group or student, Payment Recording (full/partial), Overdue Fee Flagging, and Revenue Summary Overview.

## Risk: `green` — Standard financial ledger & invoicing

## Tasks

<task type="auto" id="06-01">
  <name>Create Finance Types & Validation Schemas</name>
  <files>src/features/finance/model/types.ts, src/features/finance/validation/finance.schema.ts</files>
  <action>
    Define TypeScript types and Zod schemas for Fee Structures, Invoices (Paid, Unpaid, Partial, Overdue), Payments, and Expenses.
  </action>
  <verify>Import finance schemas without compilation errors</verify>
  <done>Finance model types & schemas defined</done>
</task>

<task type="auto" id="06-02">
  <name>Create Finance Server Service</name>
  <files>src/features/finance/server/finance.service.ts</files>
  <action>
    Build server-side functions for generating class invoices, recording payments, flagging overdue fees, and computing revenue metrics.
  </action>
  <verify>Recording a partial payment updates invoice balance remaining</verify>
  <done>Finance service layer completed</done>
</task>

<task type="auto" id="06-03">
  <name>Create Revenue & Financial Dashboard Component</name>
  <files>src/features/finance/ui/finance-dashboard-section.tsx, src/features/finance/ui/finance-dashboard-client.tsx</files>
  <action>
    Build Financial overview dashboard displaying monthly revenue, total collected MAD, outstanding balance, and overdue counts.
  </action>
  <verify>Dashboard summary cards display formatted MAD values</verify>
  <done>Finance Dashboard overview created</done>
</task>

<task type="auto" id="06-04">
  <name>Create Invoices List & Status Badges Component</name>
  <files>src/features/finance/ui/invoices-list.tsx, src/features/finance/ui/payment-modal.tsx</files>
  <action>
    Build Invoices list table with status badges (Paid, Unpaid, Partial, Overdue) and Payment Recording modal.
  </action>
  <verify>Payment modal records cash/check/transfer payments cleanly</verify>
  <done>Invoices list & Payment modal completed</done>
</task>

<task type="auto" id="06-05">
  <name>Create Fee Structure Definition Manager</name>
  <files>src/features/finance/ui/fee-structures-list.tsx</files>
  <action>
    Build UI for defining custom school fee structures and payment schedules per grade/program.
  </action>
  <verify>Fee structure creator updates template list</verify>
  <done>Fee Structure manager created</done>
</task>

<task type="auto" id="06-06">
  <name>Create Finance Page Routes</name>
  <files>src/app/[locale]/(dashboard)/finance/page.tsx, src/app/[locale]/(dashboard)/finance/fees/page.tsx, src/app/[locale]/(dashboard)/finance/invoices/page.tsx, src/app/[locale]/(dashboard)/finance/invoices/[id]/page.tsx</files>
  <action>
    Assemble Next.js App Router page routes for Finance summary, Fee structures, Invoices directory, and Invoice Detail view.
  </action>
  <verify>Navigate to /fr/dashboard/finance/invoices and view invoice list</verify>
  <done>Finance page routes active</done>
</task>
