# Payroll & Workforce Operations — Manual Testing

## Operational UI acceptance (Part 4)

1. Enable `human-resources`, then `payroll-workforce`; verify reversing that order is blocked.
2. As payroll configurator, open `/fr/dashboard/workforce`, then regulations, settings, components, structures, assignments and adjustments. Verify ordinary HR users cannot open them directly.
3. Create a monthly run at `/fr/dashboard/workforce/payroll/runs`; calculate it, inspect employee totals and traces, then submit it for review.
4. In a second authorized account, approve it. Confirm the calculator is rejected when attempting self-approval.
5. Post through Accounting. With a missing mapping, voucher, journal, or fiscal period, confirm the run remains approved and explains the blocker.
6. Create a payment batch for the posted run. Confirm its preparer cannot approve it. Approve with a second actor, reconcile it, then close the run.
7. Replay lifecycle requests and verify there is no second posting, payslip, allocation, or payment.
8. Open leave, advances and awards. Confirm refresh persists data, own items cannot be self-approved, and foreign tenant IDs disclose nothing.
9. Sign in as an employee and verify only own payslips, leave, advances and awards are visible.
10. Repeat at 390px, keyboard-only, French and Arabic RTL; capture loading, empty, validation, forbidden and accounting-blocked states.

DAMANCOM and bank exports remain disabled and uncertified. Statutory results require documented review by a qualified Moroccan payroll professional.

## Core run

1. Enable Human Resources and Payroll & Workforce Operations.
2. Configure a published rule version, salary structure, employee assignment, and accounting mappings.
3. Create and calculate a monthly run; inspect frozen inputs, trace, gross/net equation, and employee count.
4. Submit for review. Confirm the calculator cannot approve their own run.
5. Approve as another user and confirm recalculation is blocked.
6. Post and verify the accounting journal balances exactly. Retry identically and confirm no duplicate; change the payload and confirm conflict.
7. Confirm issued payslips are employee-scoped and draft calculations are hidden.
8. Mark paid and close. Exercise reversal on a separate posted run.

## Leave, advances, awards, security

1. Submit/cancel leave and race cancellation against review.
2. Submit an advance; verify a second pending request is rejected and minimum-net recovery is enforced.
3. Grant an award and verify it becomes a payroll input rather than changing salary.
4. Confirm employees see only their records and sensitive data is denied without its capability.
5. Test French and Arabic/RTL, 390px mobile, keyboard navigation, focus, empty/error/forbidden, and degraded-network states.

Do not enable DAMANCOM or bank exports until professionally certified.
