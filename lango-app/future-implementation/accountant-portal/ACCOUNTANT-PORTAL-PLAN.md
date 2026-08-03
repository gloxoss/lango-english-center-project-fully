# Accountant Portal — Future Implementation Plan

## Goal

Provide controlled Student Accounting and Office Accounting operations without school-wide administration or unrestricted personal-data access.

## Core journeys and pages

- **Finance home:** collection due/today, allocation/job exceptions, unreconciled payments, cashier status, approvals and period-close readiness.
- **Student receivables:** fee structures/types, allocations, invoices, statements, credits/fines, due-fee aging and reminders.
- **Collection desk:** exact student/invoice search, offline payment, allocation, receipt, cashier session and end-of-day close.
- **Office accounting:** approved account/journal access, deposits, expenses, transactions, reconciliation and financial statements according to permission.
- **Approvals:** invoice credits/cancellations, refunds, reversals, expense vouchers, mappings and period actions with maker-checker separation.
- **Reports/exports:** fee, receipt, due, fine, cashier, ledger and statements; sensitive exports are logged.
- **Configuration:** only finance-owned policies/mappings explicitly granted; no provider secret reveal or general school settings.

## Rules and APIs

- Accountant is not synonymous with finance administrator. Capabilities distinguish prepare, approve, post, collect, reverse, refund, reconcile, close and report.
- Branch/cashier/account scopes constrain every row and aggregate. High-risk actions require recent authentication, reason and optional second approver.
- Posted records are immutable; correction is reversal/credit/refund. Amounts and totals are server-calculated with fixed precision.
- `/api/accountant/me/home|tasks|cashier|approvals`, then existing Student/Office Accounting APIs under capability/scope enforcement.
- Never expose student academic/medical data beyond identity/contact fields needed for billing and authorized guardian routing.

## Delivery

1. Capability matrix, scoped home and receivables.
2. Collection/cashier/receipts.
3. Allocations, exceptions and reminders.
4. General ledger/expense/reconciliation integration.
5. Approvals, reports, close and operational monitoring.

## Done when

- Segregation-of-duties and branch/cashier negative tests pass.
- Every balance reconciles to source subledger/general ledger and every correction is traceable.
- No finance action grants unrelated school-admin authority.

