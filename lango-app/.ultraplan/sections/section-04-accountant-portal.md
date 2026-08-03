# Section 04: 5C Accountant Portal (`/dashboard/accountant`)

## Overview
Build Accountant Portal dashboard featuring Cashier Desk payment collection modal, student receivables subledger, fee structure management, bank reconciliation, and fiscal period close indicator.

## Risk: [yellow] - Financial accuracy and cashier workflow required.

## Dependencies
- Depends on: Section 01
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: verifies cashier payment collection creates payment allocation and updates invoice balance.
- Test: verifies fiscal period close status indicator reflects active period state.

## Tasks

<task type="auto" id="04-01">
  <name>Build Accountant Dashboard Overview & Receivables Summary</name>
  <files>src/app/[locale]/(dashboard)/accountant/page.tsx, src/components/accountant/ReceivablesSummary.tsx</files>
  <action>
    Create Accountant Portal home view displaying total receivables, daily collection total, unpaid invoices count, and fiscal period status badge.
  </action>
  <verify>Navigating to /dashboard/accountant displays financial summary</verify>
  <done>Accountant home view displays financial KPIs and fiscal status</done>
</task>

<task type="auto" id="04-02">
  <name>Build Cashier Desk Instant Payment Collection Modal</name>
  <files>src/components/accountant/CashierPaymentModal.tsx, src/app/api/finance/payments/cashier/route.ts</files>
  <action>
    Build fast front-desk cashier modal allowing accountants to search student, select unpaid invoice, record payment (cash/card/transfer), apply automatic allocation, and print PDF receipt.
  </action>
  <verify>Cashier payment collection updates invoice status and posts allocation</verify>
  <done>Cashier modal collects payment and prints receipt</done>
</task>

<task type="auto" id="04-03">
  <name>Build Bank Reconciliation & Fiscal Closing Controls</name>
  <files>src/components/accountant/BankReconciliationPanel.tsx, src/components/accountant/FiscalPeriodControl.tsx</files>
  <action>
    Build bank account reconciliation panel and fiscal period close control widget.
  </action>
  <verify>Closing period updates status to CLOSED in database</verify>
  <done>Accountants can perform bank reconciliations and close fiscal periods</done>
</task>
