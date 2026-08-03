# Section 18: Settings Policies Persistence

## Overview
`policies-view.tsx`'s toggles are local `useState` only; `handleSave` is a fake `setTimeout` with zero persistence - the only settings page never upgraded to the real page/client server-prefetch pattern the rest of settings now uses.

## Risk: [green] - the settings-values registry pattern already exists and is proven (used by ~10 other settings pages this session), this is applying an established pattern, not inventing one

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Reuses the already-tested settings/values route - no new automated test needed.)

## Tasks

<task type="auto" id="18-01">
  <name>Register policy keys in the settings registry if not already present</name>
  <files>src/libs/settings/registry.ts</files>
  <action>Check which policy toggles in policies-view.tsx already have a matching key in SETTINGS_REGISTRY. Add any missing ones with an appropriate namespace/requiredPermission (likely settings.security.manage or settings.organization.manage depending on what each toggle governs - match to the closest existing category, don't invent a new permission).</action>
  <verify>registry keys resolve correctly via getDefinition()</verify>
  <done>Every toggle on the page has a real settings-registry key</done>
</task>

<task type="auto" id="18-02">
  <name>Wire policies-view.tsx to real GET/PATCH via /api/settings/values/[key], remove the fake setTimeout save</name>
  <files>src/features/settings/ui/policies-view.tsx</files>
  <action>Replace local-only useState with values fetched from GET /api/settings/values on mount. Replace handleSave's setTimeout with real PATCH calls to /api/settings/values/[key] per changed toggle.</action>
  <verify>tsc --noEmit clean; toggling a policy and reloading the page shows the persisted state, not the default</verify>
  <done>No fake setTimeout save remains; toggles persist across reload</done>
</task>
