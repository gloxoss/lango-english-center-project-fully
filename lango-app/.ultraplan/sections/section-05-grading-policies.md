# Section 05: Grading/Assessment Policies

## Overview
`assessment-policies-view.tsx` hardcodes `MOCK_WEIGHTS` and `MOCK_SCALES`, and its "Enregistrer la politique" button has no handler at all. `academics/assessment-plans` exists (grading.manage-wired this session) but assessment *policy* (weighting rules, grading scale definitions like the existing gradingScales table used by assessment-plans) isn't exposed through it. This section adds that missing slice.

## Risk: [yellow] - touches the grading engine other real pages depend on (moroccan-grade-engine.ts, assessment-plans); must not change existing grade calculations for pages already using gradingScales

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: PATCH /api/academics/grading-policy persists weight changes and they're readable back exactly
- Test: existing assessment-plans creation still resolves gradingScales correctly after this change (regression check, not new behavior)
- Test: only school_admin can change policy (grading.manage - matches this session's convention, though this is policy-setting not day-to-day grading, so double check the permission fits before wiring - if it doesn't cleanly fit, flag rather than force it, per this session's established rule about not silently widening/narrowing)

## Tasks

<task type="auto" id="05-01">
  <name>Confirm gradingScales/gradingScaleIntervals schema covers weights and scale bands</name>
  <files>src/models/Schema.ts (read, likely no changes)</files>
  <action>
    Read gradingScales and gradingScaleIntervals table definitions. These likely already model what MOCK_SCALES represents (grade bands like A/B/C with min/max). Confirm before adding anything new. MOCK_WEIGHTS (per-assessment-type weighting, e.g. "Devoirs 30%, Examens 70%") is less likely to have a schema home - check assessmentPlans/assessments for a weight column; if none exists, this task's output is: either add a weight column to assessmentPlans, or a new tenant-level default-weights settings key using the existing setting_values registry pattern (cheaper, matches this session's settings.read/settings.*.manage precedent) - prefer the settings-registry route if the weights are genuinely tenant-wide defaults rather than per-assessment-plan.
  </action>
  <verify>read-only task, no migration unless the settings-registry route is rejected as insufficient</verify>
  <done>Clear decision recorded: reuse gradingScales as-is for scales, and either a new settings-registry key or a schema column for weights, with rationale</done>
</task>

<task type="auto" id="05-02">
  <name>Build the grading-policy read/write route</name>
  <files>src/app/api/academics/grading-policy/route.ts (new) OR extend src/app/api/settings/values/route.ts's registry if task 05-01 chose that path</files>
  <action>
    If schema-column path: GET/PATCH route reading/writing gradingScales + the new weight field, requireCapability(context, 'academics.manage'). If settings-registry path: add a new key definition (e.g. 'academics.grading_weights') to src/libs/settings/registry.ts with an appropriate requiredPermission, then this "route" is just the existing /api/settings/values/[key] - no new file needed, just a registry entry.
  </action>
  <verify>PATCH persists, GET reads it back, existing assessment-plans grading flow unaffected (regression check against moroccan-grade-engine.test.ts if it exists, or manual grade-entry smoke test)</verify>
  <done>Weights and scales are both real, persisted, tenant-scoped</done>
</task>

<task type="auto" id="05-03">
  <name>Wire assessment-policies-view.tsx to the real route, remove MOCK_WEIGHTS/MOCK_SCALES, give the save button a real handler</name>
  <files>src/features/grading/ui/assessment-policies-view.tsx</files>
  <action>
    Replace both mock arrays with real fetches. Give "Enregistrer la politique" an onClick that PATCHes the route from task 05-02, with a real success/error toast instead of no feedback at all.
  </action>
  <verify>tsc --noEmit clean; save button persists and survives reload</verify>
  <done>No MOCK_WEIGHTS/MOCK_SCALES reference remains; save button has a real, working handler</done>
</task>
