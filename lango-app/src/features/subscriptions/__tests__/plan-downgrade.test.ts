// Plan downgrade — characterization tests (AUD-PLATFORM-01).
//
// The question was: if a school moves to a cheaper plan while it still uses
// add-ons or capacity the lower plan does not include, what actually happens?
// These tests pin the ANSWER so it can never change silently.
//
// Findings (see report §4/§11):
//
//   1. CAPACITY: assertStudentCapacity blocks *new* students above the new plan's
//      maxStudents, but never removes or deactivates existing ones. A downgraded
//      tenant is therefore over its cap and frozen from growing, with all data
//      intact. That is a soft-overage policy and a genuine business rule: the
//      alternative would mean deleting a school's students.
//
//   2. ADD-ONS: changing planTier only ever GRANTS the new plan's included
//      add-ons. Nothing is revoked, so a downgraded school keeps the higher
//      plan's modules until someone disables them by hand.
//      This is deliberate in the code (syncPlanModulesToSchools says it adds
//      "without revoking custom grants already given to specific schools") but
//      the model cannot tell a plan-inherited grant from a bespoke one — there is
//      no source column — so a safe automatic revoke is impossible without a
//      schema change. Classified as a product/business-rule decision, with this
//      test as the standing evidence.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PLAN_LIMITS = path.resolve(process.cwd(), 'src/features/subscriptions/services/plan-limits-service.ts');
const SCHOOLS = path.resolve(process.cwd(), 'src/app/api/super-admin/schools/route.ts');

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('Plan downgrade behaviour', () => {
  it('blocks growth at the new cap without touching existing students', () => {
    const src = read(PLAN_LIMITS);
    // The guard compares current + additional against the cap...
    expect(src).toMatch(/current \+ additional > limit\.maxStudents/);
    // ...and there is no delete/deactivate of users anywhere in the service.
    expect(src).not.toMatch(/db\.delete\(user\)|userStatus:\s*'inactive'/);
  });

  it('treats an uncapped plan as unlimited and a missing plan row as no-op', () => {
    const src = read(PLAN_LIMITS);
    expect(src).toContain('if (!limit || limit.maxStudents == null) return;');
  });

  it('grants add-ons on plan change and never revokes them', () => {
    const src = read(SCHOOLS);
    // On planTier change it computes what is missing and inserts it...
    expect(src).toContain('const toAdd = newPlan.includedAddons.filter(a => !grantedSet.has(a));');
    // ...and there is no entitlement deletion/disable in the plan-change path.
    const planChange = src.slice(src.indexOf('existing.planTier !== body.planTier'));
    expect(planChange).not.toMatch(/delete\(addonEntitlements\)|isEnabled:\s*false/);
  });

  it('documents that plan sync is additive only', () => {
    // The design intent is stated in the service; keep it stated.
    expect(read(PLAN_LIMITS)).toMatch(/without revoking/i);
  });

  it('refuses to delete a plan that schools still use', () => {
    // Data-integrity guard on the other side of the downgrade question.
    const src = read(PLAN_LIMITS);
    expect(src).toContain('PLAN_IN_USE');
    expect(src).toContain('CANNOT_DELETE_SYSTEM_PLAN');
  });
});
